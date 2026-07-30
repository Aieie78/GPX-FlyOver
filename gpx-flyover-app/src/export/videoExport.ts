import type { Map as MapLibreMap } from 'maplibre-gl';
import { buildAnimParams, cameraForFrame, initialBearing, stepBearing } from '../camera/camera';
import { ensureAudioCtx } from '../audio/musicEngine';
import { renderMusicMixOffline, sliceAudioBuffer } from '../audio/musicMix';
import { updateRouteDoneUpTo } from '../map/mapSetup';
import { computePathIndex } from '../timeline/timelineMath';
import { drawAltitudeLine, drawVehicleIcon, vehicleScreenPos } from '../vehicle/vehicleIcon';
import { drawPhotoCover, getActivePhotoLayers } from '../photos/photoEngine';
import { drawLiveStatsBox } from '../stats/liveStatsOverlay';
import { drawTextOverlay, getActiveTextOverlays } from '../text/textEngine';
import type {
  CameraParams,
  MusicTrack,
  PathPoint,
  PhotoClip,
  PlaybackSpeed,
  TextOverlay,
  Track,
  VehicleParams,
  VideoAspectRatio,
  VideoParams,
} from '../types/domain';

export interface AspectCrop {
  outW: number;
  outH: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// La scena viene sempre composta in 16:9 (resW x resH, come oggi) e poi ritagliata al centro nel
// formato scelto — per 16:9 il ritaglio è un no-op (l'intero fotogramma). Per 9:16 si mantiene
// l'intera altezza e si ritaglia la larghezza; per 1:1 si ritaglia un quadrato pari all'altezza.
// resH < resW sempre (tutte le risoluzioni disponibili sono 16:9), quindi il ritaglio centrale
// rientra sempre nella larghezza disponibile.
export function computeAspectCrop(resW: number, resH: number, aspectRatio: VideoAspectRatio): AspectCrop {
  if (aspectRatio === '16:9') {
    return { outW: resW, outH: resH, sx: 0, sy: 0, sw: resW, sh: resH };
  }
  const outH = resH;
  const outW = aspectRatio === '1:1' ? resH : Math.round(((resH * 9) / 16) / 2) * 2;
  const sx = Math.max(0, Math.round((resW - outW) / 2));
  return { outW, outH, sx, sy: 0, sw: outW, sh: outH };
}

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

// Stesso riscalamento di scalePhotoClipsForSpeed, per le sovrapposizioni testuali.
export function scaleTextOverlaysForSpeed(textOverlays: TextOverlay[], speed: PlaybackSpeed): TextOverlay[] {
  if (speed === 1) return textOverlays;
  return textOverlays.map((t) => ({
    ...t,
    videoStart: t.videoStart / speed,
    duration: t.duration / speed,
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
  textOverlays: TextOverlay[];
  showAltitudeProfile: boolean;
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
  const { title, cur, progress, zoom, pitch, timeSec, photoClips, textOverlays, showAltitudeProfile } = args;
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

  // ---- profilo altimetrico (sagoma pre-disegnata) in alto a destra, disattivabile ----
  if (showAltitudeProfile) {
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
  }

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

  // sovrapposizioni testuali della timeline (didascalie/titoli multipli)
  const activeTexts = getActiveTextOverlays(textOverlays, timeSec);
  for (const t of activeTexts) {
    drawTextOverlay(recCtx, recCanvas.width, recCanvas.height, t.overlay.text, t.alpha, t.overlay.x, t.overlay.y);
  }

  // riquadro velocità/quota/posizione in tempo reale, se attivato
  if (vehicle.showLiveStats) {
    drawLiveStatsBox(recCtx, recCanvas.width, recCanvas.height, cur);
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
  textOverlays: TextOverlay[];
}

// Registrazione lineare, dall'inizio alla fine, per il file video — riproduce il volo in
// tempo reale (un video di 3 minuti impiega 3 minuti a generarsi). Il rendering deterministico
// più veloce del tempo reale è una funzionalità nuova pianificata per una fase successiva
// (prompt-refactoring.md, priorità alta #1) — qui si mantiene lo stesso comportamento
// dell'originale. Port 1:1 da gpx-flyover.html:730-818.
export async function recordFlight(args: RecordFlightArgs): Promise<Blob> {
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
  const effectiveDuration = baseDuration / selectedSpeed; // x1.5/x2 = video più corto e più rapido, x0.5 = più lungo e lento
  const p = buildAnimParams(track, video, camera, title, effectiveDuration);
  let smoothBearing = initialBearing(p);

  // Le posizioni di musica/foto/testo sono pensate dall'utente sulla durata NOMINALE — a velocità
  // diversa da x1 vanno riscalate sulla durata EFFETTIVA per restare proporzionalmente corrette
  // (vedi scaleMusicTracksForSpeed/scalePhotoClipsForSpeed/scaleTextOverlaysForSpeed più sopra).
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

  // La scena viene sempre composta in 16:9 (resW x resH) su un canvas separato (composeCanvas),
  // poi ritagliata al centro nel formato scelto (video.aspectRatio) sul recCanvas vero e proprio,
  // quello effettivamente catturato da captureStream/MediaRecorder — per 16:9 il ritaglio è un
  // no-op (l'intero fotogramma), quindi il percorso invariato resta identico a prima.
  const [resW, resH] = video.resolution.split('x').map(Number);
  const crop = computeAspectCrop(resW, resH, video.aspectRatio);
  recCanvas.width = crop.outW;
  recCanvas.height = crop.outH;
  const recCtx = recCanvas.getContext('2d')!;
  const composeCanvas = document.createElement('canvas');
  composeCanvas.width = resW;
  composeCanvas.height = resH;
  const composeCtx = composeCanvas.getContext('2d')!;

  const recordedChunks: Blob[] = [];
  const videoStream = recCanvas.captureStream(p.fps);
  const profileBg = buildProfileBackground(track, resW / 1280);

  // Pre-caricamento: posiziona la camera sul PRIMO fotogramma del ritaglio (non necessariamente
  // l'inizio assoluto del percorso) e attende che la mappa sia effettivamente pronta (tile
  // visibili caricate) PRIMA di avviare MediaRecorder — altrimenti i primi secondi del video
  // mostrerebbero tile a bassa risoluzione/incomplete, dato che la cattura partirebbe subito dopo
  // il click invece che a mappa già pronta in quella posizione.
  const pathIndexAtStart = computePathIndex(frameStart / p.fps, p.totalFrames, p.fps, scaledPhotoClips);
  map.jumpTo(cameraForFrame(p, pathIndexAtStart, smoothBearing));
  updateRouteDoneUpTo(map, p.path, pathIndexAtStart);
  await waitForMapIdle(map);

  // --- musica di sottofondo (posizionamento libero per brano, opzionale) ---
  // Il mix (sovrapposizioni + dissolvenze incrociate + volume/mute/solo) viene calcolato in
  // anticipo con lo stesso renderer offline del percorso deterministico (musicMix.ts), poi
  // ritagliato all'intervallo selezionato e riprodotto dal vivo come UN SOLO buffer — più
  // semplice e robusto che programmare live ogni singolo brano con inizio/fine spostati
  // sull'intervallo (specie per brani già iniziati PRIMA del ritaglio), e il risultato finale è
  // identico a quello usato dal rendering deterministico.
  const musicBuffer = await renderMusicMixOffline(scaledMusicTracks, musicVolume, effectiveDuration);
  const slicedMusicBuffer = musicBuffer ? sliceAudioBuffer(musicBuffer, effRangeStart, effRangeEnd) : null;
  const hasMusic = slicedMusicBuffer != null;

  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
  const scheduledSources: AudioBufferSourceNode[] = [];

  if (slicedMusicBuffer) {
    const ctx = ensureAudioCtx(musicVolume);
    const dest = ctx.createMediaStreamDestination();
    const startAt = ctx.currentTime + 0.05; // piccolo margine di sicurezza
    const source = ctx.createBufferSource();
    source.buffer = slicedMusicBuffer;
    source.connect(dest);
    source.start(startAt);
    scheduledSources.push(source);
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
  // recordingStart è arretrato di quanto "salta" il ritaglio (frameStart/fps), così il ritmo si
  // allinea subito al primo fotogramma del ritaglio invece di aspettare inutilmente che scada il
  // tempo reale corrispondente alla porzione tagliata prima dell'inizio scelto.
  const recordingStart = performance.now() - (frameStart / p.fps) * 1000;
  let lastPathIndex = 0;
  for (let i = frameStart; i < frameEnd; i++) {
    // videoTimeSec resta assoluto (rispetto all'intera durata effettiva, non al ritaglio) —
    // foto/testo/percorso/musica sono già ritagliati/allineati su questa stessa base assoluta.
    const videoTimeSec = i / p.fps;
    const pathIndex = computePathIndex(videoTimeSec, p.totalFrames, p.fps, scaledPhotoClips);
    while (lastPathIndex < pathIndex) {
      lastPathIndex++;
      smoothBearing = stepBearing(smoothBearing, lastPathIndex, p);
    }
    map.jumpTo(cameraForFrame(p, pathIndex, smoothBearing));
    updateRouteDoneUpTo(map, p.path, pathIndex);
    await waitForFrameAndPace(recordingStart + videoTimeSec * 1000);
    drawOverlayFrame(composeCtx, composeCanvas, map, track, vehicle, profileBg, {
      title: p.title,
      cur: p.path[pathIndex],
      progress: (pathIndex + 1) / p.totalFrames,
      zoom: p.zoom,
      pitch: p.pitch,
      timeSec: videoTimeSec,
      photoClips: scaledPhotoClips,
      textOverlays: scaledTextOverlays,
      showAltitudeProfile: video.showAltitudeProfile,
    });
    recCtx.drawImage(composeCanvas, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.outW, crop.outH);
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
