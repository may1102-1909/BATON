import {loadEnv} from 'vite';

export function apiMiddleware() {
  let handlerPromise;
  async function middleware(req,res,next) {
    if (!req.url?.split('?')[0].startsWith('/api/')) return next();
    try {
      handlerPromise ??= import('../../server/runtime.js').then(module=>module.getHandler());
      await (await handlerPromise)(req,res);
    } catch {res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Baton API failed to initialize; check server configuration.'}));}
  }
  return {
    name:'baton-api',
    configResolved(config) {
      for (const [key,value] of Object.entries(loadEnv(config.mode,process.cwd(),''))) if (process.env[key] === undefined) process.env[key]=value;
    },
    configureServer(server) {server.middlewares.use(middleware);},
    configurePreviewServer(server) {server.middlewares.use(middleware);},
  };
}
