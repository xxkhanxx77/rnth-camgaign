# Work Architecture #1 — How the Renaiss dashboard is put together

**Date:** 2026-06-07
**Audience:** A maintainer who needs the mental model before changing code.

---

## 1. One-paragraph overview

This is a **static, client-only React app**. There is no backend. All data ships as CSV/JSON
files in `public/`, is fetched in the browser, parsed, scored, aggregated, and rendered. The
same bundle serves **two dashboards** chosen by URL path: a clean **public** dashboard (`/`) and
an internal **admin** dashboard (`/admin-renaiss`). They share the scoring and data-parsing
libraries so the numbers always agree.

---

## 2. Stack

- **Vite** (build/dev server) · **React 18** · **TypeScript**
- **Tailwind CSS** (+ custom "glass" component classes in `src/index.css`, `oklch` color tokens
  in `tailwind.config.js`)
- **TanStack Query** (`useQuery`) for fetch + cache of the CSVs (`staleTime: Infinity` — load once)
- shadcn-style UI primitives in `src/components/ui/*`
- Fonts: **Archivo** (display) + **Geist Variable** (body), via `@fontsource`

---

## 3. Routing model (no router library)

```
index.html → src/main.tsx → <App/>
                               │
        window.location.pathname === "/admin-renaiss" ?
                               │
              ┌────────────────┴─────────────────┐
              ▼                                    ▼
   AdminRenaissDashboard               PublicRenaissDashboard
   (src/AdminRenaiss.tsx)              (src/App.tsx)
                                          │
                          hash "#u=<username>" selects a profile
                          (history.pushState + hashchange listener)
```

- **Path** picks the dashboard (`App.tsx` top of `App()`).
- **Hash** (`#u=<author_username>`) picks the open profile inside the public dashboard.
- Changing/clearing the hash is done with `history.pushState` + a `hashchange`/`popstate`
  listener that syncs React state.

---

## 4. Data flow

```
public/*.csv ──fetch()──► parseCsv<T>()  ──► createRenaissProfileMap()
 (TanStack Query)         (src/lib/csv.ts)    (src/lib/renaissScoring.ts)
        │                                              │
        ▼                                              ▼
  raw post rows ───────────► scorePost / aggregateAuthors ───────────► ranked authors
                              (Stage-4 formula + eligibility + flags)        │
                                                                             ▼
                                            Public filters out official + bot accounts
                                                                             │
                                                                             ▼
                                                       Leaderboard / Profile / Heatmap / PNG
```

**Files the public app loads** (`loadPosts` in `App.tsx`):
- `/renaiss_season0.csv` → **Season 0** (archive, before Jun 1 2026)
- `/renaiss_posts.csv` → **Season 1** (filtered to ≥ Jun 1 2026)
- `/renaiss_profile_mar_may_2026.csv` + `/renaiss_profile_mar_may_2026_prior_posts.csv`
  → per-author profile (followers, baseline max, prior-post history)

**Extra files the admin app loads** (`loadAdminData` in `AdminRenaiss.tsx`):
- `/renaiss_th_Tier_C_Protection.csv` → campaign participants/payouts
- `/renaiss_tweet.json` → optional raw tweet payload (loaded best-effort)

---

## 5. The scoring pipeline (`src/lib/renaissScoring.ts`)

This is the heart of the app. Key exports:

- `getRenaissPostMetrics(row)` — normalizes a CSV row into metrics and computes
  **weighted engagement (WE)** = `replies*5 + reposts*4 + quotes*4 + bookmarks*2 + likes`.
- `calculateRenaissStage4PostScore({ metrics, followers, lifetimeIndex })` — the **Stage 4**
  score: follower **tier** (0–6), **WER%** (WE relative to followers), log-scaled reach +
  impression components, and a **post cap** (`0.3x` for posts beyond the author's 30th lifetime
  post).
- `evaluateRenaissEligibility(profile)` — eligible when `followers ≥ 1,000` **and**
  `prior posts ≥ 10`.
