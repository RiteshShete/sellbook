# Sellbook

Private, owner-only order and sales app (mobile-first PWA). See `docs/PLAN.md` for the full design and
`CLAUDE.md` for project rules. This repo is currently at the **scaffold** stage: app shell, helpers and
placeholder pages only (no database or features yet).

## Run it

Requires Node 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase URL and anon key
npm run dev                    # serves on your local network
```

`npm run dev` binds to all interfaces. Vite prints a `Network:` URL (e.g. `http://192.168.x.x:5173/`);
open it on your phone while it is on the same Wi-Fi. Allow Node through the Windows firewall if prompted.

Without `.env.local` the app shows a "Configuration missing" screen instead of starting. Use the anon key
only; never put any secret or admin key anywhere in this repo.

## Scripts

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Vite dev server on the local network                              |
| `npm run build`     | Typecheck, then production build to `dist/`                       |
| `npm run preview`   | Serve the production build on the local network                   |
| `npm run typecheck` | `tsc -b --noEmit` (strict)                                        |
| `npm run lint`      | ESLint                                                            |
| `npm run test`      | Vitest (runs under a non-IST timezone on purpose)                 |
| `npm run format`    | Prettier                                                          |
| `npm run check`     | secret scan + typecheck + lint + test + build (run before "done") |

## Deploy

Cloudflare Pages: build command `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. `public/_redirects` provides the SPA fallback.
