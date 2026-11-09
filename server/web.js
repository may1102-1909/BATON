import {Readable} from 'node:stream';

// Preserve exact webhook bytes when adapting a Web Request to the Node router.
export function webHandler(handler) {
  return async request => {
    const maxBytes = 1024 * 1024;
    const chunks = [];
    let size = 0;
    if (request.body) {
      for await (const chunk of request.body) {
        size += chunk.length;
        if (size > maxBytes) return Response.json({error:'Request body too large'},{status:413});
        chunks.push(Buffer.from(chunk));
      }
    }
    const req = Readable.from(chunks);
    const url = new URL(request.url);
    req.method = request.method;
    req.url = url.pathname + url.search;
    req.headers = Object.fromEntries(request.headers);
    let status = 200;
    const headers = new Headers();
    let body;
    const res = {
      headersSent:false,
      setHeader(name,value) {headers.set(name,value);return this;},
      writeHead(code,values={}) {status=code;for(const [name,value] of Object.entries(values)) headers.set(name,value);this.headersSent=true;return this;},
      end(value) {body=value;this.headersSent=true;return this;},
    };
    await handler(req,res);
    return new Response(status === 204 || request.method === 'HEAD' ? null : body,{status,headers});
  };
}
