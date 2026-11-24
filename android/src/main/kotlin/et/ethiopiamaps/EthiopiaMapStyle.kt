package et.ethiopiamaps

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style

/** Bundled styles; JSON copied from /styles by tools/sync-native-styles.sh */
enum class EthiopiaMapLanguage(internal val asset: String) {
    BILINGUAL("ethiopiamaps/ethiopia-bilingual.json"),
    AMHARIC("ethiopiamaps/ethiopia-amharic.json"),
}

/** Port of @ethiopiamaps/react-native createNativeStyle: fills the style placeholders and adds optional terrain and footprints. */
object EthiopiaMapStyle {
    // MapLibre Native needs a scheme; bare paths like /data/user/0/… are the usual mistake
    private fun url(name: String, u: String): String {
        val s = if (u.startsWith("/")) "file://$u" else u
        require(Regex("^(https?|file|asset)://").containsMatchIn(s)) { "ethiopiamaps: $name must be http(s)://, file://, asset:// or an absolute path, got \"$u\"" }
        return s
    }

    /**
     * @param styleJson one of the bundled styles (see [load])
     * @param pmtilesUrl `https://…/ethiopia.pmtiles`, `asset://tiles/addis_ababa.pmtiles`, or a device path
     * @param baseUrl folder with `glyphs/` and `sprites/` (local for full offline)
     * @param terrainUrl optional terrain.pmtiles, drawn as hillshade
     * @param buildingsUrl optional buildings.pmtiles with footprints OSM lacks
     */
    fun build(styleJson: String, pmtilesUrl: String, baseUrl: String, terrainUrl: String? = null, buildingsUrl: String? = null): String {
        val base = url("baseUrl", baseUrl).trimEnd('/')
        val style = JSONObject(styleJson.replace("{BASE_URL}", base).replace("{PMTILES_URL}", url("pmtilesUrl", pmtilesUrl)))
        val sources = style.getJSONObject("sources")
        var layers = style.getJSONArray("layers")

        if (buildingsUrl != null) {
            sources.put("buildings", JSONObject().put("type", "vector").put("url", "pmtiles://${url("buildingsUrl", buildingsUrl)}")
                .put("attribution", "© Overture Maps Foundation (Microsoft, Google, Esri)"))
            val out = JSONArray()
            for (i in 0 until layers.length()) {
                val l = layers.getJSONObject(i)
                out.put(l)
                // Clone each OSM building layer right after itself so draw order and paint stay identical
                if (l.optString("source-layer") == "building") out.put(JSONObject(l.toString()).put("id", "${l.getString("id")}-footprints").put("source", "buildings"))
            }
            layers = out
        }

        if (terrainUrl != null) {
            sources.put("terrain", JSONObject().put("type", "raster-dem").put("url", "pmtiles://${url("terrainUrl", terrainUrl)}")
                .put("tileSize", 512).put("encoding", "mapbox")
                .put("attribution", "Copernicus GLO-30 © DLR e.V., © Airbus DS, provided under COPERNICUS by the EU and ESA"))
            // shortcut: hillshade only, like React Native; add a terrain mesh when MapLibre Native ships one
            val hillshade = JSONObject().put("id", "hillshade").put("type", "hillshade").put("source", "terrain")
                .put("paint", JSONObject().put("hillshade-exaggeration", 0.35).put("hillshade-shadow-color", "#5a5a5a"))
            val at = (0 until layers.length()).firstOrNull { layers.getJSONObject(it).optString("type") in setOf("line", "symbol", "fill-extrusion") } ?: layers.length()
            val out = JSONArray()
            for (i in 0 until layers.length()) {
                if (i == at) out.put(hillshade)
                out.put(layers.get(i))
            }
            if (at == layers.length()) out.put(hillshade)
            layers = out
        }

        style.put("layers", layers)
        return style.toString()
    }

    fun load(context: Context, pmtilesUrl: String, baseUrl: String, language: EthiopiaMapLanguage = EthiopiaMapLanguage.BILINGUAL,
             terrainUrl: String? = null, buildingsUrl: String? = null): String =
        build(context.assets.open(language.asset).bufferedReader().use { it.readText() }, pmtilesUrl, baseUrl, terrainUrl, buildingsUrl)
}

/** `map.setEthiopiaStyle(context, "https://…/ethiopia.pmtiles", "https://…") { style -> }` */
fun MapLibreMap.setEthiopiaStyle(context: Context, pmtilesUrl: String, baseUrl: String, language: EthiopiaMapLanguage = EthiopiaMapLanguage.BILINGUAL,
                                 terrainUrl: String? = null, buildingsUrl: String? = null, onLoaded: Style.OnStyleLoaded? = null) =
    setStyle(Style.Builder().fromJson(EthiopiaMapStyle.load(context, pmtilesUrl, baseUrl, language, terrainUrl, buildingsUrl)), onLoaded)
