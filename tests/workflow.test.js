import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {createMemoryStore} from '../server/store.js';
import {demoSeed} from '../server/demo.js';
import {webHandler} from '../server/web.js';

test('complete synthetic handover: capture, interview, review, approve, acknowledge',async()=>{
  const store=createMemoryStore(demoSeed());
  const run=webHandler(createApp({store,env:{BATON_DEMO_MODE:'true'}}));
  const request=async(path,{user='demo-admin',method='GET',body,token}={})=>{
    const response=await run(new Request(`http://localhost${path}`,{method,headers:{'content-type':'application/json','x-baton-demo-user':user,...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})}));
    const result=await response.json();
    assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(result)}`);
    return result;
  };
  const me=await request('/api/me');assert.equal(me.demo,true);
  const created=await request('/api/orgs/demo-org/handovers',{method:'POST',body:{leaverId:'demo-member',incomingId:'demo-incoming'}});
  const id=created.handover.id;
  let detail=await request(`/api/handovers/${id}`,{user:'demo-member'});
  assert.ok(detail.questions.length>=5);
  for (const question of detail.questions) await request(`/api/handovers/${id}/answers`,{method:'POST',user:'demo-member',body:{questionId:question.id,answer:'The queue is behind a feature flag. Riley should verify replay protection before rollout.'}});
  const generated=await request(`/api/handovers/${id}/generate`,{method:'POST',body:{}});
  assert.ok(generated.claims.length>0);
  for(const claim of generated.claims) await request(`/api/handovers/${id}/claims/${claim.id}`,{method:'PATCH',body:{status:'approved'}});
  await request(`/api/handovers/${id}/approve`,{method:'POST',body:{}});
  detail=await request(`/api/handovers/${id}`,{user:'demo-incoming'});
  assert.equal(detail.handover.status,'approved');
  assert.ok(detail.claims.every(claim=>claim.source_ids.length>0 || claim.confidence==='missing'));
  await request(`/api/handovers/${id}/acknowledge`,{user:'demo-incoming',method:'POST',body:{}});
  const result=await request(`/api/handovers/${id}/ask`,{user:'demo-incoming',method:'POST',body:{question:'What remains to do for webhook retry?'}});
  assert.ok(result);
});
