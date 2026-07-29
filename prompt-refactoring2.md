# Prompt per Claude Code CLI — Refactoring "GPX Flyover Video Generator"

Incolla questo intero documento come primo messaggio a Claude Code CLI, nella cartella dove hai copiato `gpx-flyover.html`.

---

## Contesto

Ho un tool web (`gpx-flyover.html`, ~1500 righe, un unico file HTML/CSS/JS senza build step) che genera video di volo 3D animato sopra un percorso GPX (stile Relive/Strava), con mappa satellitare (MapTiler + MapLibre GL JS), icona del mezzo, musica di sottofondo multi-traccia, foto nella timeline, e registrazione video via MediaRecorder/Web Audio API — tutto lato client, senza backend.

È cresciuto per iterazioni successive ed è arrivato al limite di manutenibilità del formato "singolo file": bug di stacking CSS, variabili globali sparse, nessuna build, nessun test. Voglio **rifattorizzarlo in un progetto vero**, mantenendo tutte le funzionalità esistenti, migliorando la grafica, e aggiungendo le funzionalità che mancano per essere un editor video a tutti gli effetti.

## Obiettivo

1. Migrare da singolo file HTML a un progetto **TypeScript + Vite**, modularizzato.
2. Mantenere **esattamente tutte le funzionalità attuali** (elenco completo sotto — nessuna regressione).
3. Migliorare la grafica: aspetto più professionale/moderno, meno "prototipo", coerente con un vero editor video.
4. Aggiungere le funzionalità indispensabili per un editing serio (elenco sotto).
5. Il risultato deve restare **utilizzabile offline/standalone** quanto possibile (build che produce un output distribuibile, anche se ora richiede un passaggio di build invece di aprire il file direttamente).

## Come procedere

- Leggi prima tutto `gpx-flyover.html` per capire la logica esistente prima di scrivere qualsiasi codice.
- Procedi per fasi verificabili: (1) setup progetto Vite+TS, (2) migrazione 1:1 della logica esistente in moduli separati SENZA cambiare comportamento, (3) verifica che tutto funzioni ancora come prima, (4) refactoring grafico, (5) nuove funzionalità una alla volta.
- Dopo ogni fase, fammi sapere cosa hai fatto e cosa verificare io stesso nel browser prima di andare avanti — non accumulare troppe modifiche non testate.
- Usa git da subito (`git init`, commit ad ogni fase) così possiamo tornare indietro se qualcosa si rompe.

---

## Funzionalità esistenti da mantenere (nessuna deve andare persa)

**Caricamento GPX**
- Input MapTiler API key, upload file GPX
- Gestione multi-segmento (modalità "solo il più lungo" vs "concatena tutti")
- Decimazione automatica per tracce oltre 40.000 punti
- Parsing quota con fallback su tag non standard, avviso se nessun dato di quota valido
- Statistiche post-caricamento: distanza, dislivello +/-, durata traccia, suggerimento di durata video in base a "km percepiti al secondo"

**Impostazioni video**
- Risoluzione (720p/1080p/1440p), bitrate (Mbps), durata (sec), FPS
- Velocità di riproduzione/registrazione x0.5/x1/x1.5/x2 (accelera/rallenta SOLO il video, mai la musica)

**Camera**
- Pitch, zoom, ampiezza e periodo della rotazione panoramica cinematica
- Bearing calcolato sulla direzione generale del percorso (non sulla singola curva locale), con smoothing
- Stile mappa (satellite hybrid/plain/outdoor/winter) + URL stile personalizzato di riserva

**Icona del mezzo**
- Tipi: moto/auto/elicottero/aereo, colore personalizzabile
- Stili: cerchio pieno+simbolo, solo simbolo, solo punto
- Dimensione regolabile
- Modalità "quota reale" con esagerazione regolabile (per tracce aeree): l'icona si solleva otticamente in base al pitch della camera
- Linea tratteggiata sfumata dal terreno all'icona + punto ombra a terra, ridisegnata ogni frame (non permanente)

**Musica**
- Caricamento multi-brano
- Per ogni brano: taglio inizio/fine (trim), posizione di attacco nel video (posizionamento libero, non sequenziale forzato)
- Sovrapposizione tra brani supportata (mixaggio automatico)
- La musica avanza SEMPRE a velocità reale (x1), indipendentemente dalla velocità scelta per il video — si riallinea sui salti/seek ma non accelera mai
- Volume globale, dissolvenza finale automatica (ultimi 2 secondi)
- Non suona durante l'anteprima se il video è in pausa

