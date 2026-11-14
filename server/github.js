import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, sign, timingSafeEqual } from 'node:crypto';
import { redactData } from './redact.js';

const API_URL = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const STATE_TTL_MS = 10 * 60 * 1000;

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}`);
  return value.trim();
}

function normalizeFullName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error('Repository must be in owner/name format');
  }
  return value.toLowerCase();
}

function repositoryPath(fullName) {
  return normalizeFullName(fullName).split('/').map(encodeURIComponent).join('/');
}

function responseHeader(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name);
  const key = Object.keys(headers ?? {}).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function asDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function createGithub({ store, env = process.env, fetchImpl = fetch }) {
  if (!store || !['list', 'get', 'insert', 'update', 'remove'].every((method) => typeof store[method] === 'function')) {
    throw new TypeError('store must implement list, get, insert, update, and remove');
  }
  const consumedStates = new Map();

  async function request(path, { token, method = 'GET', body, accept = 'application/vnd.github+json' } = {}) {
    const base = (env.GITHUB_API_URL || API_URL).replace(/\/$/, '');
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        accept,
        'x-github-api-version': API_VERSION,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const message = typeof data?.message === 'string' ? data.message : `GitHub API returned ${response.status}`;
      throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${message}`);
    }
    return data;
  }

  async function paginate(path, token) {
    const results = [];
    for (let page = 1; ; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const response = await request(`${path}${separator}per_page=100&page=${page}`, { token });
      const collectionKey = path === '/user/installations'
        ? 'installations'
        : path.startsWith('/user/installations/') && path.endsWith('/repositories')
          ? 'repositories'
          : null;
      const pageItems = Array.isArray(response) ? response : response?.[collectionKey];
      if (!Array.isArray(pageItems)) throw new Error(`Expected a list from GitHub API ${path}`);
      results.push(...pageItems);
      if (pageItems.length < 100) return results;
    }
  }

  function appJwt() {
    const appId = required(env, 'GITHUB_APP_ID');
    const rawKey = env.GITHUB_APP_PRIVATE_KEY || env.GITHUB_PRIVATE_KEY || '';
    if (!rawKey) throw new Error('Missing GITHUB_APP_PRIVATE_KEY');
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 8 * 60, iss: appId })).toString('base64url');
    const unsigned = `${header}.${payload}`;
    return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  }

  async function installationToken(installationId) {
    const result = await request(`/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
      token: appJwt(), method: 'POST', body: {},
    });
    if (!result?.token) throw new Error('GitHub did not return an installation token');
    return result.token;
  }

  async function accountFor(userId, orgId) {
    const rows = await store.list('github_accounts', { user_id: userId, org_id: orgId });
    const account = rows[0] ?? null;
    return account ? { ...account, access_token: decryptToken(account.access_token_encrypted) } : null;
  }

  function encryptionKey() {
    const encoded = required(env, 'TOKEN_ENCRYPTION_KEY');
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be canonical base64 encoding of exactly 32 bytes');
    }
    return key;
  }

  function encryptToken(token) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
  }

  function decryptToken(encrypted) {
    if (typeof encrypted !== 'string') throw new Error('Stored GitHub account token is not encrypted');
    const [version, iv64, tag64, ciphertext64, extra] = encrypted.split(':');
    if (version !== 'v1' || !iv64 || !tag64 || !ciphertext64 || extra !== undefined) {
      throw new Error('Stored GitHub account token has an unsupported encrypted format');
    }
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv64, 'base64'));
    decipher.setAuthTag(Buffer.from(tag64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext64, 'base64')), decipher.final()]).toString('utf8');
  }

  async function upsertSource(repository, source) {
    const members = source.author_login
      ? await store.list('members', { org_id: repository.org_id })
      : [];
    const author = members.find((member) => !member.disabled_at &&
      typeof member.github_login === 'string' && member.github_login.toLowerCase() === source.author_login.toLowerCase());
    const record = redactData({
      org_id: repository.org_id,
      repository_id: repository.id,
      author_id: author?.user_id ?? null,
      author: source.author_login ?? 'GitHub',
      author_login: source.author_login ?? null,
      type: source.type,
      content: (source.content ?? '').slice(0, 100_000),
      metadata: source.metadata ?? {},
      external_id: source.external_id,
      url: source.url ?? null,
      created_at: asDate(source.created_at),
      visibility: 'team',
    });
    const matches = await store.list('sources', {
      org_id: record.org_id,
      repository_id: record.repository_id,
      external_id: record.external_id,
    });
    if (matches.length) return store.update('sources', matches[0].id, record);
    return store.insert('sources', record);
  }

  function commitSource(repository, commit) {
    const author = commit.author ?? {};
    const details = commit.commit ?? {};
    return {
      external_id: `github:${repository.full_name}:commit:${commit.sha}`,
      author_id: author.id == null ? null : String(author.id),
      author_login: author.login ?? details.author?.name ?? null,
      type: 'commit',
      content: details.message ?? '',
      url: commit.html_url,
      created_at: details.author?.date,
      metadata: { kind: 'commit', sha: commit.sha, author, committer: commit.committer ?? null, url: commit.html_url },
    };
  }

  function pullRequestSource(repository, pr, files = []) {
    const author = pr.user ?? {};
    return {
      external_id: `github:${repository.full_name}:pull_request:${pr.number}`,
      author_id: author.id == null ? null : String(author.id),
      author_login: author.login ?? null,
      type: 'pull_request',
      content: [pr.title, pr.body].filter(Boolean).join('\n\n'),
      url: pr.html_url,
      created_at: pr.created_at,
      metadata: {
        kind: 'pull_request', number: pr.number, title: pr.title, state: pr.state, merged: Boolean(pr.merged_at),
        merged_at: pr.merged_at ?? null, draft: Boolean(pr.draft), head_sha: pr.head?.sha ?? null,
        base_ref: pr.base?.ref ?? null, head_ref: pr.head?.ref ?? null,
        updated_at: pr.updated_at ?? null, closed_at: pr.closed_at ?? null,
        author, url: pr.html_url, files,
      },
    };
  }

  function issueSource(repository, issue) {
    const author = issue.user ?? {};
    return {
      external_id: `github:${repository.full_name}:issue:${issue.number}`,
      author_id: author.id == null ? null : String(author.id),
      author_login: author.login ?? null,
      type: 'issue',
      content: [issue.title, issue.body].filter(Boolean).join('\n\n'),
      url: issue.html_url,
      created_at: issue.created_at,
      metadata: {
        kind: 'issue', number: issue.number, title: issue.title, state: issue.state,
        updated_at: issue.updated_at ?? null, closed_at: issue.closed_at ?? null,
        author, url: issue.html_url,
      },
    };
  }

  async function persistPullRequest(repository, pr, token, withFiles = true) {
    const files = withFiles
      ? await paginate(`/repos/${repositoryPath(repository.full_name)}/pulls/${pr.number}/files`, token)
      : [];
    await upsertSource(repository, pullRequestSource(repository, pr, files.map((file) => ({
      filename: file.filename, status: file.status, additions: file.additions, deletions: file.deletions,
      changes: file.changes, previous_filename: file.previous_filename ?? null,
      blob_url: file.blob_url ?? null,
    }))));
  }

  async function startLink({ userId, orgId }) {
    if (!userId || !orgId) throw new TypeError('userId and orgId are required');
    const clientId = required(env, 'GITHUB_CLIENT_ID');
    const publicAppUrl = new URL(required(env, 'PUBLIC_APP_URL'));
    if (!['https:', 'http:'].includes(publicAppUrl.protocol) || publicAppUrl.username || publicAppUrl.password ||
      publicAppUrl.search || publicAppUrl.hash) throw new Error('PUBLIC_APP_URL must be an HTTP(S) base URL without credentials, query, or fragment');
    const redirectPath = `${publicAppUrl.pathname.replace(/\/+$/, '')}/api/github/callback`;
    const redirectUri = new URL(redirectPath, publicAppUrl.origin).toString();
    const state = randomBytes(32).toString('base64url');
    const now = Date.now();
    await store.insert('github_states', {
      state_hash: createHash('sha256').update(state).digest('hex'),
      user_id: userId, org_id: orgId, expires_at: new Date(now + STATE_TTL_MS).toISOString(),
      created_at: new Date(now).toISOString(),
    });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'read:user,repo');
    url.searchParams.set('state', state);
    return { url: url.toString() };
  }

  async function finishLink({ code, state }) {
    if (typeof code !== 'string' || !code || typeof state !== 'string' || !state) throw new TypeError('code and state are required');
    const hash = createHash('sha256').update(state).digest('hex');
    for (const [usedHash, expiresAt] of consumedStates) {
      if (expiresAt <= Date.now()) consumedStates.delete(usedHash);
    }
    if (consumedStates.has(hash)) throw new Error('OAuth state is invalid or has already been used');
    const states = await store.list('github_states', { state_hash: hash });
    const pending = states[0];
    if (!pending || new Date(pending.expires_at).getTime() <= Date.now()) {
      if (pending) await store.remove('github_states', pending.id);
      throw new Error('OAuth state is invalid or expired');
    }
    consumedStates.set(hash, Date.now() + STATE_TTL_MS);
    const consumed = await store.remove('github_states', pending.id);
    if (!consumed) throw new Error('OAuth state is invalid or has already been used');

    const clientId = required(env, 'GITHUB_CLIENT_ID');
    const clientSecret = required(env, 'GITHUB_CLIENT_SECRET');
    encryptionKey();
    const tokenResponse = await fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(`GitHub OAuth exchange failed${tokenData.error_description ? `: ${tokenData.error_description}` : ''}`);
    }
    const user = await request('/user', { token: tokenData.access_token });
    if (!user?.id || !user?.login) throw new Error('GitHub did not return a valid user identity');
    const memberships = await store.list('members', { org_id: pending.org_id, user_id: pending.user_id });
    const membership = memberships.find((member) => !member.disabled_at);
    if (!membership) throw new Error('An active organization membership is required to link GitHub');
    if (membership.github_login && membership.github_login.toLowerCase() !== user.login.toLowerCase()) {
      throw new Error('This member is already linked to a different GitHub login; disconnect it before relinking');
    }
    const owners = (await store.list('members', { org_id: pending.org_id })).filter((member) =>
      !member.disabled_at && member.user_id !== pending.user_id &&
      typeof member.github_login === 'string' && member.github_login.toLowerCase() === user.login.toLowerCase());
    if (owners.length) throw new Error('This GitHub login is already linked to another organization member');
    const current = await accountFor(pending.user_id, pending.org_id);
    if (current && (String(current.github_user_id) !== String(user.id) ||
      current.github_login.toLowerCase() !== user.login.toLowerCase())) {
      throw new Error('This member is already linked to a different GitHub account; disconnect it before relinking');
    }
    if (!membership.github_login) {
      await store.update('members', membership.id, { github_login: user.login });
    }
    const now = new Date().toISOString();
    const account = {
      user_id: pending.user_id, org_id: pending.org_id, github_user_id: String(user.id),
      github_login: user.login, access_token_encrypted: encryptToken(tokenData.access_token),
      token_type: tokenData.token_type ?? 'bearer', scope: tokenData.scope ?? '', updated_at: now,
      ...(current ? {} : { created_at: now }),
    };
    if (current) await store.update('github_accounts', current.id, account);
    else await store.insert('github_accounts', account);
    return { orgId: pending.org_id, userId: pending.user_id, login: user.login };
  }

  async function installations({ userId, orgId }) {
    const account = await accountFor(userId, orgId);
    if (!account) throw new Error('Link a GitHub account before listing installations');
    const list = await paginate('/user/installations', account.access_token);
    return list.map((item) => ({
      id: item.id, account: item.account ? { login: item.account.login, type: item.account.type } : null,
      repository_selection: item.repository_selection,
    }));
  }

  async function repositories({ userId, orgId, installationId }) {
    if (!userId || !orgId || installationId == null) throw new TypeError('userId, orgId, and installationId are required');
    const account = await accountFor(userId, orgId);
    if (!account) throw new Error('Link a GitHub account before listing repositories');
    const repos = await paginate(`/user/installations/${encodeURIComponent(installationId)}/repositories`, account.access_token);
    return repos.filter((repo) => typeof repo.full_name === 'string')
      .map((repo) => ({ full_name: repo.full_name, private: Boolean(repo.private), default_branch: repo.default_branch ?? null }));
  }

  async function connect({ userId, orgId, installationId, fullName }) {
    if (!userId || !orgId || installationId == null) throw new TypeError('userId, orgId, and installationId are required');
    const account = await accountFor(userId, orgId);
    if (!account) throw new Error('Link a GitHub account before connecting a repository');
    const name = normalizeFullName(fullName);
    const authorizedInstallations = await paginate('/user/installations', account.access_token);
    const installation = authorizedInstallations.find((item) => String(item.id) === String(installationId));
    if (!installation) throw new Error('GitHub installation is not accessible to the linked user');
    const repos = await paginate(`/user/installations/${encodeURIComponent(installationId)}/repositories`, account.access_token);
    if (!repos.some((repo) => typeof repo.full_name === 'string' && repo.full_name.toLowerCase() === name)) {
      throw new Error('Repository is not accessible through the authorized GitHub installation');
    }
    const rows = await store.list('repositories', { org_id: orgId, full_name: name });
    const data = { org_id: orgId, full_name: name, installation_id: String(installationId) };
    if (rows.length) return store.update('repositories', rows[0].id, data);
    return store.insert('repositories', { ...data, last_synced_at: null });
  }

  async function sync({ repository, actorId }) {
    if (!repository?.id || !repository.org_id || !repository.full_name || !repository.installation_id) {
      throw new TypeError('A connected repository record is required');
    }
    const fullName = normalizeFullName(repository.full_name);
    const current = await store.get('repositories', repository.id);
    if (!current || current.org_id !== repository.org_id || current.full_name !== repository.full_name) {
      throw new Error('Repository is not connected in the store');
    }
    const token = await installationToken(repository.installation_id);
    let commits = 0, pullRequests = 0, issues = 0;
    const repoPath = repositoryPath(fullName);
    const commitList = await paginate(`/repos/${repoPath}/commits`, token);
    for (const commit of commitList) {
      await upsertSource(current, commitSource(current, commit));
      commits += 1;
    }
    const prs = await paginate(`/repos/${repoPath}/pulls?state=all&sort=updated&direction=desc`, token);
    for (const pr of prs) {
      await persistPullRequest(current, pr, token);
      pullRequests += 1;
    }
    const allIssues = await paginate(`/repos/${repoPath}/issues?state=all&sort=updated&direction=desc`, token);
    for (const issue of allIssues) {
      if (issue.pull_request) continue;
      await upsertSource(current, issueSource(current, issue));
      issues += 1;
    }
    await store.update('repositories', current.id, { last_synced_at: new Date().toISOString() });
    return { commits, pullRequests, issues, actorId: actorId ?? null };
  }

  function verifyWebhook(rawBody, headers) {
    const secret = required(env, 'GITHUB_WEBHOOK_SECRET');
    const signature = responseHeader(headers, 'x-hub-signature-256');
    if (typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
    const actual = Buffer.from(signature.toLowerCase());
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  async function webhook({ rawBody, headers }) {
    if (!(typeof rawBody === 'string' || Buffer.isBuffer(rawBody))) throw new TypeError('rawBody must be the unparsed request body');
    if (!verifyWebhook(rawBody, headers)) throw new Error('Invalid GitHub webhook signature');
    const deliveryId = responseHeader(headers, 'x-github-delivery');
    const event = responseHeader(headers, 'x-github-event');
    if (!deliveryId || !event) throw new Error('GitHub webhook delivery and event headers are required');
    let payload;
    try { payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody); }
    catch { throw new Error('Invalid GitHub webhook JSON body'); }
    let delivery;
    try {
      delivery = await store.insert('github_deliveries', { delivery_id: deliveryId, event, status: 'processing' });
    } catch (error) {
      const duplicate = await store.list('github_deliveries', { delivery_id: deliveryId });
      if (duplicate.length) return { processed: false, duplicate: true };
      throw error;
    }
    try {
    const name = payload.repository?.full_name;
    if (!name || !['push', 'pull_request', 'issues'].includes(event)) {
      await store.update('github_deliveries', delivery.id, { status: 'ignored', result: 'unsupported_event', processed_at: new Date().toISOString() });
      return { processed: false, reason: 'unsupported_event' };
    }
    const repos = await store.list('repositories', { full_name: name.toLowerCase() });
    const repo = repos.find((item) => String(item.installation_id) === String(payload.installation?.id));
    if (!repo) {
      await store.update('github_deliveries', delivery.id, { status: 'ignored', result: 'repository_not_connected', processed_at: new Date().toISOString() });
      return { processed: false, reason: 'repository_not_connected' };
    }
    let count = 0;
    const actor = payload.sender ?? {};
    if (event === 'push') {
      for (const commit of payload.commits ?? []) {
        await upsertSource(repo, {
          external_id: `github:${name.toLowerCase()}:commit:${commit.id}`,
          author_id: null, author_login: commit.author?.username ?? null, type: 'commit',
          content: commit.message ?? '', url: `https://github.com/${name}/commit/${commit.id}`, created_at: commit.timestamp,
          metadata: { kind: 'commit', sha: commit.id, author: commit.author ?? null, committer: commit.committer ?? null,
            added: commit.added ?? [], removed: commit.removed ?? [], modified: commit.modified ?? [],
            sender: actor.login ?? null },
        });
        count += 1;
      }
    } else if (event === 'pull_request' && payload.pull_request) {
      await upsertSource(repo, pullRequestSource(repo, payload.pull_request, []));
      count = 1;
    } else if (event === 'issues' && payload.issue && !payload.issue.pull_request) {
      await upsertSource(repo, issueSource(repo, payload.issue));
      count = 1;
    }
    await store.update('github_deliveries', delivery.id, {
      repository_id: repo.id, status: 'processed', processed_at: new Date().toISOString(), result: { count },
    });
    return { processed: true, count };
    } catch (error) {
      await store.remove('github_deliveries', delivery.id).catch(() => {});
      throw error;
    }
  }

  return { startLink, finishLink, installations, repositories, connect, sync, webhook };
}
