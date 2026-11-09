# Connect Baton to your real team

Do not send API keys, private keys, database passwords or access tokens in chat. Set them through your deployment's encrypted environment settings. Local `.env.local` is ignored by Git.

## 1. Supabase

1. Create a Supabase project. Apply `supabase/schema.sql` using the SQL editor. Review the migration notes in that file if upgrading the earlier prototype.
2. Copy the project URL into both `SUPABASE_URL` and `VITE_SUPABASE_URL`.
3. Put the public anon key in `VITE_SUPABASE_ANON_KEY`. Put the service-role key in `SUPABASE_SERVICE_ROLE_KEY` **server-side only**. Never give it a `VITE_` prefix.
4. Under Authentication, enable email/password and email links. Set Site URL to your application URL and add its callback URLs. Enable GitHub sign-in in Supabase only if you want that optional sign-in method; it is independent of the Baton repository integration.
5. Deploy/build after adding `VITE_` variables: browser configuration is embedded at build time.
6. Sign up, confirm email if required, sign in, create an organisation, and invite your teammates. Give at least two trusted people admin roles before offboarding an administrator.

## 2. Gemini

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Set `GEMINI_API_KEY` in server environment settings. Set `GEMINI_MODEL` to a model available to your project (default `gemini-2.5-flash`).
3. Review your provider's data processing and retention terms before using private project information. Baton sends redacted, permission-scoped evidence, not an unrestricted repository dump.
4. Without a key, Baton identifies its output as **evidence-only**, not AI-generated. Provider failures must remain visible; do not interpret them as successful generation.

Official reference: https://ai.google.dev/api/generate-content

## 3. GitHub App

Register a new GitHub App in GitHub developer settings. This app is for Baton itself; your Hoplite repository credentials are not used as application credentials.

- Homepage: your deployed app URL.
- Callback: `https://YOUR_APP/api/github/callback`.
- Webhook: `https://YOUR_APP/api/github/webhook`.
- Webhook secret: generate a long random secret and set the same value as `GITHUB_WEBHOOK_SECRET`.
- Repository permissions: **Metadata read**, **Contents read**, **Pull requests read**, **Issues read**. No repository write permissions are needed.
- Subscribe to **Push**, **Pull request**, and **Issues** events.
- Install it only on repositories you authorize Baton to process.
- Put App ID, OAuth client ID/secret and the generated PEM private key in `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY` respectively.
- Set `PUBLIC_APP_URL` to the public origin, without a trailing path.
- Generate `TOKEN_ENCRYPTION_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and store it securely. Keep it stable; changing it requires reconnecting linked GitHub accounts.

Inside Baton, select your org, connect your GitHub identity, select an accessible installation/repository, and synchronize it. Each member should link their own GitHub identity so activity can be attributed to the correct person. GitHub login is verified through OAuth; typing another person's username is not identity proof.

See [GITHUB.md](GITHUB.md) for implementation details. Local webhooks need a public HTTPS endpoint; until deployed, manual sync can backfill authorized activity. Do not expose the synthetic demo to real GitHub credentials.

## 4. MCP

Install/build the `mcp-server` package, generate a **personal organisation-scoped MCP key** in Baton, and configure your coding client using [MCP.md](MCP.md). The organisation/repository IDs must match the selected project. Do not share personal MCP keys between teammates: attribution depends on them. Revoke a key when a member leaves.

MCP is tool-based: the host agent decides whether and when to invoke tools. Startup instructions and repository/client rules request a bootstrap and delta capture; they cannot secretly access all chat history or guarantee a call after every turn. Only explicitly submitted, redacted project information is recorded.

## 5. Run and deploy

Requires Node 22+.

```sh
npm ci
npm --prefix mcp-server ci
npm run build:mcp
# Configure .env.local for live services, then:
npm run dev
# Production Node server (same API as development):
npm run build
npm start
```

Development listens on port 5173. Production defaults to 3000 (`PORT` overrides it). Set `ALLOWED_ORIGINS` to your deployed origins (comma-separated), not `*`.

Vercel: import this repository, set the listed environment variables, and use the included `vercel.json` and Node Web Request function in `api/index.js`. API rewrites precede the SPA fallback. Rebuild when public browser variables change. Production deployment and real-provider webhooks still require verification against your own configured accounts.

For a credential-free synthetic demonstration:

```sh
npm run dev:demo
```

The demo uses isolated in-memory state and resets on server restart. It accepts demo identities only when explicitly enabled, and does not connect to live Supabase/GitHub. This is not production storage or authentication. The repository's managed Preview intentionally uses this mode.

## Acceptance walkthrough

1. Admin creates org, invites departing/incoming members and a second admin.
2. Each member links GitHub identity; admin connects repository and runs initial sync.
3. Members issue separate MCP keys, bootstrap project context and log changes. Repeating the same event must not duplicate it.
4. Create a task, assign an owner and add comments. Inspect sources and delete/edit only your own memories.
5. Admin starts an offboarding. Departing member answers evidence-linked questions in the web UI or MCP.
6. Admin generates a handover, checks citations/confidence, edits or rejects claims, and approves it.
7. Incoming member sees only their permitted approved handover, asks cited questions and acknowledges it.
8. Check version history and risk/contribution views. Revoke departing member's MCP keys and disable their membership after final verification.

Do not use real customer data until role-isolation, provider settings, secret handling and backup/retention requirements have been reviewed for your deployment.
