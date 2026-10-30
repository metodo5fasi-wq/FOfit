import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useAuth } from '../App'
import { searchExercises } from '../data/exerciseDatabase.js'
import {
  MUSCLES, letter, buildStructure, libraryByMuscle, matchExercise, normalizeMuscle, buildExerciseRows,
  estimateMinutes, totalSets, volumeByMuscle, dayLabel, parseDayTitle, prefillFromAnamnesi,
} from '../lib/workoutHelpers.js'

let UID = 0
const uid = () => `e${Date.now().toString(36)}${(UID++).toString(36)}`
const newEx = (over = {}) => ({ uid: uid(), exercise_name: '', muscle_group: 'Petto', sets: 3, reps: '8-12', rest_seconds: 90, tut: '', description: '', video_url: '', prog_weeks: 0, prog_start_kg: '', prog_inc_kg: 2.5, ...over })
const newDay = (title = '', focus = null) => ({ id: uid(), title, focus, exercises: [] })
const getYtThumb = url => { const m = String(url || '').match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m ? `https://img.youtube.com/vi/${m[1]}/default.jpg` : null }
const FULL_FOCUS = ['Gambe', 'Petto', 'Schiena', 'Spalle', 'Addominali']

const OBIETTIVI = ['Ipertrofia (massa muscolare)', 'Forza', 'Dimagrimento / definizione', 'Ricomposizione corporea', 'Tonificazione', 'Salute, postura e mobilità', 'Performance sportiva']
const LIVELLI = ['Principiante (0-6 mesi)', 'Intermedio (6 mesi - 2 anni)', 'Avanzato (oltre 2 anni)']
const SPLITS = [['auto', 'Automatico (consigliato)'], ['full', 'Full body'], ['ul', 'Upper / Lower'], ['ppl', 'Push / Pull / Gambe'], ['bro', 'Per gruppi muscolari']]
const ATTREZZATURE = ['Palestra completa', 'Palestra base (macchine e manubri)', 'Casa con manubri ed elastici', 'Casa a corpo libero', 'Kettlebell / funzionale']
const EMPTY_FORM = { eta: '', sesso: '', peso: '', altezza: '', obiettivo: '', livello: '', giorni: 3, durata: 60, split: 'auto', attrezzatura: '', infortuni: '', mal_schiena: '', postura: '', evitare: '', preferiti: '', enfasi: [], cardio: false, correttivo: false, noteExtra: '' }
const LIB = libraryByMuscle()

