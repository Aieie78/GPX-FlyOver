import type { Map as MapLibreMap } from 'maplibre-gl';
import { buildAnimParams, cameraForFrame, initialBearing, stepBearing } from '../camera/camera';
import { resetMusicAnchor, stopMusicPreview, syncMusicPreview } from '../audio/musicEngine';
import { updateRouteDoneUpTo } from '../map/mapSetup';
import { computePathIndex } from '../timeline/timelineMath';
import { drawAltitudeLine, drawVehicleIcon, vehicleScreenPos } from '../vehicle/vehicleIcon';
import { drawPhotoCover, getActivePhotoLayers } from '../photos/photoEngine';
import { drawTextOverlay, getActiveTextOverlays } from '../text/textEngine';
import type {
  AnimParams,
  CameraParams,
  MusicTrack,
  PhotoClip,
  PlaybackSpeed,
  TextOverlay,
  Track,
  VehicleParams,
  VideoParams,
} from '../types/domain';

export interface PreviewTickInfo {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  currentTimeSec: number;
  totalTimeSec: number;
  isPlaying: boolean;
}

export interface PreviewEngineDeps {
  map: MapLibreMap;
  overlayCanvas: HTMLCanvasElement;
  getTrack: () => Track;
  getVideoParams: () => VideoParams;
  getCameraParams: () => CameraParams;
  getVehicleParams: () => VehicleParams;
  getTitle: () => string;
  getMusicTracks: () => MusicTrack[];
  getPhotoClips: () => PhotoClip[];
  getTextOverlays: () => TextOverlay[];
  onTick: (info: PreviewTickInfo) => void;
  onEnded: () => void;
}

interface PreviewState extends AnimParams {
  i: number;
  pathIndex: number;
  smoothBearing: number;
  playing: boolean;
  speed: PlaybackSpeed;
  lastTs: number | null;
}

// Motore dell'anteprima interattiva — equivalente all'oggetto `preview` + le funzioni
// startPreview/stopPreview/renderPreviewFrame/previewLoop/seekPreviewTo/onParamsChanged
// di gpx-flyover.html:1223-1409. I parametri (camera/video/mezzo) sono letti dal vivo tramite
// i getter passati nei deps ad ogni frame, così i controlli restano "live" durante l'anteprima
// esattamente come nell'originale (lettura diretta dal DOM ad ogni render).
export class PreviewEngine {
  private deps: PreviewEngineDeps;
  private overlayCtx: CanvasRenderingContext2D;
  private state: PreviewState | null = null;
  private rafHandle: number | null = null;
  private drawHandle: number | null = null;

  constructor(deps: PreviewEngineDeps) {
    this.deps = deps;
    this.overlayCtx = deps.overlayCanvas.getContext('2d')!;
  }

  get isRunning(): boolean {
    return this.state != null;
  }

  start(): void {
    this.stop();
    const p = this.buildParams();
    this.state = { ...p, i: 0, pathIndex: 0, smoothBearing: initialBearing(p), playing: true, speed: 1, lastTs: null };
    resetMusicAnchor(0);
    this.renderFrame(0);
    this.rafHandle = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
    if (this.drawHandle != null) cancelAnimationFrame(this.drawHandle);
    this.drawHandle = null;
    if (this.state) this.state.playing = false;
    this.overlayCtx.clearRect(0, 0, this.deps.overlayCanvas.width, this.deps.overlayCanvas.height);
    stopMusicPreview();
    this.state = null;
  }

  setPlaying(playing: boolean): void {
    const s = this.state;
    if (!s) return;
    s.playing = playing;
    if (playing) {
      s.lastTs = null;
      resetMusicAnchor(s.i / s.fps);
      this.rafHandle = requestAnimationFrame(this.loop);
    } else {
      stopMusicPreview();
    }
  }

  setSpeed(speed: PlaybackSpeed): void {
    if (this.state) this.state.speed = speed;
  }

  seekBy(deltaFrames: number): void {
    if (!this.state) return;
    this.seekTo(this.state.i + deltaFrames);
  }

  seekBySeconds(deltaSec: number): void {
    if (!this.state) return;
    this.seekBy(deltaSec * this.state.fps);
  }

  // riposiziona il player a un frame preciso, ricalcolando il filtro del bearing da zero
  // (necessario perché il filtro è incrementale e non "invertibile" tornando indietro)
  // Port 1:1 da gpx-flyover.html:1310.
  seekTo(idx: number): void {
    const s = this.state;
    if (!s) return;
    const clamped = Math.max(0, Math.min(s.totalFrames - 1, Math.round(idx)));
    const newPathIndex = computePathIndex(clamped / s.fps, s.totalFrames, s.fps, this.deps.getPhotoClips());
    let sb = initialBearing(s);
    for (let k = 1; k <= newPathIndex; k++) sb = stepBearing(sb, k, s);
    s.smoothBearing = sb;
    s.pathIndex = newPathIndex;
    s.i = clamped;
    s.lastTs = null;
    resetMusicAnchor(clamped / s.fps);
    this.renderFrame(clamped);
  }

