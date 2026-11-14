# Agent Instructions & Continuity Protocol (BATON)

This project integrates the **Baton Local MCP Server** (`baton`) to capture architectural decisions and operational blockers in real-time, ensuring zero context loss across multi-turn agent sessions.

---

## 🛠️ Baton MCP Server Configuration

Run `npm run baton -- init --org <ORG_ID> --repo <REPOSITORY_ID> --key <API_TOKEN>` once; it writes git-ignored client configs (`.mcp.json` for Claude Code, `.agents/mcp_config.json` for Antigravity, `.cursor/mcp.json`). See `docs/MCP.md`. The core tools are:
1. `baton:log_decision`
2. `baton:log_blocker`
3. `baton:get_context`

All memory payloads are client-side redacted for secrets, API tokens, JWTs, and high-entropy strings before dispatching.

---

## 📋 Mandatory Agent Behaviors

### 1. Architectural & Library Decisions (`log_decision`)
Whenever you make, adopt, or modify any architectural pattern, library, framework, or core design choice, you **MUST** call `log_decision`.

#### Triggers:
- Adding, replacing, or removing npm packages or dependencies.
- Choosing an architectural structure, routing strategy, or state management approach.
- Modifying authentication or security handling patterns.
- Changing database schemas, ORM patterns, or API design contracts.

#### Parameters:
- `decision`: Concise statement of what was decided (e.g. *"Migrated frontend bundling to Vite 6 with React 18"*).
- `reason`: Rationale explaining why this decision was made and what prompted it (e.g. *"Faster HMR, clean ESM support, lighter memory footprint"*).
- `alternatives`: Optional list or string of alternatives evaluated and discarded (e.g. `["Next.js Pages Router", "Webpack 5"]`).
- `files_affected`: List of primary files impacted (e.g. `["package.json", "vite.config.js"]`).

---

### 2. Blockers & Unfinished Tasks (`log_blocker`)
Whenever you encounter an unresolved bug, failing environment constraint, temporary workaround, or leave a task partially complete, you **MUST** call `log_blocker`.

#### Triggers:
- A bug or limitation that could not be fully resolved in the current turn.
- A temporary hack or workaround that needs a permanent fix later.
- Blocked external dependencies, API rate limits, or platform permissions (e.g., PowerShell script execution policies).
- Tasks left in an intermediate state for the next turn or incoming engineer.

#### Parameters:
- `problem`: Clear description of the limitation, bug, or unfinished task.
- `status`: One of `"active"`, `"investigating"`, `"blocked"`, `"workaround_applied"`, or `"resolved"`.
- `workaround_notes`: Any applied temporary workaround, troubleshooting context, or recommended next steps.

---

### 3. Context Retrieval (`get_context`)
Before undertaking significant refactoring or answering architectural inquiries about the codebase:
- Call `get_context` with relevant queries (e.g., `"auth migration rationale"`, `"current blockers"`) to retrieve historical project decisions and avoid repeating past dead ends.

---

## 🔒 Security Notice
The Baton MCP server automatically sanitizes and redacts all secrets client-side via `src/redact.ts`. Never deliberately inject raw secrets or production credentials into decision or blocker logs.

