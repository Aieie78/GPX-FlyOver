import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { getSessionEngine } from '../../app/flyoverSession';
import { fmtMinSec } from '../../audio/musicEngine';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useTimelineRowScroll } from '../../timeline/useTimelineRowScroll';
import type { PlaybackSpeed } from '../../types/domain';
import '../layout/transportGrid.css';
import './previewControls.css';

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

// Port della barra player di gpx-flyover.html:220-239, 1350-1384. La colonna centrale
// (.transport-row__track) usa la stessa griglia e la stessa playhead condivisa delle corsie
// musica/foto (Timeline.tsx) — il pallino nativo dello slider viene reso invisibile
// (previewControls.css) esattamente come .seekTrack nell'originale, per eliminare lo
// sfasamento tra il pallino e una riga di playhead calcolata a percentuale.
export function PreviewControls() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackSpeed = usePlaybackStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = usePlaybackStore((s) => s.setPlaybackSpeed);
  const currentFrame = usePlaybackStore((s) => s.currentFrame);
  const totalFrames = usePlaybackStore((s) => s.totalFrames);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const totalTimeSec = usePlaybackStore((s) => s.totalTimeSec);
  const totalDur = useProjectStore((s) => s.video.durationSec);
  const trimStartSec = useProjectStore((s) => s.video.trimStartSec);
  const trimEndSec = useProjectStore((s) => s.video.trimEndSec);
  const updateVideo = useProjectStore((s) => s.updateVideo);
  const { scrollRef, onScroll, onWheel, zoom } = useTimelineRowScroll();
  const [hover, setHover] = useState<{ pct: number; timeSec: number } | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const started = totalFrames > 0;
  // Stessa base di calcolo (currentTimeSec / durata video configurata) usata da MusicLane e
  // PhotoLane per la loro playhead, così le tre righe restano perfettamente allineate.
  const playheadPct = totalDur > 0 ? Math.max(0, Math.min(100, (currentTimeSec / totalDur) * 100)) : 0;

  // Intervallo effettivamente registrato in esportazione (trimEndSec null = fino alla fine,
  // segue durationSec se cambia). L'anteprima interattiva non è toccata da questo ritaglio.
  const effectiveTrimEnd = trimEndSec ?? totalDur;
  const trimStartPct = totalDur > 0 ? Math.max(0, Math.min(100, (trimStartSec / totalDur) * 100)) : 0;
  const trimEndPct = totalDur > 0 ? Math.max(0, Math.min(100, (effectiveTrimEnd / totalDur) * 100)) : 100;

  const resetTrim = () => updateVideo({ trimStartSec: 0, trimEndSec: null });

  const startTrimDrag = (e: ReactMouseEvent, edge: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    const laneEl = laneRef.current;
    if (!laneEl || totalDur <= 0) return;
    const rect = laneEl.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      const sec = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * totalDur;
      if (edge === 'start') {
        const newStart = Math.max(0, Math.min(sec, effectiveTrimEnd - 0.5));
        updateVideo({ trimStartSec: newStart < 0.15 ? 0 : newStart });
      } else {
        const newEnd = Math.max(trimStartSec + 0.5, Math.min(sec, totalDur));
        updateVideo({ trimEndSec: newEnd > totalDur - 0.15 ? null : newEnd });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const togglePlayPause = () => {
    getSessionEngine()?.setPlaying(!isPlaying);
  };

  const seekBack = () => getSessionEngine()?.seekBySeconds(-5);
  const seekFwd = () => getSessionEngine()?.seekBySeconds(5);

  const handleSpeedClick = (speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
    getSessionEngine()?.setSpeed(speed);
  };

  const handleSeekBarChange = (value: number) => {
    getSessionEngine()?.seekTo(value);
  };

  // Anteprima: solo l'orario nel punto sotto il cursore (nessuna vera miniatura, che
  // richiederebbe di spostare momentaneamente la mappa 3D live e farla "lampeggiare" durante lo
  // scrubbing — scelta esplicita per non rischiare di disturbare la mappa vera).
  const handleTrackMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!started) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHover({ pct: pct * 100, timeSec: pct * totalTimeSec });
  };
  const handleTrackMouseLeave = () => setHover(null);

  return (
    <div className="transport-row preview-controls">
      <div className="transport-row__prefix">
        <button type="button" aria-label="Indietro 5s" className="preview-controls__btn" disabled={!started} onClick={seekBack}>
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? 'Pausa' : 'Play'}
          className="preview-controls__btn preview-controls__btn--primary"
          disabled={!started}
          onClick={togglePlayPause}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" aria-label="Avanti 5s" className="preview-controls__btn" disabled={!started} onClick={seekFwd}>
          <SkipForward size={18} />
        </button>
      </div>

      <div className="transport-row__track-scroll" ref={scrollRef} onScroll={onScroll} onWheel={onWheel}>
        <div
          className="transport-row__track lane"
          ref={laneRef}
          style={{ width: `${zoom * 100}%` }}
          onMouseMove={handleTrackMouseMove}
          onMouseLeave={handleTrackMouseLeave}
        >
          <input
            type="range"
            className="transport-seek-input"
            min={0}
            max={Math.max(0, totalFrames - 1)}
            value={currentFrame}
            disabled={!started}
            onChange={(e) => handleSeekBarChange(Number(e.target.value))}
          />
          {trimStartPct > 0 && <div className="preview-controls__trim-dim" style={{ left: 0, width: `${trimStartPct}%` }} />}
          {trimEndPct < 100 && (
            <div className="preview-controls__trim-dim" style={{ left: `${trimEndPct}%`, width: `${100 - trimEndPct}%` }} />
          )}
          <div className="lane-playhead" style={{ left: `${playheadPct}%` }} />
          <div
            className="preview-controls__trim-handle preview-controls__trim-handle--start"
            style={{ left: `${trimStartPct}%` }}
            onMouseDown={(e) => startTrimDrag(e, 'start')}
            onDoubleClick={resetTrim}
            title="Trascina per impostare l'inizio della registrazione (doppio click per azzerare)"
          />
          <div
            className="preview-controls__trim-handle preview-controls__trim-handle--end"
            style={{ left: `${trimEndPct}%` }}
            onMouseDown={(e) => startTrimDrag(e, 'end')}
            onDoubleClick={resetTrim}
            title="Trascina per impostare la fine della registrazione (doppio click per azzerare)"
          />
          {hover && (
            <div className="preview-controls__hover-tooltip" style={{ left: `${hover.pct}%` }}>
              {fmtMinSec(hover.timeSec)}
            </div>
          )}
        </div>
      </div>

      <div className="transport-row__suffix">
        <span className="preview-controls__time">
          {currentTimeSec.toFixed(1)}s / {totalTimeSec.toFixed(1)}s
        </span>
        <div className="preview-controls__speeds">
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={`preview-controls__speed-btn${playbackSpeed === speed ? ' preview-controls__speed-btn--active' : ''}`}
              onClick={() => handleSpeedClick(speed)}
            >
              x{speed}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
