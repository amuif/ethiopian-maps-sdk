import 'dart:convert';

/// Bundled styles; JSON copied from /styles by tools/sync-native-styles.sh
enum EthiopiaMapLanguage {
  bilingual('ethiopia-bilingual'),
  amharic('ethiopia-amharic');

  const EthiopiaMapLanguage(this.file);
  final String file;
  String get asset => 'packages/ethiopia_maps/assets/styles/$file.json';
}

// MapLibre Native needs a scheme; bare paths are the usual mistake
String _url(String name, String u) {
  final s = u.startsWith('/') ? 'file://$u' : u;
  if (!RegExp(r'^(https?|file)://').hasMatch(s)) {
    throw ArgumentError.value(u, name, 'must be http(s)://, file:// or an absolute path');
  }
  return s;
}

/// Port of @ethiopiamaps/react-native createNativeStyle: fills the style placeholders and adds optional terrain and footprints.
/// Returns style JSON for `MapLibreMap(styleString: ...)`.
String buildEthiopiaStyle(String styleJson, {required String pmtilesUrl, required String baseUrl, String? terrainUrl, String? buildingsUrl}) {
  final base = _url('baseUrl', baseUrl).replaceFirst(RegExp(r'/+$'), '');
  final style = jsonDecode(styleJson.replaceAll('{BASE_URL}', base).replaceAll('{PMTILES_URL}', _url('pmtilesUrl', pmtilesUrl))) as Map<String, dynamic>;
  final sources = style['sources'] as Map<String, dynamic>;
  var layers = (style['layers'] as List).cast<Map<String, dynamic>>();

  if (buildingsUrl != null) {
    sources['buildings'] = {'type': 'vector', 'url': 'pmtiles://${_url('buildingsUrl', buildingsUrl)}', 'attribution': '© Overture Maps Foundation (Microsoft, Google, Esri)'};
    // Clone each OSM building layer right after itself so draw order and paint stay identical
    layers = [
      for (final l in layers) ...[
        l,
        if (l['source-layer'] == 'building') {...l, 'id': '${l['id']}-footprints', 'source': 'buildings'},
      ],
    ];
  }

  if (terrainUrl != null) {
    sources['terrain'] = {
      'type': 'raster-dem', 'url': 'pmtiles://${_url('terrainUrl', terrainUrl)}', 'tileSize': 512, 'encoding': 'mapbox',
      'attribution': 'Copernicus GLO-30 © DLR e.V., © Airbus DS, provided under COPERNICUS by the EU and ESA',
    };
    // shortcut: hillshade only, like React Native; add a terrain mesh when MapLibre Native ships one
    final at = layers.indexWhere((l) => const ['line', 'symbol', 'fill-extrusion'].contains(l['type']));
    layers.insert(at < 0 ? layers.length : at, {
      'id': 'hillshade', 'type': 'hillshade', 'source': 'terrain',
      'paint': {'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5a5a5a'},
    });
  }

  style['layers'] = layers;
  return jsonEncode(style);
}
