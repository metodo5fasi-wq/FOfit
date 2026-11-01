// Dashboard del coach: costruisce l'elenco "Da gestire", l'agenda delle chiamate e i clienti da seguire.
// Funzioni pure (nessun accesso al database): si possono provare da sole.
import { SLOT_MINUTES } from './callAvailability.js'

export const DAY = 86400000
// Soglie (modificabili qui)
export const T = { diaryDays: 3, workoutDays: 7, checkinDays: 8, subscriptionDays: 7, expiredIgnoreDays: 30, inboxWindowDays: 30, bookingWindowDays: 14 }

export const TYPES = {
  checkin:  { label: 'Check-in',  icon: 'ti-activity',          color: '#4A90D4' },
  message:  { label: 'Messaggi',  icon: 'ti-message-circle',    color: '#9B59B6' },
  report:   { label: 'Report',    icon: 'ti-clipboard-check',   color: '#D4570A' },
  anamnesi: { label: 'Anamnesi',  icon: 'ti-clipboard-heart',   color: '#3B8C5A' },
  booking:  { label: 'Chiamate',  icon: 'ti-phone',             color: '#E8A020' },
  photo:    { label: 'Foto',      icon: 'ti-camera',            color: '#14B8A6' },
  measure:  { label: 'Misure',    icon: 'ti-ruler',             color: '#14B8A6' },
}
// Questi hanno già il loro stato "letto" nelle tabelle esistenti; gli altri si ricordano in coach_inbox_seen
export const NATIVE = new Set(['message', 'report', 'anamnesi'])
export const itemKey = (type, id) => `${type}:${id}`

// ── date ──
export const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export function parseDay(v) {
  if (!v) return null
  if (v instanceof Date) return isNaN(v) ? null : v
  const s = String(v), m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0)
  const d = new Date(s); return isNaN(d) ? null : d
}
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY)   // a − b in giorni di calendario
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export const fmtDayShort = v => { const d = parseDay(v); return d ? `${WD[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}` : '' }

export function relTime(at, now = new Date()) {
  const d = new Date(at); if (isNaN(d)) return ''
  const diff = now - d
  if (diff < 60000) return 'ora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min fa`
  const dd = dayDiff(now, d)
  if (dd === 0) return `${Math.floor(diff / 3600000)} ore fa`
  if (dd === 1) return `ieri ${hhmm(d)}`
  if (dd < 7) return `${WD[d.getDay()]} ${hhmm(d)}`
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ── Da gestire ──
const snippet = (s, n = 80) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
function checkinDetail(r) {
  const p = []
  if (r.energy != null) p.push(`Energia ${r.energy}`); if (r.sleep != null) p.push(`Sonno ${r.sleep}`); if (r.stress != null) p.push(`Stress ${r.stress}`)
  const base = p.join(' · '), note = snippet(r.notes, 70)
  return note ? (base ? `${base} — “${note}”` : `“${note}”`) : base
}

export function buildInbox({ checkins = [], messages = [], reports = [], anamnesi = [], bookings = [], photos = [], measures = [], seenKeys = new Set(), clientsById = {}, now = new Date() }) {
  const items = []
  const name = id => clientsById[id]?.full_name || 'Cliente'
  const since = days => new Date(now.getTime() - days * DAY)
  const add = (type, id, clientId, at, title, detail) => {
    if (!clientId || !at) return
    const d = new Date(at); if (isNaN(d)) return
    items.push({ key: itemKey(type, id), type, id, clientId, clientName: name(clientId), at: d, title, detail: detail || '', native: NATIVE.has(type) })
  }
  checkins.forEach(r => { const at = r.created_at || (r.week_date && `${r.week_date}T12:00:00`); if (at && new Date(at) >= since(T.inboxWindowDays)) add('checkin', r.id, r.client_id, at, 'Check-in settimanale', checkinDetail(r)) })
  messages.forEach(r => add('message', r.id, r.client_id, r.created_at, 'Nuovo messaggio', snippet(r.message ?? r.content)))
  reports.forEach(r => add('report', r.id, r.client_id, r.submitted_at, 'Report allenamento', 'Report inviato'))
  anamnesi.forEach(r => add('anamnesi', r.id, r.client_id, r.submitted_at || r.completed_at, 'Anamnesi compilata', ''))
  bookings.forEach(r => { if (r.status !== 'confirmed' || !r.created_at || new Date(r.created_at) < since(T.bookingWindowDays)) return
    add('booking', r.id, r.client_id, r.created_at, 'Chiamata prenotata', `${fmtDayShort(r.booking_date)} alle ${r.time_slot}`) })
  // le foto caricate insieme (stesso cliente e stesso giorno) diventano una sola riga
  const grouped = new Map()
  photos.forEach(r => { if (!r.created_at || new Date(r.created_at) < since(T.inboxWindowDays)) return
    const k = `${r.client_id}:${dayKey(r.created_at)}`; const g = grouped.get(k) || { clientId: r.client_id, at: r.created_at, n: 0 }; g.n++; if (new Date(r.created_at) > new Date(g.at)) g.at = r.created_at; grouped.set(k, g) })
  grouped.forEach((g, k) => add('photo', k, g.clientId, g.at, 'Nuove foto progressi', g.n === 1 ? '1 foto' : `${g.n} foto`))
  measures.forEach(r => { if (!r.created_at || new Date(r.created_at) < since(T.inboxWindowDays)) return
    add('measure', r.id, r.client_id, r.created_at, 'Nuova misurazione', [r.weight_kg != null && `Peso ${r.weight_kg} kg`, r.waist_cm != null && `Vita ${r.waist_cm} cm`, r.body_fat_pct != null && `Massa grassa ${r.body_fat_pct}%`].filter(Boolean).join(' · ')) })
  items.forEach(i => { i.seen = !i.native && seenKeys.has(i.key) })
  items.sort((a, b) => b.at - a.at)
  return items
}

// ── Agenda chiamate ──
export function buildAgenda({ bookings = [], clientsById = {}, now = new Date() }) {
  const out = { today: [], tomorrow: [], week: [], later: [] }
  bookings.forEach(b => {
    if (b.status !== 'confirmed' || !b.client_id) return
    const d = parseDay(b.booking_date); if (!d) return
    const [h, m] = String(b.time_slot || '00:00').split(':').map(Number)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0)
    const diff = dayDiff(start, now)
    if (diff < 0 || (diff === 0 && start.getTime() + SLOT_MINUTES * 60000 <= now.getTime())) return
    const row = { id: b.id, clientId: b.client_id, clientName: clientsById[b.client_id]?.full_name || 'Cliente', date: b.booking_date, time: b.time_slot, start, dayLabel: fmtDayShort(b.booking_date) }
    ;(diff === 0 ? out.today : diff === 1 ? out.tomorrow : diff <= 7 ? out.week : out.later).push(row)
  })
  Object.values(out).forEach(a => a.sort((x, y) => x.start - y.start))
  return out
}

