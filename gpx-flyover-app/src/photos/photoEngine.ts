import type { PhotoClip } from '../types/domain';

/** Carica un file immagine come HTMLImageElement. TODO(fase 2): port da gpx-flyover.html:1050 */
export function loadImage(_file: File): Promise<HTMLImageElement> {
  throw new Error('loadImage: not implemented — port from gpx-flyover.html:1050');
}

/** Foto attiva (se presente) al tempo video dato — il volo si congela per tutta la sua durata. TODO(fase 2): port da gpx-flyover.html:1192 */
export function getActivePhoto(_clips: PhotoClip[], _timeSec: number): PhotoClip | null {
  throw new Error('getActivePhoto: not implemented — port from gpx-flyover.html:1192');
}

/** Disegna la foto a schermo intero stile "cover" con dissolvenza. TODO(fase 2): port da gpx-flyover.html:1207 */
export function drawPhotoCover(_ctx: CanvasRenderingContext2D, _img: HTMLImageElement, _w: number, _h: number, _alpha: number): void {
  throw new Error('drawPhotoCover: not implemented — port from gpx-flyover.html:1207');
}
