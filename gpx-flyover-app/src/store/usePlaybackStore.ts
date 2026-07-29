import { create } from 'zustand';

export type SidebarTabId = 'gpx' | 'video' | 'camera' | 'map' | 'vehicle' | 'music-photos';

interface PlaybackState {
  currentTimeSec: number;
  isPlaying: boolean;
  playbackSpeed: 0.5 | 1 | 1.5 | 2;
  selectedSidebarTab: SidebarTabId;
  selectedBlockId: string | null;
  timelineZoom: number; // fattore di zoom orizzontale sulla timeline (priorità alta #3)
  setCurrentTime: (sec: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: 0.5 | 1 | 1.5 | 2) => void;
  setSelectedSidebarTab: (tab: SidebarTabId) => void;
  setSelectedBlockId: (id: string | null) => void;
  setTimelineZoom: (zoom: number) => void;
}

// Stato di playback/UI: intenzionalmente FUORI dallo store undoable (useProjectStore) —
// non ha senso che Ctrl+Z sposti la playhead o cambi tab della sidebar.
export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTimeSec: 0,
  isPlaying: false,
  playbackSpeed: 1,
  selectedSidebarTab: 'gpx',
  selectedBlockId: null,
  timelineZoom: 1,
  setCurrentTime: (currentTimeSec) => set({ currentTimeSec }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setSelectedSidebarTab: (selectedSidebarTab) => set({ selectedSidebarTab }),
  setSelectedBlockId: (selectedBlockId) => set({ selectedBlockId }),
  setTimelineZoom: (timelineZoom) => set({ timelineZoom }),
}));
