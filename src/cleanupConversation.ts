import { ChatMessage } from "@lmstudio/sdk";
import { backupConversation } from "./backupConversation";
import { acquireLock, releaseLock } from "./acquireLockFile";
import { join } from "node:path";

import {
    open,
    readFile,
    writeFile,
    stat,
    unlink
} from "node:fs/promises";

import { 
    getConversationFileName,
    getThresholdParamsCollection,
    getValidatedConversationRootDirectory,
    setThresholdParamsCollection
} from "./config";

import {
    normalizeJsonFileName,
    scanForConversationFileThruFullConversationDirectoryScan,
    thresholdParamsCollectionSetterHelper
} from "./promptPreprocessor";

const multiEditCoordinatorWriteQueue: string[] = [];
let multiEditCoordinatorIndex = 0;
let stabalized: boolean = false;
let resolveMecStateChange: (() => void) | null = null;
let mecStateChanged = new Promise<void>((resolve) => {
    resolveMecStateChange = resolve;
});
let snapshotOfWriteQueueLength = 0;
let assistantUpdateHandled = false;

/**
 * Monitors and controls when the cleanup will initiate
 * and when it's finished
 */
export async function startPollingToCleanupConversation(
    keepOldestN: number,
    keepNewestN: number,
    cleanupThinkingOnly: boolean,
    keepAllMessages: boolean,
    createBackup: boolean,
    keepAllThinking: boolean,
    assistantMessageCount: number,
    conversationFileName: string,
    userText: string,
    autoCleanupThreshold: number,
    compactAMemory: boolean,
    messages: ChatMessage[],
    cleanupCounter: number,
): Promise<void> {
    try {
        const conversationDirectory = getValidatedConversationRootDirectory();

        const conversationFile = join(
            conversationDirectory,
            normalizeJsonFileName(conversationFileName),
        );

        // Prepare json file to be readable and assign to variable
        const conversation = await readConversationWithRecovery(
            conversationDirectory,
            conversationFileName,
            userText,
        );

        // Conversation was unusable exit this function,
        // this turn to WRITE the conversation file is lost.
        if (conversation === null) {
            return;
        }

        await thresholdParamsCollectionSetterHelper(conversation);

        let { tokenCount, contextLength } = getThresholdParamsCollection();
        tokenCount = getThresholdParamsCollection().tokenCount;
        contextLength = getThresholdParamsCollection().contextLength;

        const usagePercentage = Math.min(
            100,
            (tokenCount! / contextLength!) * 100
        );

        // Token count is from the prior read so we are preempting a excess of the threshold by N% early
        // We are passing the variable to PM-E, forgot why, but we compensate for the early lead.
        const leadToCompensateForLaggingTokenCount = 1;
        const requestThresholdCleanup = usagePercentage >= (autoCleanupThreshold - leadToCompensateForLaggingTokenCount);
        const thresholdAutoCleanupDisabled = autoCleanupThreshold >= 90;
        setThresholdParamsCollection({ requestThresholdCleanup });
    
        // Snapshotting assistantLastMessagedAt field (so watcher knows when model is finished with it's response)
        const originalAssistantLastMessagedAt = conversation.assistantLastMessagedAt;

        // Coordinating Logic with Context-Cleanup Plugin
        // This plugin is ready after context cleanup is ready by around 8ms(my computer), instead of hard coding
        // it, this method will coordinate context-cleanup to create it's lock only after Presisting Memories plugin has been
        // forced to be the winner.
        const enabledPluginsArray = conversation.plugins;

        const hasPersistingMemories = enabledPluginsArray.some(
            (plugin: string) => plugin.includes("persisting-memories"),
        );

        const functionName = "startPollingToCleanupConversation";
        
        // This will help regulate the timings of multiple polling plugins
        // Lock created after we did the first read to establish the originalAssistantLastMessagedAt
        const lockFile = `${conversationFile}.lock`;

        const coordinatorName = `${functionName}_${++multiEditCoordinatorIndex}`;
        multiEditCoordinatorWriteQueue.push(coordinatorName);
        snapshotOfWriteQueueLength = multiEditCoordinatorWriteQueue.length;
        stabalized = false;
        notifyMecStateChanged();
        // console.log(`=====${coordinatorName} added to MEC queue`)

        let lockOwnerName: string | undefined;

        // The shared function for execution by both paths.
        // Running with Persisting Memories is implied PM-E will watch for client stability.
        // When a ready file is made, that is PM-E ultimately declaring it found stability, executed it's functions and passed a ready file
        // to signal for this CC plugin to begin it's task. This happens within milliseconds so client stability status is reliable.
        const callbackCleanupOperation = async (
            latestConversation: any,
        ): Promise<string | undefined> => {

            try {
                lockOwnerName = await acquireLock(lockFile, functionName);

                if (createBackup) {
                    // When threshold autocleanup is disabled offset by the cleanup counter, if it is enabled then append every next new message because threshold checks every message sent
                    // When user is using the cleanup after every Nth message feature, if they queue up unrsolved writes then we need to account for it.
                    const offsetLastMessages = thresholdAutoCleanupDisabled === true? 0 : assistantMessageCount - keepOldestN - keepNewestN;

                    // This really confused the heck out of me to figure out...it was tested with real results so it would not save duplicates to the backup or miss any messages
                    // when queuing unresolved messages or resolving right on the cleanupCounter trigger
                    const additionalOffsetPerUnresolvedWriteQueue =
                        snapshotOfWriteQueueLength > 1
                        ? (
                            thresholdAutoCleanupDisabled === true
                            ? snapshotOfWriteQueueLength            // This runs when there is a queue but we're using the normal cleanupCounter cleanup.
                            : snapshotOfWriteQueueLength-1          // This runs when there is a queue while using threshold auto cleanup. Subtract 1 because the first turn was already included
                        ) 
                        : (
                            thresholdAutoCleanupDisabled === true
                                ? cleanupCounter 
                                : 0
                        );

                    const latestJson = await readFileWithRetries(
                        conversationFile,
                        2,
                        100,
                    );

                    const latestConversation = await readConversationWithParseRetries(
                        conversationFile,
                        2,          // max parse attempts
                        100,        // retry delay
                        "throw",    // error handling action
                    );

                    await backupConversation(
                        normalizeJsonFileName(conversationFileName),
                        latestJson,
                        latestConversation,
                        offsetLastMessages + additionalOffsetPerUnresolvedWriteQueue,
                    );
                }

                // Create a shadow copy only if one doesn't already exist
                // Copy must always be made before cleanup or original data will be truncated before passing to PM-E
                // Message Snapshot and Cleanup Conversation do not need to do the same odd calculations like Backup Conversation
                // They both do not need to figure out which messages are new they simply act on the final picture.
                if (
                    hasPersistingMemories && 
                    compactAMemory &&
                    requestThresholdCleanup
                ) {
                    await createACopyFileWithMessagesSnapshot(
                        conversationFile, 
                        keepOldestN, 
                        keepNewestN,
                        messages,
                        latestConversation.name,
                        autoCleanupThreshold+leadToCompensateForLaggingTokenCount,
                    );

                    const targetAssistantMessageIndex = findLastAssistantMessageIndex(latestConversation);

                    let lines: string[] = [];

                    lines.push(
                        `${[
                            `---`,
                            `🚨**Compact a Seed after Threshold Cleanup:** ***Enabled***🚨`,
                            `There will be a delay at the beginning of the next turn to create the compaction seed.`,
                            `---`
                        ]
                        .filter(Boolean)
                        .join("\n\n")}`,
                    );

                    await appendCompactionWarning(
                        latestConversation,
                        lines.join("\n\n"),
                        targetAssistantMessageIndex,
                    );
                }

                latestConversation.tokenCount = 0;
                setThresholdParamsCollection({tokenCount: 0});

                await cleanupConversation(
                    latestConversation,
                    keepOldestN,
                    keepNewestN,
                    cleanupThinkingOnly,
                    keepAllMessages,
                    keepAllThinking,
                    assistantMessageCount,
                    requestThresholdCleanup,
                    thresholdAutoCleanupDisabled,
                );

                await writeFile(
                    conversationFile,
                    JSON.stringify(latestConversation, null, 2),
                    "utf-8",
                );

            } catch (error) {
                console.error("startPollingToCleanupConversation error:", error)
            } finally {
                multiEditCoordinatorWriteQueue.length = 0;
                multiEditCoordinatorIndex = 0;
                snapshotOfWriteQueueLength = 0;
                assistantUpdateHandled = false;
                notifyMecStateChanged();
                // console.log("========CC FINISHED")
                return lockOwnerName;
            }            
        }

        const enoughMessagesToReduce = thresholdAutoCleanupDisabled
            ? assistantMessageCount >= (keepNewestN + keepOldestN + cleanupCounter)
            : requestThresholdCleanup;

        // Shortcuts polling client for stability. When we see the ready file, consume it, execute all functions. Exit.
        if (hasPersistingMemories) {

            // Exit if there was not enough new messages to have triggered a cleanup cycle
            if(!enoughMessagesToReduce) {
                // console.log("NOT READY")
                // If user is using the threshold auto cleanup we do not start building the real queue until we have exceeded the threshold
                if(!thresholdAutoCleanupDisabled) {
                    multiEditCoordinatorWriteQueue.length = 0;
                    notifyMecStateChanged();
                }
                return;
            }

            const pollForAssistantUpdate = setInterval(async () => {

                // Prevents the same single instances of this function from creating concurrently running polls to consume the ready file
                if (assistantUpdateHandled) {
                    clearInterval(pollForAssistantUpdate);
                    // console.log(`${coordinatorName} has2 early exited`)
                    return;
                }
                
                // The flag switch by the first created instance to prevent other instances of this same single function from creating more instances
                assistantUpdateHandled = true;
                clearInterval(pollForAssistantUpdate);
                // console.log(`${coordinatorName} has3 started to wait`)

                // Enter the polling watcher for the ready file
                await waitToConsumePMReadyFile(
                    conversationFile, 
                    hasPersistingMemories,
                );

                // console.log(`${coordinatorName} has finished waiting`)
                try {
                    const latestConversation = await readConversationWithParseRetries(
                        conversationFile,
                        2,          // max parse attempts
                        100,        // retry delay
                        "return",   // error handling action
                    );

                    // Exit if the conversation file was unreadable/unparsable after retries
                    if (latestConversation === null) {
                        return;
                    }

                    lockOwnerName = await callbackCleanupOperation(latestConversation);

                } catch (error){
                    if (lockOwnerName !== undefined) {
                        await releaseLock(lockFile, lockOwnerName);
                        lockOwnerName = undefined;
                    }
                } finally {
                    if (lockOwnerName !== undefined) {
                        await releaseLock(lockFile, lockOwnerName);
                        lockOwnerName = undefined;
                    }
                }
                
            },200);

            return;
        }

        // The normal path requires a local handled variable, to prevent concurrent duplicated pollers.
        // A module level one will stop all pollers regardless of the process.
        // The persisting memories path uses a different logic so it needs a module level variable.
        let assistantUpdateHandledLocal = false;

        // We are resetting the MECWQ because we do not want to start polling until there are enough messages to truncate.
        // We reset it so we can make it pass the process orderer enforcer. If MEC3 was the actual first to
        // become the poller for all the other MECs, it would never execute becausae MEC1/2 existed before it but their processes were killed
        // to save processing power. We will compensate for this shortening by artificially adding the early exited MECs count to the queue snapshot for non-threshold auto cleanup.
        // For threshold auto cleanup the count only starts after passing the threshold. So it doesn't need to care about what lead up to it, it's all fair game.
        if(!enoughMessagesToReduce) {
            // console.log("NOT READY", "REMOVED:", multiEditCoordinatorWriteQueue)
            multiEditCoordinatorWriteQueue.length = 0;
            notifyMecStateChanged();
            return;
        }

        const pollForAssistantUpdate = setInterval(async () => {
            try {
                let latestConversation: any;

                latestConversation = await readConversationWithParseRetries(
                    conversationFile,
                    2,          // max parse attempts
                    100,        // retry delay
                    "return",   // error handling action
                );

                if (latestConversation === null) {
                    return; // Skip this poll tick; keep the interval running.
                }
                
                // Assistant has finished responding for this turn
                if (latestConversation.assistantLastMessagedAt !== originalAssistantLastMessagedAt) {
                    
                    // Prevents async polls from redeclaring timing conflict states or running the rest of these functions.
                    // Only the winner will proceed through so there is only one instance.
                    if (assistantUpdateHandledLocal) {
                        return;
                    }

                    assistantUpdateHandledLocal = true;

                    clearInterval(pollForAssistantUpdate);

                    // Initiate Polling until USER STOPS TYPING during the 2 second wait period to edit the conversation file.
                    void (async () => {
                        // console.log("[MEC] Client input stability polling started:", {
                        //     time: new Date().toISOString(),
                        // });
                        
                        // Need to add some extra delay time if user spams messages then follows it with a loaded command message: save memory, TOM commands
                        const requiredStableDuration = 2200;

                        try {
                            // Every MEC gets stuck in the stability check loop until the last MEC decalres stability
                            await waitForStableClientInput(
                                conversationFile, 
                                100,      // stabilityPollInterval
                                requiredStableDuration,
                                coordinatorName
                            );

                            if(!enoughMessagesToReduce) {
                                return;
                            }

                            // console.log(`${coordinatorName} has exited the stability loop`)

                            // This forces the MEC to execute in order of when they first joined the write queue.
                            while (multiEditCoordinatorWriteQueue[0] !== coordinatorName) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                            
                            // Snapshot the last MEC in the writequeue now that the clientinput has stablized.
                            // We will then use this to know when to create the ready file for Context Cleanup Plugin.
                            const finalCoordinatorName = multiEditCoordinatorWriteQueue[multiEditCoordinatorWriteQueue.length - 1];

                            if (
                                coordinatorName === finalCoordinatorName &&
                                multiEditCoordinatorWriteQueue[0] === coordinatorName
                            ) {
                                if(thresholdAutoCleanupDisabled) {
                                    // Makes up for the MECS that were removed prior to there being enough messages to trigger the normal path
                                    snapshotOfWriteQueueLength = snapshotOfWriteQueueLength + cleanupCounter - 1;
                                }

                                // We've stablized and added the stabalized conversation file to memory,
                                // We will apply all our edits to the memory conversation to perform only a single write
                                latestConversation = await readConversationWithParseRetries(
                                    conversationFile,
                                    2,          // max parse attempts
                                    100,        // retry delay
                                    "return",   // error handling action
                                );

                                if (latestConversation === null) {
                                    return; // Skip this poll tick; keep the interval running.
                                }

                                lockOwnerName = await callbackCleanupOperation(latestConversation);
                            }

                        } catch (error) {
                            console.error(
                                "multiEditCoordinator Error during delayed memory seed cleanup:",
                                error,
                            );
                        } finally {
                            // Removes this MEC_INSTANCE from the WRITE Queue
                            const queueIndex = multiEditCoordinatorWriteQueue.indexOf(coordinatorName);

                            if (queueIndex !== -1) {
                                multiEditCoordinatorWriteQueue.splice(queueIndex, 1);
                            }

                            notifyMecStateChanged();

                            // console.log(
                            //     `[MEC Queue] ${coordinatorName} finished`,
                            //     [...multiEditCoordinatorWriteQueue]
                            // );

                            // Release Lock first so subsequent MECs can acquire a new lock to protect their write turn
                            if (lockOwnerName !== undefined) {
                                await releaseLock(lockFile, lockOwnerName);
                                lockOwnerName = undefined;
                            }
                        }
                    })();
                }
            } catch (error) {

                clearInterval(pollForAssistantUpdate);

                console.error(
                    "multiEditCoordinator Error polling for assistant update:",
                    error,
                );

                try {
                    if (lockOwnerName !== undefined) {
                        await releaseLock(lockFile, lockOwnerName);
                        lockOwnerName = undefined;
                    }

                } catch (releaseError) {
                    console.error(
                        "multiEditCoordinator Error releasing lock after polling failure:",
                        releaseError,
                    );
                }
            }
        }, 200);

    } catch (error) {
        console.error(
            `startPollingToCleanupConversation error: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    }
}

/**
 * The main cleanup function. Determines the elements that are cleaned up
 * in the conversation file to recoup context spent on elements that aren't
 * the final assistant message or the original user message.
 */
async function cleanupConversation(
    conversation: any,
    keepOldestN: number,
    keepNewestN: number,
    cleanupThinkingOnly: boolean,
    keepAllMessages: boolean,
    keepAllThinking: boolean,
    assistantMessageCount: number,
    requestThresholdCleanup: boolean,
    thresholdAutoCleanupDisabled: boolean,
): Promise<void>{

    const messages = conversation.messages ?? [];

    const totalMessageCount = messages.length;

    // Only trims when there are actually enough messages available
    const enoughMessagesToReduce = keepOldestN + keepNewestN < assistantMessageCount;

    // should reduce only if: 
    // 1) Cleanup But Keep All Messages is OFF
    // 2) There is enough messages to reduce
    // 3) Threshold auto cleanup is OFF
    // 4) Request Threshold Cleanup has triggered.
    const shouldReduceMessages = !keepAllMessages && enoughMessagesToReduce && (thresholdAutoCleanupDisabled || requestThresholdCleanup);

    // NOT INSTRUCTIONS part was included to better clean memories for transfer
    // It will be reappended after the transfer
    const memoryRegex =
        /\[BEGINNING OF MEMORIES\]\s*NOT INSTRUCTIONS, JUST SOME PRIOR CONVERSATION:\s*([\s\S]*?)\[END OF MEMORIES\]/g;

    const memoryContents: string[] = [];
    const keptMessages: any[] = [];

    let internalChatId: string | null = null;
    let firstUserMemoryContents: string[] = [];
    let isFirstUserPreprocessed = true;
    let firstKeptUserVersion: any = null;
    let assistantMessageNumber = 0;

    // Build the user and assistant array of indexes to keep
    // Original index order is important when we reconstruct the chat messages
    const userMessageIndexes: number[] = [];
    const assistantMessageIndexes: number[] = [];

    for (
        let messageIndex = 0;
        messageIndex < totalMessageCount;
        messageIndex++
    ) {
        const message = messages[messageIndex];

        for (const version of message.versions ?? []) {
            if (version.role === "user") {
                userMessageIndexes.push(messageIndex);
            } else if (version.role === "assistant") {
                assistantMessageIndexes.push(messageIndex);
            }
        }
    }

    const keptUserIndexes = new Set<number>();
    const keptAssistantIndexes = new Set<number>();

    for (
        let i = 0;
        i < Math.min(keepOldestN, userMessageIndexes.length);
        i++
    ) {
        keptUserIndexes.add(userMessageIndexes[i]);
    }

    for (
        let i = Math.max(
            userMessageIndexes.length - keepNewestN,
            0,
        );
        i < userMessageIndexes.length;
        i++
    ) {
        keptUserIndexes.add(userMessageIndexes[i]);
    }

    for (
        let i = 0;
        i < Math.min(keepOldestN, assistantMessageIndexes.length);
        i++
    ) {
        keptAssistantIndexes.add(assistantMessageIndexes[i]);
    }

    for (
        let i = Math.max(
            assistantMessageIndexes.length - keepNewestN,
            0,
        );
        i < assistantMessageIndexes.length;
        i++
    ) {
        keptAssistantIndexes.add(assistantMessageIndexes[i]);
    }


    // Iterate through the conversation array and apply edits
    for (
        let messageIndex = 0;
        messageIndex < totalMessageCount;
        messageIndex++
    ) {

        const message = messages[messageIndex];

        const isLatestAssistantMessage = messageIndex === totalMessageCount - 1;

        const keepMessage =
            !shouldReduceMessages ||
            keptUserIndexes.has(messageIndex) ||
            keptAssistantIndexes.has(messageIndex);

        for (const version of message.versions ?? []) {

            // --------------------------------------------------
            // USER
            // --------------------------------------------------
            if (
                version.role === "user" &&
                keepMessage &&
                firstKeptUserVersion === null
            ) {
                firstKeptUserVersion = version;
            }

            if (
                version.role === "user" &&
                version.preprocessed
            ) {
                const text = getPreprocessedText(version.preprocessed);

                // Collect memory blocks.
                let memoryMatch: RegExpExecArray | null;

                while (
                    (memoryMatch = memoryRegex.exec(text)) !== null
                ) {
                    const memoryContent = memoryMatch[1].trim();

                    if (!memoryContent) {
                        continue;
                    }

                    if (isFirstUserPreprocessed) {

                        firstUserMemoryContents.push(memoryContent);

                    } else {

                        memoryContents.push(memoryContent);
                    }
                }

                // Find the unique InternalChatID, remember it to transfer it
                // to the first user message prepreprocessed
                if (internalChatId === null) {

                    const internalChatIdMatch = text.match(/\[ICID:\s*(\d+)\]/);

                    if (internalChatIdMatch) {

                        internalChatId = internalChatIdMatch[1];
                    }
                }

                // Remember the first retained user's preprocessed object.
                // Preprocessed will always exist on user's first message.
                // Required to store meta data. First user's message will
                // never be an option to remove enforced by config option.
                if (
                    keepMessage &&
                    firstKeptUserVersion === null
                ) {
                    firstKeptUserVersion = version;
                }

                isFirstUserPreprocessed = false;
            }

            // --------------------------------------------------
            // ASSISTANT
            // --------------------------------------------------
            if (
                version.role === "assistant" &&
                Array.isArray(version.steps)
            ) {

                // Preserves thinking for the latest user message and if
                // Keep all thinking is enabled
                if(keepAllThinking === false &&
                    !isLatestAssistantMessage
                ) {
                    // Remove thinking steps.
                    version.steps = version.steps.filter(
                        (step: any) =>
                            step?.style?.type !== "thinking",
                    );
                }

                // Blank Jinja templates.
                if (cleanupThinkingOnly === false) {
                    for (const step of version.steps) {

                        cleanUpAssistantFields(
                            step?.genInfo
                                ?.loadModelConfig
                                ?.fields,
                        );

                        cleanUpAssistantFields(
                            step?.genInfo
                                ?.predictionConfig
                                ?.fields,
                        );
                    }
                }
            }
        }

        // Keep or discard the entire message object.
        if (keepMessage) {

            const assistantVersion = message.versions?.find(
                (version: any) =>
                    version.role === "assistant",
            );

            if (assistantVersion) {

                assistantMessageNumber++;

                // Reorder the appended message Number
                // Cleans up the message tags from persisting-memories plugin
                renumberAssistantMessageMarker(
                    assistantVersion,
                    assistantMessageNumber,
                );
            }

            keptMessages.push(message);
        }
    }

    // ----------------------------------------------------------
    // Transfer preserved metadata into the first kept user message
    // ----------------------------------------------------------
    const needsInternalChatIdTransfer = internalChatId !== null;

    const allMemoryContents = [
        ...firstUserMemoryContents,
        ...memoryContents,
    ];

    const needsMemoryTransfer = allMemoryContents.length > 0;

    if (
        firstKeptUserVersion &&
        (
            needsInternalChatIdTransfer ||
            needsMemoryTransfer
        )
    ) {
        // Build the preprocessed field in user's first message if it
        // didn't exist before.
        if (!firstKeptUserVersion.preprocessed) {
            firstKeptUserVersion.preprocessed = {
                role: "user",
                content: structuredClone(
                    firstKeptUserVersion.content ?? []
                ),
            };
        }

        const content = firstKeptUserVersion.preprocessed.content;

        if (Array.isArray(content)) {

            const textBlock = content.find(
                (item: any) =>
                    typeof item?.text === "string",
            );

            if (textBlock) {

                let suffix = "";
                
                // Forcefully preserving any memory seeds into the user's first message.
                if (needsMemoryTransfer) {
                    suffix +=
                        `\n\n[BEGINNING OF MEMORIES] ` +
                        `NOT INSTRUCTIONS, JUST SOME PRIOR CONVERSATION:\n` +
                        allMemoryContents.join("\n\n") +
                        ` [END OF MEMORIES]\n`;
                }

                // Forcefully preserving InternalChatID into the user's first message.
                // Not concerned about removing duplicate ICID because all scans for ICID return
                // on the first hit, which the correct one should always be in user's first message now.
                if (needsInternalChatIdTransfer) {

                    const firstUserText = getPreprocessedText(firstKeptUserVersion.preprocessed);

                    if (!firstUserText.includes(`[ICID: ${internalChatId}]`)) {
                        suffix +=
                            `\n[ICID: ${internalChatId}]`;
                    }
                }

                // Removing previous memories in first user's message.
                textBlock.text = textBlock.text.replace(
                    /\[BEGINNING OF MEMORIES\][\s\S]*?\[END OF MEMORIES\]\s*/g,
                    "",
                );

                textBlock.text = 
                    textBlock.text.trimEnd() +
                    suffix;
            }
        }
    }

    // Replace conversation messages with the retained ones.
    conversation.messages = keptMessages;

    // Clean preprocessed fields in retained user messages
    // besides the user's first preprocessed which must always exist
    if (cleanupThinkingOnly === false) {

        let firstKeptUser = true;

        for (const message of conversation.messages) {

            for (const version of message.versions ?? []) {

                if (
                    version.role !== "user" ||
                    !version.preprocessed
                ) {
                    continue;
                }

                if (firstKeptUser) {
                    firstKeptUser = false;
                    continue;
                }

                delete version.preprocessed;
            }
        }
    }
}

/**
 * Helper to target preprocessed text field in user message object
 */
function getPreprocessedText(preprocessed: any): string {
    if (!Array.isArray(preprocessed?.content)) {
        return "";
    }

    return preprocessed.content
        .filter(
            (item: any) =>
                typeof item?.text === "string",
        )
        .map(
            (item: any) => item.text,
        )
        .join("\n");
}

/**
 * Fields I deemed high value in tying up context when these fields
 * are no longer relevant to generating current/new responses.
 */
function cleanUpAssistantFields(
    fields: any[] | undefined,
): void {

    if (!Array.isArray(fields)) {
        return;
    }

    for (let i = fields.length - 1; i >= 0; i--) {

        const field = fields[i];

        // Remove past prediction tools.
        if (
            field?.key ===
            "llm.prediction.tools"
        ) {
            fields.splice(i, 1);
            continue;
        }

        // Blank past prediction system prompt.
        if (
            field?.key ===
            "llm.prediction.systemPrompt"
        ) {
            field.value = "";
            continue;
        }

        // Blank past Jinja template.
        if (
            field?.value?.type === "jinja" &&
            field?.value?.jinjaPromptTemplate
        ) {
            field.value
                .jinjaPromptTemplate
                .template = "";
        }
    }
}

/**
 * Used to renumber message # tags from my persisting-memories plugin.
 * otherwise you get things like message 1,2,5,6. And the persisting-memory tool
 * required the user to say save memory message 3 to target the message that was original 5.
 * Just visual cleanup for clientside use.
 */
function renumberAssistantMessageMarker(
    version: any,
    messageNumber: number,
): void {

    if (!Array.isArray(version.steps)) {
        return;
    }

    for (const step of version.steps) {

        if (!Array.isArray(step?.content)) {
            continue;
        }

        for (const content of step.content) {

            if (typeof content?.text !== "string") {
                continue;
            }

            content.text = content.text.replace(
                /\*\*\*message\s+\d+\*\*\*/gi,
                `***message ${messageNumber}***`,
            );
        }
    }
}

async function waitToConsumePMReadyFile(
    conversationFile: string,
    shouldCoordinateWithPersistingMemories: boolean,
): Promise<void>{
    const POLL_INTERVAL_MS = 100;
    const READY_FILE_STALE_AFTER_MS = 500;
    // const READY_FILE_WAIT_MAX_MS = 20_000;

    const readyFile = `${conversationFile}.persisting-memories-final-write.ready`;

    const lockFile = `${conversationFile}.lock`;

    if (shouldCoordinateWithPersistingMemories) {
        
        // const readyWaitStartedAt = Date.now();

        while (true) {
            // Stop waiting if max check time reached.
            // For situations where P-Memories failed at it's step to create a ready file.
            // if (Date.now() - readyWaitStartedAt >= READY_FILE_WAIT_MAX_MS) {
            //     throw new Error(
            //         `Timed out waiting for PM ready file: ${readyFile}`,
            //     );
            // }

            // Remove a stale P-Memories ready file. In no realistic sense should it take
            // more than 20ms for P-Memories to be ready, 1 second is generous.
            try {
                const stats = await stat(readyFile);
                const readyFileAge = Date.now() - stats.mtimeMs;

                if (readyFileAge >= READY_FILE_STALE_AFTER_MS) {
                    await unlinkReadyFile(readyFile);

                    // console.log(
                    //     "===== stale PM ready file removed by CC =====",
                    //     readyFile,
                    //     "age",
                    //     readyFileAge,
                    // );

                    continue;
                }

                // PM's current ready file exists.
                break;
            
            // Polling to recheck if P-Memories ready file to exist
            } catch (error) {
                const fsError = error as NodeJS.ErrnoException;

                if (fsError.code !== "ENOENT") {
                    throw error;
                }

                await new Promise<void>((resolve) =>
                    setTimeout(resolve, POLL_INTERVAL_MS),
                );
            }
        }

        // PM has completed its work.
        // Now CC can begin it's work after consuming a fresh ready file
        await unlinkReadyFile(readyFile);

        // console.log(
        //     "===== PM ready file removed by CC =====",
        //     readyFile,
        //     Date.now()
        // );

        // PM should now be progressing through its lock/work cycle.
        // Wait for its lock to disappear before CC acquires it.
        // Was the original intention before I made PM-E remove it's lock before even producing the ready file.
        // This is now just here for some future use maybe.
        while (true) {
            try {
                await stat(lockFile);
            } catch (error) {
                const fsError = error as NodeJS.ErrnoException;

                if (fsError.code === "ENOENT") {
                    break;
                }

                throw error;
            }

            await new Promise<void>((resolve) =>
                setTimeout(resolve, POLL_INTERVAL_MS),
            );
        }
    }
}

/**
 * Unlinks the ready file with error handling.
 * Personal tests show it wasn't really needed but I just wanted to keep it.
 */
async function unlinkReadyFile(readyFile: string): Promise<void> {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 50;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            await unlink(readyFile);
            return;
        } catch (error) {
            const fsError = error as NodeJS.ErrnoException;

            // Another consumer already removed it.
            if (fsError.code === "ENOENT") return;

            // Retry transient Windows filesystem errors.
            if (fsError.code !== "EPERM" || attempt === MAX_ATTEMPTS - 1) {
                throw error;
            }

            await new Promise<void>((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
            );
        }
    }
}

/**
 * Retries only reading a file X number of times.
 * Sometimes a file may be currently being written by the assistant and we get malformed json.
 */
export async function readFileWithRetries(
    filePath: string,
    maxAttempts: number,
    retryDelay: number,
): Promise<string> {
    let attempts = 0;

    while (true) {
        try {
            return await readFile(filePath, "utf-8");
        } catch (error) {
            attempts++;

            if (attempts >= maxAttempts) {
                console.error("readFileWithRetries error during read of:", filePath);
            }

            await new Promise(resolve =>
                setTimeout(resolve, retryDelay),
            );
        }
    }
}

/**
 * Can configure to throw and error to stop the function or return silently
 * Will only catch syntax errors like json cannot be parsed or read because of white spaces or a malformed json
 * Returns null upon failure
 * Errors besides syntax errors will exit immediately without retries
 */
export async function readConversationWithParseRetries(
    conversationFilePath: string,
    maxParseAttempts: number,
    retryDelay: number,
    onParseFailure: "return" | "throw" = "throw",
): Promise<any | null> {
    let parseAttempts = 0;

    while (true) {
        try {
            const latestJson = await readFile(
                conversationFilePath,
                "utf-8",
            );

            return JSON.parse(latestJson);
        } catch (error) {
            if (!(error instanceof SyntaxError)) {
                throw error;
            }

            parseAttempts++;

            if (parseAttempts >= maxParseAttempts) {
                if (onParseFailure === "return") {
                    return null;
                }

                throw error;
            }

            await new Promise(resolve =>
                setTimeout(resolve, retryDelay),
            );
        }
    }
}

/**
 * Allows return to main prompt preprocessor function without throwing
 * Performs one full directory scan to try and recover this attempt for a unknown CFN
 * Returns null upon max attempt failures
 */
export async function readConversationWithRecovery(
    conversationDirectory: string,
    conversationFileName2: string,
    userText: string,
): Promise<any | null> {

    const readConversation = async (fileName: string) => {
        const filePath = join(conversationDirectory, fileName);

        return readConversationWithParseRetries(
            filePath,
            3,
            100,
            "throw",
        );
    };

    try {
        return await readConversation(conversationFileName2);
    } catch (error) {
        const fsError = error as NodeJS.ErrnoException;

        if (
            fsError.code !== "EISDIR" &&
            !(error instanceof SyntaxError)
        ) {
            console.error("Failed to read conversation file:", error);
            return null;
        }

        console.warn(
            "Original conversation read failed; attempting full-directory recovery:",
            error,
        );
    }

    return new Promise((resolve) => {
        setTimeout(async () => {
            try {
                await scanForConversationFileThruFullConversationDirectoryScan(
                    userText,
                );

                const recoveredFileName = getConversationFileName();

                if (!recoveredFileName?.trim()) {
                    console.error(
                        "Unable to recover conversation file: filename is empty.",
                    );
                    resolve(null);
                    return;
                }

                resolve(await readConversation(recoveredFileName));
            } catch (error) {
                console.error(
                    "Failed to recover or read conversation file:",
                    error,
                );
                resolve(null);
            }
        }, 200);
    });
}

/**
 * All the MECs enter here and wait for the userInput to stabailize, meaning that they should not be currently
 * typing a new message to the assistant which destabalizes the conversation file.
 * The MEC who is last is the poller while all the previous MECs go to sleep to wait for a green light from the
 * last MEC. Afterwards they all wake up and the main function will allow them to pass through and clear in the correct order.
 */
async function waitForStableClientInput(
    conversationFile: string,
    stabilityPollInterval: number,
    requiredStableDuration: number,
    coordinatorName: string,
): Promise<boolean> {
    let previousClientInput: string | undefined;
    let stableSince: number | null = null;

    while (true) {
        if (stabalized) {
            // console.log(
            //     `[MEC ${coordinatorName}] Shared stability flag is TRUE`,
            // );
            return true;
        }

        const stateChangePromise = mecStateChanged;

        const finalCoordinatorName =
            multiEditCoordinatorWriteQueue[
                multiEditCoordinatorWriteQueue.length - 1
            ];

        // Only the last MEC polls the conversation file.
        // All other MECs wait for the shared stability flag.
        if (coordinatorName !== finalCoordinatorName) {
            // Sleep until the queue changes or stability is declared.
            // console.log(`[MEC ${coordinatorName}] Went to sleep`)
            await stateChangePromise;
            continue;
        }

        let stabilityConversation: { clientInput?: string };

        try {
            const stabilityJson = await readFile(
                conversationFile,
                "utf-8",
            );

            stabilityConversation = JSON.parse(stabilityJson);
        } catch (error) {
            if (error instanceof SyntaxError) {
                await new Promise<void>(resolve =>
                    setTimeout(resolve, stabilityPollInterval),
                );
                continue;
            }

            return false;
        }

        if (stabalized) {
            return true;
        }

        const currentClientInput = stabilityConversation.clientInput;
        const now = Date.now();

        if (stableSince === null) {
            previousClientInput = currentClientInput;
            stableSince = now;
        } else if (currentClientInput !== previousClientInput) {
            previousClientInput = currentClientInput;
            stableSince = now;
        }

        const inputIsStable =
            now - stableSince >= requiredStableDuration;

        // console.log(`[MEC ${coordinatorName}] Stability check`, {
        //     stabalized,
        //     inputIsStable,
        //     finalCoordinatorName,
        //     stableDuration: now - stableSince,
        //     requiredStableDuration,
        // });

        if (inputIsStable) {
            // console.log(
            //     `[MEC ${coordinatorName}] Declaring stability`,
            // );
            stabalized = true;
            notifyMecStateChanged();
            return true;
        }

        await new Promise<void>(resolve =>
            setTimeout(resolve, stabilityPollInterval),
        );
    }
}

/**
 * Helper who updates the MEC queue's new state to the sleeping MECs
 */
function notifyMecStateChanged(): void {
    const resolve = resolveMecStateChange;

    // Create the next notification before waking current waiters.
    mecStateChanged = new Promise<void>((resolveNext) => {
        resolveMecStateChange = resolveNext;
    });

    resolve?.();
}

interface CompactionSnapshotParams {
    keepOldestN: number;
    keepNewestN: number;
    conversationName: string;
    autoCleanupThreshold: number;
}

interface CompactionSnapshot {
    params: CompactionSnapshotParams;
    messages: ChatMessage[];
}

/**
 * Provides the messages snapshot as-is for the 1% threshold before
 * the user set request. Persisting Memories Explicit will use this snapshot
 * to run through it's current functions.
 */
async function createACopyFileWithMessagesSnapshot(
    conversationFile: string,
    keepOldestN: number,
    keepNewestN: number,
    messages: ChatMessage[],
    conversationName: string,
    autoCleanupThreshold: number,
): Promise<void> {
    const shadowCopyFileName = conversationFile.replace(
        /\.json$/i,
        ".copy",
    );

    const STALE_AFTER_MS = 30_000;

    try {
        const stats = await stat(shadowCopyFileName);
        const fileAge = Date.now() - stats.mtimeMs;

        if (fileAge < STALE_AFTER_MS) {
            return;
        }

        // Existing file is stale; remove it.
        await unlink(shadowCopyFileName);
    } catch (error) {
        const fsError = error as NodeJS.ErrnoException;

        if (fsError.code !== "ENOENT") {
            throw error;
        }
    }

    // Create exclusively so an existing file is not overwritten.
    let handle;

    try {
        handle = await open(shadowCopyFileName, "wx");
    } catch (error) {
        const fsError = error as NodeJS.ErrnoException;

        if (fsError.code === "EEXIST") {
            return;
        }

        throw error;
    }

    try {
        const snapshot: CompactionSnapshot = {
            params: {
                keepOldestN,
                keepNewestN,
                conversationName: conversationName.trim(),
                autoCleanupThreshold,
            },
            messages,
        };

        await handle.writeFile(
            JSON.stringify(snapshot, null, 2),
            "utf8",
        );
        // console.log("CONTEXT CLEANUP WROTE COPY FILE");
    } finally {
        await handle.close();
    }
}

/**
 * Adds thte compaction warning before the message # appending if using PM-E
 * If not will add it before the debug object or as the last fallback anywhere at the end of
 * the last assistant's message.
 * This block is not part of context so will not be pulled in by message history.
 */
async function appendCompactionWarning(
    conversation: any,
    replacementText: string,
    targetAssistantMessageIndex: number,
): Promise<void> {

    // Find the target assistant message for this MEC instance
    const assistantMessage = conversation.messages[targetAssistantMessageIndex];

    if (!assistantMessage) {
        throw new Error("No assistant message found.");
    }

    // Get the currently selected version
    const assistantVersion =
        assistantMessage?.versions?.[
            assistantMessage.currentlySelected ?? 0
        ];

    if (!assistantVersion) {
        throw new Error("Assistant message has no versions.");
    }

    // Find the first message-number block, regardless of its number
    const messageNumberIndex = assistantVersion.steps.findIndex(
        (step: any) =>
            step.type === "contentBlock" &&
            step.content?.some(
                (contentBlock: any) =>
                    contentBlock.type === "text" &&
                    /^\n\n\*\*\*message \d+\*\*\*$/.test(
                        contentBlock.text,
                    ),
            ),
    );

    // Find debugInfoBlock
    const debugInfoIndex = assistantVersion.steps.findIndex(
        (step: any) => step.type === "debugInfoBlock",
    );

    // Avoid inserting the same replacement text more than once
    const replacementExists = assistantVersion.steps.some(
        (step: any) =>
            step.type === "contentBlock" &&
            step.content?.some(
                (contentBlock: any) =>
                    contentBlock.type === "text" &&
                    contentBlock.text === replacementText,
            ),
    );

    if (replacementExists) {
        return;
    }

    // Prefer inserting before the message-number block.
    // Otherwise, insert before debugInfoBlock.
    // If neither exists, append to the end.
    const insertIndex =
        messageNumberIndex !== -1
            ? messageNumberIndex
            : debugInfoIndex !== -1
                ? debugInfoIndex
                : assistantVersion.steps.length;

    // Create the replacement content block
    const markerBlock = {
        type: "contentBlock",
        stepIdentifier: String(Date.now()),
        content: [
            {
                type: "text",
                text: replacementText,
                fromDraftModel: false,
                tokensCount: 1,
                isStructural: false,
            },
        ],
        defaultShouldIncludeInContext: false,
        shouldIncludeInContext: false,
    };

    // Insert the replacement block
    assistantVersion.steps.splice(insertIndex, 0, markerBlock);
}

/**
 * Simple helper to target the lastest assistant message.
 */
function findLastAssistantMessageIndex(conversation: any): number {
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
        const message = conversation.messages[i];
        const selectedVersion =
            message.versions?.[message.currentlySelected ?? 0];

        if (selectedVersion?.role === "assistant") {
            return i;
        }
    }

    return -1;
}