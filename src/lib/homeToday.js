// ─────────────────────────────────────────────────────────────
// Home del cliente: "cosa devo fare oggi?"
// Logica pura (nessun accesso al database): riceve i dati già letti e restituisce l'elenco delle cose da fare.
//   status: 'done' (fatto) · 'progress' (iniziato) · 'todo' (da fare) · 'info' (solo informazione)
// ─────────────────────────────────────────────────────────────

import { localDateStr } from './dates'

// Lunedì della settimana corrente (stessa regola del Check-in settimanale, così i due coincidono)
export function weekDateOf(d = new Date()) {
  const x = new Date(d); const dow = x.getDay(); x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow))
  return localDateStr(x)
}
const DAY = 86400000
export const daysBetween = (fromStr, toStr) => Math.round((new Date(toStr + 'T12:00') - new Date(fromStr + 'T12:00')) / DAY)
export function relDays(dateStr, todayStr) {
  const n = daysBetween(dateStr, todayStr)
  if (n <= 0) return 'oggi'; if (n === 1) return 'ieri'; if (n < 7) return `${n} giorni fa`
  if (n < 14) return '1 settimana fa'; if (n < 60) return `${Math.floor(n / 7)} settimane fa`; return `${Math.floor(n / 30)} mesi fa`
}
const fmtKg = v => String(v).replace('.', ',')

// Giorni della scheda nell'ordine in cui il coach li ha scritti (Giorno A, B, C...)
export function planDays(exercises = []) {
  const sorted = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const days = []; sorted.forEach(e => { if (e.day_label && !days.includes(e.day_label)) days.push(e.day_label) })
  return days
}
// Il prossimo allenamento è il giorno dopo l'ultimo fatto (in giro continuo); senza storico, il primo
export function nextWorkoutDay(days, sessions = [], todayStr) {
  if (!days.length) return null
  const last = [...sessions].filter(s => s.session_date < todayStr).sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)))[0]
  const i = last ? days.indexOf(last.day_label) : -1
  return i >= 0 ? days[(i + 1) % days.length] : days[0]
}

