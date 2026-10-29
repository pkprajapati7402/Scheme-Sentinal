import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { api } from './routes.js';
import { config } from '../config.js';

const app = new Hono();

app.use('*', cors());

// Mount API routes
app.route('/api', api);

// Serve static dashboard files from ./public
app.use('/*', serveStatic({ root: './public' }));

export function startApiServer(port: number = config.API_PORT) {
  console.log(`[Scheme Sentinel Dashboard & API] Listening on http://localhost:${port}`);
  return serve({
    fetch: app.fetch,
    port,
  });
}

if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startApiServer();
}

export { app };

