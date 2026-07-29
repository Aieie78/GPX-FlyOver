import { useState } from 'react';
import { fmtDuration } from '../../geo/geo';
import { parseGpx } from '../../gpx/parseGpx';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import type { SegmentMode } from '../../types/domain';

// Port dei controlli di caricamento GPX e delle statistiche post-caricamento
// (gpx-flyover.html:85-96, 112-116, 397-422).
export function GpxSourcePanel() {
  const mapParams = useProjectStore((s) => s.map);
  const updateMap = useProjectStore((s) => s.updateMap);
  const segmentMode = useProjectStore((s) => s.segmentMode);
  const setSegmentMode = useProjectStore((s) => s.setSegmentMode);
  const track = useProjectStore((s) => s.track);
  const setTrack = useProjectStore((s) => s.setTrack);
  const title = useProjectStore((s) => s.title);
  const setTitle = useProjectStore((s) => s.setTitle);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setCanPreview = usePlaybackStore((s) => s.setCanPreview);

  const [file, setFile] = useState<File | null>(null);
  const [kmPerSec, setKmPerSec] = useState(1.8);
  const [loadedSegmentMode, setLoadedSegmentMode] = useState<SegmentMode | null>(null);
  const [suggestedDurationSec, setSuggestedDurationSec] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string>('');

  const handleLoad = async () => {
    if (!mapParams.maptilerToken.trim()) {
      setLoadError('Inserisci la tua MapTiler API key');
      return;
    }
    if (!file) {
      setLoadError('Seleziona un file GPX');
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
    <>
      <label>
        MapTiler API Key <i className="info" title="La tua chiave gratuita, da cloud.maptiler.com → API Keys">ⓘ</i>
      </label>
      <input
        type="text"
        value={mapParams.maptilerToken}
        onChange={(e) => updateMap({ maptilerToken: e.target.value })}
      />

      <label>
        Segmenti multipli{' '}
        <i
          className="info"
          title="'Solo il più lungo' scarta gli altri segmenti; 'concatena tutti' li unisce in ordine"
        >
          ⓘ
        </i>
      </label>
      <select value={segmentMode} onChange={(e) => setSegmentMode(e.target.value as SegmentMode)}>
        <option value="longest">Usa solo il segmento più lungo</option>
        <option value="concat">Concatena tutti i segmenti in ordine</option>
      </select>

      <label>File GPX</label>
      <input type="file" accept=".gpx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <label>Km/sec percepiti</label>
      <input
        type="number"
        min={0.2}
        max={10}
        step={0.1}
        value={kmPerSec}
        onChange={(e) => setKmPerSec(parseFloat(e.target.value) || 1.8)}
      />

      <label>Titolo del giro (facoltativo)</label>
      <input type="text" placeholder="Es. Passo del Cerreto" value={title} onChange={(e) => setTitle(e.target.value)} />

      <button type="button" className="action-btn" onClick={handleLoad}>
        1. Carica traccia sulla mappa
      </button>
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
                ⚠ Il file contiene {track.nSegmentsFound} segmenti —{' '}
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
                ℹ Traccia molto densa ({track.originalCount.toLocaleString('it-IT')} punti): ridotta a{' '}
                {track.usedCount.toLocaleString('it-IT')} per restare fluida, la forma del percorso non cambia
                sensibilmente.
              </span>
            </>
          )}
          {!track.hasElevationData && (
            <>
              <br />
              <span className="stats-error">
                ⚠ Non trovo dati di quota validi in questo GPX. Profilo altimetrico e "Quota reale" non saranno
                affidabili.
              </span>
            </>
          )}
          {suggestedDurationSec != null && (
            <>
              <br />
              <span className="stats-tip">
                💡 Per leggere bene le località: durata video consigliata ≈ {suggestedDurationSec}s (regola tu il
                campo "Durata video" nella sezione Video)
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
