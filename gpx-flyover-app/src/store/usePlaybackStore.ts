import { create } from 'zustand';
import type { SerializedMusicMeta, SerializedTrackMeta } from '../project/projectFile';
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
  // File attesi dall'ultimo "Carica progetto" (JSON) — popolati da ProjectPanel.tsx, consumati da
  // Sidebar.tsx (GPX) e MusicPhotosPanel.tsx (musica) per il riaggancio automatico per nome file:
  // se il file ricaricato ha lo stesso nome di un elemento qui, le sue impostazioni salvate
  // (posizione/taglio/volume/veicolo/esclusioni bandierina) vengono riapplicate invece di usare i
  // default "nuovo blocco". Intenzionalmente FUORI dallo store undoable/salvabile (useProjectStore):
  // è uno stato di riconciliazione di sessione, non una impostazione di progetto. "Riaggancio
  // effettuato" per un elemento si deduce dal vivo confrontando questi elenchi con
  // tracks/musicTracks correnti (per nome) — non serve "consumare" le voci qui.
  expectedTracksMeta: SerializedTrackMeta[];
  expectedMusicMeta: SerializedMusicMeta[];
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setTick: (info: TickInfo) => void;
  setCanPreview: (canPreview: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setStatusMessage: (message: string) => void;
  setExpectedMeta: (tracksMeta: SerializedTrackMeta[], musicMeta: SerializedMusicMeta[]) => void;
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
  expectedTracksMeta: [],
  expectedMusicMeta: [],
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setTick: ({ currentFrame, totalFrames, currentTimeSec, totalTimeSec, isPlaying }) =>
    set({ currentFrame, totalFrames, currentTimeSec, totalTimeSec, isPlaying }),
  setCanPreview: (canPreview) => set({ canPreview }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setExpectedMeta: (expectedTracksMeta, expectedMusicMeta) => set({ expectedTracksMeta, expectedMusicMeta }),
}));
