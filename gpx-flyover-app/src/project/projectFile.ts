import { nextPhotoId } from '../photos/photoEngine';
import { nextTextId } from '../text/textEngine';
import { getEffectiveVehicle } from '../store/useProjectStore';
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

const PROJECT_FILE_VERSION = 1;

interface SerializedPhotoClip {
  name: string;
  videoStart: number;
  duration: number;
  rotation: PhotoClip['rotation'];
  dataUrl: string;
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
  // Solo metadati: il file audio vero e proprio NON viene incorporato (potrebbe pesare decine di
  // MB in base64 per brano) — servono solo come promemoria di quali brani riaggiungere a mano
  // dalla sezione Musica & Foto dopo il caricamento, il Track GPX si ricarica allo stesso modo.
  musicTracksMeta: Array<Omit<MusicTrack, 'buffer' | 'id'>>;
  photoClips: SerializedPhotoClip[];
  textOverlays: Array<Omit<TextOverlay, 'id'>>;
}

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

// Converte lo stato di progetto (esclusa la traccia GPX, sempre da ricaricare a mano) in un
// oggetto JSON-serializzabile: le foto sono incorporate come dataURL (in genere poche centinaia
// di KB l'una), i brani musicali solo come metadati (vedi ProjectFileV1).
export function serializeProject(state: ProjectState): ProjectFileV1 {
  return {
    version: PROJECT_FILE_VERSION,
    title: state.title,
    segmentMode: state.segmentMode,
    video: state.video,
    camera: state.camera,
    map: state.map,
    vehicle: getEffectiveVehicle(state),
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
  // Le impostazioni Mezzo salvate non sono un campo diretto di ProjectState (vivono dentro la
  // traccia principale, o in pendingVehicle se non ne è ancora stata caricata una): vanno
  // applicate a parte con l'azione updateVehicle, che sa dove scriverle.
  vehicle: VehicleParams;
  skippedMusicNames: string[];
}

// Ricostruisce lo stato da un file JSON esportato da serializeProject. Le foto vengono
// ricaricate (decodifica del dataURL); i brani musicali NON vengono ripristinati (nessun audio
// incorporato) — i loro nomi sono restituiti in skippedMusicNames per informare l'utente.
// Assegna id nuovi (nextPhotoId/nextTextId) invece di riusare quelli salvati, per evitare
// collisioni con elementi aggiunti nella sessione corrente dopo il caricamento.
export async function deserializeProject(json: unknown): Promise<DeserializedProject> {
  if (!json || typeof json !== 'object' || (json as { version?: unknown }).version !== PROJECT_FILE_VERSION) {
    throw new Error('File di progetto non valido o di una versione non supportata.');
  }
  const f = json as ProjectFileV1;

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
    vehicle: f.vehicle,
    skippedMusicNames: (f.musicTracksMeta ?? []).map((m) => m.name),
  };
}
