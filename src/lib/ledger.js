// ─────────────────────────────────────────────────────────────
// Economia del coach — registro incassi, prezzi, andamento. Funzioni pure (nessun accesso a rete/database): si provano da sole.
// Fonte di tutti i totali: la tabella `payments` (un incasso = una riga). Importi lordi, nessun calcolo fiscale.
//  • Incassato = soldi davvero entrati nel mese (per data di incasso)
//  • Ricavo mensile ricorrente (MRR) = prezzo degli abbonamenti attivi diviso i mesi di durata
// ─────────────────────────────────────────────────────────────
import { num, diffDays, addDays, effectiveDue } from './installments.js'

export const r2 = n => Math.round(num(n) * 100) / 100
export const PAY_KINDS = [
  { id: 'abbonamento', label: 'Abbonamento' }, { id: 'rata', label: 'Rata' }, { id: 'consulenza', label: 'Consulenza' },
  { id: 'piano', label: 'Piano singolo' }, { id: 'prodotto', label: 'Prodotto' }, { id: 'altro', label: 'Altro' },
]
export const kindLabel = id => PAY_KINDS.find(k => k.id === id)?.label || 'Altro'
export const METHODS = ['Bonifico', 'Contanti', 'Carta', 'PayPal', 'Satispay', 'Altro']
const SUB_KINDS = ['abbonamento', 'rata']                       // gli incassi che coprono l'abbonamento del cliente
const TYPE_MONTHS = { Mensile: 1, Trimestrale: 3, Semestrale: 6, Annuale: 12 }
const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const MONTHS_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const day = v => String(v || '').slice(0, 10)

export const ymOf = d => day(d).slice(0, 7)
export const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number), t = (m - 1) + n; return `${y + Math.floor(t / 12)}-${String(((t % 12) + 12) % 12 + 1).padStart(2, '0')}` }
export const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_IT[m - 1]} ${String(y).slice(2)}` }
export const monthName = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_LONG[m - 1]} ${y}` }

// ── incassi ──
export function monthTotals(payments, ym) {
  const list = (payments || []).filter(p => ymOf(p.paid_on) === ym)
  const by = (key) => list.reduce((o, p) => { const k = p[key] || '—'; o[k] = r2((o[k] || 0) + num(p.amount)); return o }, {})
  return { total: r2(list.reduce((s, p) => s + num(p.amount), 0)), count: list.length, byKind: by('kind'), byMethod: by('method'), clients: new Set(list.map(p => p.client_id).filter(Boolean)).size }
}

// Ultimi n mesi (dal più vecchio al corrente), anche quelli a zero
export function monthSeries(payments, today, n = 12) {
  const cur = ymOf(today), idx = {}
  for (const p of payments || []) { const k = ymOf(p.paid_on); idx[k] = r2((idx[k] || 0) + num(p.amount)) }
  return Array.from({ length: n }, (_, i) => { const ym = shiftMonth(cur, i - (n - 1)); return { ym, label: monthLabel(ym), total: idx[ym] || 0 } })
}

// Media = sui mesi da quando ci sono incassi (i mesi vuoti PRIMA dell'inizio non abbassano la media)
export function seriesStats(series, payments, today) {
  const first = series.findIndex(s => s.total > 0)
  const active = first < 0 ? [] : series.slice(first)
  const best = series.reduce((b, s) => (s.total > (b?.total || 0) ? s : b), null)
  const year = today.slice(0, 4)
  const ytd = r2((payments || []).filter(p => day(p.paid_on).startsWith(year) && day(p.paid_on) <= today).reduce((s, p) => s + num(p.amount), 0))
  const prevYtdEnd = `${Number(year) - 1}${today.slice(4)}`
  const prevYtd = r2((payments || []).filter(p => day(p.paid_on).startsWith(String(Number(year) - 1)) && day(p.paid_on) <= prevYtdEnd).reduce((s, p) => s + num(p.amount), 0))
  return { avg: active.length ? r2(active.reduce((s, x) => s + x.total, 0) / active.length) : 0, months: active.length, best: best && best.total > 0 ? best : null, ytd, prevYtd }
}

