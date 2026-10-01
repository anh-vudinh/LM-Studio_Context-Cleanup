import type { ChatMessage, PromptPreprocessorController } from "@lmstudio/sdk";
import { saveMemoryCommandTracker } from "./saveMemoryCommandTracker";
import { startPollingToCleanupConversation } from "./cleanupConversation";
import { acquireLock, releaseLock } from "./acquireLockFile";
import { join, basename } from "node:path";
import path from "node:path";
import os from "os";

import {
    configSchematics,
    getConversationFileName,
    getInternalChatID,
    getSaveMemoryCategory,
    getSaveMemoryName,
    getSaveMemoryNumber,
    resetSaveMemoryParameters,
    setInternalChatID,
    setConversationFileName,
} from "./config";

import { 
    readFile,
    writeFile,
    readdir,
    stat,
} from "node:fs/promises";

const relationshipsLimit = 15;
const minimumToStartCleaning = 3;

/**
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

    saveMemoryCommandTracker(userText);

    const saveMemoryCommandIsInProgress = 
        getSaveMemoryNumber() !== null || 
        getSaveMemoryCategory() !== null || 
        getSaveMemoryName() !== null;
   
    if (contextCleanup === true && saveMemoryCommandIsInProgress === false) {
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

            if(getInternalChatID() !== "" && getConversationFileName() !== "") {
                // Check that the relationship exists in the relationship file.
                // If it does not, add it. This is the extreme case user is deleting relationships directly from the file and their load bearing user message
                // Two available options in the function, choose which one to enable. Each has it's pros or cons.
                const relationshipReadded = await maybeRepairRelationshipFileWithKnownICIDAndConversationFile(
                    lmStudioRootDirectory,
                )

                if(relationshipReadded) {
                    createNewInternalChatID = true;
                }
            }

            // ICID UNKNOWN?
            if (getInternalChatID() === "") {
                // SCAN HISTORY IF FOUND ASSIGN IT TO THE INTERNAL MEMORY
                const historyICID = await promptProcessorScanHistoryForID(messages);

                //------------------------------------
                // CONVERSATION FILE NAME KNOWN IN MEMORY BUT ICID UNKNOWN IN HISTORY (USER PROBABLY DELETED LOAD BEARING USER MESSAGE)
                //------------------------------------

                if(historyICID === "") {
                    // Recover ICID through the relationship file
                    const icidRecovered = await recoverICIDMultiStepMaybeSetConversationFileName(
                        lmStudioRootDirectory,
                        workingDirectory,
                        userText,
                    );

                    if (icidRecovered) {
                        createNewInternalChatID = true;
                    }
                }

                //------------------------------------
                // ICID UNKNOWN
                //------------------------------------

                // SCAN HISTORY FAILED
                if(getInternalChatID() === "") {
                    // SCAN IT THROUGH THE RELATIONSHIP FILE
                    // WE'VE ALSO SET THE CONVERSATION FILE NAME HERE IF WE FOUND IT ALONGSIDE 
                    // THE ICID WE MATCHED WHILE LOOKING THROUGH THE RELATIONSHIP FILE
                    await promptProcessorTryWorkingDirectoryBaseNameLookupInRelationshipFile(
                        lmStudioRootDirectory,
                        workingDirectory,
                    );
                }

                // ICID COULD NOT BE FOUND AT ALL SO CREATE A FRESH ICID
                if(getInternalChatID() === "") {
                    setInternalChatID(Math.floor(Date.now() / 1000).toString());
                    createNewInternalChatID = true;
                }
            }

            //------------------------------------
            // ICID NOW KNOWN
            //------------------------------------

            // CONVERSATION FILE NAME UKNOWN?
            if (getConversationFileName() === "") {
                
                // CHECK THE RELATIONSHIP FILE
                await promptProcessorMatchICIDInRelationshipFile(
                    lmStudioRootDirectory,
                );

                // CHECK THE WORKING DIRECTORY BASE NAME FILE
                // CHECK FOR A EMBEDDED ICID OR MATCHING CLIENTINPUT
                if (getConversationFileName() === "") {
                    await promptProcessorTryWorkingDirectoryConversationFile(
                        lmStudioRootDirectory,
                        workingDirectory,
                        userText,
                    );
                }
            }

            // CHECK THE FULL CONVERSATION DIRECTORY FROM NEWEST TO OLDEST
            // CONVERSATION FILES AND CHECK FOR EMBEDDED ICID OR MATCHING CLIENTINPUT
            if(
                getConversationFileName() === "" || 
                createNewInternalChatID === true
            ) {
                await scanForConversationFileThruFullConversationDirectoryScan(
                    lmStudioRootDirectory,
                    userText,
                );
            }

            //----------------------------------------------------
            // CONVERSATION FILE NAME NOW KNOWN && ICID NOW KNOWN
            //----------------------------------------------------

            // Final cleanup
            // Fires off only with a known conversation file, requirement to access the correct file
            if (getConversationFileName() !== "") {

                void startPollingToCleanupConversation(
                    lmStudioRootDirectory, 
                    keepOldestN, 
                    keepNewestN, 
                    cleanupThinkingOnly, 
                    keepAllMessages,
                    createBackup,
                    keepAllThinking,
                    assistantMessageCount,
                    getConversationFileName(),
                )
            }
        }
    }

    // We're resetting the state assuming the string has now saved, because the work flow is that
    // Persiting Memories has the lead in processing by the time we execute Context Cleanup Functions,
    // we will be able to cleanup messages on the upcoming turn.
    // This does not need to do anything specific with a save memory command, just know it exists/is happening.
    // So no need to distinguish the saveMemoryEndRangeNumber.
    const currentSaveMemoryNumber = getSaveMemoryNumber();
    const currentSaveMemoryCategory = getSaveMemoryCategory();
    const currentSaveMemoryName = getSaveMemoryName();

    const allRequiredFieldsKnown =
        currentSaveMemoryNumber !== null &&
        (currentSaveMemoryCategory !== null && currentSaveMemoryCategory !== "") &&
        (currentSaveMemoryName !== null && currentSaveMemoryName !== "");

    if(allRequiredFieldsKnown) {
        resetSaveMemoryParameters();
    }

    return createNewInternalChatID
        ? `${userText}.                          [ICID: ${getInternalChatID()}] Ignore this ICID tag. `
        : userText;
}


/**             ______________________________________           
 *             |                                      |
 *             | LMSTUDIO LOVES TO DISCONNECT PLUGINS |
 *             |______________________________________|
 * 
 * FLOW OF SCAN   →    maybeRepairRelationshipFileWithKnownICIDAndConversationFile()         →        promptProcessorScanHistoryForID()           →          recoverICIDMultiStepMaybeSetConversationFileName()              →        promptProcessorTryWorkingDirectoryBaseNameLookupInRelationshipFile()        →       (Generate New ICID)      →           promptProcessorMatchICIDInRelationshipFile()              →           promptProcessorTryWorkingDirectoryConversationFile()             →             scanForConversationFileThruFullConversationDirectoryScan()
 *                                                 ↓                                                                  ↓                                                               ↓                                                                                  ↓                                                                                                          ↓                                                                          ↓                                                                                 ↓
 *                             (ICID && CONVO FILE IN MEMORY? YES/NO)                                     (ICID in history? YES/NO)                             (CFN in Relationship File? YES/NO | GET ICID)                        (Quick lazy check if WD base name is already an existing relationship)                                                (ICID Matches in Relationship File? YES/NO | Get CFN)                    (ICID found in WD Conversation.json? YES/NO | set CFN)                 (Scan through New -> Old Conversation.json Spotted ICID? YES/NO | set CFN)
 *                                                 ↓                                                                  ↓                                                               ↓                                                                                  ↓                                                                                                                                                                                     ↓                                                                                 ↓
 *                  (WRITE missing Relationship | Add ICID to History | Skip all Scans)                     (Add ICID to Memory)                  (Working Directory Base Name in Relationship File? YES/NO | GET ICID)                                 (Reuse pre-existing ICID + set CFN)                                                                                                                                            (ClientInput matches userText? YES/NO | set CFN)                         (During Scan check ClientInput matches userText? YES/NO | set CFN)
 *                                                                                                                                                                                    ↓                                              ______________________________________________________________________                                                                                                                                                                                                                                      ↓
 *                                                                                                                                                  (Scan allConversation Files New -> Old, Found matching clientInput)                                                                                                                                                                                                                                                                                        (WRITE Both CFN and ICID to relationship file if not already present)
 *                                                                                                                                                (in conversation file match to relationship? YES/NO | GET ICID + SET CFN)  →  (Will reuse pre-existing ICID, BOTH ICID AND CFN KNOWN SKIP REMAINING SCANS)                                                                                                                                                                                                       (repair mismatch relationship if present in relationship file)
 *                                                                                                                                                                                    ↓                                                                                                                                                                                                                                                                                                                                                          
 *                                                                                                                                                          (ICID MUST BE KNOWN BY NOW, IF NOT. IT NEVER EXISTED)                                                                                                                                                                                                                                                                                                         
 *                                                                                                                                                                                                                                                                                                                     
 *                                                                                                                                                                                                                                                                                                                                               
 *                                                                                                                                                                                                                                                                                                                            
 */


