import { startPollingToCleanupConversation } from "./cleanupConversation";
import { join, basename } from "node:path";
import path from "node:path";
import os from "os";

import {
    configSchematics,
    setLockFileOriginatesFromThisPlugin,
} from "./config";

import { 
    readFile, 
    writeFile, 
    access, 
    readdir, 
    stat, 
    unlink,
    open
} from "node:fs/promises";

import type {
    ChatMessage,
    PromptPreprocessorController,
} from "@lmstudio/sdk";

let conversationFileName = "";
let internalChatID = "";
const relationshipsLimit = 15;
const minimumToStartCleaning = 3;

/**
 * https://github.com/anh-vudinh
 * Main function that directs the flow of the plugin
*/

export async function promptPreprocessor(
    ctl: PromptPreprocessorController,
    userMessage: ChatMessage,
): Promise<string | ChatMessage> {

    // Establish directories
    const lmStudioRootDirectory = path.join(
        os.homedir(),
        ".lmstudio",
    );
    const workingDirectory = ctl.getWorkingDirectory();
    
    // Establish initial variable values
    const config = ctl.getPluginConfig(configSchematics);
    const history = await ctl.pullHistory();
    const messages = history.getMessagesArray();
    const userText = userMessage.getText();
    const contextCleanup = config.get("contextCleanup") as boolean;
    const cleanupCounter = await normalizeNumber(config.get("cleanupCounter") as number);
    const keepOldestN = await normalizeNumber(config.get("keepOldestN") as number);
    const keepNewestN = await normalizeNumber(config.get("keepNewestN") as number);
    const cleanupThinkingOnly = config.get("cleanupThinkingOnly") as boolean;
    const keepAllMessages = config.get("keepAllMessages") as boolean;
    const createBackup = config.get("createBackup") as boolean;
    const keepAllThinking = config.get("keepAllThinking") as boolean;
    let createNewInternalChatID = false;

    if (contextCleanup === true) {
        const userMessageCount = messages.filter(
            message => message.getRole() === "user"
        ).length + 1;

        const assistantMessageCount = messages.filter(
            message => message.getRole() === "user"
        ).length + 1;

        // Trigger every whole number
        if ((userMessageCount > 0 && 
            userMessageCount % cleanupCounter === 0 &&
            userMessageCount >= minimumToStartCleaning) ||
            keepAllMessages === true
        ) {
            // Repopulate InternalChatID if user purposely and manually deleted
            // user's message 1
            const foundHistoryChatID = await promptProcessorScanHistoryForID(messages);

            // ICID exist in history still
            if (foundHistoryChatID !== "") {
                internalChatID = foundHistoryChatID;
            }

            // ICID not in memory or history
            if (internalChatID === "" &&
                foundHistoryChatID === ""
            ) {
                // Try to recover ICID through the relationship file.
                // ICID will still be blank at this point
                internalChatID = await promptProcessorRecoverChatID(
                    lmStudioRootDirectory,
                    internalChatID,
                    normalizeJsonFileName(conversationFileName),
                    workingDirectory,
                    userText,
                );

                if (internalChatID !== "") {
                    createNewInternalChatID = true;
                }
            }

            // If we still do not know InternalChatID after the recovery
            // We must create a new one
            if (internalChatID === "") {
                internalChatID = Math.floor(Date.now() / 1000).toString();
                createNewInternalChatID = true;
            }

            // Use the pre-existing InternalChatID found
            // to find the matching conversation file
            // Skip if we already know the conversation file
            if (conversationFileName === "") {

                conversationFileName = await promptProcessorScanForConversationFile(
                    lmStudioRootDirectory,
                    userText,
                    workingDirectory
                );

                conversationFileName = normalizeJsonFileName(conversationFileName);
            }
        
            // Final cleanup
            // Fires off only with a known conversation file, requirement to access the correct file
            if (conversationFileName !== "") {

                void startPollingToCleanupConversation(
                    lmStudioRootDirectory, 
                    keepOldestN, 
                    keepNewestN, 
                    cleanupThinkingOnly, 
                    keepAllMessages,
                    createBackup,
                    keepAllThinking,
                    assistantMessageCount,
                    conversationFileName,
                )
                // console.log("======ran CC default cleanup branch", Date.now())
            }
        }
    }

    return createNewInternalChatID
        ? `${userText}.            [ICID: ${internalChatID}] Ignore this ICID tag. `
        : userText;
}

