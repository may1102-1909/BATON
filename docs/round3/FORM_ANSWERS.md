# BATON — Round 3 form answers (Team Mumbai_wale)

Copy each block into the matching field of the form.

---

## The complete list of features

Live: https://baton-nu.vercel.app · No-login demo: https://baton-nu.vercel.app/demo-page

GitHub App connection: commits, pull requests, issues and branches (ahead/behind) captured from your repositories
Signed GitHub webhooks (HMAC-verified, idempotent) keep the repository memory up to date
Repository picker limited to your own account and organisations; connect and disconnect any repository
Baton MCP server with 11 tools for Claude Code, Google Antigravity and Cursor
One-command setup (baton init) that writes the IDE configs and a git post-commit hook
Conversation sync (sync_history): decisions and blockers from Claude Code / Antigravity sessions are saved as memory
Memory and decision log with semantic search (pgvector)
Secret redaction twice: in the MCP client before anything leaves the laptop, and on the server before storage and before any AI call
Risk-ranked exit interview (up to 10 questions), each showing why it was asked
Deterministic conflict detection (e.g. task deadline 10 Nov vs. comment 15 Nov) with admin resolution
Handover claims labelled Verified / Inferred / Missing / Conflicting, each with a citation
Citations checked after generation; unsupported claims are downgraded automatically
AI drafting with Gemini, with an evidence-only fallback when no model is available
Admin review: edit, approve or reject claims; versions, side-by-side diff, publish, acknowledge
Bus-factor alerts ("only one person has changed server/") with one-click Start handover
"Who knows what" contribution matrix per module and contributor
Role-filtered handover packet (backend, frontend, infra, data, design, product) with cited newcomer Q&A
Markdown export (website and MCP export_handover) and PDF export
Multiple workspaces with admin/member roles and single-use, expiring invite links
Team / admin / private visibility enforced inside the database (Postgres Row-Level Security)
Per-member MCP tokens: hashed, scoped and revocable (revoking withdraws the handover)
Tasks with priority, assignee, deadline and comment threads
Workspace settings, typed confirmations, data reset and workspace deletion
Sign in with GitHub, followed by a guided setup page (/usage)
No-login demo on BATON's own repository, including the Antigravity → MCP → handover flow
Outage handling: clear "Database unavailable" message with a working Retry button

---

## Technical architecture and implementation summary

Components. BATON has two capture layers feeding one handover engine. (1) The Baton MCP server (TypeScript, stdio) runs inside AI IDEs — Claude Code, Antigravity, Cursor — and records decisions, blockers and conversation history. (2) A GitHub App (OAuth + signed webhooks) captures commits, PRs, issues and branches. People add the rest through the React workspace: exit-interview answers, tasks, threads and admin review.

Data flow. Everything is redacted twice (client-side in the MCP server, server-side before storage and before any AI call) and authenticated (Supabase JWT for users, hashed scoped baton_ tokens for agents). The Node.js API (one ESM handler that runs on Vercel serverless and locally) stores evidence in Supabase Postgres with pgvector. The handover engine finds gaps, scores risk, detects conflicts, drafts claims with citations, validates the citations and versions the result. An admin reviews, resolves conflicts and approves; the successor gets a role-filtered packet with cited Q&A, exportable as Markdown or PDF.

Models and APIs. Google Gemini 2.5 Flash drafts text, answers Q&A and produces embeddings; it is optional, and BATON falls back to evidence-only output without it. Risk scoring and conflict detection are deterministic code, not AI, so every score is reproducible and an AI outage never changes a risk label. External APIs: GitHub REST + webhooks, Supabase Auth, Gemini, Model Context Protocol.

Infrastructure. React 18 + Vite 6 frontend and Node.js 20 API on Vercel; Supabase (Postgres, Auth, pgvector, Row-Level Security on every table, schema + 5 migrations); GitHub Actions CI running build, unit/database tests and Playwright end-to-end tests on every pull request. The no-login demo runs the same production engine against an in-memory store, so judges see real behaviour without accounts or credentials.

