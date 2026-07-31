import { create, useStore } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import { nextMusicId } from '../audio/musicEngine';
import { nextPhotoId } from '../photos/photoEngine';
import { nextTextId } from '../text/textEngine';
import { nextTrackId } from '../gpx/parseGpx';
import type {
  CameraParams,
  MapParams,
  MusicTrack,
  PhotoClip,
  ProjectState,
  SegmentMode,
  TextOverlay,
  Track,
  VehicleParams,
  VehicleTrack,
  VideoParams,
} from '../types/domain';

// Traccia principale del progetto — esattamente come oggi solo una guida camera/statistiche/
// percorso giallo. In Fase 5.1 esiste sempre al più una traccia (quella caricata), sempre
// marcata principale: la gestione multi-traccia vera e propria (aggiungi/rimuovi/designa) arriva
// nelle fasi successive (5.2+).
export function getPrimaryTrack(state: ProjectState): VehicleTrack | undefined {
  return state.tracks.find((t) => t.isPrimary);
}

// Impostazioni Mezzo "effettive" mostrate nel pannello: quelle della traccia principale se
// esiste, altrimenti i default in pendingVehicle (nessuna traccia ancora caricata).
export function getEffectiveVehicle(state: ProjectState): VehicleParams {
  return getPrimaryTrack(state)?.vehicle ?? state.pendingVehicle;
}

