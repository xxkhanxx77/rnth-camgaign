# Work Progress #2 - Mar-May CSV and score-only public view

**Date:** 2026-06-15
**Area:** Public dashboard (`src/App.tsx`), admin source config (`src/AdminRenaiss.tsx`), static data

---

## Summary

Today's work replaced the public leaderboard source with the Mar-May 2026 combined CSV and reduced
the public display to the information the user asked for: account ranking by score. The public
leaderboard no longer shows flags, review labels, posts, WE / impressions, or other internal
context.

The author detail cards were also cleaned up so individual posts no longer show the internal
`Score ...` or `Cap 0.3x` badges.

---

## Changes completed

### 1. Public data source

- Added `public/renaiss_mar_may_2026_combined.csv`.
- Updated public `loadPosts()` to fetch only `/renaiss_mar_may_2026_combined.csv`.
- Removed public fetches for profile and prior-post baseline CSVs.
- Updated `scripts/fetch-avatars.mjs` so avatar refresh reads the same Mar-May combined CSV.

### 2. Public leaderboard simplification

- Removed Season 0 / Season 1 switch from the public page.
- Fixed public ranking to score.
- Removed public sort controls.
- Removed public aggregate tiles.
- Changed the table to three visible columns: `Rank`, `Account`, `Score`.
- Removed WE / Imp, Posts, Review, Risk, High Risk, Flag, and flag-count displays from public rows.

### 3. Public profile cleanup

- Kept the profile route, summary tiles, heatmap, post sort controls, X links, and engagement
  metrics.
- Removed per-post `Score ...` badges.
- Removed per-post `Cap 0.3x` badges.

### 4. Admin source alignment

- Updated admin Season 1 to read `/renaiss_mar_may_2026_combined.csv`.
- Removed the old June 1 filter from the admin Season 1 load.
- Updated the admin CSV download button label/source to the Mar-May combined CSV.

### 5. Documentation

- Updated README data-source notes.
- Updated architecture notes to describe the new public source and score-only display.
- Added this `_2` progress document plus matching `_2` architecture and feature notes.

---

## Verification performed

Commands:

```bash
npm run build
npm run lint
```

Browser checks:

- Opened `http://localhost:5173/`.
- Confirmed the public leaderboard shows only `Rank`, `Account`, and `Score`.
- Confirmed the top visible rows are sourced from the Mar-May combined CSV.
- Opened `http://localhost:5173/#u=0xKuromon`.
- Confirmed post cards no longer display `Score ...` or `Cap 0.3x`.

---

## Git status of this work

The implementation was committed and pushed to `origin/dev`:

```text
fb76776 feat: use Mar-May Renaiss leaderboard data
```

One local file remained modified and was intentionally not included in that commit:

```text
src/data/avatars.json
```

That file was already dirty and unrelated to the frontend/data-source change.
