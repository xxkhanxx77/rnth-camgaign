export const BOT_FLAGS_STORAGE_KEY = "renaiss-admin-bot-flags";

export type BotFlags = Record<string, true>;

export function getBotFlagKey(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export function readBotFlags(): BotFlags {
  try {
    const raw = window.localStorage.getItem(BOT_FLAGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BotFlags) : {};
  } catch {
    return {};
  }
}

export function writeBotFlags(flags: BotFlags): void {
  window.localStorage.setItem(BOT_FLAGS_STORAGE_KEY, JSON.stringify(flags));
}

export function isBotFlagged(username: string, flags: BotFlags): boolean {
  return Boolean(flags[getBotFlagKey(username)]);
}
