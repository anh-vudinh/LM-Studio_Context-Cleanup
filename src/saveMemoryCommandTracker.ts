import {
    setSaveMemoryNumber,
    setSaveMemoryCategory,
    setSaveMemoryName,
    getSaveMemoryNumber,
    getSaveMemoryCategory,
    getSaveMemoryName,
    resetSaveMemoryParameters,
} from "./config";

/**
 * Monitors if the user is currently in a save memory attempt. 
 * Disables context cleanup until after the request is fulfilled.
 * Compatibility function to protect Presisting Memories Plugin messages it's trying to save.
 */
export async function saveMemoryCommandTracker(
    userText: string
): Promise<void>{

    const EXIT_SAVE_MEMORY_REGEX =
        /\bexit\b\s+(?:save|sav|sve|sv|store|remember|persist)\b\s+(?:memory|mem|mm|mmry|memry|mry|mmy|memy)\b/i;

    const exitMatch = userText.match(EXIT_SAVE_MEMORY_REGEX);
    
    const exitRequested = exitMatch !== null? true : false;

    if (exitRequested === true) {
        resetSaveMemoryParameters();
    }

    const SAVE_MEMORY_REGEX =
        /\b(?:save|sav|sve|sv|store|remember|persist)\b.*?\b(?:memory|mem|mm|mmry|memry|mry|mmy|memy)\b(?:\s+message|msg)?\s*(\d+)/i;

    const saveMemoryMatch = userText.match(SAVE_MEMORY_REGEX);
    
    if (saveMemoryMatch) {
        setSaveMemoryNumber(Number(saveMemoryMatch[1]));
    }

    // getSaveMemoryNumber()
    // Null = number not provided
    // If there was no number we won't assume user was trying to save a memory 
    // and just meant to type it as normal random user response
    const saveMemoryCommandQueued = getSaveMemoryNumber() !== null;

    // Save memory chain incomplete.
    // Category and/or Memory Name was missing. Expect to retrieve it.
    if (saveMemoryCommandQueued) {
        const CATEGORY_EXTRACT_REGEX =
            /\b(?:category|categroy|categary|categry|catgry|catagory|catgory|categoy)\b\s+(?:is\s+)?([^;,.]+)/i;

        const NAME_EXTRACT_REGEX =
            /\b(?:name|nmae|nam|nme)\b\s+(?:is\s+)?([^;,.]+)/i;

        if(getSaveMemoryCategory() === null){
            const saveMemoryCategoryMatch = userText.match(CATEGORY_EXTRACT_REGEX);
            if(saveMemoryCategoryMatch) {
                const category = saveMemoryCategoryMatch[1].trim();

                setSaveMemoryCategory(category);
            }
        }

        if(getSaveMemoryName() === null) {
            const saveMemoryNameMatch = userText.match(NAME_EXTRACT_REGEX);
            if(saveMemoryNameMatch){

                const name = saveMemoryNameMatch[1].trim();

                setSaveMemoryName(name);
            }
        }
    }
}
