import { createHash, randomBytes } from 'node:crypto';
import { handleDemoRequest } from './demo.js';
import { FUNCTION_ROLES, audienceOf, canSee, cleanAudience, audienceFromPaths } from './audience.js';
import { filesOf } from './risk.js';
import { requireSourceType } from './sourceTypes.js';
import { EMBEDDING_MODEL, geminiGenerateUrl } from './gemini.js';
import { handoverMarkdown } from './export.js';

const MAX_BODY_BYTES = 1024 * 1024;
const roles = new Set(['admin', 'member', 'team']);
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

async function embedText(text, key, fetchImpl = fetch) {
  if (!key || !text) return null;
  try {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: String(text).slice(0, 4000) }] }
      })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.embedding?.values ?? null;
  } catch {
    return null;
  }
}

async function extractDecisionsFromMessages(messages, key, fetchImpl = fetch, env = process.env) {
  if (!key || !messages || !messages.length) return [];
  try {
    const transcript = messages.map(m => `[${m.role.toUpperCase()} #${m.message_index}]: ${m.content}`).join('\n');
    const prompt = `Analyze this AI-developer conversation transcript. Extract any architectural decisions, library adoptions, or operational blockers.\nReturn ONLY valid JSON array with objects matching:\n[{ "type": "decision"|"blocker", "content": "concise statement", "reason": "why", "files_affected": ["path/to/file"] }]\nIf no clear decisions or blockers were made, return [].\n\nTranscript:\n${transcript.slice(0, 8000)}`;
    const res = await fetchImpl(geminiGenerateUrl(env), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

// Sources carry a canonical type and a role audience (explicit input, else inferred from touched paths).
function prepareSource(record, explicitAudience) {
  const metadata = record.metadata && typeof record.metadata === 'object' ? { ...record.metadata } : {};
  const raw = explicitAudience ?? metadata.audience;
  if (raw !== undefined && raw !== null) {
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.length || list.some(item => item !== 'all' && !FUNCTION_ROLES.includes(item))) throw new HttpError(400, `audience must be "all" or any of ${FUNCTION_ROLES.join(', ')}`);
    metadata.audience = cleanAudience(list);
  } else metadata.audience = audienceFromPaths(filesOf({ metadata }));
  return { ...record, type: requireSourceType(record.type), metadata };
}

function hasVerifiedGithub(user) {
  return (user.identities ?? []).some(identity => identity.provider === 'github' && identity.identity_data?.user_name);
}

function sourceVisible(source, actor) {
  return actor.role === 'admin' || source.visibility !== 'admin' && (source.visibility !== 'private' || source.author_id === actor.id);
}

const sourceAllowed = (source, actor) => sourceVisible(source, actor) && (actor.role === 'admin' || canSee(audienceOf(source), actor.function_role));

// GitHub's redirect cannot carry a bearer token; the one-use OAuth state identifies the user instead.
const PUBLIC_PATHS = new Set(['/api/health', '/api/github/callback', '/api/demo']);

function githubCallbackReason(error) {
  const message = String(error?.message ?? '');
  if (/state is invalid|code and state/i.test(message)) return 'expired';
  if (/already linked|different GitHub/i.test(message)) return 'already_linked';
  if (/membership is required/i.test(message)) return 'not_member';
  if (/^Missing |TOKEN_ENCRYPTION_KEY|PUBLIC_APP_URL/.test(message)) return 'not_configured';
  if (/OAuth exchange failed/i.test(message)) return 'exchange_failed';
  return 'failed';
}

// Turns expected GitHub integration failures into readable client errors instead of a bare 500.
async function githubCall(run) {
  try { return await run(); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    const message = String(error?.message ?? '');
    if (/^Link a GitHub account/.test(message)) throw new HttpError(409, message);
    if (/GitHub API .* failed \(401\)/.test(message)) throw new HttpError(409, 'Your GitHub link has expired. Connect GitHub again.');
    if (/^Missing |TOKEN_ENCRYPTION_KEY|PUBLIC_APP_URL/.test(message)) throw new HttpError(503, 'GitHub integration is not fully configured on the server');
    if (/not accessible|not found or|owner\/name format|are required/.test(message)) throw new HttpError(400, message);
    if (/^GitHub App is not installed|^GitHub could not find/.test(message)) throw new HttpError(409, message);
    if (/^GitHub rate limit/.test(message)) throw new HttpError(429, message);
    // Admin-only routes: show the real cause instead of a bare "Internal server error". Secrets never appear in these messages.
    if (/^GitHub API |^GitHub App credentials|^Could not save any synced records|^Supabase /.test(message)) {
      console.error('[github]', message);
      throw new HttpError(502, message.replace(/^Supabase (\w+) (\w+) failed: /, 'Database rejected the $1 on $2: ').slice(0, 500));
    }
    throw error;
  }
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
    const supabaseUrl = configuration.SUPABASE_URL || configuration.NEXT_PUBLIC_SUPABASE_URL || configuration.VITE_SUPABASE_URL;
    const serviceRoleKey = configuration.SUPABASE_SERVICE_ROLE_KEY || configuration.SUPABASE_KEY;
    if (!supabaseUrl || !serviceRoleKey) throw new HttpError(503, 'Authentication service is not configured (SUPABASE_SERVICE_ROLE_KEY missing)');
    serviceClientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(
      supabaseUrl,
      serviceRoleKey,
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
      await store.insert('members', { org_id: organization.id, user_id: 'demo-member', role: 'team', email: 'member@example.invalid' });
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
    if (!match) throw new HttpError(401, 'Sign in to Baton first: open /dashboard. API addresses only answer requests sent by the app with your session.');
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
    return { id: auth.user.id, role: membership.role, org_id: orgId, verifiedGithub: auth.verifiedGithub, function_role: membership.function_role ?? null };
  }

  // Explicit deletes (never DB cascades); removeWhere is used when the store offers it.
  const purge = async (name, filters) => {
    if (typeof store.removeWhere === 'function') return store.removeWhere(name, filters);
    const rows = await store.list(name, filters);
    for (const row of rows) await store.remove(name, row.id);
    return rows.length;
  };
  const purgeOptional = async (name, filters) => {
    try { return await purge(name, filters); }
    catch (error) {
      if (/does not exist|schema cache|could not find/i.test(String(error?.message))) return 0;
      throw error;
    }
  };
  const purgeHandovers = async orgId => {
    const rows = await store.list('handovers', { org_id: orgId });
    for (const row of rows) {
      for (const name of ['handover_claims', 'handover_questions', 'handover_versions', 'handover_events']) await purgeOptional(name, { handover_id: row.id });
      await store.remove('handovers', row.id);
    }
    return rows.length;
  };
  const purgeTasks = async orgId => {
    const rows = await store.list('tasks', { org_id: orgId });
    await purgeOptional('task_comments', { org_id: orgId });
    for (const row of rows) { await purgeOptional('task_comments', { task_id: row.id }); await store.remove('tasks', row.id); }
    return rows.length;
  };
  const purgeSources = async orgId => {
    const removed = await purge('sources', { org_id: orgId });
    for (const name of ['agent_messages', 'file_summaries']) await purgeOptional(name, { org_id: orgId });
    return removed;
  };
  const confirmedOrg = async (actor, body) => {
    const organization = await store.get('organizations', actor.org_id);
    if (!organization) throw new HttpError(404, 'Organization not found');
    if (typeof body.confirm !== 'string' || body.confirm.trim() !== organization.name) throw new HttpError(400, 'confirm must exactly match the organization name');
    return organization;
  };

  const routes = async (req, res, url, auth, body) => {
    const method = req.method ?? 'GET';
    let match;

    if (method === 'POST' && url.pathname === '/api/demo') return json(res, 200, await handleDemoRequest(body, { createApp }));

    if (method === 'GET' && url.pathname === '/api/health') {
      const slug = String(configuration.GITHUB_APP_SLUG ?? '').trim();
      const githubConfigured = Boolean(configuration.GITHUB_APP_ID && (configuration.GITHUB_APP_PRIVATE_KEY || configuration.GITHUB_PRIVATE_KEY));
      let githubInstallUrl = /^[a-z0-9-]+$/i.test(slug) ? `https://github.com/apps/${slug}/installations/new` : null;
      if (!githubInstallUrl && githubConfigured && configuration.BATON_DEMO_MODE !== 'true') {
        try { githubInstallUrl = await (github ?? await maybeIntegration('github', store, configuration, fetchImpl)).installUrl?.() ?? null; } catch {}
      }
      return json(res, 200, { ok: true, configured: { supabase: Boolean(configuration.SUPABASE_URL && configuration.SUPABASE_SERVICE_ROLE_KEY), github: githubConfigured, demo: configuration.BATON_DEMO_MODE === 'true' }, githubInstallUrl });
    }
    if (method === 'GET' && url.pathname === '/api/me') {
      const memberships = auth.memberships.filter(item => !item.disabled_at);
      const organizations = [];
      for (const member of memberships) {
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
    if ((match = /^\/api\/orgs\/([^/]+)$/.exec(url.pathname)) && method === 'PATCH') {
      const actor = await requireOrg(auth, match[1], true);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 80) throw new HttpError(400, 'Organization name must be 1–80 characters');
      const organization = await store.update('organizations', actor.org_id, { name });
      if (!organization) throw new HttpError(404, 'Organization not found');
      return json(res, 200, { organization });
    }
    if ((match = /^\/api\/orgs\/([^/]+)$/.exec(url.pathname)) && method === 'DELETE') {
      const actor = await requireOrg(auth, match[1], true);
      // Some hosts drop DELETE request bodies, so the confirmation is also accepted as a query parameter.
      await confirmedOrg(actor, { confirm: body.confirm ?? url.searchParams.get('confirm') });
      const repositories = await store.list('repositories', { org_id: actor.org_id });
      await purgeHandovers(actor.org_id);
      await purgeTasks(actor.org_id);
      await purgeSources(actor.org_id);
      for (const repository of repositories) await purgeOptional('github_deliveries', { repository_id: repository.id });
      for (const name of ['invites', 'tokens', 'github_states', 'github_link_states', 'github_accounts', 'github_installations', 'decisions', 'blockers']) await purgeOptional(name, { org_id: actor.org_id });
      await purge('repositories', { org_id: actor.org_id });
      // The organization goes before its memberships: the database refuses to remove the last admin of a live organization.
      await store.remove('organizations', actor.org_id);
      await purge('members', { org_id: actor.org_id });
      return json(res, 200, { deleted: true });
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/reset$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      if (!['sources', 'all'].includes(body.scope)) throw new HttpError(400, 'scope must be "sources" or "all"');
      await confirmedOrg(actor, body);
      const removed = { sources: 0, tasks: 0, handovers: 0 };
      if (body.scope === 'all') { removed.handovers = await purgeHandovers(actor.org_id); removed.tasks = await purgeTasks(actor.org_id); }
      removed.sources = await purgeSources(actor.org_id);
      return json(res, 200, { removed });
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/repositories\/([^/]+)$/.exec(url.pathname)) && method === 'DELETE') {
      const actor = await requireOrg(auth, match[1], true);
      const repository = await store.get('repositories', match[2]);
      if (!repository || repository.org_id !== actor.org_id) throw new HttpError(404, 'Repository not found');
      const removedSources = await purge('sources', { org_id: actor.org_id, repository_id: repository.id });
      for (const name of ['file_summaries', 'github_deliveries']) await purgeOptional(name, { repository_id: repository.id });
      await store.remove('repositories', repository.id);
      return json(res, 200, { deleted: true, removed_sources: removedSources });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/state$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1]);
      const [organization, members, repositories, allSources, tasks, handoverRows, tokenRows] = await Promise.all([
        store.get('organizations', actor.org_id), store.list('members', { org_id: actor.org_id }), store.list('repositories', { org_id: actor.org_id }),
        store.list('sources', { org_id: actor.org_id }), store.list('tasks', { org_id: actor.org_id }),
        store.list('handovers', { org_id: actor.org_id }), store.list('tokens', { org_id: actor.org_id }),
      ]);
      const sources = allSources.filter(source => sourceVisible(source, actor) && (actor.role === 'admin' || canSee(audienceOf(source), actor.function_role)));
      const visibleHandovers = handoverRows.filter(row => actor.role === 'admin' || row.leaver_id === actor.id || (row.incoming_id === actor.id && row.status === 'approved'));
      const tokens = tokenRows.map(({ token_hash, ...token }) => token);
      return json(res, 200, { organization, members, repositories, sources, tasks, handovers: visibleHandovers, tokens });
    }

    if ((match = /^\/api\/orgs\/([^/]+)\/invites$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const role = body.role ?? 'member';
      if (!['member', 'team'].includes(role)) throw new HttpError(400, 'Invite role must be member or team');
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
      if (body.function_role !== undefined) {
        if (body.function_role !== null && !FUNCTION_ROLES.includes(body.function_role)) throw new HttpError(400, `function_role must be null or one of ${FUNCTION_ROLES.join(', ')}`);
        patch.function_role = body.function_role;
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
      if (patch.function_role !== undefined && (updated?.function_role ?? null) !== patch.function_role) throw new HttpError(503, 'Function roles need the round 3 database migration (supabase/migrations/20261114_round3.sql)');
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
      const memoryRecord = prepareSource({ org_id: actor.org_id, author_id: actor.id, author: auth.user.email ?? actor.id, type: body.type.trim().slice(0, 80), content: (await redact(body.content)).slice(0, 100000), metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? await redact(body.metadata) : {}, repository_id: body.repository_id ?? null, session_id: body.session_id ?? null, event_id: body.event_id ?? null, visibility: body.visibility ?? 'team' }, body.audience);
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
      if (patch.type !== undefined) patch.type = requireSourceType(patch.type);
      if (body.audience !== undefined) patch.metadata = prepareSource({ type: 'memory', metadata: { ...memory.metadata, ...(patch.metadata ?? {}) } }, body.audience).metadata;
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
      const record = prepareSource({ org_id: orgId, author_id: actor.id, author: auth.user.email ?? actor.id, type, content: content.slice(0, 100000), metadata: event.metadata && typeof event.metadata === 'object' ? await redact(event.metadata) : {}, repository_id: event.repository_id ?? null, session_id: event.session_id ?? null, event_id: event.event_id ?? null, visibility: event.visibility === 'admin' && actor.role === 'admin' ? 'admin' : 'team' }, event.audience);
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
    if (method === 'POST' && url.pathname === '/api/collector/messages') {
      const orgId = auth.tokenOrg ?? body.org_id;
      if (!orgId) throw new HttpError(400, 'org_id is required');
      const actor = await requireOrg(auth, orgId);
      const messages = Array.isArray(body.messages) ? body.messages : [body];
      if (!messages.length) throw new HttpError(400, 'No messages provided');
      const repositoryId = body.repository_id ?? null;

      let insertedCount = 0;
      const processedMessages = [];
      for (const msg of messages) {
        const tool = String(msg.tool ?? 'claude-code').slice(0, 40);
        const sessionId = String(msg.sessionId ?? msg.session_id ?? 'default').slice(0, 100);
        const index = Number(msg.index ?? msg.message_index ?? 0);
        const role = String(msg.role ?? 'user').slice(0, 20);
        const rawContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
        const content = await redact(rawContent);
        if (!content) continue;

        const existing = (await store.list('agent_messages', {
          org_id: orgId, author_id: actor.id, tool, session_id: sessionId, message_index: index
        }))[0];
        if (existing) continue;

        const record = {
          org_id: orgId,
          repository_id: repositoryId,
          author_id: actor.id,
          tool,
          session_id: sessionId,
          message_index: index,
          role,
          content: content.slice(0, 50000),
          occurred_at: msg.occurred_at ?? new Date().toISOString()
        };
        await store.insert('agent_messages', record);
        processedMessages.push(record);
        insertedCount++;
      }

      const geminiKey = configuration.GEMINI_API_KEY;
      if (geminiKey && processedMessages.length > 0) {
        try {
          const extracted = await extractDecisionsFromMessages(processedMessages, geminiKey, fetchImpl, configuration);
          for (const item of extracted) {
            const memContent = item.content || item.decision || item.problem;
            if (!memContent) continue;
            const emb = await embedText(memContent, geminiKey, fetchImpl);
            await store.insert('sources', {
              org_id: orgId,
              repository_id: repositoryId,
              author_id: actor.id,
              author: auth.user?.email ?? actor.id,
              type: item.type === 'blocker' ? 'blocker' : 'decision',
              content: memContent,
              metadata: {
                reason: item.reason,
                files_affected: item.files_affected || [],
                extractor: 'llm',
                source_turns: processedMessages.map(m => m.message_index)
              },
              embedding: emb,
              visibility: 'team'
            });
          }
        } catch (err) {
          // Extraction error swallowed to not fail ingest
        }
      }

      return json(res, 200, { ok: true, inserted: insertedCount });
    }

    if (method === 'POST' && url.pathname === '/api/collector/commit') {
      const orgId = auth.tokenOrg ?? body.org_id;
      if (!orgId) throw new HttpError(400, 'org_id is required');
      const actor = await requireOrg(auth, orgId);
      const sha = String(body.sha ?? '').slice(0, 64);
      if (!sha) throw new HttpError(400, 'sha is required');
      const repositoryId = body.repository_id ?? null;
      const rawMsg = String(body.message ?? 'Git Commit');
      const msg = await redact(rawMsg);
      const diffSummary = body.diff_summary ? await redact(String(body.diff_summary).slice(0, 10000)) : null;
      const files = Array.isArray(body.files) ? body.files.slice(0, 100) : [];
      const authorName = String(body.author ?? auth.user?.email ?? actor.id);

      const geminiKey = configuration.GEMINI_API_KEY;
      const emb = geminiKey ? await embedText(`${msg}\nFiles: ${files.join(', ')}`, geminiKey, fetchImpl) : null;

      const record = {
        org_id: orgId,
        repository_id: repositoryId,
        author_id: actor.id,
        author: authorName,
        type: 'commit',
        content: `[${sha.slice(0, 8)}] ${msg}`,
        metadata: {
          sha,
          files,
          diff_summary: diffSummary,
          author: authorName
        },
        embedding: emb,
        visibility: 'team'
      };
      const existing = (await store.list('sources', { org_id: orgId, type: 'commit' }))
        .find(s => s.metadata?.sha === sha);
      if (existing) return json(res, 200, { ok: true, source: existing, deduplicated: true });
      const created = await store.insert('sources', record);
      return json(res, 201, { ok: true, source: created });
    }

    if (method === 'POST' && url.pathname === '/api/collector/files') {
      const orgId = auth.tokenOrg ?? body.org_id;
      if (!orgId) throw new HttpError(400, 'org_id is required');
      const actor = await requireOrg(auth, orgId);
      const filePath = String(body.path ?? '').trim();
      if (!filePath) throw new HttpError(400, 'path is required');
      const contentHash = String(body.content_hash ?? body.hash ?? '');
      const repositoryId = body.repository_id ?? null;
      const chunks = Array.isArray(body.chunks) ? body.chunks.join('\n') : String(body.content ?? '');
      const redactedChunks = await redact(chunks.slice(0, 15000));

      let summary = body.summary ? await redact(String(body.summary)) : null;
      const geminiKey = configuration.GEMINI_API_KEY;
      if (!summary && geminiKey && redactedChunks) {
        try {
          const sumPrompt = `Provide a 2-3 sentence technical summary of this code file (${filePath}). Describe its core responsibility, exported interfaces, and dependencies.\n\nCode:\n${redactedChunks.slice(0, 4000)}`;
          const sRes = await fetchImpl(geminiGenerateUrl(configuration), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sumPrompt }] }] })
          });
          const sData = await sRes.json();
          summary = sData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        } catch {}
      }
      if (!summary) summary = `File ${filePath} (${contentHash.slice(0, 8)})`;

      const emb = geminiKey ? await embedText(`${filePath}: ${summary}`, geminiKey, fetchImpl) : null;

      const existing = (await store.list('file_summaries', { org_id: orgId, path: filePath }))
        .find(f => !repositoryId || f.repository_id === repositoryId);

      let record;
      if (existing) {
        record = await store.update('file_summaries', existing.id, {
          content_hash: contentHash,
          summary,
          embedding: emb,
          commit_sha: body.commit_sha || null,
          updated_at: new Date().toISOString()
        });
      } else {
        record = await store.insert('file_summaries', {
          org_id: orgId,
          repository_id: repositoryId,
          path: filePath,
          content_hash: contentHash,
          summary,
          embedding: emb,
          commit_sha: body.commit_sha || null
        });
      }
      return json(res, 200, { ok: true, file: record });
    }

    if (method === 'GET' && url.pathname === '/api/collector/cursor') {
      const orgId = auth.tokenOrg ?? url.searchParams.get('org_id');
      if (!orgId) throw new HttpError(400, 'org_id is required');
      const actor = await requireOrg(auth, orgId);
      const tool = url.searchParams.get('tool');
      const sessionId = url.searchParams.get('session');
      const filter = { org_id: orgId };
      if (tool) filter.tool = tool;
      if (sessionId) filter.session_id = sessionId;
      const rows = await store.list('agent_messages', filter);
      let maxCursor = -1;
      for (const r of rows) {
        if (typeof r.message_index === 'number' && r.message_index > maxCursor) {
          maxCursor = r.message_index;
        }
      }
      return json(res, 200, { cursor: maxCursor });
    }

    if (method === 'GET' && url.pathname === '/api/collector/search') {
      const rawQuery = (url.searchParams.get('q') ?? '').trim();
      const orgId = auth.tokenOrg ?? url.searchParams.get('org_id');
      if (!orgId) throw new HttpError(400, 'org_id is required');
      const actor = await requireOrg(auth, orgId);
      const repositoryId = url.searchParams.get('repository_id');
      const query = rawQuery.toLocaleLowerCase();

      let results = [];
      let searchMode = 'text';

      const geminiKey = configuration.GEMINI_API_KEY;
      if (geminiKey && rawQuery && typeof store.rpc === 'function') {
        try {
          const qEmbedding = await embedText(rawQuery, geminiKey, fetchImpl);
          if (qEmbedding) {
            const vectorMatches = await store.rpc('match_memory', {
              query_embedding: qEmbedding,
              p_org: orgId,
              p_repo: repositoryId || null,
              match_count: 40
            });
            // match_memory ignores per-source visibility, so every hit is re-checked against the caller.
            const allowed = [];
            for (const m of Array.isArray(vectorMatches) ? vectorMatches : []) {
              if (m.kind === 'file') {
                if (actor.role === 'admin' || canSee(audienceFromPaths([m.path]), actor.function_role)) allowed.push(m);
              } else {
                const source = await store.get('sources', m.id);
                if (source && source.org_id === orgId && sourceAllowed(source, actor)) allowed.push(m);
              }
            }
            if (allowed.length > 0) {
              searchMode = 'vector';
              results = allowed.slice(0, 10).map(m => ({
                id: m.id,
                type: m.kind === 'file' ? 'file_summary' : 'memory',
                content: m.content,
                path: m.path,
                similarity: m.similarity,
                created_at: new Date().toISOString()
              }));
            }
          }
        } catch (err) {
          // Fallback to text matching
        }
      }

      if (!results.length) {
        const sources = await store.list('sources', { org_id: orgId });
        results = sources.filter(source => sourceAllowed(source, actor)
          && (!repositoryId || source.repository_id === repositoryId)
          && (!query || source.content.toLocaleLowerCase().includes(query)))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 25).map(({ embedding, ...source }) => source);
      }

      return json(res, 200, { data: results, mode: searchMode });
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
    if ((match = /^\/api\/handovers\/([^/]+)\/export\.md$/.exec(url.pathname)) && method === 'GET') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      let actor = await requireOrg(auth, handover.org_id);
      if (auth.apiToken) {
        // MCP exports land in a repository file, so tokens get the participant view without admin-only evidence.
        if (![handover.leaver_id, handover.incoming_id].includes(actor.id)) throw new HttpError(403, 'Only the outgoing or incoming member can export this handover with an API token');
        if (actor.role === 'admin') actor = { ...actor, role: 'member' };
      }
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      const detail = await module.get({ handoverId: handover.id, actor });
      if (detail.handover?.status !== 'approved') throw new HttpError(409, 'Only approved handovers can be exported');
      const [organization, members] = await Promise.all([store.get('organizations', handover.org_id), store.list('members', { org_id: handover.org_id })]);
      const markdown = handoverMarkdown({ detail, organization, members });
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'content-length': Buffer.byteLength(markdown), 'content-disposition': `attachment; filename="handover-${String(handover.id).replace(/[^A-Za-z0-9-]/g, '').slice(0, 8)}.md"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return res.end(markdown);
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
    if ((match = /^\/api\/handovers\/([^/]+)\/questions\/([^/]+)\/skip$/.exec(url.pathname)) && method === 'POST') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      const actor = await requireOrg(auth, handover.org_id);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 200, await module.skip({ handoverId: handover.id, actor, questionId: match[2] }));
    }
    if ((match = /^\/api\/handovers\/([^/]+)\/conflicts\/([^/]+)\/resolve$/.exec(url.pathname)) && method === 'POST') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      const actor = await requireOrg(auth, handover.org_id, true);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      return json(res, 200, await module.resolveConflict({ handoverId: handover.id, actor, claimId: match[2], resolution: body.resolution, chosenSourceId: body.chosen_source_id }));
    }
    if ((match = /^\/api\/handovers\/([^/]+)\/versions(\/diff)?$/.exec(url.pathname)) && method === 'GET') {
      const handover = await store.get('handovers', match[1]);
      if (!handover) throw new HttpError(404, 'Handover not found');
      const actor = await requireOrg(auth, handover.org_id);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
      if (!match[2]) return json(res, 200, await module.versions({ handoverId: handover.id, actor }));
      return json(res, 200, await module.diff({ handoverId: handover.id, actor, from: url.searchParams.get('from'), to: url.searchParams.get('to') }));
    }
    if ((match = /^\/api\/mcp\/interviews(?:\/([^/]+)\/answers)?$/.exec(url.pathname)) && (method === 'GET' || method === 'POST')) {
      if (method === 'GET') {
        const orgId = auth.tokenOrg ?? url.searchParams.get('org_id');
        if (!orgId) throw new HttpError(400, 'org_id is required');
        const actor = await requireOrg(auth, orgId);
      const module = handovers ?? await maybeIntegration('handover', store, configuration, fetchImpl);
        const rows = await store.list('handovers', { org_id: orgId });
        const interviews = [];
        for (const handover of rows.filter(row => row.incoming_id === actor.id || row.leaver_id === actor.id)) {
          // An incoming member's draft handover is not readable yet; it must not hide the others.
          try { interviews.push(await module.get({ handoverId: handover.id, actor })); }
          catch (error) { if (error?.status !== 403) throw error; }
        }
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
      return json(res, 200, await githubCall(() => module.startLink({ userId: actor.id, orgId: actor.org_id })));
    }
    if (method === 'GET' && url.pathname === '/api/github/callback') {
      // Always send the browser back to the app; a relative target cannot be turned into an open redirect.
      let target = '/dashboard?github=linked';
      try {
        const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
        const linked = await module.finishLink({ code: url.searchParams.get('code'), state: url.searchParams.get('state') });
        // A first-time user has nothing to pick from yet: send them straight to GitHub's install page.
        if (linked?.userId && typeof module.installUrl === 'function') {
          const installs = await module.installations({ userId: linked.userId, orgId: linked.orgId }).catch(() => null);
          const install = installs && installs.length === 0 ? await module.installUrl().catch(() => null) : null;
          if (install && /^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new$/i.test(install)) target = install;
        }
      } catch (error) {
        console.error('[github callback]', error?.message ?? error);
        target = `/dashboard?github=error&reason=${githubCallbackReason(error)}`;
      }
      res.writeHead(302, { location: target, 'cache-control': 'no-store' });
      return res.end();
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/github\/installations\/([^/]+)\/repositories$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 200, await githubCall(() => module.repositories({ userId: actor.id, orgId: actor.org_id, installationId: match[2] })));
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/github\/installations$/.exec(url.pathname)) && method === 'GET') {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 200, await githubCall(() => module.installations({ userId: actor.id, orgId: actor.org_id })));
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/github\/account$/.exec(url.pathname)) && (method === 'GET' || method === 'DELETE')) {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      if (method === 'DELETE') return json(res, 200, await githubCall(() => module.unlink({ userId: actor.id, orgId: actor.org_id })));
      return json(res, 200, { account: await githubCall(() => module.linkedAccount({ userId: actor.id, orgId: actor.org_id })) });
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/repositories$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 201, await githubCall(() => module.connect({ userId: actor.id, orgId: actor.org_id, installationId: body.installationId ?? body.installation_id, fullName: body.fullName ?? body.full_name })));
    }
    if ((match = /^\/api\/orgs\/([^/]+)\/repositories\/([^/]+)\/sync$/.exec(url.pathname)) && method === 'POST') {
      const actor = await requireOrg(auth, match[1], true);
      const repository = await store.get('repositories', match[2]);
      if (!repository || repository.org_id !== actor.org_id) throw new HttpError(404, 'Repository not found');
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      return json(res, 200, await githubCall(() => module.sync({ repository, actorId: actor.id })));
    }
    if (method === 'POST' && url.pathname === '/api/github/webhook') {
      const module = github ?? await maybeIntegration('github', store, configuration, fetchImpl);
      try { return json(res, 200, await module.webhook({ rawBody: req.rawBody ?? Buffer.alloc(0), headers: req.headers })); }
      catch (error) {
        if (/^Missing GITHUB_WEBHOOK_SECRET/.test(error.message)) throw new HttpError(503, 'GitHub webhook is not configured on the server');
        if (/signature|delivery|event headers|webhook JSON/i.test(error.message)) throw new HttpError(401, 'Invalid GitHub webhook signature or payload');
        throw error;
      }
    }
    throw new HttpError(404, 'Not found');
  };

  return async (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigins = String(configuration.BATON_ALLOWED_ORIGINS ?? '').split(',').map(item => item.trim()).filter(Boolean);
    const allowOrigin = !allowedOrigins.length || allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin));
    if (origin && allowOrigin) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'authorization,content-type,x-baton-demo-user');
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.writeHead(origin && !allowOrigin ? 403 : 204).end();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      // Someone opened an API address in the browser tab: show the app instead of a raw JSON error.
      if (req.method === 'GET' && !req.headers.authorization && /text\/html/.test(String(req.headers.accept ?? ''))
        && !PUBLIC_PATHS.has(url.pathname) && configuration.BATON_DEMO_MODE !== 'true') {
        res.writeHead(302, { location: '/dashboard', 'cache-control': 'no-store' });
        return res.end();
      }
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
      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      const auth = PUBLIC_PATHS.has(url.pathname) ? { user: { id: 'public' }, memberships: [], demo: configuration.BATON_DEMO_MODE === 'true' } : await authenticate(req);
      if (auth.apiToken && !['/api/collector/push', '/api/collector/search', '/api/collector/messages', '/api/collector/commit', '/api/collector/files', '/api/collector/cursor', '/api/mcp/interviews'].includes(url.pathname)
        && !/^\/api\/mcp\/interviews\/[^/]+\/answers$/.test(url.pathname)
        && !(req.method === 'GET' && /^\/api\/handovers\/[^/]+\/export\.md$/.test(url.pathname))) throw new HttpError(403, 'API tokens are limited to collector, MCP interview and handover export access');
      return await routes(req, res, url, auth, body);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error instanceof HttpError ? error.status
        : Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      if (status === 500) console.error('[api]', req.method, req.url?.split('?')[0], error?.message ?? error);
      return json(res, status, { error: status === 500 ? 'Internal server error' : error.message });
    }
  };
}