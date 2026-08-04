# Nota per Claude

Questo è il **tool "normale"** (senza editing/import video).

Esiste un secondo strumento, **con editing/import video**, mantenuto **separatamente e intenzionalmente** — i due NON vanno mai consolidati in uno solo:

- Tool normale (questo progetto): `C:\Users\robya\Documents\GPX-Flyover\gpx-flyover-app`
- Tool con editing video: `C:\Users\robya\Documents\GPX-Flyover\GPX-FlyOver-Editing\gpx-flyover-app`

Il secondo è nato come copia di questo per sviluppare l'import video senza toccare l'originale, e da allora i due proseguono in parallelo.

**Regola**: prima di implementare una nuova funzionalità, se non è esplicitamente chiaro se debba applicarsi solo a questo tool, solo all'altro, o a entrambi, chiedilo all'utente prima di scrivere codice — per evitare che i due progetti tornino a divergere senza che ce ne si accorga.

**Ordine di implementazione**: per le funzionalità che si applicano a entrambi i tool, implementarle prima nel tool con editing video (`GPX-FlyOver-Editing\gpx-flyover-app`), poi portarle QUI — mai il contrario. Così l'integrazione più complessa (con le clip video) si risolve per prima, e il porting verso questo tool resta la direzione facile.
