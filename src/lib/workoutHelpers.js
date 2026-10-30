// Funzioni pure per la creazione schede allenamento (testabili senza interfaccia)
import { EXERCISE_DB } from '../data/exerciseDatabase.js'

export const MUSCLES = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Gambe','Femorali','Glutei','Polpacci','Addominali','Cardio','Corpo libero']

const FOCUS = {
  full:  ['Gambe','Petto','Schiena','Spalle','Addominali'],
  upper: ['Petto','Schiena','Spalle','Bicipiti','Tricipiti'],
  lower: ['Gambe','Femorali','Glutei','Polpacci','Addominali'],
  push:  ['Petto','Spalle','Tricipiti'],
  pull:  ['Schiena','Bicipiti','Addominali'],
  legs:  ['Gambe','Femorali','Glutei','Polpacci'],
}
const BRO = [
  ['Petto e Tricipiti', ['Petto','Tricipiti']],
  ['Schiena e Bicipiti', ['Schiena','Bicipiti']],
  ['Gambe', FOCUS.legs],
  ['Spalle e Addominali', ['Spalle','Addominali']],
  ['Braccia e Glutei', ['Bicipiti','Tricipiti','Glutei']],
]
export const letter = i => String.fromCharCode(65 + i)

// Struttura dei giorni in base allo split scelto e al numero di sedute
export function buildStructure(split, n) {
  n = Math.max(1, Math.min(7, parseInt(n) || 3))
  let kind = split
  if (!kind || kind === 'auto') kind = n <= 3 ? 'full' : n === 4 ? 'ul' : 'ppl'
  const out = []
  if (kind === 'full') {
    for (let i = 0; i < n; i++) out.push({ title: `Full Body ${letter(i)}`, focus: FOCUS.full })
  } else if (kind === 'ul') {
    for (let i = 0; i < n; i++) { const up = i % 2 === 0; out.push({ title: `${up ? 'Upper' : 'Lower'} ${letter(Math.floor(i / 2))}`, focus: up ? FOCUS.upper : FOCUS.lower }) }
  } else if (kind === 'ppl') {
    const seq = [['Push', FOCUS.push], ['Pull', FOCUS.pull], ['Gambe', FOCUS.legs]]
    for (let i = 0; i < n; i++) { const [t, f] = seq[i % 3]; out.push({ title: n > 3 ? `${t} ${letter(Math.floor(i / 3))}` : t, focus: f }) }
  } else { // bro
    for (let i = 0; i < n; i++) { const [t, f] = BRO[i % BRO.length]; out.push({ title: i >= BRO.length ? `${t} B` : t, focus: f }) }
  }
  return out
}

// Libreria raggruppata per gruppo muscolare (solo nomi) da mandare all'AI
export function libraryByMuscle() {
  const lib = {}
  EXERCISE_DB.forEach(e => { (lib[e.muscle] = lib[e.muscle] || []).push(e.name) })
  return lib
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['con','di','al','alla','a','da','e','il','la','lo','i','le','in','su','del','della'])
const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t))

// Collega il nome proposto dall'AI a un esercizio della libreria (per avere video e gruppo muscolare giusti)
export function matchExercise(name, muscleHint) {
  const n = norm(name); if (!n) return null
  const exact = EXERCISE_DB.find(e => norm(e.name) === n)
  if (exact) return exact
  const tn = new Set(tokens(name)); if (!tn.size) return null
  let best = null, bestScore = 0
  for (const e of EXERCISE_DB) {
    const te = new Set(tokens(e.name)); if (!te.size) continue
    let inter = 0; tn.forEach(t => { if (te.has(t)) inter++ })
    const score = inter / (tn.size + te.size - inter)
    const need = muscleHint && e.muscle !== muscleHint ? 0.75 : 0.6
    if (score >= need && score > bestScore) { best = e; bestScore = score }
  }
  return best
}

export function normalizeMuscle(m) {
  const k = norm(m)
  const hit = MUSCLES.find(x => norm(x) === k)
  if (hit) return hit
  if (/quadricipit|gamb|squat|leg/.test(k)) return 'Gambe'
  if (/dors|schien|trapez|lombar/.test(k)) return 'Schiena'
  if (/addom|core|plank/.test(k)) return 'Addominali'
  if (/pett|pettor/.test(k)) return 'Petto'
  if (/spall|deltoid/.test(k)) return 'Spalle'
  if (/bicip/.test(k)) return 'Bicipiti'
  if (/tricip/.test(k)) return 'Tricipiti'
  if (/glute/.test(k)) return 'Glutei'
  if (/femor|hamstring/.test(k)) return 'Femorali'
  if (/polpac|calf/.test(k)) return 'Polpacci'
  if (/cardio|corsa|bici/.test(k)) return 'Cardio'
  return 'Corpo libero'
}

// weekly_targets come li legge l'app del cliente: [{week, sets, reps, kg, note}]
export function makeWeeklyTargets(ex) {
  const weeks = parseInt(ex.prog_weeks) || 0
  if (weeks <= 0) return []
  const start = parseFloat(String(ex.prog_start_kg ?? '').replace(',', '.'))
  const inc = parseFloat(String(ex.prog_inc_kg ?? '').replace(',', '.')) || 0
  return Array.from({ length: weeks }, (_, k) => ({
    week: k + 1,
    sets: parseInt(ex.sets) || 3,
    reps: String(ex.reps || ''),
    kg: isNaN(start) ? '' : String(Math.round((start + inc * k) * 100) / 100),
    note: '',
  }))
}

