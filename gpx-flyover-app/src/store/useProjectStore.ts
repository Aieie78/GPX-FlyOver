import { create, useStore } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import type {
  CameraParams,
  MapParams,
  MusicTrack,
  PhotoClip,
  ProjectState,
  SegmentMode,
  Track,
  VehicleParams,
  VideoParams,
} from '../types/domain';

interface ProjectActions {
  setTrack: (track: Track | null) => void;
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
  setPhotoDefaultDuration: (sec: number) => void;
  addPhotoClip: (clip: PhotoClip) => void;
  updatePhotoClip: (id: number, patch: Partial<PhotoClip>) => void;
  removePhotoClip: (id: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
}

type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  track: null,
  segmentMode: 'longest',
  title: '',
  video: { resolution: '1920x1080', bitrateMbps: 8, durationSec: 30, fps: 30 },
  camera: { pitch: 66, zoom: 12.5, orbitAmp: 25, orbitPeriod: 14 },
  map: {
    maptilerToken: 'FyCTckIX29KYsBltxupY',
    styleId: 'hybrid-v4',
    customStyleUrl: 'https://api.maptiler.com/maps/019fad3d-3469-7200-b415-d66035b09fd7/style.json?key=FyCTckIX29KYsBltxupY',
  },
  vehicle: {
    icon: '🏍️',
    color: '#00e5ff',
    iconStyle: 'filled',
    size: 0.55,
    use3DAltitude: false,
    altExaggeration: 8,
  },
  musicTracks: [],
  musicVolume: 0.6,
  photoClips: [],
  photoDefaultDuration: 3,
  snapEnabled: true,
};

// Undo/redo (Ctrl+Z / Ctrl+Y) copre musica, foto e parametri principali — non il Track
// caricato (troppo grande, e ricaricare il GPX non è un'operazione da "annullare").
// prompt-refactoring.md, priorità alta #2.
export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set) => ({
      ...initialState,
      setTrack: (track) => set({ track }),
      setSegmentMode: (segmentMode) => set({ segmentMode }),
      setTitle: (title) => set({ title }),
      updateVideo: (patch) => set((s) => ({ video: { ...s.video, ...patch } })),
      updateCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
      updateMap: (patch) => set((s) => ({ map: { ...s.map, ...patch } })),
      updateVehicle: (patch) => set((s) => ({ vehicle: { ...s.vehicle, ...patch } })),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      addMusicTrack: (track) => set((s) => ({ musicTracks: [...s.musicTracks, track] })),
      updateMusicTrack: (id, patch) =>
        set((s) => ({
          musicTracks: s.musicTracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeMusicTrack: (id) =>
        set((s) => ({ musicTracks: s.musicTracks.filter((t) => t.id !== id) })),
      setPhotoDefaultDuration: (photoDefaultDuration) => set({ photoDefaultDuration }),
      addPhotoClip: (clip) => set((s) => ({ photoClips: [...s.photoClips, clip] })),
      updatePhotoClip: (id, patch) =>
        set((s) => ({
          photoClips: s.photoClips.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePhotoClip: (id) =>
        set((s) => ({ photoClips: s.photoClips.filter((p) => p.id !== id) })),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    }),
    {
      partialize: (state) => {
        const { track: _track, ...rest } = state;
        return rest;
      },
      limit: 100,
    },
  ),
);

export function useProjectTemporalStore<T>(
  selector: (state: TemporalState<Omit<ProjectStore, 'track'>>) => T,
): T {
  return useStore(useProjectStore.temporal, selector);
}
