import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { MapStyleId, Track } from '../types/domain';

export function styleUrlFor(styleId: MapStyleId, customStyleUrl: string, token: string): string {
  const customUrl = customStyleUrl.trim();
  return customUrl || `https://api.maptiler.com/maps/${styleId}/style.json?key=${token}`;
}

// Aggiunge terrain 3D — chiamato una sola volta per mappa (non per traccia), nell'handler 'load'.
// Port 1:1 da gpx-flyover.html:446-456 (parte terreno/fog; il disegno del percorso è in
// setupRouteLayers, separata dalla Fase 5.3 per poter essere richiamata una volta per traccia).
export function setupTerrain(map: MapLibreMap, token: string): void {
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
}

// Sorgenti/layer del percorso per UNA traccia — id suffissati con layerKey (Fase 5.3, multi-
// traccia: chiamata una volta per ogni VehicleTrack caricata, con il proprio colore). Port 1:1 da
// gpx-flyover.html:457-468, parametrizzato.
export function setupRouteLayers(map: MapLibreMap, track: Track, layerKey: string, color: string): void {
  const geojson = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: track.pts.map((p) => [p.lon, p.lat, p.ele]),
    },
  };

  map.addSource(`route-${layerKey}`, { type: 'geojson', data: geojson });
  map.addSource(`routeDone-${layerKey}`, {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
  });

  map.addLayer({
    id: `route-full-${layerKey}`,
    type: 'line',
    source: `route-${layerKey}`,
    paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.35 },
  });
  map.addLayer({
    id: `route-done-${layerKey}`,
    type: 'line',
    source: `routeDone-${layerKey}`,
    paint: { 'line-color': color, 'line-width': 4 },
  });
}

// Aggiorna il colore dei layer di una traccia già disegnata, senza ricreare mappa/sorgenti —
// usato quando l'utente cambia il colore icona di una traccia (Fase 5.3: il colore del percorso
// segue quello dell'icona).
export function setRouteColor(map: MapLibreMap, layerKey: string, color: string): void {
  if (map.getLayer(`route-full-${layerKey}`)) map.setPaintProperty(`route-full-${layerKey}`, 'line-color', color);
  if (map.getLayer(`route-done-${layerKey}`)) map.setPaintProperty(`route-done-${layerKey}`, 'line-color', color);
}

// Port 1:1 da gpx-flyover.html:719, generalizzata: chi chiama prepara le coordinate (dal path
// ricampionato della principale, oppure dai punti sliced+interpolati di una secondaria) e indica
// per quale traccia (layerKey) aggiornare il tratto "già percorso".
export function updateRouteDoneUpTo(map: MapLibreMap, coords: Array<[number, number]>, layerKey: string): void {
  const doneSrc = map.getSource(`routeDone-${layerKey}`) as GeoJSONSource | undefined;
  if (doneSrc) {
    doneSrc.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
}
