# Prompt da riprendere — Import Video (Parte B / Fase 6)

## Come usarlo
Quando sei pronto a riprendere: apri Claude Code CLI nella cartella del progetto (`gpx-flyover-app`) e incolla questo intero documento come messaggio. Il piano sotto è già stato proposto da Claude Code stesso in una sessione precedente e discusso/validato insieme — non serve rifarlo generare da capo, basta dargli il via.

## Stato del progetto a questo punto

Completato e verificato:
- Fase 1-4: migrazione da HTML singolo a React/TypeScript/Vite, refactoring grafico, editor timeline (undo/redo, zoom, tracce impilabili, forma d'onda, ecc.)
- Fase 5 (multi-GPX): più tracce GPX caricabili, una principale (guida camera/statistiche/percorso), sincronizzazione per timestamp reale delle secondarie, box "dati in tempo reale" multipli e posizionabili, icona "nessuna/solo percorso" con palette colori automatica
- Rendering deterministico dell'esportazione (WebCodecs/Mediabunny), non più in tempo reale

Resta da fare, come ultimo pezzo della specifica originale: **import di clip video proprie** (es. da action cam), su una nuova corsia timeline, con lo stesso comportamento di congelamento del volo già usato per le foto.

## Decisioni già prese (non ridiscutere, solo confermare se richiesto)

- **Ducking audio**: automatico e fisso (non regolabile dall'utente in questa fase) — la musica di sottofondo si abbassa da sola quando una clip video è attiva, con una breve dissolvenza in entrata/uscita.
- **Anteprima vs export**: in anteprima l'elemento `<video>` nativo si riproduce da solo (play/pausa/velocità sincronizzati alla velocità di riproduzione scelta), dando gratis sia il fotogramma corretto sia l'audio nativo. In export si usa seek esplicito + attesa dell'evento `seeked` per ogni fotogramma, coerente con la precisione deterministica già usata per il resto dell'esportazione.
- **Semplificazioni accettate per questa prima versione** (rimandabili in futuro se servono):
  - Nessuna correzione di rotazione per i video (assunti già orientati correttamente dai metadati del contenitore)
  - Nessuna dissolvenza incrociata tra clip video sovrapposte — se due si sovrappongono per errore, vince la prima per ordine di inizio
  - Livello/durata del ducking fissi nel codice, non esposti come impostazione

## Il piano dettagliato (proposto da Claude Code, da eseguire così com'è)

### Nuovo tipo dati (`src/types/domain.ts`)
```
export interface VideoClip {
  id: number;
  name: string;
  videoEl: HTMLVideoElement;
  audioBuffer: AudioBuffer | null;
  posterDataUrl: string;
  videoStart: number;
  trimStart: number;
  trimEnd: number;
  muted: boolean;
}
```
`ProjectState.videoClips: VideoClip[]`.

### Nuovo motore condiviso (`src/video/videoEngine.ts`)
Mirror di `photoEngine.ts`/parti di `musicEngine.ts`:
- `nextVideoId()`, `loadVideoFile(file)` → crea `<video>`, src via `URL.createObjectURL`, attende `loadedmetadata`
- `decodeClipAudio(file)` → stesso `decodeAudioData` già usato per la musica, `null` se fallisce
- `capturePoster(videoEl)` → miniatura per il blocco in timeline (seek + canvas offscreen + `toDataURL`)
- `buildVideoClipAppended`/`buildVideoClipAtPlayhead` — stesso pattern di `photoEngine.ts`
- `getActiveVideoClip(videoClips, timeSec)` — stessa logica di ricerca delle foto, senza dissolvenza (una sola clip attiva alla volta)
- `seekVideoFrame(videoEl, sourceTime)` — usata solo in export (seek + attesa `seeked`)
- `syncPreviewVideo(...)` — usata solo in anteprima, mai awaitata (play/pausa/currentTime/playbackRate, con correzione di deriva se scarto > 0.15s)
- `drawVideoCover(ctx, videoEl, canvasW, canvasH)` — stesso "contain-fit" di `drawPhotoCover`
- `computeDuckFactor(videoClips, timeSec, duckLevel, fadeSec)` — 1 fuori dalle finestre video, `duckLevel` dentro, rampa lineare ai bordi

### Store (`src/store/useProjectStore.ts`)
`addVideoClip`, `updateVideoClip`, `removeVideoClip`, `duplicateVideoClip`, `splitVideoClipAt` (mirror delle azioni musica/foto, stesso vincolo minimo 0.15s).

### UI Timeline
- `src/components/timeline/VideoLane.tsx` (nuovo): mirror di `MusicLane.tsx` — drag/trim/snap, sovrapposizioni gestite come le altre corsie, blocco con miniatura (`posterDataUrl`) invece di forma d'onda, upload `accept="video/*"` + drag&drop
- `TimelineInspector.tsx` + `useTimelineSelectionStore.ts`: nuovo tipo `'video'` nella selezione, branch inspector con nome/mute/taglia/duplica/chiudi (niente slider volume — il bilanciamento è automatico via ducking)
- `useTimelineKeyboardShortcuts.ts`: estendere Canc/Delete al caso `'video'`

### Congelamento del volo (`src/timeline/timelineMath.ts`)
`videoTimeToPathTime`/`computePathIndex` accettano anche `videoClips: VideoClip[] = []`, unendo foto e video in un'unica lista di finestre di congelamento (stesso algoritmo esistente, nessuna riscrittura).

### Anteprima (`src/preview/PreviewEngine.ts`)
- Nuove dipendenze: `getVideoClips()`, `getMusicVolume()`
- `renderFrame`/`drawOverlay`: calcola la clip video attiva, la sincronizza (play/pausa) e la disegna nello stesso punto delle foto (dopo di esse); ogni clip non attiva viene messa in pausa
- Dopo la sincronizzazione musica esistente: calcola il fattore di ducking e applica il volume musica scontato

### Esportazione (`src/export/videoExport.ts` + `deterministicExport.ts`)
- `RecordFlightArgs` guadagna `videoClips`
- `drawOverlayFrame` disegna la clip attiva (stesso punto delle foto)
- Prima di ogni fotogramma: se c'è una clip attiva, `await seekVideoFrame(...)` per precisione deterministica
- `renderMusicMixOffline` (in `musicMix.ts`) guadagna `videoClips`: ogni clip con audio viene sommata nel mix offline con la propria posizione/trim, e sul gain master viene schedulato l'abbassamento fisso durante le finestre video (stesso stile già usato per le dissolvenze tra brani)
- `ActionsPanel.tsx`: passa `videoClips` a `recordArgs`

### Sidebar
`MusicPhotosPanel.tsx` rinominato in "Musica, Foto & Video" (per non confondersi con la sezione "Video" dei parametri di esportazione, che resta distinta), nuovo blocco upload per i video.

## Verifica da fare dopo l'implementazione

- `tsc -b && vite build` senza errori
- Caricare una breve clip video con audio sulla corsia: verificare che il volo si congeli durante la sua riproduzione in anteprima, che fotogramma/audio della clip si vedano/sentano nativamente, che la musica di sottofondo si abbassi udibilmente all'ingresso della clip e torni su all'uscita
- Trascinare/ridimensionare/tagliare/duplicare il blocco video come già si fa per musica/foto
- Registrare un breve export e verificare che il fotogramma estratto sia quello corretto (non sfocato/sbagliato) e che l'audio esportato contenga sia la clip sia la musica ducked, coerente con l'anteprima
- **Casi limite da testare con più attenzione del solito** (vista la complessità): una clip video molto corta, e una clip posizionata proprio all'inizio o alla fine della timeline

## Come procedere quando riprendi

Consiglio: modalità **"Yes, manually approve edits"** (non l'automatica) — è il pezzo più delicato costruito finora, tocca export/audio/timeline/scorciatoie insieme. Fatti mostrare i file via via, non solo il riepilogo finale.
