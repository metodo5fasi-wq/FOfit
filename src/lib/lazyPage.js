import { lazy } from 'react'

// Pagina caricata solo quando serve. Se il file non si scarica:
//  • connessione presente (tipico dopo un aggiornamento dell'app: il file vecchio non esiste più) → si ricarica la pagina UNA volta
//  • senza connessione → si lancia l'errore, che il contenitore (RouteBoundary) mostra con un messaggio chiaro
const KEY = 'fofit_chunk_reloaded'
export function lazyPage(factory) {
  return lazy(() => factory()
    .then(m => { try { sessionStorage.removeItem(KEY) } catch {} return m })
    .catch(err => {
      let already = false
      try { already = sessionStorage.getItem(KEY) === '1'; if (!already) sessionStorage.setItem(KEY, '1') } catch {}
      if (!already && navigator.onLine !== false) { window.location.reload(); return new Promise(() => {}) }
      throw err
    }))
}
