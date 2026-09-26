
import { join } from "node:path";
import { getValidatedBackupConversation, setValidatedBackupConversation } from "./config";

import { 
    readFile, 
    writeFile, 
    access, 
    mkdir, 
    rename,
} from "node:fs/promises";

const validatedBackupConversation = getValidatedBackupConversation();

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
export async function backupConversation(
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

        setValidatedBackupConversation(JSON.parse(latestJson));

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
