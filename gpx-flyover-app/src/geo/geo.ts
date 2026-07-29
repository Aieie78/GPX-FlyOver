import type { Track, TrackPoint } from '../types/domain';

/** Distanza in metri tra due coordinate. TODO(fase 2): port da gpx-flyover.html:381 */
export function haversine(_a: { lat: number; lon: number }, _b: { lat: number; lon: number }): number {
  throw new Error('haversine: not implemented — port from gpx-flyover.html:381');
}

/** Formatta una durata in secondi come "Xh Ym". TODO(fase 2): port da gpx-flyover.html:390 */
export function fmtDuration(_sec: number): string {
  throw new Error('fmtDuration: not implemented — port from gpx-flyover.html:390');
}

/** Ricampiona il percorso in nFrames punti equispaziati per distanza. TODO(fase 2): port da gpx-flyover.html:483 */
export function resamplePath(_track: Track, _nFrames: number): TrackPoint[] {
  throw new Error('resamplePath: not implemented — port from gpx-flyover.html:483');
}
