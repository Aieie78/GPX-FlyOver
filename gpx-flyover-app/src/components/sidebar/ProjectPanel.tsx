import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { CheckCircle2, Circle, Download, Upload } from 'lucide-react';
import { deserializeProject, serializeProject } from '../../project/projectFile';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

// Salvataggio/caricamento progetto in JSON (prompt-refactoring.md, Fase 4 gruppo 4). Il Track GPX
// e i file audio non sono incorporati nel file (potrebbero pesare decine/centinaia di MB) — dopo
// il caricamento del progetto, ricaricare un file con lo STESSO NOME di uno atteso lo riaggancia
// automaticamente (posizione/taglio/veicolo/esclusioni bandierina inclusi, vedi
// usePlaybackStore.expectedTracksMeta/expectedMusicMeta, consumati da Sidebar.tsx e
// MusicPhotosPanel.tsx) — un nome diverso viene semplicemente aggiunto come nuovo blocco, come
// oggi. Le foto (incorporate come dataURL) e il testo (nessun file) sono già ripristinati subito,
// senza bisogno di ricaricare nulla.
export function ProjectPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);
  const expectedTracksMeta = usePlaybackStore((s) => s.expectedTracksMeta);
  const expectedMusicMeta = usePlaybackStore((s) => s.expectedMusicMeta);
  const setExpectedMeta = usePlaybackStore((s) => s.setExpectedMeta);
  const tracks = useProjectStore((s) => s.tracks);
  const musicTracks = useProjectStore((s) => s.musicTracks);

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
      const { data, tracksMeta, musicMeta } = await deserializeProject(json);
      useProjectStore.getState().loadProjectData(data);
      setExpectedMeta(tracksMeta, musicMeta);
      const notes: string[] = [];
      if (tracksMeta.length) notes.push(`${tracksMeta.length} traccia/e GPX`);
      if (musicMeta.length) notes.push(`${musicMeta.length} brano/i musicale/i`);
      const note = notes.length
        ? ` Ricarica gli stessi file (stesso nome) per ${notes.join(' e ')}: si riagganciano automaticamente alla posizione/impostazioni salvate — vedi il riepilogo qui sotto.`
        : '';
      setStatusMessage(`Progetto caricato.${note}`);
    } catch (err) {
      console.error('Errore caricamento progetto', err);
      setStatusMessage(err instanceof Error ? `Impossibile caricare il progetto: ${err.message}` : 'Impossibile caricare il progetto.');
    }
  };

  const trackStatus = expectedTracksMeta.map((t) => ({
    label: `${t.fileName || '(nome non salvato)'}${t.isPrimary ? ' [principale]' : ''}`,
    matched: tracks.some((loaded) => loaded.fileName === t.fileName),
  }));
  const musicStatus = expectedMusicMeta.map((m) => ({
    label: m.name,
    matched: musicTracks.some((loaded) => loaded.name === m.name),
  }));

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
        Il salvataggio non include la traccia GPX né i file audio: dopo il caricamento del progetto, ricaricare un
        file con lo stesso nome lo riaggancia automaticamente. Foto e testo sono già ripristinati subito (nessuna
        azione necessaria).
      </p>
      {(trackStatus.length > 0 || musicStatus.length > 0) && (
        <div className="reattach-summary">
          <p className="reattach-summary__title">Riepilogo riaggancio file</p>
          {trackStatus.map((t) => (
            <p key={`track-${t.label}`} className={`reattach-summary__row${t.matched ? ' reattach-summary__row--ok' : ''}`}>
              {t.matched ? <CheckCircle2 size={12} /> : <Circle size={12} />} {t.label}
            </p>
          ))}
          {musicStatus.map((m) => (
            <p key={`music-${m.label}`} className={`reattach-summary__row${m.matched ? ' reattach-summary__row--ok' : ''}`}>
              {m.matched ? <CheckCircle2 size={12} /> : <Circle size={12} />} {m.label}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
