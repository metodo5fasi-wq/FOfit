export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }

  // GET — leggi messaggi di una conversazione
  if (req.method === 'GET') {
    const { clientId } = req.query
    if (!clientId) return res.status(400).json({ error: 'clientId mancante' })

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/coach_messages?client_id=eq.${clientId}&select=*&order=created_at.asc`,
      { headers }
    )
    const data = await r.json()
    return res.status(200).json({ messages: data || [] })
  }

  // POST — invia messaggio
  if (req.method === 'POST') {
    const { clientId, message, senderRole } = req.body
    if (!clientId || !message) return res.status(400).json({ error: 'Dati mancanti' })

    const r = await fetch(`${SUPABASE_URL}/rest/v1/coach_messages`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        client_id: clientId,
        message: message.trim(),
        sender_role: senderRole || 'coach',
        is_read: false,
      })
    })
    const data = await r.json()
    if (!r.ok) return res.status(500).json({ error: data })
    return res.status(200).json({ message: data[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
