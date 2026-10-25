
import { join, dirname } from "node:path";

import {
    getValidatedBackupConversation,
    getValidatedBackupsRootDirectory,
    setValidatedBackupConversation
} from "./config";

import { 
    readFile, 
    writeFile, 
    access, 
    mkdir, 
    rename,
} from "node:fs/promises";

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
 * I am storing the json in memory so that we can directly update it there rather than read/parsing the conversation file each time.
 * The backup copy is the source of truth after it's been initialized the first time using latestconversation's data.
 */
export async function backupConversation(
    conversationFileName: string,
    latestJson: string,
    latestConversation: any,
    offsetLastMessages: number, // cleanupCounter variable
): Promise<void> {

    const backupDirectory = getValidatedBackupsRootDirectory();

    
    await mkdir(
        backupDirectory,
        { recursive: true },
    );

    const backupFile = join(
        backupDirectory,
        conversationFileName,
    );

    // Ensure the backup file's parent directory exists for nested folders
    try {
        await access(backupFile);
    } catch (error: any) {
        if (error?.code === "ENOENT") {
            await mkdir(dirname(backupFile), { recursive: true });
        } else {
            throw error;
        }
    }

    // console.log(
    //     "conversationFileName",
    //     conversationFileName,
    //     "backupFile",
    //     backupFile,
    //     "backupDirectory",
    //     backupDirectory,
    // );
    
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

        setValidatedBackupConversation(JSON.parse(latestJson));

        return;
    }

    let backupConversation: any;

    const validatedBackupConversation = getValidatedBackupConversation();

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
            (
                backupFirstUserText === latestFirstUserText ||
                backupConversation.createdAt === latestConversation.createdAt
            );

        // Rename the existing conversation backup with the same name with a suffix timestamp
        // The current conversation has priority over the base name
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

            setValidatedBackupConversation(JSON.parse(latestJson));

            return;
        }

        // Existing backup belongs to the current conversation.
        setValidatedBackupConversation(backupConversation);

    } else {
        // Already validated and cached in memory.
        backupConversation = getValidatedBackupConversation();
    }

    // Append the latest two message objects.
    const latestMessages = latestConversation.messages ?? [];

    const backupMessages = backupConversation.messages ?? [];

    const newMessages = latestMessages.slice(-(offsetLastMessages * 2));
    backupMessages.push(...newMessages);

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

    setValidatedBackupConversation(backupConversation);
}