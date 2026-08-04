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
  // Punto con la velocità più alta lungo il percorso — null se il GPX non ha timestamp <time>
  // validi in nessun tratto (vedi MaxSpeedPoint).
  maxSpeedPoint: MaxSpeedPoint | null;
}

// Punto (lat/lon) con la velocità istantanea più alta lungo il percorso, calcolato al parsing
// (findMaxSpeedPoint in geo.ts) con la stessa formula di speedKmh in resamplePath/PathPoint qui
// sotto — usato per il marker "bandierina" (posizione geografica fissa, sempre visibile) in
// anteprima ed export, solo per la traccia principale.
export interface MaxSpeedPoint {
  lat: number;
  lon: number;
  speedKmh: number;
  ele: number; // quota (media dei due punti grezzi del tratto) — per il sollevamento in quota reale del marker
  dist: number; // metri dall'inizio percorso (punto medio del tratto p0→p1 più veloce) — ancora per il rallentamento/marker timeline
}

// Impostazioni utente della bandierina "Velocità max" (pannello Mezzo, solo traccia principale):
// dimensione del pin, sollevamento in quota reale (stesso meccanismo di VehicleParams.use3DAltitude/
// altExaggeration) e la zona di rallentamento del volo intorno al punto (Fase "bandierina" step 3/4).
export interface MaxSpeedMarkerParams {
  sizeScale: number;
  use3DAltitude: boolean;
  altExaggeration: number;
  // Distanza (metri) prima/dopo il punto entro cui il volo rallenta per dare tempo di leggere la
  // bandierina — il rallentamento è un vero rallentamento del ritmo di volo (non un timer fisso),
  // quindi resta sincronizzato automaticamente a qualunque velocità di riproduzione (x0.5..x2).
  slowdownBeforeM: number;
  slowdownAfterM: number;
  // Velocità relativa del volo dentro la zona di rallentamento (0..1, es. 0.4 = 40% del ritmo normale).
  slowdownFactor: number;
}

// Zona esclusa dalla ricerca del punto di velocità massima — "Scarta questo punto" (pannello
// Mezzo) ne aggiunge una centrata sul punto attuale, così il punto successivo trovato non è di
// nuovo lo stesso tratto (rumore GPS locale). Vive su VehicleTrack (non su Track, che resta dato
// grezzo immutabile) perché è una preferenza dell'utente sulla traccia caricata, non derivata dal
// GPX in sé — vedi getEffectiveMaxSpeedPoint in geo.ts.
export interface MaxSpeedExclusion {
  lat: number;
  lon: number;
  radiusM: number;
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
  showAltitudeProfile: boolean; // sagoma del profilo altimetrico in alto a destra (anteprima e export)
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
  // customStyleUrl viene usato al posto di styleId SOLO se useCustomStyleUrl è true — altrimenti
  // resta ignorato anche se contiene del testo (evita che un URL dimenticato nel campo prenda
  // priorità senza che sia chiaro perché: lo stile scelto dal menu resta sempre quello effettivo
  // finché l'utente non attiva esplicitamente l'override).
  useCustomStyleUrl: boolean;
  customStyleUrl: string;
}

export type VehicleIcon = '🏍️' | '🚗' | '🚁' | '✈️' | '🚢' | 'none';
export type VehicleIconStyle = 'filled' | 'outline' | 'dot';

export interface VehicleParams {
  icon: VehicleIcon;
  color: string;
  // Colore del percorso quando icon === 'none' (nessuna icona disegnata, solo il percorso resta
  // visibile) — indipendente dal colore icona in quel caso, altrimenti ignorato (il percorso usa
  // color). '' finché non è stato ancora assegnato/personalizzato (src/vehicle/routeColor.ts).
  routeColor: string;
  iconStyle: VehicleIconStyle;
  size: number;
  use3DAltitude: boolean; // "quota reale" per tracce aeree
  altExaggeration: number;
  showLiveStats: boolean; // riquadro con velocità/quota/posizione in tempo reale
  // Posizione (frazione 0..1 del centro del riquadro, come TextOverlay.x/y) e scala del riquadro
  // "dati in tempo reale" di questa traccia — trascinabile in anteprima (LiveStatsBoxHandle.tsx),
  // ridimensionabile dal pannello Mezzo. Fase 5.3-bis: prima esisteva un solo riquadro fisso
  // (basso a destra) per la sola traccia principale; ora ogni traccia ha il proprio.
  liveStatsX: number;
  liveStatsY: number;
  liveStatsScale: number;
}

// Una traccia GPX caricata, con le proprie impostazioni Mezzo indipendenti. Fase 5 (multi-GPX,
// mezzi cooperanti): il progetto passa da un singolo Track+VehicleParams a un elenco di
// VehicleTrack, di cui uno solo alla volta è la traccia principale (isPrimary).
export interface VehicleTrack {
  id: number;
  fileName: string;
  track: Track;
  vehicle: VehicleParams;
  isPrimary: boolean;
  // Zone escluse dalla ricerca del punto "Velocità max" (vedi MaxSpeedExclusion) — vuoto finché
  // l'utente non usa "Scarta questo punto" nel pannello Mezzo.
  maxSpeedExclusions: MaxSpeedExclusion[];
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
  tracks: VehicleTrack[]; // elenco tracce GPX caricate — una sola con isPrimary true
  // Impostazioni Mezzo mostrate/modificabili nel pannello "Mezzo" quando non c'è ancora nessuna
  // traccia caricata (tracks vuoto) — usate per inizializzare vehicle sulla prima traccia caricata.
  pendingVehicle: VehicleParams;
  segmentMode: SegmentMode;
  title: string; // "Titolo del giro"
  video: VideoParams;
  camera: CameraParams;
  map: MapParams;
  musicTracks: MusicTrack[];
  musicVolume: number; // 0..1, globale
  photoClips: PhotoClip[];
  photoDefaultDuration: number;
  textOverlays: TextOverlay[];
  snapEnabled: boolean;
  maxSpeedMarker: MaxSpeedMarkerParams;
}
