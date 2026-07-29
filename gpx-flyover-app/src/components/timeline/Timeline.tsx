import { MusicLane } from './MusicLane';
import { PhotoLane } from './PhotoLane';
import './timeline.css';

// Port delle corsie musica/foto di gpx-flyover.html:240-251.
export function Timeline() {
  return (
    <div className="timeline">
      <MusicLane />
      <PhotoLane />
    </div>
  );
}
