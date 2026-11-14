import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createMemoryStore } from '../server/store.js';
import { makeApp, sha256 } from './helpers.js';

const A = 'org-a';
const B = 'org-b';
const admin = 'user:admin-a:admin@example.test';
const member = 'user:member-a:member@example.test';
const newcomer = 'user:newcomer:new@example.test';
const stranger = 'user:stranger:other@example.test';
const ago = ms => new Date(Date.now() - ms).toISOString();
const ahead = ms => new Date(Date.now() + ms).toISOString();

function base(extra = {}) {
  return createMemoryStore({
    organizations: [{ id: A, name: 'Alpha' }, { id: B, name: 'Bravo Secret Name' }],
    members: [
      { id: 'ma', org_id: A, user_id: 'admin-a', role: 'admin', email: 'admin@example.test' },
      { id: 'mm', org_id: A, user_id: 'member-a', role: 'member', email: 'member@example.test' },
      { id: 'mb', org_id: B, user_id: 'admin-b', role: 'admin', email: 'b@example.test' },
    ],
    repositories: [{ id: 'repo-b', org_id: B, full_name: 'bravo/secret-repo', installation_id: '9' }],
    sources: [{ id: 'src-b', org_id: B, type: 'memory', content: 'Bravo confidential plan', visibility: 'team', created_at: ago(1000) }],
    tasks: [{ id: 'task-b', org_id: B, title: 'Bravo task', status: 'open' }],
    handovers: [{ id: 'handover-b', org_id: B, leaver_id: 'admin-b', incoming_id: 'x', status: 'draft' }],
    ...extra,
  });
}

// ---------- invites ----------

test('invite flow: admin creates a link token, a new user accepts once, and becomes a member', async () => {
  const store = base();
  const { call } = makeApp(store);
  assert.equal((await call(member, 'POST', `/api/orgs/${A}/invites`, {})).status, 403);
  assert.equal((await call(admin, 'POST', `/api/orgs/${A}/invites`, { role: 'admin' })).status, 400);
  const created = await call(admin, 'POST', `/api/orgs/${A}/invites`, { role: 'team' });
  assert.equal(created.status, 201);
  const { token, invite } = created.body;
  assert.ok(token.length >= 32);
  assert.deepEqual(Object.keys(invite).sort(), ['email', 'expires_at', 'id', 'org_id', 'role']);
  assert.equal(invite.org_id, A);
  assert.equal((await store.list('invites'))[0].token_hash, sha256(token));
  assert.equal(JSON.stringify(await store.list('invites')).includes(token), false);

  assert.equal((await call(newcomer, 'GET', `/api/orgs/${A}/state`)).status, 403);
  const accepted = await call(newcomer, 'POST', '/api/invites/accept', { token });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.organization_id, A);
  assert.equal(accepted.body.membership.role, 'team');
  assert.equal((await call(newcomer, 'GET', `/api/orgs/${A}/state`)).status, 200);
  const me = await call(newcomer, 'GET', '/api/me');
  assert.deepEqual(me.body.organizations.map(item => item.id), [A]);
  const again = await call(stranger, 'POST', '/api/invites/accept', { token });
  assert.equal(again.status, 400);
  assert.match(again.body.error, /invalid, expired, or already used/);
  assert.equal((await call(stranger, 'GET', `/api/orgs/${A}/state`)).status, 403);
});

test('invites reject garbage, expired, unauthenticated and wrong-email acceptance without consuming the invite', async () => {
  const token = 'x'.repeat(43);
  const store = base({ invites: [
    { id: 'i-expired', org_id: A, token_hash: sha256('e'.repeat(43)), role: 'member', email: null, expires_at: ago(1000) },
    { id: 'i-email', org_id: A, token_hash: sha256(token), role: 'member', email: 'only@example.test', expires_at: ahead(100000) },
  ] });
  const { call } = makeApp(store);
  assert.equal((await call(newcomer, 'POST', '/api/invites/accept', { token: 'short' })).status, 400);
  assert.equal((await call(newcomer, 'POST', '/api/invites/accept', {})).status, 400);
  assert.equal((await call(newcomer, 'POST', '/api/invites/accept', { token: 'n'.repeat(43) })).status, 400);
  assert.equal((await call(newcomer, 'POST', '/api/invites/accept', { token: 'e'.repeat(43) })).status, 400);
  assert.equal((await call(null, 'POST', '/api/invites/accept', { token })).status, 401);
  const wrong = await call(newcomer, 'POST', '/api/invites/accept', { token });
  assert.equal(wrong.status, 403);
  assert.match(wrong.body.error, /email/i);
  assert.equal((await store.get('invites', 'i-email')).accepted_at, undefined);
  const right = await call('user:only-user:Only@Example.test', 'POST', '/api/invites/accept', { token });
  assert.equal(right.status, 200);
  assert.equal((await call('user:only-user:Only@Example.test', 'POST', '/api/invites/accept', { token })).status, 400);
});

