import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {getHandler} from './runtime.js';

for (const file of ['.env.local','.env']) { try { process.loadEnvFile(file); } catch(error) { if(error.code !== 'ENOENT') throw error; } }
const root = resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
createServer(async (req,res)=>{
  if (req.url?.split('?')[0].startsWith('/api/')) return getHandler()(req,res);
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
  try {
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let target = resolve(root, '.'+path);
    if (target !== root && !target.startsWith(root+sep)) {res.writeHead(403).end();return;}
    if (!(await stat(target).catch(()=>null))?.isFile()) target = resolve(root,'index.html');
    const data = await readFile(target);
    res.writeHead(200,{'Content-Type':types[extname(target)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(404).end('Build the frontend with npm run build first.');}
}).listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log(`Baton listening on port ${process.env.PORT || 3000}${process.env.BATON_DEMO_MODE === 'true' ? ' (synthetic demo)' : ''}`));
