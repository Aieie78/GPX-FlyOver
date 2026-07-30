import { Magnet, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, useTimelineViewStore } from '../../store/useTimelineViewStore';
import { MusicLane } from './MusicLane';
import { PhotoLane } from './PhotoLane';
import { TimelineInspector } from './TimelineInspector';
import { TimelineRuler } from './TimelineRuler';
import './timeline.css';

const ZOOM_STEP = 1.5;

// Port delle corsie musica/foto di gpx-flyover.html:240-251, con l'aggiunta di un righello dei
// secondi (TimelineRuler), di uno zoom orizzontale (useTimelineViewStore/useTimelineRowScroll,
// condiviso da tutte le righe della timeline incluso il seek bar di PreviewControls), di un
// interruttore per la calamita/snap e di un inspector per il blocco selezionato.
export function Timeline() {
  const zoom = useTimelineViewStore((s) => s.zoom);
  const setZoom = useTimelineViewStore((s) => s.setZoom);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const setSnapEnabled = useProjectStore((s) => s.setSnapEnabled);

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <button
          type="button"
          className={`timeline-toolbar__btn${snapEnabled ? ' timeline-toolbar__btn--active' : ''}`}
          onClick={() => setSnapEnabled(!snapEnabled)}
          title={snapEnabled ? 'Disattiva calamita/snap' : 'Attiva calamita/snap'}
          aria-label="Attiva/disattiva calamita"
        >
          <Magnet size={14} />
        </button>
        <span className="timeline-toolbar__spacer" />
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
      <TimelineInspector />
      <TimelineRuler />
      <MusicLane />
      <PhotoLane />
    </div>
  );
}
