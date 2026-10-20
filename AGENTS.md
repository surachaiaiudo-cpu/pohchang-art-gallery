# Instructions for AI agents

Start with `AGENT_HANDOFF.md` (architecture, current state, open questions). The essentials:

- **Ask the owner before deciding anything yourself.** Offer options with a recommendation and wait.
- Reply to the owner in **Thai**.
- `git pull` before working; the owner also pushes here. Push to `main` deploys to production.
- Never handle secrets in chat or commits. Never set `DEV_FAKE_STORAGE` / `DEV_ALLOW_HTTP_IMPORT` in production.
- Schema change = `schema/000N_*.sql` + a step in `functions/_lib/migrate.js`.
- New public text = add the key to all three dictionaries in `public/js/i18n.js` (th, en, zh).
- Escape all data with `esc()`; never return emails/phones from public endpoints.
- Run `npm test` before pushing; check the "Cloudflare Pages" check run after.
- Do not modify the old system (github.com/surachaiaiudoartexhibition/artexhibition) unless asked.
