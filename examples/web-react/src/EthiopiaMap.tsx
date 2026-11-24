import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';
import { addBuildings } from '@ethiopiamaps/adapter/style';

export interface CityConfig {
  id: string;
  name: string;
  am: string;
  center: [number, number];
  zoom: number;
}

export const CITIES: readonly CityConfig[] = [
  { id: 'ethiopia', name: 'Ethiopia', am: 'ኢትዮጵያ', center: [39.78, 9.14], zoom: 6 },
  { id: 'addis_ababa', name: 'Addis Ababa', am: 'አዲስ አበባ', center: [38.74, 9.01], zoom: 12 },
  { id: 'dire_dawa', name: 'Dire Dawa', am: 'ድሬዳዋ', center: [41.86, 9.59], zoom: 12 },
  { id: 'hawassa', name: 'Hawassa', am: 'ሀዋሳ', center: [38.48, 7.05], zoom: 12 },
  { id: 'bahir_dar', name: 'Bahir Dar', am: 'ባሕር ዳር', center: [37.39, 11.59], zoom: 12 },
  { id: 'gondar', name: 'Gondar', am: 'ጎንደር', center: [37.46, 12.60], zoom: 12 },
  { id: 'mekelle', name: 'Mekelle', am: 'መቐለ', center: [39.47, 13.50], zoom: 12 },
  { id: 'adama', name: 'Adama', am: 'አዳማ', center: [39.27, 8.54], zoom: 12 }
];

export interface MapMoveEvent {
  center: [number, number];
  zoom: number;
}

export interface EthiopiaMapProps {
  styleType?: 'bilingual' | 'amharic';
  selectedCity?: string;
  onMapMove?: (event: MapMoveEvent) => void;
}

export default function EthiopiaMap({
  styleType = 'bilingual',
  selectedCity = 'addis_ababa',
  onMapMove
}: EthiopiaMapProps): React.JSX.Element {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // 1. Initialize PMTiles protocol once
  useEffect(() => {
    const protocol = new pmtiles.Protocol();
    try {
      maplibregl.addProtocol('pmtiles', protocol.tile);
    } catch {
      // Protocol already registered in global scope
    }
  }, []);

  // 2. Initialize and configure MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    const baseUrl = window.location.origin;
    const styleFilename = styleType === 'amharic' ? 'ethiopia-amharic.json' : 'ethiopia-bilingual.json';
    const stylePath = `/styles/${styleFilename}`;
    const pmtilesUrl = `${baseUrl}/dist/ethiopia.pmtiles`;

    async function loadMap(): Promise<void> {
      try {
        const res = await fetch(stylePath);
        const styleJson: Record<string, unknown> = await res.json();

        // Parameterize placeholders
        const parameterized = JSON.stringify(styleJson)
          .replace(/\{BASE_URL\}/g, baseUrl)
          .replace(/\{PMTILES_URL\}/g, pmtilesUrl);

        // Extra Microsoft/Google footprints (pipeline/scripts/build-buildings.sh) when dist/buildings.pmtiles exists
        const buildingsUrl = `${baseUrl}/dist/buildings.pmtiles`;
        const hasBuildings = await fetch(buildingsUrl, { method: 'HEAD' }).then((r) => r.ok, () => false);
        let style: Record<string, any> = JSON.parse(parameterized);
        if (hasBuildings) style = addBuildings(style, { url: buildingsUrl });

        const initialCity = CITIES.find((c) => c.id === selectedCity) ?? CITIES[1];

        const map = new maplibregl.Map({
          container: mapContainer.current!,
          style: style as maplibregl.StyleSpecification,
          center: initialCity.center,
          zoom: initialCity.zoom,
          hash: true
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        map.on('load', () => {
          setMapLoaded(true);
        });

        const emitMove = () => {
          const center = map.getCenter();
          onMapMove?.({ center: [center.lng, center.lat], zoom: map.getZoom() });
        };
        map.on('move', emitMove);
        emitMove(); // URL hash may start the map somewhere other than the city default

        mapInstance.current = map;
      } catch (err) {
        console.error('Failed to load map style:', err);
      }
    }

    loadMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [styleType]);

  // 3. React to city selection changes
  useEffect(() => {
    if (!mapInstance.current) return;
    const city = CITIES.find((c) => c.id === selectedCity);
    if (city) {
      mapInstance.current.flyTo({
        center: city.center,
        zoom: city.zoom,
        essential: true,
        speed: 1.2
      });
    }
  }, [selectedCity]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {!mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 600
          }}
        >
          {styleType === 'amharic' ? 'ካርታ በመጫን ላይ…' : 'Loading map…'}
        </div>
      )}
    </div>
  );
}
