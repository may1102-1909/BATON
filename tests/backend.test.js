import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

const orgId = 'org-one';
const userId = 'user-admin';
const hash = value => createHash('sha256').update(value).digest('hex');

function fixture() {
  return createMemoryStore({
    organizations: [{ id: orgId, name: 'One' }, { id: 'org-two', name: 'Two' }],
    members: [
      { id: 'membership-admin', org_id: orgId, user_id: userId, role: 'admin', email: 'admin@example.com' },
      { id: 'membership-team', org_id: orgId, user_id: 'user-team', role: 'team', email: 'team@example.com' },
      { id: 'membership-other', org_id: 'org-two', user_id: 'user-other', role: 'admin' },
    ],
  });
}

async function serve(app, run) {
  const server = createServer((req, res) => { void app(req, res); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await run(url); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

const jsonRequest = (url, path, { method = 'GET', headers = {}, body } = {}) => fetch(`${url}${path}`, {
  method,
  headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('memory stores are isolated and fill IDs/timestamps', async () => {
  const first = createMemoryStore();
  const second = createMemoryStore();
  const row = await first.insert('sources', { content: 'hello' });
  assert.ok(row.id);
  assert.ok(row.created_at);
  assert.equal((await second.list('sources')).length, 0);
});

test('demo mode exposes only organization memberships and source visibility', async () => {
  const store = fixture();
  await store.insert('sources', { org_id: orgId, author_id: userId, content: 'public decision', visibility: 'team', type: 'decision' });
  await store.insert('sources', { org_id: orgId, author_id: userId, content: 'admin-only note', visibility: 'admin', type: 'note' });
  const app = createApp({ store, env: { BATON_DEMO_MODE: 'true' } });
  await serve(app, async url => {
    const own = await jsonRequest(url, '/api/orgs/org-two/state', { headers: { 'x-baton-demo-user': userId } });
    assert.equal(own.status, 403);
    const state = await jsonRequest(url, `/api/orgs/${orgId}/state`, { headers: { 'x-baton-demo-user': 'user-team' } });
    assert.equal(state.status, 200);
    const data = await state.json();
    assert.deepEqual(data.sources.map(source => source.content), ['public decision']);
    assert.ok(Array.isArray(data.members));
    assert.ok(Array.isArray(data.tokens));
  });
});

test('empty explicit demo store is seeded and can create a second organization', async () => {
  const app = createApp({ store: createMemoryStore(), env: { BATON_DEMO_MODE: 'true' } });
  await serve(app, async url => {
    const headers = { 'x-baton-demo-user': 'demo-admin' };
    const created = await jsonRequest(url, '/api/orgs', { method: 'POST', headers, body: { name: 'Workspace Two' } });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).role, 'admin');
    const me = await jsonRequest(url, '/api/me', { headers });
    assert.deepEqual((await me.json()).organizations.map(org => org.name), ['Demo Organization', 'Workspace Two']);
  });
});

test('production never falls back to demo identity', async () => {
  const app = createApp({ store: fixture(), env: {} });
  await serve(app, async url => {
    const response = await jsonRequest(url, '/api/me');
    assert.equal(response.status, 401);
  });
});

test('Supabase access tokens are validated and collector JWTs must name an organization', async () => {
  const store = fixture();
  const checked = [];
  const supabaseClient = { auth: { getUser: async token => {
    checked.push(token);
    return { data: { user: { id: userId, email: 'admin@example.com', user_metadata: { name: 'Admin' }, identities: [] } }, error: null };
  } } };
  const app = createApp({ store, env: {}, supabaseClient });
  const headers = { authorization: 'Bearer valid-supabase-access-token' };
  await serve(app, async url => {
    const missingOrg = await jsonRequest(url, '/api/collector/push', { method: 'POST', headers, body: { type: 'decision', content: 'Needs explicit tenant.' } });
    assert.equal(missingOrg.status, 400);
    const pushed = await jsonRequest(url, '/api/collector/push', { method: 'POST', headers, body: { org_id: orgId, type: 'decision', content: 'Tenant is explicit.' } });
    assert.equal(pushed.status, 201);
    const crossOrg = await jsonRequest(url, '/api/collector/search?org_id=org-two', { headers });
    assert.equal(crossOrg.status, 403);
    assert.equal(checked.length, 3);
    assert.ok(checked.every(token => token === 'valid-supabase-access-token'));
  });
});

test('scoped API token pushes redactable memory, deduplicates, and cannot cross orgs', async () => {
  const token = '[redacted]';
  const store = fixture();
  await store.insert('tokens', { id: 'token-one', org_id: orgId, user_id: userId, token_hash: hash(token), expires_at: null, revoked_at: null });
  const app = createApp({ store, env: {} });
  const headers = { authorization: `Bearer ${token}` };
  await serve(app, async url => {
    const payload = { type: 'decision', content: 'Use GitHub for the source of truth.', session_id: 'session-1', event_id: 'event-1' };
    const first = await jsonRequest(url, '/api/collector/push', { method: 'POST', headers, body: payload });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).deduplicated, false);
    const duplicate = await jsonRequest(url, '/api/collector/push', { method: 'POST', headers, body: payload });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).deduplicated, true);
    const crossOrg = await jsonRequest(url, '/api/collector/push', { method: 'POST', headers, body: { org_id: 'org-two', content: 'no' } });
    assert.equal(crossOrg.status, 403);
    const search = await jsonRequest(url, `/api/collector/search?q=source&org_id=${orgId}`, { headers });
    assert.equal(search.status, 200);
    assert.equal((await search.json()).data.length, 1);
  });
});

