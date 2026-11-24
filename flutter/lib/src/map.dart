import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:maplibre_gl/maplibre_gl.dart';

import 'style.dart';

/// MapLibreMap with the Ethiopian style filled in. Defaults to Addis Ababa.
class EthiopiaMap extends StatefulWidget {
  const EthiopiaMap({
    super.key,
    required this.pmtilesUrl,
    required this.baseUrl,
    this.language = EthiopiaMapLanguage.bilingual,
    this.terrainUrl,
    this.buildingsUrl,
    this.initialCameraPosition = const CameraPosition(target: LatLng(9.01, 38.74), zoom: 12),
    this.onMapCreated,
    this.onStyleLoadedCallback,
  });

  /// `https://…/ethiopia.pmtiles` to stream, or a device path / `file://` URL for offline
  final String pmtilesUrl;

  /// Folder holding `glyphs/` and `sprites/` (local for full offline)
  final String baseUrl;
  final EthiopiaMapLanguage language;

  /// Optional terrain.pmtiles, drawn as hillshade
  final String? terrainUrl;

  /// Optional buildings.pmtiles with footprints OSM lacks
  final String? buildingsUrl;
  final CameraPosition initialCameraPosition;
  final MapCreatedCallback? onMapCreated;
  final OnStyleLoadedCallback? onStyleLoadedCallback;

  @override
  State<EthiopiaMap> createState() => _EthiopiaMapState();
}

class _EthiopiaMapState extends State<EthiopiaMap> {
  late Future<String> _style;

  Future<String> _load() async => buildEthiopiaStyle(
        await rootBundle.loadString(widget.language.asset),
        pmtilesUrl: widget.pmtilesUrl,
        baseUrl: widget.baseUrl,
        terrainUrl: widget.terrainUrl,
        buildingsUrl: widget.buildingsUrl,
      );

  @override
  void initState() {
    super.initState();
    _style = _load();
  }

  @override
  void didUpdateWidget(EthiopiaMap old) {
    super.didUpdateWidget(old);
    if (old.pmtilesUrl != widget.pmtilesUrl || old.baseUrl != widget.baseUrl || old.language != widget.language ||
        old.terrainUrl != widget.terrainUrl || old.buildingsUrl != widget.buildingsUrl) {
      _style = _load();
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<String>(
        future: _style,
        builder: (context, snap) {
          if (snap.hasError) throw snap.error!; // bad URL: surface it, don't show a blank map
          if (!snap.hasData) return const SizedBox.expand();
          return Stack(children: [
            MapLibreMap(
              styleString: snap.data!,
              initialCameraPosition: widget.initialCameraPosition,
              onMapCreated: widget.onMapCreated,
              onStyleLoadedCallback: widget.onStyleLoadedCallback,
            ),
            // ODbL requires visible OSM credit; not left to the attribution button
            const Positioned(
              right: 4,
              bottom: 4,
              child: Text('© OpenStreetMap contributors', style: TextStyle(fontSize: 10)),
            ),
          ]);
        },
      );
}
