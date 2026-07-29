import { useRef } from 'react';
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import { getSessionEngine } from '../../app/flyoverSession';
import { fmtMinSec } from '../../audio/musicEngine';
import { buildPhotoClipAtPlayhead } from '../../photos/photoEngine';
import { snapValue } from '../../timeline/timelineMath';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import type { PhotoClip } from '../../types/domain';

type DragMode = 'move' | 'left' | 'right';

// Port di renderPhotoLane/startPhotoDrag di gpx-flyover.html:1097-1189, e del pulsante "+"
// (gpx-flyover.html:1076-1095).
export function PhotoLane() {
  const laneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoClips = useProjectStore((s) => s.photoClips);
  const updatePhotoClip = useProjectStore((s) => s.updatePhotoClip);
  const removePhotoClip = useProjectStore((s) => s.removePhotoClip);
  const addPhotoClip = useProjectStore((s) => s.addPhotoClip);
  const photoDefaultDuration = useProjectStore((s) => s.photoDefaultDuration);
  const totalDur = useProjectStore((s) => s.video.durationSec);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);

  const startDrag = (e: ReactMouseEvent, clip: PhotoClip, mode: DragMode) => {
    e.preventDefault();
    const laneEl = laneRef.current;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();
    const startX = e.clientX;
    const orig = { videoStart: clip.videoStart, duration: clip.duration };
    const snapThreshold = (8 / laneRect.width) * totalDur;
    const snapCandidates = [0, totalDur, usePlaybackStore.getState().currentTimeSec];
    photoClips.forEach((other) => {
      if (other.id === clip.id) return;
      snapCandidates.push(other.videoStart, other.videoStart + other.duration);
    });

    const onMove = (ev: MouseEvent) => {
      const dxSec = ((ev.clientX - startX) / laneRect.width) * totalDur;
      if (mode === 'move') {
        let newStart = Math.max(0, Math.min(totalDur - orig.duration, orig.videoStart + dxSec));
        newStart = snapValue(newStart, [...snapCandidates, ...snapCandidates.map((c) => c - orig.duration)], snapThreshold);
        updatePhotoClip(clip.id, { videoStart: Math.max(0, Math.min(totalDur - orig.duration, newStart)) });
      } else if (mode === 'left') {
        const endAnchor = orig.videoStart + orig.duration;
        let newStart = snapValue(orig.videoStart + dxSec, snapCandidates, snapThreshold);
        newStart = Math.max(0, Math.min(endAnchor - 0.3, newStart));
        updatePhotoClip(clip.id, { videoStart: newStart, duration: endAnchor - newStart });
      } else {
        const rawEnd = snapValue(orig.videoStart + orig.duration + dxSec, snapCandidates, snapThreshold);
        let newDuration = Math.max(0.3, Math.min(15, rawEnd - orig.videoStart));
        if (orig.videoStart + newDuration > totalDur) newDuration = totalDur - orig.videoStart;
        updatePhotoClip(clip.id, { duration: newDuration });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleBlockMouseDown = (e: ReactMouseEvent, clip: PhotoClip) => {
    const target = e.target as HTMLElement;
    if (target.closest('.lane-block__resize') || target.closest('.lane-block__remove')) return;
    startDrag(e, clip, 'move');
  };

  const handleLaneClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.lane-block')) return;
    const engine = getSessionEngine();
    const totalFrames = usePlaybackStore.getState().totalFrames;
    if (!engine || totalFrames <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    engine.seekTo(Math.round(frac * (totalFrames - 1)));
  };

  const handleAddClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const playheadSec = usePlaybackStore.getState().currentTimeSec;
      const clip = await buildPhotoClipAtPlayhead(file, photoDefaultDuration, totalDur, playheadSec);
      addPhotoClip(clip);
    } catch (err) {
      console.error('Errore caricamento immagine', file.name, err);
      setStatusMessage(`Impossibile leggere l'immagine "${file.name}".`);
    }
  };

  const playheadPct = totalDur > 0 ? Math.max(0, Math.min(100, (currentTimeSec / totalDur) * 100)) : 0;

  return (
    <div className="lane-row">
      <div className="lane-row__label">
        🖼️ Foto
        <button type="button" className="lane-add" title="Aggiungi foto al punto attuale della riproduzione" onClick={handleAddClick}>
          +
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
      <div className="lane" ref={laneRef} onClick={handleLaneClick}>
        {photoClips.map((p) => {
          const leftPct = (p.videoStart / totalDur) * 100;
          const widthPct = Math.max(1, Math.min(100 - leftPct, (p.duration / totalDur) * 100));
          return (
            <div
              key={p.id}
              className="lane-block lane-block--photo"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`${p.name}: ${fmtMinSec(p.videoStart)} → ${fmtMinSec(p.videoStart + p.duration)}`}
              onMouseDown={(e) => handleBlockMouseDown(e, p)}
            >
              <img className="lane-block__thumb" src={p.img.src} alt="" />
              <div className="lane-block__label">{p.name}</div>
              <div className="lane-block__remove" onClick={() => removePhotoClip(p.id)}>
                ✕
              </div>
              <div className="lane-block__resize lane-block__resize--left" onMouseDown={(e) => startDrag(e, p, 'left')} />
              <div className="lane-block__resize lane-block__resize--right" onMouseDown={(e) => startDrag(e, p, 'right')} />
            </div>
          );
        })}
        <div className="lane-playhead" style={{ left: `${playheadPct}%` }} />
      </div>
    </div>
  );
}