**Foto nella timeline**
- Aggiunta via pulsante "+" nella timeline (alla posizione della playhead) o upload multiplo
- Per ogni foto: posizione di attacco, durata di visualizzazione (trascinabile)
- Copertura a schermo intero in stile "cover" con dissolvenza in entrata/uscita
- **Il volo si congela per tutta la durata della foto** (camera, percorso disegnato, icona, statistiche), riprendendo esattamente da dove si trovava — musica e playhead continuano normalmente

**Editor timeline**
- Barra di scorrimento principale con playhead condivisa (stessa posizione esatta) tra barra video, corsia musica, corsia foto
- Corsie musica/foto con blocchi trascinabili (sposta posizione) e ridimensionabili dai bordi (taglia inizio/fine o durata)
- Calamita (snap) su: inizio video, fine video, playhead corrente, bordi degli altri blocchi
- Click su corsia (fuori dai blocchi) sposta la playhead lì
- Miniatura reale dell'immagine nei blocchi foto
- Pulsante di rimozione (✕) per ogni blocco

**Anteprima interattiva**
- Play/pausa, salto ±5s, barra di scorrimento draggabile, velocità x0.5/x1/x1.5/x2
- Tutti i parametri (camera, mappa, icona, ecc.) si aggiornano dal vivo mentre l'anteprima è aperta, anche in pausa

**Registrazione**
- Produce file .webm scaricabile con audio integrato (musica mixata)
- Overlay nel video: titolo, profilo altimetrico (sagoma), statistiche (distanza/dislivello/quota), barra di avanzamento, icona mezzo, linea di quota

---

## Nuove funzionalità da aggiungere (per essere un editor vero)

Priorità alta (indispensabili):
1. **Rendering di esportazione deterministico e più veloce del tempo reale.** Oggi la registrazione riproduce il volo in tempo reale (un video di 3 minuti impiega 3 minuti a generarsi). Va sostituito con un rendering frame-by-frame che non dipende dal refresh dello schermo, per generare il video il più velocemente possibile (idealmente con una progress bar reale e pulsante di annullamento).
2. **Undo/redo** (Ctrl+Z / Ctrl+Y) su tutte le modifiche a musica, foto, e parametri principali.
3. **Zoom orizzontale sulla timeline** (rotellina del mouse o pulsanti +/-) con scroll, per lavorare con precisione su video lunghi.
4. **Forma d'onda audio** disegnata dentro i blocchi musica (dai dati già decodificati via Web Audio), invece del blocco a tinta piatta.
5. **Tracce impilabili**: se due brani/foto si sovrappongono, vanno mostrati su righe separate nella stessa corsia invece di sovrapporsi visivamente.
6. **Salvataggio/caricamento progetto**: serializzare l'intero stato (parametri, posizioni musica/foto, non necessariamente i file binari) in JSON esportabile/importabile, così si può riprendere una sessione di editing senza rifare tutto da capo.

Priorità media (molto utili):
7. Volume per singola traccia musicale (non solo globale) + mute/solo per traccia.
8. Dissolvenza incrociata automatica quando due brani si sovrappongono (invece del semplice mix).
9. Strumento "taglia" (razor) per dividere un blocco musica/foto in due nel punto della playhead.
10. Duplica blocco (musica o foto).
11. Drag-and-drop di file audio/immagine direttamente sulle corsie (non solo tramite selettore file).
12. Scorciatoie da tastiera: barra spaziatrice per play/pausa, frecce per avanzare frame per frame, Delete per rimuovere il blocco selezionato.
13. Interruttore per disattivare la calamita/snap quando serve posizionamento libero preciso.