/**
 * Try to recover InternalChatID tag if the users deleted it from chat.
 */
interface ChatSessionConversationRelationship {
    internalChatID: string;
    conversationFile: string;
}

//-------------------------------
// Scanning options
//-------------------------------

/**
 * Extraordinary case if the user purposely deletes both the relationship entry in the relationship file,
 * and the user's message holding the ICID. We will reinsert the entry using the in memory data.
 */
async function maybeRepairRelationshipFileWithKnownICIDAndConversationFile(
    rootDirectory: string,
): Promise<boolean> {

    const conversationDirectory = join(
        rootDirectory,
        "conversations"
    );

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    const conversationFileName = getConversationFileName();

    const internalChatID = getInternalChatID();

    const lockFile = `${relationshipFile}.lock`;

    const functionName = "maybeRepairRelationshipFileWithKnownICIDAndConversationFile";

    try{
        await acquireLock(lockFile, functionName);

        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        let relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        relationships = relationships.filter(
            (relationship) =>
                relationship.internalChatID.trim() !== "" &&
                relationship.conversationFile.trim() !== "",
        );

        const relationship = relationships.find(
            (relationship) => relationship.conversationFile === conversationFileName &&
                relationship.internalChatID === internalChatID
        );

        // The exact relationship we have in memory is missing from the relationship file. CHOOSE ONLY ONE OPTION!!
        // That can only mean the user deleted the load bearing user message and deleted the relationship manually

        //---------------------------
        // OPTION 1: REPAIR THE RELATIONSHIP FILE WITH IN MEMORY DATA 
        // (must create a lock file with it's inherent delay)
        //---------------------------
        if (!relationship) {
                
            relationships.push({
                internalChatID: internalChatID,
                conversationFile: conversationFileName,
            });

            // Keep only the newest relationships.
            if (relationships.length > relationshipsLimit) {
                relationships = relationships.slice(-relationshipsLimit);
            }

            await writeFile(
                relationshipFile,
                JSON.stringify(relationships, null, 2),
                "utf-8",
            );

            return true;
        }

        //---------------------------
        // OPTION 2: RESET THE IN MEMORY DATA SO WE CAN GO THROUGH THE NORMAL PROCESS OF CREATING A BRAND NEW LINK 
        // (no lock file needed, no delay, just a quick read of the relationship file)
        //---------------------------
        // if (!relationship) {
        //     setConversationFileName("");
        //     setInternalChatID("");
        // }

        // Relationship already exists in the file
        if(relationship) {
            return false;
        }

    } catch (error) {
        // move along
    } finally {
        await releaseLock(lockFile, functionName);
    }

    return false;
}

