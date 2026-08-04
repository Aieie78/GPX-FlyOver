import type { MaxSpeedMarkerParams, MaxSpeedPoint, PhotoClip } from '../types/domain';

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

// Zona di rallentamento intorno al punto di velocità massima, espressa in frazione di distanza
// (0..1) lungo il percorso — path[] è ricampionato a distanza costante (resamplePath, geo.ts),
// quindi la frazione di distanza coincide con la frazione di indice del percorso. factor è la
// velocità relativa del volo dentro la zona (0..1: 1 = nessun rallentamento).
export interface SlowZone {
  fStart: number;
  fEnd: number;
  factor: number;
}

// Costruisce la zona di rallentamento dalle impostazioni utente (pannello Mezzo) e dal punto di
// velocità massima EFFETTIVO della traccia principale (getEffectiveMaxSpeedPoint, geo.ts — tiene
// conto delle esclusioni di "Scarta questo punto") — null se non c'è un punto valido (nessun
// timestamp GPX, o tutti esclusi) o se la finestra risultante è vuota (bordo del percorso +
// entrambe le distanze nulle). Va ricalcolata quando cambiano traccia/esclusioni/impostazioni, non
// ad ogni fotogramma — ma è pura aritmetica: anche chiamarla ogni fotogramma è a costo trascurabile.
export function computeSlowZone(maxSpeedPoint: MaxSpeedPoint | null, totalDist: number, marker: MaxSpeedMarkerParams): SlowZone | null {
  if (!maxSpeedPoint || totalDist <= 0) return null;
  const f0 = maxSpeedPoint.dist / totalDist;
  const fStart = Math.max(0, f0 - marker.slowdownBeforeM / totalDist);
  const fEnd = Math.min(1, f0 + marker.slowdownAfterM / totalDist);
  if (fEnd <= fStart) return null;
  const factor = Math.min(1, Math.max(0.01, marker.slowdownFactor));
  return { fStart, fEnd, factor };
}

// Quanto tempo IN PIÙ (secondi) la zona di rallentamento aggiunge rispetto a un volo a ritmo
// costante di durata flightRecommendedSec — usato per il suggerimento "durata totale consigliata"
// (GpxSourcePanel.tsx): la porzione di percorso Δf coperta dalla zona, che al ritmo normale
// richiederebbe Δf*flightRecommendedSec, ne richiede invece Δf*flightRecommendedSec/factor.
export function slowZoneExtraSeconds(slowZone: SlowZone | null, flightRecommendedSec: number): number {
  if (!slowZone) return 0;
  const dfSlow = slowZone.fEnd - slowZone.fStart;
  return dfSlow * flightRecommendedSec * (1 / slowZone.factor - 1);
}

// Converte "tempo di volo grezzo" (rawFlightTime: video-time già depurato dalle foto, 0..
// availableFlightTime) in frazione di percorso (0..1), tenendo conto dell'eventuale zona di
// rallentamento. Senza zona: rapporto costante (comportamento originale). Con zona: tre tratti a
// velocità costante — normale, rallentata (factor), normale — le cui durate si ricavano in forma
// chiusa dalla conservazione del tempo totale (niente iterazione): (1-Δf)/R + Δf/(R·factor) =
// availableFlightTime, quindi R = [(1-Δf) + Δf/factor] / availableFlightTime.
function rawFlightTimeToFraction(rawFlightTime: number, availableFlightTime: number, slowZone: SlowZone | null): number {
  if (!slowZone) {
    return Math.max(0, Math.min(1, rawFlightTime / availableFlightTime));
  }
  const { fStart, fEnd, factor } = slowZone;
  const dfSlow = fEnd - fStart;
  const rate = ((1 - dfSlow) + dfSlow / factor) / availableFlightTime;
  const t1 = fStart / rate;
  const t2 = t1 + dfSlow / (rate * factor);
  let f: number;
  if (rawFlightTime <= t1) f = rawFlightTime * rate;
  else if (rawFlightTime <= t2) f = fStart + (rawFlightTime - t1) * rate * factor;
  else f = fEnd + (rawFlightTime - t2) * rate;
  return Math.max(0, Math.min(1, f));
}

// Inversa di rawFlightTimeToFraction: dalla frazione di percorso target risale al tempo di volo
// grezzo corrispondente, invertendo lo stesso tratto a 3 segmenti.
function fractionToRawFlightTime(fraction: number, availableFlightTime: number, slowZone: SlowZone | null): number {
  if (!slowZone) return fraction * availableFlightTime;
  const { fStart, fEnd, factor } = slowZone;
  const dfSlow = fEnd - fStart;
  const rate = ((1 - dfSlow) + dfSlow / factor) / availableFlightTime;
  const t1 = fStart / rate;
  if (fraction <= fStart) return fraction / rate;
  if (fraction <= fEnd) return t1 + (fraction - fStart) / (rate * factor);
  return t1 + dfSlow / (rate * factor) + (fraction - fEnd) / rate;
}

