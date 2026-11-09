import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, generateKeyPairSync } from 'node:crypto';
import { createGithub } from '../server/github.js';

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
    GITHUB_OAUTH_CALLBACK_URL: 'https://baton.example/api/github/callback',
    GITHUB_APP_ID: 'app-123', GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    GITHUB_WEBHOOK_SECRET: 'webhook-secret', GITHUB_API_URL: 'https://api.github.test',
    ...extra,
  };
}

test('OAuth state is hashed, one-use, and linked tokens are never returned', async () => {
  const store = makeStore();
  const github = createGithub({ store, env: environment(), fetchImpl: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: 'private-oauth-token', scope: 'repo' });
    if (url.endsWith('/user')) return json({ id: 8, login: 'octocat' });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const { url } = await github.startLink({ userId: 'user-1', orgId: 'org-1' });
  const state = new URL(url).searchParams.get('state');
  assert.ok(state);
  assert.equal(store.rows('github_states')[0].state_hash, createHash('sha256').update(state).digest('hex'));
  assert.deepEqual(await github.finishLink({ code: 'code-1', state }), { orgId: 'org-1', userId: 'user-1', login: 'octocat' });
  assert.equal(store.rows('github_accounts')[0].access_token, 'private-oauth-token');
  await assert.rejects(github.finishLink({ code: 'code-1', state }), /already been used/);
  assert.equal(store.rows('github_states').length, 0);
});

test('connect rejects installations and repositories not authorized to the linked user', async () => {
  const store = makeStore({ github_accounts: [{ id: 'account-1', user_id: 'u1', org_id: 'o1', access_token: 'user-token' }] });
  const github = createGithub({ store, env: environment(), fetchImpl: async (url) => {
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
  const store = makeStore({ repositories: [repository] });
  const github = createGithub({ store, env: environment(), fetchImpl: async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/app/installations/41/access_tokens') return json({ token: 'installation-token' });
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
  const pr = sources.find((source) => source.type === 'pull_request');
  assert.equal(pr.metadata.merged, true);
  assert.equal(pr.metadata.head_sha, 'head123');
  assert.equal(pr.metadata.files[0].filename, 'src/file.js');
  assert.equal(sources.find((source) => source.type === 'commit').created_at, '2024-01-02T03:04:05.000Z');
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
  assert.deepEqual(await github.webhook({ rawBody, headers }), { processed: false, duplicate: true });
  assert.equal(store.rows('sources')[0].metadata.head_sha, 'def456');
  assert.equal(store.rows('github_deliveries').length, 1);
});

