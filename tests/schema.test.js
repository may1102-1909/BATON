import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';

// schema.sql needs pgvector (embedding columns, hnsw indexes, match_memory).
const newDb=()=>new PGlite({extensions:{vector}});

test('schema applies twice and isolates direct authenticated database access',async()=>{
  const db=newDb();
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
  const db=newDb();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;`);
    const sql=(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace(/create extension if not exists pgcrypto;/i,'');
    await db.exec(sql);
    const clean = rows=>JSON.parse(JSON.stringify(rows));
    const ident = value=>{assert.match(value,/^[a-z_]+$/);return `"${({members:"org_memberships",tokens:"api_tokens",invites:"organization_invites"})[value] || value}"`;};
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

test('match_memory filters visibility, private authorship and function audience inside the database',async()=>{
  const db=newDb();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;`);
    const sql=(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace(/create extension if not exists pgcrypto;/i,'');
    await db.exec(sql);
    // The standalone migration must also apply cleanly on top of the schema.
    await db.exec(await readFile(new URL('../supabase/migrations/20261115_match_memory_visibility.sql',import.meta.url),'utf8'));
    const org='20000000-0000-4000-8000-000000000009',me='10000000-0000-4000-8000-000000000009',other='10000000-0000-4000-8000-000000000008';
    const vec=`('[' || array_to_string(array_fill(0.1::float, array[768]), ',') || ']')::vector`;
    await db.exec(`INSERT INTO organizations(id,name) VALUES ('${org}','Recall');
      INSERT INTO sources(org_id,author_id,content,type,visibility,metadata,embedding) VALUES
        ('${org}','${other}','team note','decision','team','{"audience":["all"]}',${vec}),
        ('${org}','${other}','admin note','decision','admin','{"audience":["all"]}',${vec}),
        ('${org}','${other}','their private note','decision','private','{"audience":["all"]}',${vec}),
        ('${org}','${me}','my private note','decision','private','{"audience":["all"]}',${vec}),
        ('${org}','${other}','infra note','decision','team','{"audience":["infra"]}',${vec}),
        ('${org}','${other}','untagged note','decision','team','{}',${vec});`);
    const recall=async(role,fn)=>(await db.query(`SELECT content FROM match_memory(${vec},'${org}',null,20,'${me}',$1,$2) ORDER BY content`,[role,fn])).rows.map(r=>r.content);
    assert.deepEqual(await recall('team','frontend'),['my private note','team note','untagged note']);
    assert.deepEqual(await recall('team','infra'),['infra note','my private note','team note','untagged note']);
    assert.deepEqual(await recall('team',null),['infra note','my private note','team note','untagged note']);
    assert.deepEqual(await recall('admin',null),['admin note','infra note','my private note','team note','their private note','untagged note']);
    assert.deepEqual(await recall(null,null),['infra note','my private note','team note','untagged note'],'no role means the restrictive member view');
  }finally{await db.close();}
});

test('direct database access to handovers, transcripts and summaries is limited to the right people', async () => {
  const db = newDb();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
    const sql = (await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')).replace(/create extension if not exists pgcrypto;/i, '');
    await db.exec(sql);
    // The migration must also apply cleanly on top of the schema, twice.
    const migration = await readFile(new URL('../supabase/migrations/20261116_rls_hardening.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const [admin, leaver, incoming, other] = ['1', '2', '3', '4'].map(n => `10000000-0000-4000-8000-00000000000${n}`);
    const org = '20000000-0000-4000-8000-000000000001', h = '30000000-0000-4000-8000-000000000001';
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${admin}'),('${leaver}'),('${incoming}'),('${other}');
      INSERT INTO organizations(id,name,created_by) VALUES ('${org}','Org','${admin}');
      INSERT INTO org_memberships(org_id,user_id,role) VALUES ('${org}','${admin}','admin'),('${org}','${leaver}','member'),('${org}','${incoming}','member'),('${org}','${other}','member');
      INSERT INTO sources(org_id,author_id,content,type,visibility) VALUES ('${org}','${admin}','team-wide','decision','all');
      INSERT INTO handovers(id,org_id,leaver_id,incoming_id,status) VALUES ('${h}','${org}','${leaver}','${incoming}','draft');
      INSERT INTO handover_claims(handover_id,org_id,section,text,visibility,status) VALUES ('${h}','${org}','risks','team claim','team','approved'),('${h}','${org}','risks','admin claim','admin','approved');
      INSERT INTO handover_versions(handover_id,org_id,version_number) VALUES ('${h}','${org}',1);
      INSERT INTO agent_messages(org_id,author_id,content) VALUES ('${org}','${leaver}','leaver transcript'),('${org}','${other}','other transcript');
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      SET ROLE authenticated;`);
    const as = async (user, query) => { await db.exec(`SET request.jwt.claim.sub='${user}'`); return (await db.query(query)).rows; };
    assert.equal((await as(other, 'SELECT id FROM handovers')).length, 0, 'unrelated member cannot see the handover');
    assert.equal((await as(incoming, 'SELECT id FROM handovers')).length, 1);
    assert.equal((await as(incoming, 'SELECT text FROM handover_claims')).length, 0, 'draft claims stay hidden from the incoming member');
    assert.equal((await as(other, 'SELECT id FROM handover_versions')).length, 0);
    assert.equal((await as(admin, 'SELECT text FROM handover_claims')).length, 2);
    await db.exec(`RESET ROLE; UPDATE handovers SET status='approved' WHERE id='${h}'; SET ROLE authenticated;`);
    assert.deepEqual((await as(incoming, 'SELECT text FROM handover_claims')).map(r => r.text), ['team claim'], 'approved: team claims only');
    assert.deepEqual((await as(leaver, 'SELECT content FROM agent_messages')).map(r => r.content), ['leaver transcript']);
    await as(leaver, 'DELETE FROM agent_messages');
    assert.equal((await as(admin, 'SELECT id FROM agent_messages')).length, 2, 'members cannot delete transcripts');
    assert.equal((await as(other, 'SELECT content FROM sources')).length, 1, "'all' visibility is accepted and readable");
  } finally { await db.close(); }
});
