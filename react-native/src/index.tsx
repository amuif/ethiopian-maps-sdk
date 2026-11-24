import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Camera, Map, type InitialViewState, type MapProps } from '@maplibre/maplibre-react-native';
import bilingual from './styles/ethiopia-bilingual.json';
import amharic from './styles/ethiopia-amharic.json';
import { createNativeStyle } from './style';

export { createNativeStyle, type NativeStyleOptions } from './style';
export const STYLES = { bilingual, amharic };

export interface EthiopiaMapProps extends Omit<MapProps, 'mapStyle' | 'style'> {
  /** `https://…/ethiopia.pmtiles` to stream, or a local file path / `file://` URL for offline. */
  pmtilesUrl: string;
  /** Where `glyphs/` and `sprites/` live (http(s) or local folder; local is needed for full offline). */
  baseUrl: string;
  /** Optional terrain.pmtiles (remote or local) for shaded relief */
  terrainUrl?: string;
  /** Optional buildings.pmtiles with Microsoft/Google footprints OSM lacks */
  buildingsUrl?: string;
  language?: keyof typeof STYLES;
  initialViewState?: InitialViewState;
  style?: StyleProp<ViewStyle>;
}

const ADDIS: InitialViewState = { center: [38.74, 9.01], zoom: 12 };

export function EthiopiaMap({
  pmtilesUrl,
  baseUrl,
  terrainUrl,
  buildingsUrl,
  language = 'bilingual',
  initialViewState = ADDIS,
  style,
  children,
  ...mapProps
}: EthiopiaMapProps) {
  const mapStyle = useMemo(
    () => createNativeStyle({ pmtilesUrl, baseUrl, terrainUrl, buildingsUrl, styleJson: STYLES[language] }),
    [pmtilesUrl, baseUrl, terrainUrl, buildingsUrl, language]
  );
  return (
    <View style={[styles.fill, style]}>
      <Map style={styles.fill} mapStyle={mapStyle as MapProps['mapStyle']} {...mapProps}>
        <Camera initialViewState={initialViewState} />
        {children}
      </Map>
      {/* ODbL requires visible OSM credit; not left to the source metadata */}
      <Text style={styles.credit} accessibilityRole="text">
        © OpenStreetMap contributors
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  credit: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 4,
    fontSize: 10,
    color: '#333',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
