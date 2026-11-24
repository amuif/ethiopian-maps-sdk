import Foundation

/// Bundled styles; JSON copied from /styles by tools/sync-native-styles.sh
public enum EthiopiaMapLanguage: String {
    case bilingual = "ethiopia-bilingual"
    case amharic = "ethiopia-amharic"
}

public enum EthiopiaMapStyleError: Error, Equatable {
    case badURL(name: String, value: String)
    case missingStyle(String)
}

/// Port of @ethiopiamaps/react-native createNativeStyle: fills the style placeholders and adds optional terrain and footprints.
public enum EthiopiaMapStyle {
    // MapLibre Native needs a scheme; bare paths are the usual mistake
    static func url(_ name: String, _ u: String) throws -> String {
        let s = u.hasPrefix("/") ? "file://\(u)" : u
        guard s.range(of: "^(https?|file)://", options: .regularExpression) != nil else { throw EthiopiaMapStyleError.badURL(name: name, value: u) }
        return s
    }

    /// - Parameters:
    ///   - styleJSON: one of the bundled styles (see `load`)
    ///   - pmtilesURL: `https://…/ethiopia.pmtiles`, or a file URL / absolute path for offline
    ///   - baseURL: folder with `glyphs/` and `sprites/` (local for full offline)
    ///   - terrainURL: optional terrain.pmtiles, drawn as hillshade
    ///   - buildingsURL: optional buildings.pmtiles with footprints OSM lacks
    public static func build(styleJSON: String, pmtilesURL: String, baseURL: String, terrainURL: String? = nil, buildingsURL: String? = nil) throws -> Data {
        var base = try url("baseURL", baseURL)
        while base.hasSuffix("/") { base.removeLast() }
        let text = styleJSON.replacingOccurrences(of: "{BASE_URL}", with: base).replacingOccurrences(of: "{PMTILES_URL}", with: try url("pmtilesURL", pmtilesURL))
        var style = try JSONSerialization.jsonObject(with: Data(text.utf8)) as! [String: Any]
        var sources = style["sources"] as! [String: Any]
        var layers = style["layers"] as! [[String: Any]]

        if let b = buildingsURL {
            sources["buildings"] = ["type": "vector", "url": "pmtiles://\(try url("buildingsURL", b))", "attribution": "© Overture Maps Foundation (Microsoft, Google, Esri)"]
            // Clone each OSM building layer right after itself so draw order and paint stay identical
            layers = layers.flatMap { l -> [[String: Any]] in
                guard l["source-layer"] as? String == "building" else { return [l] }
                var copy = l
                copy["id"] = "\(l["id"] as! String)-footprints"
                copy["source"] = "buildings"
                return [l, copy]
            }
        }

        if let t = terrainURL {
            sources["terrain"] = ["type": "raster-dem", "url": "pmtiles://\(try url("terrainURL", t))", "tileSize": 512, "encoding": "mapbox",
                                  "attribution": "Copernicus GLO-30 © DLR e.V., © Airbus DS, provided under COPERNICUS by the EU and ESA"]
            // shortcut: hillshade only, like React Native; add a terrain mesh when MapLibre Native ships one
            let at = layers.firstIndex { ["line", "symbol", "fill-extrusion"].contains($0["type"] as? String ?? "") } ?? layers.count
            layers.insert(["id": "hillshade", "type": "hillshade", "source": "terrain",
                           "paint": ["hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#5a5a5a"]], at: at)
        }

        style["sources"] = sources
        style["layers"] = layers
        return try JSONSerialization.data(withJSONObject: style)
    }

    public static func load(pmtilesURL: String, baseURL: String, language: EthiopiaMapLanguage = .bilingual, terrainURL: String? = nil, buildingsURL: String? = nil) throws -> Data {
        guard let file = Bundle.module.url(forResource: language.rawValue, withExtension: "json", subdirectory: "Resources") else { throw EthiopiaMapStyleError.missingStyle(language.rawValue) }
        return try build(styleJSON: String(contentsOf: file, encoding: .utf8), pmtilesURL: pmtilesURL, baseURL: baseURL, terrainURL: terrainURL, buildingsURL: buildingsURL)
    }

    /// MLNMapView takes a style URL, not JSON, so the filled style is written to Caches and its file URL returned.
    public static func fileURL(pmtilesURL: String, baseURL: String, language: EthiopiaMapLanguage = .bilingual, terrainURL: String? = nil, buildingsURL: String? = nil) throws -> URL {
        let data = try load(pmtilesURL: pmtilesURL, baseURL: baseURL, language: language, terrainURL: terrainURL, buildingsURL: buildingsURL)
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        // Name follows content (FNV-1a; hashValue is reseeded per launch) so MapLibre reloads on change and files don't pile up
        let hash = data.reduce(UInt64(0xcbf29ce484222325)) { ($0 ^ UInt64($1)) &* 0x100000001b3 }
        let out = dir.appendingPathComponent("ethiopiamaps-\(String(hash, radix: 16)).json")
        try data.write(to: out, options: .atomic)
        return out
    }
}
