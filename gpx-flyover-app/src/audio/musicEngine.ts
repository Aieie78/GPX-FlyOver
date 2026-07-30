import type { MusicTrack } from '../types/domain';
import { computeMusicFadeWindows, crossfadeGainAt, effectiveTrackVolume } from './musicMix';

// Contesto audio e nodo di volume condivisi (decodifica + anteprima), come i globali
// audioCtx/musicGain di gpx-flyover.html:822-836.
let audioCtx: AudioContext | null = null;
let musicGain: GainNode | null = null;

export function ensureAudioCtx(initialVolume: number): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (!musicGain) {
    musicGain = audioCtx.createGain();
    musicGain.gain.value = initialVolume;
    musicGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

export function setMusicGainVolume(volume: number): void {
  if (musicGain) musicGain.gain.value = volume;
}

// Port 1:1 da gpx-flyover.html:862.
export function fmtMinSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

let musicIdSeq = 0;
export function nextMusicId(): number {
  return musicIdSeq++;
}

// Decodifica un file audio caricato e calcola la posizione di attacco predefinita (in coda
// alle tracce esistenti). Port della logica in gpx-flyover.html:842-860.
export async function decodeMusicFile(
  file: File,
  existingTracks: MusicTrack[],
  totalDurationSec: number,
  volume: number,
): Promise<MusicTrack> {
  const ctx = ensureAudioCtx(volume);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  const defaultStart = existingTracks.reduce(
    (max, t) => Math.max(max, t.videoStart + (t.trimEnd - t.trimStart)),
    0,
  );
  const availableSpace = Math.max(0.5, totalDurationSec - defaultStart);
  const initialTrimEnd = Math.min(buffer.duration, availableSpace);
  return {
    id: nextMusicId(),
    name: file.name,
    buffer,
    duration: buffer.duration,
    trimStart: 0,
    trimEnd: initialTrimEnd,
    videoStart: defaultStart,
    volume: 1,
    muted: false,
    solo: false,
  };
}

// Decodifica un file audio e lo posiziona esattamente al punto di riproduzione attuale
// (pulsante "+" nella corsia musica), stesso comportamento del "+" nella corsia foto
// (gpx-flyover.html:1079-1095, adattato alla musica: nessun equivalente diretto nell'originale,
// che caricava i brani solo in coda tramite il selettore multiplo).
export async function decodeMusicFileAtPlayhead(
  file: File,
  totalDurationSec: number,
  playheadSec: number,
  volume: number,
): Promise<MusicTrack> {
  const ctx = ensureAudioCtx(volume);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  const videoStart = Math.max(0, Math.min(totalDurationSec - 0.5, playheadSec));
  const availableSpace = Math.max(0.5, totalDurationSec - videoStart);
  const initialTrimEnd = Math.min(buffer.duration, availableSpace);
  return {
    id: nextMusicId(),
    name: file.name,
    buffer,
    duration: buffer.duration,
    trimStart: 0,
    trimEnd: initialTrimEnd,
    videoStart,
    volume: 1,
    muted: false,
    solo: false,
  };
}

export interface ActiveMusicTrack {
  trackIndex: number;
  offsetInTrack: number;
  remaining: number;
}

// Trova tutte le tracce "attive" nel punto timeSec del video (più tracce possono sovrapporsi:
// verranno mixate insieme). Port 1:1 da gpx-flyover.html:965.
export function computeActiveTracksAt(musicTracks: MusicTrack[], timeSec: number): ActiveMusicTrack[] {
  const active: ActiveMusicTrack[] = [];
  musicTracks.forEach((t, trackIndex) => {
    const length = t.trimEnd - t.trimStart;
    if (length <= 0.05) return;
    if (timeSec >= t.videoStart && timeSec < t.videoStart + length) {
      active.push({
        trackIndex,
        offsetInTrack: t.trimStart + (timeSec - t.videoStart),
        remaining: t.videoStart + length - timeSec,
      });
    }
  });
  return active;
}

interface ActivePreviewEntry {
  source: AudioBufferSourceNode;
  gain: GainNode;
  trackId: number;
}

interface MusicPreviewState {
  entries: ActivePreviewEntry[];
  activeKey: string;
  expectedOffsets: Record<number, number>;
}

let musicPreviewState: MusicPreviewState = { entries: [], activeKey: '', expectedOffsets: {} };

// "Orologio" musicale indipendente dalla velocità video: avanza sempre in tempo reale (x1),
// e viene semplicemente riallineato (non accelerato) quando si fa un salto/seek o si riprende
// il play. Port 1:1 da gpx-flyover.html:990-1001.
let musicAnchorWallTime: number | null = null;
let musicAnchorVideoTime = 0;

export function stopMusicPreview(): void {
  musicPreviewState.entries.forEach(({ source }) => {
    try {
      source.stop();
    } catch {
      /* già fermata */
    }
  });
  musicPreviewState = { entries: [], activeKey: '', expectedOffsets: {} };
}

export function resetMusicAnchor(videoTimeSec: number): void {
  musicAnchorWallTime = performance.now() / 1000;
  musicAnchorVideoTime = videoTimeSec;
}

export function getMusicVirtualTime(): number {
  if (musicAnchorWallTime == null) return musicAnchorVideoTime;
  return musicAnchorVideoTime + (performance.now() / 1000 - musicAnchorWallTime);
}

// Chiamata ad ogni frame renderizzato dell'anteprima: fa ripartire le sorgenti solo quando
// cambia l'insieme di tracce attive o c'è una deriva ampia rispetto all'atteso; il volume
// per-traccia (dissolvenza incrociata inclusa) viene invece aggiornato OGNI chiamata, dato che
// varia con continuità nel tempo anche quando non serve riavviare nessuna sorgente.
// Port 1:1 da gpx-flyover.html:1003-1044, esteso con gain per traccia (volume/mute/solo/dissolvenza).
export function syncMusicPreview(musicTracks: MusicTrack[], playing: boolean): void {
  if (!musicTracks.length) return;

  if (!playing) {
    if (musicPreviewState.entries.length) stopMusicPreview();
    return;
  }

  const timeSec = getMusicVirtualTime();
  const active = computeActiveTracksAt(musicTracks, timeSec);
  const anySolo = musicTracks.some((t) => t.solo);
  const fadeWindows = computeMusicFadeWindows(musicTracks);

  const key = active.map((a) => a.trackIndex).join(',');
  const drift = active.some((a) => {
    const expected = musicPreviewState.expectedOffsets[a.trackIndex];
    return expected == null || Math.abs(expected - a.offsetInTrack) > 0.4;
  });
  const needsRestart = key !== musicPreviewState.activeKey || drift;

  if (!needsRestart) {
    // nessuna sorgente da (ri)avviare: solo aggiornamento continuo dei volumi/dissolvenze
    musicPreviewState.entries.forEach((entry) => {
      const track = musicTracks.find((t) => t.id === entry.trackId);
      const window = track && fadeWindows.get(track.id);
      const g = track && window ? effectiveTrackVolume(track, anySolo) * crossfadeGainAt(window, timeSec) : 0;
      entry.gain.gain.value = g;
    });
    return;
  }

  musicPreviewState.entries.forEach(({ source }) => {
    try {
      source.stop();
    } catch {
      /* già fermata */
    }
  });

  if (!active.length) {
    musicPreviewState = { entries: [], activeKey: '', expectedOffsets: {} };
    return;
  }

  const ctx = ensureAudioCtx(musicGain?.gain.value ?? 0.6);
  const entries: ActivePreviewEntry[] = [];
  const expectedOffsets: Record<number, number> = {};
  active.forEach((a) => {
    const track = musicTracks[a.trackIndex];
    const window = fadeWindows.get(track.id);
    const trackGain = ctx.createGain();
    trackGain.gain.value = window ? effectiveTrackVolume(track, anySolo) * crossfadeGainAt(window, timeSec) : 0;
    trackGain.connect(musicGain!);
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    // playbackRate resta sempre 1: la musica avanza in tempo reale, mai accelerata/rallentata
    source.connect(trackGain);
    source.start(0, a.offsetInTrack, a.remaining);
    entries.push({ source, gain: trackGain, trackId: track.id });
    expectedOffsets[a.trackIndex] = a.offsetInTrack;
  });

  musicPreviewState = { entries, activeKey: key, expectedOffsets };
}
