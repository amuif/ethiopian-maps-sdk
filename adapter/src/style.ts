export interface StyleConfigOptions {
  baseUrl: string;
  pmtilesUrl?: string;
  styleJson: Record<string, any>;
}

/**
 * Parameterizes a MapLibre style JSON with the adopter's custom static base URL.
 */
export function createBilingualStyle(options: StyleConfigOptions): Record<string, any> {
  const base = options.baseUrl.replace(/\/+$/, '');
  const pmtilesUrl = options.pmtilesUrl || `${base}/ethiopia.pmtiles`;
  const styleString = JSON.stringify(options.styleJson)
    .replace(/\{BASE_URL\}/g, base)
    .replace(/\{PMTILES_URL\}/g, pmtilesUrl);

  return JSON.parse(styleString);
}

export interface TerrainOptions {
  /** terrain.pmtiles location (https:// or file://), built by pipeline/scripts/build-terrain.sh */
  url: string;
  /** Drape the map on a 3D mesh. MapLibre GL JS only, so React Native leaves it off. Default true. */
  terrain3d?: boolean;
  exaggeration?: number;
  /** Shaded relief layer (works on web and native). Default true. */
  hillshade?: boolean;
}

/** Returns a copy of a style with Copernicus terrain added; base styles stay terrain-free so they work without the file. */
export function addTerrain(
  style: Record<string, any>,
  { url, terrain3d = true, exaggeration = 1, hillshade = true }: TerrainOptions
): Record<string, any> {
  const layers = [...style.layers];
  if (hillshade) {
    // Relief sits on land/water fills, under roads, buildings and labels
    const i = layers.findIndex((l) => ['line', 'symbol', 'fill-extrusion'].includes(l.type));
    layers.splice(i < 0 ? layers.length : i, 0, {
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5a5a5a' },
    });
  }
  return {
    ...style,
    sources: {
      ...style.sources,
      terrain: {
        type: 'raster-dem',
        url: `pmtiles://${url}`,
        tileSize: 512,
        encoding: 'mapbox',
        attribution: 'Copernicus GLO-30 © DLR e.V., © Airbus DS, provided under COPERNICUS by the EU and ESA',
      },
    },
    layers,
    ...(terrain3d ? { terrain: { source: 'terrain', exaggeration } } : {}),
  };
}

/**
 * Returns a copy of a style with the extra Microsoft/Google/Esri footprints from buildings.pmtiles
 * (pipeline/scripts/build-buildings.sh) drawn like the OSM buildings: flat from z13, extruded from z15.
 */
export function addBuildings(style: Record<string, any>, { url }: { url: string }): Record<string, any> {
  const layers: any[] = [];
  for (const l of style.layers) {
    layers.push(l);
    // Clone each OSM building layer right after itself so draw order and paint stay identical
    if (l['source-layer'] === 'building') layers.push({ ...l, id: `${l.id}-footprints`, source: 'buildings' });
  }
  return {
    ...style,
    sources: {
      ...style.sources,
      buildings: { type: 'vector', url: `pmtiles://${url}`, attribution: '© Overture Maps Foundation (Microsoft, Google, Esri)' },
    },
    layers,
  };
}
