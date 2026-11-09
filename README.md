# Baton — pass the knowledge, not just the code

Baton captures consented project context from coding agents and authorized GitHub repositories, asks a departing teammate evidence-linked questions, and produces a reviewed, cited handover for the incoming teammate.

## Run the synthetic demo

Node 22+ is required.

```sh
npm ci
npm --prefix mcp-server ci
npm run build:mcp
npm run dev:demo
```

Open `http://localhost:5173/dashboard`. The demo is **explicitly labeled**, uses an isolated in-memory database, and resets on restart. Its identities and repository activity are synthetic. No real account is connected automatically.

## Connect a real team

Follow **[the setup guide](docs/SETUP.md)** for Supabase, the read-only GitHub App, Gemini and deployment. Copy `.env.example` to `.env.local` and set values securely; never commit it. Start live mode with `npm run dev`, or build and run `npm run build && npm start`.

- [GitHub permissions, OAuth, synchronization and webhooks](docs/GITHUB.md)
- [MCP tools, incremental capture and client configuration](docs/MCP.md)
- [Architecture, security boundaries and limitations](docs/ARCHITECTURE.md)

## Product workflow

1. Create/join an organisation, invite teammates and assign admin/member roles.
2. Link each person's GitHub identity and connect an authorized GitHub App installation/repository.
3. Backfill commits, pull requests (open, closed and merged), and issues; receive signed updates.
4. Issue individual, revocable MCP keys. Bootstrap safe repository context, then capture only incremental events with source/session attribution.
5. Maintain tasks and comments, inspect captured sources, and edit/delete personal memories.
6. An admin starts a handover; the departing member answers source-linked questions in the web app or through MCP.
7. Generate evidence-grounded sections using Gemini, or use an explicitly labeled evidence-only mode when Gemini is not configured.
8. Review/edit/reject claims, approve a version, and let the assigned incoming member view permitted evidence, ask cited questions and acknowledge receipt.
9. Inspect risk and contribution views. Revoke keys and disable membership when offboarding is complete.

MCP cannot silently read an IDE's entire chat history or force tool execution after every message. Its server instructions, prompt and client rules request capture; the host agent/user remains in control. Unsubmitted conversations are not claimed as captured.

## Development and verification

```sh
npm run build
npm run build:mcp
npm test
npm --prefix mcp-server test
```

The Node test suite exercises authorization, tenant isolation, redaction, GitHub API/webhook contracts, evidence validation, state transitions, PostgreSQL schema/RLS, and an end-to-end synthetic handover. GitHub and Gemini provider responses in automated tests are controlled fixtures, not proof that your deployment's external credentials work.

The frontend is React/Vite. One Node API handles development, the production Node server and the Vercel function adapter; there is no unused Next.js API layer. Supabase is production persistence/authentication. Provider credentials remain server-side.

## Data and demonstration policy

Use synthetic, public, permissioned or anonymized data for hackathon demonstrations. Only connect repositories and send context you are authorized to process. Redaction is defense in depth, not a guarantee that arbitrary confidential content is safe to upload. Review provider retention terms before sending private data to Gemini.

The visual landing-page implementation predates this workflow build and includes ThreeUI-derived assets. Disclose reused assets/services and AI-assisted implementation in the hackathon submission; see the original source attribution in the retained visual files.
