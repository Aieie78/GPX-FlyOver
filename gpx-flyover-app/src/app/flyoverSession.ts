import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PreviewEngine } from '../preview/PreviewEngine';

// L'app ha sempre una sola mappa/anteprima/canvas di registrazione attivi (come i globali
// map/preview/recCanvas dell'originale) — un registry a livello di modulo evita di dover
// far passare queste istanze tramite Context per consumatori che sono comunque singleton.
interface FlyoverSession {
  map: MapLibreMap | null;
  engine: PreviewEngine | null;
  recCanvas: HTMLCanvasElement | null;
}

const session: FlyoverSession = { map: null, engine: null, recCanvas: null };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function setSessionMap(map: MapLibreMap | null): void {
  session.map = map;
  notify();
}
export function getSessionMap(): MapLibreMap | null {
  return session.map;
}

export function setSessionEngine(engine: PreviewEngine | null): void {
  session.engine = engine;
  notify();
}
export function getSessionEngine(): PreviewEngine | null {
  return session.engine;
}

export function setSessionRecCanvas(canvas: HTMLCanvasElement | null): void {
  session.recCanvas = canvas;
}
export function getSessionRecCanvas(): HTMLCanvasElement | null {
  return session.recCanvas;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
