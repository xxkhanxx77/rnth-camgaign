import { normalizeRenaissUsername } from "./renaissScoring";

export const RENAISS_OFFICIAL_ACCOUNTS = [
  "RenaissTwCM",
  "Renaiss_TH",
] as const;

const OFFICIAL_SET = new Set(
  RENAISS_OFFICIAL_ACCOUNTS.map((handle) => normalizeRenaissUsername(handle)),
);

export function isRenaissOfficialAccount(username: string): boolean {
  return OFFICIAL_SET.has(normalizeRenaissUsername(username));
}
