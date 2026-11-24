# 3D Buildings and Terrain

## Buildings

Both styles extrude OSM buildings from zoom 15. Heights come from the OpenMapTiles `render_height` field (OSM `height`, or `building:levels` × ~3.7 m, or 5 m when neither is tagged). Buildings grow in between zoom 15 and 16, and anything tagged `hide_3d` stays flat. Tilt the map to see them. No extra data or setup is needed.

### Extra footprints (Microsoft, Google, Esri)

OSM is missing many buildings outside the big cities. `buildings.pmtiles` adds the footprints from Microsoft, Google Open Buildings and Esri that OSM doesn't have. They come from the [Overture Maps](https://overturemaps.org) buildings theme, which has already matched those datasets against OSM, so nothing is drawn twice. Heights use Overture's `height`, else floors × 3 m, else the style's 5 m default.

Get it from the `buildings-overture` GitHub Release (built by the *Build and Release Buildings* workflow), or build it locally:

```bash
bash pipeline/scripts/build-buildings.sh data/buildings dist   # needs python3 and tippecanoe >= 2.17
# smaller area: BUILDINGS_BBOX=38.6,8.8,38.95,9.15 ; pin a release: OVERTURE_RELEASE=2026-11-18.0
```

```ts
import { addBuildings } from '@ethiopiamaps/adapter';
const style = addBuildings(createBilingualStyle({ baseUrl, styleJson }), { url: `${baseUrl}/buildings.pmtiles` });
```

React Native: `<EthiopiaMap … buildingsUrl="https://tiles.yourdomain.et/buildings.pmtiles" />`. The footprints are drawn with the same layers as OSM buildings: flat from z13, extruded from z15.

**Attribution:** credit "© Overture Maps Foundation" alongside OSM. The source attribution carries it.

## Terrain

`terrain.pmtiles` holds Copernicus GLO-30 elevation as Mapbox terrain-RGB tiles (512 px PNG, z5–z10, about 700 MB). Get it from the `terrain-glo30` GitHub Release (built by the *Build and Release Terrain* workflow), or build it locally:

```bash
bash pipeline/scripts/build-terrain.sh data/terrain dist   # needs python3 and the pmtiles CLI
# smaller area / more detail: TERRAIN_LON_MIN=38 TERRAIN_LON_MAX=39 TERRAIN_LAT_MIN=8 TERRAIN_LAT_MAX=9 TERRAIN_MAX_Z=12
```

The base styles don't include terrain, so maps keep working without the file. Add it with `addTerrain`:

```ts
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createBilingualStyle, addTerrain } from '@ethiopiamaps/adapter';

maplibregl.addProtocol('pmtiles', new Protocol().tile);
const style = addTerrain(createBilingualStyle({ baseUrl, styleJson }), {
  url: `${baseUrl}/terrain.pmtiles`,
  exaggeration: 1.2, // 3D mesh; set terrain3d: false for shaded relief only
});
new maplibregl.Map({ container: 'map', style, center: [38.76, 9.08], zoom: 12, pitch: 60 });
```

React Native gets shaded relief (MapLibre Native has no 3D terrain mesh yet):

```tsx
<EthiopiaMap pmtilesUrl={…} baseUrl={…} terrainUrl="https://tiles.yourdomain.et/terrain.pmtiles" />
```

**Attribution:** when you show terrain, credit "Copernicus GLO-30 DEM © DLR e.V., © Airbus Defence and Space GmbH, provided under COPERNICUS by the European Union and ESA".

## Not yet included

- OGC 3D Tiles city models (Cesium). These need drone or aerial capture first.
