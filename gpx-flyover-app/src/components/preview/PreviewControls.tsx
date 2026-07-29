import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import './previewControls.css';

// Placeholder funzionale minimo: verifica che lo store di playback sia collegato.
// La logica reale (rAF loop, sync musica, freeze sulle foto) arriva in fase 2.
export function PreviewControls() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const playbackSpeed = usePlaybackStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = usePlaybackStore((s) => s.setPlaybackSpeed);

  return (
    <div className="preview-controls">
      <button type="button" aria-label="Indietro 5s" className="preview-controls__btn">
        <SkipBack size={18} />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? 'Pausa' : 'Play'}
        className="preview-controls__btn preview-controls__btn--primary"
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button type="button" aria-label="Avanti 5s" className="preview-controls__btn">
        <SkipForward size={18} />
      </button>
      <select
        className="preview-controls__speed"
        value={playbackSpeed}
        onChange={(e) => setPlaybackSpeed(Number(e.target.value) as 0.5 | 1 | 1.5 | 2)}
      >
        <option value={0.5}>x0.5</option>
        <option value={1}>x1</option>
        <option value={1.5}>x1.5</option>
        <option value={2}>x2</option>
      </select>
    </div>
  );
}
