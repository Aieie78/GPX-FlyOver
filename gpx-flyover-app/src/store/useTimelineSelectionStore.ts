import { create } from 'zustand';

export type TimelineSelection = { type: 'music' | 'photo' | 'text'; id: number } | null;

interface TimelineSelectionState {
  selection: TimelineSelection;
  select: (selection: TimelineSelection) => void;
  clear: () => void;
}

// Blocco musica/foto attualmente selezionato nella timeline (click su un blocco) — stato di sola
// UI, non undoable, usato dal razor/duplica/volume nell'inspector (TimelineInspector.tsx) e dalla
// scorciatoia Delete (useTimelineKeyboardShortcuts.ts).
export const useTimelineSelectionStore = create<TimelineSelectionState>((set) => ({
  selection: null,
  select: (selection) => set({ selection }),
  clear: () => set({ selection: null }),
}));
