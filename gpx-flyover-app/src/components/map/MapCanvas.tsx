import { MapLibreMap, type ErrorEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { setSessionEngine, setSessionMap, setSessionRecCanvas } from '../../app/flyoverSession';
import { setupRouteLayers, styleUrlFor } from '../../map/mapSetup';
import { PreviewEngine } from '../../preview/PreviewEngine';
import { getPrimaryTrack, useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { TextOverlayHandle } from './TextOverlayHandle';
import './mapCanvas.css';

// Monta MapLibre GL e ricrea mappa/percorso/PreviewEngine ogni volta che viene caricata una
// nuova traccia — esattamente come "1. Carica traccia sulla mappa" nell'originale, che
// distrugge la mappa precedente e ne crea una nuova (gpx-flyover.html:427-478).
export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const recCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const track = useProjectStore((s) => getPrimaryTrack(s)?.track ?? null);

  useEffect(() => {
    setSessionRecCanvas(recCanvasRef.current);
    return () => setSessionRecCanvas(null);
  }, []);

  useEffect(() => {
    if (!track || !containerRef.current) return;

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
      center: [track.pts[0].lon, track.pts[0].lat],
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
      const currentTrack = getPrimaryTrack(useProjectStore.getState())?.track;
      if (!currentTrack) return;
      try {
        setupRouteLayers(map, currentTrack, mapParams.maptilerToken);
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
            getTrack: () => getPrimaryTrack(useProjectStore.getState())!.track,
            getVideoParams: () => useProjectStore.getState().video,
            getCameraParams: () => useProjectStore.getState().camera,
            getVehicleParams: () => getPrimaryTrack(useProjectStore.getState())!.vehicle,
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
  }, [track]);

  return (
    <div className="map-canvas" ref={containerRef}>
      {!track && <span className="map-canvas__placeholder">Carica un file GPX per iniziare</span>}
      <canvas className="map-canvas__overlay" ref={overlayRef} />
      <canvas className="map-canvas__rec" ref={recCanvasRef} />
      <TextOverlayHandle containerRef={containerRef} />
    </div>
  );
}
