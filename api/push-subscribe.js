import { applyCors, guard, isAdmin, isUuid } from '../server/auth.js'
export default async function handler(req, res) {
  applyCors(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = await guard(req, res, { limit: 30 }); if (!auth) return
  const { subscription, clientId } = req.body || {}
  if (!isUuid(clientId) || (!isAdmin(auth) && auth.id !== clientId)) return res.status(403).json({ error: 'Operazione non consentita' })
  if (!subscription || !clientId) return res.status(400).json({ error: 'Dati mancanti' })

  const r = await fetch('https://hdgiwrwcxfbojqfeyrxn.supabase.co/rest/v1/push_subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ client_id: clientId, subscription })
  })

  if (!r.ok) return res.status(500).json({ error: 'Errore salvataggio' })
  return res.status(200).json({ ok: true })
}
