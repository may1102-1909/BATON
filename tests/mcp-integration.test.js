import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createApp} from '../server/app.js';
import {createMemoryStore} from '../server/store.js';
import {demoSeed} from '../server/demo.js';

const requireMcp=createRequire(new URL('../mcp-server/package.json',import.meta.url));
const {Client}=await import(requireMcp.resolve('@modelcontextprotocol/sdk/client/index.js'));
const {StdioClientTransport}=await import(requireMcp.resolve('@modelcontextprotocol/sdk/client/stdio.js'));

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
    const saved=await client.callTool({name:'save_memory',arguments:{type:'change',content:'Keep retry delivery behind the replay-protection flag.',event_id:'integration-change'}});
    assert.ok(!saved.isError,JSON.stringify(saved));
    const rows=await store.list('sources',{author_id:'demo-member',event_id:'integration-change'});
    assert.equal(rows.length,1);
    const repeated=await client.callTool({name:'save_memory',arguments:{type:'change',content:'Keep retry delivery behind the replay-protection flag.',event_id:'integration-change'}});
    assert.ok(!repeated.isError,JSON.stringify(repeated));
    assert.equal((await store.list('sources',{author_id:'demo-member',event_id:'integration-change'})).length,1);
    const context=await client.callTool({name:'get_context',arguments:{query:'replay-protection'}});
    assert.ok(!context.isError);assert.match(JSON.stringify(context),/replay-protection/);
    const interview=await client.callTool({name:'get_exit_interview',arguments:{}});assert.ok(!interview.isError,JSON.stringify(interview));
  }finally{if(client)await client.close();await new Promise(resolve=>server.close(resolve));}
});
