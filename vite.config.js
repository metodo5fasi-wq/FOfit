import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'pages-admin': [
            './src/pages/AdminPanel.jsx',
            './src/pages/DettaglioCliente.jsx',
            './src/pages/ReportPDF.jsx',
          ],
          'pages-import': [
            './src/pages/ImportaPiano.jsx',
            './src/pages/ImportaAllenamento.jsx',
            './src/pages/ModificaPiano.jsx',
            './src/pages/ModificaAllenamento.jsx',
          ],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
})
