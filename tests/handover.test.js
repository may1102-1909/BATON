import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../server/store.js';
import { createHandovers } from '../server/handover.js';

const ORG = 'org-1';
const admin = { id: 'admin-1', role: 'admin', org_id: ORG };
const leaver = { id: 'leaver-1', role: 'member', org_id: ORG };
const incoming = { id: 'incoming-1', role: 'member', org_id: ORG };

function setup(seed = {}, options = {}) {
  const store = createMemoryStore(seed);
  const handovers = createHandovers({ store, env: options.env ?? {}, fetchImpl: options.fetchImpl });
  return { store, handovers };
}

function source(overrides = {}) {
  return {
    id: 'source-1', org_id: ORG, repository_id: 'repo-1', author_id: 'u1', author_login: 'dev-one',
    type: 'decision', content: 'Use the queue to isolate slow notification delivery.',
    metadata: {}, external_id: 'decision-1', url: null, visibility: 'team',
    created_at: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

async function prepareApproval(handovers, store) {
  const created = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  const generated = await handovers.generate({ handoverId: created.handover.id, actor: admin });
  for (const claim of generated.claims) {
    await handovers.reviewClaim({ handoverId: created.handover.id, actor: admin, claimId: claim.id, status: 'approved' });
  }
  await handovers.approve({ handoverId: created.handover.id, actor: admin });
  return { handoverId: created.handover.id, claims: generated.claims, store };
}

test('start creates evidence-specific questions for gaps in source metadata', async () => {
  const { handovers, store } = setup({ sources: [
    source({ id: 'pr-1', type: 'pull_request', content: 'Refactor caching', metadata: { number: 42, state: 'open' }, url: 'https://example.test/pr/42' }),
    source({ id: 'decision-1', type: 'decision', content: 'Use postgres for durable jobs.', metadata: {} }),
    source({ id: 'blocker-1', type: 'blocker', content: 'The staging deploy is blocked.', metadata: { status: 'active' }, visibility: 'admin' }),
  ] });

  const result = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  assert.equal(result.questions.length >= 5, true);
  assert.equal(result.questions.length <= 10, true);
  assert.ok(result.questions.some(question => question.source_ids.includes('pr-1')));
  assert.ok(result.questions.some(question => question.source_ids.includes('decision-1')));
  assert.ok(result.questions.some(question => question.source_ids.includes('blocker-1') && question.visibility === 'admin'));
  assert.ok((await store.list('handover_versions', { handover_id: result.handover.id })).length === 1);
  await assert.rejects(() => handovers.start({ orgId: ORG, actor: leaver, leaverId: leaver.id, incomingId: incoming.id }), /Forbidden/);
});

test('generation without Gemini uses source evidence and an explicit evidence-only mode', async () => {
  const { handovers } = setup({ sources: [source()] });
  const started = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  const result = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  assert.equal(result.handover.generation_mode, 'evidence-only');
  const decisions = result.claims.filter(claim => claim.section === 'decisions');
  assert.equal(decisions.length, 1);
  assert.deepEqual(decisions[0].source_ids, ['source-1']);
  assert.equal(decisions[0].confidence, 'verified');
  assert.ok(result.claims.some(claim => claim.section === 'dependencies' && claim.confidence === 'missing'));
});

test('Gemini output only keeps allowed citations and cannot elevate unsupported claims to verified', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, body: JSON.parse(init.body) };
    return {
      ok: true,
      async json() {
        return { candidates: [{ content: { parts: [{ text: JSON.stringify({ claims: [
          { section: 'decisions', text: 'The system uses a queue architecture.', source_ids: ['source-1'], confidence: 'verified' },
          { section: 'risks', text: 'The company has a severe security incident.', source_ids: ['forged-source'], confidence: 'verified' },
        ] }) }] } }] };
      },
    };
  };
  const { handovers } = setup({ sources: [source()] }, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl });
  const started = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  const result = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  assert.match(request.url, /models\/gemini-2\.5-flash:generateContent\?key=/);
  assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
  const decision = result.claims.find(claim => claim.section === 'decisions');
  assert.deepEqual(decision.source_ids, ['source-1']);
  assert.equal(decision.confidence, 'inferred');
  const fakeIncident = result.claims.find(claim => claim.section === 'risks');
  assert.equal(fakeIncident.source_ids.length, 0);
  assert.equal(fakeIncident.confidence, 'missing');
});

