import XCTest
@testable import EthiopiaMaps

final class EthiopiaMapStyleTests: XCTestCase {
    private func style(_ pm: String, _ base: String, terrain: String? = nil, buildings: String? = nil) throws -> [String: Any] {
        let data = try EthiopiaMapStyle.load(pmtilesURL: pm, baseURL: base, terrainURL: terrain, buildingsURL: buildings)
        return try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }

    func testFillsPlaceholders() throws {
        let s = try style("/var/app/addis.pmtiles", "https://cdn.x/")
        let omt = (s["sources"] as! [String: Any])["openmaptiles"] as! [String: Any]
        XCTAssertEqual(omt["url"] as? String, "pmtiles://file:///var/app/addis.pmtiles")
        XCTAssertEqual(s["glyphs"] as? String, "https://cdn.x/glyphs/{fontstack}/{range}.pbf")
    }

    func testAddsFootprintsAndHillshade() throws {
        let s = try style("https://x/e.pmtiles", "https://x", terrain: "/t.pmtiles", buildings: "https://x/b.pmtiles")
        let layers = s["layers"] as! [[String: Any]]
        let ids = layers.map { $0["id"] as! String }
        XCTAssertEqual(ids.firstIndex(of: "building")! + 1, ids.firstIndex(of: "building-footprints"))
        XCTAssertEqual(ids.firstIndex(of: "building-3d")! + 1, ids.firstIndex(of: "building-3d-footprints"))
        let firstLine = layers.firstIndex { ["line", "symbol", "fill-extrusion"].contains($0["type"] as! String) }!
        XCTAssertEqual(ids[firstLine - 1], "hillshade")
        XCTAssertNil(s["terrain"])
    }

    func testRejectsRelativePaths() {
        XCTAssertThrowsError(try style("addis.pmtiles", "https://x")) { XCTAssertEqual($0 as? EthiopiaMapStyleError, .badURL(name: "pmtilesURL", value: "addis.pmtiles")) }
    }
}
