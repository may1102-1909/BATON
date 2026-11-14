# GitHub integration

`server/github.js` exports `createGithub({ store, env, fetchImpl })` with `startLink`, `finishLink`, `installations`, `repositories`, `connect`, `sync` and `webhook`. `server/app.js` provides the HTTP routes, authorization and the raw request-body handling the webhook needs.

## Configuration

Set these in the server runtime (never the browser):

| Variable | Used for |
| --- | --- |
| `PUBLIC_APP_URL` | Public base URL; the OAuth redirect URI is `<PUBLIC_APP_URL>/api/github/callback` and must match the registered callback |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth code exchange that links a member's GitHub account |
| `GITHUB_APP_ID` | App JWT issuer used to mint installation tokens for sync |
| `GITHUB_APP_PRIVATE_KEY` (or `GITHUB_PRIVATE_KEY`) | App PEM private key; literal `\n` line breaks are accepted |
| `GITHUB_WEBHOOK_SECRET` | HMAC-SHA256 secret for `x-hub-signature-256` |
| `GITHUB_APP_SLUG` | Optional. Builds `https://github.com/apps/<slug>/installations/new` for error messages and `/api/health` (`githubInstallUrl`) |
| `TOKEN_ENCRYPTION_KEY` | Base64 of 32 bytes; encrypts stored OAuth tokens (AES-256-GCM) |
| `GITHUB_API_URL` | Optional REST base URL (defaults to `https://api.github.com`) |

Install the GitHub App with read access to repository metadata, contents, issues and pull requests, and subscribe to `push`, `pull_request` and `issues`. The OAuth step requests `read:user,repo` so the service can check which installations and repositories the linked user can reach.

## Data model

Uses `github_states` (hashed single-use OAuth state, 10-minute expiry), `github_accounts` (encrypted token, one per user and organization), `github_deliveries` (processed webhook delivery ids), `repositories` and `sources`. A repository row holds `org_id`, lower-cased `full_name`, `installation_id` and `last_synced_at`; `installation_id` is `null` when the repository was connected with the linked user's own token. Source rows use the shared source shape with types `commit`, `pull_request`, `issue` or `branch`, a `metadata.kind`, and `external_id` `github:<owner/name>:<kind>:<id>`, which is unique per organization and repository, so re-syncing updates instead of duplicating. GitHub authors map to members only through a matching `members.github_login`; otherwise `author_id` is null and the login is kept. Content is passed through `redactData` before it is stored. Tokens are never logged or returned.

## Flow

1. `GET /api/orgs/:id/github/connect` (admin) returns the GitHub authorize URL. GitHub redirects the browser to `/api/github/callback`, which needs no bearer token: the one-use state identifies the user. The browser always lands on `/dashboard?github=linked` or `/dashboard?github=error&reason=<code>`.
2. `GET /api/orgs/:id/github/installations` lists installations the linked user can access (all pages). `GET /api/orgs/:id/github/installations/:installationId/repositories` lists the repositories one installation covers (all pages).
3. `POST /api/orgs/:id/repositories` connects a repository. Body `{ fullName | full_name, installationId? | installation_id? }`.
   - With an installation id, the repository must be covered by that installation.
   - Without one, every installation the user can access is searched (the one owned by the repository's owner first); if none covers it, the linked user's token is tried against `GET /repos/{owner}/{name}`, which works for public repositories and ones that user can read.
   - If neither works the API answers 400 with `Repository … was not found or the linked GitHub account cannot read it, and the GitHub App is not installed on it. Install the GitHub App on it (<install URL>) or choose another repository.`
   - The response is the repository row plus `access`: `installation` or `user`. Connecting the same repository again updates the existing row (case-insensitive) rather than adding another; any number of repositories can be connected to one organization.
4. `POST /api/orgs/:id/repositories/:repoId/sync` imports up to 300 commits, 200 pull requests (with changed files for the newest 50), 200 issues and 50 branches, and updates `last_synced_at`. Empty repositories and repositories with issues disabled sync cleanly. `truncated: true` is returned when GitHub has more than the limits. Installation-based repositories mint a short-lived installation token; user-token repositories use the syncing admin's linked token (they must have linked GitHub in that organization).
5. `DELETE /api/orgs/:id/repositories/:repoId` disconnects the repository and deletes the sources synced from it.
6. `POST /api/github/webhook` verifies the signature over the raw body before parsing and records each delivery once. A repository connected in several organizations updates all of them. Repositories connected with a user token have no installation and receive no webhooks.

## Errors

| Situation | Status |
| --- | --- |
| GitHub account not linked, GitHub link expired (token rejected), app not installed or suspended, repository renamed or deleted | 409 |
| Repository not accessible through the installation, not readable by the linked user, bad `owner/name` | 400 |
| GitHub rate limit | 429 |
| Missing server GitHub configuration | 503 |
| Invalid webhook signature or payload | 401 |

Never serialize `github_accounts` records or installation tokens into responses or logs.
