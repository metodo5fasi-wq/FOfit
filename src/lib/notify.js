// ─────────────────────────────────────────────────────────────
// Invio di un messaggio del coach a un cliente. Un unico percorso per: campanella, messaggi programmati, risposte del coach.
//  1) notifica nell'app (tabella notifications): è ciò che il cliente vede in Home ("N nuove notifiche") e nella pagina Notifiche
//  2) notifica push sul telefono (solo se il cliente l'ha attivata: se non c'è, si ignora)
//  3) messaggio nella conversazione (coach_messages, tramite /api/messages): è lo storico, e su questo il cliente può rispondere
// L'invio è riuscito se è riuscito il passo 1: senza quello il cliente non vedrebbe nulla.
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import { authFetch } from './authFetch'
import { dbSave } from './db'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function sendToClient({ clientId, coachId = null, title = 'Messaggio dal coach', body, pushTitle = null, url = '/notifiche' }) {
  const text = String(body || '').trim()
  if (!clientId || !text) return { ok: false, notification: false, error: new Error('Dati mancanti') }
  const n = await dbSave(supabase.from('notifications').insert({ client_id: clientId, type: 'coach_message', title, body: text, read: false }), 'la notifica', 'inviare', { silent: true })
  if (!n.ok) return { ok: false, notification: false, error: n.error }
  let push = false, chat = false
  try { push = (await authFetch('/api/push-send', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ clientId, title: pushTitle || title, body: text, url }) })).ok } catch {}
  try { chat = (await authFetch('/api/messages', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ clientId, coachId, message: text, senderRole: 'coach' }) })).ok } catch {}
  return { ok: true, notification: true, push, chat }
}

// Stesso messaggio a più clienti, pochi alla volta. Restituisce chi è stato raggiunto e chi no.
export async function sendToClients(clientIds, payload, { concurrency = 4 } = {}) {
  const ids = [...new Set(clientIds)], sent = [], failed = []; let next = 0
  const worker = async () => { while (next < ids.length) { const id = ids[next++]; let r; try { r = await sendToClient({ ...payload, clientId: id }) } catch (e) { r = { ok: false } } ; (r.ok ? sent : failed).push(id) } }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker))
  return { sent, failed }
}
