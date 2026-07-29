import type { MusicTrack } from '../types/domain';

/** Crea/riusa l'AudioContext condiviso. TODO(fase 2): port da gpx-flyover.html:828 */
export function ensureAudioCtx(): AudioContext {
  throw new Error('ensureAudioCtx: not implemented — port from gpx-flyover.html:828');
}

/** Formatta secondi come "m:ss". TODO(fase 2): port da gpx-flyover.html:862 */
export function fmtMinSec(_sec: number): string {
  throw new Error('fmtMinSec: not implemented — port from gpx-flyover.html:862');
}

/** Brani attivi (e relativo offset) al tempo video dato, gestendo sovrapposizioni/mix. TODO(fase 2): port da gpx-flyover.html:965 */
export function computeActiveTracksAt(_tracks: MusicTrack[], _timeSec: number): Array<{ track: MusicTrack; offsetSec: number }> {
  throw new Error('computeActiveTracksAt: not implemented — port from gpx-flyover.html:965');
}

/**
 * La musica avanza SEMPRE a velocità reale (x1) indipendentemente dalla velocità video,
 * si riallinea sui salti/seek ma non accelera mai. TODO(fase 2): port da gpx-flyover.html:993-1020
 */
export function resetMusicAnchor(_videoTimeSec: number): void {
  throw new Error('resetMusicAnchor: not implemented — port from gpx-flyover.html:993');
}

export function getMusicVirtualTime(): number {
  throw new Error('getMusicVirtualTime: not implemented — port from gpx-flyover.html:998');
}

export function syncMusicPreview(_playing: boolean): void {
  throw new Error('syncMusicPreview: not implemented — port from gpx-flyover.html:1003');
}

export function stopMusicPreview(): void {
  throw new Error('stopMusicPreview: not implemented — port from gpx-flyover.html:981');
}
