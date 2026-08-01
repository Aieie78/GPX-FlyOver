# Specifica — Multi-GPX (mezzi cooperanti) + Import Video

Incolla questo come messaggio a Claude Code quando il Gruppo 4 di Fase 4 è concluso e verificato. Sono due estensioni di scope importanti, da trattare come una fase a sé (chiamiamola Fase 5), non da innestare di corsa sul lavoro grafico appena fatto.

---

## Contesto

Fino ad ora l'app gestisce **un solo GPX per progetto**. Voglio estendere il tool per gestire **più tracce GPX contemporaneamente** — scenario tipico: un drone che segue una moto (o più mezzi che percorrono lo stesso giro insieme), ognuno con la propria registrazione GPS.

In parallelo, sblocco la **Fase 2A** già documentata (import di video propri nella timeline), che era volutamente in pausa fino ad ora.

Procedi per fasi verificabili come sempre: prima la struttura dati multi-traccia, poi la UI di gestione, poi la sincronizzazione temporale, poi l'estrazione dei frame video per l'esportazione. Fammi verificare dopo ogni passo.

---

## PARTE A — Multi-GPX con mezzi cooperanti

### Modello dati

Sostituire il concetto attuale di "una traccia" con un **elenco di tracce**, ognuna con:
- File GPX proprio, con la stessa logica di parsing/segmenti/decimazione già esistente (riusata senza modifiche)
- Statistiche proprie (distanza, dislivello, durata traccia — calcolate come oggi, per singola traccia)
- Impostazioni "Mezzo" proprie e indipendenti: tipo icona, colore, stile icona, dimensione, checkbox "icona in quota reale", esagerazione quota — **ogni traccia ha il suo pannello Mezzo separato**, non condiviso
- Un flag **"Traccia principale"** — una sola traccia alla volta può essere principale

### Traccia principale — cosa controlla

La traccia principale è quella che guida **tutto il resto del progetto**, esattamente come oggi:
- Camera (pitch/zoom/orbit/bearing, smoothing) segue solo la traccia principale
- Il meccanismo di congelamento del volo durante le foto si applica in base alla traccia principale
- Le statistiche overlay nel video (distanza/dislivello/quota, profilo altimetrico) sono quelle della traccia principale
- Il calcolo della durata suggerita (km/sec percepiti) usa la traccia principale
- Il percorso disegnato con la linea di avanzamento resta quello della traccia principale
- **Colore del percorso principale**: se in progetto è caricato **un solo GPX**, il percorso resta sempre fisso giallo (comportamento attuale invariato). Se sono caricate **più tracce**, il colore del percorso principale diventa personalizzabile come per le secondarie (default giallo).

### Tracce secondarie — cosa mostrano

Ogni traccia secondaria mostra **sia l'icona mezzo che il proprio percorso completo con linea di avanzamento**, con lo stesso comportamento della traccia principale (icona+linea di quota+ombra a terra, percorso disegnato + tratto già percorso evidenziato) — parametrizzato per traccia invece che singola.

**Colore del percorso secondario**: dato che più mezzi spesso ripetono lo stesso giro (percorsi sovrapposti), ogni traccia secondaria ha un colore percorso proprio per restare distinguibile:
- Di default il percorso usa **lo stesso colore già impostato per l'icona del mezzo** in quella traccia (un solo controllo colore, coordinato).
- Se il tipo icona è impostato su **"nessuna/trasparente"**, compare automaticamente un **color-picker indipendente per il percorso**, con valore iniziale assegnato da una palette a rotazione (evitando duplicati con i colori già in uso dalle altre tracce/dal giallo della principale), comunque modificabile manualmente in qualsiasi momento.

### Sincronizzazione temporale (per timestamp GPX reale)

