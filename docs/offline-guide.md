# Mobile & Offline Integration Guide

This guide details how to integrate Ethiopian Maps SDK city extracts and nationwide archives into mobile applications for 100% disconnected offline navigation.

---

All three native SDKs bundle both styles and take the same inputs as the React Native component: `pmtilesUrl` (remote, or a local file for offline), `baseUrl` (the folder with `glyphs/` and `sprites/`), and optional `language`, `terrainUrl` and `buildingsUrl`. Bare absolute paths get `file://` added, and relative paths are rejected. For full offline use, copy the archive plus `glyphs/` (from `glyphs/dist`) and `sprites/` onto the device.

## 1. Android (Kotlin, `android/`)

Built on MapLibre Native Android 13.6.1. Include the library module (`include(":ethiopiamaps")` pointing at `android/`), or build the AAR with `cd android && ./gradlew assembleRelease`.

```kotlin
import et.ethiopiamaps.EthiopiaMapLanguage
import et.ethiopiamaps.setEthiopiaStyle

mapView.getMapAsync { map ->
    map.setEthiopiaStyle(
        context,
        pmtilesUrl = "asset://tiles/addis_ababa.pmtiles", // or https://…/ethiopia.pmtiles, or a device path
        baseUrl = "asset://map",                          // app/src/main/assets/map/{glyphs,sprites}
        language = EthiopiaMapLanguage.AMHARIC,
    ) { style -> /* loaded */ }
}
```

`EthiopiaMapStyle.load(...)` returns the style JSON when you need it yourself. `asset://` URLs work on Android only.

---

## 2. iOS (Swift Package, `ios/`)

Built on MapLibre Native iOS 6.31.0. In Xcode, add the package with *File → Add Package Dependencies → Add Local…* (`ios/`), or point to the repository.

```swift
import MapLibre
import EthiopiaMaps

let mapView = MLNMapView(frame: view.bounds)
let tiles = Bundle.main.url(forResource: "addis_ababa", withExtension: "pmtiles")!
try mapView.setEthiopiaStyle(pmtilesURL: tiles.absoluteString,
                             baseURL: Bundle.main.resourceURL!.appendingPathComponent("map").absoluteString,
                             language: .amharic)
```

`MLNMapView` loads styles from a URL, so the filled style is written to Caches. `EthiopiaMapStyle.load(...)` returns the JSON `Data` itself.

---

## 3. Flutter (`flutter/`, package `ethiopia_maps`)

Built on `maplibre_gl` ^0.28.0.

```yaml
dependencies:
  ethiopia_maps:
    path: ../ethiopian-maps-sdk/flutter   # or a git dependency with path: flutter
```

```dart
import 'package:ethiopia_maps/ethiopia_maps.dart';

EthiopiaMap(
  pmtilesUrl: '${docs.path}/tiles/addis_ababa.pmtiles', // or https://…/ethiopia.pmtiles
  baseUrl: '${docs.path}/map',
  language: EthiopiaMapLanguage.amharic,
)
```

`buildEthiopiaStyle(json, …)` returns the style string for your own `MapLibreMap(styleString: …)`.

The styles inside the three SDKs are copies of `styles/*.json`. Run `bash tools/sync-native-styles.sh` after editing a style. CI fails on stale copies.

**Limitation (all native SDKs):** each map uses one archive, like React Native. Choose the city slice when offline and the national URL when online.

---

## 4. React Native (`@ethiopiamaps/react-native`)

Built on `@maplibre/maplibre-react-native` v11+ (Expo 54+ or bare RN 0.80+). MapLibre Native reads `pmtiles://` itself, so no protocol handler is needed.

```bash
pnpm add @ethiopiamaps/react-native @maplibre/maplibre-react-native
```

```tsx
import { EthiopiaMap } from '@ethiopiamaps/react-native';

// Online: stream the nationwide archive
<EthiopiaMap
  pmtilesUrl="https://tiles.yourdomain.et/ethiopia.pmtiles"
  baseUrl="https://tiles.yourdomain.et"
  language="amharic"
/>

// Offline: point at files already on the device
<EthiopiaMap
  pmtilesUrl={`${documentDir}/tiles/addis_ababa.pmtiles`}
  baseUrl={`${documentDir}/map`} // contains glyphs/ and sprites/
/>
```

For full offline use, copy the archive plus `glyphs/` (from `glyphs/dist`) and `sprites/` onto the device, for example on first launch with `expo-file-system`. Bare absolute paths get `file://` added. The default camera is Addis Ababa; pass `initialViewState` to change it. All other `Map` props and children (sources, layers, annotations) pass through. An "© OpenStreetMap contributors" credit is always shown.

**Limitation:** each map uses one archive. The local/remote hot swap of `@ethiopiamaps/adapter` is not available on React Native, because MapLibre Native has no JS protocol hook. Choose the city slice when offline and the national URL when online.

---

## 5. Web & Hybrid (WebView / Capacitor)

For web applications or WebView-based frameworks, use `@ethiopiamaps/adapter` to enable automatic hot-swapping between the local bundled slice and remote streaming:

```typescript
import maplibregl from 'maplibre-gl';
import { registerCompositeProtocol, createBilingualStyle } from '@ethiopiamaps/adapter';

// Register composite handler
registerCompositeProtocol(maplibregl, {
  remoteUrl: 'https://tiles.yourdomain.et/ethiopia.pmtiles',
  localSource: 'tiles/addis_ababa.pmtiles',
  localBBox: [38.60, 8.80, 38.95, 9.15], // Addis Ababa WSEN bounds
  minLocalZoom: 8
});

// Load parameterized bilingual style
const style = createBilingualStyle({
  baseUrl: 'https://tiles.yourdomain.et',
  pmtilesUrl: 'pmtiles-composite://local-or-remote',
  styleJson: masterStyleJson
});

const map = new maplibregl.Map({
  container: 'map',
  style: style,
  center: [38.74, 9.01],
  zoom: 12
});
```
