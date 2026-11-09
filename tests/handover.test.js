import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHandovers } from '../server/handover.js';

const ORG = 'org-1';
const admin = { id: 'admin-1', role: 'admin', org_id: ORG };
const leaver = { id: 'leaver-1', role: 'member', org_id: ORG };
const incoming = { id: 'incoming-1', role: 'member', org_id: ORG };

function setup(seed = {}, options = {}) {
  const tables = new Map(Object.entries(seed).map(([name, records]) => [name, structuredClone(records)]));
  const table = name => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  const store = {
    async list(name, filters = {}) {
      return structuredClone(table(name).filter(record => Object.entries(filters).every(([key, value]) => record[key] === value)));
    },
    async get(name, id) {
      return structuredClone(table(name).find(record => record.id === id) ?? null);
    },
    async insert(name, record) {
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...structuredClone(record) };
      table(name).push(row);
      return structuredClone(row);
    },
    async update(name, id, patch) {
      const records = table(name);
      const index = records.findIndex(record => record.id === id);
      if (index < 0) return null;
      records[index] = { ...records[index], ...structuredClone(patch), id };
      return structuredClone(records[index]);
    },
    async remove(name, id) {
      const records = table(name);
      const index = records.findIndex(record => record.id === id);
      return index < 0 ? null : structuredClone(records.splice(index, 1)[0]);
    },
  };
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
    request = { url, headers: init.headers, body: JSON.parse(init.body) };
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
  assert.match(request.url, /models\/gemini-3\.5-flash:generateContent$/);
  assert.equal(new URL(request.url).searchParams.has('key'), false);
  assert.equal(request.headers['x-goog-api-key'], 'test-key');
  assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
  assert.equal('responseSchema' in request.body.generationConfig, false);
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
  assert.equal(answer.answer_mode, 'evidence-only');
  assert.ok(claims.length > 0);
});

test('Gemini Q&A falls back to quoted evidence when a cited answer is not verbatim-supported', async () => {
  const fetchImpl = async (_url, init) => {
    const prompt = JSON.parse(init.body).contents[0].parts[0].text;
    const claims = prompt.includes('Answer this newcomer question')
      ? { answer: 'The production database is MariaDB.', source_ids: ['source-1'], confidence: 'verified' }
      : { claims: [{ section: 'decisions', text: 'Use the queue to isolate slow notification delivery.', source_ids: ['source-1'], confidence: 'verified' }] };
    return { ok: true, async json() { return { candidates: [{ content: { parts: [{ text: JSON.stringify(claims) }] } }] }; } };
  };
  const { handovers } = setup({ sources: [source()] }, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl });
  const { handoverId } = await prepareApproval(handovers);
  const answer = await handovers.ask({ handoverId, actor: incoming, question: 'What database is used?' });
  assert.match(answer.answer, /Source evidence: Use the queue/);
  assert.doesNotMatch(answer.answer, /MariaDB/);
  assert.deepEqual(answer.source_ids, ['source-1']);
});

test('changed or revoked cited evidence invalidates approval before the incoming user can read it', async () => {
  const { handovers, store } = setup({ sources: [source()] });
  const { handoverId } = await prepareApproval(handovers, store);
  await store.update('sources', 'source-1', { content: 'A different decision was recorded.' });
  await assert.rejects(() => handovers.get({ handoverId, actor: incoming }), /Forbidden/);
  assert.equal((await store.get('handovers', handoverId)).status, 'draft');
  assert.ok((await store.list('handover_claims', { handover_id: handoverId })).some(claim => claim.source_ids.includes('source-1') && claim.status === 'pending'));
  assert.ok((await store.list('handover_events', { handover_id: handoverId })).some(item => item.event_type === 'approval_invalidated'));
});

