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
  const token = 'baton_test_secret_token';
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
