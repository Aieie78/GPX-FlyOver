import type { Map as MapLibreMap } from 'maplibre-gl';
import { buildAnimParams, cameraForFrame, initialBearing, stepBearing } from '../camera/camera';
import { ensureAudioCtx } from '../audio/musicEngine';
import { updateRouteDoneUpTo } from '../map/mapSetup';
import { computePathIndex } from '../timeline/timelineMath';
import { drawAltitudeLine, drawVehicleIcon, vehicleScreenPos } from '../vehicle/vehicleIcon';
import { drawPhotoCover, getActivePhoto } from '../photos/photoEngine';
import type {
  CameraParams,
  MusicTrack,
  PathPoint,
  PhotoClip,
  PlaybackSpeed,
  Track,
  VehicleParams,
  VideoParams,
} from '../types/domain';

interface DrawOverlayArgs {
  title: string;
  cur: PathPoint;
  progress: number;
  zoom: number;
  pitch: number;
  timeSec: number;
  photoClips: PhotoClip[];
}

// Disegna un fotogramma completo dell'overlay di esportazione (mappa + icona mezzo + titolo +
// profilo altimetrico + statistiche + barra avanzamento + foto). Port 1:1 da gpx-flyover.html:1411.
export function drawOverlayFrame(
  recCtx: CanvasRenderingContext2D,
  recCanvas: HTMLCanvasElement,
  map: MapLibreMap,
  track: Track,
  vehicle: VehicleParams,
  args: DrawOverlayArgs,
): void {
  const { title, cur, progress, zoom, pitch, timeSec, photoClips } = args;
  const mapCanvas = map.getCanvas();
  recCtx.drawImage(mapCanvas, 0, 0, recCanvas.width, recCanvas.height);

  // fattore di scala rispetto alla risoluzione di riferimento (1280px larghezza)
  const s = recCanvas.width / 1280;

  // icona del mezzo, in scala con la risoluzione di registrazione
  const mapRect = map.getContainer().getBoundingClientRect();
  const scaleX = recCanvas.width / mapRect.width;
  const scaleY = recCanvas.height / mapRect.height;
  const pos = vehicleScreenPos(map, cur, zoom, pitch, track.minEle, vehicle);
  drawAltitudeLine(recCtx, pos.groundX * scaleX, pos.groundY * scaleY, pos.x * scaleX, pos.y * scaleY, vehicle.color, s);
  drawVehicleIcon(recCtx, pos.x * scaleX, pos.y * scaleY, s, vehicle);

  // titolo
  recCtx.font = `bold ${34 * s}px system-ui`;
  recCtx.fillStyle = '#fff';
  recCtx.shadowColor = 'rgba(0,0,0,0.6)';
  recCtx.shadowBlur = 8 * s;
  recCtx.fillText(title, 40 * s, 60 * s);
  recCtx.shadowBlur = 0;

  // ---- profilo altimetrico (sagoma) in alto a destra ----
  const pw = 420 * s;
  const ph = 90 * s;
  const px = recCanvas.width - pw - 40 * s;
  const py = 20 * s;
  const profile = track.profile;
  const eleMin = Math.min(...profile);
  const eleMax = Math.max(...profile);
  const eleRange = Math.max(1, eleMax - eleMin);

  recCtx.save();
  recCtx.beginPath();
  recCtx.moveTo(px, py + ph);
  profile.forEach((e, i) => {
    const x = px + (i / (profile.length - 1)) * pw;
    const y = py + ph - ((e - eleMin) / eleRange) * ph * 0.85;
    recCtx.lineTo(x, y);
  });
  recCtx.lineTo(px + pw, py + ph);
  recCtx.closePath();
  const grad = recCtx.createLinearGradient(0, py, 0, py + ph);
  grad.addColorStop(0, 'rgba(255,204,0,0.55)');
  grad.addColorStop(1, 'rgba(255,204,0,0.08)');
  recCtx.fillStyle = grad;
  recCtx.fill();
  recCtx.strokeStyle = 'rgba(255,255,255,0.8)';
  recCtx.lineWidth = 1.5 * s;
  recCtx.beginPath();
  profile.forEach((e, i) => {
    const x = px + (i / (profile.length - 1)) * pw;
    const y = py + ph - ((e - eleMin) / eleRange) * ph * 0.85;
    if (i === 0) recCtx.moveTo(x, y);
    else recCtx.lineTo(x, y);
  });
  recCtx.stroke();

  // indicatore posizione attuale sul profilo
  const markerX = px + progress * pw;
  const markerIdx = Math.min(profile.length - 1, Math.round(progress * (profile.length - 1)));
  const markerY = py + ph - ((profile[markerIdx] - eleMin) / eleRange) * ph * 0.85;
  recCtx.fillStyle = '#fff';
  recCtx.beginPath();
  recCtx.arc(markerX, markerY, 5 * s, 0, Math.PI * 2);
  recCtx.fill();
  recCtx.strokeStyle = 'rgba(0,0,0,0.5)';
  recCtx.lineWidth = 1 * s;
  recCtx.stroke();
  recCtx.restore();

  // barra stats in basso
  const distSoFar = (cur.dist / 1000).toFixed(1);
  const totalKm = (track.totalDist / 1000).toFixed(1);
  const gainSoFar = Math.round(track.gain * progress);
  recCtx.fillStyle = 'rgba(0,0,0,0.45)';
  recCtx.fillRect(30 * s, recCanvas.height - 90 * s, 520 * s, 60 * s);
  recCtx.fillStyle = '#ffcc00';
  recCtx.font = `bold ${20 * s}px system-ui`;
  recCtx.fillText(`${distSoFar} / ${totalKm} km`, 50 * s, recCanvas.height - 58 * s);
  recCtx.fillText(`+${gainSoFar} m`, 250 * s, recCanvas.height - 58 * s);
  recCtx.fillText(`⛰ ${Math.round(cur.ele)} m`, 400 * s, recCanvas.height - 58 * s);

  // barra di avanzamento
  recCtx.fillStyle = 'rgba(255,255,255,0.25)';
  recCtx.fillRect(30 * s, recCanvas.height - 25 * s, 520 * s, 6 * s);
  recCtx.fillStyle = '#ffcc00';
  recCtx.fillRect(30 * s, recCanvas.height - 25 * s, 520 * s * progress, 6 * s);

  // foto della timeline (se attiva in questo istante): copre tutto il resto
  const activePhoto = getActivePhoto(photoClips, timeSec);
  if (activePhoto) {
    drawPhotoCover(recCtx, activePhoto.photo.img, recCanvas.width, recCanvas.height, activePhoto.alpha);
  }
}

