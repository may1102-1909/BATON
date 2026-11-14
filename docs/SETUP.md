# Baton Setup & Deployment Guide

This guide covers running Baton locally, configuring Supabase, connecting the GitHub App, and deploying to Vercel.

---

## 🚀 Quick Start (Demo Mode)

Baton ships a demo at `/demo-page` that runs in the browser against a bundled synthetic snapshot, so you can try the handover flow without configuring any external service. The production workspace (`/dashboard`) uses Supabase and starts empty.

1. Install dependencies:
   ```bash
   npm install
   npm --prefix mcp-server install
   ```
2. Build the MCP server:
   ```bash
   npm run build:mcp
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000/` for the landing page, `http://localhost:3000/demo-page` for the demo and `http://localhost:3000/dashboard` for the production workspace (needs Supabase and sign-in).

---

## 🗄️ Supabase Configuration (Production)

To connect Baton to a live PostgreSQL database:

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Execute the schema migration in `supabase/schema.sql` via the Supabase SQL Editor.
3. Configure your production environment variables:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   TOKEN_ENCRYPTION_KEY=<32-byte-base64-key>
   PUBLIC_APP_URL=https://<your-domain>
   GEMINI_API_KEY=<your-google-gemini-api-key>   # optional; GEMINI_MODEL overrides the default gemini-2.5-flash
   ```
   The frontend build reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, and also accepts the `NEXT_PUBLIC_` variants or plain `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Set them before `npm run build`.
4. Optional: run `supabase/migrations/20261114_round3.sql` to store risk scores and member function roles. The app works without it, except that saving a function role answers 503 until it is applied.
5. Keep `BATON_DEMO_MODE` unset or `false` in production.

---

## 🐙 GitHub App Integration

To enable continuous repository synchronization and PR metadata import:

1. Create a GitHub App in your GitHub Organization or personal account.
2. Set the Callback URL:
   ```
   https://<your-domain>/api/github/callback
   ```
3. Set the Webhook URL:
   ```
   https://<your-domain>/api/github/webhook
   ```
4. Grant repository permissions:
   - **Repository contents**: Read
   - **Pull requests**: Read
   - **Issues**: Read
   - **Commit statuses**: Read
5. Subscribe to events: `push`, `pull_request`, `issues`.
6. Add the following environment variables:
   ```env
   GITHUB_APP_ID=<app-id>
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   GITHUB_CLIENT_ID=<client-id>
   GITHUB_CLIENT_SECRET=<client-secret>
   GITHUB_WEBHOOK_SECRET=<webhook-secret>
   GITHUB_APP_SLUG=<app-slug>   # optional; enables install links in error messages
   ```
7. Install the app on every account or organization whose repositories you want to connect, then connect them from the workspace GitHub tab (see `docs/GITHUB.md`). A repository your linked GitHub account can read can also be connected without an installation, but it receives no webhooks.

---

## 🛠️ MCP Client Configuration

Connect your favorite AI coding agent (Cursor, Claude Desktop, Antigravity, or Codex) to the Baton Local MCP Server:

### Configuration Snippet
```json
{
  "mcpServers": {
    "baton": {
      "command": "node",
      "args": ["path/to/BATON/mcp-server/dist/index.js"],
      "env": {
        "BATON_API_URL": "http://localhost:3000",
        "BATON_API_KEY": "<BATON_TOKEN>",
        "BATON_ORG_ID": "<ORG_ID>",
        "BATON_REPOSITORY_ID": "<REPOSITORY_ID>"
      }
    }
  }
}
```
Client-side redaction ensures API tokens, JWTs, and private keys never leave your machine unredacted.

