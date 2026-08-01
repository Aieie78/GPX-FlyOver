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
    </>
  );
}
