import { useRef } from 'react';
import type { ChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Music, Plus, X } from 'lucide-react';
import { getSessionEngine } from '../../app/flyoverSession';
import { decodeMusicFileAtPlayhead, fmtMinSec } from '../../audio/musicEngine';
import { assignLaneRows, snapValue } from '../../timeline/timelineMath';
import { useTimelineRowScroll } from '../../timeline/useTimelineRowScroll';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useTimelineSelectionStore } from '../../store/useTimelineSelectionStore';
import type { MusicTrack } from '../../types/domain';
import { MusicWaveform } from './MusicWaveform';
import '../layout/transportGrid.css';

type DragMode = 'move' | 'left' | 'right';

// Port di renderMusicLane/startMusicDrag di gpx-flyover.html:867-961.
export function MusicLane() {
  const laneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicTracks = useProjectStore((s) => s.musicTracks);
  const addMusicTrack = useProjectStore((s) => s.addMusicTrack);
  const updateMusicTrack = useProjectStore((s) => s.updateMusicTrack);
  const removeMusicTrack = useProjectStore((s) => s.removeMusicTrack);
  const totalDur = useProjectStore((s) => s.video.durationSec);
  const musicVolume = useProjectStore((s) => s.musicVolume);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);
  const selection = useTimelineSelectionStore((s) => s.selection);
  const selectClip = useTimelineSelectionStore((s) => s.select);
  const { scrollRef, onScroll, onWheel, zoom } = useTimelineRowScroll();

  const startDrag = (e: ReactMouseEvent, track: MusicTrack, mode: DragMode) => {
    e.preventDefault();
    const laneEl = laneRef.current;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();
    const startX = e.clientX;
    const orig = { videoStart: track.videoStart, trimStart: track.trimStart, trimEnd: track.trimEnd };
    const snapThreshold = snapEnabled ? (8 / laneRect.width) * totalDur : 0; // ~8px di tolleranza
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
    selectClip({ type: 'music', id: track.id });
    const target = e.target as HTMLElement;
    if (target.closest('.lane-block__resize') || target.closest('.lane-block__remove')) return;
    startDrag(e, track, 'move');
  };

  // Click su una corsia (fuori dai blocchi) sposta la riproduzione in quel punto e deseleziona.
  // Port 1:1 da gpx-flyover.html:657-665.
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

  const handleAddClick = () => fileInputRef.current?.click();

  const addFileAt = async (file: File, atSec: number) => {
    try {
      const track = await decodeMusicFileAtPlayhead(file, totalDur, atSec, musicVolume);
      addMusicTrack(track);
    } catch (err) {
      console.error('Errore decodifica audio', file.name, err);
      setStatusMessage(`Impossibile leggere il file audio "${file.name}" — formato non supportato?`);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await addFileAt(file, usePlaybackStore.getState().currentTimeSec);
  };

  // Drag-and-drop di un file audio direttamente sulla corsia: posizionato nel punto esatto del
  // rilascio invece che al playhead.
  const handleDragOver = (e: ReactDragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    await addFileAt(file, frac * totalDur);
  };

  const playheadPct = totalDur > 0 ? Math.max(0, Math.min(100, (currentTimeSec / totalDur) * 100)) : 0;

  // Brani sovrapposti/adiacenti nel tempo finiscono su righe separate all'interno della stessa
  // corsia, invece di impilarsi uno sopra l'altro — la corsia cresce in altezza di conseguenza.
  const rowOf = assignLaneRows(
    musicTracks.map((t) => ({ id: t.id, start: t.videoStart, length: t.trimEnd - t.trimStart })),
  );
  const rowCount = Math.max(1, ...Array.from(rowOf.values(), (r) => r + 1));

  return (
    <div className="transport-row">
      <div className="transport-row__prefix lane-row__label">
        <Music size={13} /> Musica
        <button type="button" className="lane-add" title="Aggiungi brano al punto attuale della riproduzione" onClick={handleAddClick}>
          <Plus size={13} />
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
      <div className="transport-row__track-scroll" ref={scrollRef} onScroll={onScroll} onWheel={onWheel}>
        <div
          className="transport-row__track lane"
          ref={laneRef}
          onClick={handleLaneClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ height: `${rowCount * 40}px`, width: `${zoom * 100}%` }}
        >
          {musicTracks.map((t) => {
            const length = t.trimEnd - t.trimStart;
            const leftPct = (t.videoStart / totalDur) * 100;
            const widthPct = Math.max(1, Math.min(100 - leftPct, (length / totalDur) * 100));
            const row = rowOf.get(t.id) ?? 0;
            const isSelected = selection?.type === 'music' && selection.id === t.id;
            return (
              <div
                key={t.id}
                className={`lane-block lane-block--music${isSelected ? ' lane-block--selected' : ''}${t.muted ? ' lane-block--muted' : ''}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: `${row * 40 + 3}px` }}
                title={`${t.name}: ${fmtMinSec(t.videoStart)} → ${fmtMinSec(t.videoStart + length)}`}
                onMouseDown={(e) => handleBlockMouseDown(e, t)}
              >
                <MusicWaveform buffer={t.buffer} trimStart={t.trimStart} trimEnd={t.trimEnd} />
                <div className="lane-block__label">{t.name}</div>
                <div className="lane-block__remove" onClick={() => removeMusicTrack(t.id)}>
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
