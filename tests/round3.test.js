import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore, createSupabaseStore } from '../server/store.js';
import { createHandovers } from '../server/handover.js';
import { createApp } from '../server/app.js';
import { detectConflicts, extractDates } from '../server/conflicts.js';
import { aggregateModules, moduleOf, scoreGap } from '../server/risk.js';
import { audienceFromPaths } from '../server/audience.js';
import { normalizeSourceType, requireSourceType } from '../server/sourceTypes.js';

const ORG = 'org-1';
const admin = { id: 'admin-1', role: 'admin', org_id: ORG };
const leaver = { id: 'leaver-1', role: 'member', org_id: ORG };
const incoming = { id: 'incoming-1', role: 'team', org_id: ORG, function_role: 'backend' };
const members = [
  { id: 'm1', org_id: ORG, user_id: 'leaver-1', name: 'Lea', github_login: 'lea-gh' },
  { id: 'm2', org_id: ORG, user_id: 'second-1', name: 'Sam', github_login: 'sam-gh' },
];
const NOW = '2026-11-14T00:00:00.000Z';

const source = (id, overrides = {}) => ({
  id, org_id: ORG, repository_id: 'repo-1', author_id: null, author_login: null, type: 'decision', content: `Decision ${id}.`,
  metadata: {}, external_id: id, url: null, visibility: 'team', created_at: NOW, ...overrides,
});
const commit = (id, login, files) => source(id, { type: 'commit', author_login: login, content: `commit ${id}`, metadata: { files: files.map(filename => ({ filename })) } });
const setup = (seed = {}, options = {}) => {
  const store = createMemoryStore({ members, ...seed });
  return { store, handovers: createHandovers({ store, env: options.env ?? {}, fetchImpl: options.fetchImpl }) };
};
const start = (handovers, actor = admin) => handovers.start({ orgId: ORG, actor, leaverId: leaver.id, incomingId: incoming.id });

test('module rule groups by the first two directory segments', () => {
  assert.equal(moduleOf('server/handover.js'), 'server');
  assert.equal(moduleOf('src/components/Workspace.jsx'), 'src/components');
  assert.equal(moduleOf('src/components/deep/X.jsx'), 'src/components');
  assert.equal(moduleOf('README.md'), '(root)');
});

