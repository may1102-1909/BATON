import { randomUUID } from 'node:crypto';

const TABLES = {
  members: 'org_memberships',
  tokens: 'api_tokens',
  invites: 'organization_invites',
};

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function matches(record, filters) {
  return Object.entries(filters).every(([key, value]) => record[key] === value);
}

export function createMemoryStore(seed = {}) {
  const tables = new Map(Object.entries(seed).map(([name, records]) => [name, clone(records)]));
  const table = name => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };

  return {
    async list(name, filters = {}) {
      return clone(table(name).filter(record => matches(record, filters)));
    },
    async get(name, id) {
      return clone(table(name).find(record => record.id === id) ?? null);
    },
    async insert(name, record) {
      const value = { id: randomUUID(), created_at: new Date().toISOString(), ...clone(record) };
      table(name).push(value);
      return clone(value);
    },
    async update(name, id, patch) {
      const records = table(name);
      const index = records.findIndex(record => record.id === id);
      if (index < 0) return null;
      records[index] = { ...records[index], ...clone(patch), id };
      return clone(records[index]);
    },
    async claimInvite(id, acceptedBy, acceptedAt = new Date().toISOString()) {
      const invite = table('invites').find(record => record.id === id);
      if (!invite || invite.accepted_at || Date.parse(invite.expires_at) <= Date.now()) return null;
      invite.accepted_at = acceptedAt;
      invite.accepted_by = acceptedBy;
      return clone(invite);
    },
    async remove(name, id) {
      const records = table(name);
      const index = records.findIndex(record => record.id === id);
      if (index < 0) return null;
      return clone(records.splice(index, 1)[0]);
    },
    async rpc() {
      return null;
    },
  };
}

export function createSupabaseStore(client, env = process.env) {
  let clientPromise;
  if (!client) {
    clientPromise = (async () => {
      const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
      if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    })();
  } else {
    clientPromise = Promise.resolve(client);
  }

  const tableName = name => TABLES[name] ?? name;
  const run = async (name, query) => {
    const { data, error } = await query;
    if (error) throw new Error(`Supabase ${name} failed: ${error.message}`);
    return data;
  };

  const normalizeForDb = (name, record) => {
    if (!record || typeof record !== 'object') return record;
    if (name === 'sources') {
      const payload = { ...record };
      if (payload.visibility === 'team') payload.visibility = 'all';
      if (payload.type === 'decision') payload.type = 'mcp_decision';
      else if (payload.type === 'blocker') payload.type = 'mcp_blocker';
      else if (payload.type && !['commit', 'pr', 'issue', 'mcp_decision', 'mcp_blocker'].includes(payload.type)) {
        payload.type = 'mcp_decision';
      }
      return payload;
    }
    return record;
  };

  return {
    async list(name, filters = {}) {
      const db = await clientPromise;
      let query = db.from(tableName(name)).select('*');
      for (const [key, value] of Object.entries(filters)) {
        let val = value;
        if (name === 'sources' && key === 'type') {
          if (val === 'decision') val = 'mcp_decision';
          else if (val === 'blocker') val = 'mcp_blocker';
        }
        query = query.eq(key, val);
      }
      return (await run(`list ${name}`, query)).map(record => {
        if (name === 'tokens') {
          return { ...record, token_hash: record.token_hash };
        }
        if (name === 'sources' && record) {
          if (record.type === 'mcp_decision') return { ...record, type: 'decision' };
          if (record.type === 'mcp_blocker') return { ...record, type: 'blocker' };
        }
        return record;
      });
    },
    async get(name, id) {
      const db = await clientPromise;
      const record = await run(`get ${name}`, db.from(tableName(name)).select('*').eq('id', id).maybeSingle());
      if (name === 'sources' && record) {
        if (record.type === 'mcp_decision') return { ...record, type: 'decision' };
        if (record.type === 'mcp_blocker') return { ...record, type: 'blocker' };
      }
      return record;
    },
    async insert(name, record) {
      const db = await clientPromise;
      return await run(`insert ${name}`, db.from(tableName(name)).insert(normalizeForDb(name, record)).select('*').single());
    },
    async update(name, id, patch) {
      const db = await clientPromise;
      return await run(`update ${name}`, db.from(tableName(name)).update(normalizeForDb(name, patch)).eq('id', id).select('*').maybeSingle());
    },
    async claimInvite(id, acceptedBy, acceptedAt = new Date().toISOString()) {
      const db = await clientPromise;
      const result = await run('claim invite', db.from(tableName('invites')).update({ accepted_at: acceptedAt, accepted_by: acceptedBy })
        .eq('id', id).is('accepted_at', null).gt('expires_at', acceptedAt).select('*').maybeSingle());
      return result;
    },
    async remove(name, id) {
      const db = await clientPromise;
      return await run(`remove ${name}`, db.from(tableName(name)).delete().eq('id', id).select('*').maybeSingle());
    },
    async rpc(fnName, params = {}) {
      const db = await clientPromise;
      const { data, error } = await db.rpc(fnName, params);
      if (error) throw new Error(`Supabase rpc ${fnName} failed: ${error.message}`);
      return data;
    },
  };
}