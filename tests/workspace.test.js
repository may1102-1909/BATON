import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../server/store.js';
import { makeApp } from './helpers.js';

const ORG = 'org-1';
const OTHER = 'org-2';
const admin = 'user:user-admin:admin@example.test';
const member = 'user:user-member:member@example.test';
const outsider = 'user:user-out:out@example.test';

function seed() {
  const stamp = '2026-11-10T10:00:00.000Z';
  return createMemoryStore({
    organizations: [{ id: ORG, name: 'Acme Team' }, { id: OTHER, name: 'Other' }],
    members: [
      { id: 'm-admin', org_id: ORG, user_id: 'user-admin', role: 'admin', email: 'admin@example.test', github_login: 'alice' },
      { id: 'm-member', org_id: ORG, user_id: 'user-member', role: 'member', email: 'member@example.test' },
      { id: 'm-out', org_id: OTHER, user_id: 'user-out', role: 'admin', email: 'out@example.test' },
    ],
    repositories: [
      { id: 'repo-1', org_id: ORG, full_name: 'acme/one', installation_id: '1' },
      { id: 'repo-2', org_id: ORG, full_name: 'acme/two', installation_id: '1' },
      { id: 'repo-x', org_id: OTHER, full_name: 'other/repo', installation_id: '2' },
    ],
    sources: [
      { id: 's1', org_id: ORG, repository_id: 'repo-1', type: 'commit', content: 'one', external_id: 'github:acme/one:commit:1', visibility: 'team', created_at: stamp },
      { id: 's2', org_id: ORG, repository_id: 'repo-1', type: 'pull_request', content: 'two', external_id: 'github:acme/one:pull_request:1', visibility: 'team', created_at: stamp },
      { id: 's3', org_id: ORG, repository_id: 'repo-2', type: 'commit', content: 'three', external_id: 'github:acme/two:commit:1', visibility: 'team', created_at: stamp },
      { id: 's4', org_id: ORG, repository_id: null, type: 'memory', content: 'manual note', visibility: 'team', created_at: stamp },
      { id: 'sx', org_id: OTHER, repository_id: 'repo-x', type: 'commit', content: 'x', external_id: 'github:other/repo:commit:1', visibility: 'team', created_at: stamp },
    ],
    tasks: [{ id: 't1', org_id: ORG, title: 'Task', status: 'open' }, { id: 'tx', org_id: OTHER, title: 'Other task', status: 'open' }],
    task_comments: [{ id: 'c1', org_id: ORG, task_id: 't1', content: 'hi' }, { id: 'cx', org_id: OTHER, task_id: 'tx', content: 'hi' }],
    handovers: [{ id: 'h1', org_id: ORG, leaver_id: 'user-member', incoming_id: 'user-admin', status: 'draft' }, { id: 'hx', org_id: OTHER, leaver_id: 'a', incoming_id: 'b', status: 'draft' }],
    handover_claims: [{ id: 'hc1', handover_id: 'h1', org_id: ORG, section: 'risks', text: 'r', source_ids: [], status: 'pending' }, { id: 'hcx', handover_id: 'hx', org_id: OTHER, section: 'risks', text: 'r', source_ids: [], status: 'pending' }],
    handover_questions: [{ id: 'hq1', handover_id: 'h1', org_id: ORG, question_text: 'q', status: 'open' }],
    handover_versions: [{ id: 'hv1', handover_id: 'h1', org_id: ORG, version_number: 1 }],
    handover_events: [{ id: 'he1', handover_id: 'h1', org_id: ORG, event_type: 'created' }],
    tokens: [{ id: 'tk1', org_id: ORG, user_id: 'user-admin', name: 'mcp', token_hash: 'x' }],
    invites: [{ id: 'inv1', org_id: ORG, token_hash: 'y', role: 'member', expires_at: '2030-01-01T00:00:00.000Z' }],
    github_accounts: [{ id: 'ga1', org_id: ORG, user_id: 'user-admin', github_login: 'alice' }],
    github_deliveries: [{ id: 'gd1', repository_id: 'repo-1', delivery_id: 'd1' }],
  });
}
const rows = (store, name, filters = {}) => store.list(name, filters);

