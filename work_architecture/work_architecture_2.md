# Work Architecture #2 - Mar-May score-only public leaderboard

**Date:** 2026-06-15
**Audience:** A maintainer updating the public Renaiss ranking data or display.

---

## 1. What changed today

The public dashboard now treats the Mar-May 2026 combined CSV as the only public Season 0
source. The public leaderboard is intentionally score-only: users see rank, account, and score.
Internal context such as WE / impressions, post counts, review status, risk labels, and flag
counts is no longer rendered on the public leaderboard.

The author profile route (`/#u=<author_username>`) still shows profile summary, heatmap, post
cards, and engagement counts. Per-post score chips and post-cap chips are hidden because they are
internal scoring details.

---

## 2. Public data path

```
/renaiss_mar_may_2026_combined.csv
        │
        ▼
loadPosts() in src/App.tsx
        │
        ▼
aggregateAuthors(...)
        │
        ▼
rankAuthors(..., "score")
        │
        ▼
Public leaderboard: Rank / Account / Score
```

Public `loadPosts()` no longer fetches:

- `/renaiss_posts.csv`
- `/renaiss_season0.csv`
- `/renaiss_profile_mar_may_2026.csv`
- `/renaiss_profile_mar_may_2026_prior_posts.csv`

The public route still passes an empty profile map so existing profile/detail code paths can keep
using the same types without requiring profile/baseline CSVs.

---

## 3. Admin data path

The admin dashboard still loads the extra internal context needed for review and operations:

- `/renaiss_mar_may_2026_combined.csv` for the current Season 1 admin view.
- `/renaiss_season0.csv` for the Season 0 archive view.
- `/renaiss_profile_mar_may_2026.csv` and
  `/renaiss_profile_mar_may_2026_prior_posts.csv` for followers, baselines, and eligibility.
- `/renaiss_th_Tier_C_Protection.csv` and `/renaiss_tweet.json` for campaign/payout context.

The old June 1 filter was removed from the admin Season 1 load because the selected source is now
already the intended Mar-May combined dataset.

---

## 4. Display boundaries

Public leaderboard (`/`):

- Shows: rank, account, score.
- Hides: WE / Imp, posts, review labels, risk labels, flag counts, aggregate tiles, and sort tabs.

Public profile (`/#u=<username>`):

- Shows: final score summary, views, likes, followers, heatmap, post cards, and engagement counts.
- Hides on post cards: `Score ...` and `Cap 0.3x` badges.

Admin (`/admin-renaiss`):

- Keeps internal scoring, eligibility, review, risk, and flagging UI.

---

## 5. Files changed in this update

| File | Role |
| --- | --- |
| `public/renaiss_mar_may_2026_combined.csv` | New public/admin Mar-May post dataset |
| `src/App.tsx` | Public data loading and score-only display |
| `src/AdminRenaiss.tsx` | Admin Mar-May source alignment |
| `scripts/fetch-avatars.mjs` | Avatar refresh now reads the Mar-May combined CSV |
| `README.md` | Data file table updated |
| `work_architecture/work_architecture_1.md` | Existing architecture notes updated to match current source |

---

## 6. Verification

Run:

```bash
npm run build
npm run lint
```

Manual checks:

- `/` loads Season 0 from `/renaiss_mar_may_2026_combined.csv`.
- The public leaderboard header is exactly `Rank`, `Account`, `Score`.
- `/#u=0xKuromon` post cards do not show `Score ...` or `Cap 0.3x` chips.
- Browser console only shows the standard React DevTools development info message.
