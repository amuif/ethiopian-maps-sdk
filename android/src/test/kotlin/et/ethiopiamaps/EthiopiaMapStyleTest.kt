package et.ethiopiamaps

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File

class EthiopiaMapStyleTest {
    private val bilingual = File("src/main/assets/ethiopiamaps/ethiopia-bilingual.json").readText()

    @Test fun fillsPlaceholders() {
        val s = JSONObject(EthiopiaMapStyle.build(bilingual, "/data/app/addis.pmtiles", "https://cdn.x/"))
        assertEquals("pmtiles://file:///data/app/addis.pmtiles", s.getJSONObject("sources").getJSONObject("openmaptiles").getString("url"))
        assertEquals("https://cdn.x/glyphs/{fontstack}/{range}.pbf", s.getString("glyphs"))
        assertFalse(s.toString().contains("{BASE_URL}"))
    }

    @Test fun addsFootprintsAndHillshade() {
        val s = JSONObject(EthiopiaMapStyle.build(bilingual, "asset://t.pmtiles", "asset://map", "/t.pmtiles", "https://x/b.pmtiles"))
        val ids = (0 until s.getJSONArray("layers").length()).map { s.getJSONArray("layers").getJSONObject(it).getString("id") }
        assertEquals(ids.indexOf("building") + 1, ids.indexOf("building-footprints"))
        assertEquals(ids.indexOf("building-3d") + 1, ids.indexOf("building-3d-footprints"))
        val firstLine = (0 until ids.size).first { s.getJSONArray("layers").getJSONObject(it).getString("type") in setOf("line", "symbol", "fill-extrusion") }
        assertEquals("hillshade", ids[firstLine - 1])
        assertEquals("pmtiles://file:///t.pmtiles", s.getJSONObject("sources").getJSONObject("terrain").getString("url"))
        assertFalse(s.has("terrain")) // no 3D mesh on native
    }

    @Test(expected = IllegalArgumentException::class) fun rejectsRelativePaths() {
        EthiopiaMapStyle.build(bilingual, "addis.pmtiles", "https://cdn.x")
    }
}
