# Footnote (self-hosted)

Anyone can open this version. No Claude account is needed. AI calls go through `api/claude.js`, which uses your Anthropic API key on the server.

## Files
- `index.html`: the app (same as the claude.ai version, plus a small connector to `/api/claude`)
- `api/claude.js`: the server function that calls Claude, with a per-visitor rate limit
- `package.json`: tells Vercel to use Node 18 or newer

## Deploy on Vercel (about 10 minutes)
1. Get an API key at https://console.anthropic.com → API Keys. In **Billing → Limits**, set a monthly spend limit (for example $20).
2. Make a free account at https://vercel.com.
3. Put this folder on GitHub (new repo → upload `index.html`, `package.json` and the `api` folder), then in Vercel: **Add New → Project → Import** that repo. Keep the default settings and click **Deploy**.
   (No GitHub? Install Node, open this folder in a terminal, and run `npx vercel`.)
4. In the Vercel project: **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your key (required)
   - `ANTHROPIC_MODEL` = `claude-sonnet-5-5` (default) or `claude-haiku-5-5` (cheaper, faster)
   - `ALLOWED_ORIGIN` = your site address, e.g. `https://footnote-xyz.vercel.app` (optional; blocks other sites from using your API)
   - `RATE_LIMIT_PER_MINUTE` = `12` (optional)
5. **Deployments → Redeploy** so the variables take effect. Share the `.vercel.app` link.

## Testing it
- Type a story and send it. The feelings card should appear in a few seconds.
- If it says "Couldn't reach Footnote right now", check `ANTHROPIC_API_KEY`, then open Vercel → **Logs** to see the error.

## Notes
- Each typed story sends about 5,000 input tokens, plus a short self-check if they rewrite a line themselves. See https://www.anthropic.com/pricing for current prices.
- The rate limit slows abuse but isn't a hard cap. Your Console spend limit is the hard cap.
- Obvious emergencies are caught in the page before any AI call, so they still route to 988 and 911 if the API is down.
- Stories are sent to your server and Anthropic to be read. Nothing is stored server-side. The browser keeps only story titles, so it can spot a repeat.
