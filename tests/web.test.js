import test from 'node:test';
import assert from 'node:assert/strict';
import {webHandler} from '../server/web.js';
test('Web adapter preserves URL and exact signed webhook bytes',async()=>{
  const original='{ "event": "test", "n": 1 }\n';
  const run=webHandler(async(req,res)=>{
    let raw='';for await(const chunk of req) raw+=chunk.toString();
    assert.equal(raw,original);assert.equal(req.url,'/api/github/webhook?q=yes');
    assert.equal(req.headers['x-hub-signature-256'],'test');
    res.writeHead(202,{'Content-Type':'application/json'}).end('{"ok":true}');
  });
  const response=await run(new Request('https://example.invalid/api/github/webhook?q=yes',{method:'POST',headers:{'x-hub-signature-256':'test'},body:original}));
  assert.equal(response.status,202);assert.deepEqual(await response.json(),{ok:true});
});
