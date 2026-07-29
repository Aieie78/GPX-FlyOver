import type { PhotoClip } from '../types/domain';

// Port 1:1 da gpx-flyover.html:1050.
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

let photoIdSeq = 0;
export function nextPhotoId(): number {
  return photoIdSeq++;
}

// Carica un'immagine e calcola la posizione di attacco predefinita (in coda alle foto esistenti).
// Port della logica in gpx-flyover.html:1059-1073.
export async function buildPhotoClipAppended(
  file: File,
  existingClips: PhotoClip[],
  defaultDuration: number,
): Promise<PhotoClip> {
  const img = await loadImage(file);
  const videoStart = existingClips.reduce((max, p) => Math.max(max, p.videoStart + p.duration), 0);
  return { id: nextPhotoId(), name: file.name, img, videoStart, duration: defaultDuration };
}

// Carica un'immagine e la posiziona esattamente al punto di riproduzione attuale (pulsante "+"
// nella corsia). Port della logica in gpx-flyover.html:1079-1095.
export async function buildPhotoClipAtPlayhead(
  file: File,
  defaultDuration: number,
  totalDurationSec: number,
  playheadSec: number,
): Promise<PhotoClip> {
  const img = await loadImage(file);
  const videoStart = Math.max(0, Math.min(totalDurationSec - defaultDuration, playheadSec));
  return { id: nextPhotoId(), name: file.name, img, videoStart, duration: defaultDuration };
}

export interface ActivePhoto {
  photo: PhotoClip;
  alpha: number;
}

// Trova la foto attiva nel punto timeSec (con una breve dissolvenza in entrata/uscita).
// Port 1:1 da gpx-flyover.html:1192.
export function getActivePhoto(photoClips: PhotoClip[], timeSec: number): ActivePhoto | null {
  for (const p of photoClips) {
    if (timeSec >= p.videoStart && timeSec < p.videoStart + p.duration) {
      const t = timeSec - p.videoStart;
      const fade = Math.min(0.4, p.duration / 2);
      let alpha = 1;
      if (t < fade) alpha = t / fade;
      else if (p.duration - t < fade) alpha = (p.duration - t) / fade;
      return { photo: p, alpha: Math.max(0, Math.min(1, alpha)) };
    }
  }
  return null;
}

// Disegna una foto a piena copertura (stile "cover", senza deformarla) su un canvas qualsiasi.
// Port 1:1 da gpx-flyover.html:1207.
export function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  alpha: number,
): void {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}
