import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { handleDemoRequest } from '../server/demo.js';
import { getInitialDemoState } from '../src/pages/demoSandbox.js';
import { buildHandoverMarkdown } from '../src/pages/demoHandoverDoc.js';
import { markdownToPdf } from '../src/pages/demoPdf.js';

const call = (state, persona, method, path, body) => handleDemoRequest({ persona, state, request: { method, path, body } }, { createApp });
const hasEmail = value => /"email"|[^\s"]+@[^\s"]+\.[a-z]/i.test(JSON.stringify(value));

test('the admin persona is signed in without any email in responses or state', async () => {
  const seed = getInitialDemoState();
  const me = await call(seed, 'demo-admin', 'GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'May (Admin)');
  assert.equal(me.body.organizations[0].name, 'Mumbai_wale Hackathon Org · DEMO');
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

test('GitHub OAuth, invite acceptance and other collector routes stay production only', async () => {
  const seed = getInitialDemoState();
  for (const [method, path, body] of [
    ['GET', '/api/orgs/demo-org/github/connect'],
    ['POST', '/api/invites/accept', { token: 'x'.repeat(40) }],
    ['POST', '/api/collector/commit', {}],
    ['POST', '/api/demo', {}],
  ]) {
    const result = await call(seed, 'demo-admin', method, path, body);
    assert.equal(result.status, 403, path);
    assert.equal(result.body.error, 'Available in Production mode');
  }
});

test('a demo MCP token authenticates the collector push and search the MCP server uses, and invites can be created', async () => {
  const seed = getInitialDemoState();
  const token = await call(seed, 'demo-admin', 'POST', '/api/orgs/demo-org/tokens', { name: 'claude' });
  assert.equal(token.status, 201);
  assert.match(token.body.token, /^baton_/);
  const authorization = `Bearer ${token.body.token}`;
  const fakeKey = 'sk_' + 'live_SAMPLE00000000000000000000';
  const event = { type: 'decision', data: { decision: `Rotate ${fakeKey}`, reason: 'leaked' }, org_id: 'demo-org', repository_id: 'demo-repo', session_id: 's', event_id: 'e', source: 'baton-mcp-server' };
  const pushed = await handleDemoRequest({ persona: 'demo-admin', state: token.state, request: { method: 'POST', path: '/api/collector/push', body: event, authorization } }, { createApp });
  assert.equal(pushed.status, 201);
  assert.doesNotMatch(pushed.body.memory.content, /sk_live_SAMPLE/);
  const searched = await handleDemoRequest({ persona: 'demo-admin', state: pushed.state, request: { method: 'GET', path: '/api/collector/search?q=Rotate&org_id=demo-org', authorization } }, { createApp });
  assert.equal(searched.status, 200);
  const unauthenticated = await handleDemoRequest({ persona: 'demo-admin', state: pushed.state, request: { method: 'POST', path: '/api/collector/push', body: event, authorization: 'Bearer baton_not-a-real-token-at-all-xx' } }, { createApp });
  assert.equal(unauthenticated.status, 401);
  const invite = await call(seed, 'demo-admin', 'POST', '/api/orgs/demo-org/invites', { role: 'member' });
  assert.equal(invite.status, 201);
  assert.ok(invite.body.token.length >= 32);
});

test('the prepared demo handover is answered and approved except its conflict, and the export follows the workspace commits', async () => {
  const seed = getInitialDemoState();
  assert.deepEqual(seed.members.map(member => member.name), ['May (Admin)', 'Vikrant GP', 'Krishna Gupta']);
  assert.ok(!JSON.stringify(seed.sources).includes('renoschubert'));
  const prepared = await call(seed, 'demo-admin', 'POST', '/api/demo/prepare-handover', {});
  assert.equal(prepared.status, 200);
  const id = prepared.body.handover_id;
  const detail = await call(prepared.state, 'demo-admin', 'GET', `/api/handovers/${id}`);
  assert.ok(detail.body.questions.length > 0 && detail.body.questions.every(question => question.status === 'answered' && question.answer));
  const pending = detail.body.claims.filter(claim => claim.status === 'pending');
  assert.equal(pending.length, 1);
  assert.ok(pending[0].conflict && !pending[0].conflict.resolved);
  const again = await call(prepared.state, 'demo-admin', 'POST', '/api/demo/prepare-handover', {});
  assert.equal(again.body.prepared, false);

  const conflict = detail.body.conflicts[0];
  const resolved = await call(prepared.state, 'demo-admin', 'POST', `/api/handovers/${id}/conflicts/${conflict.claim_id}/resolve`, { resolution: 'Comment is current.', chosen_source_id: conflict.sides[1].source_id });
  const approved = await call(resolved.state, 'demo-admin', 'POST', `/api/handovers/${id}/approve`);
  assert.equal(approved.status, 200);
  const final = await call(approved.state, 'demo-admin', 'GET', `/api/handovers/${id}`);
  const workspace = (await call(approved.state, 'demo-admin', 'GET', '/api/orgs/demo-org/state')).body;
  const memberLabel = userId => workspace.members.find(member => member.user_id === userId)?.name ?? userId;
  const build = sources => buildHandoverMarkdown({ detail: final.body, workspace: { ...workspace, sources }, memberLabel, orgName: 'Demo', repositoryName: 'may1102-1909/BATON' });
  const markdown = build(workspace.sources);
  assert.match(markdown, /^# Engineering handover: Vikrant GP to Krishna Gupta/);
  assert.match(markdown, new RegExp(`${workspace.sources.filter(source => source.type === 'commit').length} commits`));
  assert.match(markdown, /Resolved by May \(Admin\)/);
  const fewer = build(workspace.sources.filter((source, index) => source.type !== 'commit' || index % 2 === 0));
  assert.notEqual(fewer, markdown);
  const pdf = Buffer.from(markdownToPdf(markdown)).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'));
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

test('the demo shows a deadline conflict, bus-factor alerts, a leaver-scoped handover and role-hidden items through the real engine', async () => {
  const seed = getInitialDemoState();
  assert.ok(seed.sources.every(source => !/\[SAMPLE\]/.test(source.content ?? '')) && seed.tasks.every(task => !/\[SAMPLE\]/.test(task.title)));
  const started = await call(seed, 'demo-admin', 'POST', '/api/orgs/demo-org/handovers', { leaverId: 'demo-leaver', incomingId: 'demo-incoming' });
  const top = started.body.questions[0];
  assert.match(top.question_text, /3D Paper template variants/);
  assert.ok(top.risk_score >= 20 && top.risk_reasons.length);
  const generated = await call(started.state, 'demo-admin', 'POST', `/api/handovers/${started.body.handover.id}/generate`);
  const detail = await call(generated.state, 'demo-admin', 'GET', `/api/handovers/${started.body.handover.id}`);
  assert.equal(detail.body.conflicts.length, 1);
  assert.deepEqual(detail.body.conflicts[0].sides.map(side => side.date), ['2026-11-10', '2026-11-15']);
  const risks = await call(generated.state, 'demo-admin', 'GET', '/api/orgs/demo-org/risks');
  assert.ok(risks.body.alerts.length >= 1 && risks.body.modules.length && risks.body.matrix.cells.length);
  // Vikrant's handover covers only his frontend work, even though the workspace has backend records.
  assert.ok(detail.body.claims.length && detail.body.claims.every(claim => !/server\/|mcp-server|supabase/.test(claim.text)));

  let state = generated.state;
  for (const claim of detail.body.claims) {
    const response = claim.conflict
      ? await call(state, 'demo-admin', 'POST', `/api/handovers/${started.body.handover.id}/conflicts/${claim.id}/resolve`, { resolution: 'Use 15 Nov.' })
      : await call(state, 'demo-admin', 'PATCH', `/api/handovers/${started.body.handover.id}/claims/${claim.id}`, { status: 'approved' });
    assert.equal(response.status, 200);
    state = response.state;
  }
  const approved = await call(state, 'demo-admin', 'POST', `/api/handovers/${started.body.handover.id}/approve`);
  assert.equal(approved.status, 200);
  const incomingView = await call(approved.state, 'demo-incoming', 'GET', `/api/handovers/${started.body.handover.id}`);
  assert.equal(incomingView.status, 200);
  assert.ok(incomingView.body.hidden_count >= 1);
  assert.doesNotMatch(JSON.stringify(incomingView.body), /Terraform state/);
  assert.equal(hasEmail([detail, risks, incomingView]), false);
});

test('Antigravity memory pushed with the demo MCP token is cited by the prepared handover alongside GitHub history', async () => {
  const { ANTIGRAVITY_SESSION } = await import('../src/pages/demoSandbox.js');
  let { state, body } = await call(getInitialDemoState(), 'demo-admin', 'POST', '/api/orgs/demo-org/tokens', { name: 'antigravity' });
  for (const memory of ANTIGRAVITY_SESSION.memories) {
    const payload = { type: memory.type, content: memory.content, repository_id: 'demo-repo', session_id: ANTIGRAVITY_SESSION.session_id, event_id: memory.event_id, metadata: { ...memory.metadata, mcp_client: 'antigravity' } };
    const pushed = await handleDemoRequest({ persona: 'demo-admin', state, request: { method: 'POST', path: '/api/collector/push', body: { payload }, authorization: `Bearer ${body.token}` } }, { createApp });
    assert.equal(pushed.status, 201);
    state = pushed.state;
  }
  const prepared = await call(state, 'demo-admin', 'POST', '/api/demo/prepare-handover', { orgId: 'demo-org', leaverId: 'demo-leaver', incomingId: 'demo-incoming' });
  assert.ok(prepared.status < 300, JSON.stringify(prepared.body));
  const memoryIds = new Set(prepared.state.sources.filter(s => s.metadata?.mcp_client === 'antigravity').map(s => s.id));
  const githubIds = new Set(prepared.state.sources.filter(s => /^decision-[0-9a-f]{12}$/.test(s.id)).map(s => s.id));
  const cited = (prepared.state.handover_claims ?? []).flatMap(c => c.source_ids ?? []);
  assert.equal(memoryIds.size, 3);
  assert.ok(cited.some(id => memoryIds.has(id)), 'handover cites Antigravity memory');
  assert.ok(cited.some(id => githubIds.has(id)), 'handover cites GitHub history');
});
