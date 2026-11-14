import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.js';

export const sha256 = value => createHash('sha256').update(value).digest('hex');

// Bearer "user:<id>[:<email>]" authenticates as that Supabase user; any other bearer is looked up as an API token.
export function makeSupabaseStub() {
  return { auth: { async getUser(token) {
    const [kind, id, email] = String(token).split(':');
    return kind === 'user' ? { data: { user: { id, email: email || null, identities: [] } }, error: null } : { data: { user: null }, error: new Error('invalid') };
  } } };
}

export function makeApp(store, options = {}) {
  const { env = {}, ...rest } = options;
  const app = createApp({ store, env, supabaseClient: makeSupabaseStub(), ...rest });
  const call = (bearer, method, path, body, extraHeaders = {}) => {
    const req = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]), {
      method, url: path, headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), 'content-type': 'application/json', ...extraHeaders },
    });
    return new Promise(resolve => {
      const res = {
        headersSent: false, statusCode: 200, headers: {},
        setHeader() {}, writeHead(status, headers = {}) { this.statusCode = status; this.headers = headers; return this; },
        end(data) {
          this.headersSent = true;
          const text = data ? String(data) : '';
          let parsed = {};
          try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = {}; }
          resolve({ status: this.statusCode, headers: this.headers, text, body: parsed });
        },
      };
      void app(req, res);
    });
  };
  return { app, call };
}
