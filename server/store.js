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
    async remove(name, id) {
      const records = table(name);
      const index = records.findIndex(record => record.id === id);
      if (index < 0) return null;
      return clone(records.splice(index, 1)[0]);
    },
  };
}

export function createSupabaseStore(client, env = process.env) {
  let clientPromise;
  if (!client) {
    clientPromise = (async () => {
      const url = env.SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
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

  return {
    async list(name, filters = {}) {
      const db = await clientPromise;
      let query = db.from(tableName(name)).select('*');
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      return (await run(`list ${name}`, query)).map(record => name === 'tokens' ? ({
        ...record,
        token_hash: record.token_hash,
      }) : record);
    },
    async get(name, id) {
      const db = await clientPromise;
      return await run(`get ${name}`, db.from(tableName(name)).select('*').eq('id', id).maybeSingle());
    },
    async insert(name, record) {
      const db = await clientPromise;
      return await run(`insert ${name}`, db.from(tableName(name)).insert(record).select('*').single());
    },
    async update(name, id, patch) {
      const db = await clientPromise;
      return await run(`update ${name}`, db.from(tableName(name)).update(patch).eq('id', id).select('*').maybeSingle());
    },
    async remove(name, id) {
      const db = await clientPromise;
      return await run(`remove ${name}`, db.from(tableName(name)).delete().eq('id', id).select('*').maybeSingle());
    },
  };
}