const S = {
  page: { minHeight: '100dvh', background: '#080808', color: '#F0F0F0', fontFamily: 'inherit', overflowY: 'auto' },
  topbar: { background: '#080808', borderBottom: '0.5px solid #111', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 },
  card: { background: '#0D0D0D', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: '0.5px solid #1C1C1C' },
  label: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 },
  input: { width: '100%', padding: '9px 11px', border: '0.5px solid #222', borderRadius: 8, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  btn: { padding: '9px 16px', background: '#D4570A', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGray: { padding: '7px 11px', background: '#161616', color: '#DDD', border: '0.5px solid #222', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 },
  btnDanger: { padding: '6px 9px', background: 'none', color: '#E24B4A', border: '0.5px solid rgba(226,75,74,0.35)', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalBox: { background: '#0D0D0D', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 640, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', border: '0.5px solid #1C1C1C', overflow: 'hidden' },
  mHead: { padding: '16px 18px 12px', borderBottom: '0.5px solid #1A1A1A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mBody: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 18px' },
}

function Field({ label, children }) { return <div style={{ marginBottom: 9 }}><span style={S.label}>{label}</span>{children}</div> }
function Sec({ title, color, children }) { return <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8 }}>{title}</div>{children}</div> }

function ExerciseCard({ ex, first, last, selectMode, isSel, isOpen, onSel, onOpen, onChange, onMove, onDup, onRemove }) {
  const thumb = getYtThumb(ex.video_url)
  const num = { ...S.input, textAlign: 'center', padding: '7px 6px' }
  return (
    <div data-testid="ex-card" style={{ background: '#111', borderRadius: 12, padding: '10px 12px', marginBottom: 8, border: isSel ? '0.5px solid rgba(226,75,74,0.6)' : '0.5px solid #1C1C1C' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {selectMode && (
          <div onClick={onSel} role="checkbox" aria-checked={isSel} style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${isSel ? '#E24B4A' : '#444'}`, background: isSel ? 'rgba(226,75,74,0.2)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isSel && <i className="ti ti-check" style={{ fontSize: 13, color: '#E24B4A' }} />}
          </div>
        )}
        {thumb && <img src={thumb} alt="" style={{ width: 44, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
        <input value={ex.exercise_name} onChange={e => onChange({ exercise_name: e.target.value })} placeholder="Nome esercizio" aria-label="Nome esercizio"
          style={{ ...S.input, flex: 1, fontWeight: 700, background: 'transparent', border: 'none', padding: '4px 2px', fontSize: 14 }} />
        {!selectMode && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <button title="Su" disabled={first} onClick={() => onMove(-1)} style={{ ...S.btnGray, padding: '5px 7px', opacity: first ? 0.3 : 1 }}><i className="ti ti-arrow-up" style={{ fontSize: 12 }} /></button>
            <button title="Giù" disabled={last} onClick={() => onMove(1)} style={{ ...S.btnGray, padding: '5px 7px', opacity: last ? 0.3 : 1 }}><i className="ti ti-arrow-down" style={{ fontSize: 12 }} /></button>
            <button title="Duplica" onClick={onDup} style={{ ...S.btnGray, padding: '5px 7px' }}><i className="ti ti-copy" style={{ fontSize: 12 }} /></button>
            <button title="Elimina esercizio" onClick={onRemove} style={{ ...S.btnDanger, padding: '5px 7px' }}><i className="ti ti-trash" style={{ fontSize: 12 }} /></button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 1fr 1fr', gap: 6 }}>
        <div><span style={S.label}>Muscolo</span>
          <select value={ex.muscle_group} onChange={e => onChange({ muscle_group: e.target.value })} style={{ ...S.input, padding: '7px 6px', fontSize: 12 }}>
            {[...new Set([ex.muscle_group, ...MUSCLES])].filter(Boolean).map(m => <option key={m} value={m}>{m}</option>)}
          </select></div>
        <div><span style={S.label}>Serie</span><input type="number" min="1" value={ex.sets} onChange={e => onChange({ sets: e.target.value })} style={num} aria-label="Serie" /></div>
        <div><span style={S.label}>Ripet.</span><input value={ex.reps} onChange={e => onChange({ reps: e.target.value })} style={num} aria-label="Ripetizioni" /></div>
        <div><span style={S.label}>Riposo s</span><input type="number" value={ex.rest_seconds} onChange={e => onChange({ rest_seconds: e.target.value })} style={num} aria-label="Riposo" /></div>
      </div>
      <button onClick={onOpen} style={{ ...S.btnGray, marginTop: 8, fontSize: 11, padding: '5px 9px', color: '#BBB' }}>
        <i className={`ti ti-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 12 }} />
        {isOpen ? 'Nascondi dettagli' : 'Note, video, progressione'}
        {!isOpen && (ex.description || ex.video_url || parseInt(ex.prog_weeks) > 0) && <span style={{ color: '#D4570A' }}>•</span>}
      </button>
      {isOpen && (
        <div style={{ marginTop: 8 }}>
          <Field label="Note tecniche per il cliente (visibili nell'esercizio)">
            <textarea value={ex.description} onChange={e => onChange({ description: e.target.value })} rows={2} placeholder="Come eseguirlo, errori da evitare..." style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <Field label="TUT"><input value={ex.tut} onChange={e => onChange({ tut: e.target.value })} placeholder="es. 3-1-1" style={S.input} /></Field>
            <Field label="Link video (YouTube)"><input value={ex.video_url} onChange={e => onChange({ video_url: e.target.value })} placeholder="https://youtube.com/..." style={S.input} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Field label="Progressione"><select value={ex.prog_weeks} onChange={e => onChange({ prog_weeks: parseInt(e.target.value) })} style={S.input} aria-label="Settimane progressione">
              <option value={0}>Nessuna</option>{[4, 6, 8, 12].map(w => <option key={w} value={w}>{w} settimane</option>)}</select></Field>
            <Field label="Carico iniziale kg"><input value={ex.prog_start_kg} disabled={!(parseInt(ex.prog_weeks) > 0)} onChange={e => onChange({ prog_start_kg: e.target.value })} placeholder="facolt." style={{ ...S.input, opacity: parseInt(ex.prog_weeks) > 0 ? 1 : 0.4 }} /></Field>
            <Field label="+ kg a settimana"><input value={ex.prog_inc_kg} disabled={!(parseInt(ex.prog_weeks) > 0)} onChange={e => onChange({ prog_inc_kg: e.target.value })} style={{ ...S.input, opacity: parseInt(ex.prog_weeks) > 0 ? 1 : 0.4 }} /></Field>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CreaAllenamento() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { profile } = useAuth()

  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(searchParams.get('client') || '')
  const [anamnesi, setAnamnesi] = useState(null)
  const [planName, setPlanName] = useState('Scheda allenamento')
  const [days, setDays] = useState(() => [newDay('')])
  const [sel, setSel] = useState(0)
  const [saving, setSaving] = useState(false)
  const [openEx, setOpenEx] = useState(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [bulk, setBulk] = useState({ weeks: 4, inc: 2.5 })

  const [picker, setPicker] = useState(false)
  const [pSearch, setPSearch] = useState('')
  const [pMuscle, setPMuscle] = useState('Tutti')
  const [pAdded, setPAdded] = useState(0)
  const [pCustom, setPCustom] = useState('')

  const [templates, setTemplates] = useState(() => { try { return JSON.parse(localStorage.getItem('fofit_workout_day_tpl') || '[]') } catch { return [] } })
  const [showTpl, setShowTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [otherPlans, setOtherPlans] = useState([])
  const [showPreview, setShowPreview] = useState(false)

  const [showAI, setShowAI] = useState(false)
  const [aiForm, setAiForm] = useState(EMPTY_FORM)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiStatus, setAiStatus] = useState('')
  const [aiFeedback, setAiFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [regenIdx, setRegenIdx] = useState(null)

  const day = days[Math.min(sel, days.length - 1)] || days[0]
  const dayIdx = Math.min(sel, days.length - 1)

  useEffect(() => { supabase.from('profiles').select('id,full_name').eq('role', 'client').order('full_name').then(({ data }) => setClients(data || [])) }, [])
  useEffect(() => {
    if (!selectedClient) { setAnamnesi(null); return }
    supabase.from('anamnesi').select('*').eq('client_id', selectedClient).maybeSingle().then(({ data }) => {
      setAnamnesi(data || null)
      setAiForm({ ...EMPTY_FORM, ...prefillFromAnamnesi(data) })
    })
  }, [selectedClient])

  // ── giorni ──────────────────────────────────────────────
  const patchDay = (i, patch) => setDays(p => p.map((d, k) => k === i ? { ...d, ...patch } : d))
  const patchEx = (uidv, patch) => setDays(p => p.map((d, k) => k !== dayIdx ? d : { ...d, exercises: d.exercises.map(e => e.uid === uidv ? { ...e, ...patch } : e) }))
  function addDay() { if (days.length >= 7) { toast('Massimo 7 giorni', 'error'); return } setDays(p => [...p, newDay('')]); setSel(days.length) }
  function removeDay(i) {
    if (days.length <= 1) return
    if (days[i].exercises.length && !window.confirm('Eliminare questo giorno e i suoi esercizi?')) return
    setDays(p => p.filter((_, k) => k !== i)); setSel(s => Math.max(0, Math.min(s, days.length - 2)))
  }
  function duplicateDay(i) {
    if (days.length >= 7) { toast('Massimo 7 giorni', 'error'); return }
    const src = days[i]
    setDays(p => [...p, { ...src, id: uid(), title: src.title ? src.title + ' (copia)' : '', exercises: src.exercises.map(e => ({ ...e, uid: uid() })) }])
    setSel(days.length); toast('Giorno duplicato', 'success')
  }

  // ── esercizi ────────────────────────────────────────────
  function addExercise(over) {
    const ex = newEx({ muscle_group: pMuscle !== 'Tutti' ? pMuscle : 'Petto', ...over })
    patchDay(dayIdx, { exercises: [...day.exercises, ex] }); setPAdded(n => n + 1)
  }
  function moveEx(i, dir) {
    const arr = [...day.exercises]; const j = i + dir; if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]; patchDay(dayIdx, { exercises: arr })
  }
  const dupEx = i => { const arr = [...day.exercises]; arr.splice(i + 1, 0, { ...arr[i], uid: uid() }); patchDay(dayIdx, { exercises: arr }) }
  const removeEx = uidv => patchDay(dayIdx, { exercises: day.exercises.filter(e => e.uid !== uidv) })
  function deleteSelected() {
    const n = selected.size
    patchDay(dayIdx, { exercises: day.exercises.filter(e => !selected.has(e.uid)) })
    setSelected(new Set()); setSelectMode(false); toast(`${n} esercizi eliminati`, 'success')
  }
  function applyBulkProgression() {
    const weeks = parseInt(bulk.weeks) || 0
    setDays(p => p.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, prog_weeks: weeks, prog_inc_kg: parseFloat(bulk.inc) || 2.5 })) })))
    toast(weeks ? `Progressione di ${weeks} settimane applicata a tutta la scheda` : 'Progressione rimossa da tutta la scheda', 'success')
  }

  // ── template di giorno ──────────────────────────────────
  function saveTemplate() {
    if (!tplName.trim() || !day.exercises.length) return
    const t = { id: Date.now(), name: tplName.trim(), title: day.title, exercises: day.exercises.map(({ uid: _u, ...rest }) => rest) }
    const next = [...templates, t]; setTemplates(next); localStorage.setItem('fofit_workout_day_tpl', JSON.stringify(next)); setTplName(''); toast('Template salvato', 'success')
  }
  function useTemplate(t) {
    patchDay(dayIdx, { title: day.title || t.title, exercises: [...day.exercises, ...t.exercises.map(e => ({ ...newEx(), ...e, uid: uid() }))] })
    setShowTpl(false); toast(`"${t.name}" aggiunto al giorno`, 'success')
  }
  function deleteTemplate(id) { const next = templates.filter(t => t.id !== id); setTemplates(next); localStorage.setItem('fofit_workout_day_tpl', JSON.stringify(next)) }

  // ── importa scheda di un altro cliente ──────────────────
  async function openImport() {
    const { data } = await supabase.from('workout_plans').select('id,title,client_id').eq('is_active', true).neq('client_id', selectedClient).limit(40)
    setOtherPlans((data || []).map(p => ({ ...p, clientName: clients.find(c => c.id === p.client_id)?.full_name || '—' }))); setShowImport(true)
  }
  async function importPlan(planId) {
    const { data } = await supabase.from('workout_exercises').select('*').eq('plan_id', planId).order('order_index')
    if (!data?.length) { toast('Scheda vuota', 'error'); return }
    const order = [...new Set(data.map(e => e.day_label))]
    setDays(order.slice(0, 7).map(lbl => ({ id: uid(), title: parseDayTitle(lbl), focus: null, exercises: data.filter(e => e.day_label === lbl).map(e => newEx({
      exercise_name: e.exercise_name, muscle_group: e.muscle_group || 'Corpo libero', sets: e.sets || 3, reps: e.reps || '', rest_seconds: e.rest_seconds || 60,
      tut: e.tut || '', description: e.description || '', video_url: e.video_url || '', prog_weeks: Array.isArray(e.weekly_targets) ? e.weekly_targets.length : 0,
      prog_start_kg: e.progression_start_kg ?? '', prog_inc_kg: e.progression_increment_kg ?? 2.5 })) })))
    setSel(0); setShowImport(false); toast('Scheda importata come base', 'success')
  }

  // ── AI ──────────────────────────────────────────────────
  const setF = (k, v) => setAiForm(f => ({ ...f, [k]: v }))
  function aiToEx(e) {
    const m = matchExercise(e.name, normalizeMuscle(e.muscle))
    return newEx({ exercise_name: m ? m.name : e.name, muscle_group: m ? m.muscle : normalizeMuscle(e.muscle), sets: e.sets, reps: e.reps, rest_seconds: e.rest, tut: e.tut || '', description: e.note || '', video_url: m ? m.yt : '' })
  }
  async function runAI({ onlyDay = null, extraNote = '' } = {}) {
    const form = { ...aiForm, noteExtra: [aiForm.noteExtra, extraNote].filter(Boolean).join('. ') }
    let structure
    if (onlyDay !== null) {
      const d = days[onlyDay]; const g = [...new Set(d.exercises.map(e => e.muscle_group))].filter(m => MUSCLES.includes(m))
      structure = [{ title: d.title || `Giorno ${letter(onlyDay)}`, focus: d.focus?.length ? d.focus : (g.length ? g : FULL_FOCUS) }]
    } else structure = buildStructure(form.split, form.giorni)
    const avoid = onlyDay !== null ? days.filter((_, i) => i !== onlyDay).flatMap(d => d.exercises.map(e => e.exercise_name)).filter(Boolean) : []
    setAiLoading(true); setAiProgress(5); setAiStatus('Analisi del cliente...'); setShowFeedback(false)
    if (onlyDay !== null) setRegenIdx(onlyDay)
    const msgs = ['Analisi del cliente...', ...structure.map(s => s.title + '...'), 'Valutazione finale...']
    let cur = 5
    const timer = setInterval(() => { cur = Math.min(cur + 1.2, 88); setAiProgress(Math.round(cur)); setAiStatus(msgs[Math.min(Math.floor((cur - 5) / (83 / msgs.length)), msgs.length - 1)]) }, 400)
    try {
      const res = await fetch('/api/generate-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'workout', formData: form, structure, library: LIB, avoid }) })
      clearInterval(timer); setAiProgress(95); setAiStatus('Costruzione scheda...')
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Errore generazione')
      if (!Array.isArray(data.days) || !data.days.length) throw new Error('Risposta non valida')
      const mapped = data.days.map(d => ({ id: uid(), title: d.title, focus: d.focus, exercises: (d.exercises || []).map(aiToEx) }))
      if (onlyDay !== null) { setDays(p => p.map((d, i) => i === onlyDay ? { ...d, focus: mapped[0].focus || d.focus, exercises: mapped[0].exercises } : d)); toast('Giorno rigenerato', 'success') }
      else { setDays(mapped); setSel(0); toast('Scheda generata! Rivedi e personalizza.', 'success') }
      if (data.feedback) { setAiFeedback(data.feedback); setShowFeedback(true) }
      setAiProgress(100); setShowAI(false)
    } catch (e) { clearInterval(timer); toast('Errore: ' + (e.message || 'generazione non riuscita'), 'error') }
    finally { setAiLoading(false); setAiProgress(0); setAiStatus(''); setRegenIdx(null) }
  }

  // ── salvataggio (colonne reali; la scheda attuale resta attiva finché la nuova non è completa) ──
  async function savePlan() {
    if (!selectedClient) { toast('Seleziona un cliente', 'error'); return }
    const filled = days.filter(d => d.exercises.length)
    if (!filled.length) { toast('Aggiungi almeno un esercizio', 'error'); return }
    if (filled.some(d => d.exercises.some(e => !String(e.exercise_name || '').trim()))) { toast('Ci sono esercizi senza nome', 'error'); return }
    if (!profile?.id) { toast('Sessione scaduta, ricarica la pagina', 'error'); return }
    setSaving(true); let newPlanId = null
    try {
      const { data: plan, error: planErr } = await supabase.from('workout_plans').insert({ client_id: selectedClient, created_by: profile.id, title: planName || 'Scheda allenamento', is_active: false }).select().single()
      if (planErr) throw planErr
      newPlanId = plan.id
      const { error: exErr } = await supabase.from('workout_exercises').insert(buildExerciseRows(plan.id, filled))
      if (exErr) throw exErr
      const { error: offErr } = await supabase.from('workout_plans').update({ is_active: false }).eq('client_id', selectedClient).neq('id', plan.id)
      if (offErr) throw offErr
      const { error: onErr } = await supabase.from('workout_plans').update({ is_active: true }).eq('id', plan.id)
      if (onErr) throw onErr
      toast('Scheda salvata! 🎉', 'success'); setTimeout(() => navigate(`/modifica-allenamento/${plan.id}`), 800)
    } catch (e) {
      if (newPlanId) { try { await supabase.from('workout_plans').delete().eq('id', newPlanId) } catch (_) {} }
      toast('Errore: ' + (e.message || 'salvataggio non riuscito') + ' — la scheda precedente del cliente non è stata toccata', 'error')
    }
    setSaving(false)
  }

  // ── numeri riepilogo ────────────────────────────────────
  const volume = volumeByMuscle(days)
  const clientName = clients.find(c => c.id === selectedClient)?.full_name
  const pickerList = (() => {
    let list = pSearch.trim().length >= 2 ? searchExercises(pSearch) : []
    if (pSearch.trim().length < 2 && pMuscle !== 'Tutti') list = Object.entries(LIB).filter(([m]) => m === pMuscle).flatMap(([, names]) => names.map(n => ({ name: n, muscle: pMuscle })))
    if (pMuscle !== 'Tutti') list = list.filter(e => e.muscle === pMuscle)
    return list.slice(0, 60)
  })()

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <button onClick={() => navigate('/admin')} style={{ width: 34, height: 34, borderRadius: 9, border: '0.5px solid #222', background: '#161616', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F0F0F0', flexShrink: 0 }}><i className="ti ti-arrow-left" style={{ fontSize: 16 }} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Crea Scheda Allenamento</div>
          {clientName && <div style={{ fontSize: 10, color: '#999' }}>{clientName}</div>}
        </div>
        <button onClick={() => setShowAI(true)} style={{ ...S.btnGray, background: 'rgba(155,89,182,0.12)', color: '#C39BE0', border: '0.5px solid rgba(155,89,182,0.3)' }}><i className="ti ti-sparkles" style={{ fontSize: 13 }} />AI</button>
        <button onClick={() => setShowPreview(true)} style={{ ...S.btnGray, color: '#8CC2F5', border: '0.5px solid rgba(74,144,212,0.35)', background: 'rgba(74,144,212,0.1)' }}><i className="ti ti-eye" style={{ fontSize: 13 }} />Anteprima</button>
        <button onClick={savePlan} disabled={saving} style={S.btn}><i className="ti ti-device-floppy" style={{ fontSize: 13 }} />{saving ? 'Salvo...' : 'Salva'}</button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '14px 16px 40px' }}>
        {showFeedback && aiFeedback && (
          <div style={{ ...S.card, background: 'rgba(155,89,182,0.08)', border: '0.5px solid rgba(155,89,182,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#C39BE0' }}><i className="ti ti-sparkles" style={{ fontSize: 12 }} /> Valutazione AI — modifica e applica</div>
              <button onClick={() => setShowFeedback(false)} style={{ ...S.btnGray, padding: '3px 7px' }}>✕</button>
            </div>
            <textarea value={aiFeedback} onChange={e => setAiFeedback(e.target.value)} rows={4} style={{ ...S.input, background: 'rgba(155,89,182,0.06)', border: '0.5px solid rgba(155,89,182,0.3)', lineHeight: 1.6, resize: 'vertical' }} />
            <div style={{ fontSize: 10, color: '#888', margin: '6px 0 8px' }}>Scrivi le tue modifiche (es. "aggiungi più lavoro per i glutei", "togli le trazioni") e rigenera la scheda.</div>
            <button onClick={() => runAI({ extraNote: 'MODIFICHE RICHIESTE: ' + aiFeedback })} style={{ ...S.btn, background: 'rgba(155,89,182,0.85)', fontSize: 12 }}><i className="ti ti-refresh" style={{ fontSize: 12 }} />Rigenera con queste modifiche</button>
          </div>
        )}

        <div style={S.card}>
          <Field label="Cliente">
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={S.input} aria-label="Cliente">
              <option value="">— Seleziona cliente —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Nome scheda"><input value={planName} onChange={e => setPlanName(e.target.value)} style={S.input} placeholder="es. Scheda ipertrofia fase 1" /></Field>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={openImport} disabled={!selectedClient} style={{ ...S.btnGray, opacity: selectedClient ? 1 : 0.5 }}><i className="ti ti-copy" style={{ fontSize: 12 }} />Copia da altro cliente</button>
            <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Progressione carichi a tutta la scheda:</span>
            <select value={bulk.weeks} onChange={e => setBulk(b => ({ ...b, weeks: e.target.value }))} style={{ ...S.input, width: 'auto', padding: '6px 8px', fontSize: 12 }} aria-label="Settimane progressione scheda">
              <option value={0}>Nessuna</option>{[4, 6, 8, 12].map(w => <option key={w} value={w}>{w} sett.</option>)}</select>
            <input value={bulk.inc} onChange={e => setBulk(b => ({ ...b, inc: e.target.value }))} style={{ ...S.input, width: 56, padding: '6px 6px', textAlign: 'center', fontSize: 12 }} aria-label="Incremento kg" />
            <span style={{ fontSize: 11, color: '#888' }}>kg</span>
            <button onClick={applyBulkProgression} style={{ ...S.btnGray, fontSize: 11 }}>Applica</button>
          </div>
        </div>

        {/* VOLUME SETTIMANALE */}
        {Object.keys(volume).length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Volume settimanale (serie per gruppo)</div>
            {Object.entries(volume).sort((a, b) => b[1] - a[1]).map(([m, n]) => {
              const col = n < 8 ? '#E8A020' : n <= 22 ? '#3B8C5A' : '#E24B4A'
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 78, fontSize: 11, color: '#CCC' }}>{m}</div>
                  <div style={{ flex: 1, height: 6, background: '#1A1A1A', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, n / 24 * 100)}%`, height: 6, background: col, borderRadius: 4 }} /></div>
                  <div style={{ width: 24, textAlign: 'right', fontSize: 11, fontWeight: 700, color: col }}>{n}</div>
                </div>
              )
            })}
            <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>Indicativo: 10-20 serie a settimana per gruppo (verde). Giallo = poco, rosso = molto.</div>
          </div>
        )}

        {/* GIORNI */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
          {days.map((d, i) => (
            <button key={d.id} onClick={() => { setSel(i); setSelectMode(false); setSelected(new Set()) }} style={{ flexShrink: 0, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', background: i === dayIdx ? '#D4570A' : '#161616', color: i === dayIdx ? 'white' : '#DDD', border: i === dayIdx ? 'none' : '0.5px solid #222', textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Giorno {letter(i)}</div>
              <div style={{ fontSize: 9, opacity: 0.8, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || `${d.exercises.length} esercizi`}</div>
            </button>
          ))}
          {days.length < 7 && <button onClick={addDay} aria-label="Aggiungi giorno" style={{ ...S.btnGray, flexShrink: 0, borderStyle: 'dashed' }}><i className="ti ti-plus" style={{ fontSize: 13 }} />Giorno</button>}
        </div>

        <div style={S.card}>
          <Field label={`Titolo del Giorno ${letter(dayIdx)}`}><input value={day.title} onChange={e => patchDay(dayIdx, { title: e.target.value })} placeholder="es. Push — petto, spalle, tricipiti" style={S.input} aria-label="Titolo giorno" /></Field>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#BBB', marginBottom: 10 }}>
            <span><b style={{ color: '#F0F0F0' }}>{day.exercises.length}</b> esercizi</span><span><b style={{ color: '#F0F0F0' }}>{totalSets(day.exercises)}</b> serie</span><span>~<b style={{ color: '#F0F0F0' }}>{estimateMinutes(day.exercises)}</b> min</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => runAI({ onlyDay: dayIdx })} disabled={aiLoading} style={{ ...S.btnGray, color: '#8CC2F5', border: '0.5px solid rgba(74,144,212,0.35)' }}><i className="ti ti-refresh" style={{ fontSize: 12 }} />{regenIdx === dayIdx ? 'Rigenero...' : 'Rigenera giorno con AI'}</button>
            <button onClick={() => duplicateDay(dayIdx)} style={S.btnGray}><i className="ti ti-copy" style={{ fontSize: 12 }} />Duplica giorno</button>
            <button onClick={() => setShowTpl(true)} style={S.btnGray}><i className="ti ti-bookmark" style={{ fontSize: 12 }} />Template</button>
            {!selectMode
              ? <button onClick={() => setSelectMode(true)} disabled={!day.exercises.length} style={{ ...S.btnGray, color: '#E24B4A', border: '0.5px solid rgba(226,75,74,0.3)', opacity: day.exercises.length ? 1 : 0.4 }}><i className="ti ti-trash" style={{ fontSize: 12 }} />Seleziona ed elimina</button>
              : <><button onClick={deleteSelected} disabled={!selected.size} style={{ ...S.btn, background: '#E24B4A', opacity: selected.size ? 1 : 0.4 }}>Elimina ({selected.size})</button><button onClick={() => { setSelectMode(false); setSelected(new Set()) }} style={S.btnGray}>Annulla</button></>}
            {days.length > 1 && <button onClick={() => removeDay(dayIdx)} style={{ ...S.btnDanger, marginLeft: 'auto' }}>Elimina giorno</button>}
          </div>
        </div>

        {day.exercises.map((ex, i) => (
          <ExerciseCard key={ex.uid} ex={ex} first={i === 0} last={i === day.exercises.length - 1} selectMode={selectMode} isSel={selected.has(ex.uid)} isOpen={openEx.has(ex.uid)}
            onSel={() => setSelected(s => { const n = new Set(s); n.has(ex.uid) ? n.delete(ex.uid) : n.add(ex.uid); return n })}
            onOpen={() => setOpenEx(s => { const n = new Set(s); n.has(ex.uid) ? n.delete(ex.uid) : n.add(ex.uid); return n })}
            onChange={patch => patchEx(ex.uid, patch)} onMove={dir => moveEx(i, dir)} onDup={() => dupEx(i)} onRemove={() => removeEx(ex.uid)} />
        ))}
        {!day.exercises.length && <div style={{ textAlign: 'center', color: '#777', fontSize: 12, padding: '18px 0' }}>Nessun esercizio in questo giorno. Aggiungine uno o usa l'AI.</div>}

        <button onClick={() => { setPicker(true); setPAdded(0); setPSearch(''); setPCustom('') }} style={{ ...S.btn, width: '100%', justifyContent: 'center', padding: 13 }}><i className="ti ti-plus" style={{ fontSize: 15 }} />Aggiungi esercizio — Giorno {letter(dayIdx)}</button>
      </div>

      {/* SELEZIONE ESERCIZI */}
      {picker && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setPicker(false) }}>
          <div style={{ ...S.modalBox, height: '88dvh' }}>
            <div style={S.mHead}><div style={{ fontWeight: 700, fontSize: 14 }}>Aggiungi esercizio{pAdded > 0 ? ` · ${pAdded} aggiunti` : ''}</div><button onClick={() => setPicker(false)} style={{ ...S.btn, padding: '6px 14px' }}>{pAdded > 0 ? 'Fatto' : 'Chiudi'}</button></div>
            <div style={{ padding: '10px 18px 0', flexShrink: 0 }}>
              <input autoFocus value={pSearch} onChange={e => setPSearch(e.target.value)} placeholder="Cerca tra 179 esercizi..." style={S.input} aria-label="Cerca esercizio" />
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '8px 0' }}>
                {['Tutti', ...MUSCLES].map(m => <button key={m} onClick={() => setPMuscle(m)} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: pMuscle === m ? 700 : 400, background: pMuscle === m ? '#D4570A' : '#161616', color: pMuscle === m ? 'white' : '#CCC', border: pMuscle === m ? 'none' : '0.5px solid #222' }}>{m}</button>)}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {pickerList.map(e => (
                <div key={e.name} onClick={() => { const m = matchExercise(e.name, e.muscle); addExercise({ exercise_name: e.name, muscle_group: e.muscle, video_url: m?.yt || e.yt || '' }) }} style={{ padding: '11px 18px', borderBottom: '0.5px solid #111', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div><div style={{ fontSize: 10, color: '#888' }}>{e.muscle}</div></div>
                  <i className="ti ti-plus" style={{ color: '#D4570A', fontSize: 16 }} />
                </div>
              ))}
              {!pickerList.length && <div style={{ padding: 24, textAlign: 'center', color: '#777', fontSize: 12 }}>{pSearch.trim().length >= 2 ? 'Nessun risultato' : 'Scegli un gruppo muscolare o cerca per nome'}</div>}
            </div>
            <div style={{ padding: '10px 18px', borderTop: '0.5px solid #1A1A1A', flexShrink: 0, display: 'flex', gap: 8 }}>
              <input value={pCustom} onChange={e => setPCustom(e.target.value)} placeholder="Esercizio personalizzato..." style={S.input} aria-label="Esercizio personalizzato" />
              <button onClick={() => { if (!pCustom.trim()) return; addExercise({ exercise_name: pCustom.trim() }); setPCustom('') }} style={S.btn}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE */}
      {showTpl && (
        <div style={S.modal}><div style={S.modalBox}>
          <div style={S.mHead}><div style={{ fontWeight: 700, fontSize: 14 }}>Template di giornata</div><button onClick={() => setShowTpl(false)} style={{ ...S.btnGray, padding: '3px 9px' }}>✕</button></div>
          <div style={S.mBody}>
            {day.exercises.length > 0 && (
              <div style={{ background: '#111', borderRadius: 10, padding: 10, marginBottom: 12, border: '0.5px solid #222' }}>
                <span style={S.label}>Salva il Giorno {letter(dayIdx)} come template</span>
                <div style={{ display: 'flex', gap: 6 }}><input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="es. Push classico" style={S.input} aria-label="Nome template" /><button onClick={saveTemplate} style={S.btn}>Salva</button></div>
              </div>
            )}
            {!templates.length && <div style={{ textAlign: 'center', color: '#777', fontSize: 12, padding: 16 }}>Nessun template salvato.</div>}
            {templates.map(t => (
              <div key={t.id} style={{ background: '#161616', borderRadius: 10, padding: 12, marginBottom: 8, border: '0.5px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div><div style={{ fontSize: 10, color: '#999' }}>{t.exercises.length} esercizi</div></div>
                  <div style={{ display: 'flex', gap: 5 }}><button onClick={() => useTemplate(t)} style={S.btn}>Usa</button><button onClick={() => deleteTemplate(t.id)} style={S.btnDanger}>✕</button></div>
                </div>
                <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>{t.exercises.slice(0, 3).map(e => e.exercise_name).join(', ')}{t.exercises.length > 3 ? '...' : ''}</div>
              </div>
            ))}
          </div>
        </div></div>
      )}

      {/* IMPORTA */}
      {showImport && (
        <div style={S.modal}><div style={S.modalBox}>
          <div style={S.mHead}><div><div style={{ fontWeight: 700, fontSize: 14 }}>Copia scheda da altro cliente</div><div style={{ fontSize: 10, color: '#888' }}>Verrà usata come base: potrai modificarla liberamente</div></div><button onClick={() => setShowImport(false)} style={{ ...S.btnGray, padding: '3px 9px' }}>✕</button></div>
          <div style={S.mBody}>
            {!otherPlans.length && <div style={{ textAlign: 'center', color: '#777', fontSize: 12, padding: 16 }}>Nessuna scheda attiva di altri clienti.</div>}
            {otherPlans.map(p => (
              <div key={p.id} style={{ background: '#161616', borderRadius: 10, padding: 12, marginBottom: 8, border: '0.5px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div><div style={{ fontSize: 10, color: '#999' }}>{p.clientName}</div></div>
                <button onClick={() => importPlan(p.id)} style={S.btn}>Importa</button>
              </div>
            ))}
          </div>
        </div></div>
      )}

      {/* ANTEPRIMA */}
      {showPreview && (
        <div style={S.modal}><div style={S.modalBox}>
          <div style={S.mHead}><div style={{ fontWeight: 700, fontSize: 14 }}>Anteprima scheda</div><button onClick={() => setShowPreview(false)} style={{ ...S.btnGray, padding: '3px 9px' }}>✕</button></div>
          <div style={S.mBody}>
            {days.map((d, i) => (
              <div key={d.id} style={{ background: '#161616', borderRadius: 10, padding: 12, marginBottom: 8, border: '0.5px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{dayLabel(i, d.title)}</div>
                  <div style={{ fontSize: 10, color: '#999' }}>{d.exercises.length} es. · {totalSets(d.exercises)} serie · ~{estimateMinutes(d.exercises)} min</div>
                </div>
                {d.exercises.map(e => <div key={e.uid} style={{ fontSize: 11, color: '#CCC', padding: '2px 0' }}>{e.exercise_name || '(senza nome)'} <span style={{ color: '#888' }}>— {e.sets}×{e.reps} · {e.rest_seconds}s{parseInt(e.prog_weeks) > 0 ? ` · progressione ${e.prog_weeks} sett.` : ''}</span></div>)}
                {!d.exercises.length && <div style={{ fontSize: 11, color: '#666' }}>Giorno vuoto: non verrà salvato</div>}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 18px', borderTop: '0.5px solid #1A1A1A' }}><button onClick={() => { setShowPreview(false); savePlan() }} disabled={saving} style={{ ...S.btn, width: '100%', justifyContent: 'center', padding: 12 }}><i className="ti ti-device-floppy" style={{ fontSize: 14 }} />Salva scheda nel profilo cliente</button></div>
        </div></div>
      )}

      {/* AI */}
      {showAI && (
        <div style={S.modal}><div style={S.modalBox}>
          <div style={S.mHead}>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}><i className="ti ti-sparkles" style={{ color: '#C39BE0' }} /> Genera scheda con AI</div><div style={{ fontSize: 10, color: '#888' }}>{anamnesi ? 'Campi precompilati dall\'anamnesi del cliente: controlla e correggi' : 'Compila i dati del cliente'}</div></div>
            {!aiLoading && <button onClick={() => setShowAI(false)} style={{ ...S.btnGray, padding: '3px 9px' }}>✕</button>}
          </div>
          {!aiLoading ? (
            <div style={S.mBody}>
              <Sec title="👤 Cliente" color="#4A90D4">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Età"><input value={aiForm.eta} onChange={e => setF('eta', e.target.value)} style={S.input} aria-label="Età" /></Field>
                  <Field label="Sesso"><select value={aiForm.sesso} onChange={e => setF('sesso', e.target.value)} style={S.input}><option value="">—</option><option>Uomo</option><option>Donna</option></select></Field>
                  <Field label="Peso (kg)"><input value={aiForm.peso} onChange={e => setF('peso', e.target.value)} style={S.input} /></Field>
                  <Field label="Altezza (cm)"><input value={aiForm.altezza} onChange={e => setF('altezza', e.target.value)} style={S.input} /></Field>
                </div>
              </Sec>
              <Sec title="🎯 Obiettivo e livello" color="#D4570A">
                <Field label="Obiettivo"><select value={aiForm.obiettivo} onChange={e => setF('obiettivo', e.target.value)} style={S.input} aria-label="Obiettivo"><option value="">—</option>{OBIETTIVI.map(o => <option key={o}>{o}</option>)}</select></Field>
                <Field label="Livello di esperienza"><select value={aiForm.livello} onChange={e => setF('livello', e.target.value)} style={S.input} aria-label="Livello"><option value="">—</option>{LIVELLI.map(o => <option key={o}>{o}</option>)}</select></Field>
              </Sec>
              <Sec title="📅 Organizzazione" color="#3B8C5A">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8 }}>
                  <Field label="Giorni/settimana"><select value={aiForm.giorni} onChange={e => setF('giorni', parseInt(e.target.value))} style={S.input} aria-label="Giorni a settimana">{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
                  <Field label="Durata (min)"><select value={aiForm.durata} onChange={e => setF('durata', parseInt(e.target.value))} style={S.input} aria-label="Durata seduta">{[30, 45, 60, 75, 90].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
                  <Field label="Divisione"><select value={aiForm.split} onChange={e => setF('split', e.target.value)} style={S.input} aria-label="Divisione">{SPLITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                </div>
                <Field label="Dove si allena / attrezzatura"><select value={aiForm.attrezzatura} onChange={e => setF('attrezzatura', e.target.value)} style={S.input} aria-label="Attrezzatura"><option value="">—</option>{[...new Set([aiForm.attrezzatura, ...ATTREZZATURE].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></Field>
              </Sec>
              <Sec title="⚠️ Salute, postura e limitazioni" color="#E24B4A">
                <Field label="Infortuni, dolori, movimenti da evitare"><textarea value={aiForm.infortuni} onChange={e => setF('infortuni', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} aria-label="Infortuni" /></Field>
                <Field label="Mal di schiena"><input value={aiForm.mal_schiena} onChange={e => setF('mal_schiena', e.target.value)} placeholder="es. Sì — zona lombare" style={S.input} aria-label="Mal di schiena" /></Field>
                <Field label="Postura e lavoro sedentario"><textarea value={aiForm.postura} onChange={e => setF('postura', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} aria-label="Postura" /></Field>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#DDD', cursor: 'pointer' }}><input type="checkbox" checked={aiForm.correttivo} onChange={e => setF('correttivo', e.target.checked)} />Includi esercizi correttivi di mobilità, stabilità e core in ogni seduta</label>
              </Sec>
              <Sec title="❤️ Preferenze" color="#E8A020">
                <Field label="Esercizi che ama"><input value={aiForm.preferiti} onChange={e => setF('preferiti', e.target.value)} style={S.input} /></Field>
                <Field label="Esercizi che odia (da evitare)"><input value={aiForm.evitare} onChange={e => setF('evitare', e.target.value)} style={S.input} /></Field>
                <span style={S.label}>Gruppi da enfatizzare</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {MUSCLES.filter(m => m !== 'Cardio' && m !== 'Corpo libero').map(m => { const on = aiForm.enfasi.includes(m); return <button key={m} onClick={() => setF('enfasi', on ? aiForm.enfasi.filter(x => x !== m) : [...aiForm.enfasi, m])} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(212,87,10,0.2)' : '#161616', color: on ? '#F4894A' : '#CCC', border: on ? '0.5px solid rgba(212,87,10,0.5)' : '0.5px solid #222' }}>{m}</button> })}
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#DDD', cursor: 'pointer' }}><input type="checkbox" checked={aiForm.cardio} onChange={e => setF('cardio', e.target.checked)} />Aggiungi un breve finale cardio</label>
              </Sec>
              <Sec title="📝 Note del coach" color="#9B59B6"><textarea value={aiForm.noteExtra} onChange={e => setF('noteExtra', e.target.value)} rows={3} placeholder="Qualsiasi altra indicazione..." style={{ ...S.input, resize: 'vertical' }} aria-label="Note coach" /></Sec>
            </div>
          ) : (
            <div style={{ ...S.mBody, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
              <i className="ti ti-sparkles" style={{ fontSize: 36, color: '#C39BE0', marginBottom: 14 }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{aiStatus}</div>
              <div style={{ width: '100%', maxWidth: 320 }}>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#C39BE0', marginBottom: 4 }}>{aiProgress}%</div>
                <div style={{ height: 8, background: '#1A1A1A', borderRadius: 8, overflow: 'hidden' }}><div style={{ height: 8, width: `${aiProgress}%`, background: 'linear-gradient(90deg,#7C3AED,#C39BE0)', transition: 'width .4s' }} /></div>
              </div>
            </div>
          )}
          {!aiLoading && <div style={{ padding: '12px 18px', borderTop: '0.5px solid #1A1A1A' }}>
            <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginBottom: 8 }}>{buildStructure(aiForm.split, aiForm.giorni).map(d => d.title).join(' · ')}</div>
            <button onClick={() => runAI()} style={{ ...S.btn, width: '100%', justifyContent: 'center', padding: 13, background: 'rgba(155,89,182,0.85)', fontSize: 14 }}><i className="ti ti-sparkles" style={{ fontSize: 15 }} />Genera scheda completa</button>
          </div>}
        </div></div>
      )}
    </div>
  )
}
