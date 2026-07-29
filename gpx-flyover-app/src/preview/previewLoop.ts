/** Avvia l'anteprima interattiva (rAF loop). TODO(fase 2): port da gpx-flyover.html:1227 */
export function startPreview(): void {
  throw new Error('startPreview: not implemented — port from gpx-flyover.html:1227');
}

export function stopPreview(): void {
  throw new Error('stopPreview: not implemented — port from gpx-flyover.html:1241');
}

/** Disegna il frame i dell'anteprima (mappa + overlay). TODO(fase 2): port da gpx-flyover.html:1249 */
export function renderPreviewFrame(_i: number): void {
  throw new Error('renderPreviewFrame: not implemented — port from gpx-flyover.html:1249');
}

/** requestAnimationFrame loop, avanza in base a velocità x0.5/x1/x1.5/x2. TODO(fase 2): port da gpx-flyover.html:1281 */
export function previewLoop(_ts: number): void {
  throw new Error('previewLoop: not implemented — port from gpx-flyover.html:1281');
}

export function seekPreviewTo(_idx: number): void {
  throw new Error('seekPreviewTo: not implemented — port from gpx-flyover.html:1310');
}
