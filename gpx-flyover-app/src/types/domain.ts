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
  // Velocità reale istantanea (km/h), interpolata dai timestamp <time> originali del GPX tra i
  // due punti grezzi più vicini — null se il GPX non ha dati di tempo validi in quel tratto.
  speedKmh: number | null;
  headingDeg: number; // rotta 0..360 rispetto al nord, dalla direzione reale del tratto p0→p1
  // Orario reale (timestamp <time> del GPX, interpolato) in epoch ms UTC — null se il GPX non ha
  // dati di tempo validi in quel tratto. Solo l'ora viene mostrata, non la data.
  clockTimeMs: number | null;
}

export type VideoResolution = '1280x720' | '1920x1080' | '2560x1440';
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
// Formato di esportazione: la scena viene sempre composta in 16:9 (come oggi) e poi, per i
// formati social, ritagliata al centro nel formato scelto — nessuna reinquadratura dedicata.
export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export interface VideoParams {
  resolution: VideoResolution;
  bitrateMbps: number;
  durationSec: number;
  fps: number;
  aspectRatio: VideoAspectRatio;
  // Intervallo della timeline NOMINALE (0..durationSec) effettivamente registrato — maniglie
  // trascinabili sulla barra video (PreviewControls.tsx). trimEndSec null = fino alla fine
  // (segue durationSec automaticamente se cambia, invece di restare "congelato" a un vecchio
  // valore). L'anteprima interattiva resta invariata: il ritaglio si applica solo in esportazione.
  trimStartSec: number;
  trimEndSec: number | null;
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

export type VehicleIcon = '🏍️' | '🚗' | '🚁' | '✈️' | '🚢';
export type VehicleIconStyle = 'filled' | 'outline' | 'dot';

export interface VehicleParams {
  icon: VehicleIcon;
  color: string;
  iconStyle: VehicleIconStyle;
  size: number;
  use3DAltitude: boolean; // "quota reale" per tracce aeree
  altExaggeration: number;
  showLiveStats: boolean; // riquadro in basso a destra con velocità/quota/posizione in tempo reale
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

// Sovrapposizione testuale posizionabile sulla timeline (didascalie/titoli multipli) — distinta
// dal campo "title" (sempre visibile, in alto a sinistra): queste appaiono/scompaiono con una
// breve dissolvenza solo nella loro finestra temporale, come le foto.
export interface TextOverlay {
  id: number;
  text: string;
  videoStart: number;
  duration: number;
  x: number; // 0..1, frazione della larghezza del fotogramma (posizione del centro)
  y: number; // 0..1, frazione dell'altezza del fotogramma (posizione del centro)
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
  textOverlays: TextOverlay[];
  snapEnabled: boolean;
}
