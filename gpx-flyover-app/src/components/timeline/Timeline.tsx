import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, useTimelineViewStore } from '../../store/useTimelineViewStore';
import { MusicLane } from './MusicLane';
import { PhotoLane } from './PhotoLane';
import { TimelineRuler } from './TimelineRuler';
import './timeline.css';

const ZOOM_STEP = 1.5;

// Port delle corsie musica/foto di gpx-flyover.html:240-251, con l'aggiunta di un righello dei
// secondi (TimelineRuler) e di uno zoom orizzontale (useTimelineViewStore/useTimelineRowScroll,
// condiviso da tutte le righe della timeline incluso il seek bar di PreviewControls).
export function Timeline() {
  const zoom = useTimelineViewStore((s) => s.zoom);
  const setZoom = useTimelineViewStore((s) => s.setZoom);

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <span className="timeline-toolbar__zoom-label">Zoom {zoom.toFixed(1)}x</span>
        <button
          type="button"
          className="timeline-toolbar__btn"
          disabled={zoom <= MIN_TIMELINE_ZOOM}
          onClick={() => setZoom(zoom / ZOOM_STEP)}
          title="Riduci zoom"
          aria-label="Riduci zoom"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="timeline-toolbar__btn"
          disabled={zoom >= MAX_TIMELINE_ZOOM}
          onClick={() => setZoom(zoom * ZOOM_STEP)}
          title="Aumenta zoom"
          aria-label="Aumenta zoom"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="timeline-toolbar__btn"
          disabled={zoom === MIN_TIMELINE_ZOOM}
          onClick={() => setZoom(1)}
          title="Adatta alla finestra"
          aria-label="Adatta alla finestra"
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <TimelineRuler />
      <MusicLane />
      <PhotoLane />
    </div>
  );
}
