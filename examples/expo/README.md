# Expo example

One-screen app using `@ethiopiamaps/react-native`, streaming tiles from the repo's dev server, with an English/Amharic toggle.

MapLibre is a native module, so this needs a dev build (Expo Go won't work).

```bash
# 1. At the repo root: serve dist/ethiopia.pmtiles, glyphs and sprites on port 3000
pnpm serve

# 2. In examples/expo: build the SDK, generate native projects, install on device/emulator
pnpm android        # or: pnpm ios
```

The app reads tiles from `EXPO_PUBLIC_TILES_URL`, which defaults to `http://10.0.2.2:3000` (the host as seen from the Android emulator). For a physical phone or the iOS simulator, set it to your machine's LAN address:

```bash
EXPO_PUBLIC_TILES_URL=http://192.168.1.20:3000 pnpm android
```

Plain `http://` only works in debug builds. Use HTTPS hosting for release builds (see `docs/hosting-guide.md`).
