import { nextPhotoId } from '../photos/photoEngine';
import { nextTextId } from '../text/textEngine';
import type {
  CameraParams,
  MapParams,
  MaxSpeedExclusion,
  MusicTrack,
  PhotoClip,
  ProjectState,
  SegmentMode,
  TextOverlay,
  VehicleParams,
  VideoParams,
} from '../types/domain';

const PROJECT_FILE_VERSION = 2;

interface SerializedPhotoClip {
  name: string;
  videoStart: number;
  duration: number;
  rotation: PhotoClip['rotation'];
  dataUrl: string;
}

// Solo metadati per traccia: il GPX vero e proprio NON viene incorporato (si ricarica sempre a
// mano dalla sezione Sorgente GPX) — fileName+vehicle+isPrimary+maxSpeedExclusions vengono
// riapplicati AUTOMATICAMENTE non appena l'utente ricarica un file con lo stesso nome (vedi
// Sidebar.tsx handleLoad, che confronta expectedTracksMeta in usePlaybackStore per nome file).
export interface SerializedTrackMeta {
  fileName: string;
  vehicle: VehicleParams;
  isPrimary: boolean;
  maxSpeedExclusions: MaxSpeedExclusion[];
}

// Stessi campi di MusicTrack tranne l'AudioBuffer decodificato (non incorporabile) e l'id (nuovo
// ad ogni ricaricamento) — riapplicati automaticamente per nome file (vedi MusicPhotosPanel.tsx).
export type SerializedMusicMeta = Omit<MusicTrack, 'buffer' | 'id'>;

interface ProjectFileV1 {
  version: 1;
  title: string;
  segmentMode: SegmentMode;
  video: VideoParams;
  camera: CameraParams;
  map: MapParams;
  vehicle: VehicleParams;
  musicVolume: number;
  photoDefaultDuration: number;
  snapEnabled: boolean;
  musicTracksMeta: SerializedMusicMeta[];
  photoClips: SerializedPhotoClip[];
  textOverlays: Array<Omit<TextOverlay, 'id'>>;
}

interface ProjectFileV2 {
  version: 2;
  title: string;
  segmentMode: SegmentMode;
  video: VideoParams;
  camera: CameraParams;
  map: MapParams;
  tracksMeta: SerializedTrackMeta[];
  musicVolume: number;
  photoDefaultDuration: number;
  snapEnabled: boolean;
  // Solo metadati: il file audio vero e proprio NON viene incorporato (potrebbe pesare decine di
  // MB in base64 per brano) — servono solo come promemoria di quali brani riaggiungere a mano
  // dalla sezione Musica & Foto dopo il caricamento.
  musicTracksMeta: SerializedMusicMeta[];
  photoClips: SerializedPhotoClip[];
  textOverlays: Array<Omit<TextOverlay, 'id'>>;
}

type ProjectFile = ProjectFileV1 | ProjectFileV2;

function photoToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Converte lo stato di progetto (escluse le tracce GPX, sempre da ricaricare a mano) in un
// oggetto JSON-serializzabile: le foto sono incorporate come dataURL (in genere poche centinaia
// di KB l'una), i brani musicali solo come metadati, le tracce solo come promemoria
// nome-file/impostazioni Mezzo/principale (vedi ProjectFileV2).
export function serializeProject(state: ProjectState): ProjectFileV2 {
  return {
    version: PROJECT_FILE_VERSION,
    title: state.title,
    segmentMode: state.segmentMode,
    video: state.video,
    camera: state.camera,
    map: state.map,
    tracksMeta: state.tracks.map((t) => ({
      fileName: t.fileName,
      vehicle: t.vehicle,
      isPrimary: t.isPrimary,
      maxSpeedExclusions: t.maxSpeedExclusions,
    })),
    musicVolume: state.musicVolume,
    photoDefaultDuration: state.photoDefaultDuration,
    snapEnabled: state.snapEnabled,
    musicTracksMeta: state.musicTracks.map(({ buffer: _buffer, id: _id, ...rest }) => rest),
    photoClips: state.photoClips.map((p) => ({
      name: p.name,
      videoStart: p.videoStart,
      duration: p.duration,
      rotation: p.rotation,
      dataUrl: photoToDataUrl(p.img),
    })),
    textOverlays: state.textOverlays.map(({ id: _id, ...rest }) => rest),
  };
}

export interface DeserializedProject {
  data: Partial<Omit<ProjectState, 'tracks' | 'pendingVehicle'>>;
  // Le impostazioni Mezzo salvate non sono un campo diretto di ProjectState (vivono dentro le
  // tracce, ricaricate una per una): il chiamante (ProjectPanel.tsx) le passa a
  // usePlaybackStore.setExpectedMeta, da cui Sidebar.tsx/MusicPhotosPanel.tsx le leggono per il
  // riaggancio automatico per nome file al prossimo caricamento di ciascun file GPX/audio.
  tracksMeta: SerializedTrackMeta[];
  musicMeta: SerializedMusicMeta[];
}

// Ricostruisce lo stato da un file JSON esportato da serializeProject. Le foto vengono
// ricaricate subito (decodifica del dataURL, nessuna azione utente necessaria); i brani musicali
// NON vengono ripristinati subito (nessun audio incorporato) — i loro metadati completi
// (musicMeta) vengono riapplicati automaticamente non appena l'utente ricarica un file con lo
// stesso nome (vedi DeserializedProject sopra). Assegna id nuovi (nextPhotoId/nextTextId) invece
// di riusare quelli salvati, per evitare collisioni con elementi aggiunti nella sessione corrente
// dopo il caricamento.
// Accetta anche file v1 (singolo `vehicle`, prima della Fase 5.2 multi-traccia) per compatibilità.
export async function deserializeProject(json: unknown): Promise<DeserializedProject> {
  const version = (json as { version?: unknown } | null)?.version;
  if (!json || typeof json !== 'object' || (version !== 1 && version !== 2)) {
    throw new Error('File di progetto non valido o di una versione non supportata.');
  }
  const f = json as ProjectFile;

  const photoClips: PhotoClip[] = await Promise.all(
    (f.photoClips ?? []).map(async (p) => ({
      id: nextPhotoId(),
      name: p.name,
      videoStart: p.videoStart,
      duration: p.duration,
      rotation: p.rotation,
      img: await loadImageFromDataUrl(p.dataUrl),
    })),
  );

  const textOverlays: TextOverlay[] = (f.textOverlays ?? []).map((t) => ({ id: nextTextId(), ...t }));

  // maxSpeedExclusions è assente nei file salvati prima di questa modifica (v2 già esistenti):
  // ?? [] evita un crash a runtime, il campo è opzionale nei dati letti anche se non nel tipo.
  const tracksMeta: SerializedTrackMeta[] =
    f.version === 1
      ? [{ fileName: '', vehicle: f.vehicle, isPrimary: true, maxSpeedExclusions: [] }]
      : f.tracksMeta.map((t) => ({ ...t, maxSpeedExclusions: t.maxSpeedExclusions ?? [] }));

  return {
    data: {
      title: f.title,
      segmentMode: f.segmentMode,
      video: f.video,
      camera: f.camera,
      map: f.map,
      musicVolume: f.musicVolume,
      photoDefaultDuration: f.photoDefaultDuration,
      snapEnabled: f.snapEnabled,
      musicTracks: [],
      photoClips,
      textOverlays,
    },
    tracksMeta,
    musicMeta: f.musicTracksMeta ?? [],
  };
}