// ── abbonamenti e prezzi ──
export const isActive = (c, today) => !!c.subscription_end && day(c.subscription_end) >= today
export function subMonths(c) {
  if (c.subscription_start && c.subscription_end) { const d = diffDays(day(c.subscription_start), day(c.subscription_end)); if (d > 0) return Math.max(1, Math.round(d / 30.4375)) }
  return TYPE_MONTHS[c.subscription_type] || 1
}
export const monthlyValue = c => (num(c.price_agreed) > 0 ? r2(num(c.price_agreed) / subMonths(c)) : 0)
export function mrr(clients, today) {
  const act = clients.filter(c => isActive(c, today))
  return { mrr: r2(act.reduce((s, c) => s + monthlyValue(c), 0)), active: act.length, priced: act.filter(c => num(c.price_agreed) > 0).length }
}

// Incassi che coprono l'abbonamento in corso: dall'inizio dell'abbonamento in poi
export function paidForSubscription(c, payments) {
  const from = day(c.subscription_start)
  return r2((payments || []).filter(p => p.client_id === c.id && SUB_KINDS.includes(p.kind) && (!from || day(p.paid_on) >= from)).reduce((s, p) => s + num(p.amount), 0))
}
// Clienti a soluzione unica con un prezzo e non ancora (del tutto) pagati
export function oneOffDue(clients, payments, today) {
  return clients.filter(c => c.payment_type !== 'rate' && num(c.price_agreed) > 0 && (!c.subscription_start || day(c.subscription_start) <= today))
    .map(c => { const paid = paidForSubscription(c, payments), left = r2(num(c.price_agreed) - paid); return { clientId: c.id, name: c.full_name || 'Cliente', price: num(c.price_agreed), paid, amount: left, since: day(c.subscription_start) || '', late: c.subscription_start ? Math.max(0, diffDays(day(c.subscription_start), today)) : 0 } })
    .filter(x => x.amount > 0.009).sort((a, b) => b.late - a.late)
}
// Clienti senza prezzo (schermata «completa i prezzi»)
export const missingPrices = clients => clients.filter(c => !(num(c.price_agreed) > 0)).map(c => ({
  id: c.id, name: c.full_name || 'Cliente', type: c.subscription_type || '', payment_type: c.payment_type || 'unica', start: day(c.subscription_start), end: day(c.subscription_end),
}))

// ── clienti ──
export function clientStats({ clients, payments, today }) {
  const ym = ymOf(today), act = clients.filter(c => isActive(c, today))
  const firstPay = {}; for (const p of payments || []) if (p.client_id) { const d = day(p.paid_on); if (!firstPay[p.client_id] || d < firstPay[p.client_id]) firstPay[p.client_id] = d }
  const payers = new Set((payments || []).filter(p => ymOf(p.paid_on) === ym && p.client_id).map(p => p.client_id))
  const monthTot = monthTotals(payments, ym).total
  const lostFrom = addDays(today, -30)
  return {
    active: act.length, total: clients.length,
    newMonth: clients.filter(c => firstPay[c.id] && ymOf(firstPay[c.id]) === ym && !(payments || []).some(p => p.client_id === c.id && day(p.paid_on) < `${ym}-01`)).length,
    lost: clients.filter(c => c.subscription_end && day(c.subscription_end) < today && day(c.subscription_end) >= lostFrom).length,
    renewing: clients.filter(c => c.subscription_end && day(c.subscription_end) >= today && day(c.subscription_end) <= addDays(today, 30)).length,
    payingMonth: payers.size, avgPerPayer: payers.size ? r2(monthTot / payers.size) : 0,
    avgPerActive: act.length ? r2(mrr(clients, today).mrr / act.length) : 0,
  }
}