// ---------- API tokens ----------

test('API tokens are scoped to collector access, and revoked, expired or orphaned tokens are refused', async () => {
  const store = base({ tokens: [
    { id: 'tk-expired', org_id: A, user_id: 'admin-a', name: 'old', token_hash: sha256('baton_expired'), expires_at: ago(1000), revoked_at: null },
    { id: 'tk-gone', org_id: A, user_id: 'ghost', name: 'ghost', token_hash: sha256('baton_ghost'), expires_at: ahead(100000), revoked_at: null },
  ] });
  const { call } = makeApp(store);
  const created = await call(member, 'POST', `/api/orgs/${A}/tokens`, { name: 'laptop' });
  assert.equal(created.status, 201);
  const raw = created.body.token;
  assert.equal('token_hash' in created.body.record, false);
  const push = { type: 'decision', content: 'Use a queue', event_id: 'e1', session_id: 's1' };
  assert.equal((await call(raw, 'POST', '/api/collector/push', push)).status, 201);
  assert.equal((await call(raw, 'POST', '/api/collector/push', push)).body.deduplicated, true);
  assert.equal((await call(raw, 'GET', `/api/orgs/${A}/state`)).status, 403);
  assert.equal((await call(raw, 'POST', '/api/collector/push', { ...push, org_id: B, event_id: 'e2' })).status, 403);
  assert.equal((await call(raw, 'GET', `/api/orgs/${B}/state`)).status, 403);
  assert.equal((await call(member, 'DELETE', `/api/orgs/${A}/tokens/${created.body.record.id}`)).status, 403);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${B}/tokens/${created.body.record.id}`)).status, 403);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${A}/tokens/${created.body.record.id}`)).status, 200);
  const revoked = await call(raw, 'POST', '/api/collector/push', { ...push, event_id: 'e3' });
  assert.equal(revoked.status, 401);
  assert.match(revoked.body.error, /revoked or expired/);
  assert.equal((await call('baton_expired', 'POST', '/api/collector/push', push)).status, 401);
  assert.equal((await call('baton_ghost', 'POST', '/api/collector/push', push)).status, 401);
  assert.equal((await call('baton_unknown', 'POST', '/api/collector/push', push)).status, 401);
  assert.equal((await call(null, 'POST', '/api/collector/push', push)).status, 401);
});

// ---------- webhooks ----------

test('webhook endpoint rejects bad, missing or malformed signatures and is clear when unconfigured', async () => {
  const store = base();
  const env = { GITHUB_WEBHOOK_SECRET: 'whsec' };
  const { call } = makeApp(store, { env });
  const payload = JSON.stringify({ repository: { full_name: 'nobody/none' }, installation: { id: 1 } });
  const sign = body => `sha256=${createHmac('sha256', 'whsec').update(body).digest('hex')}`;
  const headers = (signature, id = 'd1') => ({ 'x-hub-signature-256': signature, 'x-github-delivery': id, 'x-github-event': 'push' });
  assert.equal((await call(null, 'POST', '/api/github/webhook', payload, headers(`sha256=${'0'.repeat(64)}`))).status, 401);
  assert.equal((await call(null, 'POST', '/api/github/webhook', payload, headers('nonsense'))).status, 401);
  assert.equal((await call(null, 'POST', '/api/github/webhook', payload, { 'x-github-delivery': 'd2', 'x-github-event': 'push' })).status, 401);
  assert.equal((await call(null, 'POST', '/api/github/webhook', payload, headers(sign(payload + ' ')))).status, 401);
  assert.equal((await call(null, 'POST', '/api/github/webhook', '{not json', headers(sign('{not json')))).status, 401);
  assert.equal((await store.list('github_deliveries')).length, 0);
  const ok = await call(null, 'POST', '/api/github/webhook', payload, headers(sign(payload), 'd3'));
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { processed: false, reason: 'repository_not_connected' });
  const unconfigured = makeApp(base(), { env: {} });
  assert.equal((await unconfigured.call(null, 'POST', '/api/github/webhook', payload, headers(sign(payload)))).status, 503);
});

