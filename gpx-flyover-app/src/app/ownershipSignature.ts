// Firma d'autore nascosta — nessuna UI visibile durante l'uso normale. Si attiva solo
// volontariamente con Ctrl+Alt+O (popup a schermo) o digitando window.verifyOwnership() in
// console (F12). Non altera in alcun modo il comportamento dell'app.
declare global {
  interface Window {
    verifyOwnership?: () => void;
  }
}

const APP_NAME = 'GPX-Flyover - Editor';
const AUTHOR = 'AIELLO Roberto';
const POPUP_ID = '__gpxflyover_ownership_popup__';

function showOwnershipPopup(): void {
  const existing = document.getElementById(POPUP_ID);
  if (existing) {
    existing.remove();
    return;
  }
  const year = new Date().getFullYear();
  const overlay = document.createElement('div');
  overlay.id = POPUP_ID;
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.55);font-family:system-ui,-apple-system,sans-serif;cursor:pointer;';
  overlay.innerHTML =
    '<div style="background:#141c33;color:#fff;border-radius:18px;text-align:center;min-width:300px;' +
    'overflow:hidden;cursor:default;box-shadow:0 24px 70px rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.08);">' +
    '<div style="padding:28px 32px 22px;">' +
    '<div style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);' +
    'border:1px solid rgba(255,255,255,0.08);border-radius:999px;padding:6px 16px 6px 6px;margin-bottom:20px;">' +
    '<img src="/favicon.svg" width="22" height="22" style="display:block;" />' +
    '<span style="font-size:13px;font-weight:600;letter-spacing:0.2px;">GPX-Flyover</span>' +
    '</div>' +
    `<div style="font-size:19px;font-weight:700;">${APP_NAME}</div>` +
    '<div style="margin:18px 0;height:1px;background:rgba(255,255,255,0.12);"></div>' +
    '<div style="font-size:11px;letter-spacing:1.2px;color:rgba(255,255,255,0.45);text-transform:uppercase;">Sviluppato da</div>' +
    `<div style="margin-top:6px;font-size:16px;font-weight:700;">${AUTHOR}</div>` +
    '</div>' +
    `<div style="padding:10px 0;background:rgba(0,0,0,0.18);font-size:11px;color:rgba(255,255,255,0.4);">© ${year} Tutti i diritti riservati</div>` +
    '</div>';
  overlay.addEventListener('click', () => overlay.remove());
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', onKey);
    }
  };
  window.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}

export function installOwnershipSignature(): void {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.code === 'KeyO') {
      e.preventDefault();
      showOwnershipPopup();
    }
  });

  window.verifyOwnership = () => {
    console.log(
      `%c${APP_NAME}%c\nSviluppato da ${AUTHOR}\n%cOwnership verificata ✓`,
      'font-size:16px;font-weight:bold;color:#a855f7;',
      'font-size:13px;color:inherit;',
      'font-size:11px;color:#22c55e;',
    );
  };
}
