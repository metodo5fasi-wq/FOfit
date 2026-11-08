import { useEffect, useRef } from 'react'

// Quando si torna all'app dopo averla lasciata in secondo piano per un po' (cambio app, schermo spento), si rileggono i dati:
// una notifica nuova del coach, un piano aggiornato… compaiono senza dover chiudere e riaprire l'app.
// Solo se è passato almeno minMs (default 1 minuto): tornare dopo pochi secondi non fa nulla.
export function useRefreshOnReturn(fn, minMs = 60000) {
  const ref = useRef(fn); ref.current = fn
  useEffect(() => {
    let hiddenAt = null
    const back = () => { if (hiddenAt && Date.now() - hiddenAt >= minMs) { hiddenAt = null; try { ref.current() } catch {} } else hiddenAt = null }
    const onVis = () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else back() }
    const onShow = e => { if (e.persisted) back() }
    document.addEventListener('visibilitychange', onVis); window.addEventListener('pageshow', onShow)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pageshow', onShow) }
  }, [minMs])
}
