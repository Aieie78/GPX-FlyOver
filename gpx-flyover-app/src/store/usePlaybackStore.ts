import { create } from 'zustand';
import type { PlaybackSpeed } from '../types/domain';

interface TickInfo {
  currentFrame: number;
  totalFrames: number;
  currentTimeSec: number;
  totalTimeSec: number;
  isPlaying: boolean;
}

interface PlaybackState {
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  currentFrame: number;
  totalFrames: number;
  currentTimeSec: number;
  totalTimeSec: number;
  canPreview: boolean; // true dopo che la traccia è stata caricata sulla mappa con successo
  isRecording: boolean;
  statusMessage: string; // equivalente al div #status condiviso dell'originale
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setTick: (info: TickInfo) => void;
  setCanPreview: (canPreview: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setStatusMessage: (message: string) => void;
}

// Stato di playback/UI: intenzionalmente FUORI dallo store undoable (useProjectStore) —
// non ha senso che Ctrl+Z sposti la playhead.
export const usePlaybackStore = create<PlaybackState>()((set) => ({
  isPlaying: false,
  playbackSpeed: 1,
  currentFrame: 0,
  totalFrames: 0,
  currentTimeSec: 0,
  totalTimeSec: 0,
  canPreview: false,
  isRecording: false,
  statusMessage: '',
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setTick: ({ currentFrame, totalFrames, currentTimeSec, totalTimeSec, isPlaying }) =>
    set({ currentFrame, totalFrames, currentTimeSec, totalTimeSec, isPlaying }),
  setCanPreview: (canPreview) => set({ canPreview }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
}));
