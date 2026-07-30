// Modello dati derivato da gpx-flyover.html (parseGPX, buildAnimParams, musicTracks, photoTracks).

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  time: Date | null; // null se il GPX non ha tag <time>
}

// Ritorno di parseGpx — corrisponde 1:1 all'oggetto restituito da parseGPX in gpx-flyover.html:268.
export interface Track {
  pts: TrackPoint[]; // punti grezzi (posizione reale: linea disegnata, icona mezzo)
  smoothedEle: number[]; // quota con media mobile (riduce rumore GPS)
  smoothedLat: number[]; // lat con media mobile, più ampia — usata SOLO per la camera
  smoothedLon: number[]; // lon con media mobile, più ampia — usata SOLO per la camera
  cum: number[]; // distanza cumulata (haversine) in metri, stesso indice di pts
  totalDist: number; // metri
  gain: number; // dislivello positivo, metri
  loss: number; // dislivello negativo, metri
  durationSec: number | null; // dai tag <time> del GPX, se il primo e l'ultimo punto li hanno
  nSegmentsFound: number;
  profile: number[]; // quota ricampionata a 250 punti, per la sagoma nell'overlay export
  decimated: boolean; // true se i punti originali superavano MAX_PTS (40000)
  originalCount: number;
  usedCount: number;
  hasElevationData: boolean; // false se meno della metà dei punti aveva un tag <ele> valido
  minEle: number;
}

export type SegmentMode = 'longest' | 'concat';

// Punto del percorso ricampionato per frame — vedi resamplePath in gpx-flyover.html:483.
export interface PathPoint {
  lat: number; // posizione reale (per la linea disegnata e l'icona mezzo)
  lon: number;
  camLat: number; // posizione smussata (per la camera)
  camLon: number;
  ele: number;
  dist: number; // metri dall'inizio percorso
}

export type VideoResolution = '1280x720' | '1920x1080' | '2560x1440';
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export interface VideoParams {
  resolution: VideoResolution;
  bitrateMbps: number;
  durationSec: number;
  fps: number;
}

export interface CameraParams {
  pitch: number;
  zoom: number;
  orbitAmp: number;
  orbitPeriod: number;
}

export type MapStyleId = 'hybrid-v4' | 'satellite-v2' | 'outdoor-v2' | 'winter-v2';

export interface MapParams {
  maptilerToken: string;
  styleId: MapStyleId;
  customStyleUrl: string; // fallback, ha precedenza su styleId se non vuoto
}

export type VehicleIcon = '🏍️' | '🚗' | '🚁' | '✈️';
export type VehicleIconStyle = 'filled' | 'outline' | 'dot';

export interface VehicleParams {
  icon: VehicleIcon;
  color: string;
  iconStyle: VehicleIconStyle;
  size: number;
  use3DAltitude: boolean; // "quota reale" per tracce aeree
  altExaggeration: number;
}

export interface MusicTrack {
  id: number;
  name: string;
  buffer: AudioBuffer;
  duration: number;
  trimStart: number;
  trimEnd: number;
  videoStart: number; // posizione di attacco nel video, posizionamento libero
  volume: number; // 0..1, per singola traccia (moltiplicato per musicVolume globale)
  muted: boolean;
  solo: boolean; // se una o più tracce sono in "solo", tutte le altre sono silenziate
}

export type PhotoRotation = 0 | 90 | 180 | 270;

export interface PhotoClip {
  id: number;
  name: string;
  img: HTMLImageElement;
  videoStart: number;
  duration: number; // durata di visualizzazione
  rotation: PhotoRotation; // correzione orientamento, in step di 90°
}

// Parametri di animazione costruiti da buildAnimParams (gpx-flyover.html:679), condivisi da
// anteprima e registrazione.
export interface AnimParams {
  duration: number;
  fps: number;
  pitch: number;
  zoom: number;
  orbitAmp: number;
  orbitPeriod: number;
  totalFrames: number;
  path: PathPoint[];
  title: string;
  lookAheadFrames: number;
}

export interface FrameCamera {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ProjectState {
  track: Track | null;
  segmentMode: SegmentMode;
  title: string; // "Titolo del giro"
  video: VideoParams;
  camera: CameraParams;
  map: MapParams;
  vehicle: VehicleParams;
  musicTracks: MusicTrack[];
  musicVolume: number; // 0..1, globale
  photoClips: PhotoClip[];
  photoDefaultDuration: number;
  snapEnabled: boolean;
}
