import { getEffectiveMaxSpeedPoint } from '../../geo/geo';
import { useProjectStore } from '../../store/useProjectStore';
import type { VehicleIcon, VehicleIconStyle } from '../../types/domain';

interface VehiclePanelProps {
  selectedTrackId: number | null;
  onSelectTrack: (id: number) => void;
}

// Port dei controlli icona mezzo di gpx-flyover.html:160-191. Dalla Fase 5.2, con più tracce
// caricate, un selettore in cima sceglie quale traccia si sta editando — con una sola traccia
// resta implicito (nessun selettore) come prima.
export function VehiclePanel({ selectedTrackId, onSelectTrack }: VehiclePanelProps) {
  const tracks = useProjectStore((s) => s.tracks);
  const pendingVehicle = useProjectStore((s) => s.pendingVehicle);
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const vehicle = selectedTrack?.vehicle ?? pendingVehicle;
  const updateVehicleRaw = useProjectStore((s) => s.updateVehicle);
  const updateVehicle = (patch: Partial<typeof vehicle>) => updateVehicleRaw(selectedTrack?.id ?? null, patch);
  const maxSpeedMarker = useProjectStore((s) => s.maxSpeedMarker);
  const updateMaxSpeedMarker = useProjectStore((s) => s.updateMaxSpeedMarker);
  const discardMaxSpeedPoint = useProjectStore((s) => s.discardMaxSpeedPoint);
  const resetMaxSpeedExclusions = useProjectStore((s) => s.resetMaxSpeedExclusions);
  const effectiveMaxSpeedPoint = selectedTrack
    ? getEffectiveMaxSpeedPoint(selectedTrack.track, selectedTrack.maxSpeedExclusions)
    : null;

  return (
    <>
      {tracks.length > 1 && (
        <>
          <label>Traccia</label>
          <select value={selectedTrackId ?? ''} onChange={(e) => onSelectTrack(Number(e.target.value))}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fileName} {t.isPrimary ? '(principale)' : ''}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="row">
        <div>
          <label>Icona mezzo</label>
          <select value={vehicle.icon} onChange={(e) => updateVehicle({ icon: e.target.value as VehicleIcon })}>
            <option value="🏍️">Moto 🏍️</option>
            <option value="🚗">Macchina 🚗</option>
            <option value="🚁">Elicottero 🚁</option>
            <option value="✈️">Aereo ✈️</option>
            <option value="🚢">Nave 🚢</option>
            <option value="none">Nessuna (solo percorso)</option>
          </select>
        </div>
        <div>
          {vehicle.icon === 'none' ? (
            <>
              <label>Colore percorso</label>
              <input type="color" value={vehicle.routeColor} onChange={(e) => updateVehicle({ routeColor: e.target.value })} />
            </>
          ) : (
            <>
              <label>Colore icona</label>
              <input type="color" value={vehicle.color} onChange={(e) => updateVehicle({ color: e.target.value })} />
            </>
          )}
        </div>
      </div>
      {vehicle.icon !== 'none' && (
        <>
          <div className="row">
            <div>
              <label>Stile icona</label>
              <select
                value={vehicle.iconStyle}
                onChange={(e) => updateVehicle({ iconStyle: e.target.value as VehicleIconStyle })}
              >
                <option value="filled">Cerchio pieno + simbolo</option>
                <option value="outline">Solo simbolo (nessun cerchio)</option>
                <option value="dot">Solo punto colorato</option>
              </select>
            </div>
            <div>
              <label>Dimensione icona</label>
              <input
                type="number"
                min={0.2}
                max={2}
                step={0.05}
                value={vehicle.size}
                onChange={(e) => updateVehicle({ size: parseFloat(e.target.value) || 0.55 })}
              />
            </div>
          </div>
          <label>
            <input
              type="checkbox"
              checked={vehicle.use3DAltitude}
              onChange={(e) => updateVehicle({ use3DAltitude: e.target.checked })}
            />
            Icona in quota reale
          </label>
          <label>Esagerazione quota icona</label>
          <input
            type="number"
            min={1}
            max={40}
            step={1}
            value={vehicle.altExaggeration}
            onChange={(e) => updateVehicle({ altExaggeration: parseFloat(e.target.value) || 8 })}
          />
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={vehicle.showLiveStats}
          onChange={(e) => updateVehicle({ showLiveStats: e.target.checked })}
        />
        Mostra dati in tempo reale (velocità/quota/posizione)
      </label>
      {vehicle.showLiveStats && (
        <>
          <label>Dimensione riquadro dati</label>
          <input
            type="number"
            min={0.5}
            max={2}
            step={0.1}
            value={vehicle.liveStatsScale}
            onChange={(e) => updateVehicle({ liveStatsScale: parseFloat(e.target.value) || 1 })}
          />
          <p className="field-hint">
            Trascina il riquadro in anteprima per riposizionarlo. La velocità viene dai timestamp GPX originali
            (indipendente dalla velocità di riproduzione) — "n/d" se il file non ha dati di tempo.
          </p>
        </>
      )}
      {selectedTrack?.isPrimary && (
        <>
          <label>Bandierina "Velocità max" (solo traccia principale)</label>
          <div className="row">
            <div>
              <label>Dimensione bandierina</label>
              <input
                type="number"
                min={0.2}
                max={2}
                step={0.05}
                value={maxSpeedMarker.sizeScale}
                onChange={(e) => updateMaxSpeedMarker({ sizeScale: parseFloat(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label>Esagerazione quota bandierina</label>
              <input
                type="number"
                min={1}
                max={40}
                step={1}
                disabled={!maxSpeedMarker.use3DAltitude}
                value={maxSpeedMarker.altExaggeration}
                onChange={(e) => updateMaxSpeedMarker({ altExaggeration: parseFloat(e.target.value) || 8 })}
              />
            </div>
          </div>
          <label>
            <input
              type="checkbox"
              checked={maxSpeedMarker.use3DAltitude}
              onChange={(e) => updateMaxSpeedMarker({ use3DAltitude: e.target.checked })}
            />
            Bandierina in quota reale
          </label>
          <p className="field-hint">
            {effectiveMaxSpeedPoint
              ? `Punto attuale: ${Math.round(effectiveMaxSpeedPoint.speedKmh)} km/h${
                  selectedTrack.maxSpeedExclusions.length > 0
                    ? ` (${selectedTrack.maxSpeedExclusions.length} punto/i scartato/i)`
                    : ''
                }`
              : 'Nessun punto valido (richiede timestamp GPX, o tutti i candidati sono stati scartati).'}
          </p>
          <div className="row">
            <button
              type="button"
              className="action-btn"
              disabled={!effectiveMaxSpeedPoint}
              onClick={() => discardMaxSpeedPoint(selectedTrack.id)}
            >
              Scarta questo punto / Trova il prossimo
            </button>
            <button
              type="button"
              className="action-btn"
              disabled={selectedTrack.maxSpeedExclusions.length === 0}
              onClick={() => resetMaxSpeedExclusions(selectedTrack.id)}
            >
              Ripristina
            </button>
          </div>
          <div className="row">
            <div>
              <label>Rallentamento: distanza prima (m)</label>
              <input
                type="number"
                min={0}
                max={5000}
                step={10}
                value={maxSpeedMarker.slowdownBeforeM}
                onChange={(e) => updateMaxSpeedMarker({ slowdownBeforeM: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label>Rallentamento: distanza dopo (m)</label>
              <input
                type="number"
                min={0}
                max={5000}
                step={10}
                value={maxSpeedMarker.slowdownAfterM}
                onChange={(e) => updateMaxSpeedMarker({ slowdownAfterM: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <label>Fattore di rallentamento (0..1, es. 0.4 = 40% della velocità normale)</label>
          <input
            type="number"
            min={0.05}
            max={1}
            step={0.05}
            value={maxSpeedMarker.slowdownFactor}
            onChange={(e) => updateMaxSpeedMarker({ slowdownFactor: parseFloat(e.target.value) || 0.4 })}
          />
          <p className="field-hint">
            Il volo rallenta realmente (non un effetto a tempo fisso) intorno al punto di velocità massima, per dare
            il tempo di leggere la bandierina — resta sincronizzato a qualunque velocità di riproduzione.
          </p>
        </>
      )}
    </>
  );
}
