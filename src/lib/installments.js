// ─────────────────────────────────────────────────────────────
// Rate dell'abbonamento — logica (nessun accesso a rete o database)
//  • ogni rata ha una scadenza (due_date), un importo, una data di pagamento (paid_at) e, se concessa, una proroga (extended_until)
//  • stato di una rata non pagata:  in arrivo → in scadenza (da 2 giorni prima) → scade oggi → scaduta (fino a 3 giorni dopo) → BLOCCANTE
//    Esempio: scadenza il 10 → avvisi dall'8; il 10 "scade oggi"; l'11, 12 e 13 l'app funziona ancora con l'avviso rosso; dal 14 l'app è bloccata.
//  • le rate future non bloccano mai; una rata senza data non blocca e non avvisa
//  • con una proroga la scadenza che conta è quella più lontana
// ─────────────────────────────────────────────────────────────
export const WARN_DAYS = 2       // avviso a partire da 2 giorni prima
export const GRACE_DAYS = 3      // giorni di tolleranza dopo la scadenza: si blocca dal 4° giorno
export const MAX_RATE = 36

export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const ds = v => String(v || '').slice(0, 10)
const utc = s => { const [y, m, d] = ds(s).split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1) }
// giorni da a a b (b − a), solo date: niente ore, niente fusi
export const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 86400000)
export function addDays(s, n) { const d = new Date(utc(s) + n * 86400000); return d.toISOString().slice(0, 10) }
// +n mesi senza "saltare": 31 gennaio + 1 mese = 28/29 febbraio, non 3 marzo
export function addMonths(s, n) {
  const [y, m, d] = ds(s).split('-').map(Number), t = (m - 1) + n, yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate()
  return `${yy}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}
export const fmtDate = s => s ? new Date(ds(s) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const fmtShort = s => s ? new Date(ds(s) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '—'
export const money = n => '€' + (Math.round(num(n) * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(Math.round(num(n) * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })

// La scadenza che conta: la proroga, se è più avanti
export function effectiveDue(i) { const d = ds(i?.due_date), e = ds(i?.extended_until); if (!d) return ''; return e && e > d ? e : d }

// Stato di UNA rata. late = giorni di ritardo (negativo = mancano giorni)
export function rateState(inst, today) {
  if (inst?.paid_at) return { code: 'paid', level: 0 }
  const due = effectiveDue(inst); if (!due) return { code: 'nodate', level: 0 }
  const late = diffDays(due, today)
  if (late > GRACE_DAYS) return { code: 'blocked', level: 5, late, due }
  if (late > 0) return { code: 'overdue', level: 4, late, due, daysToBlock: GRACE_DAYS + 1 - late }
  if (late === 0) return { code: 'due_today', level: 3, late, due }
  if (-late <= WARN_DAYS) return { code: 'due_soon', level: 2, late, due, left: -late }
  return { code: 'upcoming', level: 1, late, due, left: -late }
}

// Riepilogo del cliente: la rata più urgente, se blocca, e il messaggio da mostrare
export function summarize(list, today) {
  const rows = (list || []).map(i => ({ inst: i, st: rateState(i, today) }))
  const open = rows.filter(r => r.st.code !== 'paid')
  const top = open.filter(r => r.st.level >= 2).sort((a, b) => b.st.level - a.st.level || (a.st.due < b.st.due ? -1 : 1))[0] || null
  const blocking = open.filter(r => r.st.code === 'blocked').sort((a, b) => (a.st.due < b.st.due ? -1 : 1))
  const next = open.filter(r => r.st.due).sort((a, b) => (a.st.due < b.st.due ? -1 : 1))[0] || null
  return {
    total: rows.length, paid: rows.length - open.length,
    blocked: blocking[0] || null, blockedCount: blocking.length,
    top, next,
    alert: top ? alertFor(top) : null,
  }
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
function alertFor({ inst, st }) {
  const amt = money(inst.amount)
  switch (st.code) {
    case 'blocked': return { level: 'blocked', title: 'Rata non saldata', text: `La rata di ${amt} scaduta il ${fmtShort(st.due)} non risulta pagata: l'accesso è sospeso.` }
    case 'overdue': return { level: 'overdue', title: `Rata scaduta${st.late === 1 ? ' ieri' : ` da ${st.late} giorni`}`, text: `La rata di ${amt} era in scadenza il ${fmtShort(st.due)}. ${st.daysToBlock === 1 ? "Da domani l'accesso all'app sarà sospeso" : `Tra ${st.daysToBlock} giorni l'accesso all'app sarà sospeso`} se non viene saldata.` }
    case 'due_today': return { level: 'today', title: 'La rata scade oggi', text: `La rata di ${amt} scade oggi. Contatta il coach per il pagamento.` }
    default: return { level: 'soon', title: st.left === 1 ? 'La rata scade domani' : `La rata scade tra ${plural(st.left, 'giorno', 'giorni')}`, text: `La rata di ${amt} scade il ${fmtShort(st.due)}.` }
  }
}

