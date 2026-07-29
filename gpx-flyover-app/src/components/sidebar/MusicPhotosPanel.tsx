import type { ChangeEvent } from 'react';
import { decodeMusicFile } from '../../audio/musicEngine';
import { buildPhotoClipAppended } from '../../photos/photoEngine';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

// Port dei controlli musica/foto di gpx-flyover.html:193-201. Le liste con drag/trim vivono
// nella Timeline sotto la mappa (gpx-flyover.html:867-1189), qui solo upload e default.
export function MusicPhotosPanel() {
  const musicVolume = useProjectStore((s) => s.musicVolume);
  const setMusicVolume = useProjectStore((s) => s.setMusicVolume);
  const addMusicTrack = useProjectStore((s) => s.addMusicTrack);
  const photoDefaultDuration = useProjectStore((s) => s.photoDefaultDuration);
  const setPhotoDefaultDuration = useProjectStore((s) => s.setPhotoDefaultDuration);
  const addPhotoClip = useProjectStore((s) => s.addPhotoClip);
  const setStatusMessage = usePlaybackStore((s) => s.setStatusMessage);

  const handleMusicFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    for (const file of files) {
      try {
        const totalDur = useProjectStore.getState().video.durationSec;
        const track = await decodeMusicFile(file, useProjectStore.getState().musicTracks, totalDur, musicVolume);
        addMusicTrack(track);
      } catch (err) {
        console.error('Errore decodifica audio', file.name, err);
        setStatusMessage(`Impossibile leggere il file audio "${file.name}" — formato non supportato?`);
      }
    }
    e.target.value = '';
  };

  const handlePhotoFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    for (const file of files) {
      try {
        const clip = await buildPhotoClipAppended(file, useProjectStore.getState().photoClips, photoDefaultDuration);
        addPhotoClip(clip);
      } catch (err) {
        console.error('Errore caricamento immagine', file.name, err);
        setStatusMessage(`Impossibile leggere l'immagine "${file.name}".`);
      }
    }
    e.target.value = '';
  };

  return (
    <>
      <label>Musica di sottofondo (uno o più brani)</label>
      <input type="file" accept="audio/*" multiple onChange={handleMusicFiles} />
      <label>Volume musica</label>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(musicVolume * 100)}
        onChange={(e) => setMusicVolume(parseInt(e.target.value, 10) / 100)}
      />

      <label>Foto nella timeline (opzionale)</label>
      <input type="file" accept="image/*" multiple onChange={handlePhotoFiles} />
      <label>Durata visualizzazione foto (default, sec)</label>
      <input
        type="number"
        min={0.5}
        max={15}
        step={0.5}
        value={photoDefaultDuration}
        onChange={(e) => setPhotoDefaultDuration(parseFloat(e.target.value) || 3)}
      />
      <p className="field-hint">Trascina i blocchi nella timeline qui sotto per posizionarli e tagliarli.</p>
    </>
  );
}
