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

export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Calcola il riquadro (in coordinate px del canvas, centro in xFrac/yFrac come frazione 0..1
// della larghezza/altezza) di una sovrapposizione testuale — condiviso da drawTextOverlay (per
// disegnare lo sfondo) e dalla maniglia HTML trascinabile nell'anteprima (TextOverlayHandle.tsx),
// così restano sempre coerenti: la maniglia copre esattamente lo stesso riquadro che si vede.
export function computeTextBox(
  measureCtx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  text: string,
  xFrac: number,
  yFrac: number,
): TextBox {
  const s = canvasW / 1280;
  const fontSize = 30 * s;
  measureCtx.font = `bold ${fontSize}px system-ui`;
  const metrics = measureCtx.measureText(text || ' ');
  const paddingX = 20 * s;
  const paddingY = 12 * s;
  const w = metrics.width + paddingX * 2;
  const h = fontSize + paddingY * 2;
  return { x: xFrac * canvasW - w / 2, y: yFrac * canvasH - h / 2, w, h };
}

// Disegna una sovrapposizione testuale in stile "didascalia" (barra semi-trasparente dietro al
// testo per leggibilità sopra qualunque sfondo), centrata su (xFrac, yFrac) — posizione
// personalizzabile trascinando la maniglia nell'anteprima (TextOverlayHandle.tsx), di default nel
// terzo inferiore del fotogramma, sopra la barra statistiche/avanzamento (drawOverlayFrame).
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  text: string,
  alpha: number,
  xFrac: number,
  yFrac: number,
): void {
  if (!text.trim() || alpha <= 0) return;
  const s = canvasW / 1280;
  const fontSize = 30 * s;
  const box = computeTextBox(ctx, canvasW, canvasH, text, xFrac, yFrac);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(box.x, box.y, box.w, box.h);

  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6 * s;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}
