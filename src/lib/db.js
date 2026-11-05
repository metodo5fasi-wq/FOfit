// ─────────────────────────────────────────────────────────────
// Scritture sul database con esito controllato.
// Supabase NON lancia errori: restituisce { error }. Se nessuno lo guarda, un salvataggio fallito passa in silenzio.
//  • dbSave(promise, cosa, verbo, { silent })  → non lancia: mostra un messaggio chiaro e restituisce { ok, data, error }
//  • dbMust(promise, cosa, verbo)             → lancia: per i blocchi try/catch che già mostrano l'errore (e lasciano ripulire lo stato)
// ─────────────────────────────────────────────────────────────
import { isNetworkError } from './offline'

// Messaggio a comparsa (il ToastProvider lo ascolta): funziona anche fuori dai componenti
export function notify(message, type = 'error') {
  try { window.dispatchEvent(new CustomEvent('fofit:toast', { detail: { message, type } })) } catch {}
}
const msgFor = (err, what, verb) => isNetworkError(err)
  ? 'Nessuna connessione: modifica non salvata. Riprova quando torna la rete.'
  : `Non sono riuscito a ${verb} ${what}. Riprova.`
async function run(promise) { try { return (await promise) || {} } catch (e) { return { error: e } } }

export async function dbSave(promise, what = 'i dati', verb = 'salvare', { silent = false } = {}) {
  const res = await run(promise)
  if (res.error) {
    console.error('[FOfit] scrittura non riuscita:', what, res.error)
    if (!silent) notify(msgFor(res.error, what, verb))
    return { ...res, ok: false }
  }
  return { ...res, ok: true }
}

export async function dbMust(promise, what = 'i dati', verb = 'salvare') {
  const res = await run(promise)
  if (res.error) { console.error('[FOfit] scrittura non riuscita:', what, res.error); const e = new Error(msgFor(res.error, what, verb)); e.cause = res.error; throw e }
  return res
}
