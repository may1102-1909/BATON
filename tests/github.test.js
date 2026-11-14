import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, createHmac, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createGithub, readPrivateKey } from '../server/github.js';

function makeStore(seed = {}) {
  const tables = structuredClone(seed);
  let nextId = 1;
  return {
    async list(table, filters = {}) {
      return structuredClone((tables[table] ?? []).filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value)));
    },
    async get(table, id) {
      return structuredClone((tables[table] ?? []).find((row) => row.id === id) ?? null);
    },
    async insert(table, record) {
      tables[table] ??= [];
      if (table === 'github_deliveries' && tables[table].some((row) => row.delivery_id === record.delivery_id)) {
        throw new Error('duplicate key violates github_deliveries_delivery_id_key');
      }
      const row = { id: `row-${nextId++}`, ...structuredClone(record) };
      tables[table].push(row);
      return structuredClone(row);
    },
    async update(table, id, patch) {
      const rows = tables[table] ?? [];
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return null;
      rows[index] = { ...rows[index], ...structuredClone(patch), id };
      return structuredClone(rows[index]);
    },
    async remove(table, id) {
      const rows = tables[table] ?? [];
      const index = rows.findIndex((row) => row.id === id);
      return index < 0 ? null : structuredClone(rows.splice(index, 1)[0]);
    },
    rows: (table) => tables[table] ?? [],
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function environment(extra = {}) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    GITHUB_CLIENT_ID: 'oauth-client', GITHUB_CLIENT_SECRET: 'oauth-secret',
    PUBLIC_APP_URL: 'https://baton.example/',
    GITHUB_APP_ID: 'app-123', GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    GITHUB_WEBHOOK_SECRET: 'webhook-secret', GITHUB_API_URL: 'https://api.github.test',
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    ...extra,
  };
}

function encryptTokenForTest(token, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

test('OAuth state is hashed, one-use, and linked tokens are never returned', async () => {
  const store = makeStore({ members: [{ id: 'member-1', org_id: 'org-1', user_id: 'user-1' }] });
  const env = environment();
  const github = createGithub({ store, env, fetchImpl: async (url, options) => {
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: 'private-oauth-token', scope: 'repo' });
    if (url.endsWith('/user')) return json({ id: 8, login: 'octocat' });
    if (url.includes('/user/installations?')) {
      assert.equal(options.headers.authorization, 'Bearer private-oauth-token');
      return json({ installations: [] });
    }
    throw new Error(`Unexpected URL ${url}`);
  } });
  const { url } = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  const state = new URL(url).searchParams.get('state');
  assert.ok(state);
  assert.equal(new URL(url).searchParams.get('redirect_uri'), 'https://baton.example/api/github/callback');
  assert.equal(store.rows('github_states')[0].state_hash, createHash('sha256').update(state).digest('hex'));
  assert.deepEqual(await github.finishLink({ code: 'code-1', state }), { orgId: 'org-1', userId: 'user-1', login: 'octocat' });
  assert.match(store.rows('github_accounts')[0].access_token, /^v1:/);
  assert.equal(Buffer.from(store.rows('github_accounts')[0].access_token).includes(Buffer.from('private-oauth-token')), false);
  assert.equal(store.rows('members')[0].github_login, 'octocat');
  assert.deepEqual(await github.installations({ userId: 'user-1', orgId: 'org-1' }), []);
  assert.equal(Buffer.from(store.rows('github_accounts')[0].access_token).includes(Buffer.from('private-oauth-token')), false);
  await assert.rejects(github.finishLink({ code: 'code-1', state }), /already been used/);
  assert.equal(store.rows('github_states').length, 0);
});

