import { useState } from 'react';
import { CAMERA_PRESETS } from '../../camera/cameraPresets';
import { useProjectStore } from '../../store/useProjectStore';

// Port dei controlli camera di gpx-flyover.html:125-145, con l'aggiunta di preset pronti
// (CAMERA_PRESETS) per partire da un'inquadratura sensata senza tarare i 4 parametri a mano.
export function CameraPanel() {
  const camera = useProjectStore((s) => s.camera);
  const updateCamera = useProjectStore((s) => s.updateCamera);
  // Il nome del preset selezionato è solo un'etichetta della UI (non fa parte dello stato
  // camera): se dopo la scelta si modifica un campo a mano, la select resta comunque com'è
  // finché non se ne sceglie un altro — non c'è un modo affidabile di "far tornare indietro"
  // la label a "nessun preset" senza confrontare i 4 valori uno per uno.
  const [selectedPreset, setSelectedPreset] = useState('');

  return (
    <>
      <label>Preset</label>
      <select
        value={selectedPreset}
        onChange={(e) => {
          const preset = CAMERA_PRESETS.find((p) => p.name === e.target.value);
          if (preset) {
            updateCamera(preset.params);
            setSelectedPreset(preset.name);
          }
        }}
      >
        <option value="" disabled>
          Scegli un preset...
        </option>
        {CAMERA_PRESETS.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="row">
        <div>
          <label>Pitch (°)</label>
          <input
            type="number"
            min={0}
            max={85}
            value={camera.pitch}
            onChange={(e) => updateCamera({ pitch: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label>Zoom</label>
          <input
            type="number"
            min={8}
            max={18}
            step={0.1}
            value={camera.zoom}
            onChange={(e) => updateCamera({ zoom: parseFloat(e.target.value) || 12.5 })}
          />
        </div>
      </div>
      <div className="row">
        <div>
          <label>Ampiezza rotazione (°)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={camera.orbitAmp}
            onChange={(e) => updateCamera({ orbitAmp: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label>Periodo rotazione (s)</label>
          <input
            type="number"
            min={4}
            max={60}
            value={camera.orbitPeriod}
            onChange={(e) => updateCamera({ orbitPeriod: parseFloat(e.target.value) || 14 })}
          />
        </div>
      </div>
    </>
  );
}
