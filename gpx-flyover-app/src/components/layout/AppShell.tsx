import { useEffect } from 'react';
import { startLiveParamsSync } from '../../app/liveParamsSync';
import { Sidebar } from '../sidebar/Sidebar';
import { MapCanvas } from '../map/MapCanvas';
import { PreviewControls } from '../preview/PreviewControls';
import { Timeline } from '../timeline/Timeline';
import './appShell.css';

export function AppShell() {
  useEffect(() => startLiveParamsSync(), []);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell__main">
        <MapCanvas />
        <PreviewControls />
        <Timeline />
      </main>
    </div>
  );
}
