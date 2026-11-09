# Architecture and security boundaries

## Runtime

The existing React/Vite visual frontend is retained rather than migrating frameworks. `src/server/apiMiddleware.js`, `server/index.js`, and `api/index.js` adapt the **same** `server/app.js` API to Vite, a production Node process, and Vercel Web Requests. Webhook validation uses original request bytes through `server/web.js`.

`server/store.js` provides the production Supabase store and an isolated in-memory store for tests/explicit demonstrations. Synthetic data is defined in `server/demo.js`; it never masquerades as actual GitHub activity. `BATON_DEMO_MODE=true` is an explicit opt-in, not a fallback when production credentials fail. The managed Preview uses this mode.

## Authorization

Live web requests validate Supabase access tokens server-side. Organisation membership is checked for each resource. MCP keys are random per-member/per-organisation capabilities stored as hashes, not a shared project secret. Membership revocation must take effect even if the key has not expired. Administrative operations require an interactive authenticated admin, not an MCP key.

A GitHub App integration requires user OAuth proof of access to the installation and selected repository. Installation IDs alone are not authorization. GitHub OAuth state expires and is one-use. User tokens are encrypted using `TOKEN_ENCRYPTION_KEY` and kept in server-only tables. Webhook HMAC signatures are timing-safely verified; processed deliveries and external evidence IDs support idempotent updates.

Server-mediated writes preserve workflow invariants. RLS protects organisation reads, while sensitive credentials and handover internals must not be exposed through broad Supabase client policies. Do not use service-role credentials in browser code.

## Knowledge model

Sources are evidence records with organisation, repository, author, source type, timestamp, visibility, metadata and stable external/event identifiers. Capture appends distinct events; duplicate events are not new knowledge. Snapshots upload bounded, secret-redacted summaries and changed tracked-file information, not every byte of every file or complete chat transcripts.

Manual task discussion and exit-interview answers add knowledge with explicit attribution. GitHub messages establish what happened, not necessarily why; missing rationale should become a question, not an invented decision.

Handover sections contain claims, confidence labels and source IDs. Gemini receives only scoped/redacted evidence; supplied source content is data, not instructions. Citation validation rejects references outside the evidence set. A valid citation proves traceability, not that an LLM paraphrase is true: human review is required before sharing. The evidence-only mode quotes/extracts known evidence and is not advertised as AI analysis.

Approval/version history, acknowledgement and source-change invalidation prevent a stale or unreviewed draft from quietly becoming an approved handover. Incoming-member questions are answered from permitted approved evidence or explicitly marked as unsupported.

## Operational boundaries

- External integration tests use controlled responses. A real Supabase project, GitHub App installation, webhook delivery and Gemini request need deployment-level acceptance with your configured accounts.
- Demo state is not durable. Production uses Supabase; configure backups, retention, monitoring and quota controls for your deployment.
- The current capture model is agent-invoked, not an IDE-wide recorder. No universal MCP hook guarantees a tool call after each turn.
- Redaction is heuristic and can over-redact or miss unfamiliar sensitive formats. It does not replace source permissions or human consent.
- Search has a safe text/evidence baseline. Do not describe it as a deployed pgvector semantic index unless such an index is actually configured and verified.
- Contributor concentration is a **proxy**, not a definitive bus-factor measure; commits/file changes do not prove exclusive knowledge ownership.
- Provider pagination, quotas and serverless execution duration constrain very large repository initial backfills. Manual synchronization can recover missed events; production-scale scheduling/queues require operational planning.
- Preserve encryption keys securely. Rotating the token-encryption key without migration invalidates stored OAuth connections.

## Verification map

`tests/backend.test.js`: HTTP authorization and org-scoped CRUD.
`tests/github.test.js`: OAuth/install authorization, synchronization and signed webhooks.
`tests/handover.test.js`: evidence grounding, review lifecycle and role filtering.
`tests/schema.test.js`: PostgreSQL schema and RLS smoke checks using PGlite (Supabase Auth stubbed).
`tests/workflow.test.js`: integrated synthetic handover through the actual HTTP router.
`tests/web.test.js`: production Web Request adapter preserves signed bytes.
`tests/redact.test.js` and MCP tests: redaction, bootstrap/delta capture and protocol behavior.
