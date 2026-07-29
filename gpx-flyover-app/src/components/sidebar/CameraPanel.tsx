import { useProjectStore } from '../../store/useProjectStore';

// Port dei controlli camera di gpx-flyover.html:125-145.
export function CameraPanel() {
  const camera = useProjectStore((s) => s.camera);
  const updateCamera = useProjectStore((s) => s.updateCamera);

  return (
    <>
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