test('scoreGap applies the documented weights, caps at 100 and labels by threshold', () => {
  const alert = { module: 'server', changes: 5, sole_contributor: { id: 'leaver-1', name: 'Lea' } };
  const ctx = { now: Date.parse(NOW), alertModules: new Map([['server', alert]]), leaver: { ids: new Set(['leaver-1']), logins: new Set(['lea-gh']) }, conflictSourceIds: new Set(['c1']) };
  const pr = source('pr', { type: 'pull_request', author_id: 'leaver-1', metadata: { state: 'open', number: 7, files: [{ filename: 'server/a.js' }] } });
  const branch = source('br', { type: 'branch', metadata: { name: 'x', base: 'main', ahead_by: 2 } });
  const blocker = source('bl', { type: 'blocker', metadata: { status: 'active' }, created_at: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(scoreGap({ sources: [pr] }, ctx).score, 60);
  assert.equal(scoreGap({ sources: [pr] }, ctx).label, 'high');
  assert.equal(scoreGap({ sources: [branch] }, ctx).score, 30);
  assert.equal(scoreGap({ sources: [branch] }, ctx).label, 'medium');
  const stale = scoreGap({ sources: [blocker] }, ctx);
  assert.equal(stale.score, 30);
  assert.deepEqual(stale.reasons.length, 2);
  assert.equal(scoreGap({ sources: [source('c1')], conflict: true }, ctx).score, 15);
  assert.equal(scoreGap({ sources: [pr, branch, blocker, source('c1')], conflict: true }, ctx).score, 100);
  assert.equal(scoreGap({ sources: [] }, ctx).label, 'low');
});

test('the top question targets the single-contributor module and explains why', async () => {
  const { handovers } = setup({ sources: [
    commit('c1', 'lea-gh', ['server/a.js', 'server/b.js']), commit('c2', 'lea-gh', ['server/a.js']),
    source('b1', { type: 'blocker', content: 'Deploy blocked.', metadata: { status: 'active' } }),
  ] });
  const { questions } = await start(handovers);
  assert.match(questions[0].question_text, /only recorded contributor to server/);
  assert.equal(questions[0].risk_score >= 40, true);
  assert.match(questions[0].risk_reasons.join(' '), /Bus factor 1: only Lea has changed server/);
  assert.deepEqual(questions.map(question => question.risk_score), [...questions.map(question => question.risk_score)].sort((a, b) => b - a));
  assert.equal(questions[0].risk_label, 'medium');
});

test('skipping marks linked claims missing, never blocks generation, and answering verifies linked claims', async () => {
  const { handovers, store } = setup({ sources: [
    source('b1', { type: 'blocker', content: 'Staging deploy is blocked.', metadata: { status: 'active' } }),
    source('d1', { type: 'decision', content: 'Use postgres for jobs.', metadata: {} }),
  ] });
  const started = await start(handovers);
  const generated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  const blockerQuestion = started.questions.find(question => question.source_ids.includes('b1'));
  const decisionQuestion = started.questions.find(question => question.source_ids.includes('d1'));
  const skipped = await handovers.skip({ handoverId: started.handover.id, actor: leaver, questionId: blockerQuestion.id });
  assert.equal(skipped.status, 'skipped');
  await assert.rejects(() => handovers.skip({ handoverId: started.handover.id, actor: incoming, questionId: decisionQuestion.id }), /Forbidden/);
  await assert.rejects(() => handovers.skip({ handoverId: started.handover.id, actor: leaver, questionId: blockerQuestion.id }), /not skippable/);
  const afterSkip = (await store.list('handover_claims', { handover_id: started.handover.id })).filter(claim => claim.source_ids.includes('b1'));
  assert.ok(afterSkip.length && afterSkip.every(claim => claim.confidence === 'missing'));
  assert.ok(afterSkip.every(claim => claim.evidence.some(item => item.text === 'Outgoing member skipped this question')));

  const answered = await handovers.answer({ handoverId: started.handover.id, actor: leaver, questionId: decisionQuestion.id, answer: 'Because jobs must survive restarts. AKIAABCDEFGHIJKLMNOP' });
  const interview = (await store.list('sources', { org_id: ORG })).find(item => item.id === answered.interview_source_id);
  assert.equal(interview.type, 'interview');
  assert.doesNotMatch(interview.content, /AKIAABCDEFGHIJKLMNOP/);
  assert.ok(answered.linked_claim_ids.length);
  const linked = await store.get('handover_claims', answered.linked_claim_ids[0]);
  assert.ok(linked.source_ids.includes(interview.id));
  assert.equal(linked.confidence, 'verified');

  const regenerated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  assert.ok(regenerated.claims.some(claim => /Unanswered gap/.test(claim.text) && claim.source_ids.includes('b1')));
  assert.ok(generated.claims.length > 0);
});

test('detectConflicts flags 10 Nov vs 15 Nov without any model and ignores relative or unrelated dates', () => {
  const tasks = [{ id: 't1', title: 'Ship billing export', due_at: '2026-11-10T00:00:00.000Z', status: 'open' }];
  const conflicts = detectConflicts({ tasks, comments: [{ id: 'k1', task_id: 't1', content: 'Deadline moved to 15 Nov, sorry.' }] });
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].sides.map(side => side.date), ['2026-11-10', '2026-11-15']);
  assert.equal(detectConflicts({ tasks, comments: [{ id: 'k2', task_id: 't1', content: 'Due Nov 15th' }] })[0].sides[1].date, '2026-11-15');
  assert.equal(detectConflicts({ tasks, comments: [{ id: 'k3', task_id: 't1', content: 'now due 15/11' }] })[0].sides[1].date, '2026-11-15');
  assert.equal(detectConflicts({ tasks, comments: [{ id: 'k4', task_id: 't1', content: 'We ship tomorrow or next Friday' }] }).length, 0);
  assert.equal(detectConflicts({ tasks, comments: [{ id: 'k5', task_id: 't1', content: 'Due 10 Nov, confirmed' }] }).length, 0);
  assert.equal(detectConflicts({ tasks, comments: [{ id: 'k6', task_id: 't1', content: 'Standup was on 12 Nov' }] }).length, 0);
  const viaMemory = detectConflicts({ tasks, memories: [{ id: 'mem', type: 'memory', content: 'Ship billing export deadline pushed to 2026-11-20' }] });
  assert.equal(viaMemory[0].sides[1].ref_type, 'source');
  assert.deepEqual(extractDates('moved to 15 Nov and 31/02', 2026).map(item => item.iso), ['2026-11-15']);
});

