import { AudioBufferSource, BufferTarget, CanvasSource, Output, WebMOutputFormat } from 'mediabunny';
import { buildAnimParams, cameraForFrame, initialBearing, stepBearing } from '../camera/camera';
import { renderMusicMixOffline, sliceAudioBuffer } from '../audio/musicMix';
import { updateRouteDoneUpTo } from '../map/mapSetup';
import { computePathIndex } from '../timeline/timelineMath';
import {
  buildProfileBackground,
  computeAspectCrop,
  drawOverlayFrame,
  scaleMusicTracksForSpeed,
  scalePhotoClipsForSpeed,
  scaleTextOverlaysForSpeed,
  waitForMapIdle,
  type RecordFlightArgs,
} from './videoExport';

// Rendering deterministico frame-by-frame (WebCodecs via Mediabunny), alternativa a
// recordFlight (videoExport.ts) che cattura in tempo reale. Ogni fotogramma viene disegnato e
// codificato con tutto il tempo che serve, senza vincoli di refresh dello schermo — risolve alla
// radice gli scatti/la durata sbagliata dimostrati con ffprobe sulla cattura in tempo reale.
// Va verificato il supporto del browser PRIMA di usarlo (isDeterministicExportSupported):
// se in futuro serve un fallback più robusto di recordFlight per Firefox/Safari (es. ffmpeg.wasm),
// va aggiunto qui accanto, senza toccare né questo file né recordFlight.
export function isDeterministicExportSupported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'AudioEncoder' in window;
}

// Segnale distinto da un errore vero, per permettere alla UI di mostrare "annullato" invece di
// un messaggio di errore quando l'utente interrompe volontariamente l'esportazione.
export class ExportCancelledError extends Error {
  constructor() {
    super('Esportazione annullata');
    this.name = 'ExportCancelledError';
  }
}

