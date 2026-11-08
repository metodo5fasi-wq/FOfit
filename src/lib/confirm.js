// Conferma "Sei sicuro?" dentro l'app (al posto della finestra grigia del browser, che stona con il tema e cambia da telefono a telefono).
//   if (!(await askConfirm('Eliminare questo giorno?', { confirmLabel: 'Elimina', danger: true }))) return
// Se la finestra dell'app non è montata (es. nei test) si ricade sul confirm() del browser: il comportamento resta lo stesso.
let host = null
export function registerConfirmHost(fn) { host = fn; return () => { if (host === fn) host = null } }
export const hasConfirmHost = () => !!host
export function askConfirm(message, { title, confirmLabel, cancelLabel = 'Annulla', danger = false } = {}) {
  if (!host) return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? !!window.confirm(message) : false)
  return new Promise(resolve => host({ message, title: title || (danger ? 'Sei sicuro?' : 'Conferma'), confirmLabel: confirmLabel || 'Conferma', cancelLabel, danger, resolve }))
}
