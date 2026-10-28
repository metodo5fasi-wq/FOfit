import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
const VAPID_PUBLIC = 'BCyIyhswxeYVJJgH1IBaImpqeu37T0u2fl-7OsfLLXGhq21I4VV_X9mINLoNR7U_7OX3bTa3JCH49-HAE1YA7NM'
const VAPID_PRIVATE = '353afIwHJShRhZtj4qDMVlUqLyKRBXDp4PqGfnfs-j8'

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}
function b64dec(str) {
  const p = str.length%4
  const s = str+(p?'='.repeat(4-p):'')
  return Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')
}

async function makeVapidToken(audience) {
  const { subtle } = globalThis.crypto
  const header = b64url(Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})))
  const now = Math.floor(Date.now()/1000)
  const payload = b64url(Buffer.from(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: 'mailto:federico@fofit.fit'
  })))
  const unsigned = `${header}.${payload}`
  const privKey = await subtle.importKey(
    'raw', b64dec(VAPID_PRIVATE),
    {name:'ECDSA',namedCurve:'P-256'}, false, ['sign']
  )
  const sig = await subtle.sign(
    {name:'ECDSA',hash:'SHA-256'}, privKey,
    Buffer.from(unsigned)
  )
  return `${unsigned}.${b64url(Buffer.from(sig))}`
}

// Cifra il payload per Web Push (ECDH + AES-GCM)
async function encryptPayload(subscription, payload) {
  const { subtle } = globalThis.crypto

  const sub = subscription
  const serverKeys = await subtle.generateKey(
    {name:'ECDH',namedCurve:'P-256'}, true, ['deriveKey','deriveBits']
  )

  // Chiave pubblica del client
  const clientPublicKey = await subtle.importKey(
    'raw', b64dec(sub.keys.p256dh),
    {name:'ECDH',namedCurve:'P-256'}, true, []
  )

  // Salt casuale 16 byte
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))

  // Shared secret via ECDH
  const sharedSecret = await subtle.deriveBits(
    {name:'ECDH',public:clientPublicKey},
    serverKeys.privateKey, 256
  )

  // Auth secret del client
  const authInfo = b64dec(sub.keys.auth)

  // PRK via HKDF
  const prk = await subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])

  // IKM
  const encoder = new TextEncoder()
  const ikm = await subtle.deriveBits(
    {name:'HKDF',hash:'SHA-256',salt:authInfo,info:encoder.encode('Content-Encoding: auth\0')},
    prk, 256
  )

  // Chiave export pubblica server
  const serverPublicKeyRaw = await subtle.exportKey('raw', serverKeys.publicKey)

  // Context
  const clientPubKeyRaw = b64dec(sub.keys.p256dh)
  const context = new Uint8Array(1 + 2 + clientPubKeyRaw.length + 2 + serverPublicKeyRaw.byteLength)
  context[0] = 0 // P-256
  const view = new DataView(context.buffer)
  view.setUint16(1, clientPubKeyRaw.length, false)
  context.set(clientPubKeyRaw, 3)
  view.setUint16(3+clientPubKeyRaw.length, serverPublicKeyRaw.byteLength, false)
  context.set(new Uint8Array(serverPublicKeyRaw), 5+clientPubKeyRaw.length)

  // CEK e nonce
  const ikmKey = await subtle.importKey('raw', new Uint8Array(ikm), 'HKDF', false, ['deriveBits'])
  const cekInfo = new Uint8Array([...encoder.encode('Content-Encoding: aesgcm\0P-256\0'), ...context])
  const nonceInfo = new Uint8Array([...encoder.encode('Content-Encoding: nonce\0P-256\0'), ...context])
  const saltKey = await subtle.importKey('raw', salt, 'HKDF', false, ['deriveBits'])

  const cekBits = await subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:salt,info:cekInfo}, ikmKey, 128)
  const nonceBits = await subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:salt,info:nonceInfo}, saltKey, 96)

  const cek = await subtle.importKey('raw',cekBits,{name:'AES-GCM'},false,['encrypt'])
  const payloadBuf = encoder.encode(JSON.stringify(payload))
  const padded = new Uint8Array(payloadBuf.length + 2)
  padded.set(payloadBuf, 2)

  const encrypted = await subtle.encrypt({name:'AES-GCM',iv:new Uint8Array(nonceBits)},cek,padded)

  return {
    encrypted: Buffer.from(encrypted),
    salt: Buffer.from(salt),
    serverPublicKey: Buffer.from(serverPublicKeyRaw),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { clientId, title, body, url } = req.body
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  // Prendi subscription del cliente
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?client_id=eq.${clientId}&select=subscription`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  )
  const data = await r.json()
  if (!data?.[0]?.subscription) {
    return res.status(200).json({ ok: false, reason: 'no_subscription' })
  }

  const sub = data[0].subscription

  try {
    const endpoint = sub.endpoint
    const audience = new URL(endpoint).origin
    const token = await makeVapidToken(audience)
    const authorization = `vapid t=${token},k=${VAPID_PUBLIC}`

    // Se la subscription ha le chiavi cifra il payload
    if (sub.keys?.p256dh && sub.keys?.auth) {
      const { encrypted, salt, serverPublicKey } = await encryptPayload(sub, { title, body, url })
      const pushRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aesgcm',
          'Encryption': `salt=${b64url(salt)}`,
          'Crypto-Key': `dh=${b64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC}`,
          'TTL': '86400',
        },
        body: encrypted,
      })
      if (!pushRes.ok) {
        const errText = await pushRes.text()
        return res.status(500).json({ error: errText })
      }
    } else {
      // Fallback senza cifratura (alcuni browser vecchi)
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': authorization, 'TTL': '86400' },
      })
    }

    return res.status(200).json({ ok: true })
  } catch(e) {
    console.error('push-send error:', e)
    return res.status(500).json({ error: e.message })
  }
}