  // ricostruisce i parametri dell'anteprima quando l'utente modifica pitch/zoom/orbit/durata/fps,
  // mantenendo la posizione attuale (in percentuale) e lo stato play/pausa.
  // Port 1:1 da gpx-flyover.html:1331 (onParamsChanged).
  onParamsChanged(): void {
    const s = this.state;
    if (!s) return;
    const progressFraction = s.totalFrames > 1 ? s.i / (s.totalFrames - 1) : 0;
    const wasPlaying = s.playing;
    const prevSpeed = s.speed;

    const p = this.buildParams();
    const newI = Math.max(0, Math.min(p.totalFrames - 1, Math.round(progressFraction * (p.totalFrames - 1))));
    const newPathIndex = computePathIndex(newI / p.fps, p.totalFrames, p.fps, this.deps.getPhotoClips());

    let sb = initialBearing(p);
    for (let k = 1; k <= newPathIndex; k++) sb = stepBearing(sb, k, p);

    this.state = {
      ...p,
      i: newI,
      pathIndex: newPathIndex,
      smoothBearing: sb,
      playing: wasPlaying,
      speed: prevSpeed,
      lastTs: null,
    };
    resetMusicAnchor(newI / p.fps);
    this.renderFrame(newI);
  }

  // Ridisegna solo il frame corrente — usata quando cambiano icona/colore/stile/dimensione/quota
  // del mezzo, che non richiedono di ricostruire l'intero AnimParams (gpx-flyover.html:1405-1409).
  rerenderCurrentFrame(): void {
    if (this.state) this.renderFrame(this.state.i);
  }

  private buildParams(): AnimParams {
    return buildAnimParams(
      this.deps.getTrack(),
      this.deps.getVideoParams(),
      this.deps.getCameraParams(),
      this.deps.getTitle(),
    );
  }

  private loop = (ts: number): void => {
    const s = this.state;
    if (!s || !s.playing) return;
    if (s.lastTs == null) s.lastTs = ts;
    const dt = (ts - s.lastTs) / 1000;
    s.lastTs = ts;
    const framesAdvance = dt * s.fps * s.speed;
    const targetI = s.i + framesAdvance;
    const clampedI = Math.min(s.totalFrames - 1, targetI);
    s.i = clampedI;

    // il percorso avanza solo quando NON siamo dentro una foto (congelato durante la sua visualizzazione)
    const newPathIndex = computePathIndex(clampedI / s.fps, s.totalFrames, s.fps, this.deps.getPhotoClips());
    while (s.pathIndex < newPathIndex) {
      s.pathIndex++;
      s.smoothBearing = stepBearing(s.smoothBearing, s.pathIndex, s);
    }
    this.renderFrame(Math.floor(clampedI));

    if (clampedI >= s.totalFrames - 1) {
      s.playing = false;
      this.deps.onEnded();
      return;
    }
    this.rafHandle = requestAnimationFrame(this.loop);
  };

  private renderFrame(i: number): void {
    const s = this.state;
    if (!s) return;
    const { map } = this.deps;
    const pathIndex = s.pathIndex;

    map.jumpTo(cameraForFrame(s, pathIndex, s.smoothBearing));
    updateRouteDoneUpTo(map, s.path, pathIndex);
    syncMusicPreview(this.deps.getMusicTracks(), s.playing);

    // Con il terreno 3D attivo, la proiezione schermo di un punto (map.project, usata da
    // vehicleScreenPos per posizionare l'icona) riflette l'aggancio al terreno solo dopo che
    // MapLibre ha processato il render successivo a jumpTo — leggerla nello stesso istante
    // sincrono di jumpTo può dare una posizione disallineata di un frame. La registrazione
    // (recordFlight in videoExport.ts) aspetta già un requestAnimationFrame dopo ogni jumpTo
    // prima di disegnare l'icona (gpx-flyover.html:802): replichiamo lo stesso ordine qui.
    if (this.drawHandle != null) cancelAnimationFrame(this.drawHandle);
    this.drawHandle = requestAnimationFrame(() => {
      this.drawHandle = null;
      this.drawOverlay(i, s, pathIndex);
    });
  }

  private drawOverlay(i: number, s: PreviewState, pathIndex: number): void {
    const { map, overlayCanvas } = this.deps;
    const track = this.deps.getTrack();
    const vehicle = this.deps.getVehicleParams();

    // ridimensiona l'overlay se necessario e disegna l'icona del mezzo
    const rect = map.getContainer().getBoundingClientRect();
    if (overlayCanvas.width !== rect.width || overlayCanvas.height !== rect.height) {
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
    }
    this.overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const pos = vehicleScreenPos(map, s.path[pathIndex], s.zoom, s.pitch, track.minEle, vehicle);
    drawAltitudeLine(this.overlayCtx, pos.groundX, pos.groundY, pos.x, pos.y, vehicle.color, 1);
    drawVehicleIcon(this.overlayCtx, pos.x, pos.y, 1, vehicle);

    const activeLayers = getActivePhotoLayers(this.deps.getPhotoClips(), i / s.fps);
    for (const layer of activeLayers) {
      drawPhotoCover(
        this.overlayCtx,
        layer.photo.img,
        overlayCanvas.width,
        overlayCanvas.height,
        layer.alpha,
        layer.photo.rotation,
      );
    }

    const activeTexts = getActiveTextOverlays(this.deps.getTextOverlays(), i / s.fps);
    for (const t of activeTexts) {
      drawTextOverlay(this.overlayCtx, overlayCanvas.width, overlayCanvas.height, t.overlay.text, t.alpha);
    }

    this.deps.onTick({
      currentFrame: i,
      totalFrames: s.totalFrames,
      fps: s.fps,
      currentTimeSec: i / s.fps,
      totalTimeSec: s.totalFrames / s.fps,
      isPlaying: s.playing,
    });
  }
}
