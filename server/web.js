import { Readable } from 'node:stream';

export function webHandler(nodeHandler) {
  return async function(request) {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());
    
    let bodyBuffer = Buffer.alloc(0);
    if (request.body && !['GET', 'HEAD'].includes(request.method)) {
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength > 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Payload too large' }), {
          status: 413,
          headers: { 'content-type': 'application/json' }
        });
      }
      bodyBuffer = Buffer.from(arrayBuffer);
    }

    const req = Readable.from(bodyBuffer.length ? [bodyBuffer] : []);
    req.method = request.method;
    req.url = url.pathname + url.search;
    req.headers = headers;
    req.rawBody = bodyBuffer;

    return new Promise((resolve) => {
      let statusCode = 200;
      const resHeaders = {};
      const chunks = [];

      const res = {
        writeHead(code, head = {}) {
          statusCode = code;
          Object.assign(resHeaders, head);
          return res;
        },
        setHeader(name, val) {
          resHeaders[name.toLowerCase()] = val;
          return res;
        },
        write(chunk) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          return true;
        },
        end(data) {
          if (data) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
          const responseBody = chunks.length ? Buffer.concat(chunks) : null;
          resolve(new Response(responseBody, {
            status: statusCode,
            headers: resHeaders
          }));
        }
      };

      try {
        nodeHandler(req, res);
      } catch (err) {
        const status = err.status || 500;
        resolve(new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
          status,
          headers: { 'content-type': 'application/json' }
        }));
      }
    });
  };
}
