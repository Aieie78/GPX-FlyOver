import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { useTimelineSelectionStore } from '../store/useTimelineSelectionStore';
import { getSessionEngine } from './flyoverSession';
import { isEditableTarget } from './domHelpers';

// Scorciatoie da tastiera dell'editor timeline: Spazio (play/pausa), frecce sinistra/destra
// (un fotogramma indietro/avanti), Delete/Backspace (rimuove il blocco musica/foto selezionato).
// Ignorate quando il focus è su un campo di testo. Spazio resta un toggle GLOBALE play/pausa
// (convenzione standard dei player video, es. YouTube/VLC) anche quando un bottone qualsiasi ha
// il focus — es. subito dopo aver premuto "2. Anteprima" — con preventDefault() che sopprime
// correttamente il "click" nativo che il browser attiverebbe altrimenti su quel bottone a fuoco
// (altrimenti Spazio riavviava l'anteprima da capo invece di metterla in pausa, se il pulsante
// che l'aveva avviata aveva ancora il focus).
export function useTimelineKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.code === 'Space') {
        if (isEditableTarget(e.target)) return;
        const engine = getSessionEngine();
        if (!engine?.isRunning) return;
        e.preventDefault();
        engine.setPlaying(!usePlaybackStore.getState().isPlaying);
        return;
      }

      if (isEditableTarget(e.target)) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const engine = getSessionEngine();
        if (!engine?.isRunning) return;
        e.preventDefault();
        engine.seekBy(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selection = useTimelineSelectionStore.getState().selection;
        if (!selection) return;
        e.preventDefault();
        if (selection.type === 'music') useProjectStore.getState().removeMusicTrack(selection.id);
        else if (selection.type === 'photo') useProjectStore.getState().removePhotoClip(selection.id);
        else useProjectStore.getState().removeTextOverlay(selection.id);
        useTimelineSelectionStore.getState().clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
