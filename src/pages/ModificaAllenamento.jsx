import React, { useState, useEffect, useMemo, useRef } from 'react'
import { askConfirm } from '../lib/confirm'
import { done, notify } from '../lib/toast'
import { dbMust, dbSave } from '../lib/db'
import { startHandleDrag } from '../lib/dragHandle'
import { NotesEditor } from '../components/CoachNotes'
import { normalizeNotes, hasNotes, isMissingNotesColumn, MISSING_COLUMN_MSG } from '../lib/coachNotes'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EXERCISE_DB } from '../data/exerciseDatabase'
import { MAX_DAYS, dayList, suggestDayName, checkDayName, renameDay, moveDay, copyLabel, duplicateDay, addRename, validateExercises, problemsMessage, planSave, lastLoads, lastLoadText, buildProgression,
  writeDraft, readDraft, clearDraft, draftIsUseful, draftIsStale } from '../lib/workoutPlan'

const MUSCLE_GROUPS = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Gambe','Quadricipiti','Femorali','Polpacci','Glutei','Addominali','Cardio','Corpo libero','Avambracci','Mobilità e postura','Altro']

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 16px' },
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', marginBottom:10, overflow:'hidden' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'rgba(212,87,10,0.1)', color:'#F4894A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#161616', color:'#AAA', border:'0.5px solid #1C1C1C', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  btnDanger: { background:'rgba(226,75,74,0.1)', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:7, padding:'5px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 },
  input: { padding:'7px 10px', border:'0.5px solid #1C1C1C', borderRadius:7, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  label: { fontSize:10, color:'#AAA', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.07em' },
}

const EMPTY_EX = { exercise_name:'', muscle_group:'Petto', video_url:'', description:'', sets:3, reps:'10-12', rest_seconds:60, tut:'', weekly_targets:[], _isNew:true }


function WeeklyTargetsTable({ ex, onChange, compact = false }) {
  const targets = ex.weekly_targets || []
  const [gen, setGen] = useState(null)                       // riquadro "Genera progressione": null = chiuso

  function updateRow(weekNum, field, val) {
    const updated = targets.map(t =>
      t.week === weekNum ? {...t, [field]: val} : t
    )
    onChange('weekly_targets', updated)
  }

  function addWeek() {
    const last = targets.length ? targets[targets.length-1] : {sets:ex.sets||3, reps:ex.reps||'8-10', kg:'', note:''}
    onChange('weekly_targets', [...targets, {
      week: targets.length + 1,
      sets: last.sets,
      reps: last.reps,
      kg: '',
      note: ''
    }])
  }

  function removeWeek(weekNum) {
    onChange('weekly_targets', targets.filter(t=>t.week!==weekNum).map((t,i)=>({...t,week:i+1})))
  }

  function openGen() {
    const firstKg = (targets.find(t => String(t.kg || '').trim()) || {}).kg || ''
    setGen({ weeks: String(Math.max(targets.length, 6)), startKg: String(firstKg), incKg: '2.5', sets: String(ex.sets || 3), reps: String(ex.reps || '8-10'), deloadEvery: '0' })
  }
  async function applyGen() {
    if (targets.length && !(await askConfirm(`Sostituire le ${targets.length} settimane già scritte con quelle generate?`, { title: 'Generare la progressione?', confirmLabel: 'Sostituisci', danger: true }))) return
    onChange('weekly_targets', buildProgression(gen)); setGen(null); done('Progressione generata: ritocca quello che vuoi')
  }

  const inp = {padding:'6px 8px',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:12,color:'#F0F0F0',background:'#0D0D0D',outline:'none',fontFamily:'inherit',width:'100%',boxSizing:'border-box',textAlign:'center'}
  const small = {fontSize:9,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:2}
  const setG = (k, v) => setGen(g => ({ ...g, [k]: v }))

  return (
    <div style={{gridColumn:'1/-1',marginTop:4}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,gap:6,flexWrap:'wrap'}}>
        <label style={{fontSize:11,fontWeight:700,color:'#F4894A',textTransform:'uppercase',letterSpacing:'0.07em'}}>
          📅 Progressione settimanale
        </label>
        <div style={{display:'flex',gap:6}}>
          <button onClick={gen ? ()=>setGen(null) : openGen} aria-label="Genera la progressione" style={{background:'#161616',color:'#F4894A',border:'0.5px solid #D4570A',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-wand" style={{fontSize:12}}/> Genera
          </button>
          <button onClick={addWeek} style={{background:'#D4570A',color:'white',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-plus" style={{fontSize:12}}/> Settimana
          </button>
        </div>
      </div>

      {gen && (
        <div data-testid="genera-progressione" style={{background:'rgba(212,87,10,0.08)',border:'0.5px solid rgba(212,87,10,0.4)',borderRadius:10,padding:10,marginBottom:8}}>
          <div style={{fontSize:11,color:'#CCC',marginBottom:8,lineHeight:1.4}}>Compila le settimane in automatico: poi puoi ritoccarle una per una.</div>
          <div style={{display:'grid',gridTemplateColumns:compact?'1fr 1fr':'repeat(3,1fr)',gap:8,marginBottom:8}}>
            <div><label style={small}>Settimane</label><input aria-label="Numero di settimane" style={inp} type="number" inputMode="numeric" min={1} max={24} value={gen.weeks} onChange={e=>setG('weeks',e.target.value)}/></div>
            <div><label style={small}>Carico iniziale (kg)</label><input aria-label="Carico iniziale" style={inp} type="text" inputMode="decimal" value={gen.startKg} onChange={e=>setG('startKg',e.target.value)} placeholder="vuoto = senza kg"/></div>
            <div><label style={small}>Aumento a settimana (kg)</label><input aria-label="Aumento a settimana" style={inp} type="text" inputMode="decimal" value={gen.incKg} onChange={e=>setG('incKg',e.target.value)}/></div>
            <div><label style={small}>Serie</label><input aria-label="Serie della progressione" style={inp} type="number" inputMode="numeric" min={1} max={10} value={gen.sets} onChange={e=>setG('sets',e.target.value)}/></div>
            <div><label style={small}>Ripetizioni</label><input aria-label="Ripetizioni della progressione" style={inp} value={gen.reps} onChange={e=>setG('reps',e.target.value)} placeholder="8-10"/></div>
            <div><label style={small}>Scarico ogni (sett.)</label><input aria-label="Settimana di scarico ogni" style={inp} type="number" inputMode="numeric" min={0} max={12} value={gen.deloadEvery} onChange={e=>setG('deloadEvery',e.target.value)} placeholder="0 = mai"/></div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={applyGen} style={{background:'#D4570A',color:'white',border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flex:compact?1:'none'}}>✓ Genera</button>
            <button onClick={()=>setGen(null)} style={{background:'#161616',color:'#AAA',border:'0.5px solid #1C1C1C',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Annulla</button>
          </div>
        </div>
      )}

      {targets.length === 0 ? (
        <div style={{background:'#161616',borderRadius:8,padding:'12px',textAlign:'center',fontSize:12,color:'#AAA'}}>
          Aggiungi le settimane con il pulsante, oppure generale in automatico con "Genera" → il cliente vedrà automaticamente la settimana corretta
        </div>
      ) : compact ? (
        /* TELEFONO: una scheda per settimana (la tabella a 6 colonne era troppo stretta) */
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {targets.map(t=>(
            <div key={t.week} data-testid={`settimana-${t.week}`} style={{background:'#0D0D0D',border:'0.5px solid #1C1C1C',borderRadius:10,padding:'8px 10px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:800,color:'#F4894A'}}>Settimana {t.week}</span>
                <button aria-label={`Togli la settimana ${t.week}`} onClick={()=>removeWeek(t.week)} style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',fontSize:18,padding:'0 4px',lineHeight:1}}>×</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1.3fr 1.3fr',gap:8,marginBottom:6}}>
                <div><label style={small}>Serie</label><input aria-label={`Settimana ${t.week}, serie`} inputMode="numeric" style={inp} type="number" min={1} max={10} value={t.sets||''} onChange={e=>updateRow(t.week,'sets',parseInt(e.target.value)||'')}/></div>
                <div><label style={small}>Reps</label><input aria-label={`Settimana ${t.week}, ripetizioni`} style={inp} value={t.reps||''} onChange={e=>updateRow(t.week,'reps',e.target.value)} placeholder="8-10"/></div>
                <div><label style={small}>Kg</label><input aria-label={`Settimana ${t.week}, kg`} style={{...inp,fontWeight:700}} type="text" inputMode="decimal" value={t.kg||''} onChange={e=>updateRow(t.week,'kg',e.target.value)} placeholder="kg"/></div>
              </div>
              <input aria-label={`Settimana ${t.week}, descrizione`} style={{...inp,textAlign:'left',fontSize:12}} value={t.note||''} onChange={e=>updateRow(t.week,'note',e.target.value)} placeholder="es. Pesante, Deload..."/>
            </div>
          ))}
        </div>
      ) : (
        <div style={{borderRadius:10,overflow:'hidden',border:'0.5px solid #1C1C1C'}}>
          <div style={{display:'grid',gridTemplateColumns:'44px 1fr 52px 72px 68px 28px',background:'#D4570A',padding:'7px 8px',gap:6}}>
            {['Sett.','Descrizione','Serie','Reps','Kg',''].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:'white',textTransform:'uppercase',letterSpacing:'0.05em',textAlign:'center'}}>{h}</div>
            ))}
          </div>
          {targets.map((t,i)=>(
            <div key={t.week} style={{display:'grid',gridTemplateColumns:'44px 1fr 52px 72px 68px 28px',gap:6,padding:'6px 8px',background:i%2===0?'#0D0D0D':'#161616',alignItems:'center',borderBottom:'0.5px solid #1C1C1C'}}>
              <div style={{fontSize:13,fontWeight:800,color:'#F4894A',textAlign:'center'}}>S{t.week}</div>
              <input style={{...inp,textAlign:'left',fontSize:11}} value={t.note||''} onChange={e=>updateRow(t.week,'note',e.target.value)} placeholder="es. Pesante, Deload..."/>
              <input inputMode="numeric" style={inp} type="number" min={1} max={10} value={t.sets||''} onChange={e=>updateRow(t.week,'sets',parseInt(e.target.value)||'')}/>
              <input style={inp} value={t.reps||''} onChange={e=>updateRow(t.week,'reps',e.target.value)} placeholder="8-10"/>
              <input style={{...inp,fontWeight:700}} type="text" inputMode="decimal" value={t.kg||''} onChange={e=>updateRow(t.week,'kg',e.target.value)} placeholder="kg"/>
              <button aria-label={`Togli la settimana ${t.week}`} onClick={()=>removeWeek(t.week)} style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',fontSize:15,padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Riquadro per scrivere il nome di un giorno (nuovo o da rinominare): Invio conferma, Esc annulla
function AddDayForm({ value, onChange, onConfirm, onCancel, stacked, ariaLabel = 'Nome del nuovo giorno', confirmAria = 'Aggiungi il giorno', confirmText = '✓ Aggiungi', placeholder = 'Es. Giorno D - Braccia' }) {
  const ref = React.useRef(null)
  React.useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div style={{display:'flex',flexDirection:stacked?'column':'row',gap:6,alignItems:stacked?'stretch':'center',flexShrink:0}}>
      <input ref={ref} aria-label={ariaLabel} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} maxLength={40}
        onKeyDown={e=>{ if (e.key==='Enter') onConfirm(); else if (e.key==='Escape') onCancel() }}
        style={{...s.input,width:stacked?'100%':190,padding:'5px 8px',fontSize:12}} />
      <div style={{display:'flex',gap:6}}>
        <button aria-label={confirmAria} onClick={onConfirm} style={{...s.btnSm,flex:stacked?1:'none'}}>{confirmText}</button>
        <button aria-label="Annulla" onClick={onCancel} style={s.btnGray}>✕</button>
      </div>
    </div>
  )
}

export default function ModificaAllenamento() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [clientName, setClientName] = useState('')
  const [exercises, setExercises] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayLabel, setNewDayLabel] = useState('')
  const [emptyDays, setEmptyDays] = useState([])      // giorni appena aggiunti, ancora senza esercizi: esistono a schermo ma non si salvano finché non ne hanno uno
  const [addingExToDay, setAddingExToDay] = useState(null)
  const [newEx, setNewEx] = useState({ ...EMPTY_EX })
  const [expandedEx, setExpandedEx] = useState(null)
  const [allExpanded, setAllExpanded] = useState(false)
  const [searchEx, setSearchEx] = useState('')
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [showCopyModal, setShowCopyModal] = useState(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  const [showErrors, setShowErrors] = useState(false)          // dopo un tentativo di salvataggio i campi da controllare restano evidenziati in rosso
  const [renames, setRenames] = useState([])                   // giorni rinominati: lo storico delle sedute si aggiorna dopo il salvataggio
  const [clientLogs, setClientLogs] = useState([])             // serie registrate dal cliente: servono per "Ultimo carico"
  const [draftOffer, setDraftOffer] = useState(null)           // bozza non salvata trovata all'apertura
  const [renaming, setRenaming] = useState(false)
  const [notes, setNotes] = useState('')                       // note generali: il cliente le legge in cima alla sua sezione Allenamento
  const [notesOpen, setNotesOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => { if (planId) fetchPlan({ checkDraft: true }) }, [planId])

  // quiet: si rilegge senza svuotare la pagina (dopo il salvataggio prima compariva "Caricamento..." ogni volta)
  async function fetchPlan({ quiet = false, checkDraft = false } = {}) {
    if (!quiet) setLoading(true)
    const { data: planData } = await supabase.from('workout_plans').select('*').eq('id', planId).single()
    if (!planData) { setLoading(false); return }
    setPlan(planData)
    const planNotes = planData.general_notes || ''
    setNotes(planNotes); serverNotesRef.current = planNotes
    if (checkDraft) setNotesOpen(hasNotes(planNotes))          // se ci sono già note si aprono, così le vedi
    // cliente ed esercizi non dipendono l'uno dall'altro: insieme
    const [{ data: prof }, { data: exData }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', planData.client_id).single(),
      supabase.from('workout_exercises').select('*').eq('plan_id', planId).order('order_index', {ascending:true}),
    ])
    setClientName(prof?.full_name || '')
    setExercises(exData || [])
    serverRef.current = exData || []
    if (exData?.length) {
      const days = [...new Set(exData.map(e=>e.day_label))]
      setSelectedDay(prev => (prev && days.includes(prev)) ? prev : days[0])          // dopo il salvataggio si resta sul giorno in cui si era
    }
    if (checkDraft) { const d = readDraft(planId); if (draftIsUseful(d, exData || [], planNotes)) setDraftOffer(d); else if (d) clearDraft(planId) }
    setLoading(false)
    loadClientLogs(planData.client_id)
  }
  // Le serie già fatte dal cliente (per mostrare "Ultimo: 62,5 kg × 8"). Se la lettura non riesce la pagina funziona lo stesso.
  async function loadClientLogs(clientId) {
    if (!clientId) return
    try { const { data } = await supabase.from('workout_logs').select('exercise_id,exercise_name,weight_kg,reps_done,log_date').eq('client_id', clientId).order('log_date', { ascending: false }).limit(800); setClientLogs(data || []) } catch {}
  }

  const days = [...new Set([...exercises.map(e=>e.day_label), ...emptyDays])]
  const dayExercises = exercises.filter(e=>e.day_label===selectedDay)

  const serverRef = useRef([])                              // com'è la scheda sul server (serve a capire se una bozza è ancora valida)
  const serverNotesRef = useRef('')                         // e com'erano le note
  const latest = useRef({})
  latest.current = { planId, exercises, emptyDays, renames, selectedDay, dirty, draftOffer, notes }
  const exKey = exercises.map(e => e.id + '' + e.exercise_name).join('|')
  const lastMap = useMemo(() => lastLoads(clientLogs, exercises), [clientLogs, exKey])
  const invalid = useMemo(() => Object.fromEntries(validateExercises(exercises).map(p => [p.id, new Set(p.fields)])), [exercises])
  const errStyle = (ex, f) => (showErrors && invalid[ex.id]?.has(f)) ? { borderColor: '#E24B4A', background: 'rgba(226,75,74,0.08)' } : null

  // Bozza sul telefono: ogni modifica si ricorda (anche se chiudi la scheda o il telefono si spegne). Finché si sceglie cosa fare di una bozza trovata, non si sovrascrive.
  useEffect(() => {
    if (loading || !dirty || draftOffer) return
    const tm = setTimeout(() => writeDraft(planId, { exercises, emptyDays, renames, selectedDay, notes }, serverRef.current), 500)
    return () => clearTimeout(tm)
  }, [exercises, emptyDays, renames, selectedDay, notes, dirty, loading, draftOffer])
  useEffect(() => () => { const l = latest.current; if (l.dirty && !l.draftOffer) writeDraft(l.planId, { exercises: l.exercises, emptyDays: l.emptyDays, renames: l.renames, selectedDay: l.selectedDay, notes: l.notes }, serverRef.current) }, [])
  // chiudendo la finestra o ricaricando con modifiche non salvate il browser avvisa
  useEffect(() => {
    if (!dirty) return
    const h = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  async function goBack() {
    if (dirty && !(await askConfirm('Hai modifiche non salvate. Se esci restano come bozza su questo telefono e potrai ripristinarle riaprendo la scheda.', { title: 'Modifiche non salvate', confirmLabel: 'Esci', cancelLabel: 'Resta qui', danger: true }))) return
    navigate(-1)
  }
  async function discardChanges() {
    if (!(await askConfirm('Scartare tutte le modifiche non salvate? Tornerà la scheda com\'è salvata.', { title: 'Scartare le modifiche?', confirmLabel: 'Scarta', danger: true }))) return
    clearDraft(planId); setDraftOffer(null); setEmptyDays([]); setRenames([]); setDirty(false); setShowErrors(false); setRenaming(false); setShowAddDay(false)
    await fetchPlan({ quiet: true }); done('Modifiche scartate')
  }
  function restoreDraft() {
    const d = draftOffer; if (!d) return
    setExercises(d.exercises); setEmptyDays(d.emptyDays || []); setRenames(d.renames || [])
    if (typeof d.notes === 'string') { setNotes(d.notes); if (hasNotes(d.notes)) setNotesOpen(true) }
    const ds = dayList(d.exercises, d.emptyDays || []); setSelectedDay(ds.includes(d.selectedDay) ? d.selectedDay : (ds[0] || null))
    setDirty(true); setDraftOffer(null); done('Bozza ripristinata')
  }
  function discardDraft() { clearDraft(planId); setDraftOffer(null) }

  function updateEx(id, field, value) {
    setExercises(prev => prev.map(e => e.id===id ? {...e, [field]:value} : e))
    setDirty(true)
  }

  function removeEx(id) {
    setExercises(prev => prev.filter(e => e.id!==id))
    setDirty(true)
  }

  // Rimette gli esercizi di un giorno nel nuovo ordine SENZA spostare il giorno nell'elenco dei giorni (prima, riordinando, il giorno finiva in fondo)
  function reorderDay(day, ordered) { let k = 0; return exercises.map(e => e.day_label === day ? ordered[k++] : e) }

  function moveEx(id, dir) {
    const dayExs = exercises.filter(e=>e.day_label===selectedDay)
    const idx = dayExs.findIndex(e=>e.id===id)
    if (dir==='up' && idx===0) return
    if (dir==='down' && idx===dayExs.length-1) return
    const swapIdx = dir==='up' ? idx-1 : idx+1
    const newDayExs = [...dayExs]
    ;[newDayExs[idx], newDayExs[swapIdx]] = [newDayExs[swapIdx], newDayExs[idx]]
    setExercises(reorderDay(selectedDay, newDayExs))
    setDirty(true)
  }

  function duplicateEx(id) {
    const ex = exercises.find(e => e.id === id)
    if (!ex) return
    const newE = {
      ...ex,
      id: 'new-' + Date.now(),
      order_index: dayExercises.length,
      _isNew: true,
    }
    setExercises(prev => [...prev, newE])
    setDirty(true)
  }

  function copyExToDay(id, targetDay) {
    const ex = exercises.find(e => e.id === id)
    if (!ex) return
    const targetDayExs = exercises.filter(e => e.day_label === targetDay)
    const newE = {
      ...ex,
      id: 'new-' + Date.now(),
      day_label: targetDay,
      order_index: targetDayExs.length,
      _isNew: true,
    }
    setExercises(prev => [...prev, newE])
    setShowCopyModal(null)
    setDirty(true)
  }

  // Drag and drop handlers
  function handleDragStart(id) { setDragId(id) }
  function handleDragOver(e, id) { e.preventDefault(); setDragOverId(id) }
  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const dayExs = exercises.filter(e => e.day_label === selectedDay)
    const fromIdx = dayExs.findIndex(e => e.id === dragId)
    const toIdx = dayExs.findIndex(e => e.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); setDragOverId(null); return }
    const newDayExs = [...dayExs]
    const [moved] = newDayExs.splice(fromIdx, 1)
    newDayExs.splice(toIdx, 0, moved)
    setExercises(reorderDay(selectedDay, newDayExs))
    setDragId(null); setDragOverId(null)
    setDirty(true)
  }
  function handleDragEnd() { setDragId(null); setDragOverId(null) }

  // Filtra esercizi per ricerca
  const filteredDayExercises = dayExercises.filter(ex =>
    !searchEx || ex.exercise_name?.toLowerCase().includes(searchEx.toLowerCase()) ||
    ex.muscle_group?.toLowerCase().includes(searchEx.toLowerCase())
  )

  function addExercise() {
    if (!newEx.exercise_name.trim()) return
    const ex = {
      ...newEx,
      id: 'new-' + Date.now(),
      plan_id: planId,
      day_label: selectedDay,
      order_index: dayExercises.length,
    }
    setExercises(prev => [...prev, ex])
    setNewEx({ ...EMPTY_EX })
    setAddingExToDay(null)
    setDirty(true)
  }

  function openAddDay() {
    if (days.length >= MAX_DAYS) { notify('Massimo 7 giorni', 'error'); return }
    setRenaming(false); setNewDayLabel(suggestDayName(days)); setShowAddDay(true)
  }
  function cancelAddDay() { setShowAddDay(false); setNewDayLabel('') }

  // Prima il pulsante "+ Giorno" non faceva nulla: chiamava questa funzione con il nome ancora vuoto, che usciva in silenzio.
  // Il giorno nuovo non ha esercizi: esiste a schermo finché non ne aggiungi uno (un giorno vuoto non si salva, niente più esercizi "senza nome").
  function addDay() {
    const chk = checkDayName(newDayLabel, days)
    if (!chk.ok) { notify(chk.error, 'error'); return }
    if (days.length >= MAX_DAYS) { notify('Massimo 7 giorni', 'error'); return }
    setEmptyDays(p => [...p, chk.label])
    setSelectedDay(chk.label)
    setNewDayLabel(''); setShowAddDay(false)
    setSearchEx(''); setShowAddExercise(true)          // si parte subito dal primo esercizio
    done('Giorno aggiunto: aggiungi il primo esercizio')
  }

  // Rinominare un giorno: gli esercizi cambiano nome-giorno subito; le sedute GIÀ registrate dal cliente con il vecchio nome si aggiornano dopo il salvataggio
  // (altrimenti il cliente perderebbe note e confronti con le sedute precedenti, che si collegano per nome del giorno).
  function startRename() { setShowAddDay(false); setRenameValue(selectedDay); setRenaming(true) }
  async function confirmRename() {
    const chk = checkDayName(renameValue, days, { except: selectedDay })
    if (!chk.ok) { notify(chk.error, 'error'); return }
    if (chk.label === selectedDay) { setRenaming(false); return }
    const inDb = exercises.some(e => e.day_label === selectedDay && !e._isNew)
    if (inDb && plan?.client_id) {
      let n = 0
      try { const r = await supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('client_id', plan.client_id).eq('day_label', selectedDay); n = r?.count || 0 } catch {}
      const msg = n > 0 ? `Le ${n} sedute già registrate dal cliente con il nome "${selectedDay}" diventeranno "${chk.label}", così non perde note e confronti con le sedute precedenti.` : `Il giorno "${selectedDay}" si chiamerà "${chk.label}".`
      if (!(await askConfirm(msg, { title: 'Rinominare il giorno?', confirmLabel: 'Rinomina' }))) return
    }
    const r = renameDay(exercises, emptyDays, selectedDay, chk.label)
    setExercises(r.exercises); setEmptyDays(r.emptyDays)
    if (inDb) setRenames(p => addRename(p, selectedDay, chk.label))
    if (exercises.some(e => e.day_label === selectedDay)) setDirty(true)
    setSelectedDay(chk.label); setRenaming(false); done('Giorno rinominato')
  }
  function moveDayBy(dir) {
    const r = moveDay(exercises, emptyDays, selectedDay, dir); if (!r) return
    setExercises(r.exercises); setEmptyDays(r.emptyDays)
    if (r.exercises !== exercises) setDirty(true)
  }
  const canMoveDay = dir => !!moveDay(exercises, emptyDays, selectedDay, dir)
  function duplicateWholeDay() {
    if (!exercises.some(e => e.day_label === selectedDay)) { notify('Il giorno è vuoto: non c\'è nulla da duplicare', 'error'); return }
    if (days.length >= MAX_DAYS) { notify('Massimo 7 giorni', 'error'); return }
    const label = copyLabel(selectedDay, days), stamp = Date.now()
    setExercises(duplicateDay(exercises, selectedDay, label, i => `new-${stamp}-${i}`))
    setSelectedDay(label); setDirty(true); done('Giorno duplicato: puoi cambiargli il nome')
  }

  async function removeDay(dayLabel) {
    const empty = !exercises.some(e => e.day_label === dayLabel)            // un giorno ancora vuoto si toglie senza chiedere
    if (!empty && !(await askConfirm(`Rimuovere il giorno "${dayLabel}" e tutti i suoi esercizi?`, { confirmLabel: 'Rimuovi', danger: true }))) return
    setEmptyDays(prev => prev.filter(d => d !== dayLabel))
    setRenames(prev => prev.filter(r => r.to !== dayLabel))
    setExercises(prev => prev.filter(e=>e.day_label!==dayLabel))
    const remaining = days.filter(d=>d!==dayLabel)
    setSelectedDay(remaining[0] || null)
    if (!empty) setDirty(true)
  }

  // Righe già esistenti: una sola richiesta (atomica). Se il database non la accetta si scrive a gruppi di 8 in parallelo (prima: una richiesta per esercizio, in fila).
  async function writeExisting(rows) {
    try { await dbMust(supabase.from('workout_exercises').upsert(rows, { onConflict: 'id' }), 'la scheda', 'salvare') }
    catch {
      for (let k = 0; k < rows.length; k += 8) await Promise.all(rows.slice(k, k + 8).map(({ id, ...p }) => dbMust(supabase.from('workout_exercises').update(p).eq('id', id), 'la scheda', 'salvare')))
    }
  }

  async function saveAll() {
    // Controlli PRIMA di toccare il database: serie, ripetizioni, recupero e nome. Prima un campo svuotato diventava 3 serie o 60 secondi senza dirlo.
    const problems = validateExercises(exercises)
    if (problems.length) {
      setShowErrors(true); notify(problemsMessage(problems), 'error')
      setSelectedDay(problems[0].day); setExpandedEx(problems[0].id); setAllExpanded(false)
      return
    }
    setSaving(true)
    try {
      // Note generali: per PRIME, e da sole. Se il database non ha ancora la colonna (script SQL non eseguito) lo dice chiaramente e non scrive altro.
      const cleanNotes = normalizeNotes(notes)
      if (cleanNotes !== normalizeNotes(serverNotesRef.current)) {
        const { error: notesErr } = await supabase.from('workout_plans').update({ general_notes: cleanNotes || null }).eq('id', planId)
        if (notesErr) throw new Error(isMissingNotesColumn(notesErr) ? MISSING_COLUMN_MSG : 'Non sono riuscito a salvare le note. Riprova.')
        serverNotesRef.current = cleanNotes; setNotes(cleanNotes)
      }
      const { data: dbExs, error: readErr } = await supabase.from('workout_exercises').select('id').eq('plan_id', planId)
      if (readErr) throw new Error('Non riesco a leggere la scheda: riprova')
      const { toDelete, update, insert } = planSave((dbExs || []).map(r => r.id), exercises, planId)
      // Ordine pensato per non perdere nulla: prima le righe nuove, poi quelle esistenti, per ULTIME le eliminazioni (se prima qualcosa va storto non si è cancellato niente)
      if (insert.length) await dbMust(supabase.from('workout_exercises').insert(insert), 'la scheda', 'salvare')
      if (update.length) await writeExisting(update)
      if (toDelete.length) await dbMust(supabase.from('workout_exercises').delete().in('id', toDelete), 'la scheda', 'eliminare')

      // lo storico delle sedute segue i giorni rinominati
      let historyFailed = false
      if (plan?.client_id) for (const r of renames) {
        const res = await dbSave(supabase.from('workout_sessions').update({ day_label: r.to }).eq('client_id', plan.client_id).eq('day_label', r.from), 'lo storico degli allenamenti', 'aggiornare', { quiet: true })
        if (!res.ok) historyFailed = true
      }

      clearDraft(planId); setDraftOffer(null); setRenames([]); setShowErrors(false)          // niente avviso di bozza vecchia dopo aver salvato
      setDirty(false)
      setEmptyDays([])
      done('Scheda salvata')
      if (historyFailed) notify('Scheda salvata, ma non sono riuscito ad aggiornare i nomi dei giorni nello storico delle sedute già fatte.', 'info')
      fetchPlan({ quiet: true })
    } catch(e) {
      notify(e.message || 'Non sono riuscito a salvare la scheda. Riprova.', 'error')           // prima l'errore finiva in una variabile mai mostrata: il coach non vedeva nulla
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600}}>Modifica scheda</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#AAA',fontSize:13}}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#161616'}}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <button className="tap" aria-label="Indietro" onClick={goBack} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #1C1C1C',background:'#161616',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{plan?.name || 'Modifica scheda'}</div>
          <div style={{fontSize:11,color:'#AAA'}}>{clientName}{plan ? ` · ${plan.days_per_week} giorni/sett · ${plan.weeks_duration} settimane` : ''}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          {saving && <span style={{fontSize:11,color:'#AAA'}}>Salvo...</span>}
          {!saving && dirty && (
            <button aria-label="Scarta le modifiche" onClick={discardChanges} style={{...s.btnGray,padding:'8px 10px'}}>Scarta</button>
          )}
          {!saving && dirty && (
            <button onClick={saveAll} style={{...s.btn,minWidth:80}}>💾 Salva</button>
          )}
          {!dirty && <span style={{fontSize:11,color:'#6FCF97',fontWeight:600}}>✓ Salvato</span>}
        </div>
      </div>

      {/* BOZZA NON SALVATA TROVATA ALL'APERTURA */}
      {draftOffer && (
        <div role="status" data-testid="bozza-trovata" style={{background:'rgba(244,137,74,0.12)',borderBottom:'0.5px solid rgba(244,137,74,0.4)',padding:'9px 14px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
          <i className="ti ti-alert-triangle" style={{fontSize:16,color:'#F4894A'}}/>
          <span style={{fontSize:12,color:'#F4894A',flex:1,minWidth:200,lineHeight:1.45}}>
            Hai modifiche non salvate del {new Date(draftOffer.savedAt).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} ({draftOffer.exercises.length} esercizi){draftIsStale(draftOffer, serverRef.current) ? ' — ma la scheda è stata modificata dopo: controlla bene prima di salvare' : ''}.
          </span>
          <button onClick={restoreDraft} style={{...s.btn,padding:'6px 14px',fontSize:12}}>Ripristina</button>
          <button onClick={discardDraft} style={{...s.btnGray,padding:'6px 12px'}}>Scarta</button>
        </div>
      )}

      {/* NOTE GENERALI PER IL CLIENTE */}
      <div data-testid="note-generali" style={{background:'#0D0D0D',borderBottom:'0.5px solid #1C1C1C',flexShrink:0}}>
        <button onClick={()=>setNotesOpen(o=>!o)} aria-expanded={notesOpen} aria-controls="note-generali-corpo"
          style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 14px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <i className="ti ti-notes" style={{fontSize:16,color:'#F4894A'}}/>
          <span style={{fontSize:12,fontWeight:700,color:'#F0F0F0'}}>Note generali per il cliente</span>
          <span style={{fontSize:11,color:hasNotes(notes)?'#6FCF97':'#888',flex:1}}>{hasNotes(notes) ? `${normalizeNotes(notes).length} caratteri · le vede nella sua sezione Allenamento` : 'vuote · scrivi qui indicazioni e consigli'}</span>
          <i className={`ti ti-chevron-${notesOpen?'up':'down'}`} style={{fontSize:15,color:'#AAA'}}/>
        </button>
        {notesOpen && (
          <div id="note-generali-corpo" style={{padding:'0 14px 12px',maxHeight:'55vh',overflowY:'auto'}}>
            <NotesEditor idPrefix="modifica" value={notes} onChange={v=>{ setNotes(v); setDirty(true) }}/>
          </div>
        )}
      </div>

      {/* LAYOUT */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* SIDEBAR GIORNI (PC) */}
        {!isMobile && (
          <div style={{width:140,flexShrink:0,background:'#0D0D0D',borderRight:'0.5px solid #1A1A1A',overflowY:'auto'}}>
            <div style={{padding:'10px 12px',borderBottom:'0.5px solid #1C1C1C',fontSize:10,fontWeight:700,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.08em'}}>Giorni</div>
            {days.map(day => {
              const dayExs = exercises.filter(e=>e.day_label===day)
              return (
                <div key={day} onClick={()=>setSelectedDay(day)} style={{
                  padding:'10px 12px',cursor:'pointer',
                  background:selectedDay===day?'rgba(212,87,10,0.14)':'transparent',
                  borderLeft:selectedDay===day?'3px solid #D4570A':'3px solid transparent',
                  transition:'all 0.1s',
                }}>
                  <div style={{fontSize:12,fontWeight:selectedDay===day?700:500,color:selectedDay===day?'#F4894A':'#F0F0F0'}}>{day}</div>
                  <div style={{fontSize:10,color:'#AAA',marginTop:1}}>{dayExs.length} esercizi</div>
                </div>
              )
            })}
            <div style={{padding:'8px 10px'}}>
              {showAddDay ? (
                <AddDayForm stacked value={newDayLabel} onChange={setNewDayLabel} onConfirm={addDay} onCancel={cancelAddDay} />
              ) : (
                <button onClick={openAddDay} aria-label="Aggiungi un giorno" style={{width:'100%',padding:'6px',background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:11,cursor:'pointer',fontFamily:'inherit',color:'#AAA',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                  <i className="ti ti-plus" style={{fontSize:12}}/>Giorno
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONTENUTO */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* TAB GIORNI MOBILE */}
          {isMobile && (
            <div style={{background:'#0D0D0D',borderBottom:'0.5px solid #1A1A1A',display:'flex',overflowX:'auto',flexShrink:0,padding:'8px 10px',gap:6}}>
              {days.map(day => (
                <button key={day} onClick={()=>setSelectedDay(day)} style={{
                  flexShrink:0,padding:'5px 12px',borderRadius:14,fontSize:11,fontWeight:600,
                  cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                  background:selectedDay===day?'#D4570A':'#0D0D0D',
                  color:selectedDay===day?'white':'#888780',
                  borderColor:selectedDay===day?'#D4570A':'#2A2A2A',
                }}>{day}</button>
              ))}
              {showAddDay ? (
                <AddDayForm value={newDayLabel} onChange={setNewDayLabel} onConfirm={addDay} onCancel={cancelAddDay} />
              ) : (
                <button onClick={openAddDay} aria-label="Aggiungi un giorno" style={{flexShrink:0,padding:'5px 12px',borderRadius:14,fontSize:11,cursor:'pointer',border:'0.5px dashed #2A2A2A',background:'transparent',color:'#AAA',fontFamily:'inherit'}}>+ Giorno</button>
              )}
            </div>
          )}

          {/* TOOLBAR GIORNO */}
          <div style={{background:'#0D0D0D',borderBottom:'0.5px solid #1A1A1A',padding:'8px 14px',display:'flex',gap:8,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:700,color:'#F0F0F0'}}>{selectedDay}</span>
            <span style={{fontSize:11,color:'#AAA'}}>{dayExercises.length} esercizi</span>
            <div style={{flex:1}}/>
            {dayExercises.length > 1 && (
              <button onClick={()=>{if(allExpanded){setExpandedEx(null);setAllExpanded(false)}else{setExpandedEx('all');setAllExpanded(true)}}}
                style={{...s.btnGray,padding:'5px 12px',fontSize:11,whiteSpace:'nowrap'}}>
                {allExpanded?'⊖ Collassa tutto':'⊕ Espandi tutto'}
              </button>
            )}
            {renaming ? (
              <AddDayForm value={renameValue} onChange={setRenameValue} onConfirm={confirmRename} onCancel={()=>setRenaming(false)} ariaLabel="Nuovo nome del giorno" confirmAria="Conferma il nuovo nome" confirmText="✓ Rinomina" placeholder="Nome del giorno"/>
            ) : (
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                <button aria-label="Rinomina il giorno" onClick={startRename} style={{...s.btnGray,padding:'5px 10px',fontSize:11}}><i className="ti ti-pencil" style={{fontSize:12}}/> Rinomina</button>
                <button aria-label="Sposta il giorno prima" disabled={!canMoveDay(-1)} onClick={()=>moveDayBy(-1)} style={{...s.btnGray,padding:'5px 9px',fontSize:11,opacity:canMoveDay(-1)?1:0.35}}><i className="ti ti-arrow-left" style={{fontSize:12}}/></button>
                <button aria-label="Sposta il giorno dopo" disabled={!canMoveDay(1)} onClick={()=>moveDayBy(1)} style={{...s.btnGray,padding:'5px 9px',fontSize:11,opacity:canMoveDay(1)?1:0.35}}><i className="ti ti-arrow-right" style={{fontSize:12}}/></button>
                <button aria-label="Duplica il giorno" onClick={duplicateWholeDay} style={{...s.btnGray,padding:'5px 10px',fontSize:11}}><i className="ti ti-copy" style={{fontSize:12}}/> Duplica</button>
                {days.length > 1 && (
                  <button aria-label="Elimina il giorno" onClick={()=>removeDay(selectedDay)} style={{...s.btnDanger,padding:'4px 8px',fontSize:11}}>
                    <i className="ti ti-trash" style={{fontSize:12}}/>Elimina giorno
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ESERCIZI */}
          <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'10px 12px'}}>
            {filteredDayExercises.map((ex, ei) => {
              const isExpanded = expandedEx === ex.id || expandedEx === 'all'
              return (
                <div key={ex.id} data-drag-card
                  onDragOver={e=>handleDragOver(e,ex.id)} onDrop={()=>handleDrop(ex.id)}
                  style={{...s.card,
                    opacity:dragId===ex.id?0.4:1,
                    border:dragOverId===ex.id?'1.5px solid #D4570A':'0.5px solid #2A2A2A',
                    transition:'border 0.1s',
                  }}>
                  {/* HEADER ESERCIZIO */}
                  <div style={{display:'flex',alignItems:'center',gap:7,padding:'9px 11px',cursor:'pointer'}}
                    onClick={()=>{if(expandedEx==='all'){setAllExpanded(false);setExpandedEx(ex.id)}else setExpandedEx(isExpanded?null:ex.id)}}>
                    <div draggable data-testid={`maniglia-${ex.id}`} title="Trascina per riordinare" onDragStart={e=>{startHandleDrag(e);handleDragStart(ex.id)}} onDragEnd={handleDragEnd} onClick={e=>e.stopPropagation()}
                      style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'grab',padding:'6px 7px',margin:'-4px -4px',color:'#CCC',flexShrink:0,userSelect:'none'}}>
                      <i className="ti ti-grip-vertical" style={{fontSize:15}}/>
                      <span style={{fontSize:9,fontWeight:700,color:'#F4894A',marginTop:-2}}>{ei+1}</span>
                    </div>
                    <div style={{width:30,height:30,borderRadius:8,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <i className="ti ti-barbell" style={{fontSize:14,color:'#D4570A'}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.exercise_name||<span style={{color:'#AAA',fontStyle:'italic'}}>Nuovo esercizio</span>}</div>
                      <div style={{fontSize:10,color:'#AAA',marginTop:1}}>{ex.muscle_group} · {ex.sets}×{ex.reps} · {ex.rest_seconds}s{ex.tut?` · TUT ${ex.tut}`:''}{ex.weekly_targets?.length?` · 📅 ${ex.weekly_targets.length}sett`:''}</div>
                      {lastMap[ex.id] && <div data-testid="ultimo-carico" style={{fontSize:10,color:'#6FCF97',marginTop:1,fontWeight:600}}>{lastLoadText(lastMap[ex.id])}</div>}
                    </div>
                    <div style={{display:'flex',gap:3,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>moveEx(ex.id,'up')} style={{...s.btnGray,padding:'3px 5px'}} title="Su"><i className="ti ti-arrow-up" style={{fontSize:11}}/></button>
                      <button onClick={()=>moveEx(ex.id,'down')} style={{...s.btnGray,padding:'3px 5px'}} title="Giù"><i className="ti ti-arrow-down" style={{fontSize:11}}/></button>
                      <button onClick={()=>duplicateEx(ex.id)} style={{...s.btnGray,padding:'3px 5px'}} title="Duplica"><i className="ti ti-copy" style={{fontSize:11}}/></button>
                      {days.length > 1 && (
                        <button onClick={()=>setShowCopyModal(showCopyModal===ex.id?null:ex.id)} style={{...s.btnGray,padding:'3px 5px'}} title="Copia su altro giorno"><i className="ti ti-transfer" style={{fontSize:11}}/></button>
                      )}
                      <button aria-label="Elimina l'esercizio" onClick={()=>removeEx(ex.id)} style={{...s.btnDanger,padding:'3px 5px'}}><i className="ti ti-trash" style={{fontSize:11}}/></button>
                    </div>
                    <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{fontSize:12,color:'#AAA',flexShrink:0}}/>
                  </div>

                  {/* COPIA SU ALTRO GIORNO */}
                  {showCopyModal===ex.id && (
                    <div style={{padding:'7px 12px 9px',borderTop:'0.5px solid #1C1C1C',background:'rgba(212,87,10,0.1)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'#F4894A',marginBottom:5}}>Copia su giorno:</div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {days.filter(d=>d!==selectedDay).map(d=>(
                          <button key={d} onClick={()=>copyExToDay(ex.id,d)} style={{...s.btnGray,padding:'4px 10px',fontSize:11,fontWeight:600,background:'#0D0D0D',color:'#F4894A',borderColor:'#D4570A'}}>{d}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DETTAGLIO ESERCIZIO */}
                  {isExpanded && (
                    <div style={{borderTop:'0.5px solid #1C1C1C',padding:'12px'}}>
                      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:8,marginBottom:8}}>
                        <div><label style={s.label}>Nome esercizio</label>
                          <input aria-label="Nome esercizio" style={{...s.input,...errStyle(ex,'name')}} value={ex.exercise_name} onChange={e=>updateEx(ex.id,'exercise_name',e.target.value)} placeholder="Es. Panca piana"/>
                        </div>
                        <div><label style={s.label}>Gruppo muscolare</label>
                          <select style={s.input} value={ex.muscle_group} onChange={e=>updateEx(ex.id,'muscle_group',e.target.value)}>
                            {MUSCLE_GROUPS.map(g=><option key={g}>{g}</option>)}
                          </select>
                        </div>
                        <div><label style={s.label}>Serie</label>
                          <input aria-label="Serie" inputMode="numeric" style={{...s.input,...errStyle(ex,'sets')}} type="number" min={1} max={10} value={ex.sets ?? ''} onChange={e=>updateEx(ex.id,'sets',e.target.value===''?'':parseInt(e.target.value))}/>
                        </div>
                        <div><label style={s.label}>Reps</label>
                          <input aria-label="Ripetizioni" style={{...s.input,...errStyle(ex,'reps')}} value={ex.reps} onChange={e=>updateEx(ex.id,'reps',e.target.value)} placeholder="Es. 8-10"/>
                        </div>
                        <div><label style={s.label}>Recupero (sec)</label>
                          <input aria-label="Recupero in secondi" inputMode="numeric" style={{...s.input,...errStyle(ex,'rest')}} type="number" min={0} max={900} value={ex.rest_seconds ?? ''} onChange={e=>updateEx(ex.id,'rest_seconds',e.target.value===''?'':parseInt(e.target.value))}/>
                        </div>
                        <div><label style={s.label}>TUT</label>
                          <input style={s.input} value={ex.tut||''} onChange={e=>updateEx(ex.id,'tut',e.target.value)} placeholder="Es. 3-1-2"/>
                        </div>
                        <div style={{gridColumn:isMobile?'span 2':'span 2'}}><label style={s.label}>Video URL</label>
                          <input style={s.input} value={ex.video_url||''} onChange={e=>updateEx(ex.id,'video_url',e.target.value)} placeholder="https://youtube.com/..."/>
                        </div>
                      </div>
                      <div style={{marginBottom:8}}><label style={s.label}>Note / descrizione</label>
                        <input style={s.input} value={ex.description||''} onChange={e=>updateEx(ex.id,'description',e.target.value)} placeholder="Indicazioni tecniche..."/>
                      </div>
                      <WeeklyTargetsTable ex={ex} compact={isMobile} onChange={(field,val)=>updateEx(ex.id,field,val)}/>
                    </div>
                  )}
                </div>
              )
            })}

            {/* AGGIUNGI ESERCIZIO */}
            {dayExercises.length === 0 && !showAddExercise && (
              <div style={{textAlign:'center',color:'#AAA',fontSize:12,padding:'18px 10px'}}>Giorno vuoto: aggiungi almeno un esercizio, altrimenti non verrà salvato.</div>
            )}
            {showAddExercise ? (
              <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #D4570A',padding:'14px',marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:'#F4894A',marginBottom:12}}>
                  <i className="ti ti-plus" style={{fontSize:13}}/> Aggiungi esercizio
                </div>

                {/* STEP 1: Seleziona gruppo muscolare */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>1. Gruppo muscolare</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {['Tutti',...MUSCLE_GROUPS].map(g => (
                      <button key={g} onClick={()=>setNewEx(p=>({...p,muscle_group:g==='Tutti'?'Petto':g,exercise_name:'',video_url:'',_filterGroup:g}))}
                        style={{padding:'5px 10px',borderRadius:14,fontSize:11,fontWeight:600,cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                          background:(newEx._filterGroup||'Tutti')===g?'#D4570A':'#161616',
                          color:(newEx._filterGroup||'Tutti')===g?'white':'#DDD',
                          borderColor:(newEx._filterGroup||'Tutti')===g?'#D4570A':'#333',
                        }}>{g}</button>
                    ))}
                  </div>
                </div>

                {/* STEP 2: Seleziona esercizio dalla libreria */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>2. Seleziona dalla libreria (o scrivi sotto)</label>
                  <select style={{...s.input,fontWeight:newEx.exercise_name?600:400,color:newEx.exercise_name?'#F0F0F0':'#AAA'}}
                    value={newEx.exercise_name}
                    onChange={e=>{
                      const sel = EXERCISE_DB.find(x=>x.name===e.target.value)
                      if (sel) {
                        setNewEx(p=>({...p, exercise_name:sel.name, muscle_group:sel.muscle, video_url:sel.yt||''}))
                      } else {
                        setNewEx(p=>({...p, exercise_name:e.target.value}))
                      }
                    }}>
                    <option value="">— Seleziona dalla libreria —</option>
                    {(newEx._filterGroup && newEx._filterGroup!=='Tutti'
                        ? [[newEx._filterGroup, EXERCISE_DB.filter(ex=>ex.muscle===newEx._filterGroup)]]
                        : Object.entries(EXERCISE_DB.reduce((acc,ex)=>{ (acc[ex.muscle]=acc[ex.muscle]||[]).push(ex); return acc },{}))
                      ).map(([grp, list]) => (
                        <optgroup key={grp} label={grp}>
                          {list.map(ex => <option key={grp+'|'+ex.name} value={ex.name}>{ex.name} {ex.yt?'🎬':''}</option>)}
                        </optgroup>
                      ))
                    }
                  </select>
                </div>

                {/* STEP 3: Nome libero (se non in libreria) */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>3. Oppure scrivi nome personalizzato</label>
                  <input style={s.input} value={newEx.exercise_name}
                    onChange={e=>setNewEx(p=>({...p,exercise_name:e.target.value,video_url:''}))}
                    placeholder="Es. Mio esercizio personalizzato..."/>
                </div>

                {/* VIDEO YOUTUBE (auto o manuale) */}
                {newEx.video_url ? (
                  <div style={{background:'rgba(59,140,90,0.1)',borderRadius:8,padding:'8px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                    <i className="ti ti-brand-youtube" style={{fontSize:16,color:'#E24B4A',flexShrink:0}}/>
                    <span style={{fontSize:11,color:'#6FCF97',fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Video YouTube trovato ✓</span>
                    <a href={newEx.video_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#6FCF97',fontWeight:700}}>Apri →</a>
                    <button onClick={()=>setNewEx(p=>({...p,video_url:''}))} style={{background:'none',border:'none',cursor:'pointer',color:'#AAA',fontSize:13}}>✕</button>
                  </div>
                ) : (
                  <div style={{marginBottom:10}}>
                    <label style={s.label}>Link YouTube (opzionale)</label>
                    <input style={s.input} value={newEx.video_url||''} onChange={e=>setNewEx(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..."/>
                  </div>
                )}

                {/* PARAMETRI */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                  <div><label style={s.label}>Serie</label>
                    <input inputMode="numeric" style={s.input} type="number" min={1} max={20} value={newEx.sets} onChange={e=>setNewEx(p=>({...p,sets:parseInt(e.target.value)||3}))}/>
                  </div>
                  <div><label style={s.label}>Reps</label>
                    <input style={s.input} value={newEx.reps} onChange={e=>setNewEx(p=>({...p,reps:e.target.value}))} placeholder="8-10"/>
                  </div>
                  <div><label style={s.label}>Recupero (sec)</label>
                    <input inputMode="numeric" style={s.input} type="number" value={newEx.rest_seconds} onChange={e=>setNewEx(p=>({...p,rest_seconds:parseInt(e.target.value)||60}))}/>
                  </div>
                </div>

                <div style={{display:'flex',gap:8}}>
                  <button onClick={addExercise} disabled={!newEx.exercise_name.trim()}
                    style={{...s.btn,flex:1,justifyContent:'center',opacity:!newEx.exercise_name.trim()?0.5:1}}>
                    <i className="ti ti-plus" style={{fontSize:14}}/>Aggiungi
                  </button>
                  <button onClick={()=>{setShowAddExercise(false);setNewEx({...EMPTY_EX,_filterGroup:'Tutti'})}} style={s.btnGray}>
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowAddExercise(true)} style={{
                width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                padding:'12px',marginBottom:10,borderRadius:10,
                border:'1.5px dashed #D4570A',background:'rgba(212,87,10,0.10)',
                color:'#F4894A',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',
              }}>
                <i className="ti ti-plus" style={{fontSize:16}}/>Aggiungi esercizio
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
