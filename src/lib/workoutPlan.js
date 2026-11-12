import { normalizeNotes } from './coachNotes'
// ─────────────────────────────────────────────────────────────
// Logica della modifica allenamento, senza interfaccia (così si prova da sola).
// ─────────────────────────────────────────────────────────────
export const MAX_DAYS = 7, MAX_LABEL = 40
const norm = l => String(l ?? '').trim().toLowerCase()

// ── giorni ────────────────────────────────────────────────
export const dayList = (exercises, emptyDays = []) => [...new Set([...exercises.map(e => e.day_label), ...emptyDays])]

// "Giorno D" se ci sono A, B, C; salta i nomi già usati
export function suggestDayName(days) {
  const used = new Set(days.map(norm))
  for (let k = 0; k < 26; k++) { const n = `Giorno ${String.fromCharCode(65 + ((days.length + k) % 26))}`; if (!used.has(norm(n))) return n }
  return `Giorno ${days.length + 1}`
}
// Controlla un nome di giorno (nuovo o per rinominare: "except" è il nome attuale, che può restare uguale a se stesso)
export function checkDayName(name, days, { except = null } = {}) {
  const label = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!label) return { ok: false, error: 'Scrivi il nome del giorno' }
  if (label.length > MAX_LABEL) return { ok: false, error: `Il nome è troppo lungo (massimo ${MAX_LABEL} caratteri)` }
  if (days.some(d => d !== except && norm(d) === norm(label))) return { ok: false, error: 'Esiste già un giorno con questo nome' }
  return { ok: true, label }
}
export function renameDay(exercises, emptyDays, from, to) {
  return { exercises: exercises.map(e => e.day_label === from ? { ...e, day_label: to } : e), emptyDays: emptyDays.map(d => d === from ? to : d) }
}
// dir = -1 (prima) o +1 (dopo). Restituisce null se non si può spostare. I giorni vuoti si muovono solo tra loro (non hanno righe da riordinare).
export function moveDay(exercises, emptyDays, day, dir) {
  const withEx = [...new Set(exercises.map(e => e.day_label))]
  if (withEx.includes(day)) {
    const i = withEx.indexOf(day), j = i + dir; if (j < 0 || j >= withEx.length) return null
    const order = [...withEx]; ;[order[i], order[j]] = [order[j], order[i]]
    return { exercises: order.flatMap(d => exercises.filter(e => e.day_label === d)), emptyDays }
  }
  const i = emptyDays.indexOf(day), j = i + dir; if (i < 0 || j < 0 || j >= emptyDays.length) return null
  const e2 = [...emptyDays]; ;[e2[i], e2[j]] = [e2[j], e2[i]]; return { exercises, emptyDays: e2 }
}
// nome per la copia di un giorno: "Giorno A (copia)", poi "(copia 2)"…, sempre entro i 40 caratteri
export function copyLabel(day, days) {
  const fit = (base, suf) => (base.length + suf.length > MAX_LABEL ? base.slice(0, MAX_LABEL - suf.length).trimEnd() : base) + suf
  let n = 1, label = fit(day, ' (copia)')
  while (days.some(d => norm(d) === norm(label))) { n++; label = fit(day, ` (copia ${n})`) }
  return label
}
export function duplicateDay(exercises, day, newLabel, makeId) {
  const copies = exercises.filter(e => e.day_label === day).map((e, i) => ({ ...e, id: makeId(i), day_label: newLabel, _isNew: true, weekly_targets: (e.weekly_targets || []).map(t => ({ ...t })) }))
  return [...exercises, ...copies]
}
// Rinomine da applicare allo storico (sedute già registrate) dopo il salvataggio. Si accorpano: A→B poi B→C = A→C; tornare al nome iniziale annulla la rinomina.
export function addRename(renames, from, to) {
  const ex = renames.find(r => r.to === from)
  if (!ex) return [...renames, { from, to }]
  if (ex.from === to) return renames.filter(r => r !== ex)
  return renames.map(r => r === ex ? { from: ex.from, to } : r)
}

// ── controlli sui campi (niente più valori cambiati in silenzio) ──
const REPS_OK = v => String(v ?? '').trim() !== ''
export function validateExercises(exercises) {
  const out = []
  for (const e of exercises) {
    const fields = []
    if (!String(e.exercise_name ?? '').trim()) fields.push('name')
    const sets = typeof e.sets === 'number' ? e.sets : (e.sets === '' || e.sets == null ? NaN : Number(e.sets))
    if (!Number.isInteger(sets) || sets < 1 || sets > 10) fields.push('sets')
    if (!REPS_OK(e.reps)) fields.push('reps')
    const rest = typeof e.rest_seconds === 'number' ? e.rest_seconds : (e.rest_seconds === '' || e.rest_seconds == null ? NaN : Number(e.rest_seconds))
    if (!Number.isInteger(rest) || rest < 0 || rest > 900) fields.push('rest')
    if (fields.length) out.push({ id: e.id, day: e.day_label, name: String(e.exercise_name ?? '').trim(), fields })
  }
  return out
}
const FIELD_TXT = { name: 'il nome', sets: 'le serie (da 1 a 10)', reps: 'le ripetizioni', rest: 'il recupero (da 0 a 900 secondi)' }
export function problemsMessage(problems) {
  if (!problems.length) return ''
  const p = problems[0], what = p.fields.map(f => FIELD_TXT[f]).join(', ')
  const who = p.name ? `"${p.name}"` : 'Un esercizio'
  return problems.length === 1 ? `${who} (${p.day}): controlla ${what}` : `${problems.length} esercizi da controllare: per primo ${who} (${p.day}), controlla ${what}`
}

