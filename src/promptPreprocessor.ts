import { configSchematics } from "./config";
import { 
    readFile, 
    writeFile, 
    access, 
    readdir, 
    stat, 
    unlink, 
    mkdir, 
    rename 
} from "node:fs/promises";
import { join, basename } from "node:path";
import path from "node:path";
import os from "os";

import type {
    ChatMessage,
    PromptPreprocessorController,
} from "@lmstudio/sdk";

let conversationFileName = "";
let internalChatID = "";
const relationshipsLimit = 15;
let validatedBackupConversation: any = null;

/**
 * https://github.com/anh-vudinh
 */

// Cleaning starts at 3, but because the way pullhistory() works
// it does not include the latest message, so if we're seeing 2
// user messages, it's actually already 3 exisiting
const minimumToStartCleaning = 2;

export async function promptPreprocessor(
    ctl: PromptPreprocessorController,
    userMessage: ChatMessage,
): Promise<string | ChatMessage> {

    // Establish directories
    const lmStudioRootDirectory = path.join(
        os.homedir(),
        ".lmstudio",
    );
    
    // Establish initial variable values
    const config = ctl.getPluginConfig(configSchematics);
    const history = await ctl.pullHistory();
    const messages = history.getMessagesArray();
    const userText = userMessage.getText();
    const workingDirectory = ctl.getWorkingDirectory();
    const contextCleanup = config.get("contextCleanup") as boolean;
    const cleanupCounter = await normalizeNumber(config.get("cleanupCounter") as number);
    const keepOldestN = await normalizeNumber(config.get("keepOldestN") as number);
    const keepNewestN = await normalizeNumber(config.get("keepNewestN") as number);
    const cleanupThinkingOnly = config.get("cleanupThinkingOnly") as boolean;
    const keepAllMessages = config.get("keepAllMessages") as boolean;
    const createBackup = config.get("createBackup") as boolean;
    let createNewInternalChatID = false;

    if (contextCleanup === true) {
        const userMessageCount = messages.filter(
            message => message.getRole() === "user"
        ).length;

        // Trigger every whole number
        if (userMessageCount > 0 && 
            userMessageCount % cleanupCounter === 0 &&
            userMessageCount >= minimumToStartCleaning &&
            (userMessageCount >= keepNewestN+keepOldestN || 
                keepAllMessages === true
            )
        ) {
            // Read History to check for an InternalChatID
            if (internalChatID === "") {

                internalChatID = await promptProcessorScanHistoryForID(messages);

            }

            // First check of History for InternalChatID returned nothing
            // Assign an InternalChatID
            if (internalChatID ===  "") {

                createNewInternalChatID = true;
                internalChatID = Date.now().toString();

            }
            
            // Use the pre-existing InternalChatID found
            // to find the matching conversation file
            if (conversationFileName === "") {

                conversationFileName = await promptProcessorScanForConversationFile(
                    lmStudioRootDirectory, 
                    internalChatID, 
                    userText, 
                    workingDirectory
                );
            }

            // Final cleanup
            // Fires off only with a known conversation file, requirement to access the correct file
            if (conversationFileName !== "") {

                await startPollingToCleanupConversation(
                    lmStudioRootDirectory, 
                    keepOldestN, 
                    keepNewestN, 
                    cleanupThinkingOnly, 
                    keepAllMessages,
                    createBackup
                );
            }
        }
    }

    return (
        `${createNewInternalChatID
            ? `${userText}[ICID: ${internalChatID}] . `
            : `${userText}`
        }`
    );
}

/**
 * Scans history for any exisiting ICID.
 * If used with my persisting-memory plugin, both plugins
 * have the ability to create an ICID if one doesn't already exist
 */
async function promptProcessorScanHistoryForID(
    messages: ChatMessage[],
): Promise<string> {

    let searchedInternalChatID = "";

    for (const message of messages) {
        if ((message as any).data.role !== "user") {
            continue;
        }

        for (const content of (message as any).data.content ?? []) {
            if (content.type !== "text" || !content.text) {
                continue;
            }

            const match = content.text.match(
                /\[ICID:\s*(\d+)\]/
            );

            if (match) {
                searchedInternalChatID = match[1];
                break;
            }
        }

        if (searchedInternalChatID !== "") {
            break;
        }
    }

    return searchedInternalChatID;
}

