import { applyCors, guard, isAdmin, isUuid } from '../server/auth.js'
export default async function handler(req, res) {
  applyCors(req, res, { methods: 'GET, POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = await guard(req, res, { limit: 120 }); if (!auth) return

  const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }

  // GET — messaggi di una conversazione
  if (req.method === 'GET') {
    const { clientId } = req.query
    if (!clientId) return res.status(400).json({ error: 'clientId mancante' })
    if (!isUuid(clientId)) return res.status(400).json({ error: 'clientId non valido' })
    if (!isAdmin(auth) && auth.id !== clientId) return res.status(403).json({ error: 'Operazione non consentita' })      // un cliente vede solo la propria conversazione
    const r = await fetch(`${SUPABASE_URL}/rest/v1/coach_messages?client_id=eq.${clientId}&order=created_at.asc&limit=100`, { headers })
    const data = await r.json()
    return res.status(200).json(data)
  }

  // POST — invia messaggio
  if (req.method === 'POST') {
    const { clientId, message } = req.body || {}
    if (!clientId || !message || !String(message).trim()) return res.status(400).json({ error: 'Dati mancanti' })
    if (!isUuid(clientId)) return res.status(400).json({ error: 'clientId non valido' })
    if (!isAdmin(auth) && auth.id !== clientId) return res.status(403).json({ error: 'Operazione non consentita' })
    // chi scrive lo decide il server in base all'accesso, non chi chiama
    const senderRole = isAdmin(auth) ? 'coach' : 'client', coachId = isAdmin(auth) ? auth.id : null

    const body = {
      client_id: clientId,
      coach_id: coachId || null,
      message: message.trim(),
      sender_role: senderRole,
      is_read: false,
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/coach_messages`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    })
    const data = await r.json()
    if (!r.ok) return res.status(500).json({ error: data })

    // Segna come letti i messaggi dell'altro (quando rispondo li ho visti)
    const markRead = senderRole === 'coach'
      ? `sender_role=eq.client&client_id=eq.${clientId}`
      : `sender_role=eq.coach&client_id=eq.${clientId}`
    await fetch(`${SUPABASE_URL}/rest/v1/coach_messages?${markRead}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ is_read: true })
    })

    return res.status(200).json(data[0])
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
