import { createConfigSchematics } from "@lmstudio/sdk";

export const configSchematics = createConfigSchematics()
  .field(
    "contextCleanup",
    "boolean",
    {
      displayName: "Cleanup Context?",
      hint: "ON or OFF context cleanup. Must be enabled to use plugin.",
      warning: "Keep ON if you want to use any of these features.",
    },
    true
  )
  .field(
    "keepOldestN",
    "numeric",
    {
      displayName: "Keep first <N> messages",
      int: true,
      min: 1,
    },
    1
  )
  .field(
    "keepNewestN",
    "numeric",
    {
      displayName: "Keep last <N> messages",
      int: true,
      min: 1,
    },
    2
  )
  .field(
    "cleanupCounter",
    "numeric",
    {
      displayName: "Cleanup after every <N>th message",
      subtitle: "-> Still considered in overrides.",
      warning: "Cleaning starts after the third message.",
      hint: "Cleaning starts after the third message.",
      int: true,
      min: 1,
    },
    3
  )
  .field(
    "keepAllMessages",
    "boolean",
    {
      displayName: "OVERRIDE: Cleanup But Keep All Messages",
      warning: "All messages will be kept after cleanup. This ignores the truncation system.",
      hint: "Truncation Disabled -- Cleanups performed: | Thinking | System prompt | Jinja | Tools | Preprocessed |",
    },
    false
  )
  .field(
    "cleanupThinkingOnly",
    "boolean",
    {
      displayName: "OVERRIDE: Cleanup Thinking Context Only",
      warning: "Only cleans the thinking tokens. All extra cleanups provided by default are ignored.",
      hint: "Cleanups performed: | Thinking |",
    },
    false
  )
  .field(
    "keepAllThinking",
    "boolean",
    {
      displayName: "OVERRIDE: Keep All Thinking Context",
      warning: "Performs all cleanups allowed but keeps all thinking.",
      hint: "Cleanups performed: | System prompt | Jinja | Tools | Preprocessed |",
    },
    false
  )
  .field(
    "createBackup",
    "boolean",
    {
      displayName: "EXTRA: Maintain an Uncleaned Backup of this conversation",
      warning: "Backup saved in .lmstudio\\conversations-backup folder.",
      hint: "At the moment of enabling creates an exact copy. Subsequent backups only maintain the copy's freshness by append in your latest user/assistant turn."
    },
    false
  )
  .build();

// ============================================================
// Backup State
// ============================================================
let validatedBackupConversation: any = null;

export function setValidatedBackupConversation(
    conversation: any,
): void {
    validatedBackupConversation = conversation;
}

export function getValidatedBackupConversation(): any {
    return validatedBackupConversation;
}

// ============================================================
// Save Memory Parameters States (No guarantee these states remain alive through subsequent turns)
// ============================================================

let saveMemoryNumber: number | null = null;
let saveMemoryCategory: string | null = null;
let saveMemoryName: string | null = null;
let saveMemoryNumberEndRange: number | null = null;

export function setSaveMemoryNumber(value: number | null): void {
    saveMemoryNumber = value;
}

export function getSaveMemoryNumber(): number | null {
    return saveMemoryNumber;
}

export function setSaveMemoryCategory(value: string | null): void {
    saveMemoryCategory = value;
}

export function getSaveMemoryCategory(): string | null {
    return saveMemoryCategory;
}

export function setSaveMemoryName(value: string | null): void {
    saveMemoryName = value;
}

export function getSaveMemoryName(): string | null {
    return saveMemoryName;
}

export function setSaveMemoryNumberEndRange(value: number | null): void {
    saveMemoryNumberEndRange = value;
}

export function getSaveMemoryNumberEndRange(): number | null {
    return saveMemoryNumberEndRange;
}

export function resetSaveMemoryParameters(): void {
    saveMemoryNumber = null;
    saveMemoryCategory = null;
    saveMemoryName = null;
    saveMemoryNumberEndRange = null;
}
