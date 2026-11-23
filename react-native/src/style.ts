import { createBilingualStyle } from '@ethiopiamaps/adapter/style';

export interface NativeStyleOptions {
  /** Tile archive: `https://…/ethiopia.pmtiles`, `file:///…/addis_ababa.pmtiles`, or a bare absolute device path. */
  pmtilesUrl: string;
  /** Folder holding `glyphs/` and `sprites/`: `https://…` online, `file:///…` (or a bare absolute path) for offline. */
  baseUrl: string;
  styleJson: Record<string, any>;
}

// MapLibre Native needs a scheme; bare paths like `/data/user/0/…` are the usual mistake.
const withScheme = (u: string) => (u.startsWith('/') ? `file://${u}` : u);

/** Fills the style placeholders for MapLibre Native, which reads `pmtiles://` (remote or file) itself. */
export function createNativeStyle({ pmtilesUrl, baseUrl, styleJson }: NativeStyleOptions): Record<string, any> {
  for (const [name, url] of Object.entries({ pmtilesUrl, baseUrl })) {
    if (!/^(https?|file):\/\//.test(withScheme(url))) {
      throw new Error(`@ethiopiamaps/react-native: ${name} must be http(s)://, file:// or an absolute path, got "${url}"`);
    }
  }
  return createBilingualStyle({ baseUrl: withScheme(baseUrl), pmtilesUrl: withScheme(pmtilesUrl), styleJson });
}
