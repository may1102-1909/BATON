import { getHandler } from '../../server/runtime.js';

export function apiMiddleware() {
  return {
    name: 'baton-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        if (!pathname.startsWith('/api/')) {
          return next();
        }

        try {
          const handler = getHandler();
          await handler(req, res);
        } catch (err) {
          console.error('[API Middleware Error]', err);
          if (!res.headersSent) {
            res.statusCode = err.status || 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        }
      });
    }
  };
}