interface ProjectActions {
  setTrack: (fileName: string, track: Track) => void;
  setSegmentMode: (mode: SegmentMode) => void;
  setTitle: (title: string) => void;
  updateVideo: (patch: Partial<VideoParams>) => void;
  updateCamera: (patch: Partial<CameraParams>) => void;
  updateMap: (patch: Partial<MapParams>) => void;
  updateVehicle: (patch: Partial<VehicleParams>) => void;
  setMusicVolume: (volume: number) => void;
  addMusicTrack: (track: MusicTrack) => void;
  updateMusicTrack: (id: number, patch: Partial<MusicTrack>) => void;
  removeMusicTrack: (id: number) => void;
  duplicateMusicTrack: (id: number) => void;
  splitMusicTrackAt: (id: number, atSec: number) => void;
  setPhotoDefaultDuration: (sec: number) => void;
  addPhotoClip: (clip: PhotoClip) => void;
  updatePhotoClip: (id: number, patch: Partial<PhotoClip>) => void;
  removePhotoClip: (id: number) => void;
  duplicatePhotoClip: (id: number) => void;
  splitPhotoClipAt: (id: number, atSec: number) => void;
  addTextOverlay: (text: string, videoStart: number, duration: number) => number;
  updateTextOverlay: (id: number, patch: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: number) => void;
  duplicateTextOverlay: (id: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  loadProjectData: (patch: Partial<Omit<ProjectState, 'tracks'>>) => void;
}

type ProjectStore = ProjectState & ProjectActions;

const defaultVehicle: VehicleParams = {
  icon: '🏍️',
  color: '#00e5ff',
  iconStyle: 'filled',
  size: 0.55,
  use3DAltitude: false,
  altExaggeration: 8,
  showLiveStats: false,
};

const initialState: ProjectState = {
  tracks: [],
  pendingVehicle: defaultVehicle,
  segmentMode: 'longest',
  title: '',
  video: {
    resolution: '1920x1080',
    bitrateMbps: 8,
    durationSec: 30,
    fps: 30,
    aspectRatio: '16:9',
    trimStartSec: 0,
    trimEndSec: null,
    showAltitudeProfile: true,
  },
  camera: { pitch: 66, zoom: 12.5, orbitAmp: 25, orbitPeriod: 14 },
  map: {
    maptilerToken: 'FyCTckIX29KYsBltxupY',
    styleId: 'hybrid-v4',
    customStyleUrl: 'https://api.maptiler.com/maps/019fad3d-3469-7200-b415-d66035b09fd7/style.json?key=FyCTckIX29KYsBltxupY',
  },
  musicTracks: [],
  musicVolume: 0.6,
  photoClips: [],
  photoDefaultDuration: 3,
  textOverlays: [],
  snapEnabled: true,
};

// Undo/redo (Ctrl+Z / Ctrl+Y) copre musica, foto e parametri principali — non il Track
// caricato (troppo grande, e ricaricare il GPX non è un'operazione da "annullare").
// prompt-refactoring.md, priorità alta #2.
export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set) => ({
      ...initialState,
      // Sostituisce la traccia principale (unica, in questa fase): se ne esiste già una, ne
      // aggiorna solo file/dati GPX mantenendo le impostazioni Mezzo già configurate (come oggi);
      // altrimenti ne crea una nuova, inizializzata dai default in pendingVehicle.
      setTrack: (fileName, track) =>
        set((s) => {
          const existing = getPrimaryTrack(s);
          if (existing) {
            return {
              tracks: s.tracks.map((t) => (t.id === existing.id ? { ...t, fileName, track } : t)),
            };
          }
          return {
            tracks: [{ id: nextTrackId(), fileName, track, vehicle: { ...s.pendingVehicle }, isPrimary: true }],
          };
        }),
      setSegmentMode: (segmentMode) => set({ segmentMode }),
      setTitle: (title) => set({ title }),
      updateVideo: (patch) => set((s) => ({ video: { ...s.video, ...patch } })),
      updateCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
      updateMap: (patch) => set((s) => ({ map: { ...s.map, ...patch } })),
      // Prima che una traccia sia caricata modifica i default (pendingVehicle); una volta
      // caricata una traccia principale, modifica le sue impostazioni Mezzo.
      updateVehicle: (patch) =>
        set((s) => {
          const primary = getPrimaryTrack(s);
          if (!primary) return { pendingVehicle: { ...s.pendingVehicle, ...patch } };
          return {
            tracks: s.tracks.map((t) => (t.id === primary.id ? { ...t, vehicle: { ...t.vehicle, ...patch } } : t)),
          };
        }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      addMusicTrack: (track) => set((s) => ({ musicTracks: [...s.musicTracks, track] })),
      updateMusicTrack: (id, patch) =>
        set((s) => ({
          musicTracks: s.musicTracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeMusicTrack: (id) =>
        set((s) => ({ musicTracks: s.musicTracks.filter((t) => t.id !== id) })),
      duplicateMusicTrack: (id) =>
        set((s) => {
          const t = s.musicTracks.find((x) => x.id === id);
          if (!t) return {};
          const length = t.trimEnd - t.trimStart;
          const videoStart = Math.min(Math.max(0, s.video.durationSec - length), t.videoStart + length);
          return { musicTracks: [...s.musicTracks, { ...t, id: nextMusicId(), videoStart }] };
        }),
      // Taglia un brano nel punto atSec (in secondi video) in due tracce distinte, accorciando
      // quella esistente e creandone una nuova per la seconda metà — riferiscono lo stesso
      // AudioBuffer decodificato, cambia solo il ritaglio (trimStart/trimEnd) e la posizione.
      splitMusicTrackAt: (id, atSec) =>
        set((s) => {
          const t = s.musicTracks.find((x) => x.id === id);
          if (!t) return {};
          const length = t.trimEnd - t.trimStart;
          const cutOffset = atSec - t.videoStart;
          if (cutOffset <= 0.15 || cutOffset >= length - 0.15) return {};
          const cutTrim = t.trimStart + cutOffset;
          const second: MusicTrack = { ...t, id: nextMusicId(), videoStart: atSec, trimStart: cutTrim };
          return {
            musicTracks: [
              ...s.musicTracks.map((x) => (x.id === id ? { ...x, trimEnd: cutTrim } : x)),
              second,
            ],
          };
        }),
      setPhotoDefaultDuration: (photoDefaultDuration) => set({ photoDefaultDuration }),
      addPhotoClip: (clip) => set((s) => ({ photoClips: [...s.photoClips, clip] })),
      updatePhotoClip: (id, patch) =>
        set((s) => ({
          photoClips: s.photoClips.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePhotoClip: (id) =>
        set((s) => ({ photoClips: s.photoClips.filter((p) => p.id !== id) })),
      duplicatePhotoClip: (id) =>
        set((s) => {
          const p = s.photoClips.find((x) => x.id === id);
          if (!p) return {};
          const videoStart = Math.min(Math.max(0, s.video.durationSec - p.duration), p.videoStart + p.duration);
          return { photoClips: [...s.photoClips, { ...p, id: nextPhotoId(), videoStart }] };
        }),
      splitPhotoClipAt: (id, atSec) =>
        set((s) => {
          const p = s.photoClips.find((x) => x.id === id);
          if (!p) return {};
          const cutOffset = atSec - p.videoStart;
          if (cutOffset <= 0.15 || cutOffset >= p.duration - 0.15) return {};
          const second: PhotoClip = { ...p, id: nextPhotoId(), videoStart: atSec, duration: p.duration - cutOffset };
          return {
            photoClips: [
              ...s.photoClips.map((x) => (x.id === id ? { ...x, duration: cutOffset } : x)),
              second,
            ],
          };
        }),
      addTextOverlay: (text, videoStart, duration) => {
        const id = nextTextId();
        set((s) => ({ textOverlays: [...s.textOverlays, { id, text, videoStart, duration, x: 0.5, y: 0.85 }] }));
        return id;
      },
      updateTextOverlay: (id, patch) =>
        set((s) => ({
          textOverlays: s.textOverlays.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTextOverlay: (id) =>
        set((s) => ({ textOverlays: s.textOverlays.filter((t) => t.id !== id) })),
      duplicateTextOverlay: (id) =>
        set((s) => {
          const t = s.textOverlays.find((x) => x.id === id);
          if (!t) return {};
          const videoStart = Math.min(Math.max(0, s.video.durationSec - t.duration), t.videoStart + t.duration);
          return { textOverlays: [...s.textOverlays, { ...t, id: nextTextId(), videoStart }] };
        }),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      // Applica in blocco i dati di un progetto caricato da JSON (project/projectFile.ts) —
      // le tracce GPX restano fuori: vanno sempre ricaricate a mano, come per l'undo/redo.
      loadProjectData: (patch) => set(patch),
    }),
    {
      partialize: (state) => {
        const { tracks: _tracks, ...rest } = state;
        return rest;
      },
      limit: 100,
    },
  ),
);

export function useProjectTemporalStore<T>(
  selector: (state: TemporalState<Omit<ProjectStore, 'tracks'>>) => T,
): T {
  return useStore(useProjectStore.temporal, selector);
}
