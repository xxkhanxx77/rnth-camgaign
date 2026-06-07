# Renaiss Ranking Dashboard

A static React dashboard that ranks Renaiss campaign authors from scraped X (Twitter) data.
It has **two faces from one bundle**, chosen by URL:

- **Public** (`/`) — a clean leaderboard and per-author profile pages. No internal scoring
  signals; official and bot-flagged accounts are hidden.
- **Admin** (`/admin-renaiss`) — the full internal view: eligibility, review/risk flags, bot
  flagging, and campaign payouts.

Authors are ranked by the **Stage 4** score (with sort options for Views, Likes, and Posts).
Click any author to open a profile with their headline stats, a posting **activity heatmap**, a
post history, and a **Download** button that exports the profile as a branded PNG.

> 📚 **Maintainer docs:** start with
> [`work_architecture/work_architecture_1.md`](work_architecture/work_architecture_1.md) for the
> mental model, [`work_features/work_features_1.md`](work_features/work_features_1.md) for what
> exists, and [`work_progress/work_progress_1.md`](work_progress/work_progress_1.md) for the
> latest change log.

## Stack

- Vite · React · TypeScript
- Tailwind CSS (custom "glass" classes + `oklch` tokens)
- TanStack Query
- shadcn-style UI primitives

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173/`).

## Build

```bash
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build
```

## Routes

| URL | Purpose |
| --- | --- |
| `/` | Public leaderboard |
| `/#u={author_username}` | Public author profile (e.g. `/#u=nopzty`) |
| `/admin-renaiss` | Internal admin dashboard |

## Data

The app is client-only; all data ships as static files in `public/` and is fetched at runtime.

| File | Used by | Purpose |
| --- | --- | --- |
| `public/renaiss_season0.csv` | public + admin | Season 0 posts (archive, before Jun 1 2026) |
| `public/renaiss_posts.csv` | public + admin | Season 1 posts (filtered to ≥ Jun 1 2026) |
| `public/renaiss_profile_mar_may_2026.csv` | public + admin | Per-author profile (followers, baselines) |
| `public/renaiss_profile_mar_may_2026_prior_posts.csv` | public + admin | Prior-post history for baselines |
| `public/renaiss_th_Tier_C_Protection.csv` | admin | Campaign participants / payouts |
| `public/renaiss_tweet.json` | admin | Optional raw tweet payload |

Post CSV columns used: `id`, `url`, `description`, `author_name`, `author_username`,
`created_at`, `replies`, `reposts`, `quotes`, `likes`, `views`, `hashtags`.

## Author profile pages

Profiles are hash routes (`/#u={author_username}`) rendered from the same CSV data:

- avatar, name, rank, and `Stage 4` badge
- four headline tiles: **Final Score · Views · Likes · Followers**
- a posting **heatmap** (GitHub-style, focused on the active posting window)
- post cards (sort by latest / views / likes) linking to the original X status
- a **Download** button that exports the profile as a PNG (`src/lib/proofCard.ts`)

When a profile is open, the landing hero, season toggle, and aggregate tiles are hidden so the
page focuses on the profile.

## Hiding rules (public only)

- **Official accounts** (`@RenaissTwCM`, `@Renaiss_TH`, …) are hidden from the public leaderboard
  and shown with an "Official" badge in admin. Edit the list in
  `src/lib/renaissOfficialAccounts.ts`.
- **Bot-flagged accounts** (flagged in `/admin-renaiss`, stored in `localStorage`) are hidden
  from the public leaderboard and sync live across tabs. See `src/lib/renaissBotFlags.ts`.

## Fetch Avatars

Profile images are cached in `src/data/avatars.json`. Regenerate from the post CSV:

```bash
npm run fetch:avatars
```

The script reads each unique `author_username`, fetches the profile image, and writes the URL
map. Missing avatars fall back at runtime to `https://unavatar.io/x/{author_username}`.

## Deploy

For static hosts (Vercel, Netlify, Cloudflare Pages):

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18 or newer

Recommended flow after a CSV update:

```bash
npm install
npm run fetch:avatars
npm run build
```
