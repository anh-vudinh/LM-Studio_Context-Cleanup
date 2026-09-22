import { createConfigSchematics } from "@lmstudio/sdk";

const lockFileOwnership = new Map<string, boolean | null>();

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
    3
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
    "cleanupThinkingOnly",
    "boolean",
    {
      displayName: "OVERRIDE: Cleanup Thinking Context Only",
      warning: "Only cleans the thinking tokens. All extra cleanups provided by default are ignored.",
      hint: "Cleanups for past messages: | Thinking |",
    },
    false
  )
  .field(
    "keepAllThinking",
    "boolean",
    {
      displayName: "OVERRIDE: Keep all thinking tokens",
      warning: "Cleanup but keeps all the thinking tokens.",
      hint: "Cleanups for past messages: | System prompt | Jinja | Tools | Preprocessed |",
    },
    false
  )
  .field(
    "createBackup",
    "boolean",
    {
      displayName: "EXTRA: Maintain an Uncleaned Backup",
      warning: "Backup saved in .lmstudio\\conversations-backup folder.",
      hint: "A the moment of enabling creates an exact copy. Subsequent backups only maintain the copy by append in your latest user/assistant turn. "
    },
    false
  )
  .build();

export function setLockFileOriginatesFromThisPlugin(
    lockFile: string,
    value: boolean | null,
): void {
    lockFileOwnership.set(lockFile, value);
}

export function getLockFileOriginatesFromThisPlugin(
    lockFile: string,
): boolean | null {
    return lockFileOwnership.get(lockFile) ?? null;
}