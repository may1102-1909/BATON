import { createHash, randomBytes } from 'node:crypto';

const MAX_BODY_BYTES = 1024 * 1024;
const roles = new Set(['admin', 'member']);
const hash = value => createHash('sha256').update(value).digest('hex');
const isoNow = () => new Date().toISOString();
const safeToken = () => randomBytes(32).toString('base64url');
async function redact(value) {
  try {
    const module = await import('./redact.js');
    return module.redactData(value);
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    const module = await import('../mcp-server/dist/redact.js');
    return module.redactData(value);
  }
}
const json = (res, status, value) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Expected an object');
    return value;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

function cleanUser(user) {
  return { id: user.id, email: user.email ?? null, name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null };
}

function hasVerifiedGithub(user) {
  return (user.identities ?? []).some(identity => identity.provider === 'github' && identity.identity_data?.user_name);
}

function sourceVisible(source, actor) {
  return actor.role === 'admin' || source.visibility !== 'admin' && (source.visibility !== 'private' || source.author_id === actor.id);
}

async function maybeIntegration(type, store, env, fetchImpl) {
  try {
    const module = await import(type === 'github' ? './github.js' : './handover.js');
    const factory = type === 'github' ? module.createGithub : module.createHandovers;
    if (!factory) throw new Error(`server/${type}.js does not export ${type === 'github' ? 'createGithub' : 'createHandovers'}`);
    return factory({ store, env, fetchImpl });
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') throw new HttpError(503, `${type} integration is not configured`);
    throw error;
  }
}

