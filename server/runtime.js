import {createApp} from './app.js';
import {createMemoryStore,createSupabaseStore} from './store.js';
import {demoSeed} from './demo.js';

let handler;
export function getHandler() {
  if (handler) return handler;
  const demo = process.env.BATON_DEMO_MODE === 'true';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const configured = Boolean(supabaseUrl && serviceRoleKey);
  const unavailable = () => { const error = new Error('Configure Supabase service-role key before using the live workspace'); error.status = 503; throw error; };
  const store = demo ? createMemoryStore(demoSeed()) : configured ? createSupabaseStore(null, { ...process.env, SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey }) : Object.fromEntries(['list','get','insert','update','remove'].map(name=>[name,unavailable]));
  const env = {...process.env};
  if (supabaseUrl && !env.SUPABASE_URL) env.SUPABASE_URL = supabaseUrl;
  if (serviceRoleKey && !env.SUPABASE_SERVICE_ROLE_KEY) env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  if (demo) for (const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GITHUB_APP_ID','GITHUB_APP_PRIVATE_KEY','GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET','GITHUB_WEBHOOK_SECRET']) delete env[name];
  handler = createApp({store,env});
  return handler;
}