Hardest problem. Making AI-written handovers trustworthy. An AI will confidently write claims that nothing supports, and a leaked secret or another team's private note in a handover is worse than no handover. We solved it in three layers: secrets are removed before the data ever reaches the server or the model; permissions are enforced inside the database (RLS plus role and visibility filtering inside the search function), so an API bug cannot leak evidence; and after generation every claim is checked against its cited source — if the source does not exist or the reader cannot see it, the claim is downgraded to Inferred or Missing. A Postgres lock also stops two serverless instances from generating the same handover twice.

---

## Testing details

What and how. 149 automated tests, all passing on the submitted main branch (16 Nov 2026), up from 31 in Round 2:
- 117 unit and integration tests (Node test runner): risk scoring, conflict detection, bus-factor thresholds, role audiences, handovers scoped to the leaving member's own work, versions/diffs, citation rules, invites, token scoping and revocation, webhook signatures, GitHub sync and OAuth security, cross-organisation isolation, outage handling, and the demo engine.
- Database tests that apply our real schema to an in-process Postgres + pgvector (PGlite) and check Row-Level Security and role visibility inside SQL.
- An integration test that runs the real MCP server over stdio against the API (save, search, interview, export, outage message).
- 26 Playwright end-to-end tests in Chromium covering the main journeys: demo without sign-in, MCP token → handover → resolve conflict → Markdown/PDF export, GitHub connect/disconnect, team invites, settings, and a database outage on first load that recovers with Retry.
- 6 MCP server tests: redaction of keys, JWTs and high-entropy strings; scoping; de-duplication.
CI (GitHub Actions) runs the build, unit/database and end-to-end suites on every pull request; no Round 3 PR was merged with a failing check. Manual and usability testing (test plan, synthetic off-boarding scenario with planted secrets, walkthroughs of the main journeys) was owned by Komal Chaurasiya.

What we found and fixed. An audit at the start of Round 3 found: an API token committed to the repository (removed), new sign-ups becoming admins of the first workspace (fixed), the handover screen wired to the wrong API shape and a risk card that always said "no risk" (both fixed). Testing also led to: invites no longer consumed by a wrong user, one bad GitHub record no longer failing the whole sync, private-key format handling, a 503 message plus Retry for database outages, duplicate handover generation blocked across serverless instances, and a pop-up that blocked clicks caught by CI and fixed in the same PR.

Still imperfect. Redaction is pattern- and entropy-based, so it lowers risk but cannot guarantee every secret is caught. Claims are checked against cited source text, not against code structure. Very large repositories are capped per sync (300 commits, 200 PRs, 200 issues, 50 branches) instead of paged. Claude Code and Antigravity were verified live; Cursor follows its documentation but was not verified live. The MCP server's own 6 tests are not yet in CI. The no-login demo replays a recorded Antigravity session, because a browser cannot reach the judge's IDE.

---

## Improvement 1 — what you committed to, and what you delivered

Committed (Round 2): risk-ranked exit interviews — questions sorted strictly by risk, with bus-factor-1 modules and unmerged branches first — and deterministic conflict detection, e.g. a task vs. thread deadline mismatch.

Delivered: yes, in full. server/risk.js scores each knowledge gap from documented weights — module touched by only one person, open PR, active blocker, decision without a reason, branch ahead of base — capped at 100 and labelled high/medium/low. The exit interview shows up to 10 questions in that order, each with its reason shown, and only about the leaving member's own work (in the demo, Vikrant's landing-page shader and /usage page). server/conflicts.js finds date disagreements between a task and its comments without any AI (demo: the walkthrough task says 10 Nov, a comment says 15 Nov). BATON never picks a winner: only an admin can resolve a conflict, and the resolution becomes a cited claim; export stays disabled until it is resolved. Try it at baton-nu.vercel.app/demo-page (no login). Tests: tests/round3.test.js, e2e/handover.spec.js.

---

## Improvement 2 — what you committed to, and what you delivered

Committed (Round 2): a bus-factor dashboard on the main workspace with per-member contribution summaries and early-warning alerts ("only 1 person has touched /payments").

Delivered: yes, in full. The Overview has a "who knows what" matrix — changes and share per module × contributor, a bus-factor column and sole-owner highlighting — built from the real GitHub history. Bus-factor alerts name the module and the only person who has changed it (e.g. "only one person has changed server/") and have a one-click Start handover button. To avoid noise, an alert needs at least 3 changes and clears automatically when a second contributor appears. Tests: tests/round3.test.js (thresholds and clearing).

---

