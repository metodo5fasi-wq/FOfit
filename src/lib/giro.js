// ─────────────────────────────────────────────────────────────
// Giro settimanale: il coach passa i clienti UNO ALLA VOLTA, i più urgenti per primi, con tutto ciò che serve davanti
// (check-in, peso, aderenza, diario, allenamenti, foto, messaggi, piano, rate) e le azioni rapide.
// Qui c'è solo la logica (nessun accesso al database): si prova da sola.
// ─────────────────────────────────────────────────────────────
import { buildAttention, dayKey, dayDiff, parseDay } from './coachInbox.js'
import { movingAverage, trendSummary } from './trend.js'

// Lunedì della settimana corrente ('YYYY-MM-DD'): il "visto" vale una settimana, poi si ricomincia
export function weekKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d)
}
export const reviewKey = (week, clientId) => `giro:${week}:${clientId}`

const by = (list = []) => list.reduce((o, r) => { (o[r.client_id] = o[r.client_id] || []).push(r); return o }, {})
const latest = (rows, field) => (rows || []).reduce((best, r) => (!best || String(r[field] || '') > String(best[field] || '') ? r : best), null)

// raw = { clients, plans, workoutPlans, diary, sessions, adherence, checkins, weights, photos, messages, rates }
// reviewed = Set di chiavi già viste (reviewKey)
export function buildGiro({ raw, reviewed = new Set(), now = new Date() }) {
  const { clients = [], plans = [], workoutPlans = [], diary = [], sessions = [], adherence = [], checkins = [], weights = [], photos = [], messages = [], rates = [] } = raw
  const wk = weekKey(now), today = dayKey(now)
  const P = by(plans), D = by(diary), S = by(sessions), A = by(adherence), C = by(checkins), W = by(weights), F = by(photos), M = by(messages), R = by(rates)
  const wpClients = new Set(workoutPlans.filter(w => w.is_active !== false).map(w => w.client_id))

  const stats = {}, lastCheckinAt = {}
  const extra = {}
  clients.forEach(c => {
    const myPlans = (P[c.id] || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    const active = myPlans.find(p => p.is_active) || null
    const dDays = (D[c.id] || []).map(d => d.entry_date), ad = A[c.id] || []
    const ci = latest(C[c.id], 'created_at') || latest(C[c.id], 'week_date')
    if (ci) lastCheckinAt[c.id] = ci.created_at || `${ci.week_date}T12:00:00`
    const pts = (W[c.id] || []).filter(w => w.weight_kg != null).map(w => ({ date: w.entry_date, value: w.weight_kg })).sort((a, b) => a.date.localeCompare(b.date))
    const series = movingAverage(pts, 7), recent = series.filter(p => dayDiff(now, parseDay(p.date)) <= 21)
    const tr = recent.length >= 2 ? trendSummary(recent) : null
    stats[c.id] = {
      activePlan: active, inactivePlan: active ? null : (myPlans[0] || null),
      lastDiary: dDays.length ? [...dDays].sort().pop() : null, diaryDays7: new Set(dDays).size, diaryToday: dDays.includes(today),
      sessions7: S[c.id] || [], weights: pts, adherence: ad.length ? { followed: ad.filter(a => a.followed).length, total: ad.length } : null,
    }
    const msgs = (M[c.id] || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    extra[c.id] = {
      checkin: ci, weightNow: pts.length ? pts[pts.length - 1] : null, weightChange: tr ? tr.change : null, weightSpan: tr ? tr.spanDays : null,
      adherencePct: ad.length ? Math.round(ad.filter(a => a.followed).length / ad.length * 100) : null,
      diaryDays: stats[c.id].diaryDays7, workouts: (S[c.id] || []).length, photos: (F[c.id] || []).length,
      unread: msgs.length, lastMessage: msgs[0] || null,
      planTouched: active ? (active.updated_at || active.created_at) : null,
      planAgeDays: active ? dayDiff(now, parseDay(active.updated_at || active.created_at) || now) : null,
      hasWorkoutPlan: wpClients.has(c.id),
    }
  })
  const att = buildAttention({ clients, stats, lastCheckinAt, workoutPlanClients: wpClients, ratesByClient: R, now })
  const flagsOf = Object.fromEntries(att.map(a => [a.clientId, a]))
  const rank = c => { const a = flagsOf[c.id]; return a ? (a.severity === 'red' ? 0 : 1) : 2 }

  const all = clients.map(c => ({
    client: c, id: c.id, name: c.full_name || 'Cliente', flags: flagsOf[c.id]?.flags || [], severity: flagsOf[c.id]?.severity || null,
    ...extra[c.id], planId: stats[c.id].activePlan?.id || null,
    reviewed: reviewed.has(reviewKey(wk, c.id)),
  }))
  // da vedere: prima chi ha avvisi rossi, poi gialli, poi chi ha scritto un messaggio, poi gli altri; a parità, più avvisi prima, poi alfabetico
  const todo = all.filter(x => !x.reviewed).sort((a, b) => rank(a.client) - rank(b.client) || (b.unread > 0) - (a.unread > 0) || b.flags.length - a.flags.length || a.name.localeCompare(b.name, 'it'))
  return { week: wk, queue: todo, done: all.filter(x => x.reviewed), total: all.length }
}