test('domain failures expose HTTP status and claim decisions use frontend statuses', async () => {
  const { handovers } = setup({ sources: [source()] });
  await assert.rejects(
    () => handovers.start({ orgId: ORG, actor: leaver, leaverId: leaver.id, incomingId: incoming.id }),
    error => error.status === 403,
  );
  await assert.rejects(() => handovers.get({ handoverId: 'missing', actor: admin }), error => error.status === 404);
  const started = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  const generated = await handovers.generate({ handoverId: started.handover.id, actor: admin });
  const edited = await handovers.reviewClaim({
    handoverId: started.handover.id, actor: admin, claimId: generated.claims[0].id, status: 'edited', text: 'Reviewed replacement claim.',
  });
  assert.equal(edited.status, 'approved');
  assert.equal(edited.text, 'Reviewed replacement claim.');
  for (const claim of generated.claims.slice(1)) {
    await handovers.reviewClaim({ handoverId: started.handover.id, actor: admin, claimId: claim.id, status: 'rejected' });
  }
  const claims = await (await handovers.get({ handoverId: started.handover.id, actor: admin })).claims;
  assert.ok(claims.every(claim => ['pending', 'approved', 'rejected'].includes(claim.status)));
});

test('history is returned to the leaver without admin-only source evidence in snapshots', async () => {
  const privateSource = source({
    id: 'admin-source', content: 'ADMIN_ONLY_CONFIDENTIAL_OPERATIONAL_DETAIL', type: 'decision', visibility: 'admin',
  });
  const { handovers } = setup({ sources: [source(), privateSource] });
  const started = await handovers.start({ orgId: ORG, actor: admin, leaverId: leaver.id, incomingId: incoming.id });
  await handovers.generate({ handoverId: started.handover.id, actor: admin });
  const view = await handovers.get({ handoverId: started.handover.id, actor: leaver });
  assert.ok(view.versions.length >= 2);
  assert.ok(view.events.length > 0);
  assert.doesNotMatch(JSON.stringify(view), /ADMIN_ONLY_CONFIDENTIAL_OPERATIONAL_DETAIL|admin-source/);
  assert.ok(view.sources.every(item => item.visibility !== 'admin'));
  assert.ok(view.versions.every(version => (version.source_ids ?? []).every(id => id !== 'admin-source')));
});

test('private sources never enter handover views, newcomer answers, or risk analysis', async () => {
  const privateRecords = [
    source({ id: 'private-decision', type: 'decision', content: 'PRIVATE_DATABASE_SECRET_CONTEXT', visibility: 'private' }),
    source({ id: 'private-blocker', type: 'blocker', content: 'PRIVATE_BLOCKER_CONTEXT', visibility: 'private', metadata: { status: 'blocked' } }),
    source({ id: 'private-commit', type: 'commit', content: 'PRIVATE_COMMIT_CONTEXT', visibility: 'private', author_login: 'private-only-owner' }),
    source({ id: 'private-pr', type: 'pull_request', content: 'PRIVATE_PR_CONTEXT', visibility: 'private', author_login: 'private-only-owner', metadata: { state: 'open', files: [{ filename: 'private/only.js' }] } }),
  ];
  const { handovers } = setup({ sources: privateRecords });
  const { handoverId } = await prepareApproval(handovers);

  const incomingView = await handovers.get({ handoverId, actor: incoming });
  assert.doesNotMatch(JSON.stringify(incomingView), /PRIVATE_|private-only-owner|private\/only\.js|private-(decision|blocker|commit|pr)/);
  const answer = await handovers.ask({ handoverId, actor: incoming, question: 'What is PRIVATE_DATABASE_SECRET_CONTEXT?' });
  assert.match(answer.answer, /not contain enough evidence/i);
  assert.deepEqual(answer.source_ids, []);
  const riskDashboard = await handovers.risks({ orgId: ORG, actor: admin });
  assert.deepEqual(riskDashboard.risks, []);
  assert.equal(riskDashboard.counts.source_records, 0);
  assert.doesNotMatch(JSON.stringify(riskDashboard), /PRIVATE_|private-only-owner|private\/only\.js|private-(decision|blocker|commit|pr)/);
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

test('risk dashboard uses GitHub pull-request file metadata when available', async () => {
  const { handovers } = setup({ sources: [source({
    type: 'pull_request', author_login: 'owner-one', metadata: { state: 'closed', files: [{ filename: 'src/a.js' }, { filename: 'src/b.js' }] },
  })] });
  const risks = await handovers.risks({ orgId: ORG, actor: admin });
  assert.equal(risks.bus_factor[0].measure, 'github_file_contributions');
  assert.equal(risks.bus_factor[0].single_contributor_files, 2);
});
