import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { startLiveParamsSync } from '../../app/liveParamsSync';
import { Sidebar } from '../sidebar/Sidebar';
import { MapCanvas } from '../map/MapCanvas';
import { PreviewControls } from '../preview/PreviewControls';
import { Timeline } from '../timeline/Timeline';
import './appShell.css';

export function AppShell() {
  useEffect(() => startLiveParamsSync(), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar collapsed={sidebarCollapsed} />
      <button
        type="button"
        className={`sidebar-toggle${sidebarCollapsed ? ' sidebar-toggle--collapsed' : ''}`}
        onClick={() => setSidebarCollapsed((v) => !v)}
        aria-label={sidebarCollapsed ? 'Espandi pannello laterale' : 'Comprimi pannello laterale'}
        title={sidebarCollapsed ? 'Espandi pannello laterale' : 'Comprimi pannello laterale'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      <main className="app-shell__main">
        <MapCanvas />
        <PreviewControls />
        <Timeline />
      </main>
    </div>
  );
}
