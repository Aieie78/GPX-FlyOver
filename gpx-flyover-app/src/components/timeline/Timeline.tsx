import { MusicLane } from './MusicLane';
import { PhotoLane } from './PhotoLane';
import { TimelineRuler } from './TimelineRuler';
import './timeline.css';

// Port delle corsie musica/foto di gpx-flyover.html:240-251, con l'aggiunta di un righello dei
// secondi (TimelineRuler) sopra le corsie.
export function Timeline() {
  return (
    <div className="timeline">
      <TimelineRuler />
      <MusicLane />
      <PhotoLane />
    </div>
  );
}