/**
 * Scans history for any exisiting ICID.
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

    // So it does not overwrite an ICID already known in memory, but none exist in history(user deleted it)
    if(searchedInternalChatID !== ""){
        setInternalChatID(searchedInternalChatID);
    }

    return searchedInternalChatID;
}

/**
 * ICID marker in history has been lost, we will try to recover the CFN first through various methods to
 * re-establish the past ICID used.
 * CFN already in memory → check it against the relationship file
 * CFN in memory missing → check WD base name against relationship file
 * WD Base Name fails check → check from newest to oldest conversation files to match clientInput to userText = match means we now know the true conversation file name
 * check for the pre-existing relationship in the relationship file and reuse it. Reinject the re-established ICID.
 */
async function recoverICIDMultiStepMaybeSetConversationFileName(
    rootDirectory: string,
    workingDirectory: string,
    userText: string,
): Promise<boolean>{

    const conversationFileName = getConversationFileName();
    
    const conversationDirectory = join(
        rootDirectory,
        "conversations"
    );

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    // Conversation File Name still available in memory
    if(conversationFileName !== "") {
        try{
            const relationshipJson = await readFile(
                relationshipFile,
                "utf-8",
            );

            const relationships: ChatSessionConversationRelationship[] =
                JSON.parse(relationshipJson);

            const relationship = relationships.find(
                (relationship) => relationship.conversationFile === conversationFileName
            );

            if(relationship) {
                setInternalChatID(relationship.internalChatID);
                return true;
            }

        } catch {
            // move along
        }
    }

    // FALLBACK: JUST A QUICK LOOK UP IF IT WORKS IT WORKS, IF NOT THAT'S ALL WE CAN DO
    // Conversation File Name from Working Directory
    const directoryBaseNameFromWD = basename(workingDirectory);

    const conversationFileNameWD = `${directoryBaseNameFromWD}.conversation.json`;

    try {
        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        const relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        const relationship = relationships.find(
            (relationship) => relationship.conversationFile === conversationFileNameWD
        );

        if(relationship) {
            setInternalChatID(relationship.internalChatID);
            return true;
        }
    } catch {
        // move along
    }

    // Check clientInput of all the conversations in directory starting from the newest conversation file
    // No authority to overwrite, just comparing the conversation file found to the relationship file
    const allConversationFiles = await findAllConversationFiles(conversationDirectory);

    for (const conversationFile of allConversationFiles) {

        const conversationJson = await readFile(
            conversationFile,
            "utf-8",
        );

        // Find a matching clientInput text that matches the majority of the user's input
        // Sometimes clientInput did not fully register all of the user's input by the time we read it
        try {
            const conversation = JSON.parse(conversationJson);

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
                // If we already expendend the processing power to confirm the conversation file name
                // we might as well set it.
                setConversationFileName(normalizeJsonFileName(basename(conversationFile)));

                // Check relationship file for a matching internal chat ID
                try {
                    const relationshipJson = await readFile(
                        relationshipFile,
                        "utf-8",
                    );

                    const relationships: ChatSessionConversationRelationship[] =
                        JSON.parse(relationshipJson);

                    const relationship = relationships.find(
                        (relationship) => relationship.conversationFile === getConversationFileName()
                    );

                    if(relationship) {
                        setInternalChatID(relationship.internalChatID);
                        return true;
                    }
                } catch {
                    // move along
                }

                break;
            }
        } catch {
            // Ignore malformed conversation files and continue scanning.
        }
    }

    return false;
}

