import { useState } from 'react';
import { getSessionEngine, getSessionMap, getSessionRecCanvas } from '../../app/flyoverSession';
import { recordFlight } from '../../export/videoExport';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

// Port dei pulsanti 2/3 e dell'output di gpx-flyover.html:204-212, 730-818, 1501-1505.
export function ActionsPanel() {
  const canPreview = usePlaybackStore((s) => s.canPreview);
  const isRecording = usePlaybackStore((s) => s.isRecording);
  const setIsRecording = usePlaybackStore((s) => s.setIsRecording);
  const statusMessage = usePlaybackStore((s) => s.statusMessage);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);
  const playbackSpeed = usePlaybackStore((s) => s.playbackSpeed);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handlePreview = () => {
    getSessionEngine()?.start();
  };

  const handleRecord = async () => {
    const map = getSessionMap();
    const recCanvas = getSessionRecCanvas();
    const track = useProjectStore.getState().track;
    if (!map || !recCanvas || !track) return;

    getSessionEngine()?.stop();
    setIsRecording(true);
    setStatusMessage('Registrazione in corso... non chiudere la finestra.');
    try {
      const { video, camera, vehicle, musicTracks, musicVolume, title } = useProjectStore.getState();
      const photoClips = useProjectStore.getState().photoClips;
      recCanvas.style.display = 'block';
      const blob = await recordFlight({
        map,
        track,
        recCanvas,
        video,
        camera,
        vehicle,
        musicTracks,
        musicVolume,
        title,
        selectedSpeed: playbackSpeed,
        photoClips,
      });
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(blob));
      setStatusMessage('Video generato! Anteprima qui sotto, poi scaricalo.');
    } catch (err) {
      console.error(err);
      setStatusMessage(err instanceof Error ? `Errore durante la registrazione: ${err.message}` : 'Errore durante la registrazione.');
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="sidebar-actions">
      <button type="button" className="action-btn secondary" disabled={!canPreview || isRecording} onClick={handlePreview}>
        2. Anteprima (senza registrare)
      </button>
      <button type="button" className="action-btn" disabled={!canPreview || isRecording} onClick={handleRecord}>
        3. Registra e genera video
      </button>

      {statusMessage && <p className="status-text">{statusMessage}</p>}

      {videoUrl && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="video-output" src={videoUrl} controls />
          <a className="download-link" href={videoUrl} download="giro_flyover.webm">
            ⬇️ Scarica video (.webm)
          </a>
        </>
      )}
    </div>
  );
}
