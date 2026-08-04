import { AlertTriangle, Info, Lightbulb, Trash2 } from 'lucide-react';
import { fmtDuration, getEffectiveMaxSpeedPoint } from '../../geo/geo';
import { useProjectStore } from '../../store/useProjectStore';
import { computeSlowZone, slowZoneExtraSeconds } from '../../timeline/timelineMath';
import type { SegmentMode, VehicleTrack } from '../../types/domain';

interface GpxSourcePanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  kmPerSec: number;
  onKmPerSecChange: (kmPerSec: number) => void;
  loadedSegmentMode: SegmentMode | null;
  suggestedDurationSec: number | null;
  loadError: string | null;
  loadedFileName: string;
  selectedTrackId: number | null;
  onSelectTrack: (id: number) => void;
}

function TrackStats({ track, isSelected, onSelect, onRemove }: {
  track: VehicleTrack;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const setPrimaryTrack = useProjectStore((s) => s.setPrimaryTrack);
  const t = track.track;
  return (
    <div className={`gpx-track-row${isSelected ? ' gpx-track-row--selected' : ''}`} onClick={onSelect}>
      <button
        type="button"
        className="gpx-track-row__remove"
        title="Rimuovi traccia"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 size={13} />
      </button>
      <b>{track.fileName}</b>
      <br />
      <label className="gpx-track-row__primary" onClick={(e) => e.stopPropagation()}>
        <input type="radio" name="primary-track" checked={track.isPrimary} onChange={() => setPrimaryTrack(track.id)} />
        principale
      </label>
      <br />
      Distanza: {(t.totalDist / 1000).toFixed(1)} km
      <br />
      Dislivello +: {Math.round(t.gain)} m &nbsp; -: {Math.round(t.loss)} m
      <br />
      Durata traccia: {fmtDuration(t.durationSec)}
      {t.nSegmentsFound > 1 && (
        <>
          <br />
          <span className="stats-warn">
            <AlertTriangle size={12} /> Il file contiene {t.nSegmentsFound} segmenti.
          </span>
        </>
      )}
      {t.decimated && (
        <>
          <br />
          <span className="stats-info">
            <Info size={12} /> Traccia molto densa ({t.originalCount.toLocaleString('it-IT')} punti): ridotta a{' '}
            {t.usedCount.toLocaleString('it-IT')} per restare fluida.
          </span>
        </>
      )}
      {!t.hasElevationData && (
        <>
          <br />
          <span className="stats-error">
            <AlertTriangle size={12} /> Non trovo dati di quota validi in questo GPX.
          </span>
        </>
      )}
      {t.durationSec == null && (
        <>
          <br />
          <span className="stats-error">
            <AlertTriangle size={12} /> Nessun timestamp valido: la sincronizzazione multi-mezzo non sarà possibile
            per questa traccia.
          </span>
        </>
      )}
    </div>
  );
}

// Port dei controlli di caricamento GPX e delle statistiche post-caricamento
// (gpx-flyover.html:88-96, 112-116, 397-422). Il pulsante "1. Carica" vive nell'ActionsPanel
// sticky in cima alla sidebar insieme ad Anteprima/Registra — questo pannello espone i campi di
// configurazione (stato del file/km-per-sec sollevato in Sidebar.tsx) più, dalla Fase 5.2,
// l'elenco delle tracce già caricate (aggiungi/rimuovi/designa principale).
export function GpxSourcePanel({
  file,
  onFileChange,
  kmPerSec,
  onKmPerSecChange,
  suggestedDurationSec,
  loadError,
  selectedTrackId,
  onSelectTrack,
}: GpxSourcePanelProps) {
  const segmentMode = useProjectStore((s) => s.segmentMode);
  const setSegmentMode = useProjectStore((s) => s.setSegmentMode);
  const tracks = useProjectStore((s) => s.tracks);
  const removeTrack = useProjectStore((s) => s.removeTrack);
  const title = useProjectStore((s) => s.title);
  const setTitle = useProjectStore((s) => s.setTitle);
  const photoClips = useProjectStore((s) => s.photoClips);
  const maxSpeedMarker = useProjectStore((s) => s.maxSpeedMarker);

  // "Durata totale consigliata" — ricalcolata dal vivo (non solo al caricamento del GPX come la
  // durata di volo consigliata sopra) ogni volta che cambiano foto/video in timeline o le
  // impostazioni di rallentamento della bandierina: durata di volo + somma foto/video + tempo
  // extra dovuto al rallentamento intorno al punto di velocità massima (slowZoneExtraSeconds).
  const primaryTrack = tracks.find((t) => t.isPrimary);
  const photoTotalSec = photoClips.reduce((sum, p) => sum + p.duration, 0);
  const effectiveMaxSpeedPoint = primaryTrack
    ? getEffectiveMaxSpeedPoint(primaryTrack.track, primaryTrack.maxSpeedExclusions)
    : null;
  const slowZone = primaryTrack ? computeSlowZone(effectiveMaxSpeedPoint, primaryTrack.track.totalDist, maxSpeedMarker) : null;
  const slowdownExtraSec = suggestedDurationSec != null ? slowZoneExtraSeconds(slowZone, suggestedDurationSec) : 0;
  const extraSec = photoTotalSec + slowdownExtraSec;
  const totalSuggestedSec = suggestedDurationSec != null ? Math.round(suggestedDurationSec + extraSec) : null;

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

      {suggestedDurationSec != null && (
        <p className="stats-tip">
          <Lightbulb size={12} /> Volo: ≈{suggestedDurationSec}s per un ritmo leggibile.
          {extraSec > 0.5 && (
            <>
              {' '}
              Con foto/video attuali (+{Math.round(extraSec)}s): durata totale consigliata ≈{totalSuggestedSec}s
            </>
          )}{' '}
          (regola tu il campo "Durata video" nella sezione Video)
        </p>
      )}

      {tracks.length > 0 && (
        <div className="gpx-track-list">
          {tracks.map((t) => (
            <TrackStats
              key={t.id}
              track={t}
              isSelected={t.id === selectedTrackId}
              onSelect={() => onSelectTrack(t.id)}
              onRemove={() => removeTrack(t.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
