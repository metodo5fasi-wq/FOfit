export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { clientId, title, body, url } = req.body
  const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?client_id=eq.${clientId}&select=subscription`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const data = await r.json()
  if (!data?.[0]?.subscription) return res.status(404).json({ error: 'Nessuna subscription' })

  const sub = data[0].subscription
  const endpoint = sub.endpoint
  const audience = new URL(endpoint).origin

  try {
    // VAPID senza librerie esterne - solo crypto nativo
    const VAPID_PUBLIC = 'BCyIyhswxeYVJJgH1IBaImpqeu37T0u2fl-7OsfLLXGhq21I4VV_X9mINLoNR7U_7OX3bTa3JCH49-HAE1YA7NM'
    const VAPID_PRIVATE = '353afIwHJShRhZtj4qDMVlUqLyKRBXDp4PqGfnfs-j8'

    function b64url(buf) {
      return Buffer.from(buf).toString('base64')
        .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
    }
    function b64dec(str) {
      const p = str.length%4; const s = str+(p?'='.repeat(4-p):'')
      return Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')
    }

    const header = b64url(JSON.stringify({typ:'JWT',alg:'ES256'}))
    const now = Math.floor(Date.now()/1000)
    const payload = b64url(JSON.stringify({aud:audience,exp:now+43200,sub:'mailto:federico@fofit.fit'}))
    const unsigned = `${header}.${payload}`

    const { subtle } = globalThis.crypto
    const privKey = await subtle.importKey('raw', b64dec(VAPID_PRIVATE),
      {name:'ECDSA',namedCurve:'P-256'}, false, ['sign'])
    const sig = await subtle.sign({name:'ECDSA',hash:'SHA-256'}, privKey, Buffer.from(unsigned))
    const token = `${unsigned}.${b64url(Buffer.from(sig))}`
    const authorization = `vapid t=${token},k=${VAPID_PUBLIC}`

    const pushRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/octet-stream', 'TTL': '86400' },
      body: JSON.stringify({ title, body, url: url || '/' }),
    })

    if (!pushRes.ok) return res.status(500).json({ error: await pushRes.text() })
    return res.status(200).json({ ok: true })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
