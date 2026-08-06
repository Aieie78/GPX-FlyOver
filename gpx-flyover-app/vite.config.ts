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
    // controlFlowFlattening/deadCodeInjection esclusi per lo stesso motivo: la loro
    // randomizzazione interna genera, circa 1 build su 6, codice che usa `arguments` dentro un
    // inizializzatore di campo di classe — sintassi che il bundler (Rolldown) rifiuta
    // ("'arguments' is not allowed in class field initializer"), con build fallita in modo non
    // riproducibile (non dipende dal codice sorgente, solo dal seed casuale di quella build). Per
    // uno strumento a uso personale la protezione restante (rinominazione identificatori,
    // string array, ecc.) è più che sufficiente: non vale la pena tenere un rischio di build
    // rotta per un'offuscazione che qui serve a poco.
    // @ts-expect-error i tipi del pacchetto non sono compatibili con moduleResolution "nodenext"
    // (funziona correttamente a runtime, tramite l'interop CJS/ESM di Vite/esbuild).
    obfuscatorPlugin({
      apply: 'build',
      options: {
        compact: true,
        controlFlowFlattening: false,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: false,
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