test('generation adds one conflicting claim citing both sources; only an admin resolution makes it a reviewed claim', async () => {
  const { handovers, store } = setup({
    tasks: [{ id: 't1', org_id: ORG, title: 'Ship billing export', due_at: '2026-11-10', status: 'open' }],
    task_comments: [{ id: 'k1', org_id: ORG, task_id: 't1', author_id: 'admin-1', content: 'Deadline moved to 15 Nov.', created_at: NOW }],
  });
  const started = await start(handovers);
  assert.ok(started.questions.some(question => /Sources disagree/.test(question.question_text) && question.risk_score >= 15));
  const generated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  const claim = generated.claims.find(item => item.confidence === 'conflicting');
  assert.ok(claim);
  assert.equal(claim.source_ids.length, 2);
  const detail = await handovers.get({ handoverId: started.handover.id, actor: admin });
  assert.equal(detail.conflicts.length, 1);
  assert.equal(detail.conflicts[0].claim_id, claim.id);
  assert.deepEqual(detail.conflicts[0].sides.map(side => side.date), ['2026-11-10', '2026-11-15']);
  assert.equal(detail.conflicts[0].resolved, false);
  assert.deepEqual(detail.conflicts[0].sides.map(side => side.source_id).sort(), [...claim.source_ids].sort());

  await assert.rejects(() => handovers.reviewClaim({ handoverId: started.handover.id, actor: admin, claimId: claim.id, status: 'approved' }), /Resolve this conflict/);
  await assert.rejects(() => handovers.resolveConflict({ handoverId: started.handover.id, actor: leaver, claimId: claim.id, resolution: 'x' }), /Forbidden/);
  await assert.rejects(() => handovers.resolveConflict({ handoverId: started.handover.id, actor: admin, claimId: claim.id, resolution: ' ' }), /resolution/);
  const resolved = await handovers.resolveConflict({ handoverId: started.handover.id, actor: admin, claimId: claim.id, resolution: 'The 15 Nov date is correct.', chosenSourceId: claim.source_ids[1] });
  assert.equal(resolved.claim.status, 'approved');
  assert.equal(resolved.claim.confidence, 'verified');
  assert.equal(resolved.conflict.resolved, true);
  assert.equal(resolved.conflict.resolved_by, 'admin-1');
  assert.equal((await store.get('sources', resolved.source_id)).type, 'interview');
  await assert.rejects(() => handovers.resolveConflict({ handoverId: started.handover.id, actor: admin, claimId: claim.id, resolution: 'again' }), /already resolved/);
});

