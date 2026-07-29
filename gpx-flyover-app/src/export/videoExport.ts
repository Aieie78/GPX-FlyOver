import type { Track } from '../types/domain';

/**
 * Overlay del frame esportato: titolo, profilo altimetrico, statistiche, barra di
 * avanzamento, icona mezzo, linea di quota. TODO(fase 2): port da gpx-flyover.html:1411
 */
export function drawOverlayFrame(_ctx: CanvasRenderingContext2D, _track: Track, _args: {
  title: string;
  cur: { dist: number; ele: number };
  progress: number;
  zoom: number;
  pitch: number;
  timeSec: number;
}): void {
  throw new Error('drawOverlayFrame: not implemented — port from gpx-flyover.html:1411');
}

/**
 * Rendering di esportazione deterministico frame-by-frame (nuova funzionalità prioritaria #1
 * da prompt-refactoring.md): non deve dipendere dal refresh dello schermo, sostituisce la
 * registrazione in tempo reale via MediaRecorder legata al preview loop.
 * TODO(fase 2/3): progettare dopo aver migrato preview + overlay 1:1.
 */
export function renderVideoExport(
  _track: Track,
  _onProgress: (fraction: number) => void,
): Promise<Blob> {
  throw new Error('renderVideoExport: not implemented — new deterministic exporter, see prompt-refactoring.md priority 1');
}
