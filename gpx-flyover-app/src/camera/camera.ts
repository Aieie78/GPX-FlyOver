import { resamplePath } from '../geo/geo';
import type { AnimParams, CameraParams, FrameCamera, Track, VideoParams } from '../types/domain';

// Port 1:1 da gpx-flyover.html:506
export function bearingBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Offset verticale in pixel schermo dovuto alla quota, in proporzione al pitch della camera.
// Port 1:1 da gpx-flyover.html:517.
export function altitudeOffsetPx(altitudeMeters: number, lat: number, zoom: number, pitchDeg: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return (altitudeMeters / metersPerPixel) * Math.sin((pitchDeg * Math.PI) / 180);
}

// Costruisce i parametri di animazione (percorso ricampionato, lookahead, ecc.).
// Port di buildAnimParams da gpx-flyover.html:679, con i parametri passati esplicitamente
// invece di letti dal DOM.
export function buildAnimParams(
  track: Track,
  video: VideoParams,
  camera: CameraParams,
  title: string,
  durationOverrideSec?: number,
): AnimParams {
  const duration = durationOverrideSec ?? video.durationSec;
  const fps = video.fps;
  const totalFrames = Math.round(duration * fps);
  const path = resamplePath(track, totalFrames);
  // lookahead come frazione dell'intero percorso: la camera segue l'andamento GENERALE
  // del tragitto, non ogni singola curva locale (lettura d'insieme tipo panoramica)
  const lookAheadFrames = Math.max(3, Math.round(totalFrames * 0.08));
  return {
    duration,
    fps,
    pitch: camera.pitch,
    zoom: camera.zoom,
    orbitAmp: camera.orbitAmp,
    orbitPeriod: camera.orbitPeriod,
    totalFrames,
    path,
    title: title || 'Il mio giro',
    lookAheadFrames,
  };
}

// Avanza di un passo il filtro passa-basso del bearing (usato sia in registrazione che in anteprima).
// Port 1:1 da gpx-flyover.html:696.
export function stepBearing(sb: number, i: number, p: AnimParams): number {
  const cur = p.path[i];
  const next = p.path[Math.min(i + p.lookAheadFrames, p.totalFrames - 1)];
  const target = bearingBetween({ lat: cur.camLat, lon: cur.camLon }, { lat: next.camLat, lon: next.camLon });
  const diff = ((target - sb + 540) % 360) - 180;
  return (sb + diff * 0.035 + 360) % 360;
}

// Port 1:1 da gpx-flyover.html:704
export function initialBearing(p: AnimParams): number {
  const nextIdx = Math.min(p.lookAheadFrames, p.totalFrames - 1);
  return bearingBetween(
    { lat: p.path[0].camLat, lon: p.path[0].camLon },
    { lat: p.path[nextIdx].camLat, lon: p.path[nextIdx].camLon },
  );
}

// Port 1:1 da gpx-flyover.html:711
export function cameraForFrame(p: AnimParams, i: number, smoothBearing: number): FrameCamera {
  const cur = p.path[i];
  const t = i / p.fps;
  const orbitOffset = p.orbitAmp * Math.sin((2 * Math.PI * t) / p.orbitPeriod);
  const displayBearing = (smoothBearing + orbitOffset + 360) % 360;
  return { center: [cur.camLon, cur.camLat], zoom: p.zoom, pitch: p.pitch, bearing: displayBearing };
}
