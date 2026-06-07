# Work Features #1 — What the app does today

**Date:** 2026-06-07

A checklist-style inventory of current features, where each lives, and its status.
Status legend: ✅ done · 🟡 partial / has caveats.

---

## Public dashboard — `/` (`src/App.tsx`)

| Feature | Status | Notes / location |
| --- | --- | --- |
| Author leaderboard | ✅ | Ranked by Stage-4 score; sort by Score / Views / Likes / Posts |
| Season switch (Season 0 / Season 1) | ✅ | Season 0 = archive (pre Jun 1 2026); Season 1 = ≥ Jun 1 2026 |
| Search authors / tags | ✅ | Client-side filter on name, handle, top tag |
| Aggregate stat tiles | ✅ | Total Views / Total Likes / Ranked Authors (landing only) |
| Top-rank hero card | ✅ | Highlights #1 author with score + views |
| Author profile page | ✅ | Hash route `/#u=<username>` |
| Profile: 4 hero-style stat tiles | ✅ | Final Score · Views · Likes · Followers |
| Profile: posting **heatmap** | ✅ | `components/PostingHeatmap.tsx`; full-width, season-focused, responsive |
| Profile: post cards (sort latest/views/likes) | ✅ | Links to original X status |
| Profile: **Download as PNG** | 🟡 | `lib/proofCard.ts`; avatar embeds only if its host allows CORS, else initials |
| Focused profile view | ✅ | Hero / season toggle / aggregate tiles hidden while a profile is open |
| Hide internal scoring signals | ✅ | No Eligible/Hold, no risk flags, no CSV/Post buttons on public |
| Hide **official** accounts | ✅ | `lib/renaissOfficialAccounts.ts` (`@RenaissTwCM`, `@Renaiss_TH`, …) |
| Hide **bot-flagged** accounts | ✅ | Reads admin bot flags; live-syncs via `storage` event |

## Admin dashboard — `/admin-renaiss` (`src/AdminRenaiss.tsx`)

| Feature | Status | Notes / location |
| --- | --- | --- |
| Full leaderboard with internal signals | ✅ | Eligibility, review/risk flags, raw vs final score |
| Review / risk flags per account & post | ✅ | From `getRenaissRiskFlags` / `summarizeRenaissRiskFlags` |
| **Bot flagging** (toggle) | ✅ | Persists to `localStorage` (`renaiss-admin-bot-flags`); zeroes the account's score |
| **Official** badge | ✅ | Official accounts stay visible and are labelled |
| Sort / paginate accounts | ✅ | Rank, score, review, bot-first, posts, impressions, name |
| Campaigns tab (payouts) | ✅ | From `renaiss_th_Tier_C_Protection.csv` + optional `renaiss_tweet.json` |
| Account detail panel | ✅ | Per-account posts, flags, baseline, eligibility reasons |

## Shared / platform

| Feature | Status | Notes / location |
| --- | --- | --- |
| Stage-4 scoring engine | ✅ | `lib/renaissScoring.ts` (tiers, WER, reach/impression norms, post cap) |
| Eligibility gate | ✅ | followers ≥ 1,000 **and** prior posts ≥ 10 |
| CSV parsing | ✅ | `lib/csv.ts` |
| Shared heatmap/calendar logic | ✅ | `lib/renaissCalendar.ts` (used by both the UI and the PNG) |
| Avatar resolution | ✅ | `data/avatars.json` + `unavatar.io` fallback; `npm run fetch:avatars` |
| Glass design system | ✅ | `index.css` + `tailwind.config.js` (oklch tokens, Archivo/Geist) |
| Static build | ✅ | `npm run build` → `dist/` |

---

## Configuration knobs (edit these to change behavior)

- **Official accounts:** `RENAISS_OFFICIAL_ACCOUNTS` in `src/lib/renaissOfficialAccounts.ts`
- **Bot flags storage key:** `BOT_FLAGS_STORAGE_KEY` in `src/lib/renaissBotFlags.ts`
- **Eligibility thresholds:** `evaluateRenaissEligibility` in `src/lib/renaissScoring.ts`
- **Score weights / tiers / post cap:** `calculateRenaissStage4PostScore` + `getRenaissTier`
- **Season boundary:** `seasonOneStart` (`App.tsx`) / `SEASON_ONE_START` (`AdminRenaiss.tsx`)
- **Data file paths:** `loadPosts` (`App.tsx`) and `loadAdminData` (`AdminRenaiss.tsx`)

## Not built / out of scope (today)

- No backend / no auth on `/admin-renaiss` (it's URL-only; bot flags are per-browser).
- No automated tests yet.
- Heatmap shows one focused window per year tab (not a fixed Jan–Dec grid) — intentional.
