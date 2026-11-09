// Synthetic fixture only; demo mode never reads or writes a live project.
export function demoSeed() {
  const created_at = '2026-11-01T10:00:00.000Z';
  const org_id = 'demo-org';
  const repository_id = 'demo-repo';
  const source = (id, type, content, metadata = {}) => ({id,org_id,repository_id,author_id:'demo-member',author_login:'demo-engineer',type,content,metadata,visibility:'team',created_at});
  return {
    organizations:[{id:org_id,name:'Baton Demo · Synthetic data',created_by:'demo-admin',created_at}],
    members:[
      {id:'membership-admin',org_id,user_id:'demo-admin',name:'Alex · Team lead',email:'admin@example.invalid',role:'admin',created_at},
      {id:'membership-member',org_id,user_id:'demo-member',name:'Sam · Departing engineer',email:'sam@example.invalid',role:'member',github_login:'demo-engineer',created_at},
      {id:'membership-incoming',org_id,user_id:'demo-incoming',name:'Riley · Incoming engineer',email:'riley@example.invalid',role:'member',created_at},
    ],
    repositories:[{id:repository_id,org_id,full_name:'synthetic/baton-demo',installation_id:0,created_at,last_synced_at:null,demo:true}],
    sources:[
      source('demo-decision','decision','Use a durable retry queue for outgoing invoice webhooks. Reason: downstream receivers can be temporarily unavailable.',{decision:'Durable webhook retry queue',reason:'Prevent lost invoices during receiver outages.',files_affected:['src/webhooks/queue.ts']}),
      source('demo-pr','pull_request','PR #42: Add idempotency checks to invoice webhook delivery. Open, not merged; retry handling still needs review.',{number:42,state:'open',merged:false,head:'feat/webhook-idempotency',files:['src/webhooks/queue.ts'],author_login:'demo-engineer'}),
      source('demo-blocker','blocker','Retry queue cannot be released until replay protection has been verified.',{status:'active',problem:'Replay protection needs verification',workaround_notes:'Keep the new queue behind its feature flag.'}),
      source('demo-commit','commit','Add webhook retry queue behind an opt-in feature flag.',{sha:'1234567890abcdef1234567890abcdef12345678',files:['src/webhooks/queue.ts'],author_login:'demo-engineer'}),
    ],
    tasks:[{id:'demo-task',org_id,title:'Verify webhook replay protection',description:'Exercise duplicate delivery and recovery after receiver outages.',assignee_id:'demo-member',created_by:'demo-admin',status:'open',due_at:'2026-11-15',created_at}],
  };
}
