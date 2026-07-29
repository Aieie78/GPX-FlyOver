import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { getSessionEngine } from '../../app/flyoverSession';
import { fmtMinSec } from '../../audio/musicEngine';
import { snapValue } from '../../timeline/timelineMath';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import type { MusicTrack } from '../../types/domain';

type DragMode = 'move' | 'left' | 'right';

// Port di renderMusicLane/startMusicDrag di gpx-flyover.html:867-961.
export function MusicLane() {
  const laneRef = useRef<HTMLDivElement>(null);
  const musicTracks = useProjectStore((s) => s.musicTracks);
  const updateMusicTrack = useProjectStore((s) => s.updateMusicTrack);
  const removeMusicTrack = useProjectStore((s) => s.removeMusicTrack);
  const totalDur = useProjectStore((s) => s.video.durationSec);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);

  const startDrag = (e: ReactMouseEvent, track: MusicTrack, mode: DragMode) => {
    e.preventDefault();
    const laneEl = laneRef.current;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();
    const startX = e.clientX;
    const orig = { videoStart: track.videoStart, trimStart: track.trimStart, trimEnd: track.trimEnd };
    const snapThreshold = (8 / laneRect.width) * totalDur; // ~8px di tolleranza
    const snapCandidates = [0, totalDur, usePlaybackStore.getState().currentTimeSec];
    musicTracks.forEach((other) => {
      if (other.id === track.id) return;
      snapCandidates.push(other.videoStart, other.videoStart + (other.trimEnd - other.trimStart));
    });

    const onMove = (ev: MouseEvent) => {
      const dxSec = ((ev.clientX - startX) / laneRect.width) * totalDur;
      if (mode === 'move') {
        const length = orig.trimEnd - orig.trimStart;
        let newStart = Math.max(0, Math.min(totalDur - length, orig.videoStart + dxSec));
        newStart = snapValue(newStart, [...snapCandidates, ...snapCandidates.map((c) => c - length)], snapThreshold);
        updateMusicTrack(track.id, { videoStart: Math.max(0, Math.min(totalDur - length, newStart)) });
      } else if (mode === 'left') {
        // ancora il punto finale (videoStart+length e trimEnd), sposta l'inizio
        const endAnchorVideo = orig.videoStart + (orig.trimEnd - orig.trimStart);
        const newVideoStartRaw = snapValue(orig.videoStart + dxSec, snapCandidates, snapThreshold);
        const newTrimStart = Math.max(
          0,
          Math.min(orig.trimEnd - 0.3, orig.trimStart + (newVideoStartRaw - orig.videoStart)),
        );
        const newLength = orig.trimEnd - newTrimStart;
        let newVideoStart = endAnchorVideo - newLength;
        if (newVideoStart < 0) newVideoStart = 0;
        updateMusicTrack(track.id, { trimStart: newTrimStart, videoStart: newVideoStart });
      } else {
        // ancora inizio (videoStart, trimStart), estende/riduce la fine
        const rawEndVideo = snapValue(
          orig.videoStart + (orig.trimEnd - orig.trimStart) + dxSec,
          snapCandidates,
          snapThreshold,
        );
        let newTrimEnd = Math.max(
          orig.trimStart + 0.3,
          Math.min(track.duration, orig.trimStart + (rawEndVideo - orig.videoStart)),
        );
        const newLength = newTrimEnd - orig.trimStart;
        if (orig.videoStart + newLength > totalDur) newTrimEnd = orig.trimStart + (totalDur - orig.videoStart);
        updateMusicTrack(track.id, { trimEnd: newTrimEnd });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleBlockMouseDown = (e: ReactMouseEvent, track: MusicTrack) => {
    const target = e.target as HTMLElement;
    if (target.closest('.lane-block__resize') || target.closest('.lane-block__remove')) return;
    startDrag(e, track, 'move');
  };

  // Click su una corsia (fuori dai blocchi) sposta la riproduzione in quel punto.
  // Port 1:1 da gpx-flyover.html:657-665.
  const handleLaneClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.lane-block')) return;
    const engine = getSessionEngine();
    const totalFrames = usePlaybackStore.getState().totalFrames;
    if (!engine || totalFrames <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    engine.seekTo(Math.round(frac * (totalFrames - 1)));
  };

  const playheadPct = totalDur > 0 ? Math.max(0, Math.min(100, (currentTimeSec / totalDur) * 100)) : 0;

  return (
    <div className="lane-row">
      <div className="lane-row__label">🎵 Musica</div>
      <div className="lane" ref={laneRef} onClick={handleLaneClick}>
        {musicTracks.map((t) => {
          const length = t.trimEnd - t.trimStart;
          const leftPct = (t.videoStart / totalDur) * 100;
          const widthPct = Math.max(1, Math.min(100 - leftPct, (length / totalDur) * 100));
          return (
            <div
              key={t.id}
              className="lane-block lane-block--music"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`${t.name}: ${fmtMinSec(t.videoStart)} → ${fmtMinSec(t.videoStart + length)}`}
              onMouseDown={(e) => handleBlockMouseDown(e, t)}
            >
              <div className="lane-block__label">{t.name}</div>
              <div className="lane-block__remove" onClick={() => removeMusicTrack(t.id)}>
                ✕
              </div>
              <div className="lane-block__resize lane-block__resize--left" onMouseDown={(e) => startDrag(e, t, 'left')} />
              <div className="lane-block__resize lane-block__resize--right" onMouseDown={(e) => startDrag(e, t, 'right')} />
            </div>
          );
        })}
        <div className="lane-playhead" style={{ left: `${playheadPct}%` }} />
      </div>
    </div>
  );
}