// ── editor del coach ─────────────────────────────────────────
// Genera le scadenze mensili partendo dalla prima. Le rate già pagate NON si toccano.
export function generateRates({ count, amount, firstDate, existing = [] }) {
  const n = Math.max(1, Math.min(MAX_RATE, Math.round(num(count)) || 1)), first = ds(firstDate)
  const paid = existing.filter(r => r.paid_at)
  const out = [...paid]
  for (let i = paid.length; i < n; i++) out.push({ due_date: first ? addMonths(first, i) : '', amount: num(amount), paid_at: null, extended_until: null })
  return out.slice(0, Math.max(n, paid.length))
}
// Blocca il salvataggio: importo mancante/non positivo, scadenza mancante, proroga prima della scadenza. Restituisce testi.
export function validateRates(rows) {
  const out = []
  rows.forEach((r, i) => {
    if (!(num(r.amount) > 0)) out.push(`Rata ${i + 1}: importo da inserire`)
    if (!ds(r.due_date)) out.push(`Rata ${i + 1}: scadenza da inserire`)
    if (ds(r.extended_until) && ds(r.due_date) && ds(r.extended_until) < ds(r.due_date)) out.push(`Rata ${i + 1}: la proroga è prima della scadenza`)
  })
  return out
}
export const ratesTotal = rows => Math.round(rows.reduce((a, r) => a + num(r.amount), 0) * 100) / 100
export const ratesPaid = rows => Math.round(rows.filter(r => r.paid_at).reduce((a, r) => a + num(r.amount), 0) * 100) / 100

const payload = r => ({ amount: num(r.amount), due_date: ds(r.due_date) || null, paid_at: r.paid_at || null, extended_until: ds(r.extended_until) || null })
const sameRow = (db, r) => num(db.amount) === num(r.amount) && ds(db.due_date) === ds(r.due_date) && (db.paid_at ? ds(db.paid_at) : '') === (r.paid_at ? ds(r.paid_at) : '') && ds(db.extended_until) === ds(r.extended_until)
// Cosa scrivere: inserire le nuove, aggiornare solo quelle cambiate, eliminare per ULTIME quelle tolte. Mai "cancella tutto e reinserisci".
export function planRates({ clientId, dbRows, rows }) {
  const dbMap = new Map((dbRows || []).map(r => [r.id, r]))
  const keep = new Set(rows.filter(r => r.id != null).map(r => r.id))
  const toInsert = rows.filter(r => r.id == null || !dbMap.has(r.id)).map(r => ({ client_id: clientId, ...withoutNullProroga(payload(r)) }))
  // la colonna della proroga si riscrive solo se è cambiata: così modificare un importo funziona anche prima dello script SQL
  const toUpdate = rows.filter(r => r.id != null && dbMap.has(r.id) && !sameRow(dbMap.get(r.id), r)).map(r => {
    const p = payload(r); if (ds(dbMap.get(r.id).extended_until) === ds(r.extended_until)) delete p.extended_until
    return { id: r.id, ...p }
  })
  const toDelete = (dbRows || []).filter(r => !keep.has(r.id)).map(r => r.id)
  return { toInsert, toUpdate, toDelete }
}
// Se la colonna della proroga non esiste ancora, una rata senza proroga si salva comunque
const withoutNullProroga = p => (p.extended_until ? p : (({ extended_until, ...rest }) => rest)(p))
export const usesProroga = plan => plan.toInsert.some(r => 'extended_until' in r) || plan.toUpdate.some(r => r.extended_until)
export const isMissingProrogaColumn = e => /extended_until/i.test(String(e?.message || e || '')) && /column|schema|find/i.test(String(e?.message || e || ''))
export const MISSING_PROROGA_MSG = 'Per la proroga serve una colonna nuova nel database: esegui lo script fofit-rate.sql su Supabase (SQL Editor) e riprova.'

// Etichetta per la lista del coach
export function coachBadge(list, today) {
  const s = summarize(list, today)
  if (!s.total) return null
  if (s.blocked) return { level: 'blocked', text: s.blockedCount > 1 ? `🔒 ${s.blockedCount} RATE SCADUTE · BLOCCATO` : '🔒 RATA SCADUTA · BLOCCATO' }
  const t = s.top; if (!t) return null
  const st = t.st
  if (st.code === 'overdue') return { level: 'overdue', text: `⚠ RATA SCADUTA DA ${st.late} GG · blocco tra ${st.daysToBlock}` }
  if (st.code === 'due_today') return { level: 'today', text: '⚠ RATA SCADE OGGI' }
  return { level: 'soon', text: `⏰ RATA TRA ${st.left} GG` }
}
