import type { CameraParams } from '../types/domain';

export interface CameraPreset {
  name: string;
  params: CameraParams;
}

// Combinazioni pronte di pitch/zoom/ampiezza-periodo di rotazione, per partire da un'inquadratura
// sensata senza dover tarare i quattro parametri a mano. I valori restano scelte di gusto, non
// derivati da alcun calcolo — pensati per coprire stili diversi (dall'alto, ravvicinato, ampio).
export const CAMERA_PRESETS: CameraPreset[] = [
  { name: 'Cinematico (default)', params: { pitch: 66, zoom: 12.5, orbitAmp: 25, orbitPeriod: 14 } },
  { name: 'Dall’alto', params: { pitch: 40, zoom: 13.5, orbitAmp: 10, orbitPeriod: 22 } },
  { name: 'Inseguimento ravvicinato', params: { pitch: 72, zoom: 15.5, orbitAmp: 12, orbitPeriod: 9 } },
  { name: 'Panoramica ampia', params: { pitch: 55, zoom: 10.5, orbitAmp: 40, orbitPeriod: 18 } },
  { name: 'Statico (nessuna rotazione)', params: { pitch: 60, zoom: 13, orbitAmp: 0, orbitPeriod: 14 } },
];
