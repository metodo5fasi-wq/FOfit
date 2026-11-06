// FOfit Service Worker — push notification + uso offline
//
// Offline: l'app (pagina e file) viene salvata sul telefono, così si apre anche senza rete.
// REGOLE DI SICUREZZA:
//  • non intercetta MAI database (supabase), accessi e API (/api/): quelle richieste vanno sempre in rete
//  • la pagina principale prova SEMPRE prima la rete (così un aggiornamento arriva subito); la copia salvata serve solo se la rete manca o è lentissima
//  • i file dell'app (/assets/*) hanno il nome legato al contenuto: si salvano una volta; mai una pagina HTML al posto di un file

const SHELL = 'fofit-shell-v1'      // la pagina principale
const FILES = 'fofit-files-v1'      // file dell'app, icone, font
const NAV_TIMEOUT = 3500            // con rete lentissima si apre la copia salvata dopo 3,5 secondi
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(SHELL).then(c => c.add(new Request(self.location.origin + '/index.html', { cache: 'reload' }))).catch(() => {}))
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [SHELL, FILES]
    for (const k of await caches.keys()) if (k.startsWith('fofit-') && !keep.includes(k)) await caches.delete(k)
    await clients.claim()
  })())
})

const isHtml = res => (res.headers.get('content-type') || '').includes('text/html')
const isAsset = url => url.origin === self.location.origin && url.pathname.startsWith('/assets/')
const isStaticSame = url => url.origin === self.location.origin && /\.(png|ico|svg|webp|jpg|woff2?)$/.test(url.pathname)

async function navigate(req) {
  const cache = await caches.open(SHELL)
  const network = fetch(req).then(res => { if (res && res.ok && isHtml(res)) cache.put('/index.html', res.clone()); return res })
  const cached = () => cache.match('/index.html')
  try {
    return await Promise.race([network, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), NAV_TIMEOUT))])
  } catch (e) {
    network.catch(() => {})                                   // la richiesta continua e aggiorna la copia
    return (await cached()) || new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#080808;color:#F0F0F0;font-family:system-ui;padding:40px;text-align:center"><h2>FOfit</h2><p>Sei offline e l\'app non è ancora stata salvata su questo telefono.<br>Aprila una volta con la connessione.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

async function cacheFirst(req, url) {
  const cache = await caches.open(FILES)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res && res.ok && !(isAsset(url) && isHtml(res))) cache.put(req, res.clone())      // mai HTML al posto di un file (succede se il file non esiste più)
  return res
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FILES)
  const hit = await cache.match(req)
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res }).catch(() => null)
  return hit || (await net) || Response.error()
}

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  let url; try { url = new URL(req.url) } catch { return }
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in') || url.pathname.startsWith('/api/')) return      // sempre in rete
  if (req.mode === 'navigate' && url.origin === self.location.origin) { e.respondWith(navigate(req)); return }
  if (isAsset(url) || isStaticSame(url)) { e.respondWith(cacheFirst(req, url).catch(() => Response.error())); return }
  if (CDN_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req)); return }
})

// L'app comunica l'elenco dei file in uso (la prima volta si caricano prima che il service worker sia attivo): vengono salvati, e quelli vecchi tolti
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'CACHE_URLS' || !Array.isArray(e.data.urls)) return
  e.waitUntil((async () => {
    const cache = await caches.open(FILES)
    const urls = [...new Set(e.data.urls.filter(u => typeof u === 'string'))].filter(u => { try { const x = new URL(u, self.location.origin); return isAsset(x) || isStaticSame(x) || CDN_HOSTS.includes(x.hostname) } catch { return false } })
    for (const u of urls) {
      try {
        if (await cache.match(u)) continue
        const x = new URL(u, self.location.origin)
        const res = await fetch(u, CDN_HOSTS.includes(x.hostname) ? { mode: 'no-cors' } : {})
        if (res && (res.ok || res.type === 'opaque') && !(isAsset(x) && isHtml(res))) await cache.put(u, res)
      } catch {}
    }
    // Le pagine caricate a richiesta (coach, grafici...) si salvano al primo uso e NON vanno cancellate a ogni apertura.
    // Si ripulisce solo quando cambia la versione dell'app (cambia il file principale index-*.js): allora si tolgono i file della versione precedente.
    const live = urls.filter(u => { try { return isAsset(new URL(u, self.location.origin)) } catch { return false } })
    const main = live.map(u => new URL(u, self.location.origin).pathname).find(p => /\/assets\/index-[\w-]+\.js$/.test(p))
    if (main) {
      const meta = await caches.open(SHELL), prev = await meta.match(self.location.origin + '/__main'), prevMain = prev ? await prev.text() : null
      if (prevMain !== main) {
        const keepPaths = new Set(live.map(u => new URL(u, self.location.origin).pathname))
        for (const req of await cache.keys()) { const x = new URL(req.url); if (isAsset(x) && !keepPaths.has(x.pathname)) await cache.delete(req) }
        await meta.put(self.location.origin + '/__main', new Response(main))
      }
    }
  })())
})

// Ricevi push notification
self.addEventListener('push', e => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { title: 'FOfit', body: e.data ? e.data.text() : '' }
  }

  const title = data.title || 'FOfit'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/notifiche' },
    requireInteraction: false,
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

// Click sulla notifica → apri app alla sezione notifiche
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/notifiche'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
