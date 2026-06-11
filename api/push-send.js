import crypto from 'crypto'

export const config = { api: { bodyParser: true }, maxDuration: 30 }

const VAPID_PUBLIC = 'BCyIyhswxeYVJJgH1IBaImpqeu37T0u2fl-7OsfLLXGhq21I4VV_X9mINLoNR7U_7OX3bTa3JCH49-HAE1YA7NM'
const VAPID_PRIVATE = '353afIwHJShRhZtj4qDMVlUqLyKRBXDp4PqGfnfs-j8'
const VAPID_EMAIL = 'mailto:federico@fofit.fit'

function b64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  const pad = str.length % 4
  const padded = str + (pad ? '='.repeat(4 - pad) : '')
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

async function makeVapidHeader(audience) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(JSON.stringify({
    aud: audience, exp: now + 12 * 3600, sub: VAPID_EMAIL
  }))
  const unsigned = `${header}.${payload}`

  const privKeyBuf = b64urlDecode(VAPID_PRIVATE)
  const privKey = await crypto.subtle.importKey(
    'raw', privKeyBuf,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    Buffer.from(unsigned)
  )
  const token = `${unsigned}.${b64url(Buffer.from(sig).toString('binary'))}`
  return `vapid t=${token},k=${VAPID_PUBLIC}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
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
    const authorization = await makeVapidHeader(audience)
    const payload = JSON.stringify({ title, body, url: url || '/' })

    const pushRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/octet-stream',
        'Content-Length': Buffer.byteLength(payload).toString(),
        'TTL': '86400',
      },
      body: payload,
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
