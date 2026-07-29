import { SidebarSection } from './SidebarSection';
import './sidebar.css';

// Sei sezioni collassabili come da prompt-refactoring.md invece del lungo elenco
// verticale dell'originale. Contenuto reale dei pannelli: fase 2/4.
export function Sidebar() {
  return (
    <aside className="sidebar">
      <SidebarSection title="Sorgente GPX" defaultOpen>
        <p className="sidebar-placeholder">TODO: upload GPX, MapTiler token, modalità segmenti, statistiche.</p>
      </SidebarSection>
      <SidebarSection title="Video">
        <p className="sidebar-placeholder">TODO: risoluzione, bitrate, durata, FPS, velocità.</p>
      </SidebarSection>
      <SidebarSection title="Camera">
        <p className="sidebar-placeholder">TODO: pitch, zoom, orbit, bearing.</p>
      </SidebarSection>
      <SidebarSection title="Mappa">
        <p className="sidebar-placeholder">TODO: stile mappa, URL personalizzato.</p>
      </SidebarSection>
      <SidebarSection title="Mezzo">
        <p className="sidebar-placeholder">TODO: tipo, colore, stile icona, quota reale.</p>
      </SidebarSection>
      <SidebarSection title="Musica & Foto">
        <p className="sidebar-placeholder">TODO: upload brani/foto, volume globale, snap.</p>
      </SidebarSection>
    </aside>
  );
}
