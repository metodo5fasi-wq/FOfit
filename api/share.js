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

  // POST — crea un token di condivisione
  if (req.method === 'POST') {
    const { clientId, shareType, sessionId, periodStart, periodEnd } = req.body
    if (!clientId || !shareType) return res.status(400).json({ error: 'Dati mancanti' })

    const body = {
      client_id: clientId,
      share_type: shareType,
      session_id: sessionId || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/share_tokens`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    })
    const data = await r.json()
    if (!r.ok) return res.status(500).json({ error: data })
    return res.status(200).json({ token: data[0].token })
  }

  // GET — leggi i dati per un token
  if (req.method === 'GET') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token mancante' })

    // Trova il token
    const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/share_tokens?token=eq.${token}&select=*`, { headers })
    const tokenData = await tokenRes.json()
    if (!tokenData?.length) return res.status(404).json({ error: 'Link non trovato o scaduto' })

    const t = tokenData[0]
    if (new Date(t.expires_at) < new Date()) return res.status(410).json({ error: 'Link scaduto' })

    // Profilo cliente
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${t.client_id}&select=full_name,goal`, { headers })
    const profData = await profRes.json()
    const profile = profData?.[0] || {}

    if (t.share_type === 'session' && t.session_id) {
      // Dati sessione singola
      const sessRes = await fetch(`${SUPABASE_URL}/rest/v1/workout_sessions?id=eq.${t.session_id}&select=*`, { headers })
      const sessData = await sessRes.json()
      const session = sessData?.[0]

      // Log esercizi della sessione
      const logsRes = await fetch(`${SUPABASE_URL}/rest/v1/workout_logs?client_id=eq.${t.client_id}&log_date=eq.${session?.session_date}&select=*&order=exercise_name.asc,set_number.asc`, { headers })
      const logs = await logsRes.json()

      return res.status(200).json({ type: 'session', profile, session, logs: logs || [] })
    }

    if (t.share_type === 'period') {
      // Sessioni nel periodo
      const sessRes = await fetch(`${SUPABASE_URL}/rest/v1/workout_sessions?client_id=eq.${t.client_id}&session_date=gte.${t.period_start}&session_date=lte.${t.period_end}&select=*&order=session_date.asc`, { headers })
      const sessions = await sessRes.json()

      // Log del periodo
      const logsRes = await fetch(`${SUPABASE_URL}/rest/v1/workout_logs?client_id=eq.${t.client_id}&log_date=gte.${t.period_start}&log_date=lte.${t.period_end}&select=*`, { headers })
      const logs = await logsRes.json()

      return res.status(200).json({ type: 'period', profile, sessions: sessions || [], logs: logs || [], period: { start: t.period_start, end: t.period_end } })
    }

    return res.status(400).json({ error: 'Tipo non valido' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
