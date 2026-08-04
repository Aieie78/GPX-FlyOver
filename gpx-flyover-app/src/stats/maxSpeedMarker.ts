import type { Map as MapLibreMap } from 'maplibre-gl';
import { altitudeOffsetPx } from '../camera/camera';
import type { MaxSpeedMarkerParams, MaxSpeedPoint } from '../types/domain';

// Colore coerente con l'accento giallo già usato per percorso/profilo/barra avanzamento
// (vedi #ffcc00 in videoExport.ts).
const PIN_COLOR = '#ffcc00';
const PIN_ICON = '⚡';

// Posizione schermo (pixel CSS relativi al div mappa) della punta del pin, con l'eventuale
// sollevamento ottico in quota reale — stesso meccanismo di vehicleScreenPos (vehicleIcon.ts):
// altAboveGround = (quota del punto - quota minima traccia) * esagerazione, convertito in offset
// verticale in pixel da altitudeOffsetPx. Chi chiama applica poi l'eventuale scaleX/scaleY per la
// risoluzione di registrazione, come per l'icona del mezzo.
export function maxSpeedMarkerScreenPos(
  map: MapLibreMap,
  point: MaxSpeedPoint,
  zoom: number,
  pitch: number,
  minEle: number,
  marker: Pick<MaxSpeedMarkerParams, 'use3DAltitude' | 'altExaggeration'>,
): { x: number; y: number } {
  const groundPx = map.project([point.lon, point.lat]);
  const altAboveGround = marker.use3DAltitude ? Math.max(0, point.ele - minEle) * marker.altExaggeration : 0;
  const offset = altitudeOffsetPx(altAboveGround, point.lat, zoom, pitch);
  return { x: groundPx.x, y: groundPx.y - offset };
}

// Disegna il pin "Velocità max" a forma di goccia (stile Relive: punta verso il basso sul punto
// esatto, cerchio bianco con icona nella parte superiore) più l'etichetta testuale sempre
// visibile. (x, y) è la posizione schermo GIÀ proiettata/scalata della punta del pin (stesso
// pattern di drawVehicleIcon/vehicleScreenPos: chi chiama fa maxSpeedMarkerScreenPos + l'eventuale
// scaleX/scaleY per la risoluzione di registrazione, qui si disegna soltanto). sizeScale è il
// fattore utente (pannello Mezzo, "Dimensione bandierina") applicato a tutta la geometria del pin
// e dell'etichetta — non alla posizione, che resta il punto geografico esatto. Condivisa da
// PreviewEngine.drawOverlay e drawOverlayFrame (videoExport.ts) — stesso identico disegno in
// anteprima e nel video esportato.
export function drawMaxSpeedMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  canvasW: number,
  point: MaxSpeedPoint,
  sizeScale = 1,
): void {
  const s = (canvasW / 1280) * sizeScale;
  const tipX = x;
  const tipY = y;

  // geometria della goccia: cerchio (bulbo) di raggio r, punta a distanza d dal centro del
  // cerchio, unita al cerchio da due segmenti tangenti (calcolati esattamente, non approssimati)
  // così la forma resta pulita a qualunque scala.
  const r = 13 * s;
  const d = r * 1.9;
  const cx = tipX;
  const cy = tipY - d;

  const angleToTip = Math.PI / 2; // "in giù" in coordinate canvas (y crescente verso il basso)
  const halfAngle = Math.PI / 2 - Math.asin(Math.min(0.999, r / d));
  const angle1 = angleToTip - halfAngle;
  const angle2 = angleToTip + halfAngle;
  const p1 = { x: cx + r * Math.cos(angle1), y: cy + r * Math.sin(angle1) };
  const p2 = { x: cx + r * Math.cos(angle2), y: cy + r * Math.sin(angle2) };

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4 * s;
  ctx.shadowOffsetY = 1 * s;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(p1.x, p1.y);
  ctx.arc(cx, cy, r, angle1, angle2, true); // arco lungo, passa per il "dorso" del bulbo
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.fillStyle = PIN_COLOR;
  ctx.fill();
  ctx.lineWidth = 1.5 * s;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.restore();

  // cerchio bianco con icona, nella parte superiore del pin
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.font = `${r * 0.85}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(PIN_ICON, cx, cy + 0.5 * s);
  ctx.restore();

  // etichetta "Velocità max: X km/h", sempre visibile — a destra del pin, o a sinistra se manca
  // spazio a destra (bordo del fotogramma).
  const label = `Velocità max: ${Math.round(point.speedKmh)} km/h`;
  const fontSize = 12 * s;
  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui`;
  const textW = ctx.measureText(label).width;
  const padX = 7 * s;
  const padY = 5 * s;
  const boxW = textW + padX * 2;
  const boxH = fontSize + padY * 2;
  const gap = 8 * s;
  const spaceRight = canvasW - (tipX + r + gap);
  const placeLeft = spaceRight < boxW;
  const boxX = placeLeft ? tipX - r - gap - boxW : tipX + r + gap;
  const boxY = cy - boxH / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4 * s);
    ctx.fill();
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, boxX + padX, boxY + boxH / 2);
  ctx.restore();
}