test('admin token issuance is one-time, hashes stay hidden, and revocation works', async () => {
  const store = fixture();
  const app = createApp({ store, env: { BATON_DEMO_MODE: 'true' } });
  await serve(app, async url => {
    const headers = { 'x-baton-demo-user': userId };
    const created = await jsonRequest(url, `/api/orgs/${orgId}/tokens`, { method: 'POST', headers, body: { name: 'MCP' } });
    assert.equal(created.status, 201);
    const { token, record } = await created.json();
    assert.ok(token);
    assert.equal('token_hash' in record, false);
    const stored = (await store.list('tokens', { id: record.id }))[0];
    assert.equal(stored.token_hash, hash(token));
    const removed = await jsonRequest(url, `/api/orgs/${orgId}/tokens/${record.id}`, { method: 'DELETE', headers });
    assert.equal(removed.status, 200);
    const useRevoked = await jsonRequest(url, '/api/collector/push', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: { content: 'no' } });
    assert.equal(useRevoked.status, 401);
  });
});

test('organization invites are hashed and accepted only once', async () => {
  const store = fixture();
  const app = createApp({ store, env: { BATON_DEMO_MODE: 'true' } });
  await serve(app, async url => {
    const created = await jsonRequest(url, `/api/orgs/${orgId}/invites`, {
      method: 'POST', headers: { 'x-baton-demo-user': userId }, body: { role: 'team' },
    });
    assert.equal(created.status, 201);
    const { token, invite } = await created.json();
    const persisted = await store.get('invites', invite.id);
    assert.equal(persisted.token_hash, hash(token));
    assert.equal('token_hash' in invite, false);
    const accept = () => jsonRequest(url, '/api/invites/accept', {
      method: 'POST', headers: { 'x-baton-demo-user': 'invited-user' }, body: { token },
    });
    assert.equal((await accept()).status, 200);
    assert.equal((await accept()).status, 400);
  });
});

test('tasks and threaded comments remain organization-scoped', async () => {
  const store = fixture();
  const headers = { 'x-baton-demo-user': userId };
  const app = createApp({ store, env: { BATON_DEMO_MODE: 'true' } });
  await serve(app, async url => {
    const created = await jsonRequest(url, `/api/orgs/${orgId}/tasks`, { method: 'POST', headers, body: { title: 'Review API', assignee_id: 'user-team' } });
    assert.equal(created.status, 201);
    const task = (await created.json()).task;
    const updated = await jsonRequest(url, `/api/tasks/${task.id}`, { method: 'PATCH', headers, body: { status: 'in_progress' } });
    assert.equal((await updated.json()).task.status, 'in_progress');
    const comment = await jsonRequest(url, `/api/tasks/${task.id}/comments`, { method: 'POST', headers, body: { content: 'First note' } });
    assert.equal(comment.status, 201);
    const first = (await comment.json()).comment;
    const reply = await jsonRequest(url, `/api/tasks/${task.id}/comments`, { method: 'POST', headers, body: { content: 'Reply', parent_id: first.id } });
    assert.equal(reply.status, 201);
    const wrongParent = await jsonRequest(url, `/api/tasks/${task.id}/comments`, { method: 'POST', headers, body: { content: 'Nope', parent_id: 'missing' } });
    assert.equal(wrongParent.status, 400);
  });
});

