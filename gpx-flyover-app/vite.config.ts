import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // La pre-ottimizzazione (esbuild) di Vite ribundle maplibre-gl in un singolo file sotto
    // node_modules/.vite/deps/, rompendo il percorso relativo con cui MapLibre calcola l'URL
    // del proprio worker interno (usato per elaborare le tile vettoriali) — le sorgenti raster
    // continuano a funzionare perché non passano dal worker, quelle vettoriali restano bloccate
    // in silenzio. Escludendo il pacchetto dalla pre-ottimizzazione, Vite lo serve direttamente
    // da node_modules/maplibre-gl/dist/, dove il file del worker si trova davvero accanto.
    exclude: ['maplibre-gl'],
  },
})
