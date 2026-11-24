#!/usr/bin/env bash
# Copies the two styles into the Android, iOS and Flutter SDKs; --check fails if any copy is stale.
set -euo pipefail
cd "$(dirname "$0")/.."
DESTS=(android/src/main/assets/ethiopiamaps ios/Sources/EthiopiaMaps/Resources flutter/assets/styles)
for d in "${DESTS[@]}"; do
  for f in ethiopia-bilingual.json ethiopia-amharic.json; do
    if [ "${1:-}" = "--check" ]; then
      cmp -s "styles/$f" "$d/$f" || { echo "stale: $d/$f (run tools/sync-native-styles.sh)" >&2; exit 1; }
    else
      mkdir -p "$d" && cp "styles/$f" "$d/$f"
    fi
  done
done