test('last active organization admin cannot be offboarded', async () => {
  const store = createMemoryStore({
    organizations: [{ id: orgId, name: 'One' }],
    members: [{ id: 'only-admin', org_id: orgId, user_id: userId, role: 'admin' }],
  });
  const app = createApp({ store, env: { BATON_DEMO_MODE: 'true' } });
  await serve(app, async url => {
    const response = await jsonRequest(url, `/api/orgs/${orgId}/members/only-admin`, {
      method: 'PATCH', headers: { 'x-baton-demo-user': userId }, body: { offboarding: true },
    });
    assert.equal(response.status, 409);
  });
});
test('GitHub callback works without a bearer token, redirects to the dashboard, and the linked user can pick a repository', async () => {
  const store = fixture();
  const env = {
    GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', PUBLIC_APP_URL: 'https://baton.example',
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), GITHUB_API_URL: 'https://api.github.test',
    GITHUB_APP_SLUG: 'baton-m',
  };
  const reply = data => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async target => {
    const address = String(target);
    if (address === 'https://github.com/login/oauth/access_token') return reply({ access_token: 'user-token', scope: '' });
    if (address.endsWith('/user')) return reply({ id: 8, login: 'octocat' });
    if (address.includes('/user/installations/77/repositories')) return reply({ repositories: [{ full_name: 'Acme/Baton', private: true, default_branch: 'main' }] });
    if (address.includes('/user/installations')) return reply({ installations: [{ id: 77, account: { login: 'Acme', type: 'User' }, repository_selection: 'selected' }] });
    throw new Error(`Unexpected URL ${address}`);
  };
  const supabaseClient = { auth: { getUser: async () => ({ data: { user: { id: userId, email: 'admin@example.com', identities: [] } }, error: null }) } };
  const app = createApp({ store, env, fetchImpl, supabaseClient });
  const headers = { authorization: 'Bearer valid-supabase-access-token' };
  await serve(app, async url => {
    const health = await (await jsonRequest(url, '/api/health')).json();
    assert.equal(health.githubInstallUrl, 'https://github.com/apps/baton-m/installations/new');

    const unlinked = await jsonRequest(url, `/api/orgs/${orgId}/github/installations`, { headers });
    assert.equal(unlinked.status, 409);

    const started = await (await jsonRequest(url, `/api/orgs/${orgId}/github/connect`, { headers })).json();
    const state = new URL(started.url).searchParams.get('state');

    // The browser redirect from GitHub carries no Authorization header.
    const linked = await fetch(`${url}/api/github/callback?code=abc&state=${state}`, { redirect: 'manual' });
    assert.equal(linked.status, 302);
    assert.equal(linked.headers.get('location'), '/dashboard?github=linked');
    const [account] = await store.list('github_accounts', { user_id: userId, org_id: orgId });
    assert.equal(account.github_login, 'octocat');
    assert.ok(account.access_token.startsWith('v1:'));
    assert.ok(!JSON.stringify(account).includes('user-token'));

    const replayed = await fetch(`${url}/api/github/callback?code=abc&state=${state}`, { redirect: 'manual' });
    assert.equal(replayed.status, 302);
    assert.equal(replayed.headers.get('location'), '/dashboard?github=error&reason=expired');

    const installations = await (await jsonRequest(url, `/api/orgs/${orgId}/github/installations`, { headers })).json();
    assert.deepEqual(installations.map(item => item.id), [77]);
    const repos = await (await jsonRequest(url, `/api/orgs/${orgId}/github/installations/77/repositories`, { headers })).json();
    assert.deepEqual(repos, [{ full_name: 'Acme/Baton', private: true, default_branch: 'main' }]);

    const connected = await jsonRequest(url, `/api/orgs/${orgId}/repositories`, { method: 'POST', headers, body: { installationId: 77, fullName: 'Acme/Baton' } });
    assert.equal(connected.status, 201);
    assert.equal((await connected.json()).full_name, 'acme/baton');

    const outsider = await jsonRequest(url, `/api/orgs/org-two/github/installations/77/repositories`, { headers });
    assert.equal(outsider.status, 403);
  });
});