Priorità bassa (belle da avere, non urgenti):
14. Anteprima miniatura al passaggio del mouse sulla barra di scorrimento principale (come YouTube).
15. Preset di camera pronti (es. "Panoramica cinematica lenta", "Vista d'insieme veloce", "Inseguimento a bassa quota") selezionabili con un click invece di regolare ogni parametro a mano.
16. Editor di testo/titoli multipli con posizione e timing personalizzati (oggi c'è un solo titolo fisso).
17. Opzioni di ritaglio per formati social (verticale 9:16, quadrato 1:1) oltre al classico 16:9.

---

## Direzione grafica

L'aspetto attuale è scuro/funzionale ma "da prototipo": sidebar con etichette impilate, emoji come icone, spaziature poco curate. Per la nuova versione:

- Usa un vero set di icone (es. Lucide o Feather) al posto delle emoji per i controlli (play/pausa, aggiungi, rimuovi, ecc.) — le emoji vanno bene solo per il tipo di mezzo (moto/auto/elicottero/aereo), lì possono restare.
- Organizza la sidebar in **sezioni collassabili o tab** (es. "Sorgente GPX", "Video", "Camera", "Mappa", "Mezzo", "Musica & Foto") invece di un lungo elenco verticale continuo.
- Timeline in basso più simile a un editor video professionale: righelli con i secondi, playhead più marcata, blocchi con angoli arrotondati e ombre leggere, colori con più contrasto tra musica/foto/selezione attiva.
- Stato attivo/hover più chiaro su pulsanti e blocchi (feedback visivo quando si trascina, quando si aggancia alla calamita, ecc.).
- Mantieni il tema scuro di base (coerente con l'uso — anteprima mappa/video), ma con una palette più curata e coerente (attualmente giallo/ciano/rosso mescolati un po' a caso).

## Stack tecnico suggerito

- **TypeScript** per tutto il codice applicativo.
- **Vite** come build tool (dev server con hot reload — permette di vedere subito gli effetti delle modifiche, cosa che nella chat con Claude non è possibile).
- Moduli separati per: parsing GPX, gestione mappa/camera, gestione audio/musica, gestione foto/timeline, UI dei pannelli, esportazione video.
- Framework UI: **libero a te (Claude Code) di valutare** se usare React per la gestione dello stato (utile viste le molte interazioni drag/drop/sync) o restare vanilla TS con una gestione dello stato centralizzata esplicita — dimmi cosa consigli prima di procedere, spiegando il perché in 2-3 righe.
- Mantieni MapLibre GL JS e MapTiler come sono ora (funzionano bene, nessun motivo per cambiarli).

## Cosa NON cambiare senza chiedere

- Le formule di calcolo (bearing/smoothing camera, congelamento del volo durante le foto, sincronizzazione musica indipendente dalla velocità) sono state tarate con diverse iterazioni — se le riscrivi, mantieni lo stesso comportamento risultante, non solo lo stesso "spirito".
- Non introdurre dipendenze da servizi esterni a pagamento oltre a MapTiler (che l'utente finale configura con la propria chiave).

---

## FASE 2 — da affrontare SOLO dopo che la Fase 1 (refactoring + funzionalità sopra) è completa, testata e stabile

Non iniziare questa fase finché non te lo confermo esplicitamente. Sono due estensioni di scope importanti, da progettare con calma sull'architettura già rifattorizzata, non da innestare di corsa su quella attuale.

### 2A — Importazione di video propri nella timeline

Oggi la corsia "Foto" mostra immagini statiche a schermo intero, congelando il volo per la durata impostata. Estendere lo stesso concetto ai video:
- Upload di clip video proprie (es. da action cam durante il giro), posizionabili in una nuova corsia "Video" con la stessa logica di drag/trim/snap già costruita per foto e musica.
- Durante la riproduzione della clip, il volo si congela come per le foto (stesso meccanismo).
- La clip deve poter portare con sé il proprio audio, che si somma (mixato) a quello della musica di sottofondo — va deciso se l'audio della clip abbassa automaticamente il volume della musica sotto (ducking) o se lasciamo il controllo manuale del volume all'utente.
- Vincolo tecnico da rispettare: l'estrazione dei frame video per comporli nel canvas di esportazione deve restare compatibile con il nuovo rendering deterministico (punto 1 della lista "priorità alta" della Fase 1) — non tornare a un approccio "tempo reale" per gestire questo.

### 2B — Assistente AI (Claude) per suggerimenti di editing

**Non implementare finché non discutiamo insieme l'architettura**, perché richiede un componente che il progetto attuale non ha: un piccolo server locale (anche minimale, es. Node/Express) che faccia da proxy verso le API di Anthropic, dato che le chiamate dirette da browser non sono possibili per motivi di sicurezza (esporrebbero la chiave API a chiunque). L'utente finale dovrà fornire una propria chiave API Anthropic (con relativo costo di utilizzo, a differenza di MapTiler).

Funzionalità concrete da implementare, in quest'ordine:
1. **"Suggerisci impostazioni camera"**: invia alle API di Claude un riassunto delle statistiche del percorso (distanza, dislivello, curviness/tortuosità calcolata dai dati GPX) e richiede in risposta valori suggeriti per pitch/zoom/ampiezza rotazione/velocità, motivati in una frase (es. "tornanti stretti e dislivello marcato: camera più lenta e panoramica accentuata").
2. **"Genera titolo e descrizione"**: genera un titolo accattivante e una breve didascalia a partire dai dati del giro (nomi di località attraversate, km, dislivello).
3. (Solo dopo aver validato i primi due) un campo di comando in linguaggio naturale che traduce richieste testuali (es. "rendi il video più lento sulle curve strette") in modifiche ai parametri esistenti — non inventare nuove funzionalità di editing per soddisfare un comando, deve poter agire solo sui controlli già presenti nell'app.

Quando arriviamo a questa fase, chiedimi conferma su: dove/come far girare il piccolo server proxy (locale sul PC dell'utente vs. hosting), e come gestire in modo sicuro la chiave API dell'utente (mai salvata in chiaro in un file sincronizzato o versionato).