// Converte un istante della timeline VIDEO in un istante della timeline di VOLO (percorso),
// congelando l'avanzamento durante gli intervalli in cui è attiva una foto — il volo
// riprende esattamente da dove si trovava quando la foto termina. Base 1:1 da
// gpx-flyover.html:614, con un riscalamento aggiunto: il tempo "congelato" dalle foto viene
// sottratto come prima, ma il tempo di volo risultante viene poi MOLTIPLICATO per
// totalDurationSec/tempoDiVoloDisponibile, così il percorso completa SEMPRE l'intero tracciato
// entro la durata video impostata, qualunque sia il tempo totale rubato dalle foto — altrimenti
// il volo si fermerebbe prima della fine, esattamente in proporzione al tempo delle foto (bug
// osservato: un volo di 40s con foto/musica sovrapposte si fermava al 76% del percorso).
// slowZone (opzionale) rallenta ulteriormente il tratto di percorso intorno al punto di velocità
// massima — vedi rawFlightTimeToFraction.
export function videoTimeToPathTime(
  videoTime: number,
  photoClips: PhotoClip[],
  totalDurationSec: number,
  slowZone: SlowZone | null = null,
): number {
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
  const rawFlightTime = Math.max(0, videoTime - subtracted);

  const totalPhotoTime = sorted.reduce((sum, photo) => sum + photo.duration, 0);
  const availableFlightTime = Math.max(0.001, totalDurationSec - totalPhotoTime);

  return rawFlightTimeToFraction(rawFlightTime, availableFlightTime, slowZone) * totalDurationSec;
}

// Inversa di videoTimeToPathTime: dato un punto del percorso (frazione di distanza 0..1), trova
// l'istante della timeline VIDEO (nominale, 0..totalDurationSec) in cui il volo lo attraversa —
// usata per posizionare il marcatore fisso del punto di velocità massima sul righello della
// timeline (PreviewControls.tsx). Cammina la timeline video in ordine (stessa logica della foto-
// walk sopra, ma in avanti verso il target invece che fino a un videoTime dato) accumulando tempo
// di volo solo FUORI dalle foto, fino a raggiungere il tempo di volo grezzo target.
export function pathFractionToVideoTime(
  fraction: number,
  photoClips: PhotoClip[],
  totalDurationSec: number,
  slowZone: SlowZone | null = null,
): number {
  const sorted = [...photoClips].sort((a, b) => a.videoStart - b.videoStart);
  const totalPhotoTime = sorted.reduce((sum, photo) => sum + photo.duration, 0);
  const availableFlightTime = Math.max(0.001, totalDurationSec - totalPhotoTime);
  const target = fractionToRawFlightTime(Math.max(0, Math.min(1, fraction)), availableFlightTime, slowZone);

  let videoTime = 0;
  let flightSoFar = 0;
  for (const photo of sorted) {
    const gapLength = Math.max(0, photo.videoStart - videoTime);
    if (flightSoFar + gapLength >= target) {
      return videoTime + (target - flightSoFar);
    }
    flightSoFar += gapLength;
    videoTime = Math.max(videoTime, photo.videoStart + photo.duration); // salta l'intera foto
  }
  return videoTime + (target - flightSoFar);
}

export interface RowAssignItem {
  id: number;
  start: number;
  length: number;
}

// Assegna a ciascun blocco una "sotto-riga" (0, 1, 2...) all'interno della stessa corsia, in modo
// che blocchi sovrapposti/adiacenti nel tempo finiscano su righe visive separate invece di
// impilarsi uno sopra l'altro. Algoritmo greedy classico da "interval scheduling": si scorrono i
// blocchi in ordine di inizio e si riusa la prima riga già libera (il cui ultimo blocco finisce
// prima dell'inizio di quello corrente), altrimenti se ne apre una nuova.
export function assignLaneRows(items: RowAssignItem[]): Map<number, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const rowEnds: number[] = [];
  const rows = new Map<number, number>();
  for (const item of sorted) {
    let row = rowEnds.findIndex((end) => end <= item.start + 1e-6);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(item.start + item.length);
    } else {
      rowEnds[row] = item.start + item.length;
    }
    rows.set(item.id, row);
  }
  return rows;
}

// Port 1:1 da gpx-flyover.html:629, con il riscalamento di videoTimeToPathTime propagato.
export function computePathIndex(
  videoTimeSec: number,
  totalFrames: number,
  fps: number,
  photoClips: PhotoClip[],
  slowZone: SlowZone | null = null,
): number {
  const totalDurationSec = totalFrames / fps;
  const pt = videoTimeToPathTime(videoTimeSec, photoClips, totalDurationSec, slowZone);
  return Math.max(0, Math.min(totalFrames - 1, Math.round(pt * fps)));
}
