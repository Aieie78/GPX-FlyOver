// Vero se target è un campo che gestisce da sé l'input da tastiera (testo/numero/select) — le
// scorciatoie globali (undo/redo, frecce di seek, elimina blocco) devono ignorare l'evento in
// questo caso, per non rubare l'editing nativo mentre l'utente sta scrivendo.
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// Come isEditableTarget, ma include anche i bottoni: usato SOLO per la scorciatoia Spazio
// (play/pausa), che altrimenti attiverebbe anche il click nativo di un bottone a fuoco.
export function isEditableOrButtonTarget(target: EventTarget | null): boolean {
  return isEditableTarget(target) || (target instanceof HTMLElement && target.tagName === 'BUTTON');
}
