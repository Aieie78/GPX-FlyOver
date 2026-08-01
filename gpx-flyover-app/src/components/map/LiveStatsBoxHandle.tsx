import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import { computeLiveStatsBox } from '../../stats/liveStatsOverlay';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

interface LiveStatsBoxHandleProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

// Maniglia HTML trascinabile sopra ogni riquadro "dati in tempo reale" attivo — una per traccia
// con vehicle.showLiveStats true (Fase 5.3-bis). Stesso pattern di TextOverlayHandle.tsx: la
// posizione della maniglia viene dalla stessa funzione pura (computeLiveStatsBox) usata dal
// disegno canvas (drawLiveStatsBox), così restano sempre allineate; il canvas overlay sottostante
// resta pointer-events:none, solo questa maniglia è interattiva.
export function LiveStatsBoxHandle({ containerRef }: LiveStatsBoxHandleProps) {
  const tracks = useProjectStore((s) => s.tracks);
  const updateVehicle = useProjectStore((s) => s.updateVehicle);
  const isRecording = usePlaybackStore((s) => s.isRecording);

  if (isRecording) return null;
  const active = tracks.filter((t) => t.vehicle.showLiveStats);
  if (!active.length) return null;

  const containerRect = containerRef.current?.getBoundingClientRect();
  if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) return null;

  const startDrag = (e: ReactMouseEvent, trackId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const onMove = (ev: MouseEvent) => {
      const xFrac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const yFrac = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      updateVehicle(trackId, { liveStatsX: xFrac, liveStatsY: yFrac });
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
      {active.map((t) => {
        const box = computeLiveStatsBox(containerRect.width, containerRect.height, t.vehicle.liveStatsX, t.vehicle.liveStatsY, t.vehicle.liveStatsScale);
        return (
          <div
            key={t.id}
            className="text-overlay-handle"
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            title={`Trascina per riposizionare il riquadro dati di ${t.fileName}`}
            onMouseDown={(e) => startDrag(e, t.id)}
          />
        );
      })}
    </>
  );
}
