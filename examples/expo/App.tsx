import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { EthiopiaMap, STYLES } from '@ethiopiamaps/react-native';

// Your machine's LAN address running `pnpm serve` at the repo root (localhost is the phone itself).
const BASE = process.env.EXPO_PUBLIC_TILES_URL ?? 'http://10.0.2.2:3000'; // 10.0.2.2 = host from Android emulator

const LABELS = { bilingual: 'English', amharic: 'አማርኛ' } as const;

export default function App() {
  const [language, setLanguage] = useState<keyof typeof STYLES>('bilingual');

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <EthiopiaMap pmtilesUrl={`${BASE}/dist/ethiopia.pmtiles`} baseUrl={BASE} language={language} />
      <View style={styles.toggle} accessibilityRole="radiogroup" accessibilityLabel="Map language">
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((id) => (
          <Pressable
            key={id}
            onPress={() => setLanguage(id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: language === id }}
            style={[styles.button, language === id && styles.active]}
          >
            <Text style={[styles.label, language === id && styles.activeLabel]}>{LABELS[id]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toggle: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, minWidth: 44 },
  active: { backgroundColor: '#1f6f4a' },
  label: { fontSize: 15, color: '#222' },
  activeLabel: { color: '#fff' },
});