// ── previsione: rate non pagate in scadenza + rinnovi valutati al prezzo del cliente, per i prossimi n mesi ──
export function forecast({ clients, rates, today, months = 3 }) {
  const cur = ymOf(today), byId = Object.fromEntries(clients.map(c => [c.id, c]))
  return Array.from({ length: months }, (_, i) => {
    const ym = shiftMonth(cur, i + 1)
    const rateSum = r2((rates || []).filter(r => !r.paid_at && byId[r.client_id] && ymOf(effectiveDue(r)) === ym).reduce((s, r) => s + num(r.amount), 0))
    const renewals = clients.filter(c => c.payment_type !== 'rate' && c.subscription_end && ymOf(c.subscription_end) === shiftMonth(ym, -1) && num(c.price_agreed) > 0)
    // un abbonamento che scade il mese prima, se rinnovato, porta il prezzo nel mese successivo (stima: «se tutti rinnovano»)
    return { ym, label: monthLabel(ym), rates: rateSum, renewals: r2(renewals.reduce((s, c) => s + num(c.price_agreed), 0)), renewalCount: renewals.length, total: r2(rateSum + renewals.reduce((s, c) => s + num(c.price_agreed), 0)) }
  })
}

// ── registro: filtri ed esportazione ──
export function filterPayments(payments, { ym = '', kind = '', clientId = '', q = '' } = {}) {
  const t = q.trim().toLowerCase()
  return (payments || []).filter(p => (!ym || ymOf(p.paid_on) === ym) && (!kind || p.kind === kind) && (!clientId || p.client_id === clientId)
    && (!t || `${p.client_name || ''} ${p.note || ''} ${p.method || ''}`.toLowerCase().includes(t)))
    .sort((a, b) => day(b.paid_on).localeCompare(day(a.paid_on)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
}
const csvCell = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
// Separatore «;» e virgola decimale: si apre direttamente in Excel italiano
export function paymentsCsv(rows) {
  const head = ['Data', 'Cliente', 'Tipo', 'Metodo', 'Importo', 'Note']
  const lines = rows.map(p => [day(p.paid_on).split('-').reverse().join('/'), p.client_name || '', kindLabel(p.kind), p.method || '', String(r2(p.amount)).replace('.', ','), p.note || ''].map(csvCell).join(';'))
  return '﻿' + [head.join(';'), ...lines].join('\r\n')
}

// ── collegamento rate ⇄ registro ──
// Dopo aver salvato le rate di un cliente: le pagate devono avere il loro incasso, le tornate «non pagate» no. Gli incassi di rate eliminate restano (i soldi sono entrati).
export function planPaymentSync({ client, rates, payments }) {
  const byInst = new Map((payments || []).filter(p => p.installment_id != null).map(p => [String(p.installment_id), p]))
  const toInsert = [], toUpdate = [], toDelete = []
  for (const r of rates || []) {
    const p = byInst.get(String(r.id))
    if (r.paid_at) {
      const paid_on = String(r.paid_at).length > 10 ? localDay(r.paid_at) : day(r.paid_at)
      if (!p) { if (num(r.amount) > 0) toInsert.push({ client_id: client.id, client_name: client.full_name || null, amount: num(r.amount), paid_on, kind: 'rata', installment_id: String(r.id) }) }
      else if (r2(p.amount) !== r2(r.amount) && num(r.amount) > 0) toUpdate.push({ id: p.id, amount: num(r.amount) })
    } else if (p) toDelete.push(p.id)
  }
  return { toInsert, toUpdate, toDelete }
}
function localDay(iso) { const d = new Date(iso); if (isNaN(d)) return day(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export const isMissingEconomy = e => /payments|price_list|economy_settings|price_agreed|price_note/i.test(String(e?.message || e || '')) && /relation|table|schema|column|find|exist/i.test(String(e?.message || e || ''))
export const MISSING_ECONOMY_MSG = 'Per la sezione Economia serve uno script nuovo: esegui fofit-economia.sql su Supabase (SQL Editor) e riprova.'
