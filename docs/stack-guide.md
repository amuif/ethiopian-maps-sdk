# Self-Hosted Stack (Tiles, Search, Routing)

`stack/docker-compose.yml` runs everything with one command. No API keys, no central service.

```bash
# needs dist/ethiopia.pmtiles (download from GitHub Releases or build with pipeline/) and `pnpm build:glyphs`
docker compose -f stack/docker-compose.yml up -d
```

| Service | Port | What it does | First start |
|---|---|---|---|
| `tiles` | 3000 | Serves `dist/ethiopia.pmtiles`, styles, glyphs and sprites in the published layout | instant |
| `search` | 8080 | Nominatim geocoding, Amharic and English | imports Ethiopia from Geofabrik (roughly 30–60 min, ~8 GB disk) |

Data lives in named volumes, so restarts are fast. Change `NOMINATIM_PASSWORD` before exposing the stack.

## Search from an app

```ts
import { search, reverse } from '@ethiopiamaps/services';

const places = await search('መስቀል አደባባይ', { baseUrl: 'http://localhost:8080', language: 'am' });
// [{ name, label, lon, lat, bbox: [w, s, e, n], category, type }]

const here = await reverse([38.7613, 9.0108], { baseUrl: 'http://localhost:8080' }); // Place | null
```

Results are limited to Ethiopia unless you pass `ethiopiaOnly: false`. Failures reject with `ServiceError` (`status` is set for HTTP errors), and requests time out after 15 s. The package uses plain `fetch`, so it works the same in the browser and in React Native. Effect users can call `searchEffect` / `reverseEffect` directly.

Names come from OSM's `name:am` / `name:en` tags, so a place without an Amharic tag is returned under its local name.
