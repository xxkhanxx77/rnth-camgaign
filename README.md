# Renaiss Ranking Dashboard

React dashboard for ranking Renaiss campaign authors from `public/renaiss_posts.csv`.
Authors are ranked by `views + likes` by default, with alternate sorting for views,
likes, and post count.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
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

Open the Vite URL shown in the terminal, usually:

```bash
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Data

The app loads campaign data from:

```bash
public/renaiss_posts.csv
```

Required CSV columns:

- `author_name`
- `author_username`
- `views`
- `likes`
- `replies`
- `reposts`
- `quotes`
- `url`

After replacing or updating the CSV, refresh the avatar cache before deploying.

## Fetch Avatars

Profile images are cached in:

```bash
src/data/avatars.json
```

Regenerate the cache from `public/renaiss_posts.csv`:

```bash
npm run fetch:avatars
```

The script reads every unique `author_username`, requests the profile image from
Nitter RSS, and writes the image URL map to `src/data/avatars.json`.

If a profile image is not available from Nitter, the app falls back at runtime to:

```text
https://unavatar.io/x/{author_username}
```

This keeps new or missing users from showing as initials only when Unavatar can
resolve the X profile.

## Deploy

For static hosts such as Vercel, Netlify, or Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18 or newer

Recommended deployment flow after a CSV update:

```bash
npm install
npm run fetch:avatars
npm run build
```
