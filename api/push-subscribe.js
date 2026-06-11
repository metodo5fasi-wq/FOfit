module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { subscription, clientId } = req.body
  if (!subscription || !clientId) return res.status(400).json({ error: 'Dati mancanti' })

  const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ client_id: clientId, subscription })
  })

  if (!r.ok) return res.status(500).json({ error: 'Errore salvataggio' })
  return res.status(200).json({ ok: true })
}
