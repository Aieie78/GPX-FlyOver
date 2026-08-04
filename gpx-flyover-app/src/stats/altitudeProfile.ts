import type { Track } from '../types/domain';

export interface ProfileBackground {
  canvas: HTMLCanvasElement;
  pw: number;
  ph: number;
  eleMin: number;
  eleRange: number;
}

// Pre-disegna la sagoma statica del profilo altimetrico (sfondo sfumato + linea, 250 punti) UNA
// sola volta per sessione (registrazione, o anteprima finché non cambiano traccia/dimensione
// canvas — vedi PreviewEngine), invece di ricostruirla ad ogni fotogramma — l'unica parte che
// cambia frame per frame è il pallino di avanzamento, disegnato da drawAltitudeProfile qui sotto
// sopra l'immagine già pronta.
export function buildProfileBackground(track: Track, s: number): ProfileBackground {
  const pw = 420 * s;
  const ph = 90 * s;
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d')!;
  const profile = track.profile;
  const eleMin = Math.min(...profile);
  const eleMax = Math.max(...profile);
  const eleRange = Math.max(1, eleMax - eleMin);

  ctx.beginPath();
  ctx.moveTo(0, ph);
  profile.forEach((e, i) => {
    const x = (i / (profile.length - 1)) * pw;
    const y = ph - ((e - eleMin) / eleRange) * ph * 0.85;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pw, ph);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, ph);
  grad.addColorStop(0, 'rgba(255,204,0,0.55)');
  grad.addColorStop(1, 'rgba(255,204,0,0.08)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  profile.forEach((e, i) => {
    const x = (i / (profile.length - 1)) * pw;
    const y = ph - ((e - eleMin) / eleRange) * ph * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  return { canvas, pw, ph, eleMin, eleRange };
}

// Disegna lo sfondo del profilo già pronto (buildProfileBackground) più il pallino di posizione
// attuale (progress 0..1 lungo il percorso) in alto a destra del fotogramma — unica parte
// ridisegnata ad ogni fotogramma. Condivisa da drawOverlayFrame (videoExport.ts, video esportato)
// e da PreviewEngine.drawOverlay (anteprima interattiva): stessa identica logica in entrambi, così
// quello che si vede in anteprima corrisponde esattamente al video finale.
export function drawAltitudeProfile(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  track: Track,
  profileBg: ProfileBackground,
  progress: number,
): void {
  const s = canvasW / 1280;
  const { canvas: profileCanvas, pw, ph, eleMin, eleRange } = profileBg;
  const px = canvasW - pw - 40 * s;
  const py = 20 * s;
  ctx.drawImage(profileCanvas, px, py);

  const profile = track.profile;
  const markerX = px + progress * pw;
  const markerIdx = Math.min(profile.length - 1, Math.round(progress * (profile.length - 1)));
  const markerY = py + ph - ((profile[markerIdx] - eleMin) / eleRange) * ph * 0.85;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(markerX, markerY, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  ctx.restore();
}