test('bus-factor alerts need three changes and a second real contributor clears them', async () => {
  const { handovers, store } = setup({ sources: [commit('c1', 'lea-gh', ['server/a.js', 'README.md']), commit('c2', 'lea-gh', ['server/b.js'])] });
  let risks = await handovers.risks({ orgId: ORG, actor: admin });
  assert.deepEqual(risks.alerts, []);
  await store.insert('sources', commit('c3', 'lea-gh', ['server/a.js']));
  risks = await handovers.risks({ orgId: ORG, actor: admin });
  assert.equal(risks.alerts.length, 1);
  assert.equal(risks.alerts[0].module, 'server');
  assert.deepEqual(risks.alerts[0].sole_contributor, { id: 'leaver-1', name: 'Lea' });
  assert.equal(risks.alerts[0].changes, 3);
  assert.ok(Array.isArray(risks.bus_factor) && risks.counts && risks.risks);
  const serverModule = risks.modules.find(item => item.module === 'server');
  assert.equal(serverModule.bus_factor, 1);
  assert.equal(serverModule.contributors[0].share, 1);
  assert.deepEqual(risks.matrix.modules, ['server', '(root)']);
  assert.deepEqual(risks.matrix.cells, [[3, 1]]);
  await store.insert('sources', commit('c4', 'sam-gh', ['server/handover.js']));
  risks = await handovers.risks({ orgId: ORG, actor: admin });
  assert.deepEqual(risks.alerts, []);
  assert.equal(risks.modules.find(item => item.module === 'server').contributors.length, 2);
  assert.deepEqual(aggregateModules([], members).alerts, []);
});

test('a backend viewer never receives infra-only text in detail, ask answers, or the model prompt', async () => {
  const secret = 'INFRA-ONLY terraform state bucket credentials';
  const seed = { sources: [
    source('d-open', { content: 'Use the queue for notification fan-out.', metadata: { audience: ['all'] } }),
    source('d-infra', { content: secret, metadata: { audience: ['infra'] } }),
    source('c-infra', { type: 'commit', author_login: 'lea-gh', content: 'tune cluster', metadata: { files: ['infra/terraform/main.tf'] } }),
  ] };
  const { handovers, store } = setup(seed);
  const started = await start(handovers);
  const generated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  for (const claim of generated.claims) await handovers.reviewClaim({ handoverId: started.handover.id, actor: admin, claimId: claim.id, status: 'approved' });
  await handovers.approve({ handoverId: started.handover.id, actor: admin });

  const adminDetail = await handovers.get({ handoverId: started.handover.id, actor: admin });
  assert.match(JSON.stringify(adminDetail), /INFRA-ONLY/);
  assert.equal(adminDetail.hidden_count, 0);
  const detail = await handovers.get({ handoverId: started.handover.id, actor: incoming });
  assert.doesNotMatch(JSON.stringify(detail), /INFRA-ONLY|terraform/i);
  assert.ok(detail.hidden_count >= 2);
  assert.match(JSON.stringify(detail), /notification fan-out/);
  const infraViewer = await handovers.get({ handoverId: started.handover.id, actor: { ...incoming, function_role: 'infra' } });
  assert.match(JSON.stringify(infraViewer), /INFRA-ONLY/);

  const prompts = [];
  const fetchImpl = async (_url, init) => {
    prompts.push(init.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'n/a', source_ids: [], confidence: 'missing' }) }] } }] }), { status: 200 });
  };
  const asking = createHandovers({ store, env: { GEMINI_API_KEY: 'test-key' }, fetchImpl });
  const answered = await asking.ask({ handoverId: started.handover.id, actor: incoming, question: 'Where are the terraform state bucket credentials?' });
  assert.equal(prompts.length, 1);
  assert.doesNotMatch(prompts[0], /INFRA-ONLY|tune cluster|infra\/terraform/);
  assert.match(prompts[0], /notification fan-out/);
  assert.doesNotMatch(JSON.stringify(answered), /INFRA-ONLY/);
  assert.ok(answered.hidden_count >= 1);
  const evidenceOnly = await handovers.ask({ handoverId: started.handover.id, actor: incoming, question: 'terraform state bucket credentials' });
  assert.doesNotMatch(JSON.stringify(evidenceOnly), /INFRA-ONLY/);
  const risks = await handovers.risks({ orgId: ORG, actor: incoming });
  assert.doesNotMatch(JSON.stringify(risks), /infra\/terraform/);
  assert.deepEqual(audienceFromPaths(['infra/terraform/main.tf', 'infra/k8s/a.yaml']), ['infra']);
  assert.deepEqual(audienceFromPaths(['infra/a.tf', 'server/a.js']), ['all']);
});

