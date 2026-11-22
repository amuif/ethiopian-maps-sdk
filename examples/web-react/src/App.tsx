import React, { useState } from 'react';
import EthiopiaMap, { CITIES, MapMoveEvent } from './EthiopiaMap';

export default function App(): React.JSX.Element {
  const [selectedCity, setSelectedCity] = useState<string>('addis_ababa');
  const [styleType, setStyleType] = useState<'bilingual' | 'amharic'>('bilingual');
  const [mapState, setMapState] = useState<MapMoveEvent>({
    center: [38.74, 9.01],
    zoom: 12
  });

  return (
    <div className="app-container">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Ethiopian Maps</h1>
            <p>Open-source SDK</p>
          </div>
        </div>

        <span className="divider" aria-hidden="true" />

        <label className="city-picker">
          <span className="visually-hidden">City</span>
          <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
            {CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {styleType === 'amharic' ? city.am : city.name}
              </option>
            ))}
          </select>
        </label>

        <div className="lang-toggle" role="group" aria-label="Map language">
          <button type="button" aria-pressed={styleType === 'bilingual'} onClick={() => setStyleType('bilingual')}>
            English
          </button>
          <button type="button" aria-pressed={styleType === 'amharic'} onClick={() => setStyleType('amharic')} lang="am">
            አማርኛ
          </button>
        </div>
      </header>

      {/* Main Map View */}
      <main className="map-wrapper">
        <EthiopiaMap
          styleType={styleType}
          selectedCity={selectedCity}
          onMapMove={setMapState}
        />

        {/* Floating telemetry panel */}
        <div className="telemetry-pill">
          <span>Lat: {mapState.center[1].toFixed(4)}</span>
          <span>Lon: {mapState.center[0].toFixed(4)}</span>
          <span>Zoom: {mapState.zoom.toFixed(1)}</span>
        </div>
      </main>
    </div>
  );
}
