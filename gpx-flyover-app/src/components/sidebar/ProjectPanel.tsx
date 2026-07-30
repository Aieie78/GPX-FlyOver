import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { deserializeProject, serializeProject } from '../../project/projectFile';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

// Salvataggio/caricamento progetto in JSON (prompt-refactoring.md, Fase 4 gruppo 4). Il Track GPX
// e i file audio non sono incorporati nel file — vanno sempre ricaricati/riaggiunti a mano dopo
// il caricamento, come già succede per il Track con l'undo/redo (vedi useProjectStore.ts).
export function ProjectPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);

  const handleSave = () => {
    const state = useProjectStore.getState();
    const fileData = serializeProject(state);
    const blob = new Blob([JSON.stringify(fileData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title || 'progetto'}.flyover.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const { data, skippedMusicNames } = await deserializeProject(json);
      useProjectStore.getState().loadProjectData(data);
      const musicNote = skippedMusicNames.length
        ? ` Brani musicali da riaggiungere manualmente (audio non incluso nel salvataggio): ${skippedMusicNames.join(', ')}.`
        : '';
      setStatusMessage(`Progetto caricato. Ricarica la traccia GPX dalla sezione "Sorgente GPX".${musicNote}`);
    } catch (err) {
      console.error('Errore caricamento progetto', err);
      setStatusMessage(err instanceof Error ? `Impossibile caricare il progetto: ${err.message}` : 'Impossibile caricare il progetto.');
    }
  };

  return (
    <>
      <button type="button" className="action-btn" onClick={handleSave}>
        <Download size={14} /> Salva progetto (.json)
      </button>
      <button type="button" className="action-btn" onClick={handleLoadClick}>
        <Upload size={14} /> Carica progetto (.json)
      </button>
      <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileChange} />
      <p className="field-hint">
        Il salvataggio non include la traccia GPX né i file audio: dopo il caricamento vanno ricaricati/riaggiunti a
        mano.
      </p>
    </>
  );
}
