// Modello dati derivato da gpx-flyover.html (parseGPX, buildAnimParams, musicTracks, photoTracks).
// Fase 2 dovrà rifinire questi tipi mano a mano che la logica viene migrata 1:1.

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  time: number | null; // epoch ms, null se il GPX non ha tag <time>
}

export interface ElevationProfilePoint {
  dist: number; // metri dall'inizio percorso
  ele: number;
}

export interface Track {
  pts: TrackPoint[];
  cum: number[]; // distanza cumulata in metri, stesso indice di pts
  totalDist: number; // metri
  minEle: number;
  maxEle: number;
  elevationGain: number;
  elevationLoss: number;
  durationSec: number | null; // dai tag <time> del GPX, se presenti
  hasElevationData: boolean;
  profile: ElevationProfilePoint[]; // profilo altimetrico ricampionato per overlay/UI
  decimated: boolean; // true se il numero di punti originali superava MAX_PTS (40000)
  nSegmentsFound: number;
}

export type SegmentMode = 'longest' | 'concat';

export type VideoResolution = '720p' | '1080p' | '1440p';
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export interface VideoParams {
  resolution: VideoResolution;
  bitrateMbps: number;
  durationSec: number;
  fps: number;
  speed: PlaybackSpeed; // accelera/rallenta SOLO il video, mai la musica
}

export interface CameraParams {
  pitch: number;
  zoom: number;
  orbitAmplitude: number;
  orbitPeriodSec: number;
}

export type MapStyleId = 'satellite-hybrid' | 'plain' | 'outdoor' | 'winter';

export interface MapParams {
  maptilerToken: string;
  styleId: MapStyleId;
  customStyleUrl: string; // fallback, ha precedenza su styleId se non vuoto
}

export type VehicleType = 'motorcycle' | 'car' | 'helicopter' | 'plane';
export type VehicleIconStyle = 'filled-symbol' | 'symbol-only' | 'dot-only';

export interface VehicleParams {
  type: VehicleType;
  color: string;
  iconStyle: VehicleIconStyle;
  size: number;
  useRealAltitude: boolean; // "quota reale" per tracce aeree
  altitudeExaggeration: number;
}

export interface MusicTrack {
  id: string;
  name: string;
  buffer: AudioBuffer | null;
  durationSec: number;
  trimStart: number;
  trimEnd: number;
  videoStart: number; // posizione di attacco nel video, posizionamento libero
  volume: number; // 0..1, volume per singolo brano (priorità media #7)
}

export interface PhotoClip {
  id: string;
  name: string;
  imageUrl: string; // object URL locale
  videoStart: number;
  displayDurationSec: number;
}

export interface ProjectState {
  track: Track | null;
  segmentMode: SegmentMode;
  video: VideoParams;
  camera: CameraParams;
  map: MapParams;
  vehicle: VehicleParams;
  musicTracks: MusicTrack[];
  musicVolume: number; // globale
  photoClips: PhotoClip[];
  snapEnabled: boolean;
}
