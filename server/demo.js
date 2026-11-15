import { Readable } from 'node:stream';
import { createMemoryStore } from './store.js';
import { createHandovers } from './handover.js';
import { analyzeWorkspace, composeInterviewAnswer } from './demoInsights.js';

// Synthetic fixture only; demo mode never reads or writes a live project.
export function demoSeed() {
  const created_at = '2026-11-01T10:00:00.000Z';
  const org_id = 'demo-org';
  const repository_id = 'demo-repo';
  const source = (id, type, content, metadata = {}) => ({id,org_id,repository_id,author_id:'demo-member',author_login:'demo-engineer',type,content,metadata,visibility:'team',created_at});
  return {
    organizations:[{id:org_id,name:'Baton Demo · Synthetic data',created_by:'demo-admin',created_at}],
    members:[
      {id:'membership-admin',org_id,user_id:'demo-admin',name:'Alex · Team lead',email:'admin@example.invalid',role:'admin',created_at},
      {id:'membership-member',org_id,user_id:'demo-member',name:'Sam · Departing engineer',email:'sam@example.invalid',role:'member',github_login:'demo-engineer',created_at},
      {id:'membership-incoming',org_id,user_id:'demo-incoming',name:'Riley · Incoming engineer',email:'riley@example.invalid',role:'member',created_at},
    ],
    repositories:[{id:repository_id,org_id,full_name:'synthetic/baton-demo',installation_id:0,created_at,last_synced_at:null,demo:true}],
    sources:[
      source('demo-decision','decision','Use a durable retry queue for outgoing invoice webhooks. Reason: downstream receivers can be temporarily unavailable.',{decision:'Durable webhook retry queue',reason:'Prevent lost invoices during receiver outages.',files_affected:['src/webhooks/queue.ts']}),
      source('demo-pr','pull_request','PR #42: Add idempotency checks to invoice webhook delivery. Open, not merged; retry handling still needs review.',{number:42,state:'open',merged:false,head:'feat/webhook-idempotency',files:['src/webhooks/queue.ts'],author_login:'demo-engineer'}),
      source('demo-blocker','blocker','Retry queue cannot be released until replay protection has been verified.',{status:'active',problem:'Replay protection needs verification',workaround_notes:'Keep the new queue behind its feature flag.'}),
      source('demo-commit','commit','Add webhook retry queue behind an opt-in feature flag.',{sha:'1234567890abcdef1234567890abcdef12345678',files:['src/webhooks/queue.ts'],author_login:'demo-engineer'}),
    ],
    tasks:[{id:'demo-task',org_id,title:'Verify webhook replay protection',description:'Exercise duplicate delivery and recovery after receiver outages.',assignee_id:'demo-member',created_by:'demo-admin',status:'open',due_at:'2026-11-15',created_at}],
  };
}

export const PRODUCTION_ONLY = 'Available in Production mode';
const MAX_STATE_BYTES = 900_000;
const METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
// Tokens, invite links and the MCP collector's push/search run against the caller's demo state only.
const PRODUCTION_PATHS = [
  /^\/api\/invites\//, /^\/api\/github\//, /^\/api\/orgs\/[^/]+\/github\//, /^\/api\/orgs\/[^/]+\/repositories(\/|$)/,
  /^\/api\/collector\/(?!(push|search)$)/, /^\/api\/mcp\//, /^\/api\/demo$/, /^\/api\/orgs$/,
];
export const PREPARE_PATH = '/api/demo/prepare-handover';
const DEMO_BEARER = /^Bearer baton_[A-Za-z0-9_-]{20,200}$/;

const stripEmails = value => {
  if (Array.isArray(value)) return value.map(stripEmails);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(invited_)?email$/i.test(key)).map(([key, item]) => [key, stripEmails(item)]));
};
const refuse = (status, error, extra = {}) => ({ status, body: { error, ...extra } });

