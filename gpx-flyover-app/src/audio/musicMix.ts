import type { MusicTrack } from '../types/domain';

const OFFLINE_SAMPLE_RATE = 48000;

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

// Ritaglia un AudioBuffer già mixato al solo intervallo [startSec, endSec) — usata per esportare
// solo la porzione di video selezionata con le maniglie di inizio/fine (PreviewControls.tsx):
// più semplice e robusto che riprogrammare la dissolvenza incrociata di ogni singolo brano con
// tempi relativi al nuovo inizio (specie per i brani che iniziavano PRIMA del ritaglio), dato che
// il mix è già stato calcolato correttamente sull'intera durata nominale. Applica anche una breve
// dissolvenza in uscita (fadeOutSec) sulla coda del ritaglio, per non tagliare la musica di netto
// quando il ritaglio finisce prima della dissolvenza finale naturale già inclusa nel mix.
export function sliceAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number, fadeOutSec = 2): AudioBuffer {
  const sr = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const endSample = Math.min(buffer.length, Math.ceil(endSec * sr));
  const length = Math.max(1, endSample - startSample);
  const out = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length, sampleRate: sr });
  const fadeSamples = Math.min(length, Math.round(fadeOutSec * sr));
  const fadeStart = length - fadeSamples;
  const tmp = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    buffer.copyFromChannel(tmp, ch, startSample);
    for (let i = 0; i < fadeSamples; i++) {
      tmp[fadeStart + i] *= 1 - i / fadeSamples;
    }
    out.copyToChannel(tmp, ch, 0);
  }
  return out;
}

// Rende in modo deterministico l'intero mix musicale (sovrapposizioni + dissolvenza finale) in
// UN SOLO AudioBuffer, su un OfflineAudioContext — non vincolato al tempo reale. Usata sia dal
// rendering deterministico (deterministicExport.ts) sia dalla registrazione in tempo reale
// (recordFlight, videoExport.ts): quest'ultima riproduce dal vivo il buffer già mixato/tagliato
// (con sliceAudioBuffer) invece di programmare ogni brano live — più semplice e robusto,
// specialmente per esportare solo una PORZIONE selezionata del video (le dissolvenze di brani
// che iniziano prima del ritaglio sono già risolte correttamente nel mix offline). Ritorna null
// se non c'è musica utile. I musicTracks passati devono essere già riscalati per la velocità
// (scaleMusicTracksForSpeed).
export async function renderMusicMixOffline(
  musicTracks: MusicTrack[],
  musicVolume: number,
  durationSec: number,
): Promise<AudioBuffer | null> {
  const anySolo = musicTracks.some((t) => t.solo);
  const hasMusic = musicTracks.some((t) => t.trimEnd - t.trimStart > 0.05 && effectiveTrackVolume(t, anySolo) > 0);
  if (!hasMusic) return null;

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(durationSec * OFFLINE_SAMPLE_RATE), OFFLINE_SAMPLE_RATE);
  const gainNode = offlineCtx.createGain();
  gainNode.gain.value = musicVolume;
  gainNode.connect(offlineCtx.destination);

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

  // dissolvenza finale (ultimi 2 secondi), per non tagliare la musica di netto
  const fadeStart = Math.max(0, durationSec - 2);
  gainNode.gain.setValueAtTime(musicVolume, fadeStart);
  gainNode.gain.linearRampToValueAtTime(0, fadeStart + 2);

  return offlineCtx.startRendering();
}
