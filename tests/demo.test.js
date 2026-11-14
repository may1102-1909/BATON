import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { handleDemoRequest } from '../server/demo.js';
import { getInitialDemoState } from '../src/pages/demoSandbox.js';

const call = (state, persona, method, path, body) => handleDemoRequest({ persona, state, request: { method, path, body } }, { createApp });
const hasEmail = value => /"email"|[^\s"]+@[^\s"]+\.[a-z]/i.test(JSON.stringify(value));

test('the admin persona is signed in without any email in responses or state', async () => {
  const seed = getInitialDemoState();
  const me = await call(seed, 'demo-admin', 'GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'May (Admin)');
  assert.equal(me.body.organizations[0].name, 'BATON Team · DEMO');
  assert.equal(me.body.organizations[0].role, 'admin');
  assert.equal(hasEmail(me), false);
  assert.equal(seed.members.find(member => member.user_id === 'demo-admin').github_login, 'may1102-1909');
  assert.equal(hasEmail(seed), false);
  const state = await call(seed, 'demo-admin', 'GET', '/api/orgs/demo-org/state');
  assert.equal(state.status, 200);
  assert.ok(state.body.sources.some(source => source.type === 'commit'));
  assert.equal(hasEmail(state), false);
});

test('a handover is generated and read back through the real engine', async () => {
  const seed = getInitialDemoState();
  const started = await call(seed, 'demo-admin', 'POST', '/api/orgs/demo-org/handovers', { leaverId: 'demo-leaver', incomingId: 'demo-incoming' });
  assert.equal(started.status, 201);
  const id = started.body.handover.id;
  assert.ok(started.body.questions.length > 0);
  const generated = await call(started.state, 'demo-admin', 'POST', `/api/handovers/${id}/generate`);
  assert.equal(generated.status, 200);
  const detail = await call(generated.state, 'demo-admin', 'GET', `/api/handovers/${id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.claims.length > 0);
  assert.ok(detail.body.sources.length > 0);
  const risks = await call(generated.state, 'demo-admin', 'GET', '/api/orgs/demo-org/risks');
  assert.equal(risks.status, 200);
  assert.equal(hasEmail([detail, risks]), false);
});

test('tokens, invites and GitHub OAuth are production only', async () => {
  const seed = getInitialDemoState();
  for (const [method, path, body] of [
    ['POST', '/api/orgs/demo-org/tokens', { name: 'ci' }],
    ['POST', '/api/orgs/demo-org/invites', { role: 'member' }],
    ['GET', '/api/orgs/demo-org/github/connect'],
    ['POST', '/api/demo', {}],
  ]) {
    const result = await call(seed, 'demo-admin', method, path, body);
    assert.equal(result.status, 403, path);
    assert.equal(result.body.error, 'Available in Production mode');
  }
});

test('state round-trips and the caller state is never mutated', async () => {
  const seed = getInitialDemoState();
  const before = JSON.stringify(seed);
  const created = await call(seed, 'demo-admin', 'POST', '/api/orgs/demo-org/tasks', { title: 'Check the round trip', assignee_id: 'demo-incoming' });
  assert.equal(created.status, 201);
  assert.equal(JSON.stringify(seed), before);
  assert.ok(created.state.tasks.some(task => task.title === 'Check the round trip'));
  const again = await call(created.state, 'demo-incoming', 'GET', '/api/orgs/demo-org/state');
  assert.equal(again.status, 200);
  assert.ok(again.body.tasks.some(task => task.title === 'Check the round trip'));
});

test('oversized or empty demo state is rejected', async () => {
  const seed = getInitialDemoState();
  seed.sources.push({ id: 'huge', org_id: 'demo-org', content: 'x'.repeat(1_000_000) });
  assert.equal((await call(seed, 'demo-admin', 'GET', '/api/me')).status, 413);
  assert.equal((await call({}, 'demo-admin', 'GET', '/api/me')).status, 400);
});
