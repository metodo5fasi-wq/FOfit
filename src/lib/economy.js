// ─────────────────────────────────────────────────────────────
// Vista economica del coach. Dati disponibili: le RATE (importo, scadenza, data di pagamento) e la scadenza degli abbonamenti.
// Il prezzo dei pagamenti in un'unica soluzione NON è registrato, quindi non entra nei totali (si vedono solo i rinnovi in arrivo).
// Funzioni pure: si provano da sole.
// ─────────────────────────────────────────────────────────────
import { num, rateState, effectiveDue, addDays, diffDays } from './installments.js'
import { localDateStr } from './dates.js'

const r2 = n => Math.round(n * 100) / 100
const paidDay = r => { if (!r.paid_at) return ''; const d = new Date(r.paid_at); return isNaN(d) ? String(r.paid_at).slice(0, 10) : localDateStr(d) }
const prevMonth = ym => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
export const UPCOMING_DAYS = 30

export function buildEconomy({ clients = [], rates = [], today, renewalDays = 30 }) {
  const name = Object.fromEntries(clients.map(c => [c.id, c.full_name || 'Cliente']))
  const known = rates.filter(r => name[r.client_id] !== undefined)
  const ym = today.slice(0, 7), prev = prevMonth(ym), horizon = addDays(today, UPCOMING_DAYS)
  const row = r => ({ id: r.id, clientId: r.client_id, name: name[r.client_id], amount: num(r.amount), due: effectiveDue(r), original: r.due_date, extended: !!r.extended_until && effectiveDue(r) !== String(r.due_date).slice(0, 10) })

  const collected = known.filter(r => paidDay(r).startsWith(ym)), collectedPrev = known.filter(r => paidDay(r).startsWith(prev))
  const unpaid = known.filter(r => !r.paid_at)
  const overdue = unpaid.filter(r => ['overdue', 'blocked'].includes(rateState(r, today).code)).map(r => ({ ...row(r), late: rateState(r, today).late, blocked: rateState(r, today).code === 'blocked' })).sort((a, b) => b.late - a.late)
  const upcoming = unpaid.filter(r => { const d = effectiveDue(r); return d && d >= today && d <= horizon }).map(row).sort((a, b) => a.due.localeCompare(b.due))
  const thisMonthOpen = unpaid.filter(r => { const d = effectiveDue(r); return d && d.startsWith(ym) && d >= today })
  const nodate = unpaid.filter(r => !effectiveDue(r))
  const sum = list => r2(list.reduce((s, r) => s + num(r.amount), 0))

  const renewals = clients.filter(c => c.subscription_end).map(c => ({ clientId: c.id, name: name[c.id], end: String(c.subscription_end).slice(0, 10), days: diffDays(today, String(c.subscription_end).slice(0, 10)), payment_type: c.payment_type }))
    .filter(x => x.days >= 0 && x.days <= renewalDays).sort((a, b) => a.days - b.days)
  const remaining = clients.filter(c => c.payment_type === 'rate').length

  return {
    collectedMonth: sum(collected), collectedMonthCount: collected.length, collectedPrev: sum(collectedPrev),
    expectedMonth: r2(sum(collected) + sum(thisMonthOpen) + sum(overdue)),     // incassato + rate del mese ancora da pagare + arretrati
    overdue, overdueTotal: sum(overdue),
    upcoming, upcomingTotal: sum(upcoming),
    toCollectTotal: sum(unpaid),
    noDateCount: nodate.length,
    renewals, rateClients: remaining,
  }
}
