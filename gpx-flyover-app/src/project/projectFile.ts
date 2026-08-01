import { nextPhotoId } from '../photos/photoEngine';
import { nextTextId } from '../text/textEngine';
import type {
  CameraParams,
  MapParams,
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
// mano dalla sezione Sorgente GPX) — fileName+vehicle+isPrimary servono solo come promemoria di
// come erano configurate le tracce al momento del salvataggio, da riapplicare manualmente dopo
// aver ricaricato ciascun file (nessuna riassociazione automatica).
interface SerializedTrackMeta {
  fileName: string;
  vehicle: VehicleParams;
  isPrimary: boolean;
}

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
  musicTracksMeta: Array<Omit<MusicTrack, 'buffer' | 'id'>>;
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
  musicTracksMeta: Array<Omit<MusicTrack, 'buffer' | 'id'>>;
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
    tracksMeta: state.tracks.map((t) => ({ fileName: t.fileName, vehicle: t.vehicle, isPrimary: t.isPrimary })),
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
  // tracce, ricaricate a mano una per una): restano qui come promemoria da riapplicare a mano
  // dopo aver ricaricato ciascun file GPX (nessuna riassociazione automatica).
  tracksMeta: SerializedTrackMeta[];
  skippedMusicNames: string[];
}

// Ricostruisce lo stato da un file JSON esportato da serializeProject. Le foto vengono
// ricaricate (decodifica del dataURL); i brani musicali NON vengono ripristinati (nessun audio
// incorporato) — i loro nomi sono restituiti in skippedMusicNames per informare l'utente.
// Assegna id nuovi (nextPhotoId/nextTextId) invece di riusare quelli salvati, per evitare
// collisioni con elementi aggiunti nella sessione corrente dopo il caricamento.
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

  const tracksMeta: SerializedTrackMeta[] =
    f.version === 1 ? [{ fileName: '', vehicle: f.vehicle, isPrimary: true }] : f.tracksMeta;

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
    skippedMusicNames: (f.musicTracksMeta ?? []).map((m) => m.name),
  };
}
