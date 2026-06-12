const VAPID_PUBLIC = 'BCyIyhswxeYVJJgH1IBaImpqeu37T0u2fl-7OsfLLXGhq21I4VV_X9mINLoNR7U_7OX3bTa3JCH49-HAE1YA7NM'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function requestNotificationPermission(clientId) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'non_supported' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    })

    // Salva subscription sul server
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, clientId })
    })

    return { ok: true, subscription }
  } catch(e) {
    return { ok: false, reason: e.message }
  }
}

export async function checkNotificationStatus() {
  if (!('Notification' in window)) return 'not_supported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function sendTestNotification() {
  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification('FOfit 🎉', {
      body: 'Le notifiche funzionano! Riceverai promemoria per il diario.',
      icon: '/icon-192.png',
      vibrate: [100, 50, 100],
    })
  }
}
