/**
 * MapLibre line layer for the traffic plugin's /v1/traffic.geojson (works in GL JS and as React Native <Layer> props).
 * Colour by `ratio` (observed / free-flow speed), offset to the right of travel since Ethiopia drives on the right.
 */
export const trafficLayer = (source = 'traffic') => ({
  id: 'traffic',
  type: 'line' as const,
  source,
  minzoom: 10,
  layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'ratio'], 0.25, '#b3261e', 0.5, '#e8710a', 0.8, '#f2c200', 1, '#1e8e3e'],
    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 5],
    'line-offset': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 4],
  },
});