/**
 * Establishes the connection between the current chat session
 * and it's conversation file. Without a known conversation file
 * no cleanup functions will be usable.
 * 1st scan: read relationship in ChatSessionConversationRelationship.json
 * 2nd scan: check if working directory's suffix is the valid conversation file
 * 3rd scan: check each conversation file from newest to oldest until
 * there's a matching hit on matching ICID
 * 4th scan: during the 3rd scan also check if clientInput = userText of most recent prompt preproccesor
 */
async function promptProcessorScanForConversationFile(
    rootDirectory: string,
    internalChatID: string,
    userText: string,
    workingDirectory: string,
): Promise<string> {
    
    let relationships: any[] = [];
    let foundConversationFileName = "";

    // Construct the path to the conversation file
    const conversationDirectory = join(
        rootDirectory,
        "conversations"
    );

    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    // Read the relationship file
    try {
        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        relationships = JSON.parse(relationshipJson);

    } catch {
        // File doesn't exist yet, so we'll create it in a later step.
    }

    // We've already found or assigned an InternalChatID
    // Take the ICID check if there is an existing relationship
    // in the relationship json.
    const existingRelationship = relationships.find(
        (relationship) =>
            relationship.internalChatID === internalChatID,
    );

    // 1st SCAN:
    // STEP 1: If there is a current relationship, check if the
    // conversation file still exists. If the file does not exist,
    // remove the abandoned relationship.
    if (existingRelationship) {

        const conversationFileName = existingRelationship.conversationFile;

        const conversationFilePath = join(
            conversationDirectory,
            conversationFileName,
        );

        try {
            await access(conversationFilePath);

            // File exists
            foundConversationFileName = conversationFileName;

        } catch {
            // Conversation file no longer exists.
            // Remove abandoned relationship.
            relationships = relationships.filter(
                (relationship) =>
                    relationship.internalChatID !== internalChatID,
            );

            await writeFile(
                relationshipFile,
                JSON.stringify(relationships, null, 2),
                "utf-8",
            );
        }

        // STEP 2:
        // If the conversation file still exists, open it to confirm ICID.
        if (foundConversationFileName !== "") {

            const conversationContent = await readFile(
                conversationFilePath,
                "utf-8",
            );

            const internalChatIDPattern = new RegExp(
                `\\[ICID:\\s*${internalChatID}\\]`,
            );

            const icidMatches = internalChatIDPattern.test(conversationContent);

            // STEP 2.1:
            // Existing relationship is valid, so return immediately.
            if (icidMatches) {

                return foundConversationFileName;
            }

            // Existing relationship is invalid.
            // Clear it and continue with the remaining scans.
            foundConversationFileName = "";
        }
    }

    // 2nd SCAN:
    // STEP 3: Check if the basename of WD is a match for the conversation file.
    if (foundConversationFileName === "") {
        try {
            const directoryBaseNameFromWD = basename(workingDirectory);

            const conversationFileName = `${directoryBaseNameFromWD}.conversation.json`;

            const conversationFilePath = join(
                conversationDirectory,
                conversationFileName,
            );

            const conversationContent = await readFile(
                conversationFilePath,
                "utf-8",
            );

            const internalChatIDPattern = new RegExp(
                `\\[ICID:\\s*${internalChatID}\\]`,
            );

            // First check for the ICID.
            if (internalChatIDPattern.test(conversationContent)) {
                foundConversationFileName = conversationFileName;
            }

            // If ICID did not match, check clientInput.
            if (foundConversationFileName === "") {
                try {
                    const conversation = JSON.parse(conversationContent);

                    const clientInput = conversation.clientInput?.trim() ?? "";

                    const input = userText.trim();

                    if (
                        clientInput.length > 0 &&
                        input.startsWith(clientInput)
                    ) {
                        foundConversationFileName = conversationFileName;
                    }

                } catch {
                    // Ignore malformed conversation content
                    // and continue to the next scan.
                }
            }

        } catch (error: any) {

            if (error?.code !== "ENOENT") {
                console.error(error);
            }

            // Just move to next scan.
        }
    }

    // 3rd SCAN:
    // STEP 4: Scan each conversation file starting from the newest.
    if (foundConversationFileName === "") {

        const allConversationFiles = await findAllConversationFiles(conversationDirectory);

        const internalChatIDPattern = new RegExp(
            `\\[ICID:\\s*${internalChatID}\\]`,
        );

        for (const conversationFile of allConversationFiles) {

            const conversationContent = await readFile(
                conversationFile,
                "utf-8",
            );

            // First try to match the InternalChatID.
            if (internalChatIDPattern.test(conversationContent)) {
                foundConversationFileName = basename(conversationFile);

                break;
            }

            // 4th SCAN:
            // Fallback for brand-new conversations where the
            // InternalChatID has not yet been injected.
            try {
                const conversation = JSON.parse(conversationContent);

                const clientInput = conversation.clientInput?.trim() ?? "";

                const input = userText.trim();

                if (
                    clientInput.length > 0 &&
                    input.startsWith(clientInput)
                ) {
                    foundConversationFileName = basename(conversationFile);

                    break;
                }

            } catch {
                // Ignore malformed conversation files and continue scanning.
            }
        }
    }

    // FINAL STEP:
    // If we found a conversation file through STEP 3 or STEP 4,
    // create/update the relationship in ChatSessionConversationRelationship.json.
    if (foundConversationFileName !== "") {

        // Remove any existing relationship for this InternalChatID
        // before creating the new association.
        relationships = relationships.filter(
            (relationship) =>
                relationship.internalChatID !== internalChatID,
        );

        const relationshipData = {
            internalChatID,
            conversationFile: foundConversationFileName,
        };

        relationships.push(relationshipData);

        // Control the file size.
        // Keep only the newest Nth relationships.
        if (relationships.length > relationshipsLimit) {
            relationships = relationships.slice(-relationshipsLimit);
        }

        await writeFile(
            relationshipFile,
            JSON.stringify(relationships, null, 2),
            "utf-8",
        );
    }

    return foundConversationFileName;
}