export function estimateMinutes(exercises) {
  if (!exercises.length) return 0
  const sec = exercises.reduce((s, e) => s + (parseInt(e.sets) || 0) * (45 + (parseInt(e.rest_seconds) || 60)), 0)
  return Math.round(sec / 60) + 8 // + riscaldamento
}
export const totalSets = exercises => exercises.reduce((s, e) => s + (parseInt(e.sets) || 0), 0)

export function volumeByMuscle(days) {
  const v = {}
  days.forEach(d => d.exercises.forEach(e => { const m = e.muscle_group || 'Altro'; v[m] = (v[m] || 0) + (parseInt(e.sets) || 0) }))
  return v
}

export const dayLabel = (i, title) => `Giorno ${letter(i)}${title && title.trim() ? ' - ' + title.trim() : ''}`
export const parseDayTitle = label => String(label || '').replace(/^Giorno\s+[A-Za-z0-9]+\s*[-–—:]?\s*/i, '').trim()

// Righe pronte per workout_exercises: SOLO colonne esistenti (le stesse che scrive l'importazione, che funziona)
export function buildExerciseRows(planId, days) {
  const rows = []; let order = 0
  days.forEach((d, di) => d.exercises.forEach(ex => {
    const weekly = makeWeeklyTargets(ex)
    const start = parseFloat(String(ex.prog_start_kg ?? '').replace(',', '.'))
    rows.push({
      plan_id: planId,
      day_label: dayLabel(di, d.title),
      order_index: order++,
      muscle_group: ex.muscle_group || '',
      exercise_name: String(ex.exercise_name || '').trim(),
      video_url: ex.video_url || '',
      description: ex.description || '',
      sets: parseInt(ex.sets) || 3,
      reps: String(ex.reps || ''),
      rest_seconds: parseInt(ex.rest_seconds) || 60,
      tut: ex.tut || '',
      progression_type: weekly.length ? 'linear' : 'none',
      progression_start_kg: isNaN(start) ? null : start,
      progression_increment_kg: parseFloat(String(ex.prog_inc_kg ?? '').replace(',', '.')) || 2.5,
      progression_weeks: parseInt(ex.prog_weeks) || 4,
      progression_start_date: null,
      weekly_targets: weekly,
    })
  }))
  return rows
}

// ── Precompilazione del form AI dall'anamnesi ──────────────────────────────
const asList = v => {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v.trim().startsWith('[')) { try { const p = JSON.parse(v); if (Array.isArray(p)) return p } catch (e) {} }
  return v ? [String(v)] : []
}
const nearest = (n, opts) => opts.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a)

export function prefillFromAnamnesi(a) {
  if (!a) return {}
  const f = {}
  if (a.data_nascita) { const y = Math.floor((Date.now() - new Date(a.data_nascita)) / (365.25 * 864e5)); if (y > 0 && y < 110) f.eta = String(y) }
  if (a.sesso) f.sesso = /^(f|d)/i.test(String(a.sesso).trim()) ? 'Donna' : /^(m|u)/i.test(String(a.sesso).trim()) ? 'Uomo' : ''   // F / Femmina / Donna — M / Maschio / Uomo
  if (a.peso_attuale) f.peso = String(a.peso_attuale)
  if (a.altezza) f.altezza = String(a.altezza)
  const ob = norm(a.obiettivo)
  if (ob) f.obiettivo = /ricomp/.test(ob) ? 'Ricomposizione corporea' : /dimagr|perd|peso|definiz/.test(ob) ? 'Dimagrimento / definizione' : /massa|ipertrof|muscol/.test(ob) ? 'Ipertrofia (massa muscolare)' : /forza/.test(ob) ? 'Forza' : /tonific/.test(ob) ? 'Tonificazione' : /postur|mobil|salute|dolor/.test(ob) ? 'Salute, postura e mobilità' : ''
  if (/^no/i.test(String(a.si_allena || ''))) f.livello = 'Principiante (0-6 mesi)'
  const fr = parseInt(String(a.frequenza_allenamento || '').match(/\d+/)?.[0]); if (fr) f.giorni = Math.max(2, Math.min(6, fr))
  const du = parseInt(String(a.durata_seduta || '').match(/\d+/)?.[0]); if (du) f.durata = nearest(du, [30, 45, 60, 75, 90])
  const lim = [a.dolori_limitazioni, ...asList(a.movimenti_fastidio)].filter(Boolean).join('; '); if (lim) f.infortuni = lim
  if (a.mal_schiena && /^s/i.test(String(a.mal_schiena))) f.mal_schiena = 'Sì' + (asList(a.zona_dolore_schiena).length ? ' — ' + asList(a.zona_dolore_schiena).join(', ') : '')
  const post = [asList(a.postura_abituale).join(', '), a.ore_seduto ? `seduto ${a.ore_seduto} ore/giorno` : '', a.tipo_lavoro ? `lavoro: ${a.tipo_lavoro}` : '', asList(a.zone_tensione).length ? `tensioni: ${asList(a.zone_tensione).join(', ')}` : ''].filter(Boolean).join('; ')
  if (post) f.postura = post
  if (a.esercizi_odia) f.evitare = String(a.esercizi_odia)
  if (a.esercizi_ama) f.preferiti = String(a.esercizi_ama)
  if (a.tipo_allenamento) f.attrezzatura = String(asList(a.tipo_allenamento).join(', '))
  return f
}
