import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createApp} from '../server/app.js';
import {createMemoryStore} from '../server/store.js';
import {demoSeed} from '../server/demo.js';

const requireMcp=createRequire(new URL('../mcp-server/package.json',import.meta.url));
const {Client}=await import(pathToFileURL(requireMcp.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const {StdioClientTransport}=await import(pathToFileURL(requireMcp.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href);

test('real stdio MCP tools save and retrieve memory through the actual authenticated API',async()=>{
  const store=createMemoryStore(demoSeed());
  const server=createServer(createApp({store,env:{BATON_DEMO_MODE:'true'}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let client;
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const issue=await fetch(base+'/api/orgs/demo-org/tokens',{method:'POST',headers:{'content-type':'application/json','x-baton-demo-user':'demo-member'},body:JSON.stringify({name:'integration-test'})});
    assert.equal(issue.status,201,await issue.clone().text());
    const {token}=await issue.json();
    assert.ok(token);
    client=new Client({name:'baton-integration-test',version:'1.0.0'});
    await client.connect(new StdioClientTransport({command:process.execPath,args:['mcp-server/dist/index.js'],env:{...process.env,BATON_API_URL:base,BATON_API_KEY:token,BATON_ORG_ID:'demo-org',BATON_REPOSITORY_ID:'demo-repo',BATON_SESSION_ID:'integration-session'},stderr:'pipe'}));
    const tools=await client.listTools();assert.ok(tools.tools.some(t=>t.name==='save_memory'));
    const initialCount=(await store.list('sources',{author_id:'demo-member'})).length;
    const saved=await client.callTool({name:'save_memory',arguments:{type:'change',content:'Keep retry delivery behind the replay-protection flag.'}});
    assert.ok(!saved.isError,JSON.stringify(saved));
    const rows=await store.list('sources',{author_id:'demo-member'});
    assert.equal(rows.length,initialCount+1);
    const repeated=await client.callTool({name:'save_memory',arguments:{type:'change',content:'Keep retry delivery behind the replay-protection flag.'}});
    assert.ok(!repeated.isError,JSON.stringify(repeated));
    assert.equal((await store.list('sources',{author_id:'demo-member'})).length,initialCount+1);
    const context=await client.callTool({name:'get_context',arguments:{query:'replay-protection'}});
    assert.ok(!context.isError);assert.match(JSON.stringify(context),/replay-protection/);
    const interview=await client.callTool({name:'get_exit_interview',arguments:{}});assert.ok(!interview.isError,JSON.stringify(interview));
  }finally{if(client)await client.close();await new Promise(resolve=>server.close(resolve));}
});

test('export_handover writes the approved packet into the repository as Markdown, without admin-only evidence',async()=>{
  const store=createMemoryStore(demoSeed());
  const stamp='2026-11-12T10:00:00.000Z';
  await store.insert('handovers',{id:'h-mcp-export',org_id:'demo-org',leaver_id:'demo-member',incoming_id:'demo-admin',status:'approved',generation_mode:'evidence-only',created_at:stamp,approved_at:stamp});
  await store.insert('handover_claims',{id:'cm1',handover_id:'h-mcp-export',org_id:'demo-org',section:'decisions',text:'Webhook retries stay behind the replay-protection flag.',source_ids:[],confidence:'verified',status:'approved',visibility:'team'});
  await store.insert('handover_claims',{id:'cm2',handover_id:'h-mcp-export',org_id:'demo-org',section:'risks',text:'Confidential vendor dispute.',source_ids:[],confidence:'verified',status:'approved',visibility:'admin'});
  await store.insert('handovers',{id:'h-other',org_id:'demo-org',leaver_id:'someone-else',incoming_id:'another',status:'approved',created_at:stamp,approved_at:stamp});
  const server=createServer(createApp({store,env:{BATON_DEMO_MODE:'true'}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const repo=await mkdtemp(join(tmpdir(),'baton-export-'));
  execFileSync('git',['init','-q',repo]);
  let client;
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const issue=await fetch(base+'/api/orgs/demo-org/tokens',{method:'POST',headers:{'content-type':'application/json','x-baton-demo-user':'demo-admin'},body:JSON.stringify({name:'export-test'})});
    assert.equal(issue.status,201,await issue.clone().text());
    const {token}=await issue.json();
    const auth={authorization:`Bearer ${token}`};
    assert.equal((await fetch(base+'/api/handovers/h-other/export.md',{headers:auth})).status,403,'tokens only export handovers their member takes part in');
    assert.equal((await fetch(base+'/api/handovers/h-mcp-export',{headers:auth})).status,403,'tokens still cannot read handover JSON');
    client=new Client({name:'baton-export-test',version:'1.0.0'});
    await client.connect(new StdioClientTransport({command:process.execPath,args:['mcp-server/dist/index.js'],env:{...process.env,BATON_API_URL:base,BATON_API_KEY:token,BATON_ORG_ID:'demo-org',BATON_REPOSITORY_ID:'demo-repo',BATON_REPO_PATH:repo}}));
    assert.ok((await client.listTools()).tools.some(t=>t.name==='export_handover'));
    const escaped=await client.callTool({name:'export_handover',arguments:{handover_id:'h-mcp-export',output_path:'../outside.md'}});
    assert.ok(escaped.isError);assert.match(JSON.stringify(escaped),/inside the repository/);
    const exported=await client.callTool({name:'export_handover',arguments:{}});
    assert.ok(!exported.isError,JSON.stringify(exported));
    assert.match(JSON.stringify(exported),/docs\/handovers\/handover-h-mcp-ex\.md/);
    const markdown=await readFile(join(repo,'docs','handovers','handover-h-mcp-ex.md'),'utf8');
    assert.match(markdown,/^# Handover — /);
    assert.match(markdown,/replay-protection flag/);
    assert.doesNotMatch(markdown,/Confidential vendor dispute/);
    assert.doesNotMatch(markdown,/@example\.invalid/);
    // sync_history imports the CLI module; usage text printed there would corrupt the stdio stream.
    const sync=await client.callTool({name:'sync_history',arguments:{}});
    assert.ok(Array.isArray(sync.content));
  }finally{if(client)await client.close();await new Promise(resolve=>server.close(resolve));await rm(repo,{recursive:true,force:true});}
});
