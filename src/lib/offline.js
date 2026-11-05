// ─────────────────────────────────────────────────────────────
// FOfit — uso offline
//  • coda delle scritture ("outbox"): ogni serie/peso/nota/fine seduta si salva subito sul telefono
//    e viene inviata appena c'è rete. Gli id delle righe sono generati qui (uuid) e l'invio usa
//    upsert/update/delete: se un invio viene ripetuto non nascono duplicati.
//  • cache di lettura: l'ultima copia dei dati (scheda, esercizi, storico) per aprirli senza rete.
//  • sessione offline: senza rete l'app non può ricontrollare il profilo, quindi usa l'ultimo salvato.
// ─────────────────────────────────────────────────────────────

const OUTBOX_KEY = 'fofit_outbox_v1'
const FAILED_KEY = 'fofit_outbox_failed_v1'
const CACHE_PREFIX = 'fofit_cache_v1:'
const LAST_PROFILE_KEY = 'fofit_last_profile_v1'
const MAX_ATTEMPTS = 5

export function uuid() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID() } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16) })
}
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

// Errore di rete (e non un rifiuto del server): in questo caso si riprova più tardi
export function isNetworkError(err) {
  if (!err) return false
  if (!isOnline()) return true
  const m = String(err.message || err)
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|econnreset|enotfound|offline/i.test(m) || err.status === 0
}

// ── storage sicuro ───────────────────────────────────────────
const read = (k, fb = []) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb } catch { return fb } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } }

// ── cache di lettura ─────────────────────────────────────────
export function cacheSet(userId, name, value) { return write(`${CACHE_PREFIX}${userId}:${name}`, { t: Date.now(), v: value }) }
export function cacheGet(userId, name) { const r = read(`${CACHE_PREFIX}${userId}:${name}`, null); return r ? r.v : null }
export function clearCache() {
  try { Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX) || k === LAST_PROFILE_KEY).forEach(k => localStorage.removeItem(k)) } catch {}
}
// Esegue una lettura: se funziona ne salva una copia, se manca la rete restituisce l'ultima copia.
// fetcher → { data, error }.   Risultato → { data, fromCache, error? }
export async function loadWithCache(userId, name, fetcher, { cacheMap } = {}) {
  try {
    const r = await fetcher()
    if (!r?.error) { cacheSet(userId, name, cacheMap ? cacheMap(r.data) : r.data); return { data: r.data, fromCache: false } }
    if (isNetworkError(r.error)) { const c = cacheGet(userId, name); if (c !== null) return { data: c, fromCache: true } }
    return { data: r.data ?? null, fromCache: false, error: r.error }
  } catch (e) {
    const c = cacheGet(userId, name)
    return c !== null ? { data: c, fromCache: true } : { data: null, fromCache: false, error: e }
  }
}

// ── sessione offline ─────────────────────────────────────────
export const saveLastProfile = p => { if (p?.id) write(LAST_PROFILE_KEY, p) }
export const loadLastProfile = () => read(LAST_PROFILE_KEY, null)
export function hasStoredAuthToken() {
  try { for (let i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true } catch {}
  return false
}
// Senza rete getSession() può restituire "nessuna sessione": se c'è un accesso salvato su questo telefono si continua con l'ultimo profilo
export function resolveOfflineSession({ session, error, cachedProfile }) {
  if (session) return session
  if (!cachedProfile?.id || !hasStoredAuthToken()) return null
  return (!isOnline() || isNetworkError(error)) ? { user: { id: cachedProfile.id }, offline: true } : null
}

// ── coda delle scritture ─────────────────────────────────────
const listeners = new Set()
let lastSync = { at: 0, count: 0 }
let flushing = null, rerun = false, ctx = null, timer = null, inflight = null   // inflight = operazione in questo momento in viaggio verso il server
const notify = () => listeners.forEach(f => { try { f(snapshot()) } catch {} })
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export const getQueue = userId => read(OUTBOX_KEY).filter(o => !userId || o.userId === userId)
export const pendingCount = userId => getQueue(userId).length
export const failedCount = userId => read(FAILED_KEY).filter(o => !userId || o.userId === userId).length
export const snapshot = () => ({ pending: pendingCount(ctx?.userId), failed: failedCount(ctx?.userId), syncing: !!flushing, lastSync })
export const clearFailed = userId => { write(FAILED_KEY, read(FAILED_KEY).filter(o => userId && o.userId !== userId)); notify() }

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const rowKeyMatch = (r, op) => {
  const keys = op.onConflict && op.onConflict !== 'id' ? op.onConflict.split(',').map(s => s.trim()) : ['id']
  return keys.every(k => r[k] !== undefined && r[k] === op.row[k])
}

// kind: 'upsert' {row, onConflict?} · 'update' {rowId | match, patch} · 'delete' {rowId}
export function enqueue(op) {
  let q = read(OUTBOX_KEY)
  const mine = o => o.userId === op.userId && o.table === op.table && o.id !== inflight   // un'operazione già in viaggio non si modifica: si accoda dopo
  if (op.kind === 'upsert') {
    const i = q.findIndex(o => mine(o) && o.kind === 'upsert' && (o.onConflict || 'id') === (op.onConflict || 'id') && rowKeyMatch(o.row, op))
    if (i >= 0) q[i] = { ...q[i], row: { ...q[i].row, ...op.row } }
    else q.push({ id: uuid(), attempts: 0, createdAt: Date.now(), ...op })
  } else if (op.kind === 'update') {
    const up = op.rowId ? q.findIndex(o => mine(o) && o.kind === 'upsert' && o.row.id === op.rowId) : -1
    if (up >= 0) q[up] = { ...q[up], row: { ...q[up].row, ...op.patch } }                       // la riga non è ancora partita: si aggiorna lì
    else {
      const i = q.findIndex(o => mine(o) && o.kind === 'update' && (op.rowId ? o.rowId === op.rowId : same(o.match, op.match)))
      if (i >= 0) q[i] = { ...q[i], patch: { ...q[i].patch, ...op.patch } }
      else q.push({ id: uuid(), attempts: 0, createdAt: Date.now(), ...op })
    }
  } else if (op.kind === 'delete') {
    // cancella ciò che era in coda per quella riga; la delete parte comunque (non fa danni se la riga non esiste)
    q = q.filter(o => !(mine(o) && ((o.kind === 'upsert' && o.row.id === op.rowId) || (o.kind === 'update' && o.rowId === op.rowId) || (o.kind === 'delete' && o.rowId === op.rowId))))
    q.push({ id: uuid(), attempts: 0, createdAt: Date.now(), ...op })
  }
  write(OUTBOX_KEY, q); notify(); kick()
}

async function run(supabase, op) {
  try {
    if (op.kind === 'upsert') return await supabase.from(op.table).upsert(op.row, { onConflict: op.onConflict || 'id' })
    if (op.kind === 'update') {
      let q = supabase.from(op.table).update(op.patch)
      if (op.rowId) q = q.eq('id', op.rowId); else for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v)
      return await q
    }
    if (op.kind === 'delete') return await supabase.from(op.table).delete().eq('id', op.rowId)
    return { error: { message: 'operazione sconosciuta' } }
  } catch (e) { return { error: e } }
}