/**             ______________________________________           
 *             |                                      |
 *             | LMSTUDIO LOVES TO DISCONNECT PLUGINS |
 *             |______________________________________|
 * 
 * FLOW OF SCAN →  promptProcessorScanHistoryForID()       →       promptProcessorRecoverChatID()           →          (GENERATE BRAND NEW ICID?)        →       promptProcessorScanForConversationFile()
 *                             ↓                                                ↓                                                                                                    ↓
 *                    (ICID FOUND YES/NO)                        (ICID already in memory? YES/NO)                                                              scanForConversationFileThruRelationshipFile()         → (CHECK AGAINST in memory ICID and relationship ICIDs | FOUND CONVO FILE YES/NO) → (CHECK AGAINST WD Base Name in Relationship file | FOUND CONVO YES/NO)
 *                                                                              ↓                                                                                                    ↓
 *                                                      scanForConversationFileThruBaseNameOfWorkingDirectory()                                              scanForConversationFileThruBaseNameOfWorkingDirectory() → (CHECK IF WD Base is a convo file, access it to check for in memory ICID | FOUND CONVO YES/NO) → (Fuzzy match clientInput to userText | FOUND CONVO YES/NO)
 *                                                                              ↓                                                                                                    ↓
 *                                                         (CONFIRMED CONVO FILE && || FOUND ICID YES/NO)                                                 scanForConversationFileThruFullConversationDirectoryScan() → (CHECK ALL convo files Match in memory ICID | FOUND YES/NO) → (Fuzzy match clientInput to userText | FOUND CONVO YES/NO) → (AUTHORITY TO UPDATE stale relationships once in memory ICID and Convo are known but mismatched)
 *                                                                                                                                                                                   ↓
 *                                                                                                                                                                        refreshRelationshipFile()                  → (If convo is known, ICID in convo is missing, relationship has ICID and convo paired, repurpose abandoned ICID & renew relationship. Overwrite in memory internalChatID variable with renewed ICID. This is to overwrite the newly generated ICID logic). 
 *                                                                                                                                                                                   ↓
 *                                                                                                                                *** CONVERSATION FILE AND ICID SHOULD NOW BE KNOWN & LINKED OTHERWISE THE CONVERSATION DOES NOT EXIST ***
 */

/**
 * Try to recover InternalChatID tag if the users deleted it from chat.
 */
interface ChatSessionConversationRelationship {
    internalChatID: string;
    conversationFile: string;
}

