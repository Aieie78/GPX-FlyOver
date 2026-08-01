const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const LINES = 6; // nome traccia + velocità/rotta/quota/ora/posizione

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

// Accorcia il testo con "…" se supera maxWidth — serve per il nome file in intestazione, che può
// essere più lungo dello spazio disponibile nel riquadro.
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '…';
}

// Dati minimi richiesti dal riquadro — sia un PathPoint della principale (frame ricampionato) sia
// un TimedPoint di una secondaria (Fase 5.3, geo.ts) li soddisfano entrambi senza cast.
export interface LiveStatsPoint {
  lat: number;
  lon: number;
  ele: number;
  speedKmh: number | null;
  headingDeg: number;
  clockTimeMs: number | null;
}

export interface LiveStatsBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Dimensioni/posizione del riquadro in pixel del canvas, dato centro frazionario (xFrac/yFrac,
// come TextOverlay.x/y) e fattore di scala utente — condivisa da drawLiveStatsBox (disegno) e
// LiveStatsBoxHandle.tsx (maniglia trascinabile), così restano sempre allineati.
export function computeLiveStatsBox(canvasW: number, canvasH: number, xFrac: number, yFrac: number, scale: number): LiveStatsBox {
  const s = (canvasW / 1280) * scale;
  const w = 150 * s;
  const h = 13 * LINES * s;
  return { x: xFrac * canvasW - w / 2, y: yFrac * canvasH - h / 2, w, h };
}

// Riquadro con nome traccia (intestazione, colorata come l'icona/percorso di quella traccia —
// così con più riquadri si riconosce subito a chi appartiene ciascuno, Fase 5.3-bis) più
// velocità/rotta/quota/ora/posizione (DMS) in tempo reale. Disegnato sia in anteprima
// (PreviewEngine.ts) sia nel video esportato (drawOverlayFrame, videoExport.ts) — uno per ogni
// traccia con la checkbox "Dati in tempo reale" attiva, posizionabile e ridimensionabile
// individualmente (xFrac/yFrac/scale, vedi computeLiveStatsBox).
export function drawLiveStatsBox(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  cur: LiveStatsPoint,
  label: string,
  accentColor: string,
  xFrac: number,
  yFrac: number,
  scale: number,
): void {
  const s = (canvasW / 1280) * scale;
  const { x, y, w, h } = computeLiveStatsBox(canvasW, canvasH, xFrac, yFrac, scale);
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

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const lineH = h / LINES;
  const textX = x + w - pad;

  ctx.font = `700 ${9.5 * s}px system-ui`;
  ctx.fillStyle = accentColor;
  ctx.fillText(truncateToWidth(ctx, label.replace(/\.gpx$/i, ''), w - pad * 2), textX, y + lineH * 0.5);

  ctx.fillStyle = '#fff';
  const speedLabel = cur.speedKmh != null ? `Velocità: ${Math.round(cur.speedKmh)} km/h` : 'Velocità: n/d';
  const timeLabel = cur.clockTimeMs != null ? `Ora GMT: ${formatClockTime(cur.clockTimeMs)}` : 'Ora GMT: n/d';
  const lat = formatDMS(cur.lat, 'N', 'S');
  const lon = formatDMS(cur.lon, 'E', 'W');

  ctx.font = `600 ${9.5 * s}px system-ui`;
  ctx.fillText(speedLabel, textX, y + lineH * 1.5);
  ctx.fillText(`Rotta: ${Math.round(cur.headingDeg)}° (${compassLabel(cur.headingDeg)})`, textX, y + lineH * 2.5);
  ctx.fillText(`Quota: ${Math.round(cur.ele)} m`, textX, y + lineH * 3.5);
  ctx.fillText(timeLabel, textX, y + lineH * 4.5);
  ctx.font = `600 ${8 * s}px system-ui`;
  ctx.fillText(`${lat}  ${lon}`, textX, y + lineH * 5.5);
  ctx.restore();
}
