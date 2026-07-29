/** Aggancia un valore al candidato più vicino entro una soglia (calamita/snap). TODO(fase 2): port da gpx-flyover.html:669 */
export function snapValue(_value: number, _candidates: number[], _thresholdSec: number): number {
  throw new Error('snapValue: not implemented — port from gpx-flyover.html:669');
}

/** Converte il tempo video nel tempo lungo il percorso, tenendo conto del congelamento durante le foto. TODO(fase 2): port da gpx-flyover.html:614 */
export function videoTimeToPathTime(_videoTimeSec: number): number {
  throw new Error('videoTimeToPathTime: not implemented — port from gpx-flyover.html:614');
}

/** Indice del punto del percorso per il tempo video/frame dato. TODO(fase 2): port da gpx-flyover.html:629 */
export function computePathIndex(_videoTimeSec: number, _totalFrames: number, _fps: number): number {
  throw new Error('computePathIndex: not implemented — port from gpx-flyover.html:629');
}