export function createApp({ store, env = process.env, fetchImpl = fetch, handovers, github, supabaseClient } = {}) {
  if (!store) throw new TypeError('createApp requires a store');
  const configuration = env;
  let serviceClientPromise;
  const getServiceClient = async () => {
    if (supabaseClient) return supabaseClient;
    if (!configuration.SUPABASE_URL || !configuration.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, 'Authentication service is not configured');
    serviceClientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(
      configuration.SUPABASE_URL,
      configuration.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    ));
    return serviceClientPromise;
  };
  let demoReady;
  const ensureDemoSeed = async () => {
    demoReady ??= (async () => {
      if ((await store.list('organizations')).length) return;
      const organization = await store.insert('organizations', { id: 'demo-org', name: 'Demo Organization', created_by: 'demo-admin' });
      await store.insert('members', { org_id: organization.id, user_id: 'demo-admin', role: 'admin', email: 'demo@example.invalid' });
      await store.insert('members', { org_id: organization.id, user_id: 'demo-member', role: 'member', email: 'member@example.invalid' });
      await store.insert('sources', { org_id: organization.id, author_id: 'demo-admin', author: 'Demo Admin', type: 'decision', content: 'Demo workspace is ready.', visibility: 'team', metadata: {} });
    })();
    return demoReady;
  };

  async function authenticate(req) {
    const demo = configuration.BATON_DEMO_MODE === 'true';
    const authorization = req.headers.authorization ?? '';
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match && demo) {
      await ensureDemoSeed();
      const id = String(req.headers['x-baton-demo-user'] || 'demo-admin').slice(0, 100);
      const memberships = (await store.list('members', { user_id: id })).filter(item => !item.disabled_at);
      return { user: { id, email: id === 'demo-admin' ? 'demo@example.invalid' : null }, memberships, demo: true, tokenOrg: null, verifiedGithub: false };
    }
    if (!match) throw new HttpError(401, 'Bearer access token required');
    const bearer = match[1];
    const tokenHash = hash(bearer);
    const tokenRecords = await store.list('tokens', { token_hash: tokenHash });
    const apiToken = tokenRecords.find(item => !item.revoked_at && (!item.expires_at || Date.parse(item.expires_at) > Date.now()));
    if (tokenRecords.length && !apiToken) throw new HttpError(401, 'API token is revoked or expired');
    if (apiToken) {
      const member = (await store.list('members', { org_id: apiToken.org_id, user_id: apiToken.user_id })).find(item => !item.disabled_at);
      if (!member) throw new HttpError(401, 'Token membership is no longer active');
      return { user: { id: apiToken.user_id, email: member.email ?? null }, memberships: [member], demo: false, tokenOrg: apiToken.org_id, verifiedGithub: false, apiToken: true };
    }

    if (demo) throw new HttpError(401, 'Invalid API token');

    const client = await getServiceClient();
    const { data, error } = await client.auth.getUser(bearer);
    if (error || !data?.user) throw new HttpError(401, 'Invalid or expired access token');
    const user = data.user;
    const memberships = (await store.list('members', { user_id: user.id })).filter(item => !item.disabled_at);
    return { user, memberships, demo: false, tokenOrg: null, verifiedGithub: hasVerifiedGithub(user) };
  }

  async function requireOrg(auth, orgId, admin = false) {
    if (!orgId || auth.tokenOrg && auth.tokenOrg !== orgId) throw new HttpError(403, 'Organization scope does not match');
    const membership = auth.memberships.find(item => item.org_id === orgId && !item.disabled_at)
      ?? (await store.list('members', { org_id: orgId, user_id: auth.user.id })).find(item => !item.disabled_at);
    if (!membership) throw new HttpError(403, 'Organization membership required');
    if (admin && (membership.role !== 'admin' || auth.apiToken)) throw new HttpError(403, 'Organization admin role required');
    return { id: auth.user.id, role: membership.role, org_id: orgId, verifiedGithub: auth.verifiedGithub };
  }

  const routes = async (req, res, url, auth, body) => {
    const method = req.method ?? 'GET';
    let match;

    if (method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true, configured: { supabase: Boolean(configuration.SUPABASE_URL && configuration.SUPABASE_SERVICE_ROLE_KEY), github: Boolean(configuration.GITHUB_APP_ID && configuration.GITHUB_PRIVATE_KEY), demo: configuration.BATON_DEMO_MODE === 'true' } });
    }
    if (method === 'GET' && url.pathname === '/api/me') {
      const organizations = [];
      for (const member of auth.memberships.filter(item => !item.disabled_at)) {
        const organization = await store.get('organizations', member.org_id);
        if (organization) organizations.push({ id: organization.id, name: organization.name, role: member.role });
      }
      return json(res, 200, { user: cleanUser(auth.user), organizations, demo: auth.demo });
    }
    if (method === 'POST' && url.pathname === '/api/orgs') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 120) throw new HttpError(400, 'Organization name must be 1–120 characters');
      const organization = await store.insert('organizations', { name, created_by: auth.user.id });
      await store.insert('members', { org_id: organization.id, user_id: auth.user.id, role: 'admin', email: auth.user.email ?? null });
      return json(res, 201, { organization, role: 'admin' });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/state$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1]);
      const [organization, members, repositories, allSources, tasks, handoverRows, tokenRows] = await Promise.all([
        store.get('organizations', actor.org_id), store.list('members', { org_id: actor.org_id }), store.list('repositories', { org_id: actor.org_id }),
        store.list('sources', { org_id: actor.org_id }), store.list('tasks', { org_id: actor.org_id }),
        store.list('handovers', { org_id: actor.org_id }), store.list('tokens', { org_id: actor.org_id }),
      ]);
      const sources = allSources.filter(source => sourceVisible(source, actor));
      const visibleHandovers = handoverRows.filter(row => actor.role === 'admin' || row.leaver_id === actor.id || (row.incoming_id === actor.id && row.status === 'approved'));
      const tokens = tokenRows.filter(token=>actor.role === 'admin' || token.user_id === actor.id).map(({ token_hash, ...token }) => token);
      return json(res, 200, { organization, members, repositories, sources, tasks, handovers: visibleHandovers, tokens });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/invites$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const role = body.role ?? 'member';
      if (!['member', 'admin'].includes(role)) throw new HttpError(400, 'Invite role must be member or admin');
      const token = safeToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const invite = await store.insert('invites', { org_id: actor.org_id, token_hash: hash(token), role, email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : null, created_by: actor.id, expires_at: expiresAt });
      return json(res, 201, { invite: { id: invite.id, org_id: invite.org_id, role: invite.role, email: invite.email, expires_at: invite.expires_at }, token });
    }
    if (method === 'POST' && url.pathname === '/api/invites/accept') {
      const token = typeof body.token === 'string' ? body.token : '';
      if (token.length < 32 || token.length > 256) throw new HttpError(400, 'Invalid invite token');
      const invite = (await store.list('invites', { token_hash: hash(token) }))[0];
      if (!invite || invite.accepted_at || Date.parse(invite.expires_at) <= Date.now()) throw new HttpError(400, 'Invite is invalid, expired, or already used');
      if (invite.email && auth.user.email?.toLowerCase() !== invite.email) throw new HttpError(403, 'Invite email does not match authenticated user');
      const accepted = store.claimInvite
        ? await store.claimInvite(invite.id, auth.user.id, isoNow())
        : await store.update('invites', invite.id, { accepted_at: isoNow(), accepted_by: auth.user.id });
      if (!accepted) throw new HttpError(409, 'Invite has already been accepted or expired');
      const existing = (await store.list('members', { org_id: invite.org_id, user_id: auth.user.id }))[0];
      const membership = existing
        ? await store.update('members', existing.id, { role: invite.role, disabled_at: null })
        : await store.insert('members', { org_id: invite.org_id, user_id: auth.user.id, email: auth.user.email ?? null, role: invite.role });
      return json(res, 200, { organization_id: invite.org_id, membership });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/tokens$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1]);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 100) throw new HttpError(400, 'Token name must be 1–100 characters');
      const token = `baton_${safeToken()}`;
      const record = await store.insert('tokens', { org_id: actor.org_id, user_id: actor.id, name, token_hash: hash(token), expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), revoked_at: null });
      const { token_hash, ...safeRecord } = record;
      return json(res, 201, { token, record: safeRecord });
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/tokens\/([^/]+)$/.exec(url.pathname)) && method === 'DELETE') {
      const actor = await requireOrg(auth, match[1], true);
      const record = await store.get('tokens', match[2]);
      if (!record || record.org_id !== actor.org_id) throw new HttpError(404, 'Token not found');
      const updated = await store.update('tokens', record.id, { revoked_at: record.revoked_at ?? isoNow() });
      const { token_hash, ...safeRecord } = updated;
      return json(res, 200, { record: safeRecord });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/members\/([^/]+)$/.exec(url.pathname)) && method === 'PATCH') {
      const actor = await requireOrg(auth, match[1], true);
      const target = await store.get('members', match[2]);
      if (!target || target.org_id !== actor.org_id) throw new HttpError(404, 'Member not found');
      const patch = {};
      if (body.role !== undefined) {
        if (!roles.has(body.role)) throw new HttpError(400, 'Invalid member role');
        if (target.role === 'admin' && body.role !== 'admin') {
          const admins = (await store.list('members', { org_id: actor.org_id, role: 'admin' })).filter(member => !member.disabled_at);
          if (admins.length <= 1) throw new HttpError(409, 'The organization must retain at least one admin');
        }
        patch.role = body.role;
      }
      if (body.offboarding !== undefined) {
        if (typeof body.offboarding !== 'boolean') throw new HttpError(400, 'offboarding must be a boolean');
        if (body.offboarding && target.role === 'admin') {
          const admins = (await store.list('members', { org_id: actor.org_id, role: 'admin' })).filter(member => !member.disabled_at);
          if (admins.length <= 1) throw new HttpError(409, 'The organization must retain at least one admin');
        }
        patch.disabled_at = body.offboarding ? isoNow() : null;
      }
      if (body.github_login !== undefined) {
        const identity = (auth.user.identities ?? []).find(item => item.provider === 'github' && item.identity_data?.user_name);
        if (!auth.verifiedGithub || !identity || body.github_login !== identity.identity_data.user_name || target.user_id !== actor.id) {
          throw new HttpError(403, 'GitHub login can only be linked to the authenticated member’s verified OAuth identity');
        }
        patch.github_login = identity.identity_data.user_name;
      }
      if (!Object.keys(patch).length) throw new HttpError(400, 'No supported member fields provided');
      const updated = await store.update('members', target.id, patch);
      const adminCount = (await store.list('members', { org_id: actor.org_id, role: 'admin' })).filter(member => !member.disabled_at).length;
      return json(res, 200, { member: updated, recommendation: adminCount < 2 ? 'Add a second organization admin to reduce lockout risk.' : null });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/memories$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1]);
      if (typeof body.type !== 'string' || !body.type.trim() || typeof body.content !== 'string' || !body.content.trim()) throw new HttpError(400, 'type and content are required');
      if (body.visibility && !['team', 'admin', 'private'].includes(body.visibility)) throw new HttpError(400, 'Invalid visibility');
      if (body.visibility === 'admin' && actor.role !== 'admin') throw new HttpError(403, 'Admin visibility requires an admin role');
      if (body.repository_id) {
        const repository = await store.get('repositories', body.repository_id);
        if (!repository || repository.org_id !== actor.org_id) throw new HttpError(400, 'Repository must belong to this organization');
      }
      if (body.event_id && body.session_id) {
        const duplicate = (await store.list('sources', { org_id: actor.org_id, author_id: actor.id, session_id: body.session_id, event_id: body.event_id }))[0];
        if (duplicate) return json(res, 200, { memory: duplicate, deduplicated: true });
      }
      const memoryRecord = { org_id: actor.org_id, author_id: actor.id, author: auth.user.email ?? actor.id, type: body.type.trim().slice(0, 80), content: (await redact(body.content)).slice(0, 100000), metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? await redact(body.metadata) : {}, repository_id: body.repository_id ?? null, session_id: body.session_id ?? null, event_id: body.event_id ?? null, visibility: body.visibility ?? 'team' };
      let memory;
      try { memory = await store.insert('sources', memoryRecord); }
      catch (error) {
        if (!body.event_id || !body.session_id) throw error;
        memory = (await store.list('sources', { org_id: actor.org_id, author_id: actor.id, session_id: body.session_id, event_id: body.event_id }))[0];
        if (!memory) throw error;
        return json(res, 200, { memory, deduplicated: true });
      }
      return json(res, 201, { memory, deduplicated: false });
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/memories\/([^/]+)$/.exec(url.pathname)) && (method === 'PATCH' || method === 'DELETE')) {
      const actor = await requireOrg(auth, match[1]);
      const memory = await store.get('sources', match[2]);
      if (!memory || memory.org_id !== actor.org_id || memory.author_id !== actor.id || memory.external_id || memory.type === 'github_evidence') throw new HttpError(404, 'Memory not found');
      if (method === 'DELETE') return json(res, 200, { memory: await store.remove('sources', memory.id) });
      const patch = {};
      for (const key of ['type', 'content', 'metadata', 'visibility', 'repository_id']) if (body[key] !== undefined) patch[key] = ['content', 'metadata'].includes(key) ? await redact(body[key]) : body[key];
      if (patch.type !== undefined && (typeof patch.type !== 'string' || !patch.type.trim() || patch.type.length > 80)) throw new HttpError(400, 'type must be 1–80 characters');
      if (patch.content !== undefined && (typeof patch.content !== 'string' || !patch.content.trim() || patch.content.length > 100000)) throw new HttpError(400, 'content must be 1–100,000 characters');
      if (patch.repository_id) {
        const repository = await store.get('repositories', patch.repository_id);
        if (!repository || repository.org_id !== actor.org_id) throw new HttpError(400, 'Repository must belong to this organization');
      }
      if (patch.visibility && !['team', 'admin', 'private'].includes(patch.visibility)) throw new HttpError(400, 'Invalid visibility');
      if (!Object.keys(patch).length) throw new HttpError(400, 'No editable fields provided');
      return json(res, 200, { memory: await store.update('sources', memory.id, patch) });
    }
    if (method === 'POST' && url.pathname === '/api/collector/push') {
      const orgId = auth.tokenOrg ?? body.org_id ?? body.payload?.org_id;
      if (!orgId) throw new HttpError(400, 'org_id is required for JWT collector requests');
      if (auth.tokenOrg && (body.org_id ?? body.payload?.org_id) && (body.org_id ?? body.payload?.org_id) !== auth.tokenOrg) throw new HttpError(403, 'Organization scope does not match');
      const actor = await requireOrg(auth, orgId);
      const event = body.payload && typeof body.payload === 'object' ? body.payload : body;
      const type = String(event.type ?? event.event ?? 'memory').slice(0, 80);
      const content = await redact(typeof event.content === 'string' ? event.content : JSON.stringify(event));
      if (!content || content === '{}') throw new HttpError(400, 'Collector payload has no content');
      if (event.repository_id) {
        const repository = await store.get('repositories', event.repository_id);
        if (!repository || repository.org_id !== orgId) throw new HttpError(400, 'Repository must belong to this organization');
      }
      if (event.event_id && event.session_id) {
        const existing = (await store.list('sources', { org_id: orgId, author_id: actor.id, session_id: event.session_id, event_id: event.event_id }))[0];
        if (existing) return json(res, 200, { ok: true, memory: existing, deduplicated: true });
      }
      const record = { org_id: orgId, author_id: actor.id, author: auth.user.email ?? actor.id, type, content: content.slice(0, 100000), metadata: event.metadata && typeof event.metadata === 'object' ? await redact(event.metadata) : {}, repository_id: event.repository_id ?? null, session_id: event.session_id ?? null, event_id: event.event_id ?? null, visibility: event.visibility === 'admin' && actor.role === 'admin' ? 'admin' : 'team' };
      let memory;
      try { memory = await store.insert('sources', record); }
      catch (error) {
        if (!event.event_id || !event.session_id) throw error;
        memory = (await store.list('sources', { org_id: orgId, author_id: actor.id, session_id: event.session_id, event_id: event.event_id }))[0];
        if (!memory) throw error;
        return json(res, 200, { ok: true, memory, deduplicated: true });
      }
      return json(res, 201, { ok: true, memory, deduplicated: false });
    }
    if (method === 'GET' && url.pathname === '/api/collector/search') {
      const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase();
      const orgId = auth.tokenOrg ?? url.searchParams.get('org_id');
      if (!orgId) throw new HttpError(400, 'org_id is required');
      const actor = await requireOrg(auth, orgId);
      const repositoryId = url.searchParams.get('repository_id');
      const sources = await store.list('sources', { org_id: orgId });
      const results = sources.filter(source => sourceVisible(source, actor)
        && (!repositoryId || source.repository_id === repositoryId)
        && (!query || source.content.toLocaleLowerCase().includes(query)))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 25);
      return json(res, 200, { data: results });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/tasks$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1]);
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title || title.length > 240) throw new HttpError(400, 'Task title must be 1–240 characters');
      if (body.assignee_id && !(await store.list('members', { org_id: actor.org_id, user_id: body.assignee_id })).length) throw new HttpError(400, 'Assignee must be an organization member');
      const task = await store.insert('tasks', { org_id: actor.org_id, title, description: body.description ?? '', assignee_id: body.assignee_id ?? null, due_at: body.due_at ?? null, status: 'open', created_by: actor.id });
      return json(res, 201, { task });
    }
    if ((match = /^\/api\/tasks\/([^/]+)$/.exec(url.pathname)) && method === 'PATCH') {
      const task = await store.get('tasks', match[1]);
      if (!task) throw new HttpError(404, 'Task not found');
      const actor = await requireOrg(auth, task.org_id);
      const patch = {};
      for (const key of ['title', 'description', 'assignee_id', 'due_at', 'status']) if (body[key] !== undefined) patch[key] = body[key];
      if (patch.assignee_id && !(await store.list('members', { org_id: actor.org_id, user_id: patch.assignee_id })).some(member => !member.disabled_at)) throw new HttpError(400, 'Assignee must be an active organization member');
      if (patch.title !== undefined && (typeof patch.title !== 'string' || !patch.title.trim() || patch.title.length > 240)) throw new HttpError(400, 'Task title must be 1–240 characters');
      if (patch.description !== undefined && (typeof patch.description !== 'string' || patch.description.length > 20000)) throw new HttpError(400, 'Task description must be at most 20,000 characters');
      if (patch.due_at !== undefined && patch.due_at !== null && Number.isNaN(Date.parse(patch.due_at))) throw new HttpError(400, 'Invalid task due date');
      if (patch.status && !['open', 'in_progress', 'done', 'cancelled'].includes(patch.status)) throw new HttpError(400, 'Invalid task status');
      if (!Object.keys(patch).length) throw new HttpError(400, 'No task fields provided');
      return json(res, 200, { task: await store.update('tasks', task.id, patch) });
    }
    if ((match = /^\/api\/tasks\/([^/]+)\/comments$/.exec(url.pathname)) && method === 'POST') {
      const task = await store.get('tasks', match[1]);
      if (!task) throw new HttpError(404, 'Task not found');
      const actor = await requireOrg(auth, task.org_id);
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!content || content.length > 20000) throw new HttpError(400, 'Comment content must be 1–20,000 characters');
      if (body.parent_id) {
        const parent = await store.get('task_comments', body.parent_id);
        if (!parent || parent.task_id !== task.id || parent.org_id !== actor.org_id) throw new HttpError(400, 'Parent comment must belong to this task');
      }
      const comment = await store.insert('task_comments', { org_id: actor.org_id, task_id: task.id, author_id: actor.id, content, parent_id: body.parent_id ?? null });
      return json(res, 201, { comment });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/handovers$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 201, await module.start({ orgId: actor.org_id, actor, leaverId: body.leaverId, incomingId: body.incomingId }));
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/risks$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1]);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 200, await module.risks({ orgId: actor.org_id, actor }));
    }
    if ((match = /^\/api\/handovers\/([^/]+)$/.exec(url.pathname)) && method === 'GET') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      const actor = await requireOrg(auth, handover.org_id);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 200, await module.get({ handoverId: handover.id, actor }));
    }
    if ((match = /^\/api\/handovers\/([^/]+)\/(answers|generate|approve|acknowledge|ask)$/.exec(url.pathname)) && method === 'POST') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      const actor = await requireOrg(auth, handover.org_id, ['approve'].includes(match[2]));
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      const calls = {
        answers: () => module.answer({ handoverId: handover.id, actor, questionId: body.questionId, answer: body.answer }),
        generate: () => module.generate({ handoverId: handover.id, actor }),
        approve: () => module.approve({ handoverId: handover.id, actor }),
        acknowledge: () => module.acknowledge({ handoverId: handover.id, actor }),
        ask: () => module.ask({ handoverId: handover.id, actor, question: body.question }),
      };
      return json(res, 200, await calls[match[2]]());
    }
    if ((match = /^\/api\/handovers\/([^/]+)\/claims\/([^/]+)$/.exec(url.pathname)) && method === 'PATCH') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      const actor = await requireOrg(auth, handover.org_id);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 200, await module.reviewClaim({ handoverId: handover.id, actor, claimId: match[2], status: body.status, text: body.text }));
    }
    if ((match = /^\/api\/mcp\/interviews(?:\/([^/]+)\/answers)?$/.exec(url.pathname)) && (method === 'GET' || method === 'POST')) {
      if (method === 'GET') {
        const orgId = auth.tokenOrg ?? url.searchParams.get('org_id');
        if (!orgId) throw new HttpError(400, 'org_id is required');
        const actor = await requireOrg(auth, orgId);
        const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
        const rows = await store.list('handovers', { org_id: orgId });
        const interviews = [];
        for (const handover of rows.filter(row => row.incoming_id === actor.id || row.leaver_id === actor.id)) interviews.push(await module.get({ handoverId: handover.id, actor }));
        return json(res, 200, { interviews });
      }
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Interview not found');
      const actor = await requireOrg(auth, handover.org_id);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 200, await module.answer({ handoverId: handover.id, actor, questionId: body.questionId, answer: body.answer }));
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/github\/connect$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 200, await module.startLink({ userId: actor.id, orgId: actor.org_id }));
    }
    if (method === 'GET' && url.pathname === '/api/github/callback') {
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      await module.finishLink({ code: url.searchParams.get('code'), state: url.searchParams.get('state') });
      return res.writeHead(303, {Location:'/dashboard?github=connected', 'Cache-Control':'no-store'}).end();
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/github\/installations$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 200, await module.installations({ userId: actor.id, orgId: actor.org_id }));
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/repositories$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 201, await module.connect({ userId: actor.id, orgId: actor.org_id, installationId: body.installationId, fullName: body.fullName }));
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/repositories\/([^/]+)\/sync$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const repository = await store.get('repositories', match[2]);
      if (!repository || repository.org_id !== actor.org_id) throw new HttpError(404, 'Repository not found');
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 200, await module.sync({ repository, actorId: actor.id }));
    }
    if (method === 'POST' && url.pathname === '/api/github/webhook') {
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      try { return json(res, 200, await module.webhook({ rawBody: req.rawBody ?? Buffer.alloc(0), headers: req.headers })); }
      catch (error) {
        if (/signature|delivery|event headers|webhook JSON/i.test(error.message)) throw new HttpError(401, 'Invalid GitHub webhook signature or payload');
        throw error;
      }
    }
    throw new HttpError(404, 'Not found');
  };

  return async (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigins = String(configuration.BATON_ALLOWED_ORIGINS ?? '').split(',').map(item => item.trim()).filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'authorization,content-type,x-baton-demo-user');
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.writeHead(origin && !allowedOrigins.includes(origin) ? 403 : 204).end();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'POST' && url.pathname === '/api/github/webhook') {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
          chunks.push(chunk);
        }
        req.rawBody = Buffer.concat(chunks);
        return await routes(req, res, url, { user: { id: 'github-webhook' }, memberships: [], demo: false }, {});
      }
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const auth = ['/api/health','/api/github/callback'].includes(url.pathname) ? { user: { id: 'health' }, memberships: [], demo: configuration.BATON_DEMO_MODE === 'true' } : await authenticate(req);
      if (auth.apiToken && !['/api/collector/push', '/api/collector/search', '/api/mcp/interviews'].includes(url.pathname)
        && !/^\/api\/mcp\/interviews\/[^/]+\/answers$/.test(url.pathname)
        && !(req.method === 'GET' && /^\/api\/orgs\/[^/]+\/state$/.test(url.pathname))) throw new HttpError(403, 'API tokens are limited to collector and MCP interview access');
      return await routes(req, res, url, auth, body);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error instanceof HttpError ? error.status
        : Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      return json(res, status, { error: status === 500 ? 'Internal server error' : error.message });
    }
  };
}
