import { useProjectStore } from '../../store/useProjectStore';
import type { VideoAspectRatio, VideoResolution } from '../../types/domain';

// Port dei controlli video di gpx-flyover.html:97-123.
export function VideoPanel() {
  const video = useProjectStore((s) => s.video);
  const updateVideo = useProjectStore((s) => s.updateVideo);

  return (
    <>
      <div className="row">
        <div>
          <label>Risoluzione video</label>
          <select
            value={video.resolution}
            onChange={(e) => updateVideo({ resolution: e.target.value as VideoResolution })}
          >
            <option value="1280x720">720p (più leggero)</option>
            <option value="1920x1080">1080p (consigliato)</option>
            <option value="2560x1440">1440p (più pesante)</option>
          </select>
        </div>
        <div>
          <label>Bitrate (Mbps)</label>
          <input
            type="number"
            min={1}
            max={30}
            step={0.5}
            value={video.bitrateMbps}
            onChange={(e) => updateVideo({ bitrateMbps: parseFloat(e.target.value) || 8 })}
          />
        </div>
      </div>

      <label>Durata video (sec)</label>
      <input
        type="number"
        min={5}
        max={600}
        value={video.durationSec}
        onChange={(e) => updateVideo({ durationSec: parseFloat(e.target.value) || 30 })}
      />

      <div className="row">
        <div>
          <label>FPS</label>
          <input
            type="number"
            min={15}
            max={60}
            value={video.fps}
            onChange={(e) => updateVideo({ fps: parseInt(e.target.value, 10) || 30 })}
          />
        </div>
        <div>
          <label>Formato</label>
          <select value={video.aspectRatio} onChange={(e) => updateVideo({ aspectRatio: e.target.value as VideoAspectRatio })}>
            <option value="16:9">16:9 (standard)</option>
            <option value="9:16">9:16 (storie/reel)</option>
            <option value="1:1">1:1 (quadrato)</option>
          </select>
        </div>
      </div>
      {video.aspectRatio !== '16:9' && (
        <p className="field-hint">
          La scena viene composta come oggi e poi ritagliata al centro nel formato scelto — sui lati verticali si
          perde parte dell'inquadratura.
        </p>
      )}
    </>
  );
}
