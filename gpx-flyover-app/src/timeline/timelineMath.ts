import type { PhotoClip } from '../types/domain';

// Calamita: arrotonda un valore in secondi al candidato più vicino (0, durata totale, playhead,
// bordi di altri blocchi) se entro una piccola soglia — utile per accostare i blocchi senza buchi.
// Port 1:1 da gpx-flyover.html:669.
export function snapValue(value: number, candidates: number[], thresholdSec: number): number {
  let best = value;
  let bestDist = thresholdSec;
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// Converte un istante della timeline VIDEO in un istante della timeline di VOLO (percorso),
// congelando l'avanzamento durante gli intervalli in cui è attiva una foto — il volo
// riprende esattamente da dove si trovava quando la foto termina.
// Port 1:1 da gpx-flyover.html:614.
export function videoTimeToPathTime(videoTime: number, photoClips: PhotoClip[]): number {
  const sorted = [...photoClips].sort((a, b) => a.videoStart - b.videoStart);
  let subtracted = 0;
  for (const photo of sorted) {
    if (videoTime <= photo.videoStart) break;
    if (videoTime >= photo.videoStart + photo.duration) {
      subtracted += photo.duration; // foto già passata: tutto il suo tempo non conta per il volo
    } else {
      subtracted += videoTime - photo.videoStart; // dentro la foto adesso: congela qui
      break;
    }
  }
  return Math.max(0, videoTime - subtracted);
}

// Port 1:1 da gpx-flyover.html:629.
export function computePathIndex(
  videoTimeSec: number,
  totalFrames: number,
  fps: number,
  photoClips: PhotoClip[],
): number {
  const pt = videoTimeToPathTime(videoTimeSec, photoClips);
  return Math.max(0, Math.min(totalFrames - 1, Math.round(pt * fps)));
}
