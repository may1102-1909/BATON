import {createApp} from './app.js';
import {createMemoryStore,createSupabaseStore} from './store.js';
import {demoSeed} from './demo.js';

let handler;
export function getHandler() {
  if (handler) return handler;
  const demo = process.env.BATON_DEMO_MODE === 'true';
  const configured = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
  const unavailable = () => { const error = new Error('Configure Supabase before using the live workspace'); error.status = 503; throw error; };
  const store = demo ? createMemoryStore(demoSeed()) : configured ? createSupabaseStore() : Object.fromEntries(['list','get','insert','update','remove'].map(name=>[name,unavailable]));
  const env = {...process.env};
  if (demo) for (const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GITHUB_APP_ID','GITHUB_APP_PRIVATE_KEY','GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET','GITHUB_WEBHOOK_SECRET']) delete env[name];
  handler = createApp({store,env});
  return handler;
}
