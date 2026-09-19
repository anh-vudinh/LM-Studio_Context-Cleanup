import { createConfigSchematics } from "@lmstudio/sdk";

export const configSchematics = createConfigSchematics()
  .field(
    "contextCleanup",
    "boolean",
    {
      displayName: "Cleanup Context?",
      hint: "ON or OFF context cleanup. Must be enabled to use plugin.",
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
    1
  )
  .field(
    "cleanupThinkingOnly",
    "boolean",
    {
      displayName: "OVERRIDE: Cleanup Thinking Context Only",
      warning: "Only cleans the thinking tokens. All extra cleanups provided by default are ignored.",
      hint: "Default Cleanups for past messages: Thinking | System prompt | Jinja | Tools | Preprocessed.",
    },
    false
  )
  .field(
    "keepAllMessages",
    "boolean",
    {
      displayName: "OVERRIDE: Cleanup But Keep All Messages",
      warning: "All messages will be kept after cleanup. This ignores the truncation system.",
    },
    false
  )
  .field(
    "createBackup",
    "boolean",
    {
      displayName: "EXTRA: Create Backup Before Cleanup",
      warning: "Backup saved in .lmstudio\\conversation-backup folder.",
    },
    false
  )
  .build();