/**
* Try and recover InternalChatID from in memory InternalChatID
* or using the fallback of the scanForConversationFileThruBaseNameOfWorkingDirectory() scan
* If either is impossible than there's no choice but to assign a new ICID
*/
async function promptProcessorRecoverChatID(
    rootDirectory: string,
    internalChatID: string,
    conversationFileName: string,
    workingDirectory: string,
    userText: string,
): Promise<string> {

    // If already available in memory, use it.
    if (internalChatID !== "") {
        return internalChatID;
    }

    // Construct the path to the conversation file
    const conversationDirectory = join(
        rootDirectory,
        "conversations",
    );

    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    // Cannot perform relationship lookup without a filename.
    if (conversationFileName === "") {
        
        // Attempt a reverse lookup first using the basename of working directory
        conversationFileName = await scanForConversationFileThruBaseNameOfWorkingDirectory(
            rootDirectory,
            workingDirectory,
            conversationDirectory,
            conversationFileName,
            userText,
        );
        
        // Conversation File Name still unknown, cannot resume with recovery
        if(conversationFileName === "") {
            return "";
        }
    }

    try {
        
        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        const relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        // Search from newest to oldest.
        // Grab the newest relationship that matches the coversation file name
        // There cannot be two conversations files with the same exact name in a folder
        // At worst we are repurposing an abandoned ICID rather than making a new one
        for (
            let i = relationships.length - 1;
            i >= 0;
            i--
        ) {

            const relationship = relationships[i];

            if (relationship.conversationFile === conversationFileName) {
                return relationship.internalChatID;
            }
        }

    } catch (error: any) {

        if (error instanceof SyntaxError) {

            console.error(
                `Relationship file JSON is corrupted: ${error.message}`,
            );

        } else if (error.code === "ENOENT") {

            console.error(
                "Relationship file not found.",
            );

        } else {

            console.error(
                `Relationship lookup failed: ${error}`,
            );
        }
    }

    return "";
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
* Scan conversation folder to link the real-time chat to
* it's associated conversation file. This enables the user to
* not have to manually make the link for the plugin.
* Trade off: more resources expended for great ease of use
* 1st scan is ideal, later scans are fallbacks, each has it's early ending.
* 1st scan: cheap - check the relationship file for an exisiting relationship.
* 2nd scan: cheap - check the basename of workingdirectory, which "usually" matches the conversation file name,
* reliability is uncertain but it's quick to see if the convo file is found and has the matching ICID
* 3rd scan: expensive - scan each conversation file starting from newest to oldest until
* we find the matching InternalChatID.
* 4th scan: during the 3rd scan also check if clientInput = userText of most recent prompt preproccesor
* Scan 3 and 4 are authoritative and will repair the association in relationshipfile if needed
* LM Studio likes to reuse file names like empty.conversation.json
*/
async function promptProcessorScanForConversationFile(
    rootDirectory: string,
    userText: string,
    workingDirectory: string,
): Promise<string> {
    
    let relationships: any[] = [];
    let foundConversationFileName = conversationFileName;

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
    if (existingRelationship) {

        foundConversationFileName = await scanForConversationFileThruRelationshipFile(
            existingRelationship,
            conversationDirectory,
            foundConversationFileName,
            relationships,
            relationshipFile,
        )

        if(foundConversationFileName !== "") {

            return foundConversationFileName
        }

    } else {
        // No relationships matched the current InternalChatID in memory.
        // The ICID may be newly generated and not yet established
        // I had a suspicion WD may be unreliable even though most times it matched. LM Studio does wierd things.
        // I saw an empty.conversation.json be paired with a WD of empty-asd0293jcoa01, which would obviously fail my check.
        // Removing the random letter/numbers is not acceptable for the match because who's to say LMS wont create empty-2038sadfjl32i at the same time.
        const directoryBaseNameFromWD = basename(workingDirectory);

        const conversationFileNameInScope = `${directoryBaseNameFromWD}.conversation.json`;

        const existingConversationRelationship = relationships.find(
            (relationship) =>
                relationship.conversationFile === conversationFileNameInScope,
        );

        if (existingConversationRelationship) {

            // This conversation file name already has a relationship,
            // update the InternalChatID in the relationship file.
            const relationshipData = {
                internalChatID,
                conversationFile: conversationFileNameInScope,
            };

            // Remove the old copy of this relationship.
            relationships = relationships.filter(
                (relationship) =>
                    relationship.conversationFile !== conversationFileNameInScope,
            );

            // Reinsert it at the bottom so the newest relationship
            // is always the last entry.
            relationships.push(relationshipData);

            // Keep only the newest relationships.
            if (relationships.length > relationshipsLimit) {
                relationships = relationships.slice(-relationshipsLimit);
            }

            await writeFile(
                relationshipFile,
                JSON.stringify(relationships, null, 2),
                "utf-8",
            );

            // Update InternalChatID outer scope variable with what we just wrote in
            internalChatID = relationshipData.internalChatID;
            conversationFileName = normalizeJsonFileName(conversationFileNameInScope);

            return conversationFileNameInScope;
        }
    }

    // 2nd SCAN:
    // STEP 3: Check if the basename of WD is a match for the conversation file.
    // Brand new ICID was generated, this will link that new ICID to the foundConvversationFileName
    if (foundConversationFileName === "") {

        foundConversationFileName = await scanForConversationFileThruBaseNameOfWorkingDirectory(
            rootDirectory,
            workingDirectory,
            conversationDirectory,
            foundConversationFileName,
            userText,
        )
    }

    // 3rd SCAN:
    // STEP 4: Scan each conversation file starting from the newest.
    // HIGHEST AUTHORITY FOUND THE CONVERSATION NAME AND OR INTERNALCHAT ID.
    // Has the authority to correct the relationship link
    if (foundConversationFileName === "") {

        foundConversationFileName = await scanForConversationFileThruFullConversationDirectoryScan(
            conversationDirectory,
            foundConversationFileName,
            userText,
        )
    }

    // FINAL STEP:
    // If we found a conversation file through STEP 3 or STEP 4,
    // create/update the relationship in ChatSessionConversationRelationship.json.
    if (foundConversationFileName !== "") {

        refreshRelationshipFile(
            relationships,
            rootDirectory,
            foundConversationFileName,
        );
    }

    // Set config state after scanning and relationship persistence.
    conversationFileName = normalizeJsonFileName(foundConversationFileName);

    return foundConversationFileName;
}

//-------------------------------
// Scanning options
//-------------------------------

/**
 * 1st Scan: Cheap look up in a small maintained 15 object(recent conversations) json
 */
async function scanForConversationFileThruRelationshipFile(
    existingRelationship: any,
    conversationDirectory: string,
    foundConversationFileName: string,
    relationships: any[],
    relationshipFile: string,
):Promise<string> {

    const conversationFileNameInScope = existingRelationship.conversationFile;

    const conversationFilePath = join(
        conversationDirectory,
        conversationFileNameInScope,
    );

    // Check if conversation file stated in the relationship object passed in still exist.
    // If it doesn't remove the entry in the relationship file.
    try {
        await access(conversationFilePath);

        // File exists
        foundConversationFileName = conversationFileNameInScope;

    } catch {
        // Conversation file no longer exists.
        // Remove abandoned relationship.
        relationships = relationships.filter(
            (relationship) =>
                relationship.internalChatID !== internalChatID,
        );

        // No lock because we're still within the lock of the caller function
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
            conversationFileName = normalizeJsonFileName(foundConversationFileName);
            return foundConversationFileName;
        }

        // Existing relationship is invalid.
        // Clear it and continue with the remaining scans.
        foundConversationFileName = "";
    }

    return foundConversationFileName;
}

