import type { SegmentMode, Track } from '../types/domain';

/**
 * Parsa un file GPX in un Track normalizzato.
 * TODO(fase 2): portare 1:1 la logica da gpx-flyover.html:268-380
 * (gestione multi-segmento, decimazione oltre 40.000 punti, smoothing quota/posizione,
 * fallback quota su tag non standard, calcolo profilo altimetrico a 250 campioni).
 */
export function parseGpx(_xmlText: string, _segmentMode: SegmentMode): Track {
  throw new Error('parseGpx: not implemented — port from gpx-flyover.html:268');
}
