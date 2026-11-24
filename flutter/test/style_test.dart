import 'dart:convert';
import 'dart:io';

import 'package:ethiopia_maps/src/style.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final bilingual = File('assets/styles/ethiopia-bilingual.json').readAsStringSync();
  List<Map<String, dynamic>> layers(Map s) => (s['layers'] as List).cast<Map<String, dynamic>>();

  test('fills placeholders', () {
    final s = jsonDecode(buildEthiopiaStyle(bilingual, pmtilesUrl: '/data/addis.pmtiles', baseUrl: 'https://cdn.x/'));
    expect(s['sources']['openmaptiles']['url'], 'pmtiles://file:///data/addis.pmtiles');
    expect(s['glyphs'], 'https://cdn.x/glyphs/{fontstack}/{range}.pbf');
  });

  test('adds footprints and hillshade', () {
    final s = jsonDecode(buildEthiopiaStyle(bilingual, pmtilesUrl: 'https://x/e.pmtiles', baseUrl: 'https://x', terrainUrl: '/t.pmtiles', buildingsUrl: 'https://x/b.pmtiles'));
    final ids = layers(s).map((l) => l['id']).toList();
    expect(ids.indexOf('building-footprints'), ids.indexOf('building') + 1);
    expect(ids.indexOf('building-3d-footprints'), ids.indexOf('building-3d') + 1);
    final firstLine = layers(s).indexWhere((l) => const ['line', 'symbol', 'fill-extrusion'].contains(l['type']));
    expect(ids[firstLine - 1], 'hillshade');
    expect(s.containsKey('terrain'), isFalse);
  });

  test('rejects relative paths', () {
    expect(() => buildEthiopiaStyle(bilingual, pmtilesUrl: 'addis.pmtiles', baseUrl: 'https://x'), throwsArgumentError);
  });
}
