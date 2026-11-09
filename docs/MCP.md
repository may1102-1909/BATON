# Baton MCP server

The MCP stdio server gives agents repository-scoped continuity tools: `log_decision`, `log_blocker`, `get_context`, `bootstrap_project`, `save_memory`, `github_activity`, `get_exit_interview`, and `answer_exit_question`. It sends data only to the configured Baton API; there is no pretend offline success or local event queue.

## Configure and start

Requirements: Node.js 20 or newer and npm. From the repository root:

```sh
npm --prefix mcp-server ci
npm --prefix mcp-server run build
cp mcp-server/.env.example mcp-server/.env
```

Set these exact variables in the ignored `mcp-server/.env` or the MCP process environment. Use a Baton-issued organization/member-scoped API key, not a service-role database key.

| Variable | Required | Purpose |
| --- | --- | --- |
| `BATON_API_URL` | yes | Absolute HTTP(S) API base URL, without credentials, query, or fragment |
| `BATON_API_KEY` | yes | Bearer key issued for the intended organization/member |
| `BATON_ORG_ID` | yes | Organization scope |
| `BATON_REPOSITORY_ID` | yes | Repository scope |
| `BATON_REPO_PATH` | for `bootstrap_project` | Absolute path to the target Git repository root |
| `BATON_SESSION_ID` | no | Stable client session identifier; otherwise generated once per server process |

Start manually with `npm --prefix mcp-server start`. The process speaks MCP over stdio; logs go to stderr. Missing configuration, failed authentication, and backend/network errors are returned as tool errors. They are not reported as successfully saved. Never put a real key in a committed client config or send it in chat.

`bootstrap_project` checks that the configured path resolves to the Git root, reads only Git-tracked regular files that stay inside that root, and excludes environment/credential files, key/certificate files, binaries, build outputs, and dependencies. It caps the inventory at 1,200 paths, reads at 200 files, each file at 48 KiB, and total bytes at 2 MiB. It sends a bounded file inventory, SHA-256 hashes, and README headings as architecture hints—not repository contents. The next successful snapshot sends only changed hashes/paths; unchanged snapshots make no request. A local metadata-only baseline is stored with restrictive permissions in ignored `mcp-server/.baton/`. Files beyond read limits cannot be content-hash compared, so the tool reports scan limits rather than claiming a complete code snapshot. Symlinks are not read. All tool inputs and backend responses are redacted before being returned or sent.

## Backend contract

All requests use `Authorization: Bearer <BATON_API_KEY>` and require organization/repository scope. The collector push request is:

```json
{
  "type": "change",
  "content": "optional concise text",
  "data": { "content": "new change delta" },
  "payload": { "content": "new change delta" },
  "org_id": "...",
  "repository_id": "...",
  "session_id": "...",
  "event_id": "...",
  "timestamp": "...",
  "source": "baton-mcp-server"
}
```

The client calls:

* `POST /api/collector/push` for `decision`, `blocker`, `context`, `change`, and `bootstrap` events. `event_id` identifies each submission; `session_id` is stable for one server process (or supplied by the client).
* `GET /api/collector/search?q=…&org_id=…&repository_id=…` for repository-scoped context.
* `GET /api/orgs/:orgId/state?repository_id=…` for tracked repository activity; the client returns only the configured repository and sources explicitly carrying that repository ID.
* `GET /api/mcp/interviews?org_id=…&repository_id=…` for assigned questions.
* `POST /api/mcp/interviews/:interviewId/answers` with `{ "questionId": "…", "answer": "…" }` to answer a question.

Personal keys are organization-scoped and inherit the member’s current role. Repository IDs select context; they are not a repository-level authorization boundary. A key can access all role-visible repositories within its organization, but never another organization. Use separate organizations where repository-level isolation is required. A successful HTTP response is expected to be JSON. Unsupported routes or rejected scope are surfaced as failures; the MCP client cannot implement backend authorization or persistence itself.

## Client setup

Build before connecting a client. Replace the sample executable path with the absolute path to `mcp-server/dist/index.js`; point `BATON_REPO_PATH` at the repository root. The server loads `mcp-server/.env`, so leave credentials out of each JSON/TOML config. Client config formats, locations, trust controls, and prompt/rule support differ and can change; verify the entry in the client’s MCP UI/CLI before relying on it.

### Claude Code

Project `.mcp.json` uses the `mcpServers` format. For example (use an absolute executable path):

```json
{
  "mcpServers": {
    "baton": {
      "command": "node",
      "args": ["/absolute/path/to/repository/mcp-server/dist/index.js"],
      "env": { "BATON_REPO_PATH": "/absolute/path/to/repository" }
    }
  }
}
```

Review and approve project MCP servers when prompted. Put the bootstrap guidance below in `CLAUDE.md` or the project’s Claude Code rules so the model sees it; merely configuring a server does not require the model to call a tool on every turn.

### Cursor

Add the same `mcpServers` entry in project `.cursor/mcp.json` or add Baton through Cursor’s MCP settings. Set the repository path in the entry or the process environment. Add the bootstrap guidance to a project Cursor rule and confirm Baton is enabled in the tool picker.

### Codex

Codex uses TOML for MCP server entries. Add the following to a trusted project `.codex/config.toml` (or `~/.codex/config.toml`):

```toml
[mcp_servers.baton]
command = "node"
args = ["/absolute/path/to/repository/mcp-server/dist/index.js"]

[mcp_servers.baton.env]
BATON_REPO_PATH = "/absolute/path/to/repository"
```

Alternatively, add the local stdio server with `codex mcp add baton -- node /absolute/path/to/repository/mcp-server/dist/index.js`, then configure `BATON_REPO_PATH` for the MCP process. Put the bootstrap guidance in `AGENTS.md` or project instructions.

### Google Antigravity

This repository includes `.antigravity/mcp.json` as a project entry. Its relative executable and `BATON_REPO_PATH="."` assume the MCP process starts in the repository root; use absolute paths if it does not. Antigravity’s app/CLI MCP manager and config locations vary by client version; if this file is not discovered, add the same local stdio command through **Customizations → Installed → MCP Servers** (or the CLI `/mcp` manager) and set `BATON_REPO_PATH`. Use a workspace instruction/rule containing the bootstrap guidance. Do not assume tool calls are automatic.

### Bootstrap guidance for project instructions

```text
At the start of a project session, call bootstrap_project, then get_context with a focused task query. After each substantive turn, save only new decision/blocker/context/change deltas with save_memory; use log_decision and log_blocker when their specific fields apply. Never save full transcripts, secrets, or unchanged history. Before ending when interview questions are assigned, call get_exit_interview and answer_exit_question for questions you can answer.
```

MCP tools and prompts are available for clients that support them, but clients cannot be forced by this server to call a tool on every turn. Rules/prompts are best-effort model guidance; verify actual tool use. No automatic hook is claimed or installed.

## Official client references

Client configuration behavior is version-sensitive; consult current vendor documentation:

* [Claude Code MCP](https://code.claude.com/docs/en/mcp) — project MCP config and trust/approval behavior.
* [Cursor MCP](https://cursor.com/docs/mcp) — supported transports and project/user configuration.
* [OpenAI Codex MCP](https://developers.openai.com/codex/extend/mcp) and [configuration reference](https://developers.openai.com/codex/config-reference) — MCP CLI and TOML settings.
* [Google Antigravity MCP](https://antigravity.google/docs/mcp/) — app/CLI MCP manager and configuration options.