test('PATCH /api/orgs/:id renames for admins only and validates the name', async () => {
  const store = seed();
  const { call } = makeApp(store);
  assert.equal((await call(member, 'PATCH', `/api/orgs/${ORG}`, { name: 'Nope' })).status, 403);
  assert.equal((await call(outsider, 'PATCH', `/api/orgs/${ORG}`, { name: 'Nope' })).status, 403);
  assert.equal((await call(admin, 'PATCH', `/api/orgs/${ORG}`, { name: '   ' })).status, 400);
  assert.equal((await call(admin, 'PATCH', `/api/orgs/${ORG}`, { name: 'x'.repeat(81) })).status, 400);
  const renamed = await call(admin, 'PATCH', `/api/orgs/${ORG}`, { name: '  Acme Platform  ' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.organization.name, 'Acme Platform');
  assert.equal((await store.get('organizations', OTHER)).name, 'Other');
});

test('DELETE repository removes its synced sources and nothing else', async () => {
  const store = seed();
  const { call } = makeApp(store);
  assert.equal((await call(member, 'DELETE', `/api/orgs/${ORG}/repositories/repo-1`)).status, 403);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${ORG}/repositories/repo-x`)).status, 404);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${ORG}/repositories/missing`)).status, 404);
  const removed = await call(admin, 'DELETE', `/api/orgs/${ORG}/repositories/repo-1`);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body, { deleted: true, removed_sources: 2 });
  assert.equal(await store.get('repositories', 'repo-1'), null);
  assert.deepEqual((await rows(store, 'sources')).map(item => item.id).sort(), ['s3', 's4', 'sx']);
  assert.equal((await rows(store, 'github_deliveries')).length, 0);
  assert.ok(await store.get('repositories', 'repo-2'));
  assert.ok(await store.get('repositories', 'repo-x'));
});

test('reset requires the exact organization name and a scope', async () => {
  const store = seed();
  const { call } = makeApp(store);
  assert.equal((await call(member, 'POST', `/api/orgs/${ORG}/reset`, { confirm: 'Acme Team', scope: 'sources' })).status, 403);
  assert.equal((await call(admin, 'POST', `/api/orgs/${ORG}/reset`, { confirm: 'acme team', scope: 'sources' })).status, 400);
  assert.equal((await call(admin, 'POST', `/api/orgs/${ORG}/reset`, { scope: 'sources' })).status, 400);
  assert.equal((await call(admin, 'POST', `/api/orgs/${ORG}/reset`, { confirm: 'Acme Team', scope: 'everything' })).status, 400);
  assert.equal((await rows(store, 'sources', { org_id: ORG })).length, 4);
});

test('reset "sources" keeps tasks, handovers, members, tokens, invites and the GitHub link', async () => {
  const store = seed();
  const { call } = makeApp(store);
  const reset = await call(admin, 'POST', `/api/orgs/${ORG}/reset`, { confirm: 'Acme Team', scope: 'sources' });
  assert.equal(reset.status, 200);
  assert.deepEqual(reset.body, { removed: { sources: 4, tasks: 0, handovers: 0 } });
  assert.equal((await rows(store, 'sources', { org_id: ORG })).length, 0);
  assert.equal((await rows(store, 'sources', { org_id: OTHER })).length, 1);
  for (const [name, expected] of [['tasks', 2], ['handovers', 2], ['members', 3], ['tokens', 1], ['invites', 1], ['github_accounts', 1], ['repositories', 3]]) assert.equal((await rows(store, name)).length, expected, name);
});

test('reset "all" also removes tasks, comments, handovers and their children', async () => {
  const store = seed();
  const { call } = makeApp(store);
  const reset = await call(admin, 'POST', `/api/orgs/${ORG}/reset`, { confirm: 'Acme Team', scope: 'all' });
  assert.deepEqual(reset.body, { removed: { sources: 4, tasks: 1, handovers: 1 } });
  for (const name of ['tasks', 'task_comments', 'handovers', 'handover_claims']) assert.deepEqual((await rows(store, name)).map(item => item.org_id), [OTHER], name);
  for (const name of ['handover_questions', 'handover_versions', 'handover_events']) assert.equal((await rows(store, name)).length, 0, name);
  for (const [name, expected] of [['members', 3], ['tokens', 1], ['invites', 1], ['github_accounts', 1]]) assert.equal((await rows(store, name)).length, expected, name);
  assert.equal((await call(admin, 'GET', `/api/orgs/${ORG}/state`)).status, 200);
});