test('GitHub connection failures map to actionable HTTP errors', async () => {
  const failing = message => ({ connect: async () => { throw new Error(message); }, sync: async () => { throw new Error(message); } });
  const run = async (message, path = `/api/orgs/${A}/repositories`) => {
    const { call } = makeApp(base(), { github: failing(message) });
    return call(admin, 'POST', path, { full_name: 'acme/thing' });
  };
  const missing = await run('Repository acme/thing was not found or the linked GitHub account cannot read it, and the GitHub App is not installed on it. Install the GitHub App on that repository or choose another repository.');
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /Install the GitHub App/);
  assert.equal((await run('GitHub App is not installed or is suspended for installation 4.')).status, 409);
  assert.equal((await run('Link a GitHub account before connecting a repository')).status, 409);
  assert.equal((await run('GitHub rate limit reached; try syncing again in a few minutes')).status, 429);
  assert.equal((await run('GitHub API GET /user/installations failed (401): Bad credentials')).status, 409);
  const sync = await makeApp(base({ repositories: [{ id: 'r-a', org_id: A, full_name: 'acme/thing', installation_id: '1' }] }), { github: failing('GitHub could not find acme/thing. It may have been renamed.') })
    .call(admin, 'POST', `/api/orgs/${A}/repositories/r-a/sync`, {});
  assert.equal(sync.status, 409);
});

test('connect passes full_name / installation_id through and reports how the repository is accessed', async () => {
  const seen = [];
  const { call } = makeApp(base(), { github: { connect: async args => { seen.push(args); return { id: 'r1', full_name: args.fullName, installation_id: null, access: 'user' }; } } });
  const result = await call(admin, 'POST', `/api/orgs/${A}/repositories`, { full_name: 'octo/public' });
  assert.equal(result.status, 201);
  assert.equal(result.body.access, 'user');
  assert.equal(seen[0].fullName, 'octo/public');
  assert.equal(seen[0].installationId, undefined);
  await call(admin, 'POST', `/api/orgs/${A}/repositories`, { installationId: 7, fullName: 'acme/x' });
  assert.equal(seen[1].installationId, 7);
  assert.equal((await call(member, 'POST', `/api/orgs/${A}/repositories`, { full_name: 'a/b' })).status, 403);
});

// ---------- cross-organization access ----------