export async function recordFlightDeterministic(
  args: RecordFlightArgs,
  onProgress: (fraction: number) => void,
  isCancelled: () => boolean,
): Promise<Blob> {
  const {
    map,
    track,
    recCanvas,
    video,
    camera,
    vehicle,
    musicTracks,
    musicVolume,
    title,
    selectedSpeed,
    photoClips,
    textOverlays,
  } = args;

  const baseDuration = video.durationSec;
  const effectiveDuration = baseDuration / selectedSpeed;
  const p = buildAnimParams(track, video, camera, title, effectiveDuration);
  let smoothBearing = initialBearing(p);

  // Stesso riscalamento di recordFlight: le posizioni di musica/foto/testo sono pensate
  // dall'utente sulla durata nominale, vanno riportate in proporzione alla durata effettiva.
  const scaledMusicTracks = scaleMusicTracksForSpeed(musicTracks, selectedSpeed);
  const scaledPhotoClips = scalePhotoClipsForSpeed(photoClips, selectedSpeed);
  const scaledTextOverlays = scaleTextOverlaysForSpeed(textOverlays, selectedSpeed);

  // Intervallo selezionato con le maniglie sulla barra video (PreviewControls.tsx), in secondi
  // NOMINALI (0..durationSec) — riscalato in proporzione alla durata effettiva come tutto il
  // resto. L'anteprima interattiva non è toccata da questo ritaglio: riguarda solo l'esportazione.
  const rangeEndNominal = video.trimEndSec ?? baseDuration;
  const effRangeStart = Math.max(0, video.trimStartSec / selectedSpeed);
  const effRangeEnd = Math.min(effectiveDuration, rangeEndNominal / selectedSpeed);
  const frameStart = Math.max(0, Math.min(p.totalFrames - 1, Math.round(effRangeStart * p.fps)));
  const frameEnd = Math.max(frameStart + 1, Math.min(p.totalFrames, Math.round(effRangeEnd * p.fps)));
  const outputTotalFrames = frameEnd - frameStart;

  // Stessa composizione a 16:9 + ritaglio finale al centro di recordFlight (videoExport.ts):
  // recCanvas (quello che Mediabunny/CanvasSource cattura davvero) ha le dimensioni GIÀ ritagliate,
  // composeCanvas è la scena intera su cui disegna drawOverlayFrame.
  const [resW, resH] = video.resolution.split('x').map(Number);
  const crop = computeAspectCrop(resW, resH, video.aspectRatio);
  recCanvas.width = crop.outW;
  recCanvas.height = crop.outH;
  const recCtx = recCanvas.getContext('2d')!;
  const composeCanvas = document.createElement('canvas');
  composeCanvas.width = resW;
  composeCanvas.height = resH;
  const composeCtx = composeCanvas.getContext('2d')!;
  const profileBg = buildProfileBackground(track, resW / 1280);

  // Stesso pre-caricamento di recordFlight: posiziona la camera sul PRIMO fotogramma del
  // ritaglio (non necessariamente l'inizio assoluto del percorso) e attende che la mappa sia
  // davvero pronta prima di iniziare a disegnare/codificare.
  const pathIndexAtStart = computePathIndex(frameStart / p.fps, p.totalFrames, p.fps, scaledPhotoClips);
  map.jumpTo(cameraForFrame(p, pathIndexAtStart, smoothBearing));
  updateRouteDoneUpTo(map, p.path, pathIndexAtStart);
  await waitForMapIdle(map);

  const musicBuffer = await renderMusicMixOffline(scaledMusicTracks, musicVolume, effectiveDuration);
  const slicedMusicBuffer = musicBuffer ? sliceAudioBuffer(musicBuffer, effRangeStart, effRangeEnd) : null;

  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(recCanvas, {
    codec: 'vp9',
    bitrate: video.bitrateMbps * 1_000_000,
  });
  output.addVideoTrack(videoSource, { frameRate: p.fps });

  const audioSource = slicedMusicBuffer ? new AudioBufferSource({ codec: 'opus', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);

  // Tutto il corpo dopo la creazione di `output` è avvolto in try/finally: qualunque uscita
  // anomala (errore imprevisto o cancellazione) deve comunque rilasciare le risorse di Mediabunny
  // (encoder inclusi) chiamando output.cancel() — senza questo, un errore a metà ciclo lascia
  // l'output "started" per sempre, con l'effetto collaterale osservato di rompere il successivo
  // avvio dell'Anteprima (stesso tipo di bug già risolto per recCanvas.style.display).
  let finalized = false;
  try {
    await output.start();
    if (audioSource && slicedMusicBuffer) {
      await audioSource.add(slicedMusicBuffer);
    }

    let lastPathIndex = 0;
    for (let i = frameStart; i < frameEnd; i++) {
      if (isCancelled()) {
        throw new ExportCancelledError();
      }

      // videoTimeSec resta assoluto (rispetto all'intera durata effettiva, non al ritaglio) —
      // foto/testo/percorso vanno cercati nella loro posizione originale sulla timeline nominale.
      // Solo il timestamp scritto nel file di output (sotto) è relativo all'inizio del ritaglio.
      const videoTimeSec = i / p.fps;
      const pathIndex = computePathIndex(videoTimeSec, p.totalFrames, p.fps, scaledPhotoClips);
      while (lastPathIndex < pathIndex) {
        lastPathIndex++;
        smoothBearing = stepBearing(smoothBearing, lastPathIndex, p);
      }
      map.jumpTo(cameraForFrame(p, pathIndex, smoothBearing));
      updateRouteDoneUpTo(map, p.path, pathIndex);

      // Un solo repaint reale prima di catturare il canvas — qui non serve più ritmare
      // sull'orologio reale come in recordFlight: ogni fotogramma può richiedere quanto tempo
      // serve, la durata finale del video dipende solo dal numero di fotogrammi/fps dichiarati,
      // non dal tempo reale impiegato per disegnarli.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      drawOverlayFrame(composeCtx, composeCanvas, map, track, vehicle, profileBg, {
        title: p.title,
        cur: p.path[pathIndex],
        progress: (pathIndex + 1) / p.totalFrames,
        zoom: p.zoom,
        pitch: p.pitch,
        timeSec: videoTimeSec,
        photoClips: scaledPhotoClips,
        textOverlays: scaledTextOverlays,
      });
      recCtx.drawImage(composeCanvas, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.outW, crop.outH);

      await videoSource.add((i - frameStart) / p.fps, 1 / p.fps);
      onProgress((i - frameStart + 1) / outputTotalFrames);
    }

    await output.finalize();
    finalized = true;
    const buffer = output.target.buffer;
    if (!buffer) throw new Error('Mediabunny non ha prodotto alcun buffer di output.');
    return new Blob([buffer], { type: 'video/webm' });
  } finally {
    if (!finalized) {
      try {
        await output.cancel();
      } catch (cancelErr) {
        console.error('Errore durante la cancellazione di sicurezza di Mediabunny Output:', cancelErr);
      }
    }
  }
}
