import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

test('an older production handovers table (leaver_name/incoming_name) is upgraded and then supports the current handover flow', async () => {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
    CREATE TABLE public.organizations(id uuid primary key default gen_random_uuid(), name text, created_by uuid, created_at timestamptz default now());
    CREATE TABLE public.handovers(id uuid primary key default gen_random_uuid(), org_id uuid, leaver_name text not null, incoming_name text not null,
      status text, created_at timestamptz default now(), generation_started_at timestamptz);
    INSERT INTO public.organizations(name) VALUES ('legacy');
    INSERT INTO public.handovers(org_id, leaver_name, incoming_name, status) SELECT id, 'Old Leaver', 'Old Incoming', 'draft' FROM public.organizations;`);
  const read = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  const schema = (await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')).replace(/create extension if not exists pgcrypto;/i, '');
  // Column migration first; then schema.sql (re-run is a no-op for existing tables) and the RLS migration.
  const cols0 = await read('20261116_handover_columns.sql'); await db.exec(cols0); await db.exec(schema);
  const cols = await read('20261116_handover_columns.sql'), rls = await read('20261116_rls_hardening.sql');
  await db.exec(cols); await db.exec(cols); await db.exec(rls); await db.exec(rls);
  const policies = (await db.query(`select policyname from pg_policies where tablename like 'handover%' order by 1`)).rows.map(r => r.policyname);
  assert.ok(['handovers_participant_read', 'handover_claims_participant_read', 'handover_versions_admin_read'].every(p => policies.includes(p)));
  const old = (await db.query(`select leaver_name, leaver_id from handovers`)).rows;
  assert.deepEqual(old, [{ leaver_name: 'Old Leaver', leaver_id: null }]);
  const { createHandovers } = await import('../server/handover.js');
  const clean = rows => JSON.parse(JSON.stringify(rows));
  const ident = v => `"${({ members: 'org_memberships', tokens: 'api_tokens' })[v] || v}"`;
  const store = {
    async list(t, f = {}) { const e = Object.entries(f); return clean((await db.query(`SELECT * FROM ${ident(t)}${e.length ? ' WHERE ' + e.map(([k], i) => `${ident(k)}=$${i + 1}`).join(' AND ') : ''}`, e.map(([, v]) => v))).rows); },
    async get(t, id) { return (await this.list(t, { id }))[0] || null; },
    async insert(t, d) { const k = Object.keys(d); return clean((await db.query(`INSERT INTO ${ident(t)} (${k.map(ident).join(',')}) VALUES (${k.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, Object.values(d).map(v => v && typeof v === 'object' ? JSON.stringify(v) : v))).rows[0]); },
    async update(t, id, d) { const k = Object.keys(d); return clean((await db.query(`UPDATE ${ident(t)} SET ${k.map((x, i) => `${ident(x)}=$${i + 1}`).join(',')} WHERE id=$${k.length + 1} RETURNING *`, [...Object.values(d).map(v => v && typeof v === 'object' ? JSON.stringify(v) : v), id])).rows[0]); },
    async remove(t, id) { await db.query(`DELETE FROM ${ident(t)} WHERE id=$1`, [id]); },
  };
  const [admin, leaver, incoming] = ['1', '2', '3'].map(n => `10000000-0000-4000-8000-00000000000${n}`);
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${admin}'),('${leaver}'),('${incoming}')`);
  const org = (await db.query('select id from organizations')).rows[0].id;
  for (const u of [admin, leaver, incoming]) await store.insert('org_memberships', { org_id: org, user_id: u, role: u === admin ? 'admin' : 'member' });
  await store.insert('sources', { org_id: org, author_id: leaver, type: 'blocker', content: 'Replay protection needs verification', metadata: { status: 'active' }, visibility: 'team' });
  const domain = createHandovers({ store, env: {} }), actor = { id: admin, org_id: org, role: 'admin' };
  const started = await domain.start({ orgId: org, actor, leaverId: leaver, incomingId: incoming });
  const generated = await domain.generate({ handoverId: started.handover.id, actor });
  assert.ok(started.handover.id && started.questions.length && generated.claims.length);
  await db.close();
});