/**
 * Monitors and controls when the cleanup will initiate
 * and when it's finished
 */
async function startPollingToCleanupConversation(
    rootDirectory: string,
    keepOldestN: number,
    keepNewestN: number,
    cleanupThinkingOnly: boolean,
    keepAllMessages: boolean,
    createBackup: boolean,
): Promise<void> {

    try {

        const conversationDirectory = join(
            rootDirectory,
            "conversations"
        );

        const conversationFile = join(
            conversationDirectory,
            conversationFileName,
        );

        // Prepare json file to be readable and assign to variable
        const conversationJson = await readFile(
            conversationFile,
            "utf-8",
        );
        
        const conversation = JSON.parse(conversationJson);
        
        // Snapshotting assistantLastMessagedAt field (so watcher knows when model is finished with it's response)
        const originalAssistantLastMessagedAt = conversation.assistantLastMessagedAt;

        // This will help regulate the timings of multiple polling plugins
        const lockFile = `${conversationFile}.lock`;

        // Safety precaution - remove any abandoned lock file before starting
        try {

            await unlink(lockFile);

        } catch (error: any) {

            if (error?.code !== "ENOENT") {
                console.error(`Context cleanup error while removing abandoned lockfile: ${error}`);
            }
        }

        // Create the lock file before polling. This lockfile exist to allow this plugin
        // to work alongside https://github.com/anh-vudinh/LM-Studio_Plugin-Persisting-Memories
        await writeFile(
            lockFile,
            "",
            "utf-8",
        );

        // Initiated polling until assistantLastMessagedAt value changes
        // then initiate the conversation json overwrite
        const pollForAssistantUpdate = setInterval(async () => {

            try {

                const latestJson = await readFile(
                    conversationFile,
                    "utf-8",
                );

                const latestConversation = JSON.parse(latestJson);

                if (latestConversation.assistantLastMessagedAt !== originalAssistantLastMessagedAt) {
                    clearInterval(pollForAssistantUpdate);
                
                    // Wait 2 seconds for LM Studio to finish
                    // whatever backend work/cache operation it is doing.
                    setTimeout(async () => {

                        try {

                            const latestJson = await readFile(
                                conversationFile,
                                "utf-8",
                            );

                            const latestConversation = JSON.parse(latestJson);

                            if (createBackup) {
                                await backupConversation(
                                    rootDirectory,
                                    conversationFileName,
                                    latestJson,
                                    latestConversation,
                                );
                            }

                            cleanupConversation(
                                latestConversation, 
                                keepOldestN, 
                                keepNewestN, 
                                cleanupThinkingOnly, 
                                keepAllMessages
                            );

                            await writeFile(
                                conversationFile,
                                JSON.stringify(latestConversation, null, 2),
                                "utf-8",
                            );
                        } catch (error) {

                            console.error(
                                "Error during delayed memory seed cleanup:",
                                error,
                            );
                        } finally {
                            
                            // Removing the lock file as final step so other plugins can now modify a cleaned conversation file
                            await unlink(lockFile);
                        }

                    }, 2000);   
                    // CANNOT BE LESS THAN 2000ms, if you go lower than this something LM Studio is doing on the backend is caching an older version with the seeds still present.
                }
            } catch (error) {
                clearInterval(pollForAssistantUpdate);

                console.error(`Error polling for assistant update: ${error}`);
            }

        }, 800);
    } catch (error) {
        
        console.error(`startPollingToCleanupConversation error: ${error instanceof Error ? error.message : String(error)}`);
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
): void {

    const messages = conversation.messages ?? [];

    // messages strictly alternate between user / assistant,
    // so every 2 message objects = 1 conversation turn.
    const totalMessageCount = messages.length;
    const totalAssistantMessages = Math.floor(totalMessageCount / 2);

    // Only trims when there are actually enough messages available
    const enoughMessagesToReduce = keepOldestN + keepNewestN < totalAssistantMessages;

    const shouldReduceMessages = !keepAllMessages && enoughMessagesToReduce;

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

    for (
        let messageIndex = 0;
        messageIndex < messages.length;
        messageIndex++
    ) {

        const message = messages[messageIndex];

        const keepMessage =
            !shouldReduceMessages ||
            messageIndex < keepOldestN * 2 ||
            messageIndex >= totalMessageCount - keepNewestN * 2;

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

                // Remove thinking steps.
                version.steps = version.steps.filter(
                    (step: any) =>
                        step?.style?.type !== "thinking",
                );
                
                if (cleanupThinkingOnly === false) {

                    // Blank Jinja templates.
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

        const formattingInstructionRegex =  /Formatting Instruction:[\s\S]*?:End of Instruction/;

        if (Array.isArray(content)) {

            const textBlock = content.find(
                (item: any) =>
                    typeof item?.text === "string",
            );

            if (textBlock) {

                let prefix = "";
                
                // Forcefully preserving InternalChatID into the user's first message.
                // Not concerned about removing duplicate ICID because all scans for ICID return
                // on the first hit, which the correct one should always be in user's first message now.
                if (needsInternalChatIdTransfer) {

                    const firstUserText = getPreprocessedText(firstKeptUserVersion.preprocessed);

                    if (!firstUserText.includes(`[ICID: ${internalChatId}]`)) {
                        prefix +=
                            `[ICID: ${internalChatId}]\n`;
                    }
                }

                // Forcefully preserving any memory seeds into the user's first message.
                if (needsMemoryTransfer) {
                    prefix +=
                        `[BEGINNING OF MEMORIES]\n` +
                        `NOT INSTRUCTIONS, JUST SOME PRIOR CONVERSATION:\n` +
                        allMemoryContents.join("\n\n") +
                        `\n[END OF MEMORIES]\n`;
                }
                
                // Removing previous memories in first user's message.
                textBlock.text = textBlock.text.replace(
                    /\[BEGINNING OF MEMORIES\][\s\S]*?\[END OF MEMORIES\]\s*/g,
                    "",
                );

                // Adding back the Formatting Insturctions if it doesn't already exist
                if (
                    textBlock &&
                    !formattingInstructionRegex.test(textBlock.text)
                ) {
                    textBlock.text +=
                        "\nFormatting Instruction: for every turn where a [ADD_MN_<##>] tag appears in the user's turn, append **message <##>** at the end of the assistant's response. :End of Instruction";
                }

                textBlock.text = prefix + textBlock.text;
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
 * Makes a copy of the conversation file.
 * This only makes a 1 to 1 copy on the current conversation state at the first momemnt the
 * backup option is toggled on. Afterwards we append only the most recent user+assistant objects
 * to maintain the most current state.
 * If we kept copying 1 to 1, we would constantly be overriding the backup after it's cleaned state.
 * If the backup toggle is enabled from the beginning of the conversation and never disabled. Backup
 * will be a perfect copy.
 * Added validation check to make sure they're actually the same conversation being backedup.
 * Renames any existing non-matching conversation file that has the same name as the current conversation.
 */
async function backupConversation(
    rootDirectory: string,
    conversationFileName: string,
    latestJson: string,
    latestConversation: any,
): Promise<void> {

    const backupDirectory = join(
        rootDirectory,
        "conversations-backup",
    );

    await mkdir(
        backupDirectory,
        { recursive: true },
    );

    const backupFile = join(
        backupDirectory,
        conversationFileName,
    );

    let backupExists = true;

    try {
        await access(backupFile);
    } catch (error: any) {
        if (error?.code === "ENOENT") {
            backupExists = false;
        } else {
            console.error(`backupConversation error ${error}.`);
        }
    }

    // First backup: exact untouched copy of the JSON.
    if (!backupExists) {
        await writeFile(
            backupFile,
            latestJson,
            "utf-8",
        );

        validatedBackupConversation =
            JSON.parse(latestJson);

        return;
    }

    let backupConversation: any;

    // Backup has not been loaded/validated into memory yet.
    if (validatedBackupConversation === null) {

        const backupJson = await readFile(
            backupFile,
            "utf-8",
        );

        backupConversation = JSON.parse(backupJson);

        const backupFirstUserText =
            backupConversation.messages?.[0]?.versions?.[0]?.content?.find(
                (item: any) => item?.type === "text",
            )?.text;

        const latestFirstUserText =
            latestConversation.messages?.[0]?.versions?.[0]?.content?.find(
                (item: any) => item?.type === "text",
            )?.text;

        const sameConversation =
            backupConversation.name === latestConversation.name &&
            backupFirstUserText === latestFirstUserText;

        if (!sameConversation) {
            const timestamp = Date.now();

            const timestampedBackupFile =
                backupFile.replace(
                    /\.json$/,
                    `(${timestamp}).json`,
                );

            await rename(
                backupFile,
                timestampedBackupFile,
            );

            await writeFile(
                backupFile,
                latestJson,
                "utf-8",
            );

            validatedBackupConversation =
                JSON.parse(latestJson);

            return;
        }

        // Existing backup belongs to the current conversation.
        validatedBackupConversation =
            backupConversation;

    } else {
        // Already validated and cached in memory.
        backupConversation =
            validatedBackupConversation;
    }

    // Append the latest two message objects.
    const latestMessages =
        latestConversation.messages ?? [];

    const backupMessages =
        backupConversation.messages ?? [];

    const lastTwoMessages =
        latestMessages.slice(-2);

    backupMessages.push(
        ...lastTwoMessages,
    );

    backupConversation.messages =
        backupMessages;

    await writeFile(
        backupFile,
        JSON.stringify(
            backupConversation,
            null,
            2,
        ),
        "utf-8",
    );
}

/**
 * HELPERS
 */
async function normalizeNumber(
    number: number,
): Promise<number> {
    return Math.floor(number);
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
                /\*\*message\s+\d+\*\*/gi,
                `**message ${messageNumber}**`,
            );
        }
    }
}

/**
 * Just clearing up more useless tokens spent to control the assistant's behavior
 * and became irrelevant after it's final response was generated.
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

/**
 * Helper for the full scanning of all conversation files to find the ICID
 */
async function findAllConversationFiles(
    conversationsDirectory: string,
): Promise<string[]> {

    const conversationFiles: string[] = [];

    async function searchDirectory(
        directory: string,
    ): Promise<void> {

        const entries = await readdir(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {

            const fullPath = join(
                directory,
                entry.name,
            );

            if (
                entry.isFile()
            ) {
                // exclude the relationship file
                if ( entry.name === "ChatSessionConversationRelationship.json") {
                    continue;
                }

                conversationFiles.push(fullPath);
                continue;
            }

            if (entry.isDirectory()) {
                await searchDirectory(fullPath);
            }
        }
    }
    
    await searchDirectory(conversationsDirectory);

    const filesWithModifiedTime = await Promise.all(
        conversationFiles.map(async (filePath) => {
            const fileStats = await stat(filePath);

            return {
                filePath,
                modifiedTime: fileStats.mtimeMs,
            };
        }),
    );

    filesWithModifiedTime.sort(
        (a, b) => b.modifiedTime - a.modifiedTime,
    );

    return filesWithModifiedTime.map(
        (file) => file.filePath,
    );
}