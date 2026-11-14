# BATON

> Pass the knowledge, not just the code.

BATON helps a team keep the reasoning behind its code when someone leaves. It collects decisions and blockers from AI coding agents (through an MCP server), collects commits, pull requests, issues and branches from GitHub, and turns that evidence into a handover for the incoming engineer. Every claim in a handover cites the sources it came from; an admin reviews and approves the claims before the newcomer can read them.

Built for the CodersInPune Hackathon 2026 (team MUMBAI_WALE).

## What is in this repository

| Part | Where | Notes |
| --- | --- | --- |
| Frontend | `src/` | React 18 + Vite 6. Routes: `/` landing, `/auth` sign-in and sign-up, `/usage` mode chooser, `/dashboard` production workspace, `/demo-page` demo, `/handover/:id` handover review. |
| API | `server/` | A Node ESM request handler (`server/app.js`) with a memory store and a Supabase store. Vercel serves it from `api/index.js`; `vite dev` mounts it through `src/server/apiMiddleware.js`; `server/index.js` is a standalone Node server for `dist/`. |
| MCP server | `mcp-server/` | Eleven tools: `log_decision`, `log_blocker`, `get_context`, `bootstrap_project`, `save_memory`, `get_file_context`, `sync_history`, `github_activity`, `get_exit_interview`, `answer_exit_question`, `export_handover`. Also a `baton` CLI (`init`, `sync`, `handover export`) used by the git and Claude Code hooks. |
| Database | `supabase/schema.sql`, `supabase/migrations/` | Postgres schema; the app also runs without the optional Round 3 migration. |
| Tests | `tests/` (unit, `node:test`), `e2e/` (Playwright) | See [Testing](#testing). |

## How it works

1. **Capture.** MCP tools and the git post-commit hook send decisions, blockers, commits and file summaries to `/api/collector/*`. A GitHub repository can also be synced directly (commits, pull requests with changed files, issues, branches ahead of the default branch) and updated by webhook.
2. **Redact.** Text is scrubbed with regular expressions and an entropy check for secrets such as JWTs, API keys and private keys, both in the MCP client and on the server. This is pattern-based redaction, not a guarantee that every secret is caught.
3. **Generate.** An admin starts a handover for a leaver and an incoming member. BATON asks the leaver targeted questions (exit interview), then drafts claims. With `GEMINI_API_KEY` set, Gemini drafts them; without it, or if Gemini fails, a deterministic evidence-only compiler is used and the result is labelled `evidence-only`. Claims are validated against the supplied sources: unknown citations are dropped and a claim only counts as `verified` when its text appears in a cited source.
4. **Review and approve.** The admin approves, edits or rejects each claim and resolves conflicting evidence.
5. **Hand over the file.** The approved handover is the final product: a Markdown file (decisions, risks, resolved conflicts, known gaps, cited sources). Download it with **Export Markdown** on the handover page, or let the agent save it into the repository with the `export_handover` MCP tool / `npm run baton -- handover export` (default `docs/handovers/handover-<id>.md`). Example: [docs/examples/sample-handover.md](docs/examples/sample-handover.md).
6. **Onboard.** The incoming engineer reads the approved handover and asks cited questions answered only from approved evidence.

Access is enforced in the API: organization membership, `admin` vs `member`/`team` roles, source visibility (`team`, `admin`, `private`) and optional function-role audiences (`backend`, `frontend`, `infra`, `data`, `design`, `product`). API tokens only work on collector routes, MCP interview routes and the Markdown export of a handover their member takes part in (exported without admin-only evidence, because the file may be committed).

## Connect an AI agent (MCP)

The MCP server runs locally over stdio and talks to the Baton API with a per-member API token. Tested on 14 Nov 2026: Claude Code 2.1 discovers the project config and connects (`claude mcp list` → `✔ Connected`); the Antigravity config follows its documented format but was not run inside Antigravity.

1. In the dashboard (production `/dashboard`), open **Team & Tokens**, click **Generate MCP Token**, and copy the organization ID and repository ID from **MCP client configuration** (the "baton init" tab prints the whole command).
2. In a clone of this repository: `npm install && npm run build:mcp`.
3. In the repository you want Baton to remember (this one or any other), run:

   ```bash
   node /path/to/BATON/mcp-server/dist/cli.js init --api-url https://baton-nu.vercel.app --org <ORG_ID> --repo <REPOSITORY_ID> --key <API_TOKEN>
   ```

   It writes `.baton/config.env`, `.mcp.json` (Claude Code), `.agents/mcp_config.json` (Antigravity) and `.cursor/mcp.json`, adds them to `.gitignore` (they contain the token), installs a git post-commit hook and a Claude Code Stop hook, and backfills the latest commit.
4. **Claude Code:** open the repository with `claude`, approve the `baton` project server, and check with `claude mcp list`. To use it in every project instead: `claude mcp add baton -s user -e BATON_API_URL=… -e BATON_API_KEY=… -e BATON_ORG_ID=… -e BATON_REPOSITORY_ID=… -e BATON_REPO_PATH=… -- node /path/to/BATON/mcp-server/dist/index.js`.
5. **Claude Desktop:** paste the "Claude Desktop" snippet from the dashboard into `claude_desktop_config.json` (Settings → Developer → Edit Config) and restart.
6. **Antigravity:** `.agents/mcp_config.json` is the workspace config Antigravity reads (use `~/.gemini/config/mcp_config.json` for all projects). Open `/mcp` in the agent panel and refresh; `baton` should list its tools.
7. Put the bootstrap guidance from [docs/MCP.md](docs/MCP.md#bootstrap-guidance-for-project-instructions) in `CLAUDE.md` / `AGENTS.md` so the agent actually calls the tools.

### Where the memory is stored

Nothing is kept by the agent itself. Every tool call goes to the Baton API, which writes to the Supabase Postgres database configured on the server:

| What | Table |
| --- | --- |
| Decisions, blockers, context/change notes, commits, PRs, issues, interview answers | `public.sources` (with a 768-dim `embedding` for semantic search) |
| Conversation turns synced from Claude Code / Antigravity transcripts | `public.agent_messages` (sync cursor per session) |
| Changed-file contents and summaries | `public.file_summaries` |
| Handover packet, claims, questions, versions | `public.handovers`, `handover_claims`, `handover_questions`, `handover_versions` |

Every row is scoped by `org_id` and `repository_id`, so one conversation or codebase's memory is retrievable with `get_context` / `get_file_context` by anyone in that organization. Locally, only the configuration (`.baton/config.env`, the client config files) and a snapshot hash cache (`mcp-server/.baton/snapshot.json`, used to send only changed files) live on disk. With `BATON_DEMO_MODE=true` the API uses an in-memory store that is lost on restart.

## Setup

Requirements: Node.js 20+.

```bash
npm install
npm --prefix mcp-server install   # only needed for the MCP server and its integration test
npm run build:mcp                 # builds mcp-server/dist
npm run dev                       # http://localhost:3000
npm run build                     # production build into dist/
```

Copy `.env.example` to `.env.local` and fill it in. Names the code reads:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server database and auth access. Never expose the service-role key to the browser. (`NEXT_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` and `SUPABASE_KEY` are accepted as fallbacks on the server.) |
| `SUPABASE_ANON_KEY` | Public key for the browser. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser Supabase settings. The build also accepts `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` or plain `SUPABASE_URL` / `SUPABASE_ANON_KEY` and bakes them in at build time. |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64 (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Encrypts stored GitHub OAuth tokens. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional. Enables Gemini drafting, Q&A and embeddings. `GEMINI_MODEL` overrides the default `gemini-2.5-flash` for every generation request. |
| `PUBLIC_APP_URL` | Public base URL of the app (for example `https://baton.example.com`); the GitHub OAuth callback is `<PUBLIC_APP_URL>/api/github/callback`. |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (or `GITHUB_PRIVATE_KEY`) | GitHub App identity used to read repositories. Literal `\n` in the key is accepted. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth credentials used to link a member's GitHub account. |
| `GITHUB_WEBHOOK_SECRET` | Verifies `x-hub-signature-256` on `/api/github/webhook`. |
| `GITHUB_APP_SLUG` | Optional. Lets the API and UI offer `https://github.com/apps/<slug>/installations/new` when a repository is not covered by the app. |
| `BATON_ALLOWED_ORIGINS` | Optional comma-separated CORS allow-list. |
| `BATON_DEMO_MODE` | Test/offline switch that replaces Supabase with a seeded in-memory store. Keep it `false` (unset) in production. |

Database: run `supabase/schema.sql` in the Supabase SQL editor. The optional `supabase/migrations/20261114_round3.sql` adds risk-score columns and `org_memberships.function_role`; without it everything works except saving a member's function role (the API answers 503 with the migration name), and risk scores are recomputed on read. Existing databases also need `supabase/migrations/20261114_org_delete_keep_admin.sql` (deleting a workspace fails with a server error without it).

## Production vs demo

- **Production** is `/auth` → `/usage` → `/dashboard`. It uses your Supabase data only and starts empty: a new account sees onboarding instead of sample data.
- **Demo** is `/demo-page`. State lives in the browser and every call is answered by the real engine through `/api/demo` with a bundled synthetic snapshot; it needs no credentials and never reads or writes production data.

## Connecting a GitHub repository

Any repository can be connected, not only this one.

1. Create a GitHub App (callback `<PUBLIC_APP_URL>/api/github/callback`, webhook `<PUBLIC_APP_URL>/api/github/webhook`) with read access to metadata, contents, issues and pull requests, subscribed to `push`, `pull_request` and `issues`. Set the environment variables above and redeploy.
2. Install the app on the account or organization that owns the repository, choosing the repository (or all repositories). Install it again for each additional owner.
3. In the workspace open **GitHub**, link your GitHub account, pick the installation and repository, and connect. Then sync.
4. If the repository is not covered by an installation, connecting returns a clear error with the install link (when `GITHUB_APP_SLUG` is set). A repository your linked GitHub account can read (for example a public one) can still be connected without an installation by sending only `full_name`; it syncs with your own token and does not receive webhooks, so sync it manually.
5. To switch projects, disconnect the repository (this deletes the sources synced from it) or reset the workspace's data, then connect another one. Re-connecting the same repository and re-syncing never duplicates data.

Limits: a sync reads the newest 300 commits, 200 pull requests, 200 issues and 50 branches; the response includes `truncated: true` when GitHub has more.

Details: [docs/GITHUB.md](docs/GITHUB.md). Other docs: [docs/SETUP.md](docs/SETUP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/MCP.md](docs/MCP.md).

## API overview

All routes need `Authorization: Bearer <Supabase access token>` unless noted. Admin routes reject API tokens.

| Area | Routes |
| --- | --- |
| Session | `GET /api/health` (public), `GET /api/me`, `POST /api/orgs`, `PATCH /api/orgs/:id` (admin rename), `DELETE /api/orgs/:id` (admin, confirm by name), `POST /api/orgs/:id/reset` (admin, confirm by name, scope `sources` or `all`), `GET /api/orgs/:id/state` |
| Team | `POST /api/orgs/:id/invites`, `POST /api/invites/accept`, `POST /api/orgs/:id/tokens`, `DELETE /api/orgs/:id/tokens/:tokenId`, `PATCH /api/orgs/:id/members/:memberId` |
| Memory | `POST /api/orgs/:id/memories`, `PATCH`/`DELETE /api/orgs/:id/memories/:memoryId`, `POST /api/collector/{push,messages,commit,files}`, `GET /api/collector/{cursor,search}` |
| Tasks | `POST /api/orgs/:id/tasks`, `PATCH /api/tasks/:id`, `POST /api/tasks/:id/comments` |
| Handovers | `POST /api/orgs/:id/handovers`, `GET /api/orgs/:id/risks`, `GET /api/handovers/:id`, `POST /api/handovers/:id/{generate,approve,acknowledge,ask,answers}`, `PATCH /api/handovers/:id/claims/:claimId`, `POST /api/handovers/:id/questions/:qid/skip`, `POST /api/handovers/:id/conflicts/:claimId/resolve`, `GET /api/handovers/:id/versions[/diff]`, `GET /api/handovers/:id/export.md` (approved only), `GET /api/mcp/interviews`, `POST /api/mcp/interviews/:id/answers` |
| GitHub | `GET /api/orgs/:id/github/connect`, `GET /api/github/callback` (public), `GET /api/orgs/:id/github/installations[/:installationId/repositories]`, `POST /api/orgs/:id/repositories`, `DELETE /api/orgs/:id/repositories/:repoId`, `POST /api/orgs/:id/repositories/:repoId/sync`, `POST /api/github/webhook` (signature-verified) |

## Testing

```bash
npm test             # unit and API tests (node --test, no network, no credentials)
npm run test:e2e     # Playwright; starts `npm run dev` on port 3000 (run `npx playwright install chromium` once)
npm run build        # the build must succeed
```

Unit tests cover the store adapters, the HTTP routes, GitHub connect/sync/webhooks with stubbed `fetch`, the handover engine, audiences and conflicts, the demo engine, and a real stdio MCP round trip. Reliability cases (invalid, expired and used invites; revoked API tokens; bad webhook signatures; duplicate generation; cross-organization access; interview refresh; Gemini failure fallback) are in `tests/reliability.test.js`.

## Known limits

- Redaction is pattern and entropy based; review what you capture.
- Handover claims are checked against cited source text, not against code structure.
- Webhook updates require a GitHub App installation; repositories connected with a user token must be re-synced manually.
- Generation locking is per server process; two serverless instances generating the same handover at the same moment can still interleave.
- Supabase outage and offline behaviour are not covered by automated tests.
- MCP clients: Claude Code was checked against a local API (connects, tools listed); Antigravity, Cursor, Codex and Claude Desktop configurations follow their documentation in [docs/MCP.md](docs/MCP.md). The stdio round trip (save, search, interview, Markdown export) is covered by automated tests.

## Roadmap

Sequenced by dependency; effort and risk are rough estimates.

| # | Step | Depends on | Effort | Risk |
| --- | --- | --- | --- | --- |
| 1 | Verify production: environment variables, applied schema, revoke any token that was ever committed | none | 1 h | Low |
| 2 | Production onboarding and first-run checklist (connect GitHub, create a token, receive a capture, generate a handover) | 1 | 3 h | Low |
| 3 | Accessible status messages, loading, empty and error states in the workspace | 2 | 4 h | Low |
| 4 | Split the workspace into tabs behind a shared organization hook; re-run Playwright | 3 | 3 h | Medium (large refactor) |
| 5 | Optional Round 3 migration in production (function roles, stored risk scores) | 1 | 0.5 h | Low |
| 6 | Vector-search visibility enforced inside `match_memory` (today the API re-checks every hit) | 5 | 1 h | Medium (SQL change) |
| 7 | Shared-state locking for handover generation across serverless instances | none | 2 h | Medium |
| 8 | Supabase-outage and offline tests | 3 | 2 h | Low |

Out of scope for now: desktop or mobile packages, further landing-page variants and additional MCP tools.