/**
 * Cheap check to see if a conversation file name can be derived from the working directory base name
 * WD base name sometimes has random alphanumeric suffixes
 */
async function promptProcessorTryWorkingDirectoryBaseNameLookupInRelationshipFile(
    rootDirectory: string,
    workingDirectory: string,
):Promise<void> {

    // Construct the path to the conversation folder
    const conversationDirectory = join(
        rootDirectory,
        "conversations",
    );

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    // Extract the basename of the working directory
    const workingDirectoryBaseName = basename(workingDirectory);

    // Point to the potential conversation file
    const conversationFileName = `${workingDirectoryBaseName}.conversation.json`;

    // Try to read the relationship file
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
        // At worst we are going to reuse an abandoned ICID rather than making a new one
        for (
            let i = relationships.length - 1;
            i >= 0;
            i--
        ) {
            const relationship = relationships[i];

            if (relationship.conversationFile === conversationFileName) {

                // If the conversation file is matched, set the conversation file name in memory
                setConversationFileName(normalizeJsonFileName(conversationFileName));

                // If a matching relationship is found, return its internalChatID
                setInternalChatID(relationship.internalChatID);
            }
        }
    } catch (error) {
        console.error("Error reading relationship file:", error);
    }
}

/**
 * Quick check to match an internal chat ID against the relationship file to derive the conversation file name
 */