Questo è il punto architetturalmente più delicato:
- La traccia principale definisce la corrispondenza tra "tempo del video" e "tempo reale": il video-tempo 0 corrisponde al timestamp reale del primo punto della traccia principale (nel segmento/porzione usata), scalato per coprire l'intera durata video impostata (e la velocità x0.5/x1/x1.5/x2 come già gestito oggi).
- Per ogni traccia secondaria, dato un istante di tempo-video, calcola il timestamp reale corrispondente (usando la stessa scala della principale) e trova il punto interpolato sulla traccia secondaria con quel timestamp reale (stessa logica di ricerca binaria/interpolazione già usata per la traccia principale, riapplicata sui timestamp invece che sulla distanza cumulativa).
- **Se il timestamp calcolato cade fuori dal range coperto dalla traccia secondaria** (prima del suo inizio o dopo la sua fine), l'icona di quella traccia **non va disegnata per quel fotogramma** (sparisce), sia in anteprima che in registrazione.
- **Requisito critico da validare e segnalare chiaramente all'utente**: questa sincronizzazione richiede che sia la traccia principale sia le secondarie abbiano dati `<time>` validi per i punti GPX. Se una traccia (principale o secondaria) non ha timestamp validi, mostra un avviso chiaro nella UI spiegando che la sincronizzazione multi-mezzo non è possibile per quella traccia, invece di fallire silenziosamente o produrre posizioni scorrette.

### Box "dati in tempo reale" per traccia

Ogni traccia (principale e secondarie) ha una propria checkbox **"Mostra dati in tempo reale"**, identificabile dal nome del file GPX:
- Se attiva, mostra un box con le **stesse statistiche già presenti nel box attuale** (distanza, dislivello, quota, ora GMT) calcolate sulla traccia a cui appartiene.
- Con più tracce attive contemporaneamente, ogni box è **posizionabile e ridimensionabile individualmente** dall'utente (nessuna disposizione automatica imposta).
- Vale sia per l'**anteprima** che per il **video esportato**: ogni traccia con la spunta attiva produce il proprio overlay nel rendering finale, in aggiunta a quello della principale.

### UI

- Nuova sezione o estensione di "Sorgente GPX": lista delle tracce caricate, con pulsante per aggiungerne altre, un modo per designare quale sia "principale" (es. radio button), e un modo per rimuovere una traccia.
- Il pannello "Mezzo" deve avere un selettore in cima (es. un menu a tendina "Traccia: [nome]") per scegliere di quale traccia si stanno modificando le impostazioni mezzo — dato che ora sono multiple e indipendenti.
- Le statistiche di durata/pianificazione restano calcolate sulla traccia principale, ma ogni traccia secondaria ha il proprio riepilogo (nome file, range di tempo coperto) e la propria checkbox "Mostra dati in tempo reale" come sopra.

### Domanda aperta per Claude Code

Prima di scrivere codice, proponi tu la struttura dati/store più adatta (es. array di oggetti "vehicle track" in Zustand, con un id per la traccia principale) e un piano a fasi verificabili — poi procediamo.

---

## PARTE B — Import video (Fase 2A, ora sbloccata)

Riprendo la specifica già scritta in precedenza, invariata:

- Upload di clip video proprie (es. da action cam), posizionabili in una nuova corsia "Video" con la stessa logica di drag/trim/snap già costruita per foto e musica.
- Durante la riproduzione della clip, il volo si congela come per le foto (stesso meccanismo, basato sulla traccia principale).
- La clip porta con sé il proprio audio, che si somma (mixato) a quello della musica di sottofondo — decidi tu se implementare un abbassamento automatico (ducking) della musica sotto il parlato/audio della clip, o lasciare il controllo volume manuale separato per ora (più semplice); proponimi la tua raccomandazione prima di procedere.
- **Estrazione frame per l'esportazione deterministica**: per ogni fotogramma del video di esportazione che cade dentro l'intervallo di una clip video, devi estrarre il fotogramma corretto dal video sorgente (element `<video>`, seek al timestamp esatto, attendere l'evento `seeked`, poi disegnarlo sul canvas di esportazione) — coerente con l'approccio deterministico già in uso per il resto del rendering (nessun vincolo di tempo reale, ogni fotogramma richiede il tempo che serve).
- Anteprima interattiva: durante lo scrub della timeline, mostra un fotogramma ragionevolmente vicino (stessa logica seek+draw, ma può essere meno precisa in anteprima per restare fluida — usa il tuo giudizio, spiegami il compromesso scelto).

---

## Nota generale

Questa è la fase di lavoro più complessa affrontata finora in termini di modello dati (da traccia singola a multi-traccia con sincronizzazione temporale reale). Prenditi il tempo per proporre l'architettura prima di scrivere codice, come richiesto sopra — non iniziare a implementare finché non confermo il piano.
