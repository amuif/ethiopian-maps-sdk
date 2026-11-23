import { Effect } from 'effect';
import { PMTiles, FileSource, FetchSource } from 'pmtiles';

/**
 * Geographic Bounding Box in [west, south, east, north] (WSEN) coordinates.
 */
export type BoundingBox = [number, number, number, number];

export interface CompositeProtocolOptions {
  /**
   * Primary remote PMTiles nationwide archive URL.
   */
  remoteUrl: string;

  /**
   * Optional local PMTiles archive (File in browser, or local URL).
   */
  localSource?: string | File;

  /**
   * Geographic bounding box for the local archive in [west, south, east, north] order.
   * If omitted, tile requests will query localSource first and fall back on miss.
   */
  localBBox?: BoundingBox;

  /**
   * Minimum zoom level to query localSource (default: 8).
   * Low-zoom tiles (z0 - z7) query national data to prevent island voids.
   */
  minLocalZoom?: number;

  /**
   * Custom request headers for remote tile fetching.
   */
  headers?: Record<string, string>;
}

export interface MapLibreResponse {
  data: Uint8Array | ArrayBuffer;
  cacheControl?: string;
  expires?: string;
}

/**
 * Converts tile coordinates (z, x, y) to a geographic bounding box [west, south, east, north].
 */
export function tileToBBox(z: number, x: number, y: number): BoundingBox {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  
  const latRad1 = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const north = (latRad1 * 180) / Math.PI;
  
  const latRad2 = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const south = (latRad2 * 180) / Math.PI;

  return [west, south, east, north];
}

/**
 * Tests whether two geographic bounding boxes intersect.
 */
export function bboxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

/**
 * Extracts (z, x, y) tile coordinates from a MapLibre protocol URL.
 */
export function parseTileCoordinates(url: string): { z: number; x: number; y: number } | null {
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.mvt|\.pbf)?(?:\?.*)?$/);
  if (!match) return null;
  return {
    z: parseInt(match[1], 10),
    x: parseInt(match[2], 10),
    y: parseInt(match[3], 10)
  };
}

/**
 * Composite PMTiles protocol adapter bridging local bundled archives and remote streaming.
 */
export class CompositePMTilesProtocol {
  private localPMTiles?: PMTiles;
  private remotePMTiles: PMTiles;
  private localBBox?: BoundingBox;
  private minLocalZoom: number;

  constructor(options: CompositeProtocolOptions) {
    this.remotePMTiles = new PMTiles(new FetchSource(options.remoteUrl, new Headers(options.headers)));
    this.localBBox = options.localBBox;
    this.minLocalZoom = options.minLocalZoom ?? 8;

    if (options.localSource) {
      if (typeof options.localSource === 'string') {
        this.localPMTiles = new PMTiles(options.localSource);
      } else {
        this.localPMTiles = new PMTiles(new FileSource(options.localSource));
      }
    }
  }

  /**
   * Protocol handler conforming to MapLibre GL JS addProtocol specification.
   */
  public tile = async (
    params: { url: string },
    abortController: AbortController
  ): Promise<MapLibreResponse> => {
    const coords = parseTileCoordinates(params.url);

    // If coordinates cannot be parsed or header/metadata is requested, query remote
    if (!coords) {
      const headerResponse = await this.remotePMTiles.getHeader();
      return { data: new TextEncoder().encode(JSON.stringify(headerResponse)) };
    }

    const { z, x, y } = coords;

    // Check if local source should be queried:
    // Must be >= minLocalZoom and spatially intersect local bounding box
    const shouldCheckLocal =
      this.localPMTiles &&
      z >= this.minLocalZoom &&
      (!this.localBBox || bboxesIntersect(tileToBBox(z, x, y), this.localBBox));

    const signal = abortController.signal;
    const read = (src: PMTiles) =>
      Effect.tryPromise(() => src.getZxy(z, x, y, signal)).pipe(Effect.map((t) => t?.data));
    const remote = read(this.remotePMTiles).pipe(
      // Empty tile for out-of-bounds or zero-data coordinates
      Effect.map((data): MapLibreResponse => ({ data: data ?? new Uint8Array(0) }))
    );

    const program =
      shouldCheckLocal && this.localPMTiles
        ? read(this.localPMTiles).pipe(
            // I/O or directory miss - fall through to remote transparently
            Effect.catch(() => Effect.succeed(undefined)),
            Effect.flatMap((data) => (data ? Effect.succeed({ data }) : remote))
          )
        : remote;

    return Effect.runPromise(program);
  };
}

/**
 * Registers the composite protocol with a MapLibre GL JS namespace.
 *
 * @example
 * ```typescript
 * import maplibregl from 'maplibre-gl';
 * import { registerCompositeProtocol } from '@ethiopiamaps/adapter';
 *
 * registerCompositeProtocol(maplibregl, {
 *   remoteUrl: 'https://r2.example.com/ethiopia.pmtiles',
 *   localSource: localBlob,
 *   localBBox: [38.60, 8.80, 38.95, 9.15]
 * });
 * ```
 */
export function registerCompositeProtocol(
  maplibregl: any,
  options: CompositeProtocolOptions,
  protocolName = 'pmtiles-composite'
): CompositePMTilesProtocol {
  const adapter = new CompositePMTilesProtocol(options);
  maplibregl.addProtocol(protocolName, adapter.tile);
  return adapter;
}

export { createBilingualStyle, type StyleConfigOptions } from './style.js';
