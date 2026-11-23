# Mobile & Offline Integration Guide

This guide details how to integrate Ethiopian Maps SDK city extracts and nationwide archives into mobile applications for 100% disconnected offline navigation.

---

## 1. Android (Native Java / Kotlin)

MapLibre Native for Android can read PMTiles directly from local device storage or the app's `assets/` directory.

### Step 1: Place Archive in Assets
Copy your desired city extract (e.g. `addis_ababa.pmtiles`) to:
```
app/src/main/assets/tiles/addis_ababa.pmtiles
```

### Step 2: Configure MapLibre Native
In your Activity or Fragment:

```kotlin
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style

class MapActivity : AppCompatActivity() {
    private lateinit var mapView: MapView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_map)

        mapView = findViewById(R.id.mapView)
        mapView.onCreate(savedInstanceState)

        mapView.getMapAsync { map ->
            // Use local asset URI scheme
            val localTileUri = "asset://tiles/addis_ababa.pmtiles"
            
            map.setStyle(Style.Builder().fromUri("asset://styles/ethiopia-bilingual.json")) { style ->
                // Map loaded and rendering street-level vector data offline
            }
        }
    }
}
```

---

## 2. iOS (Native Swift)

### Step 1: Add File to Xcode Project
Drag `addis_ababa.pmtiles` into your Xcode project and ensure **Copy items if needed** and your application target are checked.

### Step 2: Load via Bundle Path

```swift
import MapLibre

class ViewController: UIViewController {
    var mapView: MLNMapView!

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let tileUrl = Bundle.main.url(forResource: "addis_ababa", withExtension: "pmtiles") else {
            fatalError("PMTiles archive missing from main bundle")
        }

        mapView = MLNMapView(frame: view.bounds, styleURL: Bundle.main.url(forResource: "ethiopia-bilingual", withExtension: "json"))
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(mapView)
    }
}
```

---

## 3. Flutter (`maplibre_gl`)

### Step 1: Declare Asset in `pubspec.yaml`

```yaml
flutter:
  assets:
    - assets/tiles/addis_ababa.pmtiles
    - assets/styles/ethiopia-bilingual.json
```

### Step 2: Initialize Map

```dart
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

class OfflineMapScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: MapLibreMap(
        initialCameraPosition: CameraPosition(
          target: LatLng(9.01, 38.74), // Addis Ababa
          zoom: 12.0,
        ),
        styleString: "assets/styles/ethiopia-bilingual.json",
      ),
    );
  }
}
```

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
