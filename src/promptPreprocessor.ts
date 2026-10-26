import type { ChatMessage, PromptPreprocessorController } from "@lmstudio/sdk";
import type { ThresholdParamsCollection } from "./config";
import { saveMemoryCommandTracker } from "./saveMemoryCommandTracker";
import { readConversationWithParseRetries, startPollingToCleanupConversation } from "./cleanupConversation";
import { acquireLock, releaseLock } from "./acquireLockFile";
import { join, basename, relative } from "node:path";
import path from "node:path";

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
    getValidatedConversationRootDirectory,
    getThresholdParamsCollection,
    setThresholdParamsCollection,
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
    const workingDirectory = ctl.getWorkingDirectory();
    
    // Establish initial variable values
    const config = ctl.getPluginConfig(configSchematics);
    const history = await ctl.pullHistory();
    const messages = history.getMessagesArray();
    const userText = userMessage.getText();
    const contextCleanup = config.get("contextCleanup") as boolean;
    const cleanupCounter = normalizeNumber(config.get("cleanupCounter") as number);
    const keepOldestN = normalizeNumber(config.get("keepOldestN") as number);
    const keepNewestN = normalizeNumber(config.get("keepNewestN") as number);
    const cleanupThinkingOnly = config.get("cleanupThinkingOnly") as boolean;
    const keepAllMessages = config.get("keepAllMessages") as boolean;
    const createBackup = config.get("createBackup") as boolean;
    const keepAllThinking = config.get("keepAllThinking") as boolean;
    const autoCleanupThreshold = config.get("autoCleanupThreshold") as number;
    const compactAMemory = config.get("compactAMemory") as boolean;
    let createNewInternalChatID = false;

    saveMemoryCommandTracker(userText);

    const saveMemoryCommandIsInProgress = 
        getSaveMemoryNumber() !== null || 
        getSaveMemoryCategory() !== null || 
        getSaveMemoryName() !== null;

    //------------------------------------
    // Maybe repair a missing relationship bond with in memory data
    //------------------------------------
    if(getInternalChatID() !== "" && getConversationFileName() !== "") {
        // Check that the relationship exists in the relationship file.
        // If it does not, add it. This is the extreme case user is deleting relationships directly from the file and their load bearing user message
        // Two available options in the function, choose which one to enable. Each has it's pros or cons.
        const relationshipReadded = await maybeRepairRelationshipFileWithKnownICIDAndConversationFile();

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
        await promptProcessorMatchICIDInRelationshipFile();

        // CHECK THE WORKING DIRECTORY BASE NAME FILE
        // CHECK FOR A EMBEDDED ICID OR MATCHING CLIENTINPUT
        if (getConversationFileName() === "") {
            await promptProcessorTryWorkingDirectoryConversationFile(
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
            userText,
        );
    }

    //----------------------------------------------------
    // END: CONVERSATION FILE NAME NOW KNOWN && ICID NOW KNOWN
    //----------------------------------------------------

    if ((contextCleanup === true && saveMemoryCommandIsInProgress === false)) {
        
        const userMessageCount = messages.filter(
            message => message.getRole() === "user"
        ).length + 1;
            // console.log(
            //     userMessageCount,
            //     userMessageCount % cleanupCounter === 0,
            //     userMessageCount >= minimumToStartCleaning,
            //     keepAllMessages,
            // );
        const assistantMessageCount = messages.filter(isEligibleAssistantMessage).length + 1;

        // Trigger every whole number
        // Let through to check every turn if threshold auto cleanup is enabled
        if ((userMessageCount > 0 &&
            userMessageCount >= minimumToStartCleaning) ||
            keepAllMessages === true
        ) {
            const currentConversationFileName = getConversationFileName();

            // Final cleanup
            await startPollingToCleanupConversation(
                keepOldestN, 
                keepNewestN, 
                cleanupThinkingOnly, 
                keepAllMessages,
                createBackup,
                keepAllThinking,
                assistantMessageCount,
                currentConversationFileName,
                userText,
                autoCleanupThreshold,
                compactAMemory,
                messages,
                cleanupCounter,
            )
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
    const currentInternalChatID = getInternalChatID();

    const allRequiredFieldsKnown =
        currentSaveMemoryNumber !== null &&
        (currentSaveMemoryCategory !== null && currentSaveMemoryCategory !== "") &&
        (currentSaveMemoryName !== null && currentSaveMemoryName !== "");

    if(allRequiredFieldsKnown) {
        resetSaveMemoryParameters();
    }

    return(
        `${createNewInternalChatID? `${userText}.                          [ICID: ${currentInternalChatID}] Ignore this ICID tag. ` : userText}`
    );
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
async function maybeRepairRelationshipFileWithKnownICIDAndConversationFile(): Promise<boolean> {

    const conversationDirectory = getValidatedConversationRootDirectory();

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );
    
    let lockOwnerName: string | undefined;

    const lockFile = `${relationshipFile}.lock`;

    const functionName = "maybeRepairRelationshipFileWithKnownICIDAndConversationFile";

    try{
        lockOwnerName = await acquireLock(lockFile, functionName);

        const conversationFileName = getConversationFileName();

        const internalChatID = getInternalChatID();

        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        let relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        // Extract the relationship pairs
        relationships = relationships.filter(
            (relationship) =>
                relationship.internalChatID.trim() !== "" &&
                relationship.conversationFile.trim() !== "",
        );

        // But before creating it, check whether this conversation file already has a relationship,
        // regardless of whether its ICID matches the in-memory ICID.
        const existingRelationship = relationships.find(
            relationship =>
                relationship.conversationFile === conversationFileName,
        );

        if (existingRelationship) {
            // This conversation file already has an established ICID.
            // Adopt it instead of creating a duplicate relationship.
            if (existingRelationship.internalChatID !== internalChatID) {
                setInternalChatID(existingRelationship.internalChatID);
            }

            return false;
        }

        // The exact relationship we have in memory is missing from the relationship file. CHOOSE ONLY ONE OPTION!!
        // That can only mean the user deleted the load bearing user message and deleted the relationship manually

        //---------------------------
        // OPTION 1: REPAIR THE RELATIONSHIP FILE WITH IN MEMORY DATA 
        // (must create a lock file with it's inherent delay)
        //---------------------------
        relationships.push({
            internalChatID,
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

        //---------------------------
        // OPTION 2: RESET THE IN MEMORY DATA SO WE CAN GO THROUGH THE NORMAL PROCESS OF CREATING A BRAND NEW LINK 
        // (no lock file needed, no delay, just a quick read of the relationship file)
        //---------------------------
        // setConversationFileName("");
        // setInternalChatID("");


    } catch (error) {
        // move along
    } finally {
        if (lockOwnerName !== undefined) {
            await releaseLock(lockFile, lockOwnerName);
            lockOwnerName = undefined;
        }
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
    workingDirectory: string,
    userText: string,
): Promise<boolean>{

    const conversationFileName = getConversationFileName();
    
    const conversationDirectory = getValidatedConversationRootDirectory();

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

        // Find a matching clientInput text that matches the majority of the user's input
        // Sometimes clientInput did not fully register all of the user's input by the time we read it
        try {
            const conversation = await readConversationWithParseRetries(
                conversationFile,
                2,
                100,
                "return",
            );

            // Could not read/parse this conversationFile proceed to the next
            if (conversation === null) continue;

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
                setConversationFileName(
                    normalizeJsonFileName(
                        getConversationRelativePath(
                            conversationDirectory,
                            conversationFile,
                        ),
                    ),
                );

                // // Affirmed this was the right file, set the updated threshold values
                // await thresholdParamsCollectionSetterHelper(conversation);
            
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
    workingDirectory: string,
):Promise<void> {

    // Construct the path to the conversation folder
    const conversationDirectory = getValidatedConversationRootDirectory();

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
        console.error("promptProcessorTryWorkingDirectoryBaseNameLookupInRelationshipFile error:", error);
    }
}

/**
 * Quick check to match an internal chat ID against the relationship file to derive the conversation file name
 */
async function promptProcessorMatchICIDInRelationshipFile(): Promise<void> {

    // Construct the path to the conversation folder
    const conversationDirectory = getValidatedConversationRootDirectory();

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
        console.error(`promptProcessorMatchICIDInRelationshipFile error: ${error.message}`);
    }
}

/**
 * Check to see if Working Directory base name links to a conversation file, if it does check for the ICID
 * or clientInput in the file to validate the conversation file name
 */
async function promptProcessorTryWorkingDirectoryConversationFile(
    workingDirectory: string,
    userText: string,
):Promise<void> {

    // Construct the path to the conversation folder
    const conversationDirectory = getValidatedConversationRootDirectory();

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
        // Using this because we do not want a full conversation directory scan to occur on failure.
        const conversation = await readConversationWithParseRetries(
            conversationFilePath,
            1,
            100,
            "return",
        );

        if (conversation === null) return;

        // Check for the embedded ICID
        const internalChatIDPattern = new RegExp(
            `\\[ICID:\\s*${currentInternalChatID}\\]`,
        );

        const hasInternalChatID = conversation.messages?.some(
            (message: any) =>
                message.versions?.some(
                    (version: any) =>
                        version.role === "user" &&
                        version.preprocessed?.content?.some(
                            (item: any) =>
                                item.type === "text" &&
                                typeof item.text === "string" &&
                                internalChatIDPattern.test(item.text),
                        ),
                ),
        );

        if (hasInternalChatID) {
            setConversationFileName(
                normalizeJsonFileName(conversationFileName),
            );

            // // Affirmed this was the right file, set the updated threshold values
            // await thresholdParamsCollectionSetterHelper(conversation);

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

            // // Affirmed this was the right file, set the updated threshold values
            // await thresholdParamsCollectionSetterHelper(conversation);

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
export async function scanForConversationFileThruFullConversationDirectoryScan(
    userText: string,
):Promise<void> {

    const conversationDirectory = getValidatedConversationRootDirectory();

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

            setConversationFileName(
                normalizeJsonFileName(
                    getConversationRelativePath(
                        conversationDirectory,
                        conversationFile,
                    ),
                ),
            );

            break;
        }

        // Find a matching clientInput text that matches the majority of the user's input
        // Sometimes clientInput did not fully register all of the user's input by the time we read it
        try {
            const conversation = await readConversationWithParseRetries(
                conversationFile,
                2,
                100,
                "return",
            );

            if (conversation === null) continue;

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
                setConversationFileName(
                    normalizeJsonFileName(
                        getConversationRelativePath(
                            conversationDirectory,
                            conversationFile,
                        ),
                    ),
                );

                // // Affirmed this was the right file, set the updated threshold values
                // await thresholdParamsCollectionSetterHelper(conversation);
            
                break;
            }

        } catch {
            // Ignore malformed conversation files and continue scanning.
        }
    }

    // Point to the relationship file
    const relationshipFile = join(
        conversationDirectory,
        "ChatSessionConversationRelationship.json",
    );

    let lockOwnerName: string | undefined;

    const lockFile = `${relationshipFile}.lock`;

    const functionName = "scanForConversationFileThruFullConversationDirectoryScan";

    // We should now have both ICID and ConversationFileName in memory
    // Check the relationship file if it already exists, if not we need to create it
    try {
        lockOwnerName = await acquireLock(lockFile, functionName);

        let resolvedConversationFileName = getConversationFileName();
        let resolvedInternalChatID = getInternalChatID();

        // Exit don't attempt to write
        if (resolvedConversationFileName === "" || resolvedInternalChatID === "") {
            return;
        }

        const relationshipJson = await readFile(
            relationshipFile,
            "utf-8",
        );

        const relationships: ChatSessionConversationRelationship[] =
            JSON.parse(relationshipJson);

        // Perfect match exist, re-establish the in-memory parameters
        // usesless but reassurance.
        const relationship = relationships.find(
            (relationship) => relationship.internalChatID === resolvedInternalChatID &&
                relationship.conversationFile === resolvedConversationFileName,
        );

        // If they already perfectly match we don't need to do anything
        if (relationship) {
            setConversationFileName(normalizeJsonFileName(relationship.conversationFile));
            setInternalChatID(relationship.internalChatID);
        } else {
            // Check whether this conversation file already has a relationship,
            // regardless of whether its ICID matches the in-memory ICID.
            // This code snippet was to address the companion plugin which shares the same logic from
            // assigning it's own to the file if the winner already established and icid in the relationship file
            // at the following second unix timestamp. imagine 10 ms before the next second ticks and the loser lagged behind of
            // and created a new icid on the following second.
            const existingRelationship = relationships.find(
                relationship =>
                    relationship.conversationFile === resolvedConversationFileName,
            );

            if (existingRelationship) {
                // This conversation file already has an established ICID.
                // Adopt it instead of creating a duplicate relationship.
                if (existingRelationship.internalChatID !== resolvedInternalChatID) {
                    setInternalChatID(existingRelationship.internalChatID);
                }
            }
        }

        // update the values after previous adoptions.
        resolvedConversationFileName = getConversationFileName();
        resolvedInternalChatID = getInternalChatID();

        // If there was not a perfect match, we need to create a new one or modify an old existing relationship
        const matchingIndexes = relationships
            .map((relationship, index) => ({
                relationship,
                index,
            }))
            .filter(
                ({ relationship }) =>
                    relationship.internalChatID === resolvedInternalChatID ||
                    relationship.conversationFile === resolvedConversationFileName,
            );

        if (matchingIndexes.length > 0) {

            const filteredRelationships = relationships.filter(
                (_, index) =>
                    !matchingIndexes.some(
                        (match) => match.index === index,
                    ),
            );

            filteredRelationships.push({
                internalChatID: resolvedInternalChatID,
                conversationFile: resolvedConversationFileName,
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
                internalChatID: resolvedInternalChatID,
                conversationFile: resolvedConversationFileName,
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
        console.error(`scanForConversationFileThruFullConversationDirectoryScan error: ${error.message}`);
    } finally {
        if (lockOwnerName !== undefined) {
            await releaseLock(lockFile, lockOwnerName);
            lockOwnerName = undefined;
        }
    }
}

/**
 * Helper for the full scanning of all conversation files to find the ICID
 * Returns the full file path
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
                    entry.name.endsWith(".ready") ||
                    entry.name.endsWith(".copy") ||
                    entry.name.endsWith(".lmstudio-temp")
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
function normalizeNumber(number: number) {
    return Math.floor(number);
}

/**
 * just fixes the json file name, I've seen some unreliable things with LM Studio
 * Like a file named blah.conversation.json-temp-blahblah be pulled into memory
 * and during some instance of the lifecycle LM Studio changes or replaces the temp file with an actually correct one.
 */
export function normalizeJsonFileName(jsonFileName: string) {

    return jsonFileName.replace(/(\.json).*$/, "$1");
}

/**
 * To capture the conversation files that are within nested folders
 */
function getConversationRelativePath(
    conversationsDirectory: string,
    conversationFilePath: string,
): string {
    return relative(
        conversationsDirectory,
        conversationFilePath,
    ).split(path.sep).join("/");
}

export function isEligibleAssistantMessage(
    message: ChatMessage,
): boolean {
    if (!message.isAssistantMessage()) {
        return false;
    }

    const content = (message as any).data?.content ?? [];

    return !content.some(
        (item: any) => item.type === "toolCallRequest",
    );
}

export async function thresholdParamsCollectionSetterHelper(
    conversation: any,
): Promise<void> {
    const current = getThresholdParamsCollection();

    const updates: Partial<ThresholdParamsCollection> = {
        tokenCount: conversation.tokenCount,
    };

    // Initialize context length only once, when a valid value is available.
    if (current.contextLength === null) {
        const contextLength =
            conversation.lastUsedModel?.instanceLoadTimeConfig?.fields?.find(
                (field: any) => field.key === "llm.load.contextLength",
            )?.value;

        if (typeof contextLength === "number") {
            updates.contextLength = contextLength;
        }
    }

    setThresholdParamsCollection(updates);
}