test('OAuth cannot attach a different GitHub identity to a member', async () => {
  const store = makeStore({ members: [{ id: 'member-1', org_id: 'org-1', user_id: 'user-1', github_login: 'trusted-login' }] });
  const github = createGithub({ store, env: environment(), fetchImpl: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: '[redacted]' });
    if (url.endsWith('/user')) return json({ id: 8, login: 'different-login' });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const { url } = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  await assert.rejects(github.finishLink({ code: 'code-1', state: new URL(url).searchParams.get('state') }), /disconnect it before relinking/);
  assert.equal(store.rows('github_accounts').length, 0);
  assert.equal(store.rows('members')[0].github_login, 'trusted-login');
});

test('OAuth rejects a login already linked to another active organization member', async () => {
  const store = makeStore({ members: [
    { id: 'member-1', org_id: 'org-1', user_id: 'user-1' },
    { id: 'member-2', org_id: 'org-1', user_id: 'user-2', github_login: 'octocat' },
  ] });
  const github = createGithub({ store, env: environment(), fetchImpl: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: '[redacted]' });
    if (url.endsWith('/user')) return json({ id: 8, login: 'octocat' });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const { url } = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  await assert.rejects(github.finishLink({ code: 'code-1', state: new URL(url).searchParams.get('state') }), /already linked to another organization member/);
  assert.equal(store.rows('members')[0].github_login, undefined);
  assert.equal(store.rows('github_accounts').length, 0);
});

