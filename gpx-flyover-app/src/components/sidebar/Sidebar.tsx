import { SidebarSection } from './SidebarSection';
import { GpxSourcePanel } from './GpxSourcePanel';
import { VideoPanel } from './VideoPanel';
import { CameraPanel } from './CameraPanel';
import { MapStylePanel } from './MapStylePanel';
import { VehiclePanel } from './VehiclePanel';
import { MusicPhotosPanel } from './MusicPhotosPanel';
import { ActionsPanel } from './ActionsPanel';
import './sidebar.css';
import './fields.css';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <SidebarSection title="Sorgente GPX" defaultOpen>
        <GpxSourcePanel />
      </SidebarSection>
      <SidebarSection title="Video">
        <VideoPanel />
      </SidebarSection>
      <SidebarSection title="Camera">
        <CameraPanel />
      </SidebarSection>
      <SidebarSection title="Mappa">
        <MapStylePanel />
      </SidebarSection>
      <SidebarSection title="Mezzo">
        <VehiclePanel />
      </SidebarSection>
      <SidebarSection title="Musica & Foto">
        <MusicPhotosPanel />
      </SidebarSection>
      <ActionsPanel />
    </aside>
  );
}
