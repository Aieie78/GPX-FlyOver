import { useProjectStore } from '../../store/useProjectStore';
import type { VehicleIcon, VehicleIconStyle } from '../../types/domain';

// Port dei controlli icona mezzo di gpx-flyover.html:160-191.
export function VehiclePanel() {
  const vehicle = useProjectStore((s) => s.vehicle);
  const updateVehicle = useProjectStore((s) => s.updateVehicle);

  return (
    <>
      <div className="row">
        <div>
          <label>Icona mezzo</label>
          <select value={vehicle.icon} onChange={(e) => updateVehicle({ icon: e.target.value as VehicleIcon })}>
            <option value="🏍️">Moto 🏍️</option>
            <option value="🚗">Macchina 🚗</option>
            <option value="🚁">Elicottero 🚁</option>
            <option value="✈️">Aereo ✈️</option>
            <option value="🚢">Nave 🚢</option>
          </select>
        </div>
        <div>
          <label>Colore icona</label>
          <input type="color" value={vehicle.color} onChange={(e) => updateVehicle({ color: e.target.value })} />
        </div>
      </div>
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
      <label>
        <input
          type="checkbox"
          checked={vehicle.showLiveStats}
          onChange={(e) => updateVehicle({ showLiveStats: e.target.checked })}
        />
        Mostra dati in tempo reale (velocità/quota/posizione)
      </label>
      {vehicle.showLiveStats && (
        <p className="field-hint">
          La velocità viene dai timestamp GPX originali (indipendente dalla velocità di riproduzione) — "n/d" se il
          file non ha dati di tempo.
        </p>
      )}
    </>
  );
}
