import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { useTimelineSelectionStore } from '../store/useTimelineSelectionStore';
import { getSessionEngine } from './flyoverSession';
import { isEditableOrButtonTarget, isEditableTarget } from './domHelpers';

// Scorciatoie da tastiera dell'editor timeline: Spazio (play/pausa), frecce sinistra/destra
// (un fotogramma indietro/avanti), Delete/Backspace (rimuove il blocco musica/foto selezionato).
// Ignorate quando il focus è su un campo di testo (e, per Spazio, anche su un bottone — altrimenti
// attiverebbe pure il click nativo del bottone a fuoco).
export function useTimelineKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.code === 'Space') {
        if (isEditableOrButtonTarget(e.target)) return;
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
