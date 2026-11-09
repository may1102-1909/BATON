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

test('handover domain persists its actual records in PostgreSQL',async()=>{
  const {createHandovers}=await import('../server/handover.js');
  const db=new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;`);
    const sql=(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace(/create extension if not exists pgcrypto;/i,'');
    await db.exec(sql);
    const clean = rows=>JSON.parse(JSON.stringify(rows));
    const ident = value=>{assert.match(value,/^[a-z_]+$/);return `"${value}"`;};
    const store={
      async list(table,filters={}){const entries=Object.entries(filters);return clean((await db.query(`SELECT * FROM ${ident(table)}${entries.length?' WHERE '+entries.map(([key],i)=>`${ident(key)}=$${i+1}`).join(' AND '):''}`,entries.map(([,value])=>value))).rows);},
      async get(table,id){return (await this.list(table,{id}))[0]||null;},
      async insert(table,data){const keys=Object.keys(data);return clean((await db.query(`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(data))).rows)[0];},
      async update(table,id,data){const keys=Object.keys(data);return clean((await db.query(`UPDATE ${ident(table)} SET ${keys.map((key,i)=>`${ident(key)}=$${i+1}`).join(',')} WHERE id=$${keys.length+1} RETURNING *`,[...Object.values(data),id])).rows)[0];},
      async remove(table,id){await db.query(`DELETE FROM ${ident(table)} WHERE id=$1`,[id]);},
    };
    const admin='10000000-0000-4000-8000-000000000001',leaver='10000000-0000-4000-8000-000000000002',incoming='10000000-0000-4000-8000-000000000003';
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${admin}'),('${leaver}'),('${incoming}')`);
    const org=await store.insert('organizations',{name:'SQL workflow',created_by:admin});
    for(const user of [admin,leaver,incoming])await store.insert('org_memberships',{org_id:org.id,user_id:user,role:user===admin?'admin':'member'});
    await store.insert('sources',{org_id:org.id,author_id:leaver,type:'blocker',content:'Replay protection needs verification',metadata:{status:'active'},visibility:'team'});
    const domain=createHandovers({store,env:{}}),actor={id:admin,org_id:org.id,role:'admin'};
    const started=await domain.start({orgId:org.id,actor,leaverId:leaver,incomingId:incoming});
    const handoverId=started.handover.id;
    for(const q of started.questions)await domain.answer({handoverId,actor:{id:leaver,org_id:org.id,role:'member'},questionId:q.id,answer:'Keep retries behind the feature flag until replay protection is verified.'});
    const generated=await domain.generate({handoverId,actor});
    assert.ok(generated.claims.length);
    for(const c of generated.claims)await domain.reviewClaim({handoverId,actor,claimId:c.id,status:'approved'});
    await domain.approve({handoverId,actor});
    await domain.acknowledge({handoverId,actor:{id:incoming,org_id:org.id,role:'member'}});
    const detail=await domain.get({handoverId,actor});
    assert.equal(detail.handover.status,'approved');
  }finally{await db.close();}
});
