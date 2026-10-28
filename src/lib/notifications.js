// FOfit — Notifiche push via OneSignal
const ONESIGNAL_APP_ID = '68eb6585-0eeb-44b0-bb18-0d15f2446e6c'

// Collega l'utente FOfit a OneSignal (usa client_id come external user id)
export async function requestNotificationPermission(clientId) {
  try {
    if (typeof window === 'undefined' || !window.OneSignal) {
      return { ok: false, reason: 'onesignal_not_loaded' }
    }

    // Imposta external user id per identificare il cliente
    await window.OneSignal.login(clientId)

    // Richiedi permesso notifiche
    const permission = await window.OneSignal.Notifications.requestPermission()

    if (!permission) return { ok: false, reason: 'denied' }

    return { ok: true }
  } catch(e) {
    console.error('[FOfit OneSignal]', e)
    return { ok: false, reason: e.message }
  }
}

export async function checkNotificationStatus() {
  try {
    if (typeof window === 'undefined') return 'default'
    // Aspetta che OneSignal sia caricato
    if (!window.OneSignal) {
      await new Promise(r => setTimeout(r, 2000))
    }
    if (!window.OneSignal) return 'default'
    const permission = window.OneSignal.Notifications.permission
    return permission ? 'granted' : 'default'
    // NON torniamo mai 'denied' — lasciamo sempre la possibilità di attivare
  } catch {
    return 'default'
  }
}

export async function sendTestNotification() {
  // La notifica di test viene inviata via OneSignal dashboard
  // oppure via API — qui mostriamo solo un toast locale
  console.log('[FOfit] Notifiche attivate via OneSignal')
}
