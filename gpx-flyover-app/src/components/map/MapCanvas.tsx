import { MapLibreMap, type ErrorEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { setSessionEngine, setSessionMap, setSessionRecCanvas } from '../../app/flyoverSession';
import { setRouteColor, setupRouteLayers, setupTerrain, styleUrlFor } from '../../map/mapSetup';
import { PreviewEngine } from '../../preview/PreviewEngine';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { effectiveRouteColor } from '../../vehicle/routeColor';
import { LiveStatsBoxHandle } from './LiveStatsBoxHandle';
import { TextOverlayHandle } from './TextOverlayHandle';
import './mapCanvas.css';

// Monta MapLibre GL e ricrea mappa/percorsi/PreviewEngine ogni volta che cambia l'INSIEME delle
// tracce caricate (aggiunta/rimozione) — esattamente come "1. Carica traccia sulla mappa"
// nell'originale, che distrugge la mappa precedente e ne crea una nuova
// (gpx-flyover.html:427-478), esteso in Fase 5.3 a disegnare un percorso per ciascuna traccia.
// Non si ricrea per un semplice cambio di colore/icona (vedi effect leggero più sotto).
export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const recCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const tracks = useProjectStore((s) => s.tracks);
  const trackIdsKey = tracks.map((t) => t.id).join(',');

  useEffect(() => {
    setSessionRecCanvas(recCanvasRef.current);
    return () => setSessionRecCanvas(null);
  }, []);

  useEffect(() => {
    const currentTracks = useProjectStore.getState().tracks;
    const primary = currentTracks.find((t) => t.isPrimary);
    if (!primary || !containerRef.current) return;

    usePlaybackStore.getState().setIsPlaying(false);
    usePlaybackStore.getState().setCanPreview(false);
    setSessionEngine(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const { map: mapParams, camera } = useProjectStore.getState();
    const styleUrl = styleUrlFor(mapParams.styleId, mapParams.customStyleUrl, mapParams.maptilerToken);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: [primary.track.pts[0].lon, primary.track.pts[0].lat],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: 0,
      maxPitch: 85,
      // preserveDrawingBuffer è necessario per catturare i frame dal canvas in registrazione
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
    });
    mapInstanceRef.current = map;
    setSessionMap(map);

    map.on('error', (e: ErrorEvent) => {
      console.error('MapLibre GL error:', e);
      usePlaybackStore.getState().setStatusMessage(`Errore mappa: ${e.error?.message ?? 'errore sconosciuto'}`);
    });

    // In MapLibre v6 lo stile può risultare già completamente caricato (map.loaded() === true)
    // nello stesso tick sincrono in cui viene registrato questo listener (specialmente con
    // stili/tile già in cache) — un semplice map.on('load', ...) può quindi non scattare mai
    // perché l'evento è già stato emesso prima che il listener venisse collegato. Pattern
    // sicuro contro questa race condition: eseguire subito se già pronta, altrimenti attendere
    // l'evento una tantum.
    const onStyleReady = () => {
      const nowTracks = useProjectStore.getState().tracks;
      if (nowTracks.length === 0) return;
      try {
        setupTerrain(map, mapParams.maptilerToken);
        for (const t of nowTracks) {
          setupRouteLayers(map, t.track, String(t.id), effectiveRouteColor(t, nowTracks.length));
        }
        usePlaybackStore.getState().setStatusMessage('Traccia caricata. Premi Anteprima o Registra.');
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        usePlaybackStore
          .getState()
          .setStatusMessage(`Errore durante il disegno del percorso: ${message} (i pulsanti restano comunque attivi)`);
      } finally {
        usePlaybackStore.getState().setCanPreview(true);
        if (overlayRef.current) {
          const engine = new PreviewEngine({
            map,
            overlayCanvas: overlayRef.current,
            getTracks: () => useProjectStore.getState().tracks,
            getVideoParams: () => useProjectStore.getState().video,
            getCameraParams: () => useProjectStore.getState().camera,
            getTitle: () => useProjectStore.getState().title,
            getMusicTracks: () => useProjectStore.getState().musicTracks,
            getPhotoClips: () => useProjectStore.getState().photoClips,
            getTextOverlays: () => useProjectStore.getState().textOverlays,
            onTick: (info) => usePlaybackStore.getState().setTick(info),
            onEnded: () => usePlaybackStore.getState().setIsPlaying(false),
          });
          setSessionEngine(engine);
        }
      }
    };

    if (map.loaded()) {
      onStyleReady();
    } else {
      map.once('load', onStyleReady);
    }

    return () => {
      setSessionEngine(null);
      map.remove();
      if (mapInstanceRef.current === map) mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIdsKey]);

  // Ritinteggia i layer del percorso quando cambia il colore icona di una traccia (o il numero
  // di tracce, che decide se la principale resta gialla fissa) — senza ricreare la mappa.
  const routeColorsKey = tracks.map((t) => `${t.id}:${effectiveRouteColor(t, tracks.length)}`).join(',');
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    for (const t of tracks) {
      setRouteColor(map, String(t.id), effectiveRouteColor(t, tracks.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeColorsKey]);

  return (
    <div className="map-canvas" ref={containerRef}>
      {tracks.length === 0 && <span className="map-canvas__placeholder">Carica un file GPX per iniziare</span>}
      <canvas className="map-canvas__overlay" ref={overlayRef} />
      <canvas className="map-canvas__rec" ref={recCanvasRef} />
      <TextOverlayHandle containerRef={containerRef} />
      <LiveStatsBoxHandle containerRef={containerRef} />
    </div>
  );
}
