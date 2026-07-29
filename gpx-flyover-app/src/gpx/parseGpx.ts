import { haversine } from '../geo/geo';
import type { SegmentMode, Track, TrackPoint } from '../types/domain';

// Port 1:1 da gpx-flyover.html:268-379.
export function parseGpx(xmlText: string, segmentMode: SegmentMode): Track {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const segments = [...xml.getElementsByTagName('trkseg')];
  const segGroups = segments.length
    ? segments.map((seg) => [...seg.getElementsByTagName('trkpt')])
    : [[...xml.getElementsByTagName('trkpt')]]; // fallback: nessun trkseg, tutti i trkpt insieme

  const nSegmentsFound = segGroups.length;
  let trkpts: Element[];
  if (segmentMode === 'concat') {
    // concatena tutti i segmenti in ordine (utile per registrazioni lunghe interrotte da pause/riavvii GPS)
    trkpts = segGroups.flat();
  } else {
    // default: tiene solo il segmento più lungo (utile se il file unisce più giorni diversi)
    segGroups.sort((a, b) => b.length - a.length);
    trkpts = segGroups[0];
  }
  if (!trkpts.length) throw new Error('Nessun trkpt trovato nel GPX');

  // decimazione automatica per tracce molto dense: oltre 40.000 punti manteniamo solo
  // 1 punto ogni N, per restare fluidi nel rendering 3D senza perdere la forma del percorso
  const originalCount = trkpts.length;
  const MAX_PTS = 40000;
  let decimated = false;
  if (trkpts.length > MAX_PTS) {
    const step = Math.ceil(trkpts.length / MAX_PTS);
    trkpts = trkpts.filter((_, i) => i % step === 0);
    decimated = true;
  }

  const findElevation = (pt: Element): number => {
    const eleNode = pt.getElementsByTagName('ele')[0];
    if (eleNode) {
      const v = parseFloat(eleNode.textContent ?? '');
      if (!isNaN(v)) return v;
    }
    // fallback: cerca qualsiasi elemento discendente con nome tipo ele/alt/altitude
    // (alcuni logger di volo/elicottero usano tag non standard, es. dentro <extensions>)
    const all = pt.getElementsByTagName('*');
    for (const el of Array.from(all)) {
      if (/ele|alt/i.test(el.localName || el.tagName)) {
        const v = parseFloat(el.textContent ?? '');
        if (!isNaN(v)) return v;
      }
    }
    return NaN; // nessun dato di quota trovato per questo punto
  };

  const pts: TrackPoint[] = trkpts.map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '');
    const lon = parseFloat(pt.getAttribute('lon') ?? '');
    const timeNode = pt.getElementsByTagName('time')[0];
    return {
      lat,
      lon,
      ele: findElevation(pt),
      time: timeNode?.textContent ? new Date(timeNode.textContent) : null,
    };
  });

  // se non troviamo NESSUN dato di quota valido, usiamo 0 per non rompere i calcoli,
  // ma segnaliamo il problema all'utente invece di mostrare silenziosamente un profilo piatto
  const validEleCount = pts.filter((p) => !isNaN(p.ele)).length;
  const hasElevationData = validEleCount > pts.length * 0.5; // almeno metà punti con quota valida
  pts.forEach((p) => {
    if (isNaN(p.ele)) p.ele = 0;
  });

  // smoothing elevazione (media mobile) per ridurre rumore GPS
  const win = 5;
  const smoothedEle = pts.map((_p, i) => {
    const s = Math.max(0, i - win);
    const e = Math.min(pts.length, i + win + 1);
    const slice = pts.slice(s, e).map((x) => x.ele);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // smoothing coordinate (media mobile, finestra più ampia) per ridurre lo zig-zag GPS
  // che altrimenti si traduce in oscillazioni laterali della camera durante il volo
  const posWin = 8;
  const smoothedLat = pts.map((_p, i) => {
    const s = Math.max(0, i - posWin);
    const e = Math.min(pts.length, i + posWin + 1);
    const slice = pts.slice(s, e).map((x) => x.lat);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const smoothedLon = pts.map((_p, i) => {
    const s = Math.max(0, i - posWin);
    const e = Math.min(pts.length, i + posWin + 1);
    const slice = pts.slice(s, e).map((x) => x.lon);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // distanza cumulativa (haversine, calcolata sulle coordinate ORIGINALI per non alterare km reali) + elevation gain
  const cum = [0];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
    const d = smoothedEle[i] - smoothedEle[i - 1];
    if (d > 0.3) gain += d;
    else if (d < -0.3) loss += -d;
  }

  const totalDist = cum[cum.length - 1];
  const hasTime = pts[0].time && pts[pts.length - 1].time;
  const durationSec = hasTime
    ? (pts[pts.length - 1].time!.getTime() - pts[0].time!.getTime()) / 1000
    : null;

  // profilo altimetrico ricampionato (per il disegno della sagoma nel video, ~250 punti)
  const profileN = 250;
  const profile: number[] = [];
  for (let i = 0; i < profileN; i++) {
    const targetDist = (i / (profileN - 1)) * totalDist;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < targetDist) lo = mid + 1;
      else hi = mid;
    }
    const idx = Math.max(1, lo);
    const d0 = cum[idx - 1];
    const d1 = cum[idx];
    const t = d1 > d0 ? (targetDist - d0) / (d1 - d0) : 0;
    profile.push(smoothedEle[idx - 1] + (smoothedEle[idx] - smoothedEle[idx - 1]) * t);
  }

  const minEle = Math.min(...smoothedEle);
  return {
    pts,
    smoothedEle,
    smoothedLat,
    smoothedLon,
    cum,
    totalDist,
    gain,
    loss,
    durationSec,
    nSegmentsFound,
    profile,
    decimated,
    originalCount,
    usedCount: pts.length,
    hasElevationData,
    minEle,
  };
}
