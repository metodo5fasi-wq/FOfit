import React from 'react'
import ReactDOM from 'react-dom/client'
import './fonts.css'
import './icons.css'
import './ui.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Uso offline: dopo il caricamento si chiede al service worker di salvare i file dell'app in uso
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const urls = performance.getEntriesByType('resource').map(r => r.name)
        const target = reg.active || navigator.serviceWorker.controller
        if (target) target.postMessage({ type: 'CACHE_URLS', urls })
      } catch {}
    }, 2500)
  })
}
