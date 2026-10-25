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
      displayName: "🥇 Keep first <N> messages",
      hint: "The amount of beginning messages to exclude from truncation.",
      int: true,
      min: 1,
    },
    1
  )
  .field(
    "keepNewestN",
    "numeric",
    {
      displayName: "🥉 Keep last <N> messages",
      hint: "The amount of ending messages to exclude from truncation. Includes the newest turn.",
      int: true,
      min: 1,
    },
    2
  )
  .field(
    "cleanupCounter",
    "numeric",
    {
      displayName: "♻️ Cleanup after every <N>th message",
      subtitle: "-> Still considered in overrides.",
      warning: "Cleaning starts after the third message.",
      hint: "Cleaning starts after the messages present exceed Keep First + Keep Last + Cleanup after every Nth messages.",
      int: true,
      min: 1,
    },
    3
  )
  .field(
    "autoCleanupThreshold",
    "numeric",
    {
      displayName: "🚧 OVERRIDE: Threshold to Auto Cleanup %",
      subtitle: "Will automatically reduce chat to your Keep First and Keep Last messages settings after threshold is exceeded. Hover for Details",
      hint: "Truncation will be delayed until after the threshold is passed. \n\n - Off = 90-100 \n - Min = 50 \n\n The chat messages will be reduced down to your Keep first <N> and Keep last <N> messages setting.",
      int: true,
      min: 50,
      max: 100,
    },
    100
  )
  .field(
    "keepAllMessages",
    "boolean",
    {
      displayName: "🛡️ OVERRIDE: Cleanup But Keep All Messages",
      warning: "All messages will be kept after cleanup. This ignores the truncation system.",
      hint: "Truncation Disabled \n\n Cleanups performed: \n - Thinking \n - System prompt \n - Jinja \n - Tools \n - Preprocessed",
    },
    false
  )
  .field(
    "cleanupThinkingOnly",
    "boolean",
    {
      displayName: "🤯 OVERRIDE: Cleanup Thinking Context Only",
      warning: "Only cleans the thinking tokens. All extra cleanups provided by default are ignored.",
      hint: "Cleanups performed: \n - Thinking",
    },
    false
  )
  .field(
    "keepAllThinking",
    "boolean",
    {
      displayName: "💡 OVERRIDE: Keep All Thinking Context",
      warning: "Performs all cleanups allowed but keeps all thinking.",
      hint: "Cleanups performed: \n - System prompt \n - Jinja \n - Tools \n - Preprocessed",
    },
    false
  )
  .field(
    "compactAMemory",
    "boolean",
    {
      displayName: "🧠 Compact a Seed after Threshold Cleanup?",
      subtitle: "XPlugin Feature: Hover for details.",
      warning: "REQUIRES the companion plugin Persisting Memories Explicit rev12+ enabled.",
      hint: "REQUIRES the companion plugin Persisting Memories Explicit rev12+ from LM Studio or v5.0+ from Github. \n\n This toggle will do nothing without the companion plugin enabled. \n\n Also must be using the OVERRIDE: Threshold to auto cleanup %."
    },
    false
  )
  .field(
    "createBackup",
    "boolean",
    {
      displayName: "📂 EXTRA: Maintain an Uncleaned Backup of this conversation",
      warning: "Backup saved in ~/.lmstudio/conversations-backup folder.",
      hint: "At the moment of enabling creates an exact copy. Subsequent backups only maintain the copy's freshness by append in your latest user/assistant turn."
    },
    false
  )
  .build();

// ============================================================
// Backup State
// ============================================================
let validatedBackupConversation: any | null = null;

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

// ============================================================
// Conversation File Name & ICID States
// ============================================================

let conversationFileName = "";
let internalChatID = "";

export function setConversationFileName(value: string): void {
  conversationFileName = value;
}

export function getConversationFileName(): string {
  return conversationFileName;
}

export function setInternalChatID(value: string): void {
  internalChatID = value;
}

export function getInternalChatID(): string {
  return internalChatID;
}

// ============================================================
// Unified REGEX Patterns
// ============================================================
const SAVE_MEMORY_REGEX =
    /\b(?:save|sav|sve|sv|store|remember|persist)\s*(?:memory|mem|mm|mmry|memry|mry|mmy|memy)\s*(?:message|msg)?\s*(\d+)/i;

const MULTI_SAVE_MEMORY_REGEX =
    /\b(?:save|sav|sve|sv|store|remember|persist)\s*(?:memory|mem|mm|mmry|memry|mry|mmy|memy)\s*(?:message|msg|messages|msgs)?\s*(\d+)\s*(?:through|thru|thrugh|thruogh|thorugh|thurogh|to|too)\s*(\d+)/i;

const CATEGORY_EXTRACT_REGEX =
    /^(?:the\s+)?(?:memory|mem|mm|mmry|memry|mry|mmy|memy)?\s*(?:category|categroy|categary|categry|catgry|catagory|catgory|categoy)\b\s+(?:is\s+)?(.+)$/i;

const NAME_EXTRACT_REGEX =
    /^(?:the\s+)?(?:memory|mem|mm|mmry|memry|mry|mmy|memy)?\s*(?:name|nmae|nam|nme)\b\s+(?:is\s+)?(.+)$/i;

const EXIT_SAVE_MEMORY_REGEX =
    /\bexit\b\s+(?:save|sav|sve|sv|store|remember|persist)\b\s+(?:memory|mem|mm|mmry|memry|mry|mmy|memy)\b/i;

export function getSaveMemoryRegex(): RegExp {
    return SAVE_MEMORY_REGEX;
}

export function getMultiSaveMemoryRegex(): RegExp {
    return MULTI_SAVE_MEMORY_REGEX;
}

export function getCategoryExtractRegex(): RegExp {
    return CATEGORY_EXTRACT_REGEX;
}

export function getNameExtractRegex(): RegExp {
    return NAME_EXTRACT_REGEX;
}

export function getExitSaveMemoryRegex(): RegExp {
    return EXIT_SAVE_MEMORY_REGEX;
}

// ============================================================
// LM STUDIO ROOT DIRECTORY OVERRIDE
// ============================================================

let validatedLMSRootDirectory = "";
let validatedConversationRootDirectory = "";
let validatedBackupsRootDirectory = "";

export function setValidatedLMSRootDirectory(value: string): void {
  validatedLMSRootDirectory = value;
}

export function getValidatedLMSRootDirectory(): string {
  return validatedLMSRootDirectory;
}

export function setValidatedConversationRootDirectory(value: string): void {
  validatedConversationRootDirectory = value;
}

export function getValidatedConversationRootDirectory(): string {
  return validatedConversationRootDirectory;
}

export function setValidatedBackupsRootDirectory(value: string): void {
  validatedBackupsRootDirectory = value;
}

export function getValidatedBackupsRootDirectory(): string {
  return validatedBackupsRootDirectory;
}

// ============================================================
// Threshold Params Collection
// ============================================================

export interface ThresholdParamsCollection {
  tokenCount: number | null;
  contextLength: number | null;
  requestThresholdCleanup: boolean;
}

let thresholdParamsCollection: ThresholdParamsCollection = {
  tokenCount: null,
  contextLength: null,
  requestThresholdCleanup: false,
};

export function getThresholdParamsCollection(): ThresholdParamsCollection {
  return { ...thresholdParamsCollection };
}

export function setThresholdParamsCollection(
    updates: Partial<ThresholdParamsCollection>,
): void {
    thresholdParamsCollection = {
      ...thresholdParamsCollection,
      ...updates,
    };
}