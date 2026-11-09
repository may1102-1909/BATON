# Baton Setup & Deployment Guide

This guide covers running Baton locally, configuring Supabase, connecting the GitHub App, and deploying to Vercel.

---

## 🚀 Quick Start (Demo Mode)

Baton includes a zero-dependency synthetic demo store so you can test the full developer handover flow immediately without configuring external cloud services.

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
   Navigate to `http://localhost:5173/` for the landing page or `http://localhost:5173/dashboard` for the interactive workspace.

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
   GEMINI_API_KEY=<your-google-gemini-api-key>
   ```

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
   ```

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
        "BATON_API_URL": "http://localhost:5173",
        "BATON_API_KEY": "<BATON_TOKEN>",
        "BATON_ORG_ID": "<ORG_ID>",
        "BATON_REPOSITORY_ID": "<REPOSITORY_ID>"
      }
    }
  }
}
```
Client-side redaction ensures API tokens, JWTs, and private keys never leave your machine unredacted.

