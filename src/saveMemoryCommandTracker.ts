import {
    setSaveMemoryNumber,
    setSaveMemoryCategory,
    setSaveMemoryName,
    getSaveMemoryNumber,
    setSaveMemoryNumberEndRange,
    resetSaveMemoryParameters,
    getCategoryExtractRegex,
    getNameExtractRegex,
    getMultiSaveMemoryRegex,
    getExitSaveMemoryRegex,
    getSaveMemoryRegex,
} from "./config";

/**
 * Monitors if the user is currently in a save memory attempt. 
 * Disables context cleanup until after the request is fulfilled.
 * Compatibility function to protect Presisting Memories Plugin messages it's trying to save.
 */
export async function saveMemoryCommandTracker(
    userText: string
): Promise<void>{

    const SAVE_MEMORY_REGEX = getSaveMemoryRegex();

    const MULTI_SAVE_MEMORY_REGEX = getMultiSaveMemoryRegex();

    const CATEGORY_EXTRACT_REGEX = getCategoryExtractRegex();

    const NAME_EXTRACT_REGEX = getNameExtractRegex();

    const EXIT_SAVE_MEMORY_REGEX = getExitSaveMemoryRegex();

    const exitMatch = userText.match(EXIT_SAVE_MEMORY_REGEX);
    
    const exitRequested = exitMatch !== null? true : false;

    if (exitRequested === true) {
        resetSaveMemoryParameters();
    }

    // ============================================================
    // FIELD EXTRACTION
    // ============================================================

    function extractCategory(segment: string): string | null {
        const match = segment.match(CATEGORY_EXTRACT_REGEX);
        return match?.[1]?.trim() ?? null;
    }

    // reject wildcard trying to be used as a name
    function extractFileName(
        segment: string,
    ): string | null {

        const match =
            segment.match(NAME_EXTRACT_REGEX);

        const fileName =
            match?.[1]?.trim() ?? null;

        if (
            fileName === "*" ||
            fileName === "*.json"
        ) {
            return null;
        }

        return fileName;
    }

    // --------------------------------------------------------
    // Check whether this message contains a save-memory range of messages command.
    // --------------------------------------------------------

    const multiSaveMatch = userText.match(MULTI_SAVE_MEMORY_REGEX);

    if (multiSaveMatch) {
        const startMemoryNumber = Number(multiSaveMatch[1]);
        const endMemoryNumber = Number(multiSaveMatch[2]);

        setSaveMemoryNumber(startMemoryNumber);
        setSaveMemoryNumberEndRange(endMemoryNumber);
    }

    // --------------------------------------------------------
    // Check whether this message contains a save-memory command.
    // --------------------------------------------------------
    
    // Make sure it wasn't actually a save-memory range command
    const saveMemoryMatch = !multiSaveMatch? userText.match(SAVE_MEMORY_REGEX) : null;
    
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

        // --------------------------------------------------------
        // Split fields using the supported delimiters.
        // --------------------------------------------------------

        const segments: string[] = userText
            .split(/[;,.]/)
            .map((segment: string) => segment.trim())
            .filter((segment: string) => segment.length > 0);

        // --------------------------------------------------------
        // Process each segment.
        // --------------------------------------------------------

        for (const segment of segments) {

            // ----------------------------------------------------
            // CATEGORY
            // ----------------------------------------------------

            const category = extractCategory(segment);

            if (category !== null) {
                setSaveMemoryCategory(category);
                continue;
            }

            // ----------------------------------------------------
            // NAME
            // ----------------------------------------------------

            const fileName = extractFileName(segment);

            if (fileName !== null) {
                setSaveMemoryName(fileName);
                continue;
            }
        }
    }
}