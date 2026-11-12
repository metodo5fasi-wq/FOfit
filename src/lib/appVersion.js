// ─────────────────────────────────────────────────────────────
// Versione dell'app: quella che sta girando sul telefono e quella pubblicata.
// Se sono diverse, l'app lo dice e offre "Aggiorna" (su iPhone un'app aperta può restare in memoria per giorni senza ricaricarsi).
// ─────────────────────────────────────────────────────────────
// 'dev' = server di sviluppo o prove: lì non si confronta nulla
export const RUNNING_BUILD = (typeof __BUILD_ID__ !== 'undefined' && !(import.meta.env && import.meta.env.DEV)) ? __BUILD_ID__ : 'dev'
export const RUNNING_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''

// L'ultima versione pubblicata, oppure null se non si riesce a leggerla (niente rete, file assente…): in quel caso non si dice nulla
export async function fetchLatestBuild(fetchFn = (...a) => fetch(...a)) {
  try {
    const r = await fetchFn('/version.json?t=' + Date.now(), { cache: 'no-store' })
    if (!r || !r.ok) return null
    const j = await r.json()
    return j && typeof j.id === 'string' && j.id ? j : null
  } catch { return null }
}
export const isDevBuild = id => !id || id === 'dev'
export const isUpdateAvailable = (running, latest) => !!latest && !isDevBuild(running) && !isDevBuild(latest.id) && latest.id !== running

// Toglie le copie salvate dell'app e la ricarica. Le serie e le bozze non salvate stanno nella memoria del telefono (non nelle copie): restano.
export async function applyUpdate({ reload = () => window.location.reload() } = {}) {
  try { const regs = await navigator.serviceWorker?.getRegistrations?.(); for (const r of regs || []) await r.unregister() } catch {}
  try { const keys = await window.caches?.keys?.(); for (const k of keys || []) await window.caches.delete(k) } catch {}
  reload()
}