// ── salvataggio raggruppato ──
export function buildPayload(ex, planId, index) {
  return { plan_id: planId, day_label: ex.day_label, order_index: index, exercise_name: ex.exercise_name, muscle_group: ex.muscle_group || '', video_url: ex.video_url || '', description: ex.description || '',
    sets: parseInt(ex.sets), reps: ex.reps || '', rest_seconds: parseInt(ex.rest_seconds), tut: ex.tut || '', weekly_targets: ex.weekly_targets || [] }
}
// Cosa scrivere: righe esistenti da aggiornare (con id), righe nuove da inserire, id da eliminare. L'ordine dell'elenco diventa order_index.
export function planSave(dbIds, exercises, planId) {
  const keep = new Set(exercises.filter(e => !e._isNew).map(e => e.id))
  const toDelete = dbIds.filter(id => !keep.has(id)), update = [], insert = []
  exercises.forEach((ex, i) => { const p = buildPayload(ex, planId, i); ex._isNew ? insert.push(p) : update.push({ id: ex.id, ...p }) })
  return { toDelete, update, insert }
}

// ── ultimo carico fatto dal cliente ──
export function lastLoads(logs, exercises) {
  const out = {}
  for (const ex of exercises) {
    const mine = (logs || []).filter(l => (l.exercise_id && l.exercise_id === ex.id) || l.exercise_name === ex.exercise_name)
    if (!mine.length) continue
    const date = mine.reduce((m, l) => l.log_date > m ? l.log_date : m, '0000-00-00'), day = mine.filter(l => l.log_date === date)
    const best = day.reduce((b, l) => (Number(l.weight_kg) || 0) > (Number(b.weight_kg) || 0) || ((Number(l.weight_kg) || 0) === (Number(b.weight_kg) || 0) && (l.reps_done || 0) > (b.reps_done || 0)) ? l : b, day[0])
    out[ex.id] = { kg: best.weight_kg == null || best.weight_kg === '' ? null : Number(best.weight_kg), reps: best.reps_done ?? null, date, sets: day.length }
  }
  return out
}
export function daysAgo(date, now = new Date()) {
  const a = new Date(date + 'T12:00:00'), b = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), n = Math.round((b - a) / 864e5)
  if (n <= 0) return 'oggi'; if (n === 1) return 'ieri'; if (n <= 60) return `${n} giorni fa`
  return a.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: n > 300 ? 'numeric' : undefined })
}
export function lastLoadText(l, now) {
  if (!l) return ''
  const kg = l.kg == null || Number.isNaN(l.kg) ? '' : `${l.kg.toLocaleString('it-IT')} kg`, reps = l.reps == null ? '' : `${l.reps}`
  const eff = kg && reps ? `${kg} × ${reps}` : (kg || (reps ? `${reps} rip.` : ''))
  return `Ultimo: ${eff || 'serie registrata'} · ${daysAgo(l.date, now)}`
}

// ── progressione automatica delle settimane ──
const round = (v, step) => Math.round(v / step) * step
const fmt = v => String(Math.round(v * 100) / 100)
export function buildProgression({ weeks = 6, startKg = '', incKg = 2.5, sets = 3, reps = '8-10', deloadEvery = 0 } = {}) {
  const n = Math.max(1, Math.min(24, parseInt(weeks) || 1)), start = parseFloat(String(startKg).replace(',', '.')), inc = parseFloat(String(incKg).replace(',', '.')) || 0, every = parseInt(deloadEvery) || 0
  const hasKg = Number.isFinite(start); const out = []; let normal = 0, lastNormal = start
  for (let w = 1; w <= n; w++) {
    const deload = every > 1 && w % every === 0
    let kg = ''; let note = ''
    if (hasKg) {
      if (deload) { kg = fmt(round(lastNormal * 0.9, 0.5)); note = 'Scarico' }
      else { lastNormal = round(start + inc * normal, 0.25); kg = fmt(lastNormal); normal++ }
    } else if (deload) note = 'Scarico'
    out.push({ week: w, sets: parseInt(sets) || 3, reps: String(reps || '8-10'), kg, note })
  }
  return out
}

// ── bozza sul telefono ──
export const draftKey = planId => `fofit_draft_workout_${planId}`
export function signature(exercises) {
  const s = (exercises || []).map(e => [e.id, e.day_label, e.exercise_name, e.sets, e.reps, e.rest_seconds, e.tut, e.video_url, e.description, e.muscle_group, JSON.stringify(e.weekly_targets || [])].join('|')).join('\n')
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h)
}
export function writeDraft(planId, state, baseExercises) { try { localStorage.setItem(draftKey(planId), JSON.stringify({ v: 1, planId, savedAt: new Date().toISOString(), baseSig: signature(baseExercises), ...state })) } catch {} }
export function readDraft(planId) { try { const d = JSON.parse(localStorage.getItem(draftKey(planId)) || 'null'); return d && d.v === 1 && Array.isArray(d.exercises) ? d : null } catch { return null } }
export function clearDraft(planId) { try { localStorage.removeItem(draftKey(planId)) } catch {} }
// la bozza serve solo se è DIVERSA da ciò che c'è sul server (o ha giorni vuoti / rinomine in sospeso)
export const draftIsUseful = (draft, serverExercises, serverNotes) => !!draft && (signature(draft.exercises) !== signature(serverExercises) || (draft.emptyDays || []).length > 0 || (draft.renames || []).length > 0
  || (typeof serverNotes === 'string' && typeof draft.notes === 'string' && normalizeNotes(draft.notes) !== normalizeNotes(serverNotes)))
// la scheda sul server è cambiata dopo la bozza (altro dispositivo o altra sessione): ripristinare sovrascriverebbe quelle modifiche
export const draftIsStale = (draft, serverExercises) => !!draft && draft.baseSig !== signature(serverExercises)
