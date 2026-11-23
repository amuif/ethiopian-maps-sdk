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