test('DELETE organization removes everything in it and leaves other organizations alone', async () => {
  const store = seed();
  const { call } = makeApp(store);
  assert.equal((await call(member, 'DELETE', `/api/orgs/${ORG}`, { confirm: 'Acme Team' })).status, 403);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${ORG}`, { confirm: 'Wrong' })).status, 400);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${ORG}`)).status, 400);
  assert.equal((await call(admin, 'DELETE', `/api/orgs/${ORG}?confirm=Wrong`)).status, 400);
  assert.ok(await store.get('organizations', ORG));
  const deleted = await call(admin, 'DELETE', `/api/orgs/${ORG}?confirm=Acme%20Team`);
  assert.deepEqual(deleted.body, { deleted: true });
  assert.equal(await store.get('organizations', ORG), null);
  for (const name of ['members', 'repositories', 'sources', 'tasks', 'task_comments', 'handovers', 'handover_claims', 'tokens', 'invites', 'github_accounts']) {
    assert.deepEqual((await rows(store, name)).filter(item => item.org_id === ORG), [], name);
  }
  for (const name of ['handover_questions', 'handover_versions', 'handover_events', 'github_deliveries']) assert.equal((await rows(store, name)).length, 0, name);
  assert.ok(await store.get('organizations', OTHER));
  assert.equal((await rows(store, 'sources', { org_id: OTHER })).length, 1);
  assert.equal((await call(admin, 'GET', `/api/orgs/${ORG}/state`)).status, 403);
});

test('removeWhere is used when a store offers it and the count is reported', async () => {
  const store = seed();
  let calls = 0;
  const original = store.removeWhere;
  store.removeWhere = async (...args) => { calls += 1; return original(...args); };
  const { call } = makeApp(store);
  const removed = await call(admin, 'DELETE', `/api/orgs/${ORG}/repositories/repo-1`);
  assert.equal(removed.body.removed_sources, 2);
  assert.ok(calls >= 1);
});

function exportFixture(status = 'approved') {
  const store = createMemoryStore({
    organizations: [{ id: ORG, name: 'Acme Team' }],
    members: [
      { id: 'm1', org_id: ORG, user_id: 'user-admin', role: 'admin', email: 'admin@example.test' },
      { id: 'm2', org_id: ORG, user_id: 'user-leaver', role: 'member', email: 'leaver@example.test', github_login: 'leaver-login' },
      { id: 'm3', org_id: ORG, user_id: 'user-incoming', role: 'team', email: 'incoming@example.test', github_login: 'new-hire' },
      { id: 'm4', org_id: ORG, user_id: 'user-bystander', role: 'member', email: 'bystander@example.test' },
    ],
    sources: [
      { id: 'src-a', org_id: ORG, type: 'pull_request', content: 'Move billing to queue', metadata: { title: 'Billing queue', number: 12 }, url: 'https://github.com/acme/one/pull/12', visibility: 'team', created_at: '2026-11-01T00:00:00.000Z' },
      { id: 'src-b', org_id: ORG, type: 'decision', content: 'Launch on 15 Nov', visibility: 'team', created_at: '2026-11-02T00:00:00.000Z' },
      { id: 'src-adm', org_id: ORG, type: 'blocker', content: 'Secret vendor contract dispute', visibility: 'admin', created_at: '2026-11-03T00:00:00.000Z' },
    ],
    handovers: [{ id: 'h-1', org_id: ORG, leaver_id: 'user-leaver', incoming_id: 'user-incoming', status, generation_mode: 'evidence-only', created_at: '2026-11-05T00:00:00.000Z', approved_at: '2026-11-06T00:00:00.000Z' }],
    handover_claims: [
      { id: 'c1', handover_id: 'h-1', org_id: ORG, section: 'decisions', text: 'Billing moves to a queue.', source_ids: ['src-a'], confidence: 'verified', status: 'approved', visibility: 'team' },
      { id: 'c2', handover_id: 'h-1', org_id: ORG, section: 'risks', text: 'Vendor contract dispute is open.', source_ids: ['src-adm'], confidence: 'verified', status: 'approved', visibility: 'admin' },
      { id: 'c3', handover_id: 'h-1', org_id: ORG, section: 'next_actions', text: 'Rejected idea.', source_ids: [], confidence: 'inferred', status: 'rejected', visibility: 'team' },
      { id: 'c4', handover_id: 'h-1', org_id: ORG, section: 'risks', text: 'Launch date conflict. Resolution: use 15 Nov', source_ids: ['src-a', 'src-b'], confidence: 'verified', status: 'approved', visibility: 'team',
        evidence: [{ kind: 'conflict', subject: 'Launch date', summary: 'Launch date conflict.', resolved: true, resolution: 'use 15 Nov', chosen_source_id: 'src-b', sides: [{ source_id: 'src-a' }, { source_id: 'src-b' }] }] },
      { id: 'c5', handover_id: 'h-1', org_id: ORG, section: 'risks', text: 'Unanswered gap: the outgoing member skipped "Who owns the cron?".', source_ids: ['src-a'], confidence: 'missing', status: 'approved', visibility: 'team', evidence: [{ kind: 'note', text: 'Outgoing member skipped this question' }] },
    ],
    handover_questions: [
      { id: 'q1', handover_id: 'h-1', org_id: ORG, question_text: 'Who owns the cron?', status: 'skipped', source_ids: ['src-a'], visibility: 'team' },
      { id: 'q2', handover_id: 'h-1', org_id: ORG, question_text: 'What is the rollback plan?', status: 'open', source_ids: [], visibility: 'team' },
      { id: 'q3', handover_id: 'h-1', org_id: ORG, question_text: 'Answered already', status: 'answered', answer: 'yes', source_ids: [], visibility: 'team' },
    ],
  });
  return makeApp(store);
}

