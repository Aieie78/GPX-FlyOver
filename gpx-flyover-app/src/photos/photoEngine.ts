import type { PhotoClip, PhotoRotation } from '../types/domain';

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
  return { id: nextPhotoId(), name: file.name, img, videoStart, duration: defaultDuration, rotation: 0 };
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
  return { id: nextPhotoId(), name: file.name, img, videoStart, duration: defaultDuration, rotation: 0 };
}

export interface ActivePhoto {
  photo: PhotoClip;
  alpha: number;
}

const PHOTO_FADE_SEC = 0.4;
const ADJACENCY_TOLERANCE_SEC = 0.05;

// Restituisce gli strati di foto da disegnare (in ordine: il più vecchio per primo, sotto) nel
// punto timeSec. Ogni foto sfuma in entrata/uscita verso la mappa come nell'originale
// (gpx-flyover.html:1192) SOLO se non ha una foto adiacente/sovrapposta da quel lato — quando
// due foto sono adiacenti, la precedente resta opaca fino alla fine e la successiva "nasce" un
// po' prima del proprio inizio nominale, sfumando dentro la coda dell'altra: il risultato è una
// dissolvenza incrociata diretta tra le due foto, senza il fotogramma di mappa visibile in mezzo
// che si aveva sfumando entrambe indipendentemente verso la mappa.
export function getActivePhotoLayers(photoClips: PhotoClip[], timeSec: number): ActivePhoto[] {
  const sorted = [...photoClips].sort((a, b) => a.videoStart - b.videoStart);
  const layers: ActivePhoto[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const start = p.videoStart;
    const end = start + p.duration;
    const fade = Math.min(PHOTO_FADE_SEC, p.duration / 2);

    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const prevAdjacent = !!prev && prev.videoStart + prev.duration >= start - ADJACENCY_TOLERANCE_SEC;
    const nextAdjacent = !!next && next.videoStart <= end + ADJACENCY_TOLERANCE_SEC;

    const effectiveStart = prevAdjacent ? start - fade : start;
    if (timeSec < effectiveStart || timeSec >= end) continue;

    let alpha = 1;
    if (timeSec < start) {
      // zona di dissolvenza incrociata "presa in prestito" dalla coda della foto precedente
      alpha = (timeSec - effectiveStart) / fade;
    } else if (!prevAdjacent && timeSec - start < fade) {
      alpha = (timeSec - start) / fade; // fade-in normale verso la mappa
    }
    if (!nextAdjacent && end - timeSec < fade) {
      alpha = Math.min(alpha, (end - timeSec) / fade); // fade-out normale verso la mappa
    }

    layers.push({ photo: p, alpha: Math.max(0, Math.min(1, alpha)) });
  }

  return layers;
}

// Disegna una foto a schermo intero in stile "contain" (mostra sempre l'intera foto, con
// bande nere dove il rapporto d'aspetto non combacia, senza deformarla), con un'eventuale
// rotazione a step di 90° per correggere l'orientamento. Deviazione deliberata dall'originale
// (che usava "cover", ritagliando l'eccesso — gpx-flyover.html:1207) su richiesta esplicita,
// per evitare che foto con rapporto d'aspetto molto diverso dal video appaiano troppo ritagliate.
export function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  alpha: number,
  rotation: PhotoRotation = 0,
): void {
  const rotRad = (rotation * Math.PI) / 180;
  const swapped = rotation === 90 || rotation === 270;
  const boundsW = swapped ? img.height : img.width;
  const boundsH = swapped ? img.width : img.height;
  const scale = Math.min(w / boundsW, h / boundsH);
  const dw = img.width * scale;
  const dh = img.height * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  if (rotRad !== 0) ctx.rotate(rotRad);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}
