import type { Map as MapLibreMap } from 'maplibre-gl';
import { buildAnimParams, cameraForFrame, initialBearing, stepBearing } from '../camera/camera';
import { ensureAudioCtx } from '../audio/musicEngine';
import { computeMusicFadeWindows, effectiveTrackVolume, scheduleTrackGainEnvelope } from '../audio/musicMix';
import { updateRouteDoneUpTo } from '../map/mapSetup';
import { computePathIndex } from '../timeline/timelineMath';
import { drawAltitudeLine, drawVehicleIcon, vehicleScreenPos } from '../vehicle/vehicleIcon';
import { drawPhotoCover, getActivePhotoLayers } from '../photos/photoEngine';
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

// Le posizioni di musica/foto sono impostate dall'utente guardando la durata NOMINALE (il campo
// "Durata video"); quando si registra a una velocità diversa da x1, la durata EFFETTIVA si
// comprime/allunga di conseguenza (effectiveDuration = durata/velocità). Senza riscalare le
// posizioni, un blocco piazzato ad es. al 90% della timeline nominale potrebbe cadere OLTRE la
// durata effettiva e sparire in silenzio dal video esportato, invece di restare — proporzionalmente
// — vicino alla fine del video accorciato/allungato. Il ritmo di riproduzione della musica in sé
// (playbackRate) NON cambia: cambia solo QUANTA della porzione tagliata rientra nella finestra
// sulla timeline (si ascolterà meno/più del brano a seconda che si acceleri o rallenti), esattamente
// come una foto mostrata per meno/più tempo — nessun conflitto con "la musica non accelera mai".
export function scaleMusicTracksForSpeed(musicTracks: MusicTrack[], speed: PlaybackSpeed): MusicTrack[] {
  if (speed === 1) return musicTracks;
  return musicTracks.map((t) => ({
    ...t,
    videoStart: t.videoStart / speed,
    trimEnd: t.trimStart + (t.trimEnd - t.trimStart) / speed,
  }));
}

export function scalePhotoClipsForSpeed(photoClips: PhotoClip[], speed: PlaybackSpeed): PhotoClip[] {
  if (speed === 1) return photoClips;
  return photoClips.map((p) => ({
    ...p,
    videoStart: p.videoStart / speed,
    duration: p.duration / speed,
  }));
}

// Attende fino all'istante di tempo reale target: aspetta con requestAnimationFrame quando
// manca poco (così si sincronizza comunque con il repaint della mappa), altrimenti con
// setTimeout per non tenere occupato il thread durante attese più lunghe. Se il momento target
// è già passato, si risolve immediatamente (nessuna attesa) — usata SOLO per l'attesa
// aggiuntiva quando siamo in anticipo sul ritmo, vedi waitForFrameAndPace più sotto.
function waitUntil(targetTimeMs: number): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const remaining = targetTimeMs - performance.now();
      if (remaining <= 0) {
        resolve();
        return;
      }
      if (remaining > 20) {
        setTimeout(check, remaining - 10);
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

// Aspetta SEMPRE almeno un vero repaint (requestAnimationFrame) dopo un jumpTo — necessario
// perché il canvas della mappa catturato con drawImage() rifletta davvero la nuova inquadratura,
// non quella precedente. In più, se siamo in anticipo sul ritmo reale atteso per questo
// fotogramma, aspetta anche fino al momento giusto. Se invece siamo in ritardo (disegno troppo
// lento), NON salta più l'attesa del repaint come prima — saltarla del tutto lasciava la mappa
// catturata "vecchia" rispetto alla posizione icona già aggiornata, con l'effetto di icona che
// sembra staccarsi/volare rispetto allo sfondo, oltre a contribuire agli scatti.
async function waitForFrameAndPace(targetTimeMs: number): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const remaining = targetTimeMs - performance.now();
  if (remaining > 0) {
    await waitUntil(targetTimeMs);
  }
}

