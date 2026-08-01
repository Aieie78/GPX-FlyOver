import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Offusca solo la build di produzione (apply:'build') — il dev server resta leggibile e
    // veloce. debugProtection/selfDefending esclusi apposta: sono le due opzioni note per
    // rompere in modo imprevedibile bundle che includono librerie complesse come maplibre-gl.
    // @ts-expect-error i tipi del pacchetto non sono compatibili con moduleResolution "nodenext"
    // (funziona correttamente a runtime, tramite l'interop CJS/ESM di Vite/esbuild).
    obfuscatorPlugin({
      apply: 'build',
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        numbersToExpressions: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 8,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
      },
    }),
  ],
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
