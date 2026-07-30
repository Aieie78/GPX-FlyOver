import { useEffect, useRef } from 'react';
import type { UIEvent as ReactUIEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useTimelineViewStore } from '../store/useTimelineViewStore';

const WHEEL_ZOOM_FACTOR = 1.15;

// Condiviso da barra di scorrimento video, righello e corsie musica/foto: tiene sincronizzata la
// posizione di scorrimento orizzontale tra tutte le righe (che sono contenitori scroll nativi
// indipendenti) e gestisce lo zoom con la rotellina, centrato sul punto sotto il cursore.
export function useTimelineRowScroll() {
  const zoom = useTimelineViewStore((s) => s.zoom);
  const scrollLeft = useTimelineViewStore((s) => s.scrollLeft);
  const setScrollLeft = useTimelineViewStore((s) => s.setScrollLeft);
  const zoomAt = useTimelineViewStore((s) => s.zoomAt);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && Math.round(el.scrollLeft) !== Math.round(scrollLeft)) {
      el.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  const onScroll = (e: ReactUIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (Math.round(el.scrollLeft) !== Math.round(scrollLeft)) setScrollLeft(el.scrollLeft);
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    zoomAt(e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR, rect.width, cursorX);
  };

  return { scrollRef, onScroll, onWheel, zoom };
}