test('team-role actors are accepted by the engine', async () => {
  const { handovers } = setup({ sources: [source('d1')] });
  const started = await start(handovers);
  await assert.rejects(() => handovers.get({ handoverId: started.handover.id, actor: incoming }), /Forbidden/);
  const risks = await handovers.risks({ orgId: ORG, actor: { id: 'someone', role: 'team', org_id: ORG } });
  assert.ok(risks.counts);
});

test('versions carry metadata and a diff groups claim changes by claim id', async () => {
  const { handovers } = setup({ sources: [source('d1', { content: 'Use the queue.' })] });
  const started = await start(handovers);
  const generated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  const target = generated.claims.find(claim => claim.source_ids.includes('d1'));
  await handovers.reviewClaim({ handoverId: started.handover.id, actor: admin, claimId: target.id, status: 'edited', text: 'Use the durable queue.' });
  const { versions } = await handovers.versions({ handoverId: started.handover.id, actor: admin });
  assert.deepEqual(versions.map(item => item.version_number), [1, 2, 3]);
  for (const version of versions) assert.ok(version.id && version.created_at && version.created_by && version.reason && version.label);
  assert.equal(versions[2].reason, 'Claim approved');
  const diff = await handovers.diff({ handoverId: started.handover.id, actor: admin, from: 2, to: 3 });
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].claim_id, target.id);
  assert.equal(diff.changed[0].before.text, 'Use the queue.');
  assert.equal(diff.changed[0].after.text, 'Use the durable queue.');
  assert.deepEqual([diff.added, diff.removed], [[], []]);
  const wide = await handovers.diff({ handoverId: started.handover.id, actor: admin, from: versions[0].id, to: 3 });
  assert.equal(wide.added.length, generated.claims.length);
  await assert.rejects(() => handovers.diff({ handoverId: started.handover.id, actor: admin, from: 1, to: 99 }), /not found/);
});

