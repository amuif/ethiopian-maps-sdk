import { Effect } from 'effect';
import { fetchJson, trimBase } from './http.js';

export type LonLat = [number, number];
export type Profile = 'auto' | 'motorcycle' | 'bicycle' | 'pedestrian';

export interface RouteOptions {
  /** Valhalla base URL, e.g. http://localhost:8002 from stack/docker-compose.yml */
  baseUrl: string;
  profile?: Profile;
  /** Valhalla narrative language, e.g. `en-US` (default). Valhalla has no Amharic narrative yet. */
  language?: string;
  signal?: AbortSignal;
}

export interface Maneuver {
  instruction: string;
  distanceKm: number;
  durationS: number;
  location: LonLat;
}

export interface Route {
  geometry: { type: 'LineString'; coordinates: LonLat[] };
  distanceKm: number;
  durationS: number;
  maneuvers: Maneuver[];
}

/** Decodes a Google-encoded polyline (Valhalla uses precision 6) into [lon, lat] pairs. */
export function decodePolyline(str: string, precision = 6): LonLat[] {
  const factor = 10 ** precision;
  const out: LonLat[] = [];
  let i = 0, lat = 0, lon = 0;
  const next = () => {
    let shift = 0, result = 0, b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    out.push([lon / factor, lat / factor]);
  }
  return out;
}

interface ValhallaTrip {
  trip: {
    summary: { length: number; time: number };
    legs: {
      shape: string;
      maneuvers: { instruction: string; length: number; time: number; begin_shape_index: number }[];
    }[];
  };
}

export const toRoute = ({ trip }: ValhallaTrip): Route => {
  const coordinates: LonLat[] = [];
  const maneuvers: Maneuver[] = [];
  for (const leg of trip.legs) {
    const shape = decodePolyline(leg.shape);
    for (const m of leg.maneuvers) {
      maneuvers.push({ instruction: m.instruction, distanceKm: m.length, durationS: m.time, location: shape[m.begin_shape_index] });
    }
    // Consecutive legs share their joining point
    coordinates.push(...(coordinates.length ? shape.slice(1) : shape));
  }
  return { geometry: { type: 'LineString', coordinates }, distanceKm: trip.summary.length, durationS: trip.summary.time, maneuvers };
};

export const routeEffect = (stops: LonLat[], o: RouteOptions) =>
  stops.length < 2
    ? Effect.die(new Error('route needs at least two stops'))
    : fetchJson<ValhallaTrip>(
        `${trimBase(o.baseUrl)}/route`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            locations: stops.map(([lon, lat]) => ({ lon, lat })),
            costing: o.profile ?? 'auto',
            directions_options: { units: 'kilometers', language: o.language ?? 'en-US' },
          }),
          signal: o.signal,
        }
      ).pipe(Effect.map(toRoute));

/** Route through two or more [lon, lat] stops; `geometry` drops straight into a MapLibre GeoJSON source. */
export const route = (stops: LonLat[], o: RouteOptions) => Effect.runPromise(routeEffect(stops, o));
