import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EXERCISE_DB } from '../data/exerciseDatabase'

const MUSCLE_GROUPS = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Gambe','Quadricipiti','Femorali','Polpacci','Glutei','Addominali','Cardio','Corpo libero','Altro']

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 16px' },
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', marginBottom:10, overflow:'hidden' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'rgba(212,87,10,0.1)', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#161616', color:'#AAA', border:'0.5px solid #1C1C1C', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  btnDanger: { background:'rgba(226,75,74,0.1)', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:7, padding:'5px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 },
  input: { padding:'7px 10px', border:'0.5px solid #1C1C1C', borderRadius:7, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  label: { fontSize:10, color:'#AAA', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.07em' },
}

const EMPTY_EX = { exercise_name:'', muscle_group:'Petto', video_url:'', description:'', sets:3, reps:'10-12', rest_seconds:60, tut:'', weekly_targets:[], _isNew:true }


function WeeklyTargetsTable({ ex, onChange }) {
  const targets = ex.weekly_targets || []

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

  const inp = {padding:'6px 8px',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:12,color:'#F0F0F0',background:'#0D0D0D',outline:'none',fontFamily:'inherit',width:'100%',boxSizing:'border-box',textAlign:'center'}

  return (
    <div style={{gridColumn:'1/-1',marginTop:4}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <label style={{fontSize:11,fontWeight:700,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.07em'}}>
          📅 Progressione settimanale
        </label>
        <button onClick={addWeek} style={{background:'#D4570A',color:'white',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
          <i className="ti ti-plus" style={{fontSize:12}}/> Settimana
        </button>
      </div>

      {targets.length === 0 ? (
        <div style={{background:'#161616',borderRadius:8,padding:'12px',textAlign:'center',fontSize:12,color:'#AAA'}}>
          Aggiungi le settimane con il pulsante → il cliente vedrà automaticamente la settimana corretta
        </div>
      ) : (
        <div style={{borderRadius:10,overflow:'hidden',border:'0.5px solid #1C1C1C'}}>
          <div style={{display:'grid',gridTemplateColumns:'44px 1fr 52px 72px 68px 28px',background:'#D4570A',padding:'7px 8px',gap:6}}>
            {['Sett.','Descrizione','Serie','Reps','Kg',''].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:'white',textTransform:'uppercase',letterSpacing:'0.05em',textAlign:'center'}}>{h}</div>
            ))}
          </div>
          {targets.map((t,i)=>(
            <div key={t.week} style={{display:'grid',gridTemplateColumns:'44px 1fr 52px 72px 68px 28px',gap:6,padding:'6px 8px',background:i%2===0?'white':'#FAFAF9',alignItems:'center',borderBottom:'0.5px solid #F0EDE8'}}>
              <div style={{fontSize:13,fontWeight:800,color:'#D4570A',textAlign:'center'}}>S{t.week}</div>
              <input style={{...inp,textAlign:'left',fontSize:11}} value={t.note||''} onChange={e=>updateRow(t.week,'note',e.target.value)} placeholder="es. Pesante, Deload..."/>
              <input style={inp} type="number" min={1} max={10} value={t.sets||''} onChange={e=>updateRow(t.week,'sets',parseInt(e.target.value)||'')}/>
              <input style={inp} value={t.reps||''} onChange={e=>updateRow(t.week,'reps',e.target.value)} placeholder="8-10"/>
              <input style={{...inp,fontWeight:700}} type="text" inputMode="decimal" value={t.kg||''} onChange={e=>updateRow(t.week,'kg',e.target.value)} placeholder="kg"/>
              <button onClick={()=>removeWeek(t.week)} style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',fontSize:15,padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          ))}
        </div>
      )}
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
  const [savedMsg, setSavedMsg] = useState('')
  const [dirty, setDirty] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayLabel, setNewDayLabel] = useState('')
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

  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => { if (planId) fetchPlan() }, [planId])

  async function fetchPlan() {
    setLoading(true)
    const { data: planData } = await supabase.from('workout_plans').select('*').eq('id', planId).single()
    if (!planData) { setLoading(false); return }
    setPlan(planData)
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', planData.client_id).single()
    setClientName(prof?.full_name || '')
    const { data: exData } = await supabase.from('workout_exercises').select('*').eq('plan_id', planId).order('order_index', {ascending:true})
    setExercises(exData || [])
    if (exData?.length) {
      const days = [...new Set(exData.map(e=>e.day_label))]
      setSelectedDay(days[0])
    }
    setLoading(false)
  }

  const days = [...new Set(exercises.map(e=>e.day_label))]
  const dayExercises = exercises.filter(e=>e.day_label===selectedDay)

  function updateEx(id, field, value) {
    setExercises(prev => prev.map(e => e.id===id ? {...e, [field]:value} : e))
    setDirty(true)
  }

  function removeEx(id) {
    setExercises(prev => prev.filter(e => e.id!==id))
    setDirty(true)
  }

  function moveEx(id, dir) {
    const dayExs = exercises.filter(e=>e.day_label===selectedDay)
    const idx = dayExs.findIndex(e=>e.id===id)
    if (dir==='up' && idx===0) return
    if (dir==='down' && idx===dayExs.length-1) return
    const swapIdx = dir==='up' ? idx-1 : idx+1
    const newDayExs = [...dayExs]
    ;[newDayExs[idx], newDayExs[swapIdx]] = [newDayExs[swapIdx], newDayExs[idx]]
    const otherExs = exercises.filter(e=>e.day_label!==selectedDay)
    setExercises([...otherExs, ...newDayExs])
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
    const otherExs = exercises.filter(e => e.day_label !== selectedDay)
    setExercises([...otherExs, ...newDayExs])
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

  function addDay() {
    if (!newDayLabel.trim()) return
    const ex = {
      ...EMPTY_EX,
      id: 'new-' + Date.now(),
      plan_id: planId,
      day_label: newDayLabel.trim(),
      order_index: 0,
    }
    setExercises(prev => [...prev, ex])
    setSelectedDay(newDayLabel.trim())
    setNewDayLabel('')
    setShowAddDay(false)
    setDirty(true)
  }

  function removeDay(dayLabel) {
    if (!window.confirm(`Rimuovere il giorno "${dayLabel}" e tutti i suoi esercizi?`)) return
    setExercises(prev => prev.filter(e=>e.day_label!==dayLabel))
    const remaining = days.filter(d=>d!==dayLabel)
    setSelectedDay(remaining[0] || null)
    setDirty(true)
  }

  async function saveAll() {
    setSaving(true)
    try {
      // Elimina esercizi rimossi
      const { data: dbExs } = await supabase.from('workout_exercises').select('id').eq('plan_id', planId)
      const currentIds = new Set(exercises.filter(e=>!e._isNew).map(e=>e.id))
      for (const dbEx of dbExs || []) {
        if (!currentIds.has(dbEx.id)) {
          await supabase.from('workout_exercises').delete().eq('id', dbEx.id)
        }
      }

      // Aggiorna/inserisce esercizi
      let orderIdx = 0
      for (const ex of exercises) {
        const payload = {
          plan_id: planId,
          day_label: ex.day_label,
          order_index: orderIdx++,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group || '',
          video_url: ex.video_url || '',
          description: ex.description || '',
          sets: parseInt(ex.sets) || 3,
          reps: ex.reps || '',
          rest_seconds: parseInt(ex.rest_seconds) || 60,
          tut: ex.tut || '',
          weekly_targets: ex.weekly_targets || [],
        }
        if (ex._isNew) {
          await supabase.from('workout_exercises').insert(payload)
        } else {
          await supabase.from('workout_exercises').update(payload).eq('id', ex.id)
        }
      }

      setDirty(false)
      setSavedMsg('✓ Scheda salvata!')
      setTimeout(() => setSavedMsg(''), 3000)
      fetchPlan()
    } catch(e) {
      setSavedMsg('Errore: ' + e.message)
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
        <button onClick={()=>navigate(-1)} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #1C1C1C',background:'#161616',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{plan?.name || 'Modifica scheda'}</div>
          <div style={{fontSize:11,color:'#AAA'}}>{clientName}{plan ? ` · ${plan.days_per_week} giorni/sett · ${plan.weeks_duration} settimane` : ''}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          {saving && <span style={{fontSize:11,color:'#AAA'}}>Salvo...</span>}
          {!saving && dirty && (
            <button onClick={saveAll} style={{...s.btn,minWidth:80}}>💾 Salva</button>
          )}
          {!dirty && <span style={{fontSize:11,color:'#3B6D11',fontWeight:600}}>✓ Salvato</span>}
        </div>
      </div>

      {/* LAYOUT */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* SIDEBAR GIORNI (PC) */}
        {!isMobile && (
          <div style={{width:140,flexShrink:0,background:'#0D0D0D',borderRight:'0.5px solid #1A1A1A',overflowY:'auto'}}>
            <div style={{padding:'10px 12px',borderBottom:'0.5px solid #F0EDE8',fontSize:10,fontWeight:700,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.08em'}}>Giorni</div>
            {days.map(day => {
              const dayExs = exercises.filter(e=>e.day_label===day)
              return (
                <div key={day} onClick={()=>setSelectedDay(day)} style={{
                  padding:'10px 12px',cursor:'pointer',
                  background:selectedDay===day?'#FEF0E7':'transparent',
                  borderLeft:selectedDay===day?'3px solid #D4570A':'3px solid transparent',
                  transition:'all 0.1s',
                }}>
                  <div style={{fontSize:12,fontWeight:selectedDay===day?700:500,color:selectedDay===day?'#D4570A':'#111'}}>{day}</div>
                  <div style={{fontSize:10,color:'#AAA',marginTop:1}}>{dayExs.length} esercizi</div>
                </div>
              )
            })}
            <div style={{padding:'8px 10px'}}>
              <button onClick={addDay} style={{width:'100%',padding:'6px',background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:11,cursor:'pointer',fontFamily:'inherit',color:'#AAA',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:12}}/>Giorno
              </button>
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
                  background:selectedDay===day?'#D4570A':'white',
                  color:selectedDay===day?'white':'#888780',
                  borderColor:selectedDay===day?'#D4570A':'#E0DDD6',
                }}>{day}</button>
              ))}
              <button onClick={addDay} style={{flexShrink:0,padding:'5px 12px',borderRadius:14,fontSize:11,cursor:'pointer',border:'0.5px dashed #E0DDD6',background:'transparent',color:'#AAA',fontFamily:'inherit'}}>+ Giorno</button>
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
            {!isMobile && days.length > 1 && (
              <button onClick={()=>removeDay(selectedDay)} style={{...s.btnDanger,padding:'4px 8px',fontSize:11}}>
                <i className="ti ti-trash" style={{fontSize:12}}/>Elimina giorno
              </button>
            )}
          </div>

          {/* ESERCIZI */}
          <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'10px 12px'}}>
            {filteredDayExercises.map((ex, ei) => {
              const isExpanded = expandedEx === ex.id || expandedEx === 'all'
              return (
                <div key={ex.id}
                  draggable onDragStart={()=>handleDragStart(ex.id)}
                  onDragOver={e=>handleDragOver(e,ex.id)} onDrop={()=>handleDrop(ex.id)}
                  onDragEnd={handleDragEnd}
                  style={{...s.card,
                    opacity:dragId===ex.id?0.4:1,
                    border:dragOverId===ex.id?'1.5px solid #D4570A':'0.5px solid #E0DDD6',
                    transition:'border 0.1s',
                  }}>
                  {/* HEADER ESERCIZIO */}
                  <div style={{display:'flex',alignItems:'center',gap:7,padding:'9px 11px',cursor:'pointer'}}
                    onClick={()=>{if(expandedEx==='all'){setAllExpanded(false);setExpandedEx(ex.id)}else setExpandedEx(isExpanded?null:ex.id)}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'grab',padding:'2px 3px',color:'#999',flexShrink:0}}>
                      <i className="ti ti-grip-vertical" style={{fontSize:15}}/>
                      <span style={{fontSize:9,fontWeight:700,color:'#D4570A',marginTop:-2}}>{ei+1}</span>
                    </div>
                    <div style={{width:30,height:30,borderRadius:8,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <i className="ti ti-barbell" style={{fontSize:14,color:'#D4570A'}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.exercise_name||<span style={{color:'#AAA',fontStyle:'italic'}}>Nuovo esercizio</span>}</div>
                      <div style={{fontSize:10,color:'#AAA',marginTop:1}}>{ex.muscle_group} · {ex.sets}×{ex.reps} · {ex.rest_seconds}s{ex.tut?` · TUT ${ex.tut}`:''}{ex.weekly_targets?.length?` · 📅 ${ex.weekly_targets.length}sett`:''}</div>
                    </div>
                    <div style={{display:'flex',gap:3,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>moveEx(ex.id,'up')} style={{...s.btnGray,padding:'3px 5px'}} title="Su"><i className="ti ti-arrow-up" style={{fontSize:11}}/></button>
                      <button onClick={()=>moveEx(ex.id,'down')} style={{...s.btnGray,padding:'3px 5px'}} title="Giù"><i className="ti ti-arrow-down" style={{fontSize:11}}/></button>
                      <button onClick={()=>duplicateEx(ex.id)} style={{...s.btnGray,padding:'3px 5px'}} title="Duplica"><i className="ti ti-copy" style={{fontSize:11}}/></button>
                      {days.length > 1 && (
                        <button onClick={()=>setShowCopyModal(showCopyModal===ex.id?null:ex.id)} style={{...s.btnGray,padding:'3px 5px'}} title="Copia su altro giorno"><i className="ti ti-transfer" style={{fontSize:11}}/></button>
                      )}
                      <button onClick={()=>removeEx(ex.id)} style={{...s.btnDanger,padding:'3px 5px'}}><i className="ti ti-trash" style={{fontSize:11}}/></button>
                    </div>
                    <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{fontSize:12,color:'#AAA',flexShrink:0}}/>
                  </div>

                  {/* COPIA SU ALTRO GIORNO */}
                  {showCopyModal===ex.id && (
                    <div style={{padding:'7px 12px 9px',borderTop:'0.5px solid #F5F3EF',background:'rgba(212,87,10,0.1)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'#D4570A',marginBottom:5}}>Copia su giorno:</div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {days.filter(d=>d!==selectedDay).map(d=>(
                          <button key={d} onClick={()=>copyExToDay(ex.id,d)} style={{...s.btnGray,padding:'4px 10px',fontSize:11,fontWeight:600,background:'#0D0D0D',color:'#D4570A',borderColor:'#D4570A'}}>{d}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DETTAGLIO ESERCIZIO */}
                  {isExpanded && (
                    <div style={{borderTop:'0.5px solid #F5F3EF',padding:'12px'}}>
                      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:8,marginBottom:8}}>
                        <div><label style={s.label}>Nome esercizio</label>
                          <input style={s.input} value={ex.exercise_name} onChange={e=>updateEx(ex.id,'exercise_name',e.target.value)} placeholder="Es. Panca piana"/>
                        </div>
                        <div><label style={s.label}>Gruppo muscolare</label>
                          <select style={s.input} value={ex.muscle_group} onChange={e=>updateEx(ex.id,'muscle_group',e.target.value)}>
                            {MUSCLE_GROUPS.map(g=><option key={g}>{g}</option>)}
                          </select>
                        </div>
                        <div><label style={s.label}>Serie</label>
                          <input style={s.input} type="number" value={ex.sets} onChange={e=>updateEx(ex.id,'sets',parseInt(e.target.value)||0)}/>
                        </div>
                        <div><label style={s.label}>Reps</label>
                          <input style={s.input} value={ex.reps} onChange={e=>updateEx(ex.id,'reps',e.target.value)} placeholder="Es. 8-10"/>
                        </div>
                        <div><label style={s.label}>Recupero (sec)</label>
                          <input style={s.input} type="number" value={ex.rest_seconds} onChange={e=>updateEx(ex.id,'rest_seconds',parseInt(e.target.value)||0)}/>
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
                      <WeeklyTargetsTable ex={ex} onChange={(field,val)=>updateEx(ex.id,field,val)}/>
                    </div>
                  )}
                </div>
              )
            })}

            {/* AGGIUNGI ESERCIZIO */}
            {showAddExercise ? (
              <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #D4570A',padding:'14px',marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:12}}>
                  <i className="ti ti-plus" style={{fontSize:13}}/> Aggiungi esercizio
                </div>

                {/* STEP 1: Seleziona gruppo muscolare */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>1. Gruppo muscolare</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {['Tutti',...MUSCLE_GROUPS].map(g => (
                      <button key={g} onClick={()=>setNewEx(p=>({...p,muscle_group:g==='Tutti'?'Petto':g,exercise_name:'',video_url:'',_filterGroup:g}))}
                        style={{padding:'5px 10px',borderRadius:14,fontSize:11,fontWeight:600,cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                          background:(newEx._filterGroup||'Tutti')===g?'#D4570A':'#F5F3EF',
                          color:(newEx._filterGroup||'Tutti')===g?'white':'#888780',
                          borderColor:(newEx._filterGroup||'Tutti')===g?'#D4570A':'#E0DDD6',
                        }}>{g}</button>
                    ))}
                  </div>
                </div>

                {/* STEP 2: Seleziona esercizio dalla libreria */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>2. Seleziona dalla libreria (o scrivi sotto)</label>
                  <select style={{...s.input,fontWeight:newEx.exercise_name?600:400,color:newEx.exercise_name?'#111':'#888780'}}
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
                    {EXERCISE_DB
                      .filter(ex => !newEx._filterGroup || newEx._filterGroup==='Tutti' || ex.muscle===newEx._filterGroup)
                      .map(ex => (
                        <option key={ex.name} value={ex.name}>{ex.name} {ex.yt?'🎬':''}</option>
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
                    <span style={{fontSize:11,color:'#3B6D11',fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Video YouTube trovato ✓</span>
                    <a href={newEx.video_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#3B6D11',fontWeight:700}}>Apri →</a>
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
                    <input style={s.input} type="number" min={1} max={20} value={newEx.sets} onChange={e=>setNewEx(p=>({...p,sets:parseInt(e.target.value)||3}))}/>
                  </div>
                  <div><label style={s.label}>Reps</label>
                    <input style={s.input} value={newEx.reps} onChange={e=>setNewEx(p=>({...p,reps:e.target.value}))} placeholder="8-10"/>
                  </div>
                  <div><label style={s.label}>Recupero (sec)</label>
                    <input style={s.input} type="number" value={newEx.rest_seconds} onChange={e=>setNewEx(p=>({...p,rest_seconds:parseInt(e.target.value)||60}))}/>
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
                border:'1.5px dashed #D4570A',background:'#FEF8F5',
                color:'#D4570A',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',
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
