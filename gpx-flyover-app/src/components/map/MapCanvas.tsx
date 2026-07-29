import { useRef } from 'react';
import './mapCanvas.css';

// Placeholder: il mount di MapLibre GL (stile MapTiler + token) arriva in fase 2,
// insieme al parsing GPX che alimenta la sorgente GeoJSON del percorso.
export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="map-canvas" ref={containerRef}>
      <span className="map-canvas__placeholder">Mappa (MapLibre GL) — in arrivo</span>
    </div>
  );
}
