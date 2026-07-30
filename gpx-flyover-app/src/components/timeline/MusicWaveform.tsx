import { useEffect, useRef } from 'react';

interface MusicWaveformProps {
  buffer: AudioBuffer;
  trimStart: number;
  trimEnd: number;
}

const PEAK_BUCKETS = 200;

// Disegna la forma d'onda (picchi min/max per "colonna") della porzione trimStart..trimEnd del
// buffer decodificato, su un canvas a risoluzione logica fissa che si stira via CSS a riempire
// il blocco — evita di dover rimisurare la larghezza reale del blocco (che cambia con lo zoom
// orizzontale della timeline) per ridisegnare.
export function MusicWaveform({ buffer, trimStart, trimEnd }: MusicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const startSample = Math.max(0, Math.floor(trimStart * buffer.sampleRate));
    const endSample = Math.min(data.length, Math.ceil(trimEnd * buffer.sampleRate));
    const totalSamples = endSample - startSample;
    if (totalSamples <= 0) return;

    const samplesPerBucket = Math.max(1, Math.floor(totalSamples / PEAK_BUCKETS));
    const mid = height / 2;

    ctx.fillStyle = 'rgba(8, 6, 13, 0.55)';
    for (let i = 0; i < PEAK_BUCKETS; i++) {
      const bucketStart = startSample + i * samplesPerBucket;
      const bucketEnd = Math.min(endSample, bucketStart + samplesPerBucket);
      if (bucketStart >= bucketEnd) break;
      let min = 1;
      let max = -1;
      for (let j = bucketStart; j < bucketEnd; j++) {
        const v = data[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const x = (i / PEAK_BUCKETS) * width;
      const w = width / PEAK_BUCKETS;
      const yTop = mid - max * mid;
      const yBottom = mid - min * mid;
      ctx.fillRect(x, yTop, Math.max(1, w - 0.5), Math.max(1, yBottom - yTop));
    }
  }, [buffer, trimStart, trimEnd]);

  return <canvas ref={canvasRef} className="lane-block__waveform" width={200} height={32} />;
}
