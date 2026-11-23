import { createHash, timingSafeEqual } from 'node:crypto';
import { Effect } from 'effect';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { ServiceError } from '@ethiopiamaps/services';
import { samplesFromMatch, TrafficStore, type TraceAttributes } from './aggregate.js';

export interface TrafficConfig {
  valhallaUrl: string;
  /** Bearer token fleets send to POST /v1/traces */
  ingestToken: string;
  /** Salt for hashing vehicle ids; rotate it to unlink old hashes */
  salt: string;
  windowMinutes: number;
  minVehicles: number;
  costing?: string;
}

const MAX_POINTS = 5000;

interface Point { lon: number; lat: number; time: number }

/** Validates an untrusted ingest body; returns an error message or the parsed trace. */
export function parseTrace(body: unknown): string | { vehicleId: string; points: Point[] } {
  const b = body as { vehicleId?: unknown; points?: unknown };
  if (typeof b?.vehicleId !== 'string' || !b.vehicleId || b.vehicleId.length > 200) return 'vehicleId must be a non-empty string';
  if (!Array.isArray(b.points) || b.points.length < 2 || b.points.length > MAX_POINTS) return `points must be an array of 2..${MAX_POINTS}`;
  let prev = -Infinity;
  for (const p of b.points as Point[]) {
    if (![p?.lon, p?.lat, p?.time].every((v) => typeof v === 'number' && Number.isFinite(v))) return 'each point needs numeric lon, lat, time';
    if (p.lon < -180 || p.lon > 180 || p.lat < -90 || p.lat > 90) return 'coordinates out of range';
    if (p.time < prev) return 'points must be in time order';
    prev = p.time;
  }
  return { vehicleId: b.vehicleId, points: b.points as Point[] };
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const matchTrace = (cfg: TrafficConfig, points: Point[]) =>
  Effect.tryPromise({
    try: async (signal) => {
      const res = await fetch(`${cfg.valhallaUrl.replace(/\/+$/, '')}/trace_attributes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal,
        body: JSON.stringify({
          shape: points.map(({ lon, lat, time }) => ({ lon, lat, time })),
          costing: cfg.costing ?? 'auto',
          shape_match: 'map_snap',
          use_timestamps: true,
          filters: {
            action: 'include',
            attributes: ['edge.way_id', 'edge.length', 'edge.speed', 'edge.begin_shape_index', 'edge.end_shape_index',
              'matched.type', 'matched.edge_index', 'matched.distance_along_edge', 'shape'],
          },
        }),
      });
      if (!res.ok) throw new ServiceError({ url: res.url, status: res.status, message: await res.text() });
      return (await res.json()) as TraceAttributes;
    },
    catch: (e) => (e instanceof ServiceError ? e : new ServiceError({ url: cfg.valhallaUrl, message: String(e) })),
  }).pipe(Effect.timeout(30_000));

export function createApp(cfg: TrafficConfig, store = new TrafficStore(cfg.windowMinutes * 60_000, cfg.minVehicles)) {
  if (!cfg.ingestToken) throw new Error('TRAFFIC_INGEST_TOKEN must be set');
  const app = new Hono();

  // Public read side: aggregated, k-anonymous segment speeds only
  app.get('/v1/traffic.geojson', cors(), (c) => {
    c.header('cache-control', 'public, max-age=30');
    return c.json(store.geojson());
  });

  app.post('/v1/traces', bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
    const auth = c.req.header('authorization') ?? '';
    if (!safeEqual(auth, `Bearer ${cfg.ingestToken}`)) return c.json({ error: 'unauthorized' }, 401);
    const parsed = parseTrace(await c.req.json().catch(() => null));
    if (typeof parsed === 'string') return c.json({ error: parsed }, 400);

    const vehicle = createHash('sha256').update(cfg.salt).update(parsed.vehicleId).digest('hex').slice(0, 16);
    const result = await Effect.runPromise(
      matchTrace(cfg, parsed.points).pipe(
        Effect.map((m) => samplesFromMatch(m, parsed.points.map((p) => p.time))),
        Effect.tap((samples) => Effect.sync(() => store.add(vehicle, samples))),
        Effect.map((samples) => ({ ok: true as const, segments: samples.length })),
        // Valhalla can't match (off-road, gaps): tell the fleet, don't crash
        Effect.catch((e) => Effect.succeed({ ok: false as const, error: String((e as ServiceError).message ?? e) }))
      )
    );
    // Raw points go out of scope here; nothing but segment speeds is kept
    return result.ok ? c.json(result, 202) : c.json(result, 422);
  });

  app.get('/health', (c) => c.text('ok'));
  return app;
}
