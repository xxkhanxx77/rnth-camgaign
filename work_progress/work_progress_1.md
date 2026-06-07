# Work Progress #1 — Public/Admin split, hiding rules, profile heatmap & share card

**Date:** 2026-06-07
**Area:** Public dashboard (`src/App.tsx`) + Admin dashboard (`src/AdminRenaiss.tsx`) + shared libs

This document explains, in plain language, everything that changed in this round of work
and *why*. It's written for a maintainer who has never seen the codebase.

---

## TL;DR

The app has **two faces** that share the same data and scoring code:

| Route | Who it's for | What it shows |
| --- | --- | --- |
| `/` | The public | A clean leaderboard + per-author profile pages. No internal scoring details. |
| `/admin-renaiss` | Internal team | Everything: eligibility, review/risk flags, bot flagging, campaign payouts. |

This round (1) moved all the "internal" signals off the public page into admin-only,
(2) added rules to hide official + bot accounts from the public, (3) added a GitHub-style
posting **heatmap** to profile pages, (4) added a **Download** button that exports a profile
as a branded PNG, and (5) made the profile page focused and responsive.

---

## What changed, grouped by intent

### 1. Public page no longer leaks internal scoring signals
Previously the public leaderboard and profile showed "Eligible/Hold" badges, "Review flags",
plus a `CSV` download and a `Post` (share to X) button in the header.

- Removed from the public UI: eligibility badges, risk/flag badges, "Review flags" tiles,
  the "Eligible authors" / "Gate reason" facts, per-post flag detail boxes, and the header
  `CSV` + `Post` buttons.
- All of this **still exists on `/admin-renaiss`** unchanged.

### 2. Official accounts are hidden from the public, badged in admin
Brand/official handles (e.g. `@RenaissTwCM`, `@Renaiss_TH`) should not compete on the public
leaderboard, but the team should still see them.

- New constant list + helper: **`src/lib/renaissOfficialAccounts.ts`**
  (`RENAISS_OFFICIAL_ACCOUNTS`, `isRenaissOfficialAccount()`).
- Public (`App.tsx`): official accounts are filtered out before ranking/totals.
- Admin (`AdminRenaiss.tsx`): official accounts stay visible and get an **"Official"** badge.
- **To add more official accounts later:** just append to the array in that one file.

### 3. Bot flagging in admin now affects the public page
The admin can flag an account as a bot (the flag persists in `localStorage`). That flag now
also hides the account from the public leaderboard.

- New shared module: **`src/lib/renaissBotFlags.ts`** (single source of truth for the
  storage key, read/write, and `isBotFlagged()`). Admin's old private copies were removed and
  both pages now import from here.
- Public page reads bot flags on load and filters flagged accounts out. It also listens to the
  browser `storage` event, so flagging an account in an admin tab updates the public tab live.

### 4. Posting activity heatmap on profile pages
Each profile now shows a GitHub-style contribution calendar built from that author's real post
timestamps.

- New component: **`src/components/PostingHeatmap.tsx`**.
- New shared pure logic: **`src/lib/renaissCalendar.ts`** (day bucketing, week building, month
  labels). The on-screen heatmap and the downloadable card use the *same* module so they always
  match.
- It **focuses on the active posting window** (e.g. Mar–May for the Season 0 archive) instead of
  rendering an empty full year, and is **fluid/full-width + responsive** (cells flex to fill the
  card; height scales with `clamp()`).
- Heat levels use the renaiss **orange** brand scale (not GitHub green).

### 5. Profile page simplified to the essentials
The per-author page had too many internal metrics for a public viewer.

- Removed: `WE total`, `Prior posts`, `Baseline max`, `Indexed posts`, `Top post score`,
  `Latest`, `Soft-capped`, `Gate reason`.
- Replaced with four clean hero-style stat tiles (orange icon squares): **Final Score · Views ·
  Likes · Followers**, matching the landing page's visual language.

### 6. "Download" = a branded PNG of the profile
The Download button renders the profile as a shareable image.

- New module: **`src/lib/proofCard.ts`** — draws on an offscreen `<canvas>` (no extra
  dependency): light glass background + grid, header (avatar, name, `@handle · #tag · N posts`,
  rank), the four stat tiles, and the full heatmap + legend.
- We draw it by hand (not a DOM-screenshot library) on purpose: the theme's `oklch()` colors and
  glass `backdrop-filter` don't survive html-to-image/html2canvas, and cross-origin avatars taint
  those exports. Canvas gives a reliable, on-brand result every time; the avatar falls back to an
  initials tile if its host blocks CORS.

### 7. Focused, responsive profile view
- When a profile is open, the landing **hero**, **season toggle**, and **aggregate stat tiles**
  are hidden so the page opens straight onto the profile. "Back to leaderboard" restores them.
- The header's **Download** and **Open X profile** buttons now stay on one line on desktop
  (the right column auto-sizes; buttons `lg:flex-nowrap`).

---

## Files touched

**Added**
- `src/lib/renaissOfficialAccounts.ts` — official-handle list + lookup
- `src/lib/renaissBotFlags.ts` — shared bot-flag storage/helpers
- `src/lib/renaissCalendar.ts` — pure heatmap/calendar logic (shared)
- `src/components/PostingHeatmap.tsx` — heatmap UI
- `src/lib/proofCard.ts` — canvas "download as PNG" renderer

**Changed**
- `src/App.tsx` — public dashboard: hiding rules, simplified profile, heatmap, download, focused view
- `src/AdminRenaiss.tsx` — uses shared bot-flag lib, adds "Official" badge
- `src/index.css` — fluid heatmap styles (`.streak-block`, `.heatmap-*`)
- `README.md`, `.gitignore` (ignore `output/` QA screenshots)

> Note: several core files (`src/AdminRenaiss.tsx`, `src/lib/csv.ts`, `src/lib/renaissScoring.ts`)
> and two data CSVs were untracked before this commit and are now committed for the first time.

---

## How to run / verify

```bash
npm install
npm run dev        # open the printed URL (e.g. http://localhost:5173/)
npm run build      # tsc + vite build, used as the type/compile check
```

- Public leaderboard: `/`
- A profile: `/#u=<author_username>` (e.g. `/#u=nopzty`)
- Admin: `/admin-renaiss`

Manual checks worth doing:
- Public page shows **no** Eligible/Flags badges; official + bot-flagged accounts are absent.
- Open a profile → hero/season/totals hidden, heatmap fills the width, Download saves a PNG.
- Flag an account in `/admin-renaiss`, then reload `/` → that account is gone.

## Known limitations / follow-ups
- Bot flags live in `localStorage` (per-browser), not a server — see [work_architecture_1](../work_architecture/work_architecture_1.md).
- Downloaded avatar depends on the image host allowing CORS; otherwise it renders initials.
- Heatmap cells become wider-than-tall on very wide screens with few weeks (by design, to fill width).