test('approved handover exports as Markdown with citations, conflicts and gaps, without emails', async () => {
  const { call } = exportFixture();
  const exported = await call('user:user-incoming:incoming@example.test', 'GET', '/api/handovers/h-1/export.md');
  assert.equal(exported.status, 200);
  assert.match(exported.headers['content-type'], /^text\/markdown/);
  assert.match(exported.headers['content-disposition'], /^attachment; filename="handover-h-1\.md"$/);
  const md = exported.text;
  assert.match(md, /^# Handover — Acme Team/);
  assert.match(md, /\*\*Outgoing:\*\* @leaver-login/);
  assert.match(md, /\*\*Incoming:\*\* @new-hire/);
  assert.match(md, /\*\*Status:\*\* approved/);
  assert.match(md, /## Decisions\n\n- Billing moves to a queue\. _\(verified\)_ \[S1\]/);
  assert.match(md, /## Resolved conflicts\n\n- \*\*Launch date\*\* — use 15 Nov \[S1\] \[S2\]/);
  assert.match(md, /## Known gaps\n\n- Who owns the cron\? _\(skipped by the outgoing member\)_ \[S1\]\n- What is the rollback plan\? _\(unanswered\)_/);
  assert.match(md, /- \[S1\] pull_request · Billing queue — https:\/\/github\.com\/acme\/one\/pull\/12/);
  assert.match(md, /## Exit interview\n\n### Answered already( _\(\w+ risk\)_)?\n\nyes\n/);
  assert.doesNotMatch(md, /Rejected idea|Secret vendor|Vendor contract/);
  assert.doesNotMatch(md, /@example\.test|admin@|leaver@|incoming@/);
});

test('admins see admin-only evidence in the export; bystanders and drafts are refused', async () => {
  const approved = exportFixture();
  const adminExport = await approved.call('user:user-admin:admin@example.test', 'GET', '/api/handovers/h-1/export.md');
  assert.equal(adminExport.status, 200);
  assert.match(adminExport.text, /Vendor contract dispute is open/);
  assert.doesNotMatch(adminExport.text, /Rejected idea/);
  assert.equal((await approved.call('user:user-bystander:bystander@example.test', 'GET', '/api/handovers/h-1/export.md')).status, 403);
  assert.equal((await approved.call('user:user-out:out@example.test', 'GET', '/api/handovers/h-1/export.md')).status, 403);
  assert.equal((await approved.call('user:user-admin:admin@example.test', 'GET', '/api/handovers/missing/export.md')).status, 404);
  const draft = exportFixture('draft');
  const refused = await draft.call('user:user-admin:admin@example.test', 'GET', '/api/handovers/h-1/export.md');
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /approved/i);
});

function searchFixture() {
  const stamp = '2026-11-10T10:00:00.000Z';
  const store = createMemoryStore({
    organizations: [{ id: ORG, name: 'Acme Team' }],
    members: [
      { id: 'm1', org_id: ORG, user_id: 'user-admin', role: 'admin' },
      { id: 'm2', org_id: ORG, user_id: 'user-fe', role: 'team', function_role: 'frontend' },
      { id: 'm3', org_id: ORG, user_id: 'user-infra', role: 'team', function_role: 'infra' },
    ],
    sources: [
      { id: 'pub', org_id: ORG, type: 'memory', content: 'deploy notes public', visibility: 'team', author_id: 'user-admin', metadata: { audience: ['all'] }, created_at: stamp },
      { id: 'adm', org_id: ORG, type: 'memory', content: 'deploy notes admin only', visibility: 'admin', author_id: 'user-admin', metadata: { audience: ['all'] }, created_at: stamp },
      { id: 'prv', org_id: ORG, type: 'memory', content: 'deploy notes private', visibility: 'private', author_id: 'user-admin', metadata: { audience: ['all'] }, created_at: stamp },
      { id: 'inf', org_id: ORG, type: 'memory', content: 'deploy notes terraform', visibility: 'team', author_id: 'user-admin', metadata: { audience: ['infra'] }, created_at: stamp },
    ],
  });
  store.rpc = async () => [
    { kind: 'source', id: 'adm', content: 'deploy notes admin only', path: null, similarity: 0.99 },
    { kind: 'source', id: 'prv', content: 'deploy notes private', path: null, similarity: 0.98 },
    { kind: 'source', id: 'inf', content: 'deploy notes terraform', path: null, similarity: 0.97 },
    { kind: 'file', id: 'f1', content: 'terraform module', path: 'infra/main.tf', similarity: 0.96 },
    { kind: 'file', id: 'f2', content: 'button component', path: 'src/components/Button.jsx', similarity: 0.95 },
    { kind: 'source', id: 'pub', content: 'deploy notes public', path: null, similarity: 0.9 },
  ];
  return store;
}
const embedFetch = async () => new Response(JSON.stringify({ embedding: { values: [0.1, 0.2] } }), { status: 200 });
const searchIds = body => body.data.map(item => item.id).sort();

test('collector search never returns admin, private or other-audience evidence (vector mode)', async () => {
  const { call } = makeApp(searchFixture(), { env: { GEMINI_API_KEY: 'k' }, fetchImpl: embedFetch });
  const fe = await call('user:user-fe', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.equal(fe.body.mode, 'vector');
  assert.deepEqual(searchIds(fe.body), ['f2', 'pub']);
  const infra = await call('user:user-infra', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.deepEqual(searchIds(infra.body), ['f1', 'inf', 'pub']);
  const adm = await call('user:user-admin', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.deepEqual(searchIds(adm.body), ['adm', 'f1', 'f2', 'inf', 'prv', 'pub']);
});

test('collector search text fallback applies the same visibility and audience rules', async () => {
  const { call } = makeApp(searchFixture());
  const fe = await call('user:user-fe', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.equal(fe.body.mode, 'text');
  assert.deepEqual(searchIds(fe.body), ['pub']);
  assert.equal(fe.body.data.every(item => !('embedding' in item)), true);
  const infra = await call('user:user-infra', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.deepEqual(searchIds(infra.body), ['inf', 'pub']);
  const adm = await call('user:user-admin', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.deepEqual(searchIds(adm.body), ['adm', 'inf', 'prv', 'pub']);
});

test('vector hits that are all hidden fall back to filtered text search instead of leaking', async () => {
  const store = searchFixture();
  store.rpc = async () => [{ kind: 'source', id: 'adm', content: 'deploy notes admin only', path: null, similarity: 0.99 }];
  const { call } = makeApp(store, { env: { GEMINI_API_KEY: 'k' }, fetchImpl: embedFetch });
  const fe = await call('user:user-fe', 'GET', `/api/collector/search?org_id=${ORG}&q=deploy`);
  assert.equal(fe.body.mode, 'text');
  assert.deepEqual(searchIds(fe.body), ['pub']);
});