// Invia la coda, in ordine. Ferma tutto se manca la rete; se il server rifiuta un'operazione ci riprova (max 5 volte) e poi la mette da parte.
export function flush(supabase, userId) {
  if (flushing) { rerun = true; return flushing }
  const uid = userId ?? ctx?.userId, sb = supabase ?? ctx?.supabase
  if (!sb || !isOnline()) return Promise.resolve({ sent: 0, network: !isOnline() })
  flushing = (async () => {
    const res = { sent: 0, failed: 0, network: false }
    notify()
    const seen = new Set()
    do {
      rerun = false
      for (const op of getQueue(uid)) {
        seen.add(op.id)
        inflight = op.id
        const { error } = await run(sb, op)
        inflight = null
        if (!error) { write(OUTBOX_KEY, read(OUTBOX_KEY).filter(o => o.id !== op.id)); res.sent++; notify(); continue }
        if (isNetworkError(error)) { res.network = true; break }
        const all = read(OUTBOX_KEY), i = all.findIndex(o => o.id === op.id)
        if (i >= 0) {
          all[i].attempts = (all[i].attempts || 0) + 1; all[i].lastError = String(error.message || error).slice(0, 160)
          if (all[i].attempts >= MAX_ATTEMPTS) { write(FAILED_KEY, [...read(FAILED_KEY), all[i]]); all.splice(i, 1); res.failed++ }
          write(OUTBOX_KEY, all)
        }
      }
      if (res.network) break
      if (getQueue(uid).some(o => !seen.has(o.id))) rerun = true       // qualcosa è stato aggiunto mentre si inviava: un altro giro
    } while (rerun)
    if (res.sent) lastSync = { at: Date.now(), count: res.sent }
    return res
  })().finally(() => { flushing = null; notify() })
  return flushing
}
const kick = () => { if (ctx && isOnline()) flush(ctx.supabase, ctx.userId).catch(() => {}) }

// Avvia l'invio automatico: all'avvio, quando torna la rete e ogni 20 secondi finché c'è qualcosa in coda
export function startAutoSync(supabase, userId) {
  ctx = { supabase, userId }
  const tick = () => { if (isOnline() && pendingCount(userId) > 0) flush(supabase, userId).catch(() => {}) }
  const onOnline = () => setTimeout(tick, 300)
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)
  timer = setInterval(tick, 20000); tick(); notify()
  return () => { if (typeof window !== 'undefined') window.removeEventListener('online', onOnline); clearInterval(timer); ctx = null }
}
export const configureSync = (supabase, userId) => { ctx = { supabase, userId } }

// Sovrappone alle righe lette dal server ciò che è ancora in coda (così lo schermo mostra anche le modifiche non inviate)
export function applyPending(rows, table, userId) {
  let out = [...(rows || [])]
  for (const op of getQueue(userId)) {
    if (op.table !== table) continue
    if (op.kind === 'upsert') { const i = out.findIndex(r => rowKeyMatch(r, op)); if (i >= 0) out[i] = { ...out[i], ...op.row }; else out.push({ ...op.row }) }
    else if (op.kind === 'update') out = out.map(r => (op.rowId ? r.id === op.rowId : Object.entries(op.match || {}).every(([k, v]) => r[k] === v)) ? { ...r, ...op.patch } : r)
    else if (op.kind === 'delete') out = out.filter(r => r.id !== op.rowId)
  }
  return out
}
