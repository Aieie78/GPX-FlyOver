import { Copy, Scissors, Volume2, VolumeX } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useTimelineSelectionStore } from '../../store/useTimelineSelectionStore';

const SOLO_LABEL = 'S';

// Pannello del blocco musica/foto attualmente selezionato (click su un blocco nelle corsie
// sottostanti) — invece di affollare i blocchi (alti solo 34px) con altre icone oltre a
// rimuovi/ruota già presenti, i controlli meno frequenti (volume, mute, solo, taglia, duplica)
// vivono qui, in una riga sola sempre alla stessa altezza. Nullo (non renderizza nulla) se non
// c'è alcuna selezione.
export function TimelineInspector() {
  const selection = useTimelineSelectionStore((s) => s.selection);
  const clearSelection = useTimelineSelectionStore((s) => s.clear);
  const musicTracks = useProjectStore((s) => s.musicTracks);
  const photoClips = useProjectStore((s) => s.photoClips);
  const textOverlays = useProjectStore((s) => s.textOverlays);
  const updateMusicTrack = useProjectStore((s) => s.updateMusicTrack);
  const duplicateMusicTrack = useProjectStore((s) => s.duplicateMusicTrack);
  const splitMusicTrackAt = useProjectStore((s) => s.splitMusicTrackAt);
  const duplicatePhotoClip = useProjectStore((s) => s.duplicatePhotoClip);
  const splitPhotoClipAt = useProjectStore((s) => s.splitPhotoClipAt);
  const updateTextOverlay = useProjectStore((s) => s.updateTextOverlay);
  const duplicateTextOverlay = useProjectStore((s) => s.duplicateTextOverlay);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);

  if (!selection) return null;

  if (selection.type === 'music') {
    const track = musicTracks.find((t) => t.id === selection.id);
    if (!track) return null;
    const start = track.videoStart;
    const end = start + (track.trimEnd - track.trimStart);
    const canSplit = currentTimeSec > start + 0.15 && currentTimeSec < end - 0.15;

    return (
      <div className="timeline-inspector">
        <span className="timeline-inspector__name" title={track.name}>
          {track.name}
        </span>
        <button
          type="button"
          className={`timeline-inspector__btn${track.muted ? ' timeline-inspector__btn--active' : ''}`}
          title={track.muted ? 'Riattiva audio' : 'Muto'}
          onClick={() => updateMusicTrack(track.id, { muted: !track.muted })}
        >
          {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
        <button
          type="button"
          className={`timeline-inspector__btn timeline-inspector__btn--solo${track.solo ? ' timeline-inspector__btn--active' : ''}`}
          title={track.solo ? 'Disattiva solo' : 'Solo (silenzia gli altri brani)'}
          onClick={() => updateMusicTrack(track.id, { solo: !track.solo })}
        >
          {SOLO_LABEL}
        </button>
        <input
          type="range"
          className="timeline-inspector__volume"
          min={0}
          max={100}
          value={Math.round(track.volume * 100)}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
          onChange={(e) => updateMusicTrack(track.id, { volume: Number(e.target.value) / 100 })}
        />
        <button
          type="button"
          className="timeline-inspector__btn"
          disabled={!canSplit}
          title="Taglia al playhead"
          onClick={() => splitMusicTrackAt(track.id, currentTimeSec)}
        >
          <Scissors size={13} />
        </button>
        <button
          type="button"
          className="timeline-inspector__btn"
          title="Duplica"
          onClick={() => duplicateMusicTrack(track.id)}
        >
          <Copy size={13} />
        </button>
        <button type="button" className="timeline-inspector__close" title="Deseleziona" onClick={clearSelection}>
          ×
        </button>
      </div>
    );
  }

  if (selection.type === 'text') {
    const overlay = textOverlays.find((t) => t.id === selection.id);
    if (!overlay) return null;

    return (
      <div className="timeline-inspector">
        <input
          type="text"
          className="timeline-inspector__text-input"
          value={overlay.text}
          placeholder="Testo della sovrapposizione..."
          onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
        />
        <button
          type="button"
          className="timeline-inspector__btn"
          title="Duplica"
          onClick={() => duplicateTextOverlay(overlay.id)}
        >
          <Copy size={13} />
        </button>
        <button type="button" className="timeline-inspector__close" title="Deseleziona" onClick={clearSelection}>
          ×
        </button>
      </div>
    );
  }

  const clip = photoClips.find((p) => p.id === selection.id);
  if (!clip) return null;
  const start = clip.videoStart;
  const end = start + clip.duration;
  const canSplit = currentTimeSec > start + 0.15 && currentTimeSec < end - 0.15;

  return (
    <div className="timeline-inspector">
      <span className="timeline-inspector__name" title={clip.name}>
        {clip.name}
      </span>
      <button
        type="button"
        className="timeline-inspector__btn"
        disabled={!canSplit}
        title="Taglia al playhead"
        onClick={() => splitPhotoClipAt(clip.id, currentTimeSec)}
      >
        <Scissors size={13} />
      </button>
      <button
        type="button"
        className="timeline-inspector__btn"
        title="Duplica"
        onClick={() => duplicatePhotoClip(clip.id)}
      >
        <Copy size={13} />
      </button>
      <button type="button" className="timeline-inspector__close" title="Deseleziona" onClick={clearSelection}>
        ×
      </button>
    </div>
  );
}
