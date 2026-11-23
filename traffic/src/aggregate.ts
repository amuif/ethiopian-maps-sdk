import { decodePolyline, type LonLat } from '@ethiopiamaps/services';

/** Subset of Valhalla /trace_attributes we request (see match.ts filters) */
export interface TraceAttributes {
  shape: string;
  edges: { way_id: number; length: number; speed: number; begin_shape_index: number; end_shape_index: number }[];
  matched_points: { type: string; edge_index?: number; distance_along_edge?: number }[];
}

export interface SegmentSample {
  key: string;
  wayId: number;
  coordinates: LonLat[];
  /** Valhalla's expected (free-flow) speed for the edge */
  expectedKmh: number;
  observedKmh: number;
}

const MAX_KMH = 200; // above this it's GPS noise, not traffic
const MIN_KM = 0.005;

/** Observed speed per matched edge: first and last point the vehicle had on that edge. Input times are epoch seconds, aligned with matched_points. */
export function samplesFromMatch(m: TraceAttributes, times: number[]): SegmentSample[] {
  const shape = decodePolyline(m.shape);
  const byEdge = new Map<number, { t: number; d: number }[]>();
  m.matched_points.forEach((p, i) => {
    if (p.type === 'unmatched' || p.edge_index === undefined || p.distance_along_edge === undefined || !m.edges[p.edge_index]) return;
    const list = byEdge.get(p.edge_index) ?? [];
    list.push({ t: times[i], d: p.distance_along_edge });
    byEdge.set(p.edge_index, list);
  });

  const out: SegmentSample[] = [];
  for (const [idx, pts] of byEdge) {
    if (pts.length < 2) continue;
    const e = m.edges[idx];
    const first = pts[0], last = pts[pts.length - 1];
    const km = (last.d - first.d) * e.length;
    const hours = (last.t - first.t) / 3600;
    if (km < MIN_KM || hours <= 0) continue;
    const kmh = km / hours;
    if (kmh > MAX_KMH) continue;
    const coordinates = shape.slice(e.begin_shape_index, e.end_shape_index + 1);
    // Direction-aware key: same way, opposite carriageway gets its own segment
    const r = ([x, y]: LonLat) => `${x.toFixed(5)},${y.toFixed(5)}`;
    out.push({
      key: `${e.way_id}:${r(coordinates[0])}>${r(coordinates[coordinates.length - 1])}`,
      wayId: e.way_id,
      coordinates,
      expectedKmh: e.speed,
      observedKmh: kmh,
    });
  }
  return out;
}

interface Obs { vehicle: string; kmh: number; at: number }

/**
 * Rolling window of per-segment speeds. Holds only segment speeds and salted vehicle hashes, never points.
 * shortcut: in-memory, so a restart forgets at most one window; move to Redis/SQLite if you run several instances.
 */
export class TrafficStore {
  private segs = new Map<string, { s: SegmentSample; obs: Obs[] }>();

  constructor(private windowMs: number, private minVehicles: number) {}

  add(vehicle: string, samples: SegmentSample[], now = Date.now()) {
    for (const s of samples) {
      const seg = this.segs.get(s.key) ?? { s, obs: [] };
      seg.obs.push({ vehicle, kmh: s.observedKmh, at: now });
      this.segs.set(s.key, seg);
    }
  }

  /** Segments seen by at least `minVehicles` distinct vehicles in the window (k-anonymity), as GeoJSON. */
  geojson(now = Date.now()) {
    const features = [];
    for (const [key, seg] of this.segs) {
      seg.obs = seg.obs.filter((o) => now - o.at <= this.windowMs);
      if (!seg.obs.length) {
        this.segs.delete(key);
        continue;
      }
      // Latest speed per vehicle, so one chatty device can't dominate the median
      const perVehicle = new Map<string, number>();
      for (const o of seg.obs) perVehicle.set(o.vehicle, o.kmh);
      if (perVehicle.size < this.minVehicles) continue;
      const speeds = [...perVehicle.values()].sort((a, b) => a - b);
      const mid = speeds.length >> 1;
      const median = speeds.length % 2 ? speeds[mid] : (speeds[mid - 1] + speeds[mid]) / 2;
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: seg.s.coordinates },
        properties: {
          wayId: seg.s.wayId,
          speedKmh: Math.round(median),
          expectedKmh: seg.s.expectedKmh,
          // 1 = free flow, 0.5 = half speed; capped so fast drivers don't read as "better than free"
          ratio: Math.min(1, Math.round((median / Math.max(seg.s.expectedKmh, 1)) * 100) / 100),
          vehicles: perVehicle.size,
        },
      });
    }
    return { type: 'FeatureCollection' as const, features };
  }
}