## Improvement 3 — what you committed to, and what you delivered

Committed (Round 2): role-based newcomer Q&A with cited answers and a version-history UI — a role-filtered handover packet in the main app, role filters (Backend, Infra, Admin), a v1/v2 diff viewer, and Playwright end-to-end tests.

Delivered: yes, and slightly beyond. Instead of three fixed filters, handovers support six function roles (backend, frontend, infra, data, design, product) plus admin visibility, enforced both in the API and inside Postgres (the match_memory search function), so a newcomer only sees evidence for their role. The packet page /handover/:id has newcomer Q&A where every answer cites its sources, the version history and a side-by-side diff between versions. Playwright was added with 26 end-to-end tests running in CI on every pull request. Tests: tests/round3.test.js, tests/schema.test.js (role visibility in SQL), e2e/.

---

## Anything else you improved after Round 2

Yes — 34 pull requests merged in Round 3 (#12–#45):
- Security and correctness audit: removed an API token committed to the repo; sign-ups no longer become admins of an existing workspace; handover and risk screens wired to the real API.
- Live product: sign in with GitHub → guided setup page; connect any of your repositories; workspace management, settings and deletion; team invites; handovers only start after an MCP token exists and only for real contributors.
- MCP: Markdown export from the IDE (export_handover), Claude Code and Antigravity setup via one command, conversation sync; Antigravity verified live against production.
- Reliability: database outage → clear message + Retry; GitHub sync survives bad records and different private-key formats; cross-instance lock against duplicate handover generation; idempotent webhooks and de-duplicated agent events.
- Tests and CI: from 31 to 149 automated tests, real-Postgres schema tests, Playwright end-to-end tests, GitHub Actions on every PR.
- No-login demo rebuilt on BATON's own repository with the production engine: token → Antigravity memory → risk-ranked handover → resolve conflict → PDF/Markdown export.
- Handovers now cover only the leaving member's own work (their commits, PRs and notes on the folders they changed); the demo shows Vikrant GP (frontend) handing over to Krishna Gupta, built from Vikrant's real commits.
- GitHub-style interface (system fonts, sentence-case labels, /usage redesigned), every screen fits a phone, and the 3D landing page runs on phones and tablets too.
- Security review: database rules now limit handovers to admins and the two people involved, hide draft and admin-only claims, and keep agent transcripts private to their author; an additive migration upgrades older production handover tables.

---

## Product roadmap and future development plan

Goal: one handover for every departure, in every department. Today, when anyone leaves a company, the handover is a rushed PDF, an email and a list of links, and every team does it differently. BATON already does this for software teams; next it reads the work where it already lives (Jira, Slack, Drive, CRM), asks the person leaving only about the gaps, and gives the successor one cited handover in the same format for every role.

Who it is for: HR and engineering leaders at 20–500-person companies, where one departure can stall a product line or a client account. We start with software teams (already working) and expand department by department.

In order:
1. Weeks 1–2 — finish engineering handovers: verify production migrations (0.25 h), live Cursor verification (0.5 h), page large GitHub syncs instead of capping them (3 h), MCP tests and lint in CI (1 h), remote MCP over HTTP so no local install is needed (1–2 days).
2. Months 1–3 — office connectors on the same pipeline: Jira and Linear tickets, owners, status and comments (2–3 days); Slack and Microsoft Teams decisions and blockers from the person's channels (3–4 days); Google Drive, Confluence and Notion docs they own (2–3 days each); email and calendar for recurring meetings and external contacts (3 days); handovers that update continuously, so they are ready the day notice is given.
3. Quarter 2+ — whole company: handover templates per department (sales accounts and deals from Salesforce/HubSpot, support, operations, HR); HR-system triggers (Workday, BambooHR, Keka) that start the handover on resignation; one-click transfer of tickets, channels and files to the successor; company-wide knowledge-risk map; SSO, SCIM, audit log, retention and self-hosting for enterprises.

What it takes: the engine is already source-neutral — every input becomes a typed, redacted, permission-checked source record, and risk scoring, conflict detection, citations and approval work the same whatever the source. GitHub and the MCP server are the first two connectors; each new one is a connector plus a source type, not a rebuild. Business model: free for one repository, per-seat plan with all connectors, enterprise plan with SSO, HR integration and self-hosting.