test('leaver alone answers assigned questions; admins must resolve claim reviews before approval', async () => {
  const { handovers, store } = setup({ sources: [source()] });
  const started = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  const target = started.questions[0];
  await assert.rejects(() => handovers.answer({ handoverId: started.handover.id, actor: incoming, questionId: target.id, answer: 'no' }), /Forbidden/);
  const answered = await handovers.answer({ handoverId: started.handover.id, actor: leaver, questionId: target.id, answer: 'The worker owns retries.' });
  assert.equal(answered.status, 'answered');
  await assert.rejects(() => handovers.approve({ handoverId: started.handover.id, actor: admin }), /pending claim/);
  const generated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  for (const claim of generated.claims) {
    await handovers.reviewClaim({ handoverId: started.handover.id, actor: admin, claimId: claim.id, status: 'approved' });
  }
  const approved = await handovers.approve({ handoverId: started.handover.id, actor: admin });
  assert.equal(approved.status, 'approved');
  const publicView = await handovers.get({ handoverId: started.handover.id, actor: incoming });
  assert.equal(publicView.handover.status, 'approved');
  assert.ok(publicView.claims.every(claim => claim.visibility !== 'admin'));
  assert.ok((await store.list('handover_events', { handover_id: started.handover.id })).some(item => item.event_type === 'claim_reviewed'));
  const acknowledged = await handovers.acknowledge({ handoverId: started.handover.id, actor: incoming });
  assert.equal(acknowledged.acknowledged_by, incoming.id);
});

test('incoming Q&A is cited and does not invent an answer when no approved evidence matches', async () => {
  const { handovers } = setup({ sources: [source()] });
  const { handoverId, claims } = await prepareApproval(handovers);
  const answer = await handovers.ask({ handoverId, actor: incoming, question: 'What is the production database password?' });
  assert.match(answer.answer, /not contain enough evidence/i);
  assert.deepEqual(answer.source_ids, []);
  assert.equal(answer.confidence, 'missing');
  assert.ok(claims.length > 0);
});

test('changed or revoked cited evidence invalidates approval before the incoming user can read it', async () => {
  const { handovers, store } = setup({ sources: [source()] });
  const { handoverId } = await prepareApproval(handovers, store);
  await store.update('sources', 'source-1', { content: 'A different decision was recorded.' });
  await assert.rejects(() => handovers.get({ handoverId, actor: incoming }), /Forbidden/);
  assert.equal((await store.get('handovers', handoverId)).status, 'draft');
  assert.ok((await store.list('handover_events', { handover_id: handoverId })).some(item => item.event_type === 'approval_invalidated'));
});

test('risk dashboard labels commit authors as a proxy and clearly reports missing data', async () => {
  const { handovers } = setup({ sources: [
    source({ type: 'commit', author_login: 'solo', repository_id: 'repo-1', content: 'commit one' }),
    source({ id: 'commit-2', type: 'commit', author_login: 'solo', repository_id: 'repo-1', content: 'commit two' }),
  ] });
  const risks = await handovers.risks({ orgId: ORG, actor: admin });
  assert.equal(risks.bus_factor[0].risk, 'high');
  assert.match(risks.bus_factor[0].evidence, /proxy/);
  const empty = setup();
  assert.equal((await empty.handovers.risks({ orgId: ORG, actor: admin })).bus_factor.available, false);
});