export interface RecordFlightArgs {
  map: MapLibreMap;
  track: Track;
  recCanvas: HTMLCanvasElement;
  video: VideoParams;
  camera: CameraParams;
  vehicle: VehicleParams;
  musicTracks: MusicTrack[];
  musicVolume: number;
  title: string;
  selectedSpeed: PlaybackSpeed;
  photoClips: PhotoClip[];
}

// Registrazione lineare, dall'inizio alla fine, per il file video — riproduce il volo in
// tempo reale (un video di 3 minuti impiega 3 minuti a generarsi). Il rendering deterministico
// più veloce del tempo reale è una funzionalità nuova pianificata per una fase successiva
// (prompt-refactoring.md, priorità alta #1) — qui si mantiene lo stesso comportamento
// dell'originale. Port 1:1 da gpx-flyover.html:730-818.
export async function recordFlight(args: RecordFlightArgs): Promise<Blob> {
  const { map, track, recCanvas, video, camera, vehicle, musicTracks, musicVolume, title, selectedSpeed, photoClips } =
    args;
  const recCtx = recCanvas.getContext('2d')!;

  const baseDuration = video.durationSec;
  const effectiveDuration = baseDuration / selectedSpeed; // x1.5/x2 = video più corto e più rapido, x0.5 = più lungo e lento
  const p = buildAnimParams(track, video, camera, title, effectiveDuration);
  let smoothBearing = initialBearing(p);

  const [resW, resH] = video.resolution.split('x').map(Number);
  recCanvas.width = resW;
  recCanvas.height = resH;
  const recordedChunks: Blob[] = [];
  const videoStream = recCanvas.captureStream(p.fps);

  // --- musica di sottofondo (posizionamento libero per brano, opzionale) ---
  const hasMusic = musicTracks.some((t) => t.trimEnd - t.trimStart > 0.05);
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
  const scheduledSources: AudioBufferSourceNode[] = [];

  if (hasMusic) {
    const ctx = ensureAudioCtx(musicVolume);
    const dest = ctx.createMediaStreamDestination();
    const recGainNode = ctx.createGain();
    recGainNode.gain.value = musicVolume;
    recGainNode.connect(dest);

    // la musica resta sempre al ritmo/tono normale (playbackRate=1): solo il video
    // accelera/rallenta con x1.5/x2/x0.5, la musica no. Le posizioni restano quelle
    // impostate sulla timeline nominale, semplicemente tagliate se cadono oltre la
    // fine del video (più corto se accelerato, più lungo se rallentato).
    const startAt = ctx.currentTime + 0.05; // piccolo margine di sicurezza
    musicTracks.forEach((track_) => {
      const length = track_.trimEnd - track_.trimStart;
      if (length <= 0.05) return;
      if (track_.videoStart >= effectiveDuration) return; // parte dopo la fine del video: salta
      const playLen = Math.min(length, effectiveDuration - track_.videoStart);
      const source = ctx.createBufferSource();
      source.buffer = track_.buffer;
      source.connect(recGainNode);
      source.start(startAt + track_.videoStart, track_.trimStart, playLen);
      scheduledSources.push(source);
    });

    // dissolvenza finale (ultimi 2 secondi) per non tagliare la musica di netto
    const fadeStart = startAt + Math.max(0, effectiveDuration - 2);
    recGainNode.gain.setValueAtTime(musicVolume, fadeStart);
    recGainNode.gain.linearRampToValueAtTime(0, fadeStart + 2);

    tracks.push(...dest.stream.getAudioTracks());
  }

  const stream = new MediaStream(tracks);
  const mimeCandidates = hasMusic
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const mediaRecorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: video.bitrateMbps * 1_000_000,
  });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.start();

  let lastPathIndex = 0;
  for (let i = 0; i < p.totalFrames; i++) {
    const videoTimeSec = i / p.fps;
    const pathIndex = computePathIndex(videoTimeSec, p.totalFrames, p.fps, photoClips);
    while (lastPathIndex < pathIndex) {
      lastPathIndex++;
      smoothBearing = stepBearing(smoothBearing, lastPathIndex, p);
    }
    map.jumpTo(cameraForFrame(p, pathIndex, smoothBearing));
    updateRouteDoneUpTo(map, p.path, pathIndex);
    await new Promise<void>((r) => requestAnimationFrame(() => r())); // attende il render della mappa
    drawOverlayFrame(recCtx, recCanvas, map, track, vehicle, {
      title: p.title,
      cur: p.path[pathIndex],
      progress: (pathIndex + 1) / p.totalFrames,
      zoom: p.zoom,
      pitch: p.pitch,
      timeSec: videoTimeSec,
      photoClips,
    });
  }

  await new Promise((r) => setTimeout(r, 300)); // ultimo frame
  mediaRecorder.stop();
  await new Promise<void>((resolve) => {
    mediaRecorder.onstop = () => resolve();
  });
  scheduledSources.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* già fermata */
    }
  });

  return new Blob(recordedChunks, { type: 'video/webm' });
}
