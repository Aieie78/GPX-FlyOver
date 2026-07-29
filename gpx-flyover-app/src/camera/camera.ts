import type { CameraParams, TrackPoint, VideoParams } from '../types/domain';

export interface AnimParams {
  duration: number;
  fps: number;
  pitch: number;
  zoom: number;
  orbitAmp: number;
  totalFrames: number;
}

export interface FrameCamera {
  center: [number, number];
  bearing: number;
  pitch: number;
  zoom: number;
}

/** TODO(fase 2): port da gpx-flyover.html:679 (legge anche i parametri video correnti) */
export function buildAnimParams(_video: VideoParams, _camera: CameraParams, _durationOverrideSec?: number): AnimParams {
  throw new Error('buildAnimParams: not implemented — port from gpx-flyover.html:679');
}

/** Bearing tra due punti, in gradi. TODO(fase 2): port da gpx-flyover.html:506 */
export function bearingBetween(_a: TrackPoint, _b: TrackPoint): number {
  throw new Error('bearingBetween: not implemented — port from gpx-flyover.html:506');
}

/** Bearing iniziale sulla direzione generale del percorso. TODO(fase 2): port da gpx-flyover.html:704 */
export function initialBearing(_pts: TrackPoint[]): number {
  throw new Error('initialBearing: not implemented — port from gpx-flyover.html:704');
}

/** Smoothing del bearing frame-by-frame (evita scatti sulle curve locali). TODO(fase 2): port da gpx-flyover.html:696 */
export function stepBearing(_smoothBearing: number, _frameIndex: number, _pts: TrackPoint[]): number {
  throw new Error('stepBearing: not implemented — port from gpx-flyover.html:696');
}

/** Offset in pixel dell'icona per la modalità "quota reale". TODO(fase 2): port da gpx-flyover.html:517 */
export function altitudeOffsetPx(_altitudeMeters: number, _lat: number, _zoom: number, _pitchDeg: number): number {
  throw new Error('altitudeOffsetPx: not implemented — port from gpx-flyover.html:517');
}

/** Calcola centro/bearing/pitch/zoom camera per il frame i, incluso l'orbit cinematico. TODO(fase 2): port da gpx-flyover.html:711 */
export function cameraForFrame(_pts: TrackPoint[], _i: number, _smoothBearing: number, _anim: AnimParams): FrameCamera {
  throw new Error('cameraForFrame: not implemented — port from gpx-flyover.html:711');
}
