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

// Solo l'ora (UTC, dal timestamp <time> originale del GPX) — mai la data.
function formatClockTime(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Riquadro in basso a destra con velocità/rotta/quota/ora/posizione (DMS) in tempo reale,
// disegnato sia in anteprima (PreviewEngine.ts) sia nel video esportato (drawOverlayFrame,
// videoExport.ts) — attivabile dalla checkbox "Dati in tempo reale" nel pannello Mezzo.
// Posizionato a destra per non sovrapporsi alla barra statistiche/avanzamento esistente, a
// sinistra. Compatto (5 righe, carattere piccolo) per restare leggibile senza occupare troppo
// spazio del fotogramma.
export function drawLiveStatsBox(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, cur: PathPoint): void {
  const s = canvasW / 1280;
  const w = 150 * s;
  const h = 65 * s;
  const x = canvasW - w - 24 * s;
  const y = canvasH - h - 18 * s;
  const pad = 8 * s;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5 * s);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const lineH = h / 5;
  const textX = x + w - pad;
  const speedLabel = cur.speedKmh != null ? `Velocità: ${Math.round(cur.speedKmh)} km/h` : 'Velocità: n/d';
  const timeLabel = cur.clockTimeMs != null ? `Ora GMT: ${formatClockTime(cur.clockTimeMs)}` : 'Ora GMT: n/d';
  const lat = formatDMS(cur.lat, 'N', 'S');
  const lon = formatDMS(cur.lon, 'E', 'W');

  ctx.font = `600 ${9.5 * s}px system-ui`;
  ctx.fillText(speedLabel, textX, y + lineH * 0.5);
  ctx.fillText(`Rotta: ${Math.round(cur.headingDeg)}° (${compassLabel(cur.headingDeg)})`, textX, y + lineH * 1.5);
  ctx.fillText(`Quota: ${Math.round(cur.ele)} m`, textX, y + lineH * 2.5);
  ctx.fillText(timeLabel, textX, y + lineH * 3.5);
  ctx.font = `600 ${8 * s}px system-ui`;
  ctx.fillText(`${lat}  ${lon}`, textX, y + lineH * 4.5);
  ctx.restore();
}
