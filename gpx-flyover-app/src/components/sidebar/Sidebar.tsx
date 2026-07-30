import { useState } from 'react';
import { Camera, Car, FileUp, Map, Music, Video } from 'lucide-react';
import { parseGpx } from '../../gpx/parseGpx';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import type { SegmentMode } from '../../types/domain';
import { SidebarSection } from './SidebarSection';
import { GpxSourcePanel } from './GpxSourcePanel';
import { VideoPanel } from './VideoPanel';
import { CameraPanel } from './CameraPanel';
import { MapStylePanel } from './MapStylePanel';
import { VehiclePanel } from './VehiclePanel';
import { MusicPhotosPanel } from './MusicPhotosPanel';
import { ActionsPanel } from './ActionsPanel';
import { SidebarFooter } from './SidebarFooter';
import './sidebar.css';
import './fields.css';

interface SidebarProps {
  collapsed: boolean;
}

// Stato di caricamento GPX sollevato qui (non in GpxSourcePanel) perché il pulsante
// "1. Carica" vive nell'ActionsPanel sticky in cima alla sidebar, condiviso tra i due pannelli.
export function Sidebar({ collapsed }: SidebarProps) {
  const mapParams = useProjectStore((s) => s.map);
  const segmentMode = useProjectStore((s) => s.segmentMode);
  const setTrack = useProjectStore((s) => s.setTrack);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setCanPreview = usePlaybackStore((s) => s.setCanPreview);

  const [file, setFile] = useState<File | null>(null);
  const [kmPerSec, setKmPerSec] = useState(1.8);
  const [loadedSegmentMode, setLoadedSegmentMode] = useState<SegmentMode | null>(null);
  const [suggestedDurationSec, setSuggestedDurationSec] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState('');

  const handleLoad = async () => {
    if (!mapParams.maptilerToken.trim()) {
      setLoadError('Inserisci la tua MapTiler API key (sezione Mappa)');
      return;
    }
    if (!file) {
      setLoadError('Seleziona un file GPX qui sotto');
      return;
    }
    setLoadError(null);
    setIsPlaying(false);
    setCanPreview(false);
    try {
      const text = await file.text();
      const parsed = parseGpx(text, segmentMode);
      const kmps = kmPerSec || 1.8;
      setSuggestedDurationSec(Math.round(parsed.totalDist / 1000 / kmps));
      setLoadedSegmentMode(segmentMode);
      setLoadedFileName(file.name);
      setTrack(parsed);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Errore durante il parsing del GPX');
    }
  };

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <ActionsPanel onLoad={handleLoad} />
      <div className="sidebar__sections">
        <SidebarSection title="Sorgente GPX" icon={FileUp} defaultOpen>
          <GpxSourcePanel
            file={file}
            onFileChange={setFile}
            kmPerSec={kmPerSec}
            onKmPerSecChange={setKmPerSec}
            loadedSegmentMode={loadedSegmentMode}
            suggestedDurationSec={suggestedDurationSec}
            loadError={loadError}
            loadedFileName={loadedFileName}
          />
        </SidebarSection>
        <SidebarSection title="Video" icon={Video}>
          <VideoPanel />
        </SidebarSection>
        <SidebarSection title="Camera" icon={Camera}>
          <CameraPanel />
        </SidebarSection>
        <SidebarSection title="Mappa" icon={Map}>
          <MapStylePanel />
        </SidebarSection>
        <SidebarSection title="Mezzo" icon={Car}>
          <VehiclePanel />
        </SidebarSection>
        <SidebarSection title="Musica & Foto" icon={Music}>
          <MusicPhotosPanel />
        </SidebarSection>
      </div>
      <SidebarFooter />
    </aside>
  );
}
