// Messaggi a comparsa da qualunque punto dell'app (anche fuori dai componenti e dalle librerie), senza dipendenze.
// Il ToastProvider ascolta l'evento 'fofit:toast'.
let lastDone = { m: '', t: 0 }
export function notify(message, type = 'error') {
  // la stessa conferma ripetuta a raffica (es. tanti salvataggi di fila) compare una volta sola
  if (type === 'success') { const now = Date.now(); if (lastDone.m === message && now - lastDone.t < 1200) return; lastDone = { m: message, t: now } }
  try { window.dispatchEvent(new CustomEvent('fofit:toast', { detail: { message, type } })) } catch {}
}
// Conferma breve di un'azione riuscita ("Piano salvato"): una sola alla volta, dura 2 secondi
export const done = message => notify(message, 'success')
export const _resetDoneForTests = () => { lastDone = { m: '', t: 0 } }