test('another organization’s URLs are refused without leaking names or data', async () => {
  const { call } = makeApp(base());
  const probes = [
    ['GET', `/api/orgs/${B}/state`], ['GET', `/api/orgs/${B}/risks`], ['POST', `/api/orgs/${B}/invites`, {}], ['POST', `/api/orgs/${B}/tokens`, { name: 'x' }],
    ['PATCH', `/api/orgs/${B}`, { name: 'Mine now' }], ['DELETE', `/api/orgs/${B}`, { confirm: 'Bravo Secret Name' }],
    ['POST', `/api/orgs/${B}/reset`, { confirm: 'Bravo Secret Name', scope: 'all' }], ['DELETE', `/api/orgs/${B}/repositories/repo-b`],
    ['POST', `/api/orgs/${B}/repositories/repo-b/sync`, {}], ['POST', `/api/orgs/${B}/memories`, { type: 'memory', content: 'x' }],
    ['GET', '/api/handovers/handover-b'], ['GET', '/api/handovers/handover-b/export.md'], ['POST', '/api/handovers/handover-b/generate', {}],
    ['PATCH', '/api/tasks/task-b', { title: 'hijack' }], ['POST', '/api/tasks/task-b/comments', { content: 'hi' }],
    ['GET', `/api/collector/search?org_id=${B}&q=Bravo`], ['GET', `/api/collector/cursor?org_id=${B}`], ['GET', `/api/mcp/interviews?org_id=${B}`],
  ];
  for (const [method, path, body] of probes) {
    const response = await call(admin, method, path, body);
    assert.ok([403, 404].includes(response.status), `${method} ${path} -> ${response.status}`);
    assert.doesNotMatch(response.text, /Bravo|secret-repo|confidential|handover-b|task-b/i, `${method} ${path} leaked`);
  }
  assert.equal((await call(admin, 'PATCH', `/api/orgs/${A}/members/mb`, { role: 'member' })).status, 404);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${A}/repositories/repo-b`)).status, 404);
  assert.equal((await call(admin, 'POST', `/api/orgs/${A}/repositories/repo-b/sync`, {})).status, 404);
  assert.equal((await call(admin, 'PATCH', `/api/orgs/${A}/memories/src-b`, { content: 'x' })).status, 404);
});

test('after the probes the other organization is untouched', async () => {
  const store = base();
  const { call } = makeApp(store);
  await call(admin, 'DELETE', `/api/orgs/${B}`, { confirm: 'Bravo Secret Name' });
  await call(admin, 'POST', `/api/orgs/${B}/reset`, { confirm: 'Bravo Secret Name', scope: 'all' });
  assert.equal((await store.get('organizations', B)).name, 'Bravo Secret Name');
  assert.equal((await store.list('sources', { org_id: B })).length, 1);
});

// ---------- handover workflow: duplicate generation, interviews, Gemini fallback ----------

function handoverFixture(env = {}, fetchImpl = undefined) {
  const store = createMemoryStore({
    organizations: [{ id: A, name: 'Alpha' }],
    members: [
      { id: 'm-admin', org_id: A, user_id: 'admin-a', role: 'admin', email: 'admin@example.test' },
      { id: 'm-leaver', org_id: A, user_id: 'leaver', role: 'member', email: 'leaver@example.test', github_login: 'leaver' },
      { id: 'm-incoming', org_id: A, user_id: 'incoming', role: 'member', email: 'incoming@example.test' },
    ],
    sources: [1, 2, 3, 4].map(index => ({ id: `blk-${index}`, org_id: A, type: 'blocker', content: `Redis cache problem number ${index}`, visibility: 'team', metadata: { status: 'active' }, created_at: ago(index * 1000) })),
  });
  return { store, ...makeApp(store, { env, fetchImpl }) };
}
const leaver = 'user:leaver:leaver@example.test';
const incoming = 'user:incoming:incoming@example.test';

async function start(call) {
  const started = await call(admin, 'POST', `/api/orgs/${A}/handovers`, { leaverId: 'leaver', incomingId: 'incoming' });
  assert.equal(started.status, 201);
  return started.body.handover.id;
}

async function approvedHandover(env, fetchImpl) {
  const fixture = handoverFixture(env, fetchImpl);
  const id = await start(fixture.call);
  const generated = await fixture.call(admin, 'POST', `/api/handovers/${id}/generate`, {});
  for (const claim of generated.body.claims) assert.equal((await fixture.call(admin, 'PATCH', `/api/handovers/${id}/claims/${claim.id}`, { status: 'approved' })).status, 200);
  assert.equal((await fixture.call(admin, 'POST', `/api/handovers/${id}/approve`, {})).status, 200);
  return { ...fixture, id };
}

test('generating twice, even concurrently, never duplicates claims', async () => {
  const { call, store } = handoverFixture();
  const id = await start(call);
  const first = await call(admin, 'POST', `/api/handovers/${id}/generate`, {});
  assert.equal(first.status, 200);
  const count = first.body.claims.length;
  assert.ok(count > 0);
  const twice = await Promise.all([call(admin, 'POST', `/api/handovers/${id}/generate`, {}), call(admin, 'POST', `/api/handovers/${id}/generate`, {})]);
  assert.deepEqual(twice.map(item => item.status), [200, 200]);
  const stored = await store.list('handover_claims', { handover_id: id });
  assert.equal(stored.length, count);
  const keys = stored.map(claim => `${claim.section}|${claim.text}|${(claim.source_ids ?? []).join()}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal((await call(member, 'POST', `/api/handovers/${id}/generate`, {})).status, 403);
});

test('exit interviews refresh: the leaver sees new state after answering, and others see nothing', async () => {
  const { call } = handoverFixture();
  const id = await start(call);
  const before = await call(leaver, 'GET', `/api/mcp/interviews?org_id=${A}`);
  assert.equal(before.status, 200);
  assert.equal(before.body.interviews.length, 1);
  const open = before.body.interviews[0].questions.filter(question => question.status === 'open');
  assert.ok(open.length > 0);
  assert.equal((await call(incoming, 'GET', `/api/mcp/interviews?org_id=${A}`)).body.interviews.length, 0, 'draft handovers stay hidden from the incoming member without hiding the request');
  assert.equal((await call(incoming, 'GET', `/api/mcp/interviews?org_id=${A}`)).status, 200);
  assert.equal((await call(stranger, 'GET', `/api/mcp/interviews?org_id=${A}`)).status, 403);
  assert.equal((await call(incoming, 'POST', `/api/mcp/interviews/${id}/answers`, { questionId: open[0].id, answer: 'nope' })).status, 403);
  const answered = await call(leaver, 'POST', `/api/mcp/interviews/${id}/answers`, { questionId: open[0].id, answer: 'Flush it after deploy.' });
  assert.equal(answered.status, 200);
  const after = await call(leaver, 'GET', `/api/mcp/interviews?org_id=${A}`);
  const question = after.body.interviews[0].questions.find(item => item.id === open[0].id);
  assert.equal(question.status, 'answered');
  assert.equal(question.answer, 'Flush it after deploy.');
  assert.equal((await call(leaver, 'POST', `/api/mcp/interviews/${id}/answers`, { questionId: open[0].id, answer: 'again' })).status, 409);
  assert.equal((await call(leaver, 'POST', `/api/mcp/interviews/${id}/answers`, { questionId: 'missing', answer: 'x' })).status, 404);
  assert.equal((await call(leaver, 'POST', `/api/mcp/interviews/${id}/answers`, { questionId: open[1].id, answer: '  ' })).status, 400);
});

