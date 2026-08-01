import type { PathPoint, Track, TrackPoint } from '../types/domain';

// Port 1:1 da gpx-flyover.html:381
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rotta (bearing) da a a b, in gradi 0..360 rispetto al nord. Port 1:1 da gpx-flyover.html:506
// (spostata qui da camera/camera.ts, che la importa, per poterla riusare anche in resamplePath
// senza creare un import circolare camera.ts↔geo.ts).
export function bearingBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Port 1:1 da gpx-flyover.html:390
export function fmtDuration(sec: number | null): string {
  if (sec == null) return 'n/d';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Ricampiona il percorso in nFrames punti equidistanti sulla distanza cumulativa.
// Port 1:1 da gpx-flyover.html:483.
export function resamplePath(track: Track, nFrames: number): PathPoint[] {
  const out: PathPoint[] = [];
  for (let i = 0; i < nFrames; i++) {
    const targetDist = (i / (nFrames - 1)) * track.totalDist;
    let lo = 0;
    let hi = track.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (track.cum[mid] < targetDist) lo = mid + 1;
      else hi = mid;
    }
    const idx = Math.max(1, lo);
    const p0 = track.pts[idx - 1];
    const p1 = track.pts[idx];
    const d0 = track.cum[idx - 1];
    const d1 = track.cum[idx];
    const t = d1 > d0 ? (targetDist - d0) / (d1 - d0) : 0;

    // Velocità reale istantanea: dai timestamp <time> originali del tratto p0→p1 (se presenti),
    // NON dal ritmo del video — indipendente da durata/fps/velocità di riproduzione impostati.
    let speedKmh: number | null = null;
    if (p0.time && p1.time) {
      const dtSec = (p1.time.getTime() - p0.time.getTime()) / 1000;
      if (dtSec > 0) speedKmh = ((d1 - d0) / dtSec) * 3.6;
    }
    // Rotta reale del tratto p0→p1 (posizione grezza, non smussata) — indipendente dal bearing
    // della camera (che usa smoothedLat/Lon a scopo diverso: un movimento fluido dell'inquadratura).
    const headingDeg = d1 > d0 ? bearingBetween(p0, p1) : 0;
    const clockTimeMs = p0.time && p1.time ? p0.time.getTime() + (p1.time.getTime() - p0.time.getTime()) * t : null;

    out.push({
      lat: p0.lat + (p1.lat - p0.lat) * t,
      lon: p0.lon + (p1.lon - p0.lon) * t,
      camLat: track.smoothedLat[idx - 1] + (track.smoothedLat[idx] - track.smoothedLat[idx - 1]) * t,
      camLon: track.smoothedLon[idx - 1] + (track.smoothedLon[idx] - track.smoothedLon[idx - 1]) * t,
      ele: track.smoothedEle[idx - 1] + (track.smoothedEle[idx] - track.smoothedEle[idx - 1]) * t,
      dist: targetDist,
      speedKmh,
      headingDeg,
      clockTimeMs,
    });
  }
  return out;
}

// Sottoinsieme dei punti di una traccia che hanno un timestamp <time> valido, in ordine — usato
// da findPointAtTime per la sincronizzazione multi-mezzo (Fase 5.3). Costruito una volta per
// traccia per sessione di anteprima/export, non per frame: rifiltrare ad ogni chiamata sarebbe
// costoso su tracce con decine di migliaia di punti.
export interface TimeIndexedTrack {
  pts: TrackPoint[];
}

export function buildTimeIndex(track: Track): TimeIndexedTrack {
  return { pts: track.pts.filter((p) => p.time != null) };
}

// Trova il punto interpolato di una traccia secondaria al timestamp reale targetTimeMs (epoch
// ms), per la sincronizzazione multi-mezzo per orario GPX reale (non per distanza/tempo-video).
// Ricerca binaria sullo stesso schema di resamplePath, ma su pts[i].time invece che su cum.
// Ritorna null se targetTimeMs cade prima del primo o dopo l'ultimo punto con time valido (la
// traccia non copre quell'istante) — il chiamante non disegna l'icona per quel frame, come
// richiesto dalla spec (nessun errore, nessuna posizione inventata).
export interface TimedPoint {
  lat: number;
  lon: number;
  ele: number;
  speedKmh: number | null;
  headingDeg: number;
  idx: number;
}

export function findPointAtTime(index: TimeIndexedTrack, targetTimeMs: number): TimedPoint | null {
  const { pts } = index;
  if (pts.length === 0) return null;
  const firstMs = pts[0].time!.getTime();
  const lastMs = pts[pts.length - 1].time!.getTime();
  if (targetTimeMs < firstMs || targetTimeMs > lastMs) return null;

  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].time!.getTime() < targetTimeMs) lo = mid + 1;
    else hi = mid;
  }
  const idx = Math.max(1, lo);
  const p0 = pts[idx - 1];
  const p1 = pts[idx];
  const t0 = p0.time!.getTime();
  const t1 = p1.time!.getTime();
  const t = t1 > t0 ? (targetTimeMs - t0) / (t1 - t0) : 0;

  // Velocità/rotta reali del tratto p0→p1 — stesso calcolo di resamplePath, per il riquadro
  // "dati in tempo reale" di una traccia secondaria (Fase 5.3-bis).
  const distM = haversine(p0, p1);
  const dtSec = (t1 - t0) / 1000;
  const speedKmh = dtSec > 0 ? (distM / dtSec) * 3.6 : null;
  const headingDeg = distM > 0 ? bearingBetween(p0, p1) : 0;

  return {
    lat: p0.lat + (p1.lat - p0.lat) * t,
    lon: p0.lon + (p1.lon - p0.lon) * t,
    ele: p0.ele + (p1.ele - p0.ele) * t,
    speedKmh,
    headingDeg,
    idx,
  };
}
