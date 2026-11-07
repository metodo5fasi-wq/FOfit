// ─────────────────────────────────────────────────────────────
// Scritture sul database con esito controllato.
// Supabase NON lancia errori: restituisce { error }. Se nessuno lo guarda, un salvataggio fallito passa in silenzio.
//  • dbSave(promise, cosa, verbo, opzioni)  → non lancia: mostra un messaggio chiaro e restituisce { ok, data, error }
//      opzioni: { silent }  nessun messaggio (né di errore né di conferma): azioni automatiche, non decise dall'utente
//               { quiet }   niente conferma di riuscita (l'errore sì): quando il flusso ha già la sua conferma o ne mostra una sola alla fine
//               { done }    testo della conferma ("Piano aggiornato"); se manca si usa quella generica del verbo ("Salvato", "Eliminato"…)
//  • dbMust(promise, cosa, verbo)             → lancia: per i blocchi try/catch che già mostrano l'errore (e lasciano ripulire lo stato)
//  • done(testo)                              → conferma breve scritta a mano, per le azioni che non passano da una scrittura sul database
// ─────────────────────────────────────────────────────────────
import { isNetworkError } from './offline'

// Messaggi a comparsa: modulo senza dipendenze (src/lib/toast.js), qui ri-esportato per comodità
import { notify } from './toast'
export { notify, done, _resetDoneForTests } from './toast'
const DONE_BY_VERB = { salvare: 'Salvato', eliminare: 'Eliminato', inviare: 'Inviato', aggiornare: 'Aggiornato', disattivare: 'Disattivato', riattivare: 'Riattivato', annullare: 'Annullato', aggiungere: 'Aggiunto', rimuovere: 'Rimosso' }
const msgFor = (err, what, verb) => isNetworkError(err)
  ? 'Nessuna connessione: modifica non salvata. Riprova quando torna la rete.'
  : `Non sono riuscito a ${verb} ${what}. Riprova.`
async function run(promise) { try { return (await promise) || {} } catch (e) { return { error: e } } }

export async function dbSave(promise, what = 'i dati', verb = 'salvare', { silent = false, quiet = false, done: doneText } = {}) {
  const res = await run(promise)
  if (res.error) {
    console.error('[FOfit] scrittura non riuscita:', what, res.error)
    if (!silent) notify(msgFor(res.error, what, verb))
    return { ...res, ok: false }
  }
  if (!silent && !quiet) notify(doneText || DONE_BY_VERB[verb] || 'Fatto', 'success')
  return { ...res, ok: true }
}

export async function dbMust(promise, what = 'i dati', verb = 'salvare') {
  const res = await run(promise)
  if (res.error) { console.error('[FOfit] scrittura non riuscita:', what, res.error); const e = new Error(msgFor(res.error, what, verb)); e.cause = res.error; throw e }
  return res
}
