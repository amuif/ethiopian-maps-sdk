import { addTerrain, createBilingualStyle } from '@ethiopiamaps/adapter/style';

export interface NativeStyleOptions {
  /** Tile archive: `https://…/ethiopia.pmtiles`, `file:///…/addis_ababa.pmtiles`, or a bare absolute device path. */
  pmtilesUrl: string;
  /** Folder holding `glyphs/` and `sprites/`: `https://…` online, `file:///…` (or a bare absolute path) for offline. */
  baseUrl: string;
  styleJson: Record<string, any>;
  /** Optional terrain.pmtiles (same URL rules) for shaded relief */
  terrainUrl?: string;
}

// MapLibre Native needs a scheme; bare paths like `/data/user/0/…` are the usual mistake.
const withScheme = (u: string) => (u.startsWith('/') ? `file://${u}` : u);

/** Fills the style placeholders for MapLibre Native, which reads `pmtiles://` (remote or file) itself. */
export function createNativeStyle({ pmtilesUrl, baseUrl, styleJson, terrainUrl }: NativeStyleOptions): Record<string, any> {
  for (const [name, url] of Object.entries({ pmtilesUrl, baseUrl, ...(terrainUrl ? { terrainUrl } : {}) })) {
    if (!/^(https?|file):\/\//.test(withScheme(url))) {
      throw new Error(`@ethiopiamaps/react-native: ${name} must be http(s)://, file:// or an absolute path, got "${url}"`);
    }
  }
  const style = createBilingualStyle({ baseUrl: withScheme(baseUrl), pmtilesUrl: withScheme(pmtilesUrl), styleJson });
  // shortcut: hillshade only; 3D terrain mesh is a MapLibre GL JS feature, revisit when MapLibre Native ships it
  return terrainUrl ? addTerrain(style, { url: withScheme(terrainUrl), terrain3d: false }) : style;
}
