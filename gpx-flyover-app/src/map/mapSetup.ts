import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { MapStyleId, PathPoint, Track } from '../types/domain';

export function styleUrlFor(styleId: MapStyleId, customStyleUrl: string, token: string): string {
  const customUrl = customStyleUrl.trim();
  return customUrl || `https://api.maptiler.com/maps/${styleId}/style.json?key=${token}`;
}

// Aggiunge terrain, sorgenti e layer del percorso — chiamata nell'handler 'load' della mappa.
// Port 1:1 da gpx-flyover.html:446-468 (parte di disegno; le sole due righe di stato UI
// bottoni/status restano nel chiamante React).
export function setupRouteLayers(map: MapLibreMap, track: Track, token: string): void {
  map.addSource('mapbox-dem', {
    type: 'raster-dem',
    url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${token}`,
    encoding: 'mapbox',
    tileSize: 512,
    maxzoom: 14,
  });
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });
  // setFog non esiste più nei tipi di questa versione di MapLibre GL JS (era già protetto da
  // try/catch nell'originale in previsione di versioni senza questo metodo); accesso
  // difensivo via cast per preservare lo stesso comportamento a runtime.
  try {
    (map as unknown as { setFog?: (options: Record<string, unknown>) => void }).setFog?.({});
  } catch (fogErr) {
    console.warn('setFog non disponibile, continuo senza:', fogErr);
  }

  const geojson = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: track.pts.map((p) => [p.lon, p.lat, p.ele]),
    },
  };
  map.addSource('route', { type: 'geojson', data: geojson });
  map.addSource('routeDone', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
  });

  map.addLayer({
    id: 'route-full',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#ffcc00', 'line-width': 2, 'line-opacity': 0.35 },
  });
  map.addLayer({
    id: 'route-done',
    type: 'line',
    source: 'routeDone',
    paint: { 'line-color': '#ffcc00', 'line-width': 4 },
  });
}

// Port 1:1 da gpx-flyover.html:719.
export function updateRouteDoneUpTo(map: MapLibreMap, path: PathPoint[], i: number): void {
  const doneSrc = map.getSource('routeDone') as GeoJSONSource | undefined;
  if (doneSrc) {
    doneSrc.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: path.slice(0, i + 1).map((pt) => [pt.lon, pt.lat]) },
    });
  }
}
