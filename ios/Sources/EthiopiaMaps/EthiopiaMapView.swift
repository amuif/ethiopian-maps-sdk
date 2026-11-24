#if canImport(MapLibre)
import MapLibre

public extension MLNMapView {
    /// `try mapView.setEthiopiaStyle(pmtilesURL: "https://…/ethiopia.pmtiles", baseURL: "https://…")`
    func setEthiopiaStyle(pmtilesURL: String, baseURL: String, language: EthiopiaMapLanguage = .bilingual, terrainURL: String? = nil, buildingsURL: String? = nil) throws {
        styleURL = try EthiopiaMapStyle.fileURL(pmtilesURL: pmtilesURL, baseURL: baseURL, language: language, terrainURL: terrainURL, buildingsURL: buildingsURL)
    }
}
#endif
