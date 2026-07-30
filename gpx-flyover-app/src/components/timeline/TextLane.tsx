import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Plus, Type, X } from 'lucide-react';
import { getSessionEngine } from '../../app/flyoverSession';
import { fmtMinSec } from '../../audio/musicEngine';
import { assignLaneRows, snapValue } from '../../timeline/timelineMath';
import { useTimelineRowScroll } from '../../timeline/useTimelineRowScroll';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useTimelineSelectionStore } from '../../store/useTimelineSelectionStore';
import type { TextOverlay } from '../../types/domain';
import '../layout/transportGrid.css';

type DragMode = 'move' | 'left' | 'right';
const DEFAULT_TEXT_DURATION = 3;

// Corsia per le sovrapposizioni testuali (didascalie/titoli multipli) — stessa meccanica di
// drag/resize/impilamento di MusicLane/PhotoLane, senza upload file (il testo si crea e si
// modifica sul posto): il contenuto si modifica dall'inspector (TimelineInspector.tsx) dopo la
// selezione, il blocco stesso mostra il testo come etichetta.
export function TextLane() {
  const laneRef = useRef<HTMLDivElement>(null);
  const textOverlays = useProjectStore((s) => s.textOverlays);
  const updateTextOverlay = useProjectStore((s) => s.updateTextOverlay);
  const removeTextOverlay = useProjectStore((s) => s.removeTextOverlay);
  const addTextOverlay = useProjectStore((s) => s.addTextOverlay);
  const totalDur = useProjectStore((s) => s.video.durationSec);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const selection = useTimelineSelectionStore((s) => s.selection);
  const selectClip = useTimelineSelectionStore((s) => s.select);
  const { scrollRef, onScroll, onWheel, zoom } = useTimelineRowScroll();

  const startDrag = (e: ReactMouseEvent, clip: TextOverlay, mode: DragMode) => {
    e.preventDefault();
    const laneEl = laneRef.current;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();
    const startX = e.clientX;
    const orig = { videoStart: clip.videoStart, duration: clip.duration };
    const snapThreshold = snapEnabled ? (8 / laneRect.width) * totalDur : 0;
    const snapCandidates = [0, totalDur, usePlaybackStore.getState().currentTimeSec];
    textOverlays.forEach((other) => {
      if (other.id === clip.id) return;
      snapCandidates.push(other.videoStart, other.videoStart + other.duration);
    });

    const onMove = (ev: MouseEvent) => {
      const dxSec = ((ev.clientX - startX) / laneRect.width) * totalDur;
      if (mode === 'move') {
        let newStart = Math.max(0, Math.min(totalDur - orig.duration, orig.videoStart + dxSec));
        newStart = snapValue(newStart, [...snapCandidates, ...snapCandidates.map((c) => c - orig.duration)], snapThreshold);
        updateTextOverlay(clip.id, { videoStart: Math.max(0, Math.min(totalDur - orig.duration, newStart)) });
      } else if (mode === 'left') {
        const endAnchor = orig.videoStart + orig.duration;
        let newStart = snapValue(orig.videoStart + dxSec, snapCandidates, snapThreshold);
        newStart = Math.max(0, Math.min(endAnchor - 0.3, newStart));
        updateTextOverlay(clip.id, { videoStart: newStart, duration: endAnchor - newStart });
      } else {
        const rawEnd = snapValue(orig.videoStart + orig.duration + dxSec, snapCandidates, snapThreshold);
        let newDuration = Math.max(0.3, Math.min(30, rawEnd - orig.videoStart));
        if (orig.videoStart + newDuration > totalDur) newDuration = totalDur - orig.videoStart;
        updateTextOverlay(clip.id, { duration: newDuration });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleBlockMouseDown = (e: ReactMouseEvent, clip: TextOverlay) => {
    selectClip({ type: 'text', id: clip.id });
    const target = e.target as HTMLElement;
    if (target.closest('.lane-block__resize') || target.closest('.lane-block__remove')) return;
    startDrag(e, clip, 'move');
  };

  const handleLaneClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.lane-block')) return;
    useTimelineSelectionStore.getState().clear();
    const engine = getSessionEngine();
    const totalFrames = usePlaybackStore.getState().totalFrames;
    if (!engine || totalFrames <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    engine.seekTo(Math.round(frac * (totalFrames - 1)));
  };

  const handleAddClick = () => {
    if (totalDur <= 0) return;
    const duration = Math.min(DEFAULT_TEXT_DURATION, totalDur);
    const videoStart = Math.max(0, Math.min(totalDur - duration, currentTimeSec));
    const id = addTextOverlay('Testo', videoStart, duration);
    selectClip({ type: 'text', id });
  };

  const playheadPct = totalDur > 0 ? Math.max(0, Math.min(100, (currentTimeSec / totalDur) * 100)) : 0;

  // Testi sovrapposti nel tempo finiscono su righe separate all'interno della stessa corsia,
  // come musica/foto — la corsia cresce in altezza di conseguenza.
  const rowOf = assignLaneRows(textOverlays.map((t) => ({ id: t.id, start: t.videoStart, length: t.duration })));
  const rowCount = Math.max(1, ...Array.from(rowOf.values(), (r) => r + 1));

  return (
    <div className="transport-row">
      <div className="transport-row__prefix lane-row__label">
        <Type size={13} /> Testo
        <button type="button" className="lane-add" title="Aggiungi testo al punto attuale della riproduzione" onClick={handleAddClick}>
          <Plus size={13} />
        </button>
      </div>
      <div className="transport-row__track-scroll" ref={scrollRef} onScroll={onScroll} onWheel={onWheel}>
        <div
          className="transport-row__track lane"
          ref={laneRef}
          onClick={handleLaneClick}
          style={{ height: `${rowCount * 40}px`, width: `${zoom * 100}%` }}
        >
          {textOverlays.map((t) => {
            const leftPct = (t.videoStart / totalDur) * 100;
            const widthPct = Math.max(1, Math.min(100 - leftPct, (t.duration / totalDur) * 100));
            const row = rowOf.get(t.id) ?? 0;
            const isSelected = selection?.type === 'text' && selection.id === t.id;
            return (
              <div
                key={t.id}
                className={`lane-block lane-block--text${isSelected ? ' lane-block--selected' : ''}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: `${row * 40 + 3}px` }}
                title={`${t.text}: ${fmtMinSec(t.videoStart)} → ${fmtMinSec(t.videoStart + t.duration)}`}
                onMouseDown={(e) => handleBlockMouseDown(e, t)}
              >
                <div className="lane-block__label">{t.text || '(vuoto)'}</div>
                <div className="lane-block__remove" onClick={() => removeTextOverlay(t.id)}>
                  <X size={10} />
                </div>
                <div className="lane-block__resize lane-block__resize--left" onMouseDown={(e) => startDrag(e, t, 'left')} />
                <div className="lane-block__resize lane-block__resize--right" onMouseDown={(e) => startDrag(e, t, 'right')} />
              </div>
            );
          })}
          <div className="lane-playhead" style={{ left: `${playheadPct}%` }} />
        </div>
      </div>
    </div>
  );
}
