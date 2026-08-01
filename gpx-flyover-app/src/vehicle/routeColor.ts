import type { VehicleTrack } from '../types/domain';

// Palette a rotazione per il colore percorso quando l'icona è "nessuna" — colori distinti tra
// loro e dal giallo fisso (#ffcc00) e dal ciano di default (#00e5ff), scelti per restare
// leggibili su sfondo satellitare.
export const ROUTE_COLOR_PALETTE = [
  '#ff3366',
  '#33ff99',
  '#cc66ff',
  '#ff9933',
  '#3399ff',
  '#ff66cc',
  '#99ff33',
  '#ffdd33',
];

// Colore effettivo con cui disegnare il percorso di una traccia (Fase 5.3 + icona "nessuna"):
// indipendente (routeColor) se l'icona è disattivata, altrimenti giallo fisso finché è l'unica
// traccia del progetto (comportamento storico invariato), altrimenti coordinato con l'icona.
export function effectiveRouteColor(t: VehicleTrack, tracksCount: number): string {
  if (t.vehicle.icon === 'none') return t.vehicle.routeColor || ROUTE_COLOR_PALETTE[0];
  if (t.isPrimary && tracksCount === 1) return '#ffcc00';
  return t.vehicle.color;
}

// Primo colore della palette non presente in usedColors — se tutti i colori sono già in uso,
// cicla la palette (repliche accettabili oltre il numero di colori disponibili).
export function pickRouteColor(usedColors: string[]): string {
  const free = ROUTE_COLOR_PALETTE.find((c) => !usedColors.includes(c));
  if (free) return free;
  return ROUTE_COLOR_PALETTE[usedColors.length % ROUTE_COLOR_PALETTE.length];
}
