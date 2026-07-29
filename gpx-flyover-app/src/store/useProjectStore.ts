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
  updateVideo: (patch: Partial<VideoParams>) => void;
  updateCamera: (patch: Partial<CameraParams>) => void;
  updateMap: (patch: Partial<MapParams>) => void;
  updateVehicle: (patch: Partial<VehicleParams>) => void;
  setMusicVolume: (volume: number) => void;
  addMusicTrack: (track: MusicTrack) => void;
  updateMusicTrack: (id: string, patch: Partial<MusicTrack>) => void;
  removeMusicTrack: (id: string) => void;
  addPhotoClip: (clip: PhotoClip) => void;
  updatePhotoClip: (id: string, patch: Partial<PhotoClip>) => void;
  removePhotoClip: (id: string) => void;
  setSnapEnabled: (enabled: boolean) => void;
}

type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  track: null,
  segmentMode: 'longest',
  video: { resolution: '1080p', bitrateMbps: 8, durationSec: 60, fps: 30, speed: 1 },
  camera: { pitch: 60, zoom: 15, orbitAmplitude: 15, orbitPeriodSec: 20 },
  map: { maptilerToken: '', styleId: 'satellite-hybrid', customStyleUrl: '' },
  vehicle: {
    type: 'motorcycle',
    color: '#ff3b30',
    iconStyle: 'filled-symbol',
    size: 1,
    useRealAltitude: false,
    altitudeExaggeration: 1,
  },
  musicTracks: [],
  musicVolume: 0.6,
  photoClips: [],
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
