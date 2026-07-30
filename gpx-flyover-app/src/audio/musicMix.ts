import type { MusicTrack } from '../types/domain';

const MAX_CROSSFADE_SEC = 1.5;

export interface MusicFadeWindow {
  start: number;
  end: number;
  fadeInEnd: number; // start + durata fade-in (== start se nessuna dissolvenza in entrata)
  fadeOutStart: number; // end - durata fade-out (== end se nessuna dissolvenza in uscita)
}

// Calcola, per ogni brano, la finestra di dissolvenza incrociata dovuta alla sovrapposizione con
// il brano immediatamente precedente/successivo (per inizio) sulla timeline — stessa logica di
// getActivePhotoLayers (photoEngine.ts), adattata da "adiacenza tollerata" a "sovrapposizione
// reale nel tempo", dato che più brani musicali possono ora sovrapporsi genuinamente (tracce
// impilabili). Il brano che finisce sfuma in uscita esattamente nella finestra in cui il
// successivo è già iniziato, e viceversa.
export function computeMusicFadeWindows(tracks: MusicTrack[]): Map<number, MusicFadeWindow> {
  const sorted = [...tracks].sort((a, b) => a.videoStart - b.videoStart);
  const result = new Map<number, MusicFadeWindow>();

  sorted.forEach((t, i) => {
    const length = t.trimEnd - t.trimStart;
    const start = t.videoStart;
    const end = start + length;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];

    let fadeInSec = 0;
    if (prev) {
      const prevEnd = prev.videoStart + (prev.trimEnd - prev.trimStart);
      const overlap = prevEnd - start;
      if (overlap > 0) fadeInSec = Math.min(MAX_CROSSFADE_SEC, overlap, length / 2);
    }
    let fadeOutSec = 0;
    if (next) {
      const overlap = end - next.videoStart;
      if (overlap > 0) fadeOutSec = Math.min(MAX_CROSSFADE_SEC, overlap, length / 2);
    }

    result.set(t.id, { start, end, fadeInEnd: start + fadeInSec, fadeOutStart: end - fadeOutSec });
  });

  return result;
}

// Moltiplicatore [0,1] dovuto SOLO alla dissolvenza incrociata (non include volume/mute/solo)
// nell'istante videoTime.
export function crossfadeGainAt(window: MusicFadeWindow, videoTime: number): number {
  if (videoTime <= window.start || videoTime >= window.end) return 0;
  let g = 1;
  if (videoTime < window.fadeInEnd) g = (videoTime - window.start) / (window.fadeInEnd - window.start);
  if (videoTime > window.fadeOutStart) {
    g = Math.min(g, (window.end - videoTime) / (window.end - window.fadeOutStart));
  }
  return Math.max(0, Math.min(1, g));
}

// Volume "di picco" di un brano (senza dissolvenza incrociata): 0 se mutato, oppure se è attivo
// un "solo" su un ALTRO brano.
export function effectiveTrackVolume(track: MusicTrack, anySolo: boolean): number {
  if (track.muted) return 0;
  if (anySolo && !track.solo) return 0;
  return track.volume;
}

// Programma su un AudioParam (GainNode.gain) la rampa 0→picco→0 corrispondente alla finestra di
// dissolvenza, in coordinate assolute di AudioContext (timeOffset è il ctx-time corrispondente a
// videoTime=0: 0 per il rendering offline, `startAt` per la registrazione in tempo reale).
// actualEnd tronca la dissolvenza in uscita se il brano viene tagliato prima della sua fine
// nominale (fine video/trim), evitando di programmare una rampa oltre la sorgente già fermata.
export function scheduleTrackGainEnvelope(
  gainParam: AudioParam,
  peak: number,
  window: MusicFadeWindow,
  actualEnd: number,
  timeOffset: number,
): void {
  const fadeInEnd = Math.min(window.fadeInEnd, actualEnd);
  const fadeOutStart = Math.min(window.fadeOutStart, actualEnd);
  const hasFadeIn = fadeInEnd > window.start;

  gainParam.setValueAtTime(hasFadeIn ? 0 : peak, timeOffset + window.start);
  if (hasFadeIn) gainParam.linearRampToValueAtTime(peak, timeOffset + fadeInEnd);
  if (fadeOutStart < actualEnd) {
    gainParam.setValueAtTime(peak, timeOffset + fadeOutStart);
    gainParam.linearRampToValueAtTime(0, timeOffset + actualEnd);
  }
}
