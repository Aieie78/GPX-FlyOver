import type { PathPoint, Track } from '../types/domain';

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

    out.push({
      lat: p0.lat + (p1.lat - p0.lat) * t,
      lon: p0.lon + (p1.lon - p0.lon) * t,
      camLat: track.smoothedLat[idx - 1] + (track.smoothedLat[idx] - track.smoothedLat[idx - 1]) * t,
      camLon: track.smoothedLon[idx - 1] + (track.smoothedLon[idx] - track.smoothedLon[idx - 1]) * t,
      ele: track.smoothedEle[idx - 1] + (track.smoothedEle[idx] - track.smoothedEle[idx - 1]) * t,
      dist: targetDist,
      speedKmh,
    });
  }
  return out;
}
