# Three Studies — PIP · INK STUDY · TABLE

Three mobile web betas built from their PRDs (P0 main lines), behind one entry page.
On a desktop each app runs inside a drawn iPhone frame; on a real phone it runs full screen.

| Path | App | PRD |
| --- | --- | --- |
| `/` | Home screen with the three app icons | — |
| `/pip/` | PIP pixel pet | 01-Pixel-Pet-PRD |
| `/ink/` (+ `/ink/ar`) | INK STUDY tattoo try-on | 02-AR-Tattoo-PRD |
| `/table/` | TABLE party games | 03-Party-Games-PRD |

No build step and no npm dependencies: static HTML/CSS/JS plus Vercel Node functions in `api/`.

## Server pieces (Vercel functions)

- `api/ai.js` — narrow, validated model calls (pet reply, pet photo → whitelisted layers, tattoo consultation questions, game-fit explanations). Needs `ANTHROPIC_API_KEY`. Optional `AI_MODEL` (default `claude-haiku-4-5`).
- `api/room.js` — TABLE rooms. Server-authoritative engine (`shared/games.js`), per-player views, action ids, versions, deadlines, host hand-off. Needs Upstash Redis: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_URL` / `KV_REST_API_TOKEN` names Vercel's Upstash integration creates).
- `api/feedback.js` — TABLE problem reports (same Redis).
- `api/health.js` — tells the UI which of the above are configured.

Without these env vars the apps still run and say so honestly: PIP marks fallback replies as “Simple response · not AI”, INK keeps the hand-written question path, TABLE offers shared-phone mode and rule-based ranking.

## Enable the live services on Vercel

1. Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`.
2. Project → Storage (Marketplace) → add **Upstash for Redis** and connect it to this project (it injects the KV env vars).
3. Redeploy.

## Local development

```bash
node scripts/dev-server.js   # http://localhost:3000, with an in-memory Redis stand-in
```

Camera, microphone and live AR need HTTPS on phones — test those on the Vercel URL.

## What is deliberately not here (per the PRDs)

P1/P2 items are hidden rather than shown as dead buttons: PIP room decorating, second pet, notifications; INK artist directory, requests, share links, practice workbench; TABLE board game, big-screen mode, commercial titles. Live AR is marker-based (printed Hiro card) on flat-ish areas only; change studies are illustrations, not predictions.
