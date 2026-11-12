import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identificativo di questa pubblicazione: su Vercel è il codice del commit (7 caratteri); altrimenti un valore che cambia a ogni build (così l'avviso funziona comunque).
// Viene scritto dentro l'app (__BUILD_ID__) e in un file pubblico /version.json: l'app confronta i due per sapere se esiste una versione più nuova.
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || Date.now().toString(36)
const BUILD_TIME = new Date().toISOString()
const versionFile = () => ({
  name: 'fofit-version-file',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, time: BUILD_TIME }) }) },
})

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __BUILD_TIME__: JSON.stringify(BUILD_TIME) },
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
})
