# GitHub App integration

`server/github.js` exports `createGithub({ store, env, fetchImpl })`. The returned service methods are `startLink`, `finishLink`, `installations`, `connect`, `sync`, and `webhook`; HTTP route authorization and the raw request-body parser belong to the calling service.

## Configuration

Set these variables in the server runtime (never the browser):

| Variable | Used for |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID used to establish a verified user identity |
| `GITHUB_CLIENT_SECRET` | Server-side OAuth code exchange |
| `GITHUB_OAUTH_CALLBACK_URL` | Exact registered OAuth callback URL |
| `GITHUB_APP_ID` | App JWT issuer for repository synchronization |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App PEM private key; literal `\\n` line breaks are accepted |
| `GITHUB_WEBHOOK_SECRET` | HMAC-SHA256 webhook verification secret |
| `GITHUB_API_URL` | Optional GitHub REST API base URL (defaults to `https://api.github.com`) |

Install the GitHub App with read access to repository metadata, contents, issues, and pull requests. Configure webhook subscriptions for `push`, `pull_request`, and `issues`, and set the webhook secret to the server's `GITHUB_WEBHOOK_SECRET`. Configure the OAuth App callback to exactly match `GITHUB_OAUTH_CALLBACK_URL`; the OAuth account requests `read:user,repo` so the service can verify which installations and repositories the user may access.

The application store must support the existing asynchronous `list(table, filters)`, `get(table, id)`, `insert(table, record)`, `update(table, id, patch)`, and `remove(table, id)` contract and provide `github_states`, `github_accounts`, `github_deliveries`, `repositories`, and `sources` tables. State rows hold hashed OAuth state and expiry. Account rows hold the OAuth access token and must remain server-only. Repository rows use `org_id`, `full_name`, `installation_id`, and `last_synced_at`; source rows use the shared team-visible source shape. The module imports the shared `redactData` from `server/redact.js` before persisting source content and metadata.

## Service flow

1. An authenticated application route calls `startLink({ userId, orgId })` and redirects to its returned `url`.
2. The configured callback forwards `code` and `state` to `finishLink`. OAuth state is random, stored hashed, expires after ten minutes, and is removed before code exchange. The result contains only `{ orgId, userId, login }`; tokens stay in server-side `github_accounts` records.
3. Call `installations({ userId, orgId })` to list installations visible to that linked GitHub identity. `connect({ userId, orgId, installationId, fullName })` independently checks both the installation and repository through GitHub's user-authorized endpoints before storing a connection.
4. Call `sync({ repository, actorId })` for a connected repository. It uses a short-lived App JWT to mint an installation token and paginates commits, all PR states (including closed and merged), PR file metadata, and issues. Source writes are idempotent by repository and external ID.
5. Forward the webhook's **unparsed** body and headers to `webhook({ rawBody, headers })`. It verifies `x-hub-signature-256` before parsing, only updates already-connected repositories matching the installation, and records delivery IDs after processing succeeds.

The service layer must scope all user-facing routes by authenticated user and organization, authorize webhook delivery separately, and apply its own request limits and error mapping. Never serialize `github_accounts` records or installation tokens into API responses or logs. Webhook middleware must retain the exact raw body for signature validation. `returnUrl` is intentionally not used as an OAuth redirect; callback and post-link navigation must be controlled by the server rather than caller-supplied redirect targets.