/**
 * 2nd Scan: Guess work, uses LM Studio's working directory base name to hope it matches an actual conversation file
 * Proven to be unreliable I eventually seen with my testing that empty.conversation.json could be linked to something like empty-0918sd0f98uja working directory
 */
async function scanForConversationFileThruBaseNameOfWorkingDirectory(
    rootDirectory: string,
    workingDirectory: string,
    conversationDirectory: string,
    foundConversationFileName: string,
    userText: string,
):Promise<string> {

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

                const normalize = (s: string): string =>
                    (s ?? "")
                        .trim()
                        .replace(/\s+/g, " ");

                const clientInput = normalize(conversation.clientInput);
                const input = normalize(userText);

                if (
                    clientInput.length > 0 &&
                    input.startsWith(clientInput)
                ) {
                    foundConversationFileName = conversationFileName;
                }
                
                // we now know the conversationfilename
                // reverse lookup ICID if it already exist in relationship file.
                // This will help sync the in memory ICID to what we already have on file
                // and control if a brand new ICID is actually assigned.
                if (foundConversationFileName !== "") {

                    let relationships: any[] = [];

                    // Construct the path to the conversation file
                    const conversationDirectory = join(
                        rootDirectory,
                        "conversations"
                    );

                    const relationshipFile = join(
                        conversationDirectory,
                        "ChatSessionConversationRelationship.json",
                    );

                    try {
                        const relationshipJson = await readFile(
                            relationshipFile,
                            "utf-8",
                        );

                        relationships = JSON.parse(relationshipJson);

                    } catch {
                        // File doesn't exist yet, so we'll create it in a later step.
                    }

                    const existingRelationship = relationships.find(
                        (relationship) =>
                            relationship.conversationFile === foundConversationFileName,
                    );

                    if (existingRelationship) {
                        internalChatID = existingRelationship.internalChatID;
                    }
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

    return foundConversationFileName;
}

/**
* 3rd and 4th(nested) Scan: Literally looked through all the actual conversation files existing and made the match by spotting the ICID in memory/history
* or the clientInput is what was currently sent to the assistant.
* HIGHEST AUTHORITY IF WE'VE REACHED THIS SCAN FALLBACK AND GOT A MATCH
*/
async function scanForConversationFileThruFullConversationDirectoryScan(
    conversationDirectory: string,
    foundConversationFileName: string,
    userText: string,
):Promise<string> {

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

            const normalize = (s: string): string =>
                (s ?? "")
                    .trim()
                    .replace(/\s+/g, " ");

            const clientInput = normalize(conversation.clientInput);
            const input = normalize(userText);

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

    // Have an ICID in memory that matches the ICID found in this conversation file
    // Prior relationship scan did not catch this link or had a stale ICID -> conversationfile relationship
    // Replace the ICID in the relationshipfile to match what's in the current conversation
    if (
        internalChatID !== "" &&
        foundConversationFileName !== ""
    ) {
        const relationshipFile = join(
            conversationDirectory,
            "ChatSessionConversationRelationship.json",
        );

        const lockFile = `${relationshipFile}.lock`;

        try {
            await acquireLock(lockFile);

            const relationshipJson = await readFile(
                relationshipFile,
                "utf-8",
            );

            const relationships = JSON.parse(relationshipJson);

            const matchingRelationship = relationships.find(
                (relationship: any) =>
                    relationship.conversationFile ===
                    foundConversationFileName,
            );

            if (
                matchingRelationship &&
                matchingRelationship.internalChatID !== internalChatID
            ) {
                matchingRelationship.internalChatID = internalChatID;

                await writeFile(
                    relationshipFile,
                    JSON.stringify(relationships, null, 2),
                    "utf-8",
                );
            }

        } catch {
            // Ignore missing or malformed relationship files.
        } finally {
            releaseLock(lockFile);
        }
    }

    return foundConversationFileName;
}

/**
* Uses pre-exisiting relationships ICID if conversation file name is reused by LM Studio.
* Refreshes it's state by putting the re-established relationship as recent by moving it to the 
* bottom of the relationship file. Assigns repurposed ICID into memory.
*/
async function refreshRelationshipFile(
    relationships: any[],
    rootDirectory: string,
    conversationFileName: string,
): Promise<void> {
    
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

    const lockFile = `${relationshipFile}.lock`;

    // If this conversation file already has a relationship,
    // reuse its existing InternalChatID.
    const existingRelationship = relationships.find(
        (relationship) =>
            relationship.conversationFile === conversationFileName,
    );

    if (existingRelationship) {
        internalChatID = existingRelationship.internalChatID;
    }

    const relationshipData = {
        internalChatID,
        conversationFile: conversationFileName,
    };

    // Remove the old copy of this relationship.
    relationships = relationships.filter(
        (relationship) =>
            relationship.internalChatID !== internalChatID &&
            relationship.conversationFile !== conversationFileName,
    );

    // Reinsert it at the bottom so the newest relationship
    // is always the last entry.
    relationships.push(relationshipData);

    // Keep only the newest relationships.
    if (relationships.length > relationshipsLimit) {
        relationships = relationships.slice(-relationshipsLimit);
    }

    try{
        await acquireLock(lockFile);

        await writeFile(
            relationshipFile,
            JSON.stringify(relationships, null, 2),
            "utf-8",
        );
    } catch (error) {

    } finally {
        releaseLock(lockFile);
    }

    // Update InternalChatID outer scope variable with what we just wrote in
    internalChatID = relationshipData.internalChatID;
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

            if (entry.isFile()) {
                if ( entry.name === "ChatSessionConversationRelationship.json") {
                    continue;
                }

                if (
                    entry.name.endsWith(".lock") ||
                    entry.name.endsWith(".ready")
                ) {
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

/**
 * HELPERS
 */
async function normalizeNumber(
    number: number,
): Promise<number> {
    return Math.floor(number);
}

/**
 * just fixes the json file name, I've seen some unreliable things with LM Studio
 * Like a file named blah.conversation.json-temp-blahblah be pulled into memory
 * and during some instance of the lifecycle LM Studio changes or replaces the temp file with an actually correct one.
 */
export function normalizeJsonFileName(jsonFileName: string){

    return jsonFileName.replace(/(\.json).*$/, "$1");
}

/**
 * Three States for lock
 * Null = plugin has yet to create a lock file, abandoned file if lock detected
 * True = lock was successfully acquired by this plugin
 * False = there was another lock exisiting before this plugin could acquire it
 * This will help regulate the timings of multiple polling plugins.
 * Needed to play with my context cleanup plugin.
 * https://github.com/anh-vudinh/-anh-vudinh-LM-Studio_Plugin-Persisting-Memories-Explicit or the non-explicit(model dependent) version
 * 
 * MAKE SURE WHERE EVER YOU USE THIS ACQUIRELOCK FUNCTION YOU releaseLock() THE CORRESPONDING LOCKFILE CREATED
 * This acquirelock getter and checker cannot tolerate duplicate lockfiles originating from itself. It will error out to the saftey terminate timeout
 * There is tolerance for lock files with dupe names originating from other plugins and unique lockfile names.
 */
export async function acquireLock(
    lockFile: string
): Promise<void> {
    const LOCK_STALE_TIMEOUT_MS = 20_000;
    const LOCK_WAIT_TIMEOUT_MS = 25_000;
    const POLL_INTERVAL_MS = 100;

    const startedAt = Date.now();

    while (true) {

        // Failure to acquire lock condition
        if (Date.now() - startedAt >= LOCK_WAIT_TIMEOUT_MS) {
            throw new Error(
                `Timed out waiting for lock: ${lockFile}`,
            );
        }

        try {
            const handle = await open(lockFile, "wx");

            setLockFileOriginatesFromThisPlugin(lockFile, true);
            // console.log("=====lock created by CC=====", lockFile, "timestamp", Date.now());

            await handle.close();

            return;
        } catch (error) {
            const fsError = error as NodeJS.ErrnoException;

            if (fsError.code !== "EEXIST") {
                throw error;
            }

            setLockFileOriginatesFromThisPlugin(lockFile, false);
            // console.log("=====lock not FROM CC=====", lockFile);

            try {
                const stats = await stat(lockFile);
                const lockAge = Date.now() - stats.mtimeMs;

                // Stale lock condition
                if (lockAge >= LOCK_STALE_TIMEOUT_MS) {
                    await unlink(lockFile);
                    // console.log("=====OTHER PLUGIN LOCK REMOVED BY CC=====", lockFile, Date.now());
                    continue;
                }
            } catch (error) {
                const fsError = error as NodeJS.ErrnoException;

                if (fsError.code !== "ENOENT") {
                    throw error;
                }

                continue;
            }

            await new Promise<void>((resolve) =>
                setTimeout(resolve, POLL_INTERVAL_MS),
            );
        }
    }
}

export async function releaseLock(
    lockFile: string
): Promise<void>{
    try {
        await unlink(lockFile);
        // console.log("=====lock CC removed=====", lockFile, Date.now())
    } catch {
        // ignore
    } finally {
        setLockFileOriginatesFromThisPlugin(lockFile, null);
    }
}