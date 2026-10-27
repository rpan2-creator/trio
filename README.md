# Three Studies — PIP · INK STUDY · TABLE

Three mobile web betas built from their PRDs (P0 main lines), behind one entry page.
On a desktop each app runs inside a drawn iPhone frame; on a real phone it runs full screen.

| Path | App | What it is |
| --- | --- | --- |
| `/` | Home screen | Phone home screen with the three app icons + QR to open on a phone |
| `/pip/` | PIP | Gamified pixel pet: endless procedural species, egg hatching, feed/bath/fetch/tricks/dress-up, 3 mini-games, shop, quests, levels |
| `/ink/` | INK STUDY | Simulated AR tattoo try-on on a WebGL 3D arm/calf, 20 original flash designs, Tattoo Builder, 0–20 year aging timeline, consultation pack |
| `/table/` | TABLE | Game night on one phone: Crazy Eights, Blackjack, Ludo, Werewolf, Forehead — bots + pass-and-play |

No build step and no npm dependencies: static HTML/CSS/JS plus Vercel Node functions in `api/`.
Workflow: edit in VS Code → `git push` → Vercel redeploys automatically.

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

## Notes

- INK STUDY aging is an illustrative model of known trends (black most stable, light/pastel inks fade fastest, sun accelerates fading, fine lines blur more) — not a medical prediction.
- TABLE online rooms (`api/room.js`) are kept for later; the shipped app is fully playable on one device.