// Stateless: the caller owns the state; nothing is persisted, and the engine gets no credentials or network access.
export async function handleDemoRequest(payload, { createApp } = {}) {
  if (typeof createApp !== 'function') throw new TypeError('handleDemoRequest requires createApp');
  const { persona, state, request } = payload ?? {};
  if (!state || typeof state !== 'object' || Array.isArray(state) || !request || typeof request !== 'object') return refuse(400, 'Invalid demo request');
  if (JSON.stringify(payload).length > MAX_STATE_BYTES) return refuse(413, 'Demo state is too large; reset the demo');
  const method = String(request.method ?? 'GET').toUpperCase();
  const path = String(request.path ?? '');
  if (!METHODS.has(method) || !path.startsWith('/api/') || path.includes('..') || path.includes('//')) return refuse(400, 'Unsupported demo request');
  const pathname = path.split('?')[0];
  if (PRODUCTION_PATHS.some(pattern => pattern.test(pathname))) return refuse(403, PRODUCTION_ONLY, { production_only: true });
  if (!Array.isArray(state.organizations) || !state.organizations.length) return refuse(400, 'Demo state is empty; reset the demo');

  const touched = new Set(Object.keys(state));
  const memory = createMemoryStore(state);
  const store = { ...memory };
  for (const name of ['list', 'get', 'insert', 'update', 'remove']) store[name] = (table, ...args) => { touched.add(table); return memory[name](table, ...args); };
  const env = { BATON_DEMO_MODE: 'true' };
  const blocked = async () => { throw new Error(PRODUCTION_ONLY); };
  const app = createApp({ store, env, fetchImpl: blocked, handovers: createHandovers({ store, env, fetchImpl: blocked }), github: {} });

  async function dispatch(personaId, verb, target, body, authorization) {
    const members = await memory.list('members');
    const member = members.find(item => item.user_id === personaId && !item.disabled_at) ?? members.find(item => item.role === 'admin');
    const text = body && verb !== 'GET' ? JSON.stringify(body) : '';
    const headers = { 'x-baton-demo-user': member?.user_id ?? 'demo-admin', 'content-type': 'application/json' };
    if (typeof authorization === 'string' && DEMO_BEARER.test(authorization)) headers.authorization = authorization;
    const req = Object.assign(Readable.from(text ? [Buffer.from(text)] : []), { method: verb, url: target, headers });
    const result = await new Promise(resolve => {
      const res = { headersSent: false, statusCode: 200, setHeader() {}, writeHead(status) { this.statusCode = status; }, end(data) { this.headersSent = true; resolve({ status: this.statusCode, data }); } };
      void app(req, res);
    });
    let parsed = {};
    try { parsed = result.data ? JSON.parse(result.data) : {}; } catch { parsed = { text: String(result.data) }; }
    if (target === '/api/me' && parsed.user) parsed.user.name = member?.name ?? null;
    return { status: result.status, body: parsed };
  }

  const result = method === 'POST' && pathname === PREPARE_PATH
    ? await prepareHandover(dispatch, memory, request.body ?? {})
    : await dispatch(persona, method, path, request.body, request.authorization);

  const nextState = {};
  for (const table of touched) nextState[table] = await memory.list(table);
  return { status: result.status, body: stripEmails(result.body), state: stripEmails(nextState) };
}

// Opens the demo with a handover that is ready except for the conflict: the real engine starts it, the leaver answers
// every exit-interview question from the workspace records, claims are compiled and every non-conflicting claim approved.
async function prepareHandover(dispatch, memory, { orgId = 'demo-org', leaverId = 'demo-leaver', incomingId = 'demo-incoming' }) {
  if ((await memory.list('handovers')).length) return { status: 200, body: { prepared: false } };
  const started = await dispatch('demo-admin', 'POST', `/api/orgs/${orgId}/handovers`, { leaverId, incomingId });
  const id = started.body?.handover?.id;
  if (!id) return started;

  const [sources, members, tasks] = await Promise.all(['sources', 'members', 'tasks'].map(table => memory.list(table)));
  const analysis = analyzeWorkspace({ sources, members, tasks });
  const nameOf = userId => members.find(member => member.user_id === userId)?.name ?? userId;
  const detail = await dispatch('demo-admin', 'GET', `/api/handovers/${id}`);
  const sourcesById = new Map([...sources, ...(detail.body?.sources ?? [])].map(source => [source.id, source]));
  for (const question of detail.body?.questions ?? []) {
    if (question.status !== 'open') continue;
    const answer = composeInterviewAnswer(question, analysis, { sourcesById, leaverName: nameOf(leaverId), incomingName: nameOf(incomingId) });
    await dispatch(leaverId, 'POST', `/api/handovers/${id}/answers`, { questionId: question.id, answer });
  }
  await dispatch('demo-admin', 'POST', `/api/handovers/${id}/generate`);
  const compiled = await dispatch('demo-admin', 'GET', `/api/handovers/${id}`);
  for (const claim of compiled.body?.claims ?? []) {
    if (claim.status !== 'pending' || (claim.conflict && !claim.conflict.resolved)) continue;
    await dispatch('demo-admin', 'PATCH', `/api/handovers/${id}/claims/${claim.id}`, { status: 'approved' });
  }
  return { status: 200, body: { prepared: true, handover_id: id } };
}
