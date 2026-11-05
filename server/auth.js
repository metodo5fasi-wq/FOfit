// ─────────────────────────────────────────────────────────────
// Controllo comune dei servizi (cartella api/). Sta FUORI da api/ per non contare come funzione (limite 12 di Vercel).
//  • verifica chi chiama (token di accesso di Supabase) e il suo ruolo (coach = admin, oppure cliente)
//  • limite di richieste al minuto per utente (protegge i crediti AI)
//  • CORS: solo il sito (prima era aperto a tutti)
//  • controllo degli identificativi (uuid) prima di usarli in una richiesta al database
// Se manca la chiave di servizio il controllo FALLISCE (chiuso), non si apre.
// ─────────────────────────────────────────────────────────────
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
const ALLOWED = ['https://fofit.fit', 'https://www.fofit.fit', 'http://localhost:3000', 'http://localhost:5173']
export const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''))
export const isAdmin = a => a?.role === 'admin'

export function applyCors(req, res, { methods = 'POST, OPTIONS' } = {}) {
  const o = req.headers?.origin
  const extra = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (o && [...ALLOWED, ...extra].includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin') }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const cache = new Map()      // token → { value, exp }  (60 secondi: evita 2 richieste a Supabase a ogni chiamata)
export function _resetForTests() { cache.clear(); hits.clear() }

export async function authenticate(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  const m = String(h).match(/^Bearer\s+(\S+)$/i); if (!m) return null
  const token = m[1], hit = cache.get(token); if (hit && hit.exp > Date.now()) return hit.value
  const key = process.env.SUPABASE_SERVICE_KEY; if (!key) return null
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
  if (!u.ok) return null
  const user = await u.json(); if (!isUuid(user?.id)) return null
  const p = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const rows = p.ok ? await p.json() : []
  const value = { id: user.id, role: rows?.[0]?.role || 'client', email: user.email || null }
  if (cache.size > 500) cache.clear(); cache.set(token, { value, exp: Date.now() + 60000 })
  return value
}

const hits = new Map()       // id → [istanti delle richieste]
export function rateLimited(id, limit, windowMs = 60000) {
  const now = Date.now(), arr = (hits.get(id) || []).filter(t => now - t < windowMs)
  if (arr.length >= limit) { hits.set(id, arr); return true }
  arr.push(now); hits.set(id, arr); if (hits.size > 2000) hits.clear(); return false
}

// Controllo d'ingresso: restituisce { id, role } oppure ha già risposto 401 / 403 / 429 / 500 e restituisce null
export async function guard(req, res, { roles = null, limit = 60 } = {}) {
  if (!process.env.SUPABASE_SERVICE_KEY) { res.status(500).json({ error: 'Configurazione del server mancante' }); return null }
  let auth = null
  try { auth = await authenticate(req) } catch { auth = null }
  if (!auth) { res.status(401).json({ error: 'Accesso richiesto: effettua di nuovo il login' }); return null }
  if (roles && !roles.includes(auth.role)) { res.status(403).json({ error: 'Operazione non consentita' }); return null }
  if (rateLimited(auth.id, limit)) { res.status(429).json({ error: 'Troppe richieste: riprova tra un minuto' }); return null }
  return auth
}
// Ruolo di un altro utente (serve a decidere a chi un cliente può scrivere)
export async function roleOf(id) {
  if (!isUuid(id)) return null
  const key = process.env.SUPABASE_SERVICE_KEY
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=role`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const rows = r.ok ? await r.json() : []; return rows?.[0]?.role || null
}
