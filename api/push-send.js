const crypto = require('crypto')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { clientId, title, body, url } = req.body
  const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?client_id=eq.${clientId}&select=subscription`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    })
    const data = await r.json()
    if (!data?.[0]?.subscription) return res.status(404).json({ error: 'Nessuna subscription' })

    const sub = data[0].subscription
    const endpoint = sub.endpoint

    // JWT VAPID semplificato
    const VAPID_PUBLIC = 'BCyIyhswxeYVJJgH1IBaImpqeu37T0u2fl-7OsfLLXGhq21I4VV_X9mINLoNR7U_7OX3bTa3JCH49-HAE1YA7NM'
    const VAPID_PRIVATE = '353afIwHJShRhZtj4qDMVlUqLyKRBXDp4PqGfnfs-j8'
    const audience = new URL(endpoint).origin
    const now = Math.floor(Date.now() / 1000)

    function b64url(buf) {
      return Buffer.from(buf).toString('base64url')
    }

    const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    const payload = b64url(JSON.stringify({ aud: audience, exp: now + 43200, sub: 'mailto:federico@fofit.fit' }))
    const unsigned = `${header}.${payload}`

    const privBuf = Buffer.from(VAPID_PRIVATE, 'base64url')
    const privKey = crypto.createPrivateKey({
      key: privBuf,
      format: 'der',
      type: 'pkcs8',
    })

    // Usa sign diretto con EC key
    const sign = crypto.createSign('SHA256')
    sign.update(unsigned)
    const der = sign.sign(privKey)
    const token = `${unsigned}.${b64url(der)}`
    const authorization = `vapid t=${token},k=${VAPID_PUBLIC}`

    const pushRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'text/plain;charset=UTF-8',
        'TTL': '86400',
      },
      body: JSON.stringify({ title, body, url: url || '/' }),
    })

    if (!pushRes.ok) {
      const err = await pushRes.text()
      return res.status(500).json({ error: err })
    }
    return res.status(200).json({ ok: true })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
