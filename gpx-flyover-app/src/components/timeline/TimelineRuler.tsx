import { useProjectStore } from '../../store/useProjectStore';
import { useTimelineRowScroll } from '../../timeline/useTimelineRowScroll';
import '../layout/transportGrid.css';

// Sceglie un passo "leggibile" in secondi tra i tick, in base alla durata totale del video,
// così il righello non si affolla su video lunghi né resta troppo spoglio su video brevi.
function pickTickStep(totalDurationSec: number): number {
  if (totalDurationSec <= 20) return 2;
  if (totalDurationSec <= 60) return 5;
  if (totalDurationSec <= 150) return 10;
  if (totalDurationSec <= 400) return 30;
  return 60;
}

function fmtTick(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Righello dei secondi sopra le corsie musica/foto — riusa la stessa griglia
// (.transport-row, transportGrid.css) delle altre righe così i tick restano allineati in
// orizzontale ai blocchi sottostanti, senza calcoli di posizione indipendenti.
export function TimelineRuler() {
  const totalDur = useProjectStore((s) => s.video.durationSec);
  const { scrollRef, onScroll, onWheel, zoom } = useTimelineRowScroll();
  if (totalDur <= 0) return null;

  // Il passo dei tick si infittisce con lo zoom, come nella barra di scorrimento di un editor
  // video: a zoom 1x usa il passo "largo" calcolato sulla durata totale, a zoom Nx si comporta
  // come se la durata "visibile" fosse totalDur/N.
  const step = pickTickStep(totalDur / zoom);
  const ticks: number[] = [];
  for (let t = 0; t <= totalDur + 0.001; t += step) ticks.push(t);

  return (
    <div className="transport-row timeline-ruler">
      <div className="transport-row__prefix" />
      <div className="transport-row__track-scroll" ref={scrollRef} onScroll={onScroll} onWheel={onWheel}>
        <div className="timeline-ruler__track" style={{ width: `${zoom * 100}%` }}>
          {ticks.map((t) => {
            const pct = (t / totalDur) * 100;
            const isLast = pct > 100 - 100 / (12 * zoom);
            return (
              <div key={t} className="timeline-ruler__tick" style={{ left: `${pct}%` }}>
                <span className={`timeline-ruler__label${isLast ? ' timeline-ruler__label--end' : ''}`}>
                  {fmtTick(t)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="transport-row__suffix" />
    </div>
  );
}
