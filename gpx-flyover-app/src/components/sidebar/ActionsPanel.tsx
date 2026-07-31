import { useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { getSessionEngine, getSessionMap, getSessionRecCanvas } from '../../app/flyoverSession';
import { ExportCancelledError, isDeterministicExportSupported, recordFlightDeterministic } from '../../export/deterministicExport';
import { recordFlight } from '../../export/videoExport';
import { getPrimaryTrack, useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

interface ActionsPanelProps {
  onLoad: () => void;
}

// Port dei pulsanti 1/2/3 e dell'output di gpx-flyover.html:203-212, 730-818, 1386-1395,
// 1501-1505. Sticky in cima alla sidebar (Sidebar.tsx), sempre visibile durante lo scroll
// delle sezioni sottostanti.
export function ActionsPanel({ onLoad }: ActionsPanelProps) {
  const canPreview = usePlaybackStore((s) => s.canPreview);
  const isRecording = usePlaybackStore((s) => s.isRecording);
  const setIsRecording = usePlaybackStore((s) => s.setIsRecording);
  const statusMessage = usePlaybackStore((s) => s.statusMessage);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);
  const playbackSpeed = usePlaybackStore((s) => s.playbackSpeed);
  const durationSec = useProjectStore((s) => s.video.durationSec);
  const trimStartSec = useProjectStore((s) => s.video.trimStartSec);
  const trimEndSec = useProjectStore((s) => s.video.trimEndSec);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const cancelTokenRef = useRef<{ cancelled: boolean } | null>(null);

  // Calcolato una volta sola: il supporto WebCodecs non cambia durante la sessione.
  const deterministicSupported = useMemo(() => isDeterministicExportSupported(), []);

  const handlePreview = () => {
    getSessionEngine()?.start();
  };

  const handleCancelExport = () => {
    if (cancelTokenRef.current) cancelTokenRef.current.cancelled = true;
  };

  const handleRecord = async () => {
    const map = getSessionMap();
    const recCanvas = getSessionRecCanvas();
    const primary = getPrimaryTrack(useProjectStore.getState());
    if (!map || !recCanvas || !primary) return;

    getSessionEngine()?.stop();
    setIsRecording(true);
    setExportProgress(0);
    try {
      const { video, camera, musicTracks, musicVolume, title } = useProjectStore.getState();
      const photoClips = useProjectStore.getState().photoClips;
      const textOverlays = useProjectStore.getState().textOverlays;
      recCanvas.style.display = 'block';
      const recordArgs = {
        map,
        track: primary.track,
        recCanvas,
        video,
        camera,
        vehicle: primary.vehicle,
        musicTracks,
        musicVolume,
        title,
        selectedSpeed: playbackSpeed,
        photoClips,
        textOverlays,
      };

      let blob: Blob;
      if (deterministicSupported) {
        setStatusMessage('Generazione video in corso...');
        const cancelToken = { cancelled: false };
        cancelTokenRef.current = cancelToken;
        blob = await recordFlightDeterministic(
          recordArgs,
          (fraction) => setExportProgress(fraction),
          () => cancelToken.cancelled,
        );
      } else {
        // Browser senza WebCodecs (VideoEncoder/AudioEncoder): niente crash né errore silenzioso,
        // si torna alla registrazione in tempo reale esistente, con un avviso chiaro sul motivo
        // (è più lenta e può risentire di scatti su risoluzioni/durate impegnative).
        setStatusMessage(
          'Il browser non supporta la codifica ottimizzata (WebCodecs): uso la registrazione in tempo reale, più lenta e meno fluida su video lunghi/pesanti.',
        );
        blob = await recordFlight(recordArgs);
      }

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(blob));
      setStatusMessage('Video generato! Anteprima qui sotto, poi scaricalo.');
    } catch (err) {
      if (err instanceof ExportCancelledError) {
        setStatusMessage('Esportazione annullata.');
      } else {
        console.error(err);
        setStatusMessage(err instanceof Error ? `Errore durante la registrazione: ${err.message}` : 'Errore durante la registrazione.');
      }
    } finally {
      setIsRecording(false);
      cancelTokenRef.current = null;
      // Nasconde di nuovo il canvas di registrazione (rimasto visibile in cima a mappa/overlay,
      // z-index più alto) così l'anteprima torna visibile per un nuovo ciclo Anteprima/Registra
      // senza dover ricaricare la pagina.
      recCanvas.style.display = 'none';
    }
  };

  // Port di updateRecordSpeedNote, gpx-flyover.html:1386-1395, esteso per avvisare anche
  // quando è selezionato solo un intervallo della timeline (maniglie sulla barra video).
  const effectiveTrimEnd = trimEndSec ?? durationSec;
  const isTrimmed = trimStartSec > 0.05 || effectiveTrimEnd < durationSec - 0.05;
  const recordedRangeSec = Math.max(0, effectiveTrimEnd - trimStartSec);
  const noteParts: string[] = [];
  if (playbackSpeed !== 1) noteParts.push(`x${playbackSpeed}`);
  if (isTrimmed) noteParts.push(`intervallo ${trimStartSec.toFixed(1)}s–${effectiveTrimEnd.toFixed(1)}s`);
  const recordSpeedNote = noteParts.length
    ? `Verrà registrato ${noteParts.join(', ')} → durata effettiva video: ${(recordedRangeSec / playbackSpeed).toFixed(1)}s`
    : '';

  return (
    <div className="sidebar-actions">
      <button type="button" className="action-btn" onClick={onLoad}>
        1. Carica traccia sulla mappa
      </button>
      <button type="button" className="action-btn" disabled={!canPreview || isRecording} onClick={handlePreview}>
        2. Anteprima (senza registrare)
      </button>
      <button type="button" className="action-btn" disabled={!canPreview || isRecording} onClick={handleRecord}>
        3. Registra e genera video
      </button>
      {recordSpeedNote && <p className="record-speed-note">{recordSpeedNote}</p>}

      {isRecording && deterministicSupported && (
        <div className="export-progress">
          <div className="export-progress__bar">
            <div className="export-progress__fill" style={{ width: `${(exportProgress * 100).toFixed(1)}%` }} />
          </div>
          <div className="export-progress__row">
            <span className="export-progress__label">{Math.round(exportProgress * 100)}%</span>
            <button type="button" className="export-progress__cancel" onClick={handleCancelExport}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {statusMessage && <p className="status-text">{statusMessage}</p>}

      {videoUrl && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="video-output" src={videoUrl} controls />
          <a className="download-link" href={videoUrl} download="giro_flyover.webm">
            <Download size={13} /> Scarica video (.webm)
          </a>
        </>
      )}
    </div>
  );
}
