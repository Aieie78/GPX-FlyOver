import { useRef } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import { getActiveTextOverlays, computeTextBox } from '../../text/textEngine';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useTimelineSelectionStore } from '../../store/useTimelineSelectionStore';

interface TextOverlayHandleProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

// Maniglia HTML trascinabile sopra ogni sovrapposizione testuale attualmente visibile in
// anteprima — permette di riposizionarla direttamente nel video (invece di soli slider numerici)
// trascinandola con il mouse, coprendo esattamente lo stesso riquadro disegnato da
// drawTextOverlay (stessa funzione computeTextBox, così maniglia e testo restano sempre allineati).
// Il canvas overlay sottostante resta pointer-events:none (per non bloccare il pan/zoom della
// mappa) — solo questa maniglia, posizionata sul riquadro esatto del testo, è interattiva.
export function TextOverlayHandle({ containerRef }: TextOverlayHandleProps) {
  const textOverlays = useProjectStore((s) => s.textOverlays);
  const updateTextOverlay = useProjectStore((s) => s.updateTextOverlay);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const isRecording = usePlaybackStore((s) => s.isRecording);
  const selectClip = useTimelineSelectionStore((s) => s.select);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (isRecording) return null;
  if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement('canvas');
  const measureCtx = measureCanvasRef.current.getContext('2d');
  if (!measureCtx) return null;

  const active = getActiveTextOverlays(textOverlays, currentTimeSec);
  if (!active.length) return null;

  const containerRect = containerRef.current?.getBoundingClientRect();
  if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) return null;

  const startDrag = (e: ReactMouseEvent, overlayId: number) => {
    e.preventDefault();
    e.stopPropagation();
    selectClip({ type: 'text', id: overlayId });
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const onMove = (ev: MouseEvent) => {
      const xFrac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const yFrac = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      updateTextOverlay(overlayId, { x: xFrac, y: yFrac });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {active.map(({ overlay }) => {
        const box = computeTextBox(measureCtx, containerRect.width, containerRect.height, overlay.text, overlay.x, overlay.y);
        return (
          <div
            key={overlay.id}
            className="text-overlay-handle"
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            title="Trascina per riposizionare il testo"
            onMouseDown={(e) => startDrag(e, overlay.id)}
          />
        );
      })}
    </>
  );
}
