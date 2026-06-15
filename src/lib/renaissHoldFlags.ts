import { getBotFlagKey } from "./renaissBotFlags";

export const HOLD_FLAGS_STORAGE_KEY = "renaiss-admin-hold-flags";

// Manual admin holds. The key matches the bot-flag key (normalized username),
// so a single normalized handle drives both the bot flag and the hold flag.
export type HoldFlags = Record<string, true>;

export function getHoldFlagKey(username: string): string {
  return getBotFlagKey(username);
}

export function readHoldFlags(): HoldFlags {
  try {
    const raw = window.localStorage.getItem(HOLD_FLAGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HoldFlags) : {};
  } catch {
    return {};
  }
}

export function writeHoldFlags(flags: HoldFlags): void {
  window.localStorage.setItem(HOLD_FLAGS_STORAGE_KEY, JSON.stringify(flags));
}

export function isHeld(username: string, flags: HoldFlags): boolean {
  return Boolean(flags[getHoldFlagKey(username)]);
}
