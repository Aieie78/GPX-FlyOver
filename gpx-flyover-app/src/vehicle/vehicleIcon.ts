import type { VehicleParams } from '../types/domain';

/** Disegna l'icona del mezzo sul canvas overlay. TODO(fase 2): port da gpx-flyover.html:524 */
export function drawVehicleIcon(
  _ctx: CanvasRenderingContext2D,
  _x: number,
  _y: number,
  _scale: number,
  _vehicle: VehicleParams,
): void {
  throw new Error('drawVehicleIcon: not implemented — port from gpx-flyover.html:524');
}

/** Posizione a schermo dell'icona (proietta lat/lon + eventuale offset quota). TODO(fase 2): port da gpx-flyover.html:575 */
export function vehicleScreenPos(
  _cur: { lat: number; lon: number; ele: number },
  _zoom: number,
  _pitch: number,
): { x: number; y: number } {
  throw new Error('vehicleScreenPos: not implemented — port from gpx-flyover.html:575');
}

/** Linea tratteggiata sfumata dal terreno all'icona + punto ombra. TODO(fase 2): port da gpx-flyover.html:586 */
export function drawAltitudeLine(
  _ctx: CanvasRenderingContext2D,
  _groundX: number,
  _groundY: number,
  _iconX: number,
  _iconY: number,
  _color: string,
  _scale: number,
): void {
  throw new Error('drawAltitudeLine: not implemented — port from gpx-flyover.html:586');
}
