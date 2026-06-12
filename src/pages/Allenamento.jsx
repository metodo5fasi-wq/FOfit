import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Toast } from '../components/Animations'

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  tab: { flex:1, padding:'9px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'all 0.15s' },
  input: { width:'100%', padding:'8px 10px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
}

const today = new Date().toISOString().split('T')[0]

export default function Allenamento() {
  const { profile } = useAuth()
  const [plan, setPlan] = useState(null)
  const [exercises, setExercises] = useState([])
  const [logs, setLogs] = useState([]) // log di oggi
  const [allLogs, setAllLogs] = useState([]) // tutti i log (per progressione)
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(null)
  const [expandedExercise, setExpandedExercise] = useState(null)
  const [toast, setToast] = useState({ visible:false, message:'', emoji:'' })

  useEffect(() => { if (profile) fetchAll() }, [profile])

  async function fetchAll() {
    setLoading(true)
    const { data: planData } = await supabase.from('workout_plans')
      .select('*').eq('client_id', profile.id).eq('is_active', true).limit(1)
    if (planData?.length) {
      setPlan(planData[0])
      const { data: exData } = await supabase.from('workout_exercises')
        .select('*').eq('plan_id', planData[0].id).order('order_index', {ascending:true})
      setExercises(exData || [])
      if (exData?.length) {
        const days = [...new Set(exData.map(e=>e.day_label))]
        setActiveDay(days[0])
      }
    }
    const { data: logData } = await supabase.from('workout_logs')
      .select('*').eq('client_id', profile.id).eq('log_date', today)
    setLogs(logData || [])
    const { data: allLogData } = await supabase.from('workout_logs')
      .select('*').eq('client_id', profile.id).order('log_date', {ascending:true})
    setAllLogs(allLogData || [])
    setLoading(false)
  }

  function showToast(message, emoji) {
    setToast({ visible:true, message, emoji })
    setTimeout(() => setToast({visible:false, message:'', emoji:''}), 2000)
  }

  // Trova il log di oggi per un esercizio + numero serie
  function getLog(exerciseName, setNumber) {
    return logs.find(l => l.exercise_name === exerciseName && l.set_number === setNumber)
  }

  async function toggleSet(ex, setNumber) {
    const existing = getLog(ex.exercise_name, setNumber)
    if (existing) {
      await supabase.from('workout_logs').delete().eq('id', existing.id)
      setLogs(prev => prev.filter(l => l.id !== existing.id))
    } else {
      const { data, error } = await supabase.from('workout_logs').insert({
        client_id: profile.id,
        exercise_name: ex.exercise_name,
        log_date: today,
        set_number: setNumber,
        weight_kg: null,
        reps_done: null,
      }).select().single()
      if (!error) setLogs(prev => [...prev, data])
    }
  }

  async function updateWeight(ex, setNumber, weight) {
    const existing = getLog(ex.exercise_name, setNumber)
    const weightNum = weight === '' ? null : parseFloat(weight)
    if (existing) {
      await supabase.from('workout_logs').update({ weight_kg: weightNum }).eq('id', existing.id)
      setLogs(prev => prev.map(l => l.id===existing.id ? {...l, weight_kg:weightNum} : l))
    } else {
      const { data, error } = await supabase.from('workout_logs').insert({
        client_id: profile.id,
        exercise_name: ex.exercise_name,
        log_date: today,
        set_number: setNumber,
        weight_kg: weightNum,
        reps_done: null,
      }).select().single()
      if (!error) setLogs(prev => [...prev, data])
    }
  }

  // Storico peso per un esercizio (ultimi valori distinti per data)
  function getProgressionData(exerciseName) {
    const byDate = {}
    allLogs.filter(l => l.exercise_name === exerciseName && l.weight_kg).forEach(l => {
      if (!byDate[l.log_date] || l.weight_kg > byDate[l.log_date]) byDate[l.log_date] = l.weight_kg
    })
    return Object.entries(byDate).map(([date, weight]) => ({ date, weight })).sort((a,b)=>a.date.localeCompare(b.date))
  }

  if (loading) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Allenamento</div></div>
      <div style={s.page}><div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)',fontSize:13}}>Caricamento...</div></div>
    </>
  )

  if (!plan) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Allenamento</div></div>
      <div style={s.page}>
        <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
          <i className="ti ti-barbell" style={{fontSize:48,color:'#E0DDD6',display:'block',marginBottom:16}}/>
          <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:8}}>Nessuna scheda assegnata</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>Il tuo coach ti assegnerà presto una scheda di allenamento.</div>
        </div>
      </div>
    </>
  )

  const days = [...new Set(exercises.map(e=>e.day_label))]
  const dayExercises = exercises.filter(e=>e.day_label===activeDay)
  const completedToday = logs.length
  const totalSetsToday = dayExercises.reduce((sum,e)=>sum+(e.sets||0),0)

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>{plan.title}</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>{days.length} giorni · {exercises.length} esercizi</div>
        </div>
      </div>

      <div style={s.page}>

        {/* TAB GIORNI */}
        <div style={{display:'flex',gap:4,marginBottom:14,overflowX:'auto',background:'var(--bg-card)',borderRadius:12,padding:4,border:'0.5px solid var(--border)'}}>
          {days.map(day => (
            <button key={day} onClick={()=>setActiveDay(day)} style={{
              ...s.tab, whiteSpace:'nowrap', flex:'0 0 auto', padding:'9px 16px',
              background: activeDay===day ? '#D4570A' : 'transparent',
              color: activeDay===day ? 'white' : 'var(--text-muted)',
            }}>{day}</button>
          ))}
        </div>

        {/* PROGRESSO OGGI */}
        <div style={{...s.card, display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'#FEF0E7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className="ti ti-flame" style={{fontSize:20,color:'#D4570A'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Allenamento di oggi</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>{completedToday} serie completate</div>
          </div>
        </div>

        {/* ESERCIZI DEL GIORNO */}
        {dayExercises.map(ex => {
          const isExpanded = expandedExercise === ex.id
          const progression = getProgressionData(ex.exercise_name)
          const lastWeight = progression.length ? progression[progression.length-1].weight : null
          const setsArray = Array.from({length: ex.sets || 0}, (_,i) => i+1)
          const completedSets = setsArray.filter(n => getLog(ex.exercise_name, n)).length

          return (
            <div key={ex.id} style={s.card}>
              <div onClick={()=>setExpandedExercise(isExpanded ? null : ex.id)} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                <div style={{
                  width:36,height:36,borderRadius:10,flexShrink:0,
                  background: completedSets===ex.sets && ex.sets>0 ? '#EAF3DE' : 'var(--bg-input)',
                  display:'flex',alignItems:'center',justifyContent:'center'
                }}>
                  <i className={completedSets===ex.sets && ex.sets>0 ? 'ti ti-check' : 'ti ti-barbell'} style={{fontSize:17,color: completedSets===ex.sets && ex.sets>0 ? '#3B6D11' : '#D4570A'}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{ex.exercise_name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                    {ex.muscle_group} · {ex.sets}x{ex.reps} · {completedSets}/{ex.sets} serie
                    {lastWeight && <span> · ultimo: {lastWeight}kg</span>}
                  </div>
                </div>
                {ex.video_url && (
                  <a href={ex.video_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:8,background:'#FEF0E7',flexShrink:0}}>
                    <i className="ti ti-brand-youtube" style={{fontSize:16,color:'#D4570A'}}/>
                  </a>
                )}
                <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{fontSize:16,color:'var(--text-muted)'}}/>
              </div>

              {isExpanded && (
                <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid var(--border)'}}>
                  {ex.description && (
                    <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,marginBottom:12,background:'var(--bg-input)',padding:'10px 12px',borderRadius:8}}>
                      <i className="ti ti-info-circle" style={{fontSize:13,marginRight:6,color:'#D4570A'}}/>
                      {ex.description}
                    </div>
                  )}
                  <div style={{display:'flex',gap:10,marginBottom:10,fontSize:11,color:'var(--text-muted)'}}>
                    <span><i className="ti ti-repeat" style={{fontSize:12,marginRight:3}}/>{ex.sets} serie x {ex.reps} ripetizioni</span>
                    <span><i className="ti ti-clock" style={{fontSize:12,marginRight:3}}/>{ex.rest_seconds}s recupero</span>
                  </div>

                  {/* SERIE CON CHECKBOX E PESO */}
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                    {setsArray.map(setNum => {
                      const log = getLog(ex.exercise_name, setNum)
                      return (
                        <div key={setNum} style={{display:'flex',alignItems:'center',gap:10,background:'var(--bg-input)',borderRadius:8,padding:'8px 12px'}}>
                          <button onClick={()=>{toggleSet(ex, setNum); showToast(log?'Serie annullata':'Serie completata! 💪','')}} style={{
                            width:26,height:26,borderRadius:7,border:'none',cursor:'pointer',flexShrink:0,
                            background: log ? '#3B6D11' : 'var(--bg-card)',
                            border: log ? 'none' : '0.5px solid var(--border)',
                            display:'flex',alignItems:'center',justifyContent:'center'
                          }}>
                            {log && <i className="ti ti-check" style={{fontSize:14,color:'white'}}/>}
                          </button>
                          <span style={{fontSize:12,color:'var(--text-muted)',width:50}}>Serie {setNum}</span>
                          <input
                            type="number" placeholder="kg" inputMode="decimal"
                            value={log?.weight_kg ?? ''}
                            onChange={e=>updateWeight(ex, setNum, e.target.value)}
                            style={{...s.input, width:70, padding:'6px 8px', textAlign:'center'}}
                          />
                          <span style={{fontSize:11,color:'var(--text-muted)'}}>kg</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* GRAFICO PROGRESSIONE */}
                  {progression.length > 1 && (
                    <div>
                      <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Progressione peso</div>
                      <ProgressionChart data={progression}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Toast visible={toast.visible} message={toast.message} emoji={toast.emoji}/>
    </>
  )
}

function ProgressionChart({ data }) {
  const weights = data.map(d=>d.weight)
  const min = Math.min(...weights) - 2
  const max = Math.max(...weights) + 2
  const W = 300, H = 70
  const pts = data.map((d,i) => {
    const x = data.length>1 ? (i/(data.length-1))*(W-20)+10 : W/2
    const y = H - ((d.weight-min)/(max-min))*(H-20) - 10
    return `${x},${y}`
  }).join(' ')
  return (
    <div style={{overflowX:'auto'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:W,display:'block'}}>
        <polyline points={pts} fill="none" stroke="#D4570A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {data.map((d,i)=>{
          const x = data.length>1 ? (i/(data.length-1))*(W-20)+10 : W/2
          const y = H - ((d.weight-min)/(max-min))*(H-20) - 10
          return <g key={i}><circle cx={x} cy={y} r={3} fill="#D4570A"/><text x={x} y={y-8} textAnchor="middle" fontSize={9} fill="#888780">{d.weight}</text></g>
        })}
      </svg>
    </div>
  )
}
