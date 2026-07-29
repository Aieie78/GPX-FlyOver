import { setMusicGainVolume } from '../audio/musicEngine';
import { useProjectStore } from '../store/useProjectStore';
import { getSessionEngine } from './flyoverSession';

// Aggiornamento live dei parametri durante l'anteprima aperta, come i due blocchi
// addEventListener('input', ...) di gpx-flyover.html:1401-1409: pitch/zoom/orbit/durata/fps
// ricostruiscono l'AnimParams mantenendo la posizione; icona/colore/stile/dimensione/quota
// ridisegnano solo il frame corrente; il volume musica aggiorna il gain node condiviso.
export function startLiveParamsSync(): () => void {
  return useProjectStore.subscribe((state, prev) => {
    if (state.camera !== prev.camera || state.video !== prev.video) {
      getSessionEngine()?.onParamsChanged();
    }
    if (state.vehicle !== prev.vehicle) {
      getSessionEngine()?.rerenderCurrentFrame();
    }
    if (state.musicVolume !== prev.musicVolume) {
      setMusicGainVolume(state.musicVolume);
    }
  });
}
