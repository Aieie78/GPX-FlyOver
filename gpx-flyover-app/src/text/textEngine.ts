import type { TextOverlay } from '../types/domain';

let textIdSeq = 0;
export function nextTextId(): number {
  return textIdSeq++;
}

export interface ActiveText {
  overlay: TextOverlay;
  alpha: number;
}

const TEXT_FADE_SEC = 0.3;

// Restituisce le sovrapposizioni testuali attive nel punto timeSec, con una breve dissolvenza in
// entrata/uscita indipendente per ciascuna — a differenza delle foto (getActivePhotoLayers), qui
// non serve gestire una dissolvenza incrociata tra due sovrapposizioni adiacenti: uscire dal nulla
// (niente testo) non è un problema visivo come lo era il lampo di mappa tra due foto, quindi due
// testi che si sovrappongono nel tempo vengono semplicemente disegnati entrambi, impilati.
export function getActiveTextOverlays(overlays: TextOverlay[], timeSec: number): ActiveText[] {
  const active: ActiveText[] = [];
  for (const o of overlays) {
    const start = o.videoStart;
    const end = start + o.duration;
    if (timeSec < start || timeSec >= end) continue;
    const fade = Math.min(TEXT_FADE_SEC, o.duration / 2);
    let alpha = 1;
    if (timeSec - start < fade) alpha = (timeSec - start) / fade;
    if (end - timeSec < fade) alpha = Math.min(alpha, (end - timeSec) / fade);
    active.push({ overlay: o, alpha: Math.max(0, Math.min(1, alpha)) });
  }
  return active;
}

// Disegna una sovrapposizione testuale centrata orizzontalmente, in stile "didascalia" (barra
// semi-trasparente dietro al testo per leggibilità sopra qualunque sfondo), posizionata nel terzo
// inferiore del fotogramma — sopra la barra statistiche/avanzamento già disegnata da
// drawOverlayFrame (videoExport.ts), che occupa la fascia più bassa.
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  text: string,
  alpha: number,
): void {
  if (!text.trim() || alpha <= 0) return;
  const s = canvasW / 1280;
  const fontSize = 30 * s;
  const y = canvasH - 130 * s;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  const paddingX = 20 * s;
  const paddingY = 12 * s;
  const boxW = metrics.width + paddingX * 2;
  const boxH = fontSize + paddingY * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(canvasW / 2 - boxW / 2, y - boxH / 2, boxW, boxH);

  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6 * s;
  ctx.fillText(text, canvasW / 2, y);
  ctx.restore();
}
