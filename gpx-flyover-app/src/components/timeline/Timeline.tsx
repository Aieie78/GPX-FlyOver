import './timeline.css';

// Placeholder per le 3 corsie sincronizzate (video/musica/foto) con playhead condivisa.
// Drag/resize/snap/zoom orizzontale: fase 2/3 (prompt-refactoring.md priorità alta #3, #5).
export function Timeline() {
  return (
    <div className="timeline">
      <div className="timeline__ruler">00:00 — timeline ruler placeholder</div>
      <div className="timeline__lane timeline__lane--video">Corsia video</div>
      <div className="timeline__lane timeline__lane--music">Corsia musica</div>
      <div className="timeline__lane timeline__lane--photo">Corsia foto</div>
    </div>
  );
}
