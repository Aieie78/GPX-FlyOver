import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { getSessionEngine } from '../../app/flyoverSession';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import type { PlaybackSpeed } from '../../types/domain';
import './previewControls.css';

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

// Port della barra player di gpx-flyover.html:220-239, 1350-1384.
export function PreviewControls() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackSpeed = usePlaybackStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = usePlaybackStore((s) => s.setPlaybackSpeed);
  const currentFrame = usePlaybackStore((s) => s.currentFrame);
  const totalFrames = usePlaybackStore((s) => s.totalFrames);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const totalTimeSec = usePlaybackStore((s) => s.totalTimeSec);

  const started = totalFrames > 0;

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

  return (
    <div className="preview-controls">
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

      <input
        type="range"
        className="preview-controls__seek"
        min={0}
        max={Math.max(0, totalFrames - 1)}
        value={currentFrame}
        disabled={!started}
        onChange={(e) => handleSeekBarChange(Number(e.target.value))}
      />

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
  );
}