const brokenFetches = {
  'a network error': async () => { throw new TypeError('fetch failed'); },
  'an HTTP 500': async () => new Response('boom', { status: 500 }),
  'a rate limit': async () => new Response('slow down', { status: 429 }),
  'non-JSON output': async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }), { status: 200 }),
  'JSON without claims': async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"hello":"world"}' }] } }] }), { status: 200 }),
  'an empty response': async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
};

for (const [label, fetchImpl] of Object.entries(brokenFetches)) {
  test(`generate falls back to evidence-only claims when Gemini fails with ${label}`, async () => {
    const { call, store } = handoverFixture({ GEMINI_API_KEY: 'k' }, fetchImpl);
    const id = await start(call);
    const generated = await call(admin, 'POST', `/api/handovers/${id}/generate`, {});
    assert.equal(generated.status, 200);
    assert.equal(generated.body.handover.generation_mode, 'evidence-only');
    assert.match(generated.body.fallback_reason, /Gemini/);
    assert.ok(generated.body.claims.some(claim => (claim.source_ids ?? []).some(sourceId => sourceId.startsWith('blk-'))));
    assert.equal((await store.get('handovers', id)).generation_mode, 'evidence-only');
    assert.equal(JSON.stringify(generated.body).includes('"k"'), false);
  });
}

test('ask falls back to up to three keyword-matched cited sources when Gemini fails', async () => {
  const { call, id } = await approvedHandover({ GEMINI_API_KEY: 'k' }, async () => { throw new TypeError('fetch failed'); });
  const answer = await call(incoming, 'POST', `/api/handovers/${id}/ask`, { question: 'What about the redis cache?' });
  assert.equal(answer.status, 200);
  assert.equal(answer.body.answer_mode, 'evidence-only');
  assert.match(answer.body.fallback_reason, /Gemini/);
  assert.equal(answer.body.confidence, 'verified');
  assert.equal(answer.body.source_ids.length, 3);
  assert.ok(answer.body.source_ids.every(sourceId => sourceId.startsWith('blk-')));
  assert.match(answer.body.answer, /^Source evidence: Redis cache problem/);
  const none = await call(incoming, 'POST', `/api/handovers/${id}/ask`, { question: 'Who prepares the quarterly invoices?' });
  assert.equal(none.body.confidence, 'missing');
  assert.deepEqual(none.body.source_ids, []);
});

test('ask and generate without any Gemini key are labelled evidence-only without a fallback reason', async () => {
  const { call, id } = await approvedHandover({});
  const answer = await call(incoming, 'POST', `/api/handovers/${id}/ask`, { question: 'redis' });
  assert.equal(answer.body.answer_mode, 'evidence-only');
  assert.equal('fallback_reason' in answer.body, false);
});

test('a configured GEMINI_MODEL is used for every Gemini request, with one shared default', async () => {
  const urls = [];
  const fetchImpl = async url => { urls.push(String(url)); return new Response('{}', { status: 500 }); };
  const custom = handoverFixture({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-custom-1' }, fetchImpl);
  await custom.call(admin, 'POST', `/api/handovers/${await start(custom.call)}/generate`, {});
  await custom.call(admin, 'POST', `/api/collector/messages`, { org_id: A, messages: [{ sessionId: 's', index: 1, role: 'user', content: 'We chose redis.' }] });
  assert.ok(urls.length >= 2);
  assert.ok(urls.every(url => url.includes('models/gemini-custom-1:generateContent')), urls.join('\n'));
  urls.length = 0;
  const standard = handoverFixture({ GEMINI_API_KEY: 'k' }, fetchImpl);
  await standard.call(admin, 'POST', `/api/handovers/${await start(standard.call)}/generate`, {});
  assert.ok(urls.every(url => url.includes('models/gemini-2.5-flash:generateContent')));
});