async function promptProcessorMatchICIDInRelationshipFile(
    rootDirectory: string,
): Promise<void> {

    // Construct the path to the conversation folder
    const conversationDirectory = join(
        rootDirectory,
        "conversations",
    );

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    // Fetch current internal chat ID
    const currentInternalChatID = getInternalChatID();

    try {
        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        const relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        const relationship = relationships.find(
            (relationship) => relationship.internalChatID === currentInternalChatID
        );

        if (relationship) {

            // If a matching relationship is found, set it's conversation file name
            setConversationFileName(normalizeJsonFileName(relationship.conversationFile));
        }

    } catch (error: any) {
        console.error(`Error occurred while reading relationship file: ${error.message}`);
    }
}

/**
 * Check to see if Working Directory base name links to a conversation file, if it does check for the ICID
 * or clientInput in the file to validate the conversation file name
 */
async function promptProcessorTryWorkingDirectoryConversationFile(
    rootDirectory: string,
    workingDirectory: string,
    userText: string,
):Promise<void> {

    // Construct the path to the conversation folder
    const conversationDirectory = join(
        rootDirectory,
        "conversations",
    );

    // Extract the basename of the working directory
    const workingDirectoryBaseName = basename(workingDirectory);

    // Point to the potential conversation file
    const conversationFileName = `${workingDirectoryBaseName}.conversation.json`;

    // Construct the path to the conversation file
    const conversationFilePath = join(
        conversationDirectory,
        conversationFileName,
    );

    const currentInternalChatID = getInternalChatID();

    try {

        // Parse the conversation file
        const conversationJson = await readFile(
            conversationFilePath,
            "utf-8",
        );

        const conversation = JSON.parse(conversationJson);

        // Check for the embedded ICID
        const internalChatIDPattern = new RegExp(
            `\\[ICID:\\s*${currentInternalChatID}\\]`,
        );

        if (internalChatIDPattern.test(conversationJson)) {
            setConversationFileName(normalizeJsonFileName(conversationFileName));

            return;
        }

        // Check if the conversation file has a matching clientInput
        const normalize = (s: string): string =>
            (s ?? "")
                .trim()
                .replace(/\s+/g, " ");

        const clientInput = normalize(conversation.clientInput);

        const input = normalize(userText);

        // Find a matching clientInput text that matches the majority of the user's input
        // Sometimes clientInput did not fully register all of the user's input by the time we read it
        if (
            clientInput.length > 0 &&
            input.startsWith(clientInput)
        ) {
            setConversationFileName(normalizeJsonFileName(conversationFileName));

            return;
        }

    } catch (error: any) {
        if (error.code !== "ENOENT") {
            throw error;
        }

        // File doesn't exist — silently move along.
    }
}

