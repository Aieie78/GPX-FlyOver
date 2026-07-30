import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';

// Scorciatoie globali Ctrl+Z (undo) / Ctrl+Y o Ctrl+Shift+Z (redo) sullo store di progetto
// (musica, foto, parametri camera/video/mezzo — non il Track, escluso da partialize).
// Ignorate quando il focus è su un campo di testo/numero/select, per non rubare l'undo nativo
// del browser mentre l'utente sta scrivendo (es. nel campo Titolo).
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useUndoRedoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const temporal = useProjectStore.temporal.getState();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        temporal.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        temporal.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
