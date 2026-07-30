import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { fmtDuration } from '../../geo/geo';
import { useProjectStore } from '../../store/useProjectStore';
import type { SegmentMode } from '../../types/domain';

interface GpxSourcePanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  kmPerSec: number;
  onKmPerSecChange: (kmPerSec: number) => void;
  loadedSegmentMode: SegmentMode | null;
  suggestedDurationSec: number | null;
  loadError: string | null;
  loadedFileName: string;
}

// Port dei controlli di caricamento GPX e delle statistiche post-caricamento
// (gpx-flyover.html:88-96, 112-116, 397-422). Il pulsante "1. Carica" vive nell'ActionsPanel
// sticky in cima alla sidebar insieme ad Anteprima/Registra — questo pannello espone solo i
// campi di configurazione, con lo stato del file/km-per-sec sollevato in Sidebar.tsx.
export function GpxSourcePanel({
  file,
  onFileChange,
  kmPerSec,
  onKmPerSecChange,
  loadedSegmentMode,
  suggestedDurationSec,
  loadError,
  loadedFileName,
}: GpxSourcePanelProps) {
  const segmentMode = useProjectStore((s) => s.segmentMode);
  const setSegmentMode = useProjectStore((s) => s.setSegmentMode);
  const track = useProjectStore((s) => s.track);
  const title = useProjectStore((s) => s.title);
  const setTitle = useProjectStore((s) => s.setTitle);

  return (
    <>
      <label>
        Segmenti multipli{' '}
        <i
          className="info"
          title="'Solo il più lungo' scarta gli altri segmenti; 'concatena tutti' li unisce in ordine"
        >
          <Info size={10} />
        </i>
      </label>
      <select value={segmentMode} onChange={(e) => setSegmentMode(e.target.value as SegmentMode)}>
        <option value="longest">Usa solo il segmento più lungo</option>
        <option value="concat">Concatena tutti i segmenti in ordine</option>
      </select>

      <label>File GPX</label>
      <input type="file" accept=".gpx" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
      {file && <p className="field-hint">Selezionato: {file.name}</p>}

      <label>Km/sec percepiti</label>
      <input
        type="number"
        min={0.2}
        max={10}
        step={0.1}
        value={kmPerSec}
        onChange={(e) => onKmPerSecChange(parseFloat(e.target.value) || 1.8)}
      />

      <label>Titolo del giro (facoltativo)</label>
      <input type="text" placeholder="Es. Passo del Cerreto" value={title} onChange={(e) => setTitle(e.target.value)} />

      {loadError && <p className="field-error">{loadError}</p>}

      {track && (
        <div className="stats-box">
          <b>{title || loadedFileName}</b>
          <br />
          Distanza: {(track.totalDist / 1000).toFixed(1)} km
          <br />
          Dislivello +: {Math.round(track.gain)} m &nbsp; -: {Math.round(track.loss)} m
          <br />
          Durata traccia: {fmtDuration(track.durationSec)}
          {track.nSegmentsFound > 1 && (
            <>
              <br />
              <span className="stats-warn">
                <AlertTriangle size={12} /> Il file contiene {track.nSegmentsFound} segmenti —{' '}
                {loadedSegmentMode === 'concat'
                  ? 'li ho concatenati tutti in ordine.'
                  : 'sto usando solo il più lungo (cambia modalità sopra se serve concatenarli).'}
              </span>
            </>
          )}
          {track.decimated && (
            <>
              <br />
              <span className="stats-info">
                <Info size={12} /> Traccia molto densa ({track.originalCount.toLocaleString('it-IT')} punti): ridotta a{' '}
                {track.usedCount.toLocaleString('it-IT')} per restare fluida, la forma del percorso non cambia
                sensibilmente.
              </span>
            </>
          )}
          {!track.hasElevationData && (
            <>
              <br />
              <span className="stats-error">
                <AlertTriangle size={12} /> Non trovo dati di quota validi in questo GPX. Profilo altimetrico e "Quota
                reale" non saranno affidabili.
              </span>
            </>
          )}
          {suggestedDurationSec != null && (
            <>
              <br />
              <span className="stats-tip">
                <Lightbulb size={12} /> Per leggere bene le località: durata video consigliata ≈{' '}
                {suggestedDurationSec}s (regola tu il campo "Durata video" nella sezione Video)
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
