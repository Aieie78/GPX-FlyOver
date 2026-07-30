import type { PathPoint } from '../types/domain';

// Riquadro in basso a destra con velocità/quota/posizione geografica in tempo reale, disegnato
// sia in anteprima (PreviewEngine.ts) sia nel video esportato (drawOverlayFrame, videoExport.ts)
// — attivabile dalla checkbox "Dati in tempo reale" nel pannello Mezzo. Posizionato a destra per
// non sovrapporsi alla barra statistiche/avanzamento esistente, in basso a sinistra.
export function drawLiveStatsBox(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, cur: PathPoint): void {
  const s = canvasW / 1280;
  const w = 260 * s;
  const h = 84 * s;
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
  const lineH = h / 3;
  const speedLabel = cur.speedKmh != null ? `Velocità: ${Math.round(cur.speedKmh)} km/h` : 'Velocità: n/d';
  ctx.fillText(speedLabel, x + pad, y + lineH * 0.5);
  ctx.fillText(`Quota: ${Math.round(cur.ele)} m`, x + pad, y + lineH * 1.5);
  ctx.fillText(`Pos: ${cur.lat.toFixed(4)}, ${cur.lon.toFixed(4)}`, x + pad, y + lineH * 2.5);
  ctx.restore();
}
