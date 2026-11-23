import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const env = process.env;
if (!env.TRAFFIC_SALT) throw new Error('TRAFFIC_SALT must be set (random string; keeps vehicle hashes unlinkable)');

const app = createApp({
  valhallaUrl: env.VALHALLA_URL ?? 'http://localhost:8002',
  ingestToken: env.TRAFFIC_INGEST_TOKEN ?? '',
  salt: env.TRAFFIC_SALT,
  windowMinutes: Number(env.TRAFFIC_WINDOW_MIN ?? 15),
  minVehicles: Number(env.TRAFFIC_MIN_VEHICLES ?? 3),
});

const port = Number(env.PORT ?? 8003);
serve({ fetch: app.fetch, port }, () => console.log(`traffic plugin on :${port}`));
