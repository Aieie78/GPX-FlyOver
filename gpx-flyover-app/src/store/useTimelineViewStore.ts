import { create } from 'zustand';

export const MIN_TIMELINE_ZOOM = 1;
export const MAX_TIMELINE_ZOOM = 8;

interface TimelineViewState {
  zoom: number; // 1 = adattata alla larghezza disponibile, valori più alti = più zoom
  scrollLeft: number; // px, posizione di scorrimento condivisa tra le righe della timeline
  setZoom: (zoom: number) => void;
  setScrollLeft: (px: number) => void;
  // Zoom centrato su un punto preciso (in px, relativo al contenitore visibile) invece che sul
  // bordo sinistro, così il punto sotto il cursore/rotellina resta fermo mentre si zooma.
  zoomAt: (factor: number, containerWidthPx: number, cursorXPx: number) => void;
}

// Stato di sola UI (non undoable, coerente con usePlaybackStore): zoom/scroll della timeline
// non sono un'operazione di editing da annullare con Ctrl+Z.
export const useTimelineViewStore = create<TimelineViewState>((set, get) => ({
  zoom: 1,
  scrollLeft: 0,
  setZoom: (zoom) => {
    const clamped = Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, zoom));
    set({ zoom: clamped, scrollLeft: clamped === MIN_TIMELINE_ZOOM ? 0 : get().scrollLeft });
  },
  setScrollLeft: (px) => set({ scrollLeft: Math.max(0, px) }),
  zoomAt: (factor, containerWidthPx, cursorXPx) => {
    const { zoom, scrollLeft } = get();
    const newZoom = Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, zoom * factor));
    if (newZoom === zoom || containerWidthPx <= 0) return;
    const oldContentWidth = containerWidthPx * zoom;
    const fraction = (scrollLeft + cursorXPx) / oldContentWidth;
    const newContentWidth = containerWidthPx * newZoom;
    const newScrollLeft = newZoom === MIN_TIMELINE_ZOOM ? 0 : Math.max(0, fraction * newContentWidth - cursorXPx);
    set({ zoom: newZoom, scrollLeft: newScrollLeft });
  },
}));