test('OAuth cannot overwrite an existing account linked to another GitHub identity', async () => {
  const env = environment();
  const encrypted = encryptTokenForTest('existing-token', Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64'));
  const store = makeStore({
    members: [{ id: 'member-1', org_id: 'org-1', user_id: 'user-1' }],
    github_accounts: [{ id: 'account-1', user_id: 'user-1', org_id: 'org-1', github_user_id: '7', github_login: 'old-login', access_token_encrypted: encrypted }],
  });
  const github = createGithub({ store, env, fetchImpl: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: '[redacted]' });
    if (url.endsWith('/user')) return json({ id: 8, login: 'octocat' });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const { url } = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  await assert.rejects(github.finishLink({ code: 'code-1', state: new URL(url).searchParams.get('state') }), /disconnect it before relinking/);
  assert.equal(store.rows('members')[0].github_login, undefined);
  assert.equal(store.rows('github_accounts')[0].github_login, 'old-login');
});

test('connect rejects installations and repositories not authorized to the linked user', async () => {
  const env = environment();
  const store = makeStore({ github_accounts: [{ id: 'account-1', user_id: 'u1', org_id: 'o1', access_token_encrypted: encryptTokenForTest('user-token', Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64')) }] });
  const github = createGithub({ store, env, fetchImpl: async (url) => {
    if (url.includes('/user/installations?')) return json({ total_count: 1, installations: [{ id: 41 }] });
    if (url.includes('/user/installations/41/repositories?')) return json({ total_count: 1, repositories: [{ full_name: 'acme/allowed' }] });
    throw new Error(`Unexpected URL ${url}`);
  } });
  await assert.rejects(github.connect({ userId: 'u1', orgId: 'o1', installationId: 42, fullName: 'acme/private' }), /not accessible/);
  await assert.rejects(github.connect({ userId: 'u1', orgId: 'o1', installationId: 41, fullName: 'acme/private' }), /not accessible/);
  const repository = await github.connect({ userId: 'u1', orgId: 'o1', installationId: 41, fullName: 'Acme/Allowed' });
  assert.equal(repository.full_name, 'acme/allowed');
  assert.equal(repository.installation_id, '41');
});

test('sync imports commits, closed and merged PRs with file paths, and non-PR issues idempotently', async () => {
  const repository = { id: 'repo-1', org_id: 'org-1', full_name: 'acme/project', installation_id: '41' };
  const store = makeStore({ repositories: [repository], members: [
    { id: 'member-1', org_id: 'org-1', user_id: 'user-5', github_login: 'octocat' },
    { id: 'member-2', org_id: 'org-1', user_id: 'user-6', github_login: 'reviewer' },
    { id: 'member-3', org_id: 'org-1', user_id: 'user-7', github_login: 'reporter' },
  ] });
  const github = createGithub({ store, env: environment(), fetchImpl: async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/app/installations/41/access_tokens') return json({ token: '[redacted]' });
    if (parsed.pathname.endsWith('/commits')) return json([{
      sha: 'abc123', html_url: 'https://github.com/acme/project/commit/abc123',
      author: { id: 5, login: 'octocat' }, commit: { message: 'Fix thing', author: { date: '2024-01-02T03:04:05Z' } },
    }]);
    if (parsed.pathname.endsWith('/pulls') && parsed.searchParams.get('state') === 'all') return json([{
      number: 12, title: 'Merged change', body: 'Details', state: 'closed', merged_at: '2024-01-03T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z', html_url: 'https://github.com/acme/project/pull/12',
      user: { id: 6, login: 'reviewer' }, head: { sha: 'head123', ref: 'feature' }, base: { ref: 'main' },
    }]);
    if (parsed.pathname.endsWith('/pulls/12/files')) return json([{ filename: 'src/file.js', status: 'modified', additions: 2, deletions: 1 }]);
    if (parsed.pathname.endsWith('/issues') && parsed.searchParams.get('state') === 'all') return json([
      { number: 13, title: 'Bug', body: 'Issue', state: 'open', created_at: '2024-01-04T00:00:00Z',
        html_url: 'https://github.com/acme/project/issues/13', user: { id: 7, login: 'reporter' } },
      { number: 12, pull_request: { url: 'https://api.github.test/pulls/12' } },
    ]);
    assert.ok(options.headers.authorization);
    throw new Error(`Unexpected URL ${url}`);
  } });
  assert.deepEqual(await github.sync({ repository, actorId: 'actor' }), { commits: 1, pullRequests: 1, issues: 1, actorId: 'actor' });
  const sources = store.rows('sources');
  assert.equal(sources.length, 3);
  const pr = sources.find((source) => source.metadata.kind === 'pull_request');
  assert.deepEqual(sources.map((source) => source.type).sort(), ['commit', 'issue', 'pull_request']);
  assert.equal(pr.metadata.merged, true);
  assert.equal(pr.metadata.head_sha, 'head123');
  assert.equal(pr.metadata.files[0].filename, 'src/file.js');
  assert.equal(pr.author_id, 'user-6');
  assert.equal(sources.find((source) => source.metadata.kind === 'commit').created_at, '2024-01-02T03:04:05.000Z');
  await github.sync({ repository, actorId: 'actor' });
  assert.equal(store.rows('sources').length, 3);
  assert.ok(store.rows('repositories')[0].last_synced_at);
});

test('webhooks use timing-safe signatures, ignore disconnected repositories, and deduplicate successful deliveries', async () => {
  const repository = { id: 'repo-1', org_id: 'org-1', full_name: 'acme/project', installation_id: '41' };
  const store = makeStore({ repositories: [repository] });
  const github = createGithub({ store, env: environment(), fetchImpl: async () => { throw new Error('No network expected'); } });
  const rawBody = JSON.stringify({
    repository: { full_name: 'acme/project' }, installation: { id: 41 }, sender: { login: 'octocat' },
    pull_request: { number: 5, title: 'PR', body: 'Body', state: 'open', created_at: '2024-02-01T00:00:00Z',
      html_url: 'https://github.com/acme/project/pull/5', user: { id: 9, login: 'author' }, head: { sha: 'def456' } },
  });
  const signature = `sha256=${createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex')}`;
  const headers = { 'x-hub-signature-256': signature, 'x-github-delivery': 'delivery-1', 'x-github-event': 'pull_request' };
  await assert.rejects(github.webhook({ rawBody, headers: { ...headers, 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` } }), /Invalid GitHub webhook signature/);
  assert.deepEqual(await github.webhook({ rawBody, headers }), { processed: true, count: 1 });
  assert.equal(store.rows('github_deliveries')[0].status, 'processed');
  assert.deepEqual(await github.webhook({ rawBody, headers }), { processed: false, duplicate: true });
  const raceHeaders = { ...headers, 'x-github-delivery': 'delivery-race' };
  const race = await Promise.all([
    github.webhook({ rawBody, headers: raceHeaders }),
    github.webhook({ rawBody, headers: raceHeaders }),
  ]);
  assert.equal(race.filter((result) => result.processed).length, 1);
  assert.equal(race.filter((result) => result.duplicate).length, 1);
  assert.equal(store.rows('sources')[0].metadata.head_sha, 'def456');
  assert.equal(store.rows('github_deliveries').length, 2);
});

// ---- Connecting repositories other than the first one ----

const SLUG_ENV = { GITHUB_APP_SLUG: 'baton-app' };
function linkedStore(env, extra = {}) {
  return makeStore({
    github_accounts: [{ id: 'account-1', user_id: 'u1', org_id: 'o1', access_token_encrypted: encryptTokenForTest('user-token', Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64')) }],
    ...extra,
  });
}
const pageOf = (url) => Number(new URL(url).searchParams.get('page') ?? 1);
const commitFor = (sha) => ({ sha, html_url: 'https://github.com/x', author: { id: 1, login: 'a' }, commit: { message: 'm', author: { date: '2024-01-01T00:00:00Z' } } });

test('connect finds the installation by itself, across accounts and more than 100 repositories', async () => {
  const env = environment();
  const store = linkedStore(env);
  const asked = [];
  const github = createGithub({ store, env, fetchImpl: async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/user/installations') return json({ installations: [{ id: 1, account: { login: 'me' } }, { id: 2, account: { login: 'BigOrg' } }] });
    asked.push(pathname);
    if (pathname === '/user/installations/1/repositories') return json({ repositories: [{ full_name: 'me/own' }] });
    if (pathname === '/user/installations/2/repositories') {
      return json({ repositories: pageOf(url) === 1 ? Array.from({ length: 100 }, (_, index) => ({ full_name: `bigorg/r${index}` })) : [{ full_name: 'bigorg/target' }] });
    }
    throw new Error(`Unexpected URL ${url}`);
  } });
  const repository = await github.connect({ userId: 'u1', orgId: 'o1', fullName: 'BigOrg/Target' });
  assert.equal(repository.installation_id, '2');
  assert.equal(repository.access, 'installation');
  assert.equal(asked[0], '/user/installations/2/repositories');
  assert.equal(store.rows('repositories').length, 1);
});

test('installations and repositories are paginated beyond one page', async () => {
  const env = environment();
  const github = createGithub({ store: linkedStore(env), env, fetchImpl: async (url) => {
    const { pathname } = new URL(url);
    const page = pageOf(url);
    if (pathname === '/user/installations') return json({ installations: page === 1 ? Array.from({ length: 100 }, (_, id) => ({ id: id + 1, account: { login: `a${id}`, type: 'User' } })) : [{ id: 101, account: { login: 'last', type: 'Organization' } }] });
    if (pathname === '/user/installations/7/repositories') return json({ repositories: page === 1 ? Array.from({ length: 100 }, (_, index) => ({ full_name: `x/r${index}` })) : Array.from({ length: 20 }, (_, index) => ({ full_name: `x/s${index}` })) });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const installations = await github.installations({ userId: 'u1', orgId: 'o1' });
  assert.equal(installations.length, 101);
  assert.equal(installations.at(-1).account.login, 'last');
  assert.equal((await github.repositories({ userId: 'u1', orgId: 'o1', installationId: 7 })).length, 120);
});

test('a repository the app is not installed on and the user cannot read gets an actionable error with the install link', async () => {
  const env = environment(SLUG_ENV);
  const github = createGithub({ store: linkedStore(env), env, fetchImpl: async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/user/installations') return json({ installations: [{ id: 1, account: { login: 'me' } }] });
    if (pathname === '/user/installations/1/repositories') return json({ repositories: [{ full_name: 'me/own' }] });
    if (pathname === '/repos/acme/secret') return json({ message: 'Not Found' }, 404);
    throw new Error(`Unexpected URL ${url}`);
  } });
  const installUrl = 'https://github.com/apps/baton-app/installations/new';
  await assert.rejects(github.connect({ userId: 'u1', orgId: 'o1', fullName: 'acme/secret' }), (error) => /not found or the linked GitHub account cannot read it/.test(error.message) && error.message.includes(installUrl));
  await assert.rejects(github.connect({ userId: 'u1', orgId: 'o1', installationId: 1, fullName: 'acme/secret' }), (error) => /not accessible/.test(error.message) && error.message.includes(installUrl));
  const noSlug = environment();
  const plain = createGithub({ store: linkedStore(noSlug), env: noSlug, fetchImpl: async (url) => new URL(url).pathname === '/user/installations' ? json({ installations: [] }) : json({ message: 'Not Found' }, 404) });
  await assert.rejects(plain.connect({ userId: 'u1', orgId: 'o1', fullName: 'acme/secret' }), (error) => /Install the GitHub App/.test(error.message) && !error.message.includes('github.com/apps'));
});

test('without an installation the linked user token connects and syncs a readable repository, and is never leaked', async () => {
  const env = environment(SLUG_ENV);
  const store = linkedStore(env);
  const seen = [];
  const logged = [];
  const originals = ['log', 'warn', 'error', 'info'].map((name) => [name, console[name]]);
  for (const [name] of originals) console[name] = (...args) => logged.push(args.join(' '));
  try {
    const github = createGithub({ store, env, fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/app/')) throw new Error('The app must not be used for a user-token repository');
      seen.push([parsed.pathname, options.headers?.authorization]);
      if (parsed.pathname === '/user/installations') return json({ installations: [] });
      if (parsed.pathname === '/repos/octo/public') return json({ full_name: 'octo/public', private: false });
      if (parsed.pathname === '/repos/octo/public/commits') return json([{ ...commitFor('a1'), commit: { message: 'Init', author: { date: '2024-01-01T00:00:00Z' } } }]);
      if (parsed.pathname === '/repos/octo/public/commits/a1') return json({ files: [{ filename: 'README.md', status: 'added' }] });
      if (parsed.pathname === '/repos/octo/public/pulls' || parsed.pathname === '/repos/octo/public/issues') return json([]);
      if (parsed.pathname === '/repos/octo/public/branches') return json([{ name: 'main' }]);
      throw new Error(`Unexpected URL ${url}`);
    } });
    const repository = await github.connect({ userId: 'u1', orgId: 'o1', fullName: 'Octo/Public' });
    assert.equal(repository.access, 'user');
    const stored = store.rows('repositories')[0];
    assert.equal(stored.installation_id, null);
    await assert.rejects(github.sync({ repository: stored, actorId: 'stranger' }), /Link a GitHub account/);
    const result = await github.sync({ repository: stored, actorId: 'u1' });
    assert.deepEqual(result, { commits: 1, pullRequests: 0, issues: 0, actorId: 'u1' });
    assert.equal(store.rows('sources')[0].metadata.files[0].filename, 'README.md');
    assert.equal(seen.filter(([path]) => path.startsWith('/repos/')).every(([, authorization]) => authorization === 'Bearer user-token'), true);
  } finally {
    for (const [name, original] of originals) console[name] = original;
  }
  assert.equal(logged.some((line) => line.includes('user-token')), false);
  assert.equal(JSON.stringify(store.rows('repositories')).includes('user-token'), false);
});

test('connecting several repositories is idempotent and never duplicates legacy mixed-case rows', async () => {
  const env = environment();
  const store = linkedStore(env, { repositories: [{ id: 'legacy', org_id: 'o1', full_name: 'Acme/Beta', installation_id: '9' }] });
  const github = createGithub({ store, env, fetchImpl: async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/user/installations') return json({ installations: [{ id: 5, account: { login: 'acme' } }] });
    if (pathname === '/user/installations/5/repositories') return json({ repositories: [{ full_name: 'acme/alpha' }, { full_name: 'acme/beta' }] });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const alpha = await github.connect({ userId: 'u1', orgId: 'o1', installationId: 5, fullName: 'acme/alpha' });
  const beta = await github.connect({ userId: 'u1', orgId: 'o1', installationId: 5, fullName: 'ACME/BETA' });
  const alphaAgain = await github.connect({ userId: 'u1', orgId: 'o1', installationId: 5, fullName: 'acme/alpha' });
  assert.equal(alphaAgain.id, alpha.id);
  assert.equal(beta.id, 'legacy');
  assert.equal(store.rows('repositories').length, 2);
  assert.deepEqual(store.rows('repositories').map((row) => row.full_name).sort(), ['acme/alpha', 'acme/beta']);
});

function routedFetch(overrides = {}) {
  return async (url) => {
    const parsed = new URL(url);
    for (const [suffix, handler] of Object.entries(overrides)) if (parsed.pathname.endsWith(suffix)) return handler(parsed);
    if (parsed.pathname === '/app/installations/41/access_tokens') return json({ token: 'install-token' });
    if (/\/(commits|pulls|issues|branches)$/.test(parsed.pathname)) return json([]);
    if (/^\/repos\/[^/]+\/[^/]+$/.test(parsed.pathname)) return json({ default_branch: 'main' });
    throw new Error(`Unexpected URL ${url}`);
  };
}

test('sync tolerates an empty repository and disabled issues, and keeps each repository separate', async () => {
  const one = { id: 'r1', org_id: 'org-1', full_name: 'acme/one', installation_id: '41' };
  const two = { id: 'r2', org_id: 'org-1', full_name: 'acme/two', installation_id: '41' };
  const store = makeStore({ repositories: [one, two] });
  const github = createGithub({ store, env: environment(), fetchImpl: routedFetch({
    '/repos/acme/one/commits': () => json({ message: 'Git Repository is empty.' }, 409),
    '/repos/acme/one/issues': () => json({ message: 'Issues are disabled for this repo' }, 410),
    '/repos/acme/two/commits': () => json([commitFor('same-sha')]),
    '/commits/same-sha': () => json({ files: [] }),
  }) });
  assert.deepEqual(await github.sync({ repository: one, actorId: 'a' }), { commits: 0, pullRequests: 0, issues: 0, actorId: 'a' });
  assert.equal((await github.sync({ repository: two, actorId: 'a' })).commits, 1);
  await github.sync({ repository: two, actorId: 'a' });
  assert.equal(store.rows('sources').length, 1);
  assert.equal(store.rows('sources')[0].repository_id, 'r2');
});

test('sync reads at most 300 commits and reports truncation', async () => {
  const repository = { id: 'r1', org_id: 'org-1', full_name: 'acme/big', installation_id: '41' };
  const store = makeStore({ repositories: [repository] });
  const listing = routedFetch({
    '/repos/acme/big/commits': (parsed) => json(Array.from({ length: 100 }, (_, index) => commitFor(`p${parsed.searchParams.get('page')}-${index}`))),
  });
  const github = createGithub({ store, env: environment(), fetchImpl: async (url, options) => /\/commits\/p\d+-\d+$/.test(new URL(url).pathname) ? json({ files: [] }) : listing(url, options) });
  const result = await github.sync({ repository, actorId: 'a' });
  assert.equal(result.commits, 300);
  assert.equal(result.truncated, true);
  assert.equal(store.rows('sources').length, 300);
});

test('a removed installation or renamed repository produces a readable sync error', async () => {
  const repository = { id: 'r1', org_id: 'org-1', full_name: 'acme/gone', installation_id: '41' };
  const store = makeStore({ repositories: [repository] });
  const removed = createGithub({ store, env: environment(SLUG_ENV), fetchImpl: async () => json({ message: 'Not Found' }, 404) });
  await assert.rejects(removed.sync({ repository, actorId: 'a' }), (error) => /GitHub App is not installed/.test(error.message) && error.message.includes('github.com/apps/baton-app/installations/new'));
  const renamed = createGithub({ store, env: environment(), fetchImpl: async (url) => new URL(url).pathname.startsWith('/app/') ? json({ token: 't' }) : json({ message: 'Not Found' }, 404) });
  await assert.rejects(renamed.sync({ repository, actorId: 'a' }), /GitHub could not find acme\/gone/);
});

test('webhooks update every organization that connected the repository and keep stored PR files', async () => {
  const store = makeStore({ repositories: [
    { id: 'r1', org_id: 'org-1', full_name: 'acme/shared', installation_id: '41' },
    { id: 'r2', org_id: 'org-2', full_name: 'acme/shared', installation_id: '41' },
    { id: 'r3', org_id: 'org-3', full_name: 'acme/shared', installation_id: '99' },
    { id: 'r4', org_id: 'org-4', full_name: 'acme/shared', installation_id: null },
  ], sources: [{ id: 'old', org_id: 'org-1', repository_id: 'r1', external_id: 'github:acme/shared:pull_request:5', type: 'pull_request', metadata: { files: [{ filename: 'src/a.js' }] } }] });
  const github = createGithub({ store, env: environment(), fetchImpl: async () => { throw new Error('No network expected'); } });
  const rawBody = JSON.stringify({ repository: { full_name: 'acme/shared' }, installation: { id: 41 }, sender: { login: 'x' },
    pull_request: { number: 5, title: 'PR', body: 'B', state: 'open', created_at: '2024-02-01T00:00:00Z', html_url: 'https://github.com/acme/shared/pull/5', user: { id: 9, login: 'author' } } });
  const headers = { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex')}`, 'x-github-delivery': 'd-1', 'x-github-event': 'pull_request' };
  assert.deepEqual(await github.webhook({ rawBody, headers }), { processed: true, count: 2 });
  const sources = store.rows('sources');
  assert.deepEqual(sources.map((source) => source.org_id).sort(), ['org-1', 'org-2']);
  assert.equal(sources.find((source) => source.org_id === 'org-1').metadata.files[0].filename, 'src/a.js');
  assert.equal(sources.length, 2);
});

test('GitHub sign-in always shows the account picker; unlinking lets a member link a different account', async () => {
  const store = makeStore({ members: [{ id: 'member-1', org_id: 'org-1', user_id: 'user-1' }] });
  let login = 'someone-else';
  const github = createGithub({ store, env: environment(), fetchImpl: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: 'oauth-token' });
    if (url.endsWith('/user')) return json({ id: login === 'someone-else' ? 1 : 2, login });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const first = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  assert.equal(new URL(first.url).searchParams.get('prompt'), 'select_account');
  await github.finishLink({ code: 'c1', state: new URL(first.url).searchParams.get('state') });
  assert.deepEqual(await github.linkedAccount({ userId: 'user-1', orgId: 'org-1' }), { login: 'someone-else' });

  login = 'my-own-account';
  const blocked = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  await assert.rejects(github.finishLink({ code: 'c2', state: new URL(blocked.url).searchParams.get('state') }), /disconnect it before relinking/);

  assert.deepEqual(await github.unlink({ userId: 'user-1', orgId: 'org-1' }), { unlinked: true });
  assert.equal(store.rows('github_accounts').length, 0);
  assert.equal(store.rows('members')[0].github_login, null);
  const again = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  await github.finishLink({ code: 'c3', state: new URL(again.url).searchParams.get('state') });
  assert.deepEqual(await github.linkedAccount({ userId: 'user-1', orgId: 'org-1' }), { login: 'my-own-account' });
  assert.equal(store.rows('members')[0].github_login, 'my-own-account');
});

test('the install page address comes from GITHUB_APP_SLUG, or from GitHub when the slug is not configured', async () => {
  const configured = createGithub({ store: makeStore(), env: environment({ GITHUB_APP_SLUG: 'baton-m' }), fetchImpl: async () => { throw new Error('no network expected'); } });
  assert.equal(await configured.installUrl(), 'https://github.com/apps/baton-m/installations/new');
  let calls = 0;
  const discovered = createGithub({ store: makeStore(), env: environment(), fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.github.test/app');
    assert.match(options.headers.authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    calls += 1;
    return json({ slug: 'baton-m' });
  } });
  assert.equal(await discovered.installUrl(), 'https://github.com/apps/baton-m/installations/new');
  assert.equal(await discovered.installUrl(), 'https://github.com/apps/baton-m/installations/new');
  assert.equal(calls, 1, 'the slug is looked up once');
  const offline = createGithub({ store: makeStore(), env: environment(), fetchImpl: async () => json({ message: 'Bad credentials' }, 401) });
  assert.equal(await offline.installUrl(), null);
});

test('a record the database rejects is skipped and reported instead of failing the whole sync', async () => {
  const repository = { id: 'repo-1', org_id: 'org-1', full_name: 'acme/project', installation_id: '41' };
  const store = makeStore({ repositories: [repository], members: [] });
  const insert = store.insert;
  let rejectAll = false;
  store.insert = async (table, record) => {
    if (table === 'sources' && (rejectAll || record.content.includes('bad'))) throw new Error('Supabase insert sources failed: null value in column "x" violates not-null constraint');
    return insert(table, record);
  };
  const github = createGithub({ store, env: environment(), fetchImpl: async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/app/installations/41/access_tokens') return json({ token: 't' });
    if (parsed.pathname.endsWith('/commits')) return json([
      { sha: 'a1', commit: { message: 'good commit' } },
      { sha: 'b2', commit: { message: 'bad commit' } },
    ]);
    if (parsed.pathname.match(/\/commits\/\w+$/)) return json({ files: [] });
    if (parsed.pathname.endsWith('/pulls') || parsed.pathname.endsWith('/issues') || parsed.pathname.endsWith('/branches')) return json([]);
    if (parsed.pathname === '/repos/acme/project') return json({ default_branch: 'main' });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const result = await github.sync({ repository, actorId: 'actor' });
  assert.equal(result.commits, 2);
  assert.equal(result.skipped, 1);
  assert.match(result.skippedReason, /not-null constraint/);
  assert.equal(store.rows('sources').length, 1);
  assert.ok(store.rows('repositories')[0].last_synced_at);

  rejectAll = true;
  store.update = async (table) => { if (table === 'sources') throw new Error('Supabase update sources failed: null value in column "x"'); };
  await assert.rejects(github.sync({ repository, actorId: 'actor' }), /^Error: Could not save any synced records: Supabase \w+ sources failed: null value/);
});

test('the GitHub App private key is read however the hosting dashboard mangled it', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' });
  const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const expected = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const forms = {
    'GitHub .pem as downloaded (PKCS#1)': pkcs1,
    'PKCS#8': pkcs8,
    'literal \\n escapes': pkcs1.replace(/\n/g, '\\n'),
    'wrapped in double quotes': `"${pkcs1.replace(/\n/g, '\\n')}"`,
    'newlines turned into spaces': pkcs1.replace(/\n/g, ' '),
    'Windows line endings': pkcs1.replace(/\n/g, '\r\n'),
    'whole file base64-encoded': Buffer.from(pkcs1).toString('base64'),
  };
  for (const [name, raw] of Object.entries(forms)) {
    assert.equal(readPrivateKey(raw).export({ type: 'pkcs8', format: 'der' }).toString('base64'), expected, name);
  }
  assert.throws(() => readPrivateKey('not a key'), /is not a PEM private key/);
  assert.throws(() => readPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----'), /could not be read/);
});
