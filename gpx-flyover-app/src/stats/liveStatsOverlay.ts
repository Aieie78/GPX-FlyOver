import type { PathPoint } from '../types/domain';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function compassLabel(deg: number): string {
  return COMPASS_POINTS[Math.round(deg / 45) % 8];
}

// Converte un grado decimale in gradi/primi/secondi (DMS), con la lettera dell'emisfero.
function formatDMS(value: number, positiveLabel: string, negativeLabel: string): string {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const sec = (minFloat - m) * 60;
  const dir = value >= 0 ? positiveLabel : negativeLabel;
  return `${d}°${m}'${sec.toFixed(1)}"${dir}`;
}

// Riquadro in basso a destra con velocità/rotta/quota/posizione (DMS) in tempo reale, disegnato
// sia in anteprima (PreviewEngine.ts) sia nel video esportato (drawOverlayFrame, videoExport.ts)
// — attivabile dalla checkbox "Dati in tempo reale" nel pannello Mezzo. Posizionato a destra per
// non sovrapporsi alla barra statistiche/avanzamento esistente, in basso a sinistra.
export function drawLiveStatsBox(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, cur: PathPoint): void {
  const s = canvasW / 1280;
  const w = 280 * s;
  const h = 112 * s;
  const x = canvasW - w - 30 * s;
  const y = canvasH - h - 20 * s;
  const pad = 14 * s;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8 * s);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }

  ctx.fillStyle = '#fff';
  ctx.font = `600 ${13 * s}px system-ui`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lineH = h / 4;
  const speedLabel = cur.speedKmh != null ? `Velocità: ${Math.round(cur.speedKmh)} km/h` : 'Velocità: n/d';
  const lat = formatDMS(cur.lat, 'N', 'S');
  const lon = formatDMS(cur.lon, 'E', 'W');
  ctx.fillText(speedLabel, x + pad, y + lineH * 0.5);
  ctx.fillText(`Rotta: ${Math.round(cur.headingDeg)}° (${compassLabel(cur.headingDeg)})`, x + pad, y + lineH * 1.5);
  ctx.fillText(`Quota: ${Math.round(cur.ele)} m`, x + pad, y + lineH * 2.5);
  ctx.font = `600 ${11.5 * s}px system-ui`;
  ctx.fillText(`${lat}  ${lon}`, x + pad, y + lineH * 3.5);
  ctx.restore();
}
