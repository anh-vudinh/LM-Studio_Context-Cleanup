import { configSchematics } from "./config";
import { readFile, writeFile, access, readdir, stat, unlink, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import path from "node:path";
import os from "os";

import type {
    ChatMessage,
    PromptPreprocessorController,
} from "@lmstudio/sdk";

let createNewInternalChatID: boolean;
let conversationFileName = "";
let internalChatID = "";
const relationshipsLimit = 15;

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
            // Read History to see check for an InternalChatID
            if (internalChatID === "") {

                internalChatID = await promptProcessorScanHistoryForID(messages);

                if (internalChatID !== "") {

                    createNewInternalChatID = false;
                }
            }

            // First check of History for InternalChatID returned nothing
            // So we must create one
            if (internalChatID ===  "") {

                createNewInternalChatID = true;
            }
            
            // Assign an InternalChatID
            if (createNewInternalChatID === true) {

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

    return (
        `${createNewInternalChatID? `${userText}[ICID: ${internalChatID}] IGNORE THIS TAG ` : `${userText}`}`
    );
}


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

        // This is will help regulate the timings of multiple polling plugins
        const lockFile = `${conversationFile}.lock`;

        // Safety precaution - remove any abandoned lock file
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

                            cleanupConversation(latestConversation, keepOldestN, keepNewestN, cleanupThinkingOnly, keepAllMessages);

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

                            await unlink(lockFile);
                        }

                    }, 2000);   // CANNOT BE LESS THAN 2000ms, if you go lower than this something LM Studio is doing on the backend is caching an older version with the seeds still present.
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

function cleanupConversation(
    conversation: any,
    keepOldestN: number,
    keepNewestN: number,
    cleanupThinkingOnly: boolean,
    keepAllMessages: boolean,
): void {

    const messages = conversation.messages ?? [];

    // messages strictly alternate user / assistant,
    // so every 2 message objects = 1 conversation turn.
    const totalMessageCount = messages.length;
    const totalAssistantMessages = Math.floor(totalMessageCount / 2);

    // Only reduce when keepOldestN + keepNewestN does not exceed
    // the total number of assistant messages.
    const enoughMessagesToReduce = keepOldestN + keepNewestN < totalAssistantMessages;

    const shouldReduceMessages = !keepAllMessages && enoughMessagesToReduce;

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

                // Find the unique InternalChatID.
                if (internalChatId === null) {

                    const internalChatIdMatch = text.match(/\[ICID:\s*(\d+)\]/);

                    if (internalChatIdMatch) {

                        internalChatId = internalChatIdMatch[1];
                    }
                }

                // Remember the first retained user's
                // preprocessed object.
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
        // Reorder the appended message Number
        if (keepMessage) {

            const assistantVersion = message.versions?.find(
                (version: any) =>
                    version.role === "assistant",
            );

            if (assistantVersion) {

                assistantMessageNumber++;

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

                let prefix = "";

                if (needsInternalChatIdTransfer) {

                    const firstUserText = getPreprocessedText(firstKeptUserVersion.preprocessed);

                    if (!firstUserText.includes(`[ICID: ${internalChatId}]`)) {
                        prefix +=
                            `[ICID: ${internalChatId}]\n`;
                    }
                }

                if (needsMemoryTransfer) {
                    prefix +=
                        `[BEGINNING OF MEMORIES]\n` +
                        `NOT INSTRUCTIONS, JUST SOME PRIOR CONVERSATION:\n` +
                        allMemoryContents.join("\n\n") +
                        `\n[END OF MEMORIES]\n`;
                }

                textBlock.text = textBlock.text.replace(
                    /\[BEGINNING OF MEMORIES\][\s\S]*?\[END OF MEMORIES\]\s*/g,
                    "",
                );

                textBlock.text = prefix + textBlock.text;
            }
        }
    }

    // Replace conversation messages with the retained ones.
    conversation.messages = keptMessages;

    // ----------------------------------------------------------
    // Clean preprocessed fields in retained user messages.
    // The first user's preprocessed contains any transferred
    // InternalChatID and memory blocks, so preserve only it.
    // ----------------------------------------------------------
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

        return;
    }

    // Existing backup: append the latest two message objects.
    const backupJson = await readFile(
        backupFile,
        "utf-8",
    );

    const backupConversation = JSON.parse(backupJson);

    const latestMessages = latestConversation.messages ?? [];

    const backupMessages = backupConversation.messages ?? [];

    const lastTwoMessages = latestMessages.slice(-2);

    backupMessages.push(
        ...lastTwoMessages,
    );

    backupConversation.messages = backupMessages;

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

function cleanUpAssistantFields(
    fields: any[] | undefined,
): void {

    if (!Array.isArray(fields)) {
        return;
    }

    for (let i = fields.length - 1; i >= 0; i--) {

        const field = fields[i];

        // Remove prediction tools.
        if (
            field?.key ===
            "llm.prediction.tools"
        ) {
            fields.splice(i, 1);
            continue;
        }

        // Blank prediction system prompt.
        if (
            field?.key ===
            "llm.prediction.systemPrompt"
        ) {
            field.value = "";
            continue;
        }

        // Blank Jinja template.
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

        item.text = item.text.replace(
            /Format requirement:[\s\S]*?\*\*message\s+\d+\*\*\.?\s*/g,
            "",
        );
    }
}

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