# Work Features #2 - June 15 public leaderboard update

**Date:** 2026-06-15

This file records the user-visible feature state after the Mar-May combined CSV update.

---

## Public dashboard - `/`

| Feature | Status | Notes / location |
| --- | --- | --- |
| Mar-May Season 0 source | Done | Public route loads only `public/renaiss_mar_may_2026_combined.csv` |
| Score-only leaderboard | Done | Table shows only `Rank`, `Account`, `Score` |
| Season switch removed | Done | Public page no longer switches between Season 0 / Season 1 |
| Public sort tabs removed | Done | Ranking is fixed to score |
| WE / Imp hidden | Done | No public reach-mix column |
| Posts column hidden | Done | Post count is not shown on the public leaderboard |
| Review / risk hidden | Done | No `High Risk`, `Risk`, `Flag`, or flag-count badges on public rows |
| Aggregate stat tiles hidden | Done | Removed total views, total likes, and ranked-author tiles from the landing view |
| Top-rank hero simplified | Done | Shows top account and score only |
| Search authors / tags | Done | Search remains available on the public leaderboard |

---

## Public profile - `/#u=<author_username>`

| Feature | Status | Notes / location |
| --- | --- | --- |
| Profile route | Done | Hash route still opens the selected author profile |
| Profile summary tiles | Done | Final score, views, likes, followers remain visible |
| Posting heatmap | Done | Heatmap remains visible and uses the same post data |
| Post cards | Done | Cards show date, hashtags, text, X link, and engagement metrics |
| Per-post score chip hidden | Done | Removed `Score ...` badge from post cards |
| Per-post cap chip hidden | Done | Removed `Cap 0.3x` badge from post cards |
| Post sorting | Done | Latest / Views / Likes sorting remains available |
| Download PNG | Done | Existing profile download button remains available |

---

## Admin dashboard - `/admin-renaiss`

| Feature | Status | Notes / location |
| --- | --- | --- |
| Mar-May combined admin source | Done | Admin Season 1 now uses `/renaiss_mar_may_2026_combined.csv` |
| Season 0 archive | Done | Admin keeps `/renaiss_season0.csv` as archive data |
| Internal review tools | Done | Eligibility, risk flags, bot flagging, and review context remain admin-only |
| Admin CSV download | Done | Button now downloads the Mar-May combined CSV |

---

## Shared / maintenance

| Feature | Status | Notes / location |
| --- | --- | --- |
| Avatar refresh source | Done | `npm run fetch:avatars` reads `public/renaiss_mar_may_2026_combined.csv` |
| Static build | Done | `npm run build` passes |
| Lint | Done | `npm run lint` passes |

---

## Current public display contract

The public leaderboard should stay limited to:

- Account
- Score

Rank is part of the row identity. Everything else from the scoring/review pipeline is internal
unless explicitly moved back into the public UI.
