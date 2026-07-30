import { AudioBufferSource, BufferTarget, CanvasSource, Output, WebMOutputFormat } from 'mediabunny';
import { buildAnimParams, cameraForFrame, initialBearing, stepBearing } from '../camera/camera';
import { computeMusicFadeWindows, effectiveTrackVolume, scheduleTrackGainEnvelope } from '../audio/musicMix';
import { updateRouteDoneUpTo } from '../map/mapSetup';
import { computePathIndex } from '../timeline/timelineMath';
import type { MusicTrack } from '../types/domain';
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

// Rende in modo deterministico l'intero mix musicale (sovrapposizioni + dissolvenza finale) in
// UN SOLO AudioBuffer, riusando la stessa logica di scheduling di recordFlight (videoExport.ts)
// ma su un OfflineAudioContext invece che sul contesto audio live — stesso mixaggio/dissolvenza,
// ma calcolato in anticipo e non vincolato al tempo reale. Ritorna null se non c'è musica utile.
// I musicTracks passati devono essere già riscalati per la velocità (scaleMusicTracksForSpeed).
export async function renderMusicMixOffline(
  musicTracks: MusicTrack[],
  musicVolume: number,
  durationSec: number,
): Promise<AudioBuffer | null> {
  const anySolo = musicTracks.some((t) => t.solo);
  const hasMusic = musicTracks.some(
    (t) => t.trimEnd - t.trimStart > 0.05 && effectiveTrackVolume(t, anySolo) > 0,
  );
  if (!hasMusic) return null;

  const sampleRate = 48000;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);
  const gainNode = offlineCtx.createGain();
  gainNode.gain.value = musicVolume;
  gainNode.connect(offlineCtx.destination);

  // stesse posizioni della timeline nominale (già riscalate dal chiamante), tagliate se cadono
  // oltre la fine del video — identico a recordFlight, con l'aggiunta del gain per traccia
  // (volume/mute/solo + dissolvenza incrociata automatica tra brani sovrapposti, musicMix.ts).
  const fadeWindows = computeMusicFadeWindows(musicTracks);
  musicTracks.forEach((track) => {
    const length = track.trimEnd - track.trimStart;
    if (length <= 0.05) return;
    if (track.videoStart >= durationSec) return;
    const peak = effectiveTrackVolume(track, anySolo);
    if (peak <= 0) return;
    const playLen = Math.min(length, durationSec - track.videoStart);
    const trackGain = offlineCtx.createGain();
    trackGain.connect(gainNode);
    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;
    source.connect(trackGain);
    source.start(track.videoStart, track.trimStart, playLen);

    const window = fadeWindows.get(track.id)!;
    const actualEnd = Math.min(window.end, track.videoStart + playLen);
    scheduleTrackGainEnvelope(trackGain.gain, peak, window, actualEnd, 0);
  });

  // dissolvenza finale (ultimi 2 secondi), identica a recordFlight
  const fadeStart = Math.max(0, durationSec - 2);
  gainNode.gain.setValueAtTime(musicVolume, fadeStart);
  gainNode.gain.linearRampToValueAtTime(0, fadeStart + 2);

  return offlineCtx.startRendering();
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

  // Stesso pre-caricamento di recordFlight: posiziona la camera sul primo fotogramma e attende
  // che la mappa sia davvero pronta prima di iniziare a disegnare/codificare.
  map.jumpTo(cameraForFrame(p, 0, smoothBearing));
  updateRouteDoneUpTo(map, p.path, 0);
  await waitForMapIdle(map);

  const musicBuffer = await renderMusicMixOffline(scaledMusicTracks, musicVolume, effectiveDuration);

  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(recCanvas, {
    codec: 'vp9',
    bitrate: video.bitrateMbps * 1_000_000,
  });
  output.addVideoTrack(videoSource, { frameRate: p.fps });

  const audioSource = musicBuffer ? new AudioBufferSource({ codec: 'opus', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);

  // Tutto il corpo dopo la creazione di `output` è avvolto in try/finally: qualunque uscita
  // anomala (errore imprevisto o cancellazione) deve comunque rilasciare le risorse di Mediabunny
  // (encoder inclusi) chiamando output.cancel() — senza questo, un errore a metà ciclo lascia
  // l'output "started" per sempre, con l'effetto collaterale osservato di rompere il successivo
  // avvio dell'Anteprima (stesso tipo di bug già risolto per recCanvas.style.display).
  let finalized = false;
  try {
    await output.start();
    if (audioSource && musicBuffer) {
      await audioSource.add(musicBuffer);
    }

    let lastPathIndex = 0;
    for (let i = 0; i < p.totalFrames; i++) {
      if (isCancelled()) {
        throw new ExportCancelledError();
      }

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

      await videoSource.add(videoTimeSec, 1 / p.fps);
      onProgress((i + 1) / p.totalFrames);
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