- `getRenaissRiskFlags(...)` / `summarizeRenaissRiskFlags(...)` — ratio-based anomaly flags
  (like-ratio, ERI, repost concentration, baseline spike) → yellow/red severity.
- `createRenaissProfileMap(...)` — keys profiles by `normalizeRenaissUsername` and derives
  baseline max WE/impressions from prior posts.

**Where score becomes the public number:**
- Public (`aggregateAuthors`): `score = eligible ? rawScore : 0`.
- Admin (`buildSeasonBoard`): `score = rawScore × (botFlagged || !eligible ? 0 : 1)` — i.e.
  admins can additionally zero out an account by flagging it as a bot.

---

## 6. Module map (`src/`)

| File | Responsibility |
| --- | --- |
| `main.tsx` | React root; mounts `<App/>` with the TanStack Query provider |
| `App.tsx` | **Public** dashboard: routing switch, leaderboard, profile detail, heatmap mount, download trigger, hiding rules |
| `AdminRenaiss.tsx` | **Admin** dashboard: seasons, review/risk flags, bot flagging, campaign payouts |
| `lib/csv.ts` | Minimal CSV parser → array of typed records |
| `lib/renaissScoring.ts` | Metrics, Stage-4 score, eligibility, risk flags, profile map |
| `lib/renaissCalendar.ts` | **Pure** heatmap logic (shared by component + PNG): day counts, week building, month labels |
| `lib/renaissOfficialAccounts.ts` | `RENAISS_OFFICIAL_ACCOUNTS` constant + `isRenaissOfficialAccount()` |
| `lib/renaissBotFlags.ts` | `localStorage` bot-flag store + `isBotFlagged()` (shared by both dashboards) |
| `lib/proofCard.ts` | Canvas renderer that exports a profile as a branded PNG |
| `lib/utils.ts` | `cn()` class merge helper |
| `components/PostingHeatmap.tsx` | The on-screen activity heatmap |
| `components/ui/*` | Button / Badge / Input primitives |
| `data/avatars.json` | Cached avatar URL map (see `scripts/fetch-avatars.mjs`) |
| `index.css` | Tailwind layers + glass classes + heatmap styles |

---

## 7. Cross-cutting concerns

- **Hiding rules (public only).** Authors are dropped from the public leaderboard when
  `isRenaissOfficialAccount(handle)` **or** `isBotFlagged(handle, flags)` is true. Admin shows
  everything.
- **Persistence.** Bot flags are stored in `localStorage` under
  `renaiss-admin-bot-flags`. The public page mirrors changes live via the `storage` event.
  *There is no server*, so flags are per-browser; for a shared source of truth this would need a
  backend or a committed config file.
- **Avatars.** Resolved from `src/data/avatars.json`, falling back to
  `https://unavatar.io/x/<handle>` at runtime. Regenerate the cache with `npm run fetch:avatars`.
- **Styling system.** Colors are `oklch` CSS variables (`:root` in `index.css`) surfaced to
  Tailwind in `tailwind.config.js`. The frosted "glass" look (`.glass-panel/.glass-control`)
  uses `backdrop-filter`. This is why the PNG export is hand-drawn on canvas rather than captured
  from the DOM (see `lib/proofCard.ts`).

---

## 8. Build & deploy

```bash
npm run build     # tsc -b && vite build  → dist/
npm run preview   # serve the production build locally
```

Static host (Vercel / Netlify / Cloudflare Pages):
- Build command: `npm run build`
- Output dir: `dist`
- Node 18+

After updating the CSVs, re-run `npm run fetch:avatars` then `npm run build` before deploying.

---

## 9. Gotchas for the next maintainer

- **Two dashboards, one bundle.** A change to a shared lib affects both `/` and `/admin-renaiss`.
- **Username keying is normalized** (`normalizeRenaissUsername`: trim, strip leading `@`,
  lowercase). Always compare via the helpers, never raw strings.
- **Season 1 is date-filtered** to `≥ 2026-06-01`; Season 0 is the raw archive CSV.
- **Heatmap logic lives once** in `lib/renaissCalendar.ts` — change it there and both the
  on-screen grid and the PNG update together.