// Esportata: riusata anche dal percorso di rendering deterministico (deterministicExport.ts),
// stesso identico pre-caricamento prima di iniziare a catturare/disegnare fotogrammi.
export function waitForMapIdle(map: MapLibreMap, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      map.off('idle', onIdle);
      clearTimeout(timer);
      resolve();
    };
    const onIdle = () => finish();
    map.on('idle', onIdle);
    const timer = setTimeout(finish, timeoutMs);
  });
}

export interface ProfileBackground {
  canvas: HTMLCanvasElement;
  pw: number;
  ph: number;
  eleMin: number;
  eleRange: number;
}

// Pre-disegna la sagoma statica del profilo altimetrico (sfondo sfumato + linea, 250 punti)
// UNA sola volta per registrazione, invece di ricostruirla ad ogni fotogramma — l'unica parte
// che cambia frame per frame è il pallino di posizione, disegnato separatamente sopra
// nell'immagine già pronta. Ottimizzazione di performance (nessun cambiamento visivo):
// riduce il lavoro per fotogramma nel ciclo di registrazione, che a 1080p/80s poteva far
// perdere il passo al ritmo reale richiesto da canvas.captureStream(fps). Esportata: riusata
// anche dal rendering deterministico (deterministicExport.ts).
export function buildProfileBackground(track: Track, s: number): ProfileBackground {
  const pw = 420 * s;
  const ph = 90 * s;
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d')!;
  const profile = track.profile;
  const eleMin = Math.min(...profile);
  const eleMax = Math.max(...profile);
  const eleRange = Math.max(1, eleMax - eleMin);

  ctx.beginPath();
  ctx.moveTo(0, ph);
  profile.forEach((e, i) => {
    const x = (i / (profile.length - 1)) * pw;
    const y = ph - ((e - eleMin) / eleRange) * ph * 0.85;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pw, ph);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, ph);
  grad.addColorStop(0, 'rgba(255,204,0,0.55)');
  grad.addColorStop(1, 'rgba(255,204,0,0.08)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  profile.forEach((e, i) => {
    const x = (i / (profile.length - 1)) * pw;
    const y = ph - ((e - eleMin) / eleRange) * ph * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  return { canvas, pw, ph, eleMin, eleRange };
}

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
  profileBg: ProfileBackground,
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

  // ---- profilo altimetrico (sagoma pre-disegnata) in alto a destra ----
  const { canvas: profileCanvas, pw, ph, eleMin, eleRange } = profileBg;
  const px = recCanvas.width - pw - 40 * s;
  const py = 20 * s;
  recCtx.drawImage(profileCanvas, px, py);

  // indicatore posizione attuale sul profilo (unica parte disegnata ad ogni fotogramma)
  const profile = track.profile;
  const markerX = px + progress * pw;
  const markerIdx = Math.min(profile.length - 1, Math.round(progress * (profile.length - 1)));
  const markerY = py + ph - ((profile[markerIdx] - eleMin) / eleRange) * ph * 0.85;
  recCtx.save();
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
  const activeLayers = getActivePhotoLayers(photoClips, timeSec);
  for (const layer of activeLayers) {
    drawPhotoCover(recCtx, layer.photo.img, recCanvas.width, recCanvas.height, layer.alpha, layer.photo.rotation);
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

  // Le posizioni di musica/foto sono pensate dall'utente sulla durata NOMINALE — a velocità
  // diversa da x1 vanno riscalate sulla durata EFFETTIVA per restare proporzionalmente corrette
  // (vedi scaleMusicTracksForSpeed/scalePhotoClipsForSpeed più sopra).
  const scaledMusicTracks = scaleMusicTracksForSpeed(musicTracks, selectedSpeed);
  const scaledPhotoClips = scalePhotoClipsForSpeed(photoClips, selectedSpeed);

  const [resW, resH] = video.resolution.split('x').map(Number);
  recCanvas.width = resW;
  recCanvas.height = resH;
  const recordedChunks: Blob[] = [];
  const videoStream = recCanvas.captureStream(p.fps);
  const profileBg = buildProfileBackground(track, resW / 1280);

  // Pre-caricamento: posiziona la camera sul primissimo fotogramma e attende che la mappa sia
  // effettivamente pronta (tile visibili caricate) PRIMA di avviare MediaRecorder — altrimenti
  // i primi secondi del video mostrerebbero tile a bassa risoluzione/incomplete, dato che la
  // cattura partirebbe subito dopo il click invece che a mappa già pronta in quella posizione.
  map.jumpTo(cameraForFrame(p, 0, smoothBearing));
  updateRouteDoneUpTo(map, p.path, 0);
  await waitForMapIdle(map);

  // --- musica di sottofondo (posizionamento libero per brano, opzionale) ---
  const anySolo = scaledMusicTracks.some((t) => t.solo);
  const hasMusic = scaledMusicTracks.some(
    (t) => t.trimEnd - t.trimStart > 0.05 && effectiveTrackVolume(t, anySolo) > 0,
  );
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
    const fadeWindows = computeMusicFadeWindows(scaledMusicTracks);
    scaledMusicTracks.forEach((track_) => {
      const length = track_.trimEnd - track_.trimStart;
      if (length <= 0.05) return;
      if (track_.videoStart >= effectiveDuration) return; // parte dopo la fine del video: salta
      const peak = effectiveTrackVolume(track_, anySolo);
      if (peak <= 0) return; // mutata, o silenziata da un "solo" su un'altra traccia
      const playLen = Math.min(length, effectiveDuration - track_.videoStart);
      const trackGain = ctx.createGain();
      trackGain.connect(recGainNode);
      const source = ctx.createBufferSource();
      source.buffer = track_.buffer;
      source.connect(trackGain);
      source.start(startAt + track_.videoStart, track_.trimStart, playLen);
      scheduledSources.push(source);

      // dissolvenza incrociata automatica con brani sovrapposti adiacenti (musicMix.ts)
      const window = fadeWindows.get(track_.id)!;
      const actualEnd = Math.min(window.end, track_.videoStart + playLen);
      scheduleTrackGainEnvelope(trackGain.gain, peak, window, actualEnd, startAt);
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

  // canvas.captureStream(fps) cattura un fotogramma ogni 1/fps di tempo REALE, per tutta la
  // durata della sessione (dall'avvio della registrazione a mediaRecorder.stop()) —
  // indipendentemente da quanti fotogrammi il nostro ciclo riesce effettivamente a disegnare.
  // Ogni fotogramma aspetta SEMPRE almeno un repaint reale dopo il jumpTo (altrimenti il canvas
  // mappa catturato può restare "vecchio" rispetto alla posizione icona già aggiornata — visto
  // che l'icona sembrava staccarsi/volare dallo sfondo) e in più si allinea all'orologio reale
  // se siamo in anticipo, per far corrispondere la durata del video a quella attesa da
  // selectedSpeed. Se il disegno è più lento del budget 1/fps la sessione può comunque allungarsi
  // un po' — è il limite intrinseco della cattura in tempo reale, superabile solo con un
  // rendering deterministico frame-by-frame (prompt-refactoring.md, priorità alta #1).
  const recordingStart = performance.now();
  let lastPathIndex = 0;
  for (let i = 0; i < p.totalFrames; i++) {
    const videoTimeSec = i / p.fps;
    const pathIndex = computePathIndex(videoTimeSec, p.totalFrames, p.fps, scaledPhotoClips);
    while (lastPathIndex < pathIndex) {
      lastPathIndex++;
      smoothBearing = stepBearing(smoothBearing, lastPathIndex, p);
    }
    map.jumpTo(cameraForFrame(p, pathIndex, smoothBearing));
    updateRouteDoneUpTo(map, p.path, pathIndex);
    await waitForFrameAndPace(recordingStart + videoTimeSec * 1000);
    drawOverlayFrame(recCtx, recCanvas, map, track, vehicle, profileBg, {
      title: p.title,
      cur: p.path[pathIndex],
      progress: (pathIndex + 1) / p.totalFrames,
      zoom: p.zoom,
      pitch: p.pitch,
      timeSec: videoTimeSec,
      photoClips: scaledPhotoClips,
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