test('HTTP routes: skip, resolve, versions, diff and function roles are wired with the right permissions', async () => {
  const { store } = setup({
    organizations: [{ id: ORG, name: 'Org' }],
    members: [{ id: 'ma', org_id: ORG, user_id: 'admin-1', role: 'admin' }, { id: 'ml', org_id: ORG, user_id: 'leaver-1', role: 'member' }, { id: 'mi', org_id: ORG, user_id: 'incoming-1', role: 'team' }],
    sources: [source('b1', { type: 'blocker', content: 'Blocked.', metadata: { status: 'active' } })],
  });
  const app = createApp({ store, env: { BATON_DEMO_MODE: 'true' } });
  const call = async (user, method, path, body) => {
    const { Readable } = await import('node:stream');
    const req = Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: { 'x-baton-demo-user': user, 'content-type': 'application/json' } });
    return new Promise(resolve => {
      const res = { headersSent: false, statusCode: 200, setHeader() {}, writeHead(status) { this.statusCode = status; }, end(data) { this.headersSent = true; resolve({ status: this.statusCode, body: data ? JSON.parse(data) : {} }); } };
      void app(req, res);
    });
  };
  const started = await call('admin-1', 'POST', `/api/orgs/${ORG}/handovers`, { leaverId: 'leaver-1', incomingId: 'incoming-1' });
  assert.equal(started.status, 201);
  const id = started.body.handover.id;
  const question = started.body.questions.find(item => item.source_ids.includes('b1'));
  assert.equal((await call('incoming-1', 'POST', `/api/handovers/${id}/questions/${question.id}/skip`)).status, 403);
  const skipped = await call('leaver-1', 'POST', `/api/handovers/${id}/questions/${question.id}/skip`);
  assert.equal(skipped.status, 200);
  assert.equal(skipped.body.status, 'skipped');
  assert.equal((await call('leaver-1', 'GET', `/api/handovers/${id}/versions`)).body.versions.length >= 2, true);
  assert.equal((await call('leaver-1', 'GET', `/api/handovers/${id}/versions/diff?from=1&to=2`)).status, 200);
  assert.equal((await call('leaver-1', 'POST', `/api/handovers/${id}/conflicts/nope/resolve`, { resolution: 'x' })).status, 403);
  assert.equal((await call('admin-1', 'POST', `/api/handovers/${id}/conflicts/nope/resolve`, { resolution: 'x' })).status, 404);
  assert.equal((await call('leaver-1', 'PATCH', `/api/orgs/${ORG}/members/mi`, { function_role: 'backend' })).status, 403);
  assert.equal((await call('admin-1', 'PATCH', `/api/orgs/${ORG}/members/mi`, { function_role: 'plumber' })).status, 400);
  const patched = await call('admin-1', 'PATCH', `/api/orgs/${ORG}/members/mi`, { function_role: 'backend' });
  assert.equal(patched.body.member.function_role, 'backend');
  const bad = await call('admin-1', 'POST', `/api/orgs/${ORG}/memories`, { type: 'mystery', content: 'x' });
  assert.equal(bad.status, 400);
  const tagged = await call('admin-1', 'POST', `/api/orgs/${ORG}/memories`, { type: 'context', content: 'Terraform notes', audience: ['infra'] });
  assert.equal(tagged.status, 201);
  assert.equal(tagged.body.memory.type, 'memory');
  assert.deepEqual(tagged.body.memory.metadata.audience, ['infra']);
  const state = await call('incoming-1', 'GET', `/api/orgs/${ORG}/state`);
  assert.equal(state.body.sources.some(item => item.content === 'Terraform notes'), false);
});

test('source types are canonical and validated', () => {
  assert.equal(normalizeSourceType('mcp_decision'), 'decision');
  assert.equal(normalizeSourceType('pr'), 'pull_request');
  assert.equal(normalizeSourceType('context'), 'memory');
  assert.equal(normalizeSourceType('nonsense'), null);
  assert.throws(() => requireSourceType('nonsense'), error => error.status === 400);
});

test('the Supabase adapter keeps working against the pre-round-3 schema', async () => {
  const log = [];
  const client = { from: table => ({
    insert: payload => ({ select: () => ({ single: async () => {
      log.push({ table, payload });
      if ('risk_score' in payload) return { data: null, error: { message: "Could not find the 'risk_score' column of 'handover_questions' in the schema cache" } };
      return { data: { id: 'q1', ...payload }, error: null };
    } }) }),
    update: payload => ({ eq: () => ({ select: () => ({ maybeSingle: async () => {
      log.push({ table, payload });
      if ('function_role' in payload) return { data: null, error: { message: 'column "function_role" of relation "org_memberships" does not exist' } };
      return { data: { id: 'm1', ...payload }, error: null };
    } }) }) }),
  }) };
  const store = createSupabaseStore(client);
  const first = await store.insert('handover_questions', { question_text: 'q', risk_score: 40, risk_reasons: ['a'] });
  assert.equal(first.risk_score, undefined);
  await store.insert('handover_questions', { question_text: 'q2', risk_score: 10, risk_reasons: [] });
  assert.equal(log.filter(item => item.payload.question_text === 'q2').every(item => !('risk_score' in item.payload)), true);
  assert.equal(log.filter(item => item.payload.question_text === 'q2').length, 1);
  const member = await store.update('members', 'm1', { function_role: 'infra' });
  assert.equal(member.function_role, undefined);
  await assert.rejects(() => store.insert('sources', { type: 'nonsense', content: 'x' }), /Unsupported source type/);
  const branch = await store.insert('sources', { type: 'branch', content: 'x' });
  assert.equal(branch.type, 'branch');
});
