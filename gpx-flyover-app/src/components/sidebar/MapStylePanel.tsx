import { Info } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import type { MapStyleId } from '../../types/domain';

// Port dei controlli stile mappa di gpx-flyover.html:147-155.
export function MapStylePanel() {
  const mapParams = useProjectStore((s) => s.map);
  const updateMap = useProjectStore((s) => s.updateMap);

  return (
    <>
      <label>
        MapTiler API Key{' '}
        <i className="info" title="La tua chiave gratuita, da cloud.maptiler.com → API Keys">
          <Info size={10} />
        </i>
      </label>
      <input
        type="text"
        value={mapParams.maptilerToken}
        onChange={(e) => updateMap({ maptilerToken: e.target.value })}
      />

      <label>Stile mappa</label>
      <select value={mapParams.styleId} onChange={(e) => updateMap({ styleId: e.target.value as MapStyleId })}>
        <option value="hybrid-v4">Satellite Hybrid (satellite + strade)</option>
        <option value="satellite-v2">Satellite Plain (solo satellite)</option>
        <option value="outdoor-v2">Outdoor (topografica)</option>
        <option value="winter-v2">Winter</option>
      </select>

      <label>URL stile personalizzato</label>
      <input
        type="text"
        placeholder="facoltativo: https://api.maptiler.com/maps/.../style.json?key=..."
        value={mapParams.customStyleUrl}
        onChange={(e) => updateMap({ customStyleUrl: e.target.value })}
      />
      <p className="field-hint">Le modifiche qui hanno effetto al prossimo "1. Carica traccia sulla mappa".</p>
    </>
  );
}
