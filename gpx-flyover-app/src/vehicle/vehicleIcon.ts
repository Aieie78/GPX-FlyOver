import type { Map as MapLibreMap } from 'maplibre-gl';
import { altitudeOffsetPx } from '../camera/camera';
import type { VehicleParams } from '../types/domain';

export interface VehicleScreenPos {
  x: number;
  y: number;
  groundX: number;
  groundY: number;
}

// Disegna l'icona del mezzo su un canvas 2D qualsiasi (usata sia per l'anteprima live
// che per il video registrato), in un punto schermo già calcolato.
// Port 1:1 da gpx-flyover.html:524.
export function drawVehicleIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  vehicle: VehicleParams,
): void {
  const { icon: emoji, color, iconStyle: style, size: sizeFactor } = vehicle;
  const r = 16 * scale * sizeFactor;
  ctx.save();

  if (style === 'dot') {
    // solo un punto colorato, nessun simbolo
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'outline') {
    // solo il simbolo, nessun cerchio
    ctx.font = `${22 * scale * sizeFactor}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4 * scale;
    ctx.fillStyle = color;
    ctx.fillText(emoji, x, y);
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  {
    // cerchio pieno (default)
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.stroke();
  }

  ctx.font = `${20 * scale * sizeFactor}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(emoji, x, y + 1 * scale);
  ctx.restore();
}

// Calcola posizione (x,y in pixel CSS relativi al div mappa) e altezza-sopra-suolo per un punto del percorso.
// Port 1:1 da gpx-flyover.html:575.
export function vehicleScreenPos(
  map: MapLibreMap,
  cur: { lat: number; lon: number; ele: number },
  zoom: number,
  pitch: number,
  minEle: number,
  vehicle: Pick<VehicleParams, 'use3DAltitude' | 'altExaggeration'>,
): VehicleScreenPos {
  const groundPx = map.project([cur.lon, cur.lat]);
  const altAboveGround = vehicle.use3DAltitude ? Math.max(0, cur.ele - minEle) * vehicle.altExaggeration : 0;
  const offset = altitudeOffsetPx(altAboveGround, cur.lat, zoom, pitch);
  return { x: groundPx.x, y: groundPx.y - offset, groundX: groundPx.x, groundY: groundPx.y };
}

// Disegna una linea tratteggiata sfumata dal terreno fino all'icona (mostra la quota attuale
// senza lasciare tracce: viene ridisegnata da zero ogni fotogramma, quindi non si accumula).
// Port 1:1 da gpx-flyover.html:586.
export function drawAltitudeLine(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  ix: number,
  iy: number,
  color: string,
  scale: number,
): void {
  const dist = Math.hypot(gx - ix, gy - iy);
  if (dist < 3) return; // icona già a terra, nulla da mostrare

  ctx.save();
  const grad = ctx.createLinearGradient(ix, iy, gx, gy);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)'); // sfuma verso il terreno
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2 * scale;
  ctx.setLineDash([5 * scale, 5 * scale]);
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(gx, gy);
  ctx.stroke();
  ctx.setLineDash([]);

  // puntino "ombra" a terra
  ctx.beginPath();
  ctx.arc(gx, gy, 4 * scale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}
