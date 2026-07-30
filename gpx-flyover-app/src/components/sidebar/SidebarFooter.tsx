import { Redo2, Undo2 } from 'lucide-react';
import { useProjectStore, useProjectTemporalStore } from '../../store/useProjectStore';

// Piede fisso della sidebar, sempre visibile in fondo (fuori da .sidebar__sections, che scorre) —
// spostato qui dall'ActionsPanel su richiesta esplicita: in cima, tra i pulsanti 1/2/3, la
// posizione risultava confusa.
export function SidebarFooter() {
  const canUndo = useProjectTemporalStore((s) => s.pastStates.length > 0);
  const canRedo = useProjectTemporalStore((s) => s.futureStates.length > 0);
  const handleUndo = () => useProjectStore.temporal.getState().undo();
  const handleRedo = () => useProjectStore.temporal.getState().redo();

  return (
    <div className="sidebar-footer">
      <button
        type="button"
        className="sidebar-footer__btn"
        disabled={!canUndo}
        onClick={handleUndo}
        title="Annulla (Ctrl+Z)"
        aria-label="Annulla"
      >
        <Undo2 size={16} strokeWidth={2.75} />
      </button>
      <button
        type="button"
        className="sidebar-footer__btn"
        disabled={!canRedo}
        onClick={handleRedo}
        title="Ripeti (Ctrl+Y)"
        aria-label="Ripeti"
      >
        <Redo2 size={16} strokeWidth={2.75} />
      </button>
    </div>
  );
}