/**
 * Expensive full directory scan of all conversation files from newest to oldest until a match is found between
 * the user's input and a conversation file's clientInput or ICID marker.
 * Highest authority to rewrite the relationship file to update or remove mismatched pairs.
 */
async function scanForConversationFileThruFullConversationDirectoryScan(
    rootDirectory: string,
    userText: string,
):Promise<void> {

    const conversationDirectory = join(
        rootDirectory,
        "conversations"
    );

    const allConversationFiles = await findAllConversationFiles(conversationDirectory);

    const currentInternalChatID = getInternalChatID();

    const internalChatIDPattern = new RegExp(
        `\\[ICID:\\s*${currentInternalChatID}\\]`,
    );

    for (const conversationFile of allConversationFiles) {

        const conversationJson = await readFile(
            conversationFile,
            "utf-8",
        );

        // Check for the embedded ICID
        if (internalChatIDPattern.test(conversationJson)) {

            setConversationFileName(normalizeJsonFileName(basename(conversationFile)));

            break;
        }

        // Find a matching clientInput text that matches the majority of the user's input
        // Sometimes clientInput did not fully register all of the user's input by the time we read it
        try {
            const conversation = JSON.parse(conversationJson);

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
                setConversationFileName(normalizeJsonFileName(basename(conversationFile)));

                break;
            }

        } catch {
            // Ignore malformed conversation files and continue scanning.
        }
    }

    const currentConversationFileName = getConversationFileName();

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    const lockFile = `${relationshipFile}.lock`;

    const functionName = "scanForConversationFileThruFullConversationDirectoryScan";

    // We should now have both ICID and ConversationFileName in memory
    // Check the relationship file if it already exists, if not we need to create it
    try {
        await acquireLock(lockFile, functionName);

        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        const relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        const relationship = relationships.find(
            (relationship) => relationship.internalChatID === currentInternalChatID &&
                relationship.conversationFile === getConversationFileName(),
        );

        // If they already perfectly match we don't need to do anything
        if (relationship) {
            setConversationFileName(normalizeJsonFileName(relationship.conversationFile));
            setInternalChatID(relationship.internalChatID);
            return;
        }

        // If there was not a perfect match, we need to create a new one or modify an old existing relationship

        const matchingIndexes = relationships
            .map((relationship, index) => ({
                relationship,
                index,
            }))
            .filter(
                ({ relationship }) =>
                    relationship.internalChatID === getInternalChatID() ||
                    relationship.conversationFile === getConversationFileName(),
            );

        if (matchingIndexes.length > 0) {

            const filteredRelationships = relationships.filter(
                (_, index) =>
                    !matchingIndexes.some(
                        (match) => match.index === index,
                    ),
            );

            filteredRelationships.push({
                internalChatID: getInternalChatID(),
                conversationFile: getConversationFileName(),
            });

            const relationshipsToWrite =
                filteredRelationships.length > relationshipsLimit
                    ? filteredRelationships.slice(-relationshipsLimit)
                    : filteredRelationships;

            await writeFile(
                relationshipFile,
                JSON.stringify(relationshipsToWrite, null, 4),
                "utf-8",
            );

        } else {

            relationships.push({
                internalChatID: getInternalChatID(),
                conversationFile: getConversationFileName(),
            });

            const relationshipsToWrite =
                relationships.length > relationshipsLimit
                    ? relationships.slice(-relationshipsLimit)
                    : relationships;

            await writeFile(
                relationshipFile,
                JSON.stringify(relationshipsToWrite, null, 4),
                "utf-8",
            );
        }

    } catch (error: any) {
        console.error(`scanForConversationFileThruFullConversationDirectoryScan() error: ${error.message}`);
    } finally {
        await releaseLock(lockFile, functionName);
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