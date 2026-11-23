import { Effect } from 'effect';
import { fetchJson, trimBase } from './http.js';

export interface Place {
  /** Name in the requested language (falls back to the local name) */
  name: string;
  /** Full address line */
  label: string;
  lon: number;
  lat: number;
  /** [west, south, east, north] */
  bbox?: [number, number, number, number];
  category: string;
  type: string;
}

export interface SearchOptions {
  /** Nominatim base URL, e.g. http://localhost:8080 from stack/docker-compose.yml */
  baseUrl: string;
  /** `am` for Amharic, `en` for English (default) */
  language?: string;
  limit?: number;
  /** Restrict results to Ethiopia (default true) */
  ethiopiaOnly?: boolean;
  signal?: AbortSignal;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category: string;
  type: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
}

export const toPlace = (p: NominatimPlace): Place => {
  const [s, n, w, e] = (p.boundingbox ?? []).map(Number);
  return {
    name: p.name || p.display_name.split(',')[0],
    label: p.display_name,
    lon: Number(p.lon),
    lat: Number(p.lat),
    bbox: p.boundingbox ? [w, s, e, n] : undefined,
    category: p.category,
    type: p.type,
  };
};

const params = (o: SearchOptions, extra: Record<string, string>) =>
  new URLSearchParams({ format: 'jsonv2', 'accept-language': o.language ?? 'en', ...extra }).toString();

export const searchEffect = (query: string, o: SearchOptions) =>
  fetchJson<NominatimPlace[]>(
    `${trimBase(o.baseUrl)}/search?${params(o, {
      q: query,
      limit: String(o.limit ?? 10),
      ...(o.ethiopiaOnly === false ? {} : { countrycodes: 'et' }),
    })}`,
    { signal: o.signal }
  ).pipe(Effect.map((r) => r.map(toPlace)));

/** Place at a coordinate, or null when nothing is there (open sea, outside the import). */
export const reverseEffect = ([lon, lat]: [number, number], o: Omit<SearchOptions, 'limit' | 'ethiopiaOnly'>) =>
  fetchJson<NominatimPlace | { error: string }>(
    `${trimBase(o.baseUrl)}/reverse?${params(o, { lon: String(lon), lat: String(lat) })}`,
    { signal: o.signal }
  ).pipe(Effect.map((r) => ('error' in r ? null : toPlace(r))));

/** Forward geocode a free-text query (Amharic or English). */
export const search = (query: string, o: SearchOptions) => Effect.runPromise(searchEffect(query, o));
export const reverse = (lonLat: [number, number], o: Omit<SearchOptions, 'limit' | 'ethiopiaOnly'>) =>
  Effect.runPromise(reverseEffect(lonLat, o));