// ── Clienti da seguire ──
// stats = clientStats di AdminPanel; lastCheckinAt = { [clienteId]: data ISO dell'ultimo check-in }; workoutPlanClients = Set dei clienti con scheda attiva (null = non noto)
export function buildAttention({ clients = [], stats = {}, lastCheckinAt = {}, workoutPlanClients = null, now = new Date() }) {
  const out = []
  clients.forEach(c => {
    const st = stats[c.id]; if (!st) return     // dati non ancora caricati: niente falsi allarmi
    const flags = [], created = parseDay(c.created_at), age = created ? dayDiff(now, created) : 9999
    let ignoreActivity = false
    const end = parseDay(c.subscription_end)
    if (end) {
      const left = dayDiff(end, now)
      if (left < 0) { flags.push({ code: 'sub_expired', severity: 'red', text: `Abbonamento scaduto da ${plural(-left, 'giorno', 'giorni')}` }); if (-left > T.expiredIgnoreDays) ignoreActivity = true }
      else if (left <= T.subscriptionDays) flags.push({ code: 'sub_soon', severity: left <= 2 ? 'red' : 'amber', text: left === 0 ? 'Abbonamento scade oggi' : `Abbonamento scade tra ${plural(left, 'giorno', 'giorni')}` })
    }
    if (!ignoreActivity) {
      if (!st.activePlan) flags.push(st.inactivePlan ? { code: 'plan_off', severity: 'amber', text: 'Piano alimentare non attivo' } : { code: 'no_plan', severity: 'red', text: 'Senza piano alimentare' })
      const hasWorkoutPlan = workoutPlanClients ? workoutPlanClients.has(c.id) : null
      if (hasWorkoutPlan === false) flags.push({ code: 'no_workout_plan', severity: 'amber', text: 'Senza scheda di allenamento' })
      if (age >= T.diaryDays) {
        const last = parseDay(st.lastDiary), days = last ? dayDiff(now, last) : null
        if (days === null) flags.push({ code: 'diary', severity: 'amber', text: 'Diario fermo da oltre 7 giorni' })
        else if (days >= T.diaryDays) flags.push({ code: 'diary', severity: 'amber', text: `Diario fermo da ${plural(days, 'giorno', 'giorni')}` })
      }
      if (hasWorkoutPlan && age >= T.workoutDays && !(st.sessions7 || []).length) flags.push({ code: 'workout', severity: 'amber', text: 'Nessun allenamento da oltre 7 giorni' })
      if (age >= T.checkinDays) {
        const last = parseDay(lastCheckinAt[c.id]), days = last ? dayDiff(now, last) : null
        if (days === null) flags.push({ code: 'checkin', severity: 'amber', text: 'Nessun check-in negli ultimi 30 giorni' })
        else if (days >= T.checkinDays) flags.push({ code: 'checkin', severity: 'amber', text: `Check-in mancante da ${plural(days, 'giorno', 'giorni')}` })
      }
    }
    if (flags.length) out.push({ clientId: c.id, name: c.full_name || 'Cliente', client: c, flags, severity: flags.some(f => f.severity === 'red') ? 'red' : 'amber' })
  })
  out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1) || b.flags.length - a.flags.length || a.name.localeCompare(b.name, 'it'))
  return out
}

// ── Numeri della settimana ──
export function buildWeek({ clients = [], stats = {}, checkins = [], now = new Date() }) {
  const ids = clients.filter(c => stats[c.id]).map(c => c.id)
  const pct = ids.map(id => stats[id].adherence).filter(a => a && a.total > 0).map(a => a.followed / a.total * 100)
  const weekAgo = new Date(now.getTime() - 7 * DAY)
  return {
    clients: ids.length,
    workouts: ids.reduce((s, id) => s + (stats[id].sessions7 || []).length, 0),
    diaryToday: ids.filter(id => stats[id].diaryToday).length,
    checkins: new Set(checkins.filter(r => { const at = r.created_at || r.week_date; return at && new Date(at) >= weekAgo }).map(r => r.client_id)).size,
    adherence: pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : null,
  }
}