export function buildToday({ todayStr, exercises = [], sessions = [], todayLogs = [], activeDayStored = null, hasWorkoutPlan = false,
  kcal = 0, kcalTarget = null, measurement = null, checkin = null, anamnesi = undefined, nextBooking = null, unread = 0 }) {
  const today = [], week = []
  // ── Allenamento ──
  if (hasWorkoutPlan && exercises.length) {
    const days = planDays(exercises), count = d => exercises.filter(e => e.day_label === d).length
    const doneSession = sessions.find(s => s.session_date === todayStr)
    if (doneSession) {
      today.push({ id: 'workout', icon: 'ti-barbell', status: 'done', title: 'Allenamento completato', sub: `${doneSession.day_label}${doneSession.sets_total ? ` · ${doneSession.sets_completed || 0}/${doneSession.sets_total} serie` : ''}`, to: '/allenamento', dayLabel: doneSession.day_label })
    } else if (todayLogs.length) {
      const byLog = exercises.find(e => todayLogs.some(l => l.exercise_id ? l.exercise_id === e.id : l.exercise_name === e.exercise_name))?.day_label
      const day = byLog || (days.includes(activeDayStored) ? activeDayStored : nextWorkoutDay(days, sessions, todayStr))
      today.push({ id: 'workout', icon: 'ti-barbell', status: 'progress', title: 'Allenamento in corso', sub: `${day} · ${todayLogs.length} ${todayLogs.length === 1 ? 'serie fatta' : 'serie fatte'}`, to: '/allenamento', cta: 'Continua', dayLabel: day })
    } else {
      const day = nextWorkoutDay(days, sessions, todayStr)
      today.push({ id: 'workout', icon: 'ti-barbell', status: 'todo', title: 'Allenamento di oggi', sub: `${day} · ${count(day)} ${count(day) === 1 ? 'esercizio' : 'esercizi'}`, to: '/allenamento', cta: 'Inizia', dayLabel: day })
    }
  }
  // ── Pasti ──
  const k = Math.round(kcal || 0)
  if (kcalTarget > 0) {
    const pct = k / kcalTarget
    if (pct >= 0.9) today.push({ id: 'meals', icon: 'ti-salad', status: 'done', title: 'Pasti registrati', sub: pct > 1.1 ? `${k} kcal · oltre il target di ${k - kcalTarget}` : `${k} / ${kcalTarget} kcal · target raggiunto`, to: '/diario', progress: Math.min(1, pct) })
    else if (k > 0) today.push({ id: 'meals', icon: 'ti-salad', status: 'progress', title: 'Registra i pasti', sub: `${k} / ${kcalTarget} kcal · ne mancano ${kcalTarget - k}`, to: '/diario', cta: 'Aggiungi', progress: pct })
    else today.push({ id: 'meals', icon: 'ti-salad', status: 'todo', title: 'Registra i pasti', sub: `Obiettivo di oggi: ${kcalTarget} kcal`, to: '/diario', cta: 'Registra', progress: 0 })
  } else {
    today.push({ id: 'meals', icon: 'ti-salad', status: k > 0 ? 'progress' : 'todo', title: 'Registra i pasti', sub: k > 0 ? `${k} kcal registrate oggi` : 'Segna quello che mangi', to: '/diario', cta: k > 0 ? 'Aggiungi' : 'Registra' })
  }
  // ── Questa settimana ──
  if (checkin) week.push({ id: 'checkin', icon: 'ti-checklist', status: 'done', title: 'Check-in della settimana', sub: 'Inviato — grazie!', to: '/checkin' })
  else week.push({ id: 'checkin', icon: 'ti-checklist', status: 'todo', title: 'Check-in della settimana', sub: 'Energia, sonno e stress · 1 minuto', to: '/checkin', cta: 'Compila' })
  const age = measurement?.entry_date ? daysBetween(measurement.entry_date, todayStr) : null
  if (measurement && age !== null && age <= 7) week.push({ id: 'weigh', icon: 'ti-scale', status: 'done', title: 'Peso registrato', sub: `${measurement.weight_kg != null ? fmtKg(measurement.weight_kg) + ' kg · ' : ''}${relDays(measurement.entry_date, todayStr)}`, to: '/progressi' })
  else week.push({ id: 'weigh', icon: 'ti-scale', status: 'todo', title: 'Registra peso e misure', sub: measurement ? `Ultima volta ${relDays(measurement.entry_date, todayStr)}${measurement.weight_kg != null ? ` · ${fmtKg(measurement.weight_kg)} kg` : ''}` : 'Non ancora registrato', to: '/progressi', cta: 'Registra' })
  if (anamnesi !== undefined && !anamnesi?.completed_at) week.push({ id: 'anamnesi', icon: 'ti-clipboard-heart', status: 'todo', title: 'Completa l\'anamnesi', sub: 'Serve al coach per costruire il tuo piano', to: '/anamnesi', cta: 'Completa' })
  if (nextBooking) {
    const n = daysBetween(todayStr, nextBooking.booking_date)
    const when = n === 0 ? 'Oggi' : n === 1 ? 'Domani' : new Date(nextBooking.booking_date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    week.push({ id: 'call', icon: 'ti-phone', status: 'info', title: 'Prossima chiamata con il coach', sub: `${when.charAt(0).toUpperCase() + when.slice(1)}${nextBooking.time_slot ? ` · ${String(nextBooking.time_slot).slice(0, 5)}` : ''}`, to: '/calendario' })
  }
  const doneToday = today.filter(t => t.status === 'done').length
  const open = [...today, ...week].filter(t => t.status === 'todo' || t.status === 'progress')
  return { today, week, doneToday, totalToday: today.length, next: open[0] || null, alert: unread > 0 ? { unread } : null }
}

// ── serie di giorni consecutivi con il diario compilato ──
export function streakOf(dates = [], todayStr) {
  const days = [...new Set(dates)].sort().reverse()
  let count = 0, current = new Date(todayStr)
  for (const day of days) {
    const diff = Math.round((current - new Date(day)) / DAY)
    if (diff === 0 || diff === 1) { count++; current = new Date(day) } else break
  }
  return count
}
const shift = (dateStr, n) => { const d = new Date(dateStr + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }

// ── numeri della settimana: da lunedì, e confronto tra gli ultimi 7 giorni e i 7 precedenti ──
// (le kcal medie sono per GIORNO registrato, non per singola voce del diario)
export function weeklyStats({ sessions = [], diaryRows = [], todayStr }) {
  const monday = weekDateOf(new Date(todayStr + 'T12:00')), d7 = shift(todayStr, -7), d14 = shift(todayStr, -14)
  const inRange = (d, from, to) => d >= from && (to ? d < to : true)
  const avg = rows => { const per = {}; rows.forEach(r => { per[r.entry_date] = (per[r.entry_date] || 0) + (Number(r.kcal) || 0) }); const v = Object.values(per); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  const thisSess = sessions.filter(s => inRange(s.session_date, d7)).length, lastSess = sessions.filter(s => inRange(s.session_date, d14, d7)).length
  const thisKcal = avg(diaryRows.filter(r => inRange(r.entry_date, d7))), lastKcal = avg(diaryRows.filter(r => inRange(r.entry_date, d14, d7)))
  return {
    sessionsWeek: sessions.filter(s => s.session_date >= monday).length,
    diaryDays: new Set(diaryRows.filter(r => r.entry_date >= monday).map(r => r.entry_date)).size,
    comp: { thisSess, lastSess, sessDiff: thisSess - lastSess, thisKcal, lastKcal, kcalDiff: thisKcal != null && lastKcal != null ? thisKcal - lastKcal : null },
  }
}
