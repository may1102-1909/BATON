import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('schema applies twice and isolates direct authenticated database access',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
    // gen_random_uuid is built into PostgreSQL; hosted Supabase also provides pgcrypto.
    const sql=(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace(/create extension if not exists pgcrypto;/i,'');
    await db.exec(sql);await db.exec(sql);
    const a='10000000-0000-4000-8000-000000000001';
    const b='10000000-0000-4000-8000-000000000002';
    const oa='20000000-0000-4000-8000-000000000001';
    const ob='20000000-0000-4000-8000-000000000002';
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${a}'),('${b}');
      INSERT INTO organizations(id,name,created_by) VALUES ('${oa}','Org A','${a}'),('${ob}','Org B','${b}');
      INSERT INTO org_memberships(org_id,user_id,role) VALUES ('${oa}','${a}','member'),('${ob}','${b}','admin');
      INSERT INTO sources(org_id,author_id,content,type,visibility) VALUES ('${oa}','${a}','team A','decision','team'),('${oa}','${a}','admin A','decision','admin'),('${ob}','${b}','team B','decision','team');
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      SET ROLE authenticated; SET request.jwt.claim.sub='${a}';`);
    const rows=await db.query('SELECT content FROM sources');
    assert.deepEqual(rows.rows.map(r=>r.content),['team A']);
    const secrets=await db.query('SELECT * FROM api_tokens');assert.equal(secrets.rows.length,0);
    await assert.rejects(db.exec(`INSERT INTO sources(org_id,author_id,content,type) VALUES ('${ob}','${a}','cross org','decision')`),/row-level security/i);
  } finally {await db.close();}
});
