import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { TrafficStore } from './aggregate.js';
import { writeLiveSpeeds } from './valhalla-tar.js';

const env = process.env;
if (!env.TRAFFIC_SALT) throw new Error('TRAFFIC_SALT must be set (random string; keeps vehicle hashes unlinkable)');

const windowMinutes = Number(env.TRAFFIC_WINDOW_MIN ?? 15);
const store = new TrafficStore(windowMinutes * 60_000, Number(env.TRAFFIC_MIN_VEHICLES ?? 3));
const app = createApp({
  valhallaUrl: env.VALHALLA_URL ?? 'http://localhost:8002',
  ingestToken: env.TRAFFIC_INGEST_TOKEN ?? '',
  salt: env.TRAFFIC_SALT,
  windowMinutes,
  minVehicles: Number(env.TRAFFIC_MIN_VEHICLES ?? 3),
}, store);

// Optional: push speeds into Valhalla's traffic.tar so routing uses them
if (env.VALHALLA_TRAFFIC_TAR) {
  let previous = new Set<number>();
  setInterval(() => {
    try {
      previous = writeLiveSpeeds(env.VALHALLA_TRAFFIC_TAR!, store.liveSpeeds(), previous);
    } catch (e) {
      console.error('traffic.tar update failed:', e); // routing falls back to its default speeds
    }
  }, Number(env.TRAFFIC_TAR_INTERVAL_S ?? 60) * 1000);
}

const port = Number(env.PORT ?? 8003);
serve({ fetch: app.fetch, port }, () => console.log(`traffic plugin on :${port}`));
