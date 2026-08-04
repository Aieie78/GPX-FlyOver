import { useState } from 'react';
import { Camera, Car, FileUp, FolderOpen, Map, Music, Video } from 'lucide-react';
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
import { ProjectPanel } from './ProjectPanel';
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
  const tracks = useProjectStore((s) => s.tracks);
  const addTrack = useProjectStore((s) => s.addTrack);
  const updateVehicle = useProjectStore((s) => s.updateVehicle);
  const setMaxSpeedExclusions = useProjectStore((s) => s.setMaxSpeedExclusions);
  const setPrimaryTrack = useProjectStore((s) => s.setPrimaryTrack);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setCanPreview = usePlaybackStore((s) => s.setCanPreview);

  const [file, setFile] = useState<File | null>(null);
  const [kmPerSec, setKmPerSec] = useState(1.8);
  const [loadedSegmentMode, setLoadedSegmentMode] = useState<SegmentMode | null>(null);
  const [suggestedDurationSec, setSuggestedDurationSec] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState('');
  // Traccia in editing nel pannello Mezzo — sollevato qui perché condiviso tra GpxSourcePanel
  // (evidenzia la voce nella lista) e VehiclePanel (legge/scrive le sue impostazioni). Se punta
  // a una traccia rimossa, ricade sulla principale.
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const effectiveSelectedTrackId = tracks.some((t) => t.id === selectedTrackId)
    ? selectedTrackId
    : (tracks.find((t) => t.isPrimary)?.id ?? null);

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
      const isFirst = tracks.length === 0;
      const kmps = kmPerSec || 1.8;
      setSuggestedDurationSec(isFirst ? Math.round(parsed.totalDist / 1000 / kmps) : null);
      setLoadedSegmentMode(segmentMode);
      setLoadedFileName(file.name);
      const newId = addTrack(file.name, parsed);
      setSelectedTrackId(newId);

      // Riaggancio automatico per nome file: se questo GPX era atteso da un "Carica progetto"
      // precedente (stesso nome), riapplica le impostazioni Mezzo/esclusioni bandierina salvate
      // e, se era la principale, forza di nuovo il ruolo (anche se un altro file era stato
      // ricaricato per primo in questa sessione — vedi ProjectPanel.tsx).
      const expected = usePlaybackStore.getState().expectedTracksMeta.find((t) => t.fileName === file.name);
      if (expected) {
        updateVehicle(newId, expected.vehicle);
        setMaxSpeedExclusions(newId, expected.maxSpeedExclusions);
        if (expected.isPrimary) setPrimaryTrack(newId);
      }
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Errore durante il parsing del GPX');
    }
  };

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <ActionsPanel onLoad={handleLoad} hasTracks={tracks.length > 0} />
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
            selectedTrackId={effectiveSelectedTrackId}
            onSelectTrack={setSelectedTrackId}
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
          <VehiclePanel selectedTrackId={effectiveSelectedTrackId} onSelectTrack={setSelectedTrackId} />
        </SidebarSection>
        <SidebarSection title="Musica & Foto" icon={Music}>
          <MusicPhotosPanel />
        </SidebarSection>
        <SidebarSection title="Progetto" icon={FolderOpen}>
          <ProjectPanel />
        </SidebarSection>
      </div>
      <SidebarFooter />
    </aside>
  );
}
