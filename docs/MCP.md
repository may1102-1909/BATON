# Baton MCP server

The MCP stdio server gives agents repository-scoped continuity tools, eleven in total: `log_decision`, `log_blocker`, `get_context`, `bootstrap_project`, `save_memory`, `get_file_context`, `sync_history`, `github_activity`, `get_exit_interview`, `answer_exit_question`, and `export_handover` (saves the approved handover packet as a Markdown file in the repository). It sends data only to the configured Baton API; there is no pretend offline success or local event queue.

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
* `GET /api/handovers/:handoverId/export.md` (`export_handover`) returns the approved packet as Markdown. Tokens may only export handovers their member is the outgoing or incoming member of, and always get the non-admin view.

The API must validate that the bearer key is authorized for both supplied IDs and scope all reads/writes accordingly. A successful HTTP response is expected to be JSON. Unsupported routes or rejected scope are surfaced as failures; the MCP client cannot implement backend authorization or persistence itself.

## Client setup
The quickest path is `node /path/to/BATON/mcp-server/dist/cli.js init --api-url <URL> --org <ORG_ID> --repo <REPOSITORY_ID> --key <TOKEN>` run inside the target repository: it writes all client configs below (git-ignored, mode 600) with absolute paths. The manual steps follow.


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

Antigravity (app, IDE and CLI) reads MCP servers from `<workspace>/.agents/mcp_config.json` and, for every project, `~/.gemini/config/mcp_config.json`. Both use the same `mcpServers` format as Claude Code; `baton init` writes the workspace file with absolute paths. Older `.antigravity/mcp.json` files are not read. After editing, open `/mcp` (MCP Manager) and refresh; if a removed server still appears, also delete its cache under `~/.gemini/antigravity*/mcp/`. Antigravity also loads `AGENTS.md`, so the bootstrap guidance below can live there. Do not assume tool calls are automatic.

### Claude Desktop

Add the same `mcpServers` entry to `claude_desktop_config.json` (Settings → Developer → Edit Config) with absolute paths and all four `BATON_*` variables in `env`, then restart Claude Desktop.

### The handover file

After the outgoing member answers the exit interview (`get_exit_interview` / `answer_exit_question`, or the dashboard) and an admin approves the handover, call `export_handover` (or run `baton handover export [id] [--out path.md]`). Without an ID it picks the newest approved handover you take part in and writes `docs/handovers/handover-<id>.md`; `output_path` must stay inside the repository and end in `.md`.

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