# Deal Hunter V5 — GitHub source handoff

Existing frontend and Cloudflare Worker API source. Do not rewrite as a new project.

Production: https://deal-hunter-v5.wwzb-64.chatgpt.site

Node 24 recommended. Run npm ci, npm run typecheck, npm test, npm run build.

Operational ledger, backups, photos, screenshots and access credentials are intentionally excluded from this transfer. They remain in the existing production D1/R2 storage; do not seed, initialize, reset or replace production data. Original private preservation tests that depend on the excluded master ledger are excluded from this transfer only; originals remain in the working project.

Configure DEAL_HUNTER_ACCESS_HASH (SHA-256 of the access code) and FILE_SIGNING_KEY as runtime secrets. No access-code fallback is supplied in this transfer. Preserve .openai/hosting.json project identity for existing Sites operations. Never commit .env files, live API outputs or production ledger exports.

The production frontend is static; worker/index.ts implements JSON and signed photo APIs backed by D1/R2. Moving to Render requires a deliberate backend/storage migration; do not assume uploading these files will migrate the operating database.

Price changes must remain disabled. Missing sale dates and costs must remain unknown. Review new reconciliation changes with the user before writing. The separate account-reconciliation handoff/report should be supplied privately to Codex, not committed as application source.
