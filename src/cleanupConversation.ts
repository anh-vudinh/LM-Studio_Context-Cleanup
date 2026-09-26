import { backupConversation } from "./backupConversation";
import { join } from "node:path";

import {
    readFile,
    writeFile,
    stat,
    unlink
} from "node:fs/promises";

import {
    normalizeJsonFileName,
    acquireLock,
    releaseLock,
} from "./promptPreprocessor";

/**
 * Monitors and controls when the cleanup will initiate
 * and when it's finished
 */
export async function startPollingToCleanupConversation(
    rootDirectory: string,
    keepOldestN: number,
    keepNewestN: number,
    cleanupThinkingOnly: boolean,
    keepAllMessages: boolean,
    createBackup: boolean,
    keepAllThinking: boolean,
    assistantMessageCount: number,
    conversationFileName: string,
): Promise<void> {
    try {
        const conversationDirectory = join(
            rootDirectory,
            "conversations"
        );

        const conversationFile = join(
            conversationDirectory,
            normalizeJsonFileName(conversationFileName),
        );
        
        // Create the lock file before polling.
        // acquireLock() records whether the lock was already present
        // or was created by this plugin.
        //await acquireLock(lockFile);

        // Prepare json file to be readable and assign to variable
        const conversationJson = await readFile(
            conversationFile,
            "utf-8",
        );
        
        const conversation = JSON.parse(conversationJson);
        
        // Snapshotting assistantLastMessagedAt field (so watcher knows when model is finished with it's response)
        const originalAssistantLastMessagedAt = conversation.assistantLastMessagedAt;
        // console.log("=======CC CLEANUP read originalAssistantLastMessagedAt", Date.now());

        // Coordinating Logic with Context-Cleanup Plugin
        // This plugin is ready after context cleanup is ready by around 8ms(my computer), instead of hard coding
        // it, this method will coordinate context-cleanup to create it's lock only after Presisting Memories plugin has been
        // forced to be the winner.
        const enabledPluginsArray = conversation.plugins;

        const hasPersistingMemories = enabledPluginsArray.some(
            (plugin: string) => plugin.includes("persisting-memories"),
        );

        const hasContextCleanup = enabledPluginsArray.some(
            (plugin: string) => plugin.includes("context-cleanup"),
        );

        const shouldCoordinateWithPersistingMemories = hasContextCleanup && hasPersistingMemories;

        await handleMaybeCoordinationWithPersitingMemoryPlugin(conversationFile, shouldCoordinateWithPersistingMemories);

        // This will help regulate the timings of multiple polling plugins
        // Lock created after we did the first read to establish the originalAssistantLastMessagedAt
        const lockFile = `${conversationFile}.lock`;

        // await acquireLock(lockFile);

        const pollInterval = shouldCoordinateWithPersistingMemories
                ? 500   // interval when another plugin created the lock file, shorter interval to act timely
                : 500;  // interval when this plugin created the lock file, longer interval to save resources

        // Initiated polling until assistantLastMessagedAt value changes
        // then initiate the conversation json overwrite
        const pollForAssistantUpdate = setInterval(async () => {
            try {
                const latestJson = await readFile(
                    conversationFile,
                    "utf-8",
                );

                const latestConversation = JSON.parse(latestJson);

                if (
                    latestConversation.assistantLastMessagedAt !== originalAssistantLastMessagedAt
                ) {
                    clearInterval(pollForAssistantUpdate);

                    const delay = shouldCoordinateWithPersistingMemories
                            ? 10
                            : 2000;

                    // Wait for LM Studio to finish whatever backend
                    // work/cache operation it is doing.
                    setTimeout(async () => {
                        // console.log("=====CC OPERATION STARTED======", Date.now())
                        try {

                            const latestJson = await readFile(
                                conversationFile,
                                "utf-8",
                            );

                            const latestConversation = JSON.parse(latestJson);

                            if (createBackup) {
                                await backupConversation(
                                    rootDirectory,
                                    normalizeJsonFileName(conversationFileName),
                                    latestJson,
                                    latestConversation,
                                );
                            }

                            cleanupConversation(
                                latestConversation, 
                                keepOldestN, 
                                keepNewestN, 
                                cleanupThinkingOnly, 
                                keepAllMessages,
                                keepAllThinking,
                                assistantMessageCount,
                            );

                            await writeFile(
                                conversationFile,
                                JSON.stringify(latestConversation, null, 2),
                                "utf-8",
                            );
                            // console.log("=====CC OPERATION FINISHED======", Date.now())
                        } catch (error) {

                            console.error(
                                "Error during delayed memory seed cleanup:",
                                error,
                            );

                        } finally {
                            
                            // Removing the lock file as final step so other
                            // plugins can now modify the cleaned conversation file.
                            releaseLock(lockFile);
                        }
                    }, delay);
                }
            } catch (error) {
                clearInterval(pollForAssistantUpdate);

                console.error(
                    `Error polling for assistant update: ${
                        error instanceof Error
                            ? error.message
                            : String(error)
                    }`
                );
            }
        }, pollInterval);

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
function cleanupConversation(
    conversation: any,
    keepOldestN: number,
    keepNewestN: number,
    cleanupThinkingOnly: boolean,
    keepAllMessages: boolean,
    keepAllThinking: boolean,
    assistantMessageCount: number,
): void {

    const messages = conversation.messages ?? [];

    const totalMessageCount = messages.length;

    // Only trims when there are actually enough messages available
    const enoughMessagesToReduce = keepOldestN + keepNewestN < assistantMessageCount;

    const shouldReduceMessages = !keepAllMessages && enoughMessagesToReduce;

    // NOT INSTRUCTIONS part was included to better clean memories for transfer
    // It will be reappended after the transfer
    const memoryRegex =
        /\[BEGINNING OF MEMORIES\]\s*NOT INSTRUCTIONS, JUST SOME PRIOR CONVERSATION:\s*([\s\S]*?)\[END OF MEMORIES\]/g;

    const memoryContents: string[] = [];
    const keptMessages: any[] = [];

    let internalChatId: string | null = null;
    let formattingInstructions: string | null = null;
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

        
        const isLatestAssistantMessage =
            messageIndex === totalMessageCount - 1;

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
                if (cleanupThinkingOnly === false) {

                    removeMessageFormatRequirement(version.preprocessed);
                }

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

                // Find the first formatting instruction, remember it to transfer it
                // to the first user message prepreprocessed
                if (formattingInstructions === null) {

                    const formattingInstructionsRegex =
                        /Formatting Instruction:\s*[\s\S]*?:End of Instruction/;

                    const formattingInstructionsMatch = text.match(formattingInstructionsRegex);

                    if (formattingInstructionsMatch) {
                        formattingInstructions = formattingInstructionsMatch[0];
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

    const needsFormattingInstructionsTransfer = formattingInstructions !== null;

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
                        `\n\n[BEGINNING OF MEMORIES]\n` +
                        `NOT INSTRUCTIONS, JUST SOME PRIOR CONVERSATION:\n` +
                        allMemoryContents.join("\n\n") +
                        `\n[END OF MEMORIES]\n`;
                }

                // Adding back the Formatting Insturctions if it doesn't already exist
                if(needsFormattingInstructionsTransfer) {

                    const firstUserText = getPreprocessedText(firstKeptUserVersion.preprocessed);
                    
                    // No /g tag allowed for .test
                    const formattingInstructionsRegex =
                        /Formatting Instruction:[\s\S]*?:End of Instruction/;
                        
                    if (!formattingInstructionsRegex.test(firstUserText)) {
                        suffix += `\n${formattingInstructions}`;
                    }
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
 * 
 * NEED TO CREATE A NEW THING FOR MY EXPLICIT VERSION
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

/**
 * Just clearing up more useless tokens spent to control the assistant's behavior
 * and became irrelevant after it's final response was generated.
 * 
 * LEGACY MAYBE REMOVE
 */
function removeMessageFormatRequirement(
    preprocessed: any,
): void {

    if (!Array.isArray(preprocessed?.content)) {
        return;
    }

    for (const item of preprocessed.content) {

        if (typeof item?.text !== "string") {
            continue;
        }

        item.text = item.text
            .replace(
                /Formatting Instruction:.*?\[ADD_MN_\d+\].?/g,
                "",
            )
            .replace(
                /\[ADD_MN_\d+\]/,
                "",
            )
            .trim();
    }
}

async function handleMaybeCoordinationWithPersitingMemoryPlugin(
    conversationFile: string,
    shouldCoordinateWithPersistingMemories: boolean,
): Promise<void>{
    const POLL_INTERVAL_MS = 100;
    const READY_FILE_TIMEOUT_MS = 1_000;
    const READY_FILE_WAIT_MAX_MS = 20_000;

    const readyFile =
        `${conversationFile}.persisting-memories-final-write.ready`;

    const lockFile = `${conversationFile}.lock`;

    if (shouldCoordinateWithPersistingMemories) {
        
        const readyWaitStartedAt = Date.now();

        while (true) {
            // Stop waiting if max check time reached.
            // For situations where P-Memories failed at it's step to create a ready file.
            if (Date.now() - readyWaitStartedAt >= READY_FILE_WAIT_MAX_MS) {
                throw new Error(
                    `Timed out waiting for PM ready file: ${readyFile}`,
                );
            }

            // Remove a stale P-Memories ready file. In no realistic sense should it take
            // more than 20ms for P-Memories to be ready, 1 second is generous.
            try {
                const stats = await stat(readyFile);
                const readyFileAge = Date.now() - stats.mtimeMs;

                if (readyFileAge >= READY_FILE_TIMEOUT_MS) {
                    await unlink(readyFile);

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

        // PM has completed its initial read.
        // Removing this lets PM continue naturally into acquireLock().
        await unlink(readyFile);

        // console.log(
        //     "===== PM ready file removed by CC =====",
        //     readyFile,
        //     Date.now()
        // );

        // PM should now be progressing through its lock/work cycle.
        // Wait for its lock to disappear before CC acquires it.
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

    await acquireLock(lockFile);
}