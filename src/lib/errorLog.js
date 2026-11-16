// ─────────────────────────────────────────────────────────────
// Registro errori: quando in un'app (del cliente o del coach) qualcosa si rompe, l'errore viene scritto nella tabella app_errors
// di Supabase e il coach lo vede nella pagina «Errori dell'app». Così si scoprono i problemi PRIMA che i clienti li segnalino.
// Regole: non deve MAI dare fastidio — nessuna eccezione, nessuna richiesta infinita, pochi invii per sessione, nulla di personale
// (solo messaggio, punto del codice, pagina senza parametri, tipo di browser).
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase'

export const LIMITS = { perSession: 20, dedupeMs: 5 * 60 * 1000, maxFailures: 3 }
const state = { sent: 0, failures: 0, seen: new Map(), disabled: false }
export const _reset = () => { state.sent = 0; state.failures = 0; state.seen = new Map(); state.disabled = false }

// Errori che non sono bug dell'app (rete assente, notifiche del browser): non vanno registrati
const NOISE = /ResizeObserver loop|^Script error\.?$|failed to fetch|networkerror|network request failed|load failed|fetch failed|ERR_INTERNET_DISCONNECTED|AbortError|The user aborted|Non-Error promise rejection|dynamically imported module|Importing a module script|Loading chunk|ChunkLoadError/i

const clip = (v, n) => String(v ?? '').slice(0, n)
const pathOnly = () => { try { return clip(window.location.pathname, 200) } catch { return '' } }
const version = () => { try { return typeof __BUILD_ID__ !== 'undefined' ? clip(__BUILD_ID__, 20) : '' } catch { return '' } }

export function describe(err) {
  if (err == null) return { message: '', stack: '' }
  if (typeof err === 'string') return { message: err, stack: '' }
  return { message: String(err.message || err), stack: String(err.stack || '') }
}

// Registra un errore. Restituisce true se è stato inviato. Non lancia mai.
export async function logError(err, source = 'app') {
  try {
    if (state.disabled || state.sent >= LIMITS.perSession) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
    const { message, stack } = describe(err)
    if (!message.trim() || NOISE.test(message)) return false
    const key = clip(message, 160), now = Date.now(), last = state.seen.get(key)
    if (last && now - last < LIMITS.dedupeMs) return false          // lo stesso errore ripetuto non si manda cento volte
    state.seen.set(key, now); state.sent++
    const { error } = await supabase.from('app_errors').insert({
      source: clip(source, 20), message: clip(message, 500), stack: clip(stack, 2500), url: pathOnly(),
      user_agent: clip(typeof navigator !== 'undefined' ? navigator.userAgent : '', 200), app_version: version(),
    })
    if (error) { if (++state.failures >= LIMITS.maxFailures || /app_errors|relation|schema|does not exist/i.test(error.message || '')) state.disabled = true; return false }
    return true
  } catch { state.failures++; if (state.failures >= LIMITS.maxFailures) state.disabled = true; return false }
}

let installed = false
// Da chiamare una volta all'avvio: intercetta gli errori non gestiti
export function installErrorLog() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', e => { if (e?.error || e?.message) logError(e.error || e.message, 'window') })
  window.addEventListener('unhandledrejection', e => { logError(e?.reason, 'promise') })
}

// Raggruppa le righe per messaggio (per la pagina del coach): quante volte, a quanti utenti, ultima volta e dove
export function groupErrors(rows = []) {
  const map = new Map()
  for (const r of rows) {
    const k = String(r.message || '').slice(0, 160), g = map.get(k) || { key: k, message: r.message, count: 0, users: new Set(), ids: [], first: r.created_at, last: r.created_at, url: r.url, version: r.app_version, source: r.source, stack: r.stack, ua: r.user_agent, resolved: true }
    g.count++; g.ids.push(r.id); if (r.user_id) g.users.add(r.user_id)
    if (r.created_at > g.last) { g.last = r.created_at; g.url = r.url; g.version = r.app_version; g.stack = r.stack || g.stack; g.ua = r.user_agent }
    if (r.created_at < g.first) g.first = r.created_at
    if (!r.resolved) g.resolved = false
    map.set(k, g)
  }
  return [...map.values()].map(g => ({ ...g, users: g.users.size })).sort((a, b) => (a.resolved - b.resolved) || (a.last < b.last ? 1 : -1))
}
