# Live Traffic Plugin (optional)

Feed your own fleet's GPS and get live road speeds on the map. The plugin (`traffic/`, Hono + Effect) matches each trace to roads with the stack's Valhalla, keeps only per-segment speeds, and publishes them as GeoJSON.

## Run it

```bash
pnpm install && pnpm --filter "@ethiopiamaps/traffic..." build
export TRAFFIC_INGEST_TOKEN=$(openssl rand -hex 24) TRAFFIC_SALT=$(openssl rand -hex 24)
docker compose -f stack/docker-compose.yml --profile traffic up -d   # port 8003, needs the routing service
```

| Variable | Default | Meaning |
|---|---|---|
| `TRAFFIC_INGEST_TOKEN` | required | Bearer token your fleet uses to post traces |
| `TRAFFIC_SALT` | required | Secret mixed into vehicle-id hashes. Rotating it unlinks old hashes |
| `TRAFFIC_WINDOW_MIN` | 15 | How long a speed observation counts |
| `TRAFFIC_MIN_VEHICLES` | 3 | A segment is published only once this many distinct vehicles have crossed it in the window |

## Send traces

```bash
curl -X POST http://localhost:8003/v1/traces \
  -H "Authorization: Bearer $TRAFFIC_INGEST_TOKEN" -H 'content-type: application/json' \
  -d '{"vehicleId":"bus-17","points":[{"lon":38.7613,"lat":9.0108,"time":1732350000}, …]}'
```

Each trace holds 2–5000 points in time order, with `time` in epoch seconds. Send every 30–60 s of driving per vehicle. The response is `202 {segments}`, or `422` when Valhalla can't match the trace (for example off-road driving or GPS gaps).

## Show it

`GET /v1/traffic.geojson` returns LineStrings with `speedKmh` (median across vehicles), `expectedKmh` (Valhalla free-flow), `ratio` (observed ÷ expected, capped at 1) and `vehicles`. It's CORS-open and cacheable for 30 s.

```ts
import { trafficLayer } from '@ethiopiamaps/services';

map.addSource('traffic', { type: 'geojson', data: 'http://localhost:8003/v1/traffic.geojson' });
map.addLayer(trafficLayer('traffic'), 'poi-icons'); // under labels
setInterval(() => map.getSource('traffic').setData('http://localhost:8003/v1/traffic.geojson'), 30_000);
```

On React Native, use `<GeoJSONSource data={url}>` with a `<Layer {...trafficLayer()} />` child. Lines are offset to the right of the direction of travel (Ethiopia drives on the right), so the two directions show side by side.

## Privacy

- Raw points are discarded as soon as a trace is matched. Only `{segment, speed, salted vehicle hash, timestamp}` is kept, in memory, for one window.
- Vehicle IDs are never stored or published, only a 64-bit salted SHA-256 prefix used to count distinct vehicles.
- Segments with fewer than `TRAFFIC_MIN_VEHICLES` distinct vehicles are withheld, so a single car's trip can't be read off the map.
- The read endpoint publishes aggregates only. Keep the ingest token private, and put the service behind HTTPS.

## Limits

- **Routing doesn't use live speeds yet.** Valhalla needs a `traffic.tar` keyed by its internal edge IDs to do that. Today the speeds only colour the map.
- Observations are held in memory, so a restart loses at most one window. Use a shared store if you run several instances.
- A vehicle needs two or more GPS points on the same road segment to yield a speed, so very short segments fill in only with dense (≤ 10 s) sampling.
