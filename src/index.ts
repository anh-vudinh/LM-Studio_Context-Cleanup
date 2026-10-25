import { PluginContext } from "@lmstudio/sdk";
import { promptPreprocessor } from "./promptPreprocessor";
import fs from "node:fs/promises";
import path from "path";
import os from "os";

import {
    configSchematics,
    setValidatedLMSRootDirectory,
    setValidatedConversationRootDirectory,
    setValidatedBackupsRootDirectory,
} from "./config";

export async function main(context: PluginContext) {

  await resolveLMStudioRoot();

  context.withConfigSchematics(configSchematics);
  context.withPromptPreprocessor(promptPreprocessor);

  // Use console.log instead of context.log
  console.log("Context Cleanup Plugin initialized");
}

async function resolveLMStudioRoot(): Promise<string> {
    // First choice: default LM Studio location
    const defaultRoot = path.join(
        os.homedir(), 
        ".lmstudio"
    );

    const conversationsPath = path.join(
        defaultRoot, 
        "conversations"
    );

    const backupsRoot = path.join(
        defaultRoot,
        "conversations-backup"
    );

    try {
        if ((await fs.stat(conversationsPath)).isDirectory()) {

            setValidatedLMSRootDirectory(defaultRoot);

            setValidatedConversationRootDirectory(conversationsPath);

            setValidatedBackupsRootDirectory(backupsRoot);

            // console.log("Using default LM Studio root:", defaultRoot);
            return defaultRoot;
        }
    } catch {
        // Default location is missing or inaccessible; try cwd.
    }

    // Fallback: derive the root from the plugin's working directory
    const cwdRoot = path.resolve(process.cwd(), "..", "..", "..","..");
    const cwdConversationsRoot = path.join(
        cwdRoot, 
        "conversations"
    );

    const cwdBackupsRoot = path.join(
        cwdRoot, 
        "conversations-backup"
    );

    try {
        if ((await fs.stat(cwdConversationsRoot)).isDirectory()) {

            setValidatedLMSRootDirectory(cwdRoot);

            setValidatedConversationRootDirectory(cwdConversationsRoot);

            setValidatedBackupsRootDirectory(cwdBackupsRoot);

            // console.log("Using cwd-derived LM Studio root:", cwdRoot);
            return cwdRoot;
        }
    } catch {
        // Fallback location is also invalid.
    }

    throw new Error(
        "Could not find a valid LM Studio root: neither the default location nor the cwd-derived location contains a conversations directory.",
    );
}