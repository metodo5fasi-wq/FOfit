import React, { useState, useEffect, useRef } from 'react'
document.title = 'FOfit — Allenamento'
document.title = 'FOfit — Allenamento'
// Titolo pagina per iOS back button
document.title = 'FOfit — Allenamento'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Link } from 'react-router-dom'
import { Toast, Confetti } from '../components/Animations'

const s = {
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', padding:'16px', marginBottom:12 },
  tab: { flex:1, padding:'9px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'all 0.15s' },
  input: { width:'100%', padding:'8px 10px', border:'0.5px solid #1C1C1C', borderRadius:7, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
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
  const [expandedExercise, setExpandedExercise] = useState(() => localStorage.getItem('fofit_expanded_exercise') || null)
  const [toast, setToast] = useState({ visible:false, message:'', emoji:'' })
  const [sessions, setSessions] = useState([])
  const [newPRs, setNewPRs] = useState([]) // record personali battuti oggi
  const [weekStreak, setWeekStreak] = useState(0)
  const [showFinish, setShowFinish] = useState(false)
  const [progressionStatus, setProgressionStatus] = useState({}) // { exerciseId: true/false/null }
  const [progressionTracking, setProgressionTracking] = useState({}) // { exerciseId: { week, targetKg } }
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionFeeling, setSessionFeeling] = useState(0)
  const noteDebounceRef = React.useRef({})
  const [savingSession, setSavingSession] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)
  const [todaySession, setTodaySession] = useState(null)

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
        const saved = localStorage.getItem('fofit_active_day')
        setActiveDay(saved && days.includes(saved) ? saved : days[0])
        loadProgression(exData) // Carica stato progressione
      }
    }
    const { data: logData } = await supabase.from('workout_logs')
      .select('*').eq('client_id', profile.id).eq('log_date', today)
    setLogs(logData || [])
    const { data: allLogData } = await supabase.from('workout_logs')
      .select('*').eq('client_id', profile.id).order('log_date', {ascending:true})
    setAllLogs(allLogData || [])
    const { data: sessionData } = await supabase.from('workout_sessions')
      .select('*').eq('client_id', profile.id).order('session_date', {ascending:false})
    setSessions(sessionData || [])

    // Calcola streak settimanale
    if (sessionData?.length) {
      const weeks = new Set(sessionData.map(s => {
        const d = new Date(s.session_date)
        const dow = d.getDay()
        const diff = dow === 0 ? -6 : 1 - dow
        d.setDate(d.getDate() + diff)
        return d.toISOString().split('T')[0]
      }))
      const sortedWeeks = [...weeks].sort().reverse()
      let streak = 0
      const thisWeek = (() => {
        const d = new Date()
        const dow = d.getDay()
        const diff = dow === 0 ? -6 : 1 - dow
        d.setDate(d.getDate() + diff)
        return d.toISOString().split('T')[0]
      })()
      for (let i = 0; i < sortedWeeks.length; i++) {
        const expected = new Date(thisWeek)
        expected.setDate(expected.getDate() - i * 7)
        if (sortedWeeks[i] === expected.toISOString().split('T')[0]) streak++
        else break
      }
      setWeekStreak(streak)
    }

    // Calcola record personali (PR) odierni
    if (allLogData?.length) {
      const todayLogsData = logData || []
      const prs = []
      for (const log of todayLogsData) {
        if (!log.weight_kg) continue
        const historical = allLogData.filter(l =>
          l.exercise_name === log.exercise_name &&
          l.log_date !== today &&
          l.weight_kg
        )
        const maxHist = historical.length > 0 ? Math.max(...historical.map(l=>l.weight_kg)) : 0
        if (log.weight_kg > maxHist) {
          if (!prs.find(p=>p.exercise===log.exercise_name)) {
            prs.push({ exercise: log.exercise_name, weight: log.weight_kg })
          }
        }
      }
      setNewPRs(prs)
    }
    setLoading(false)
  }

  function showToast(message, emoji) {
    setToast({ visible:true, message, emoji })
    setTimeout(() => setToast({visible:false, message:'', emoji:''}), 2000)
  }

  // Controlla se esiste già una sessione conclusa per oggi per il giorno attivo
  useEffect(() => {
    if (!activeDay) { setTodaySession(null); return }
    const existing = sessions.find(s => s.day_label === activeDay && s.session_date === today)
    setTodaySession(existing || null)
    setSessionNotes(existing?.notes || '')
  }, [activeDay, sessions])

  // Calcola settimana corrente per ogni esercizio con weekly_targets
  async function loadProgression(exList) {
    const progEx = exList.filter(e => e.weekly_targets?.length > 0)
    if (!progEx.length) return
    const tracking = {}
    const initStatus = {}
    for (const ex of progEx) {
      const { data: history } = await supabase.from('progression_tracking')
        .select('*').eq('client_id', profile.id).eq('exercise_id', ex.id)
        .order('week_number', { ascending: true })
      const maxWeeks = ex.weekly_targets.length
      let currentWeek = 1
      if (history?.length) {
        const lastCompleted = [...history].reverse().find(h => h.completed === true)
        const lastFailed = [...history].reverse().find(h => h.completed === false)
        if (lastCompleted) {
          currentWeek = Math.min(lastCompleted.week_number + 1, maxWeeks)
        } else if (lastFailed) {
          currentWeek = lastFailed.week_number
        }
      }
      const weekTarget = ex.weekly_targets.find(t => t.week === currentWeek) || ex.weekly_targets[0]
      tracking[ex.id] = {
        week: currentWeek,
        maxWeeks,
        targetKg: weekTarget?.kg ? parseFloat(String(weekTarget.kg).replace(',','.')) : null,
        targetSets: weekTarget?.sets || ex.sets,
        targetReps: weekTarget?.reps || ex.reps,
        weekNote: weekTarget?.note || '',
        history: history || [],
      }
      initStatus[ex.id] = null
    }
    setProgressionTracking(tracking)
    setProgressionStatus(initStatus)
  }

    async function finishSession() {
    setSavingSession(true)
    const dayEx = exercises.filter(e=>e.day_label===activeDay)
    const totalSets = dayEx.reduce((s,e)=>s+(e.sets||0),0)
    const completedSets = logs.filter(l => dayEx.some(e=>e.exercise_name===l.exercise_name)).length

    if (todaySession) {
      await supabase.from('workout_sessions').update({
        notes: sessionNotes, feeling: sessionFeeling||null, sets_completed: completedSets, sets_total: totalSets,
      }).eq('id', todaySession.id)
    } else {
      await supabase.from('workout_sessions').insert({
        client_id: profile.id, day_label: activeDay, session_date: today,
        notes: sessionNotes, sets_completed: completedSets, sets_total: totalSets,
      })
    }

    // Salva stato progressione per ogni esercizio segnato
    for (const [exerciseId, completed] of Object.entries(progressionStatus)) {
      if (completed === null) continue // Non segnato — non salvare
      const prog = progressionTracking[exerciseId]
      if (!prog) continue
      await supabase.from('progression_tracking').upsert({
        client_id: profile.id,
        exercise_id: exerciseId,
        week_number: prog.week,
        target_kg: prog.targetKg,
        completed: completed,
        logged_at: new Date().toISOString(),
      }, { onConflict: 'client_id,exercise_id,week_number' })
    }

    setSavingSession(false)
    setShowFinish(false)
    setConfettiActive(true)
    setTimeout(()=>setConfettiActive(false), 100)
    showToast('Allenamento salvato! 💪','')
    fetchAll()
  }

  // Trova il log di oggi per un esercizio + numero serie
  function getLog(ex, setNumber) {
    return logs.find(l =>
      l.set_number === setNumber &&
      (l.exercise_id ? l.exercise_id === ex.id : l.exercise_name === ex.exercise_name && !logs.some(ll => ll.exercise_id === ex.id))
    )
  }

  const SESSION_STORAGE_KEY = `fofit_session_${typeof profile !== 'undefined' ? profile?.id : 'anon'}`
  const [inputValues, setInputValues] = useState(() => {
    try {
      const saved = localStorage.getItem('fofit_input_values')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })


  // Estrai video ID da URL YouTube
  function getYtThumb(url) {
    if (!url) return null
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return m ? `https://img.youtube.com/vi/${m[1]}/default.jpg` : null
  }

  // Salva stato sessione su localStorage ogni volta che cambia
  const SESSION_KEY = `fofit_session_${profile?.id}`

  function getYtThumb(url) {
    if (!url) return null
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return m ? `https://img.youtube.com/vi/${m[1]}/default.jpg` : null
  }

  function getYtThumb(url) {
    if (!url) return null
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return m ? `https://img.youtube.com/vi/${m[1]}/default.jpg` : null
  }

  function getInputVal(exName, setNum, field) {
    const key = `${exName}-${setNum}-${field}`
    if (key in inputValues) return inputValues[key]
    const log = logs.find(l => l.exercise_name === exName && l.set_number === setNum)
    return log?.[field] ?? ''
  }

  function setInputVal(exName, setNum, field, val) {
    setInputValues(prev => {
      const next = { ...prev, [`${exName}-${setNum}-${field}`]: val }
      try { localStorage.setItem('fofit_input_values', JSON.stringify(next)) } catch {}
      return next
    })
  }



  async function toggleSet(ex, setNumber) {
    const existing = getLog(ex, setNumber)
    if (existing) {
      await supabase.from('workout_logs').delete().eq('id', existing.id)
      setLogs(prev => prev.filter(l => l.id !== existing.id))
    } else {
      const weightVal = inputValues[`${ex.id}-${setNumber}-weight_kg`] || inputValues[`${ex.exercise_name}-${setNumber}-weight_kg`]
      const repsVal = inputValues[`${ex.id}-${setNumber}-reps_done`] || inputValues[`${ex.exercise_name}-${setNumber}-reps_done`]
      const noteVal = inputValues[`${ex.id}-note`] || inputValues[`${ex.id}-note`] || null
      const { data, error } = await supabase.from('workout_logs').insert({
        client_id: profile.id,
        exercise_id: ex.id,
        exercise_name: ex.exercise_name,
        log_date: today,
        set_number: setNumber,
        weight_kg: weightVal ? parseFloat(String(weightVal).replace(',', '.')) : null,
        reps_done: repsVal ? parseInt(repsVal) : null,
        exercise_note: noteVal,
      }).select().single()
      if (!error) setLogs(prev => [...prev, data])
    }
  }

  function updateNote(ex, note) {
    // Aggiorna subito lo stato locale — nessun lag
    setInputValues(prev => ({...prev, [`${ex.id}-note`]: note}))
    setLogs(prev => prev.map(l =>
      l.exercise_name === ex.exercise_name ? {...l, exercise_note: note} : l
    ))
    // Salva su Supabase dopo 800ms di inattività (debounce)
    const key = ex.exercise_name
    if (noteDebounceRef.current[key]) clearTimeout(noteDebounceRef.current[key])
    noteDebounceRef.current[key] = setTimeout(async () => {
      const exLogs = logs.filter(l => l.exercise_name === ex.exercise_name)
      if (exLogs.length > 0) {
        await supabase.from('workout_logs')
          .update({ exercise_note: note })
          .eq('client_id', profile.id)
          .eq('exercise_name', ex.exercise_name)
          .eq('log_date', today)
      }
    }, 800)
  }

  function getExerciseNote(exName) {
    // Prima guarda i log esistenti, poi inputValues
    const log = logs.find(l => l.exercise_name === exName && l.exercise_note)
    if (log) return log.exercise_note
    return inputValues[`${exName}-note`] || ''
  }

  async function updateWeight(ex, setNumber, weight) {
    const existing = getLog(ex, setNumber)
    const normalized = typeof weight === 'string' ? weight.replace(',', '.') : weight
    const weightNum = normalized === '' ? null : parseFloat(normalized)
    if (existing) {
      await supabase.from('workout_logs').update({ weight_kg: weightNum }).eq('id', existing.id)
      setLogs(prev => prev.map(l => l.id===existing.id ? {...l, weight_kg:weightNum} : l))
    }
    // Se non esiste ancora, il valore è in inputValues — verrà salvato al toggleSet
  }

  async function updateReps(ex, setNumber, reps) {
    const existing = getLog(ex, setNumber)
    const repsNum = reps === '' ? null : parseInt(reps)
    if (existing) {
      await supabase.from('workout_logs').update({ reps_done: repsNum }).eq('id', existing.id)
      setLogs(prev => prev.map(l => l.id===existing.id ? {...l, reps_done:repsNum} : l))
    }
    // Se non esiste ancora, il valore è in inputValues — verrà salvato al toggleSet
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
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600,color:'#F0F0F0'}}>Allenamento</div></div>
      <div style={s.page}><div style={{textAlign:'center',padding:'40px 0',color:'#555555',fontSize:13}}>Caricamento...</div></div>
    </>
  )

  if (!plan) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600,color:'#F0F0F0'}}>Allenamento</div></div>
      <div style={s.page}>
        <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
          <i className="ti ti-barbell" style={{fontSize:48,color:'#E0DDD6',display:'block',marginBottom:16}}/>
          <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0',marginBottom:8}}>Nessuna scheda assegnata</div>
          <div style={{fontSize:13,color:'#555555',lineHeight:1.6}}>Il tuo coach ti assegnerà presto una scheda di allenamento.</div>
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
          <div style={{fontSize:15,fontWeight:600,color:'#F0F0F0'}}>{plan.title}</div>
          <div style={{fontSize:12,color:'#555555'}}>{days.length} giorni · {exercises.length} esercizi</div>
        </div>
        <Link to="/storico-allenamento" style={{width:36,height:36,borderRadius:9,border:'0.5px solid #1C1C1C',background:'#161616',display:'flex',alignItems:'center',justifyContent:'center',color:'#F0F0F0',textDecoration:'none',flexShrink:0}}>
          <i className="ti ti-history" style={{fontSize:17}}/>
        </Link>
      </div>

      <div style={s.page}>

        {/* TAB GIORNI */}
        <div style={{display:'flex',gap:4,marginBottom:14,overflowX:'auto',background:'#0D0D0D',borderRadius:12,padding:4,border:'0.5px solid #1C1C1C'}}>
          {days.map(day => (
            <button key={day} onClick={()=>{setActiveDay(day); localStorage.setItem('fofit_active_day', day)}} style={{
              ...s.tab, whiteSpace:'nowrap', flex:'0 0 auto', padding:'9px 16px',
              background: activeDay===day ? '#D4570A' : 'transparent',
              color: activeDay===day ? 'white' : 'var(--text-muted)',
            }}>{day}</button>
          ))}
        </div>

        {/* PROGRESSO OGGI */}
        <div style={{...s.card, display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className="ti ti-flame" style={{fontSize:20,color:'#D4570A'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0'}}>Allenamento di oggi</div>
            <div style={{fontSize:12,color:'#555555'}}>{completedToday} serie completate</div>
          </div>
          {weekStreak > 0 && (
            <div style={{background:'rgba(212,87,10,0.1)',borderRadius:10,padding:'6px 12px',textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:800,color:'#D4570A'}}>{weekStreak}🔥</div>
              <div style={{fontSize:9,color:'#D4570A',fontWeight:600}}>SETTIMANE</div>
            </div>
          )}
        </div>

        {/* RECORD PERSONALI ODIERNI */}
        {newPRs.length > 0 && (
          <div style={{background:'linear-gradient(135deg,#FEF0E7,#FAC9A8)',borderRadius:12,padding:'14px 16px',marginBottom:12,border:'0.5px solid #F4894A'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:8}}>🏆 Nuovi record personali oggi!</div>
            {newPRs.map((pr,i) => (
              <div key={i} style={{fontSize:13,color:'#7a3508',fontWeight:600}}>
                {pr.exercise} — {pr.weight}kg
              </div>
            ))}
          </div>
        )}

        {/* ESERCIZI DEL GIORNO */}
        {dayExercises.map(ex => {
          const isExpanded = expandedExercise === ex.id
          const progression = getProgressionData(ex.exercise_name)
          const lastWeight = progression.length ? progression[progression.length-1].weight : null
          const prog = progressionTracking[ex.id]
          const activeSets = prog?.targetSets || ex.sets || 0
          const setsArray = Array.from({length: activeSets}, (_,i) => i+1)
          const completedSets = setsArray.filter(n => getLog(ex, n)).length

          return (
            <div key={ex.id} style={s.card}>
              {/* HEADER */}
              <div onClick={()=>{
                const next = isExpanded ? null : ex.id
                setExpandedExercise(next)
                if (next) localStorage.setItem('fofit_expanded_exercise', next)
                else localStorage.removeItem('fofit_expanded_exercise')
              }} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>

                {/* THUMBNAIL */}
                {(() => {
                  const thumb = getYtThumb(ex.video_url)
                  const done = completedSets===activeSets && activeSets>0
                  if (thumb) return (
                    <div style={{width:52,height:38,borderRadius:8,overflow:'hidden',flexShrink:0,position:'relative'}}>
                      <img src={thumb} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}
                        onError={e=>{e.target.style.display='none'}}/>
                      {done && <div style={{position:'absolute',inset:0,background:'rgba(59,109,17,0.75)',display:'flex',alignItems:'center',justifyContent:'center'}}><i className="ti ti-check" style={{fontSize:18,color:'white'}}/></div>}
                    </div>
                  )
                  return (
                    <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:done?'#EAF3DE':'var(--bg-input)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <i className={done?'ti ti-check':'ti ti-barbell'} style={{fontSize:17,color:done?'#3B6D11':'#D4570A'}}/>
                    </div>
                  )
                })()}

                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.exercise_name}</div>
                  <div style={{fontSize:11,color:'#555555',marginTop:2}}>
                    {ex.muscle_group} · {(() => {
                      const prog = progressionTracking[ex.id]
                      if (prog) return `S${prog.week}/${prog.maxWeeks} · ${prog.targetSets||ex.sets}×${prog.targetReps||ex.reps} · ${prog.targetKg}kg`
                      return `${ex.sets}×${ex.reps}`
                    })()} · {completedSets}/{progressionTracking[ex.id]?.targetSets||ex.sets} serie
                    {lastWeight && <span style={{color:'#D4570A',fontWeight:600}}> · ult: {lastWeight}kg</span>}
                  </div>
                </div>

                {ex.video_url && (
                  <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                    onClick={e=>{e.stopPropagation(); document.title='FOfit — Allenamento'}}
                    style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:8,background:'rgba(212,87,10,0.12)',flexShrink:0}}>
                    <i className="ti ti-brand-youtube" style={{fontSize:16,color:'#D4570A'}}/>
                  </a>
                )}
                <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{fontSize:16,color:'#555555'}}/>
              </div>

              {isExpanded && (
                <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid #1A1A1A'}}>
                  {ex.description && (
                    <div style={{fontSize:12,color:'#555555',lineHeight:1.6,marginBottom:12,background:'#161616',padding:'10px 12px',borderRadius:8}}>
                      <i className="ti ti-info-circle" style={{fontSize:13,marginRight:6,color:'#D4570A'}}/>
                      {ex.description}
                    </div>
                  )}
                  <div style={{display:'flex',gap:10,marginBottom:10,fontSize:11,color:'#555555',flexWrap:'wrap'}}>
                    {(() => {
                      const prog = progressionTracking[ex.id]
                      if (prog) return <>
                        <span style={{background:'rgba(212,87,10,0.1)',color:'#D4570A',padding:'3px 10px',borderRadius:16,fontWeight:700,fontSize:12}}>
                          📅 Settimana {prog.week}/{prog.maxWeeks}{prog.weekNote ? ` — ${prog.weekNote}` : ''}
                        </span>
                        <span><i className="ti ti-repeat" style={{fontSize:12,marginRight:3}}/><strong>{prog.targetSets||ex.sets}</strong> serie x <strong>{prog.targetReps||ex.reps}</strong> reps</span>
                        <span><i className="ti ti-barbell" style={{fontSize:12,marginRight:3}}/>Obiettivo: <strong style={{color:'#D4570A'}}>{prog.targetKg}kg</strong></span>
                        <span><i className="ti ti-clock" style={{fontSize:12,marginRight:3}}/>{ex.rest_seconds}s recupero</span>
                      </>
                      return <>
                        <span><i className="ti ti-repeat" style={{fontSize:12,marginRight:3}}/>{ex.sets} serie x {ex.reps} ripetizioni</span>
                        <span><i className="ti ti-clock" style={{fontSize:12,marginRight:3}}/>{ex.rest_seconds}s recupero</span>
                      </>
                    })()}
                  </div>

                  {/* SERIE */}
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                    {setsArray.map(setNum => {
                      const log = getLog(ex, setNum)
                      // Genera valori kg: 0, 5, 7.5, 10, 12.5 ... 200 con step 2.5
                      const kgOptions = []
                      for (let k = 0; k <= 200; k += 2.5) kgOptions.push(k)
                      // Genera valori reps: 1-50
                      const repsOptions = Array.from({length:50}, (_,i) => i+1)
                      const defaultReps = parseInt(ex.reps?.split('-')[0]) || 10
                      return (
                        <div key={setNum} style={{display:'flex',alignItems:'center',gap:8,background:'#111',borderRadius:10,padding:'8px 10px',border: log ? '0.5px solid rgba(59,140,90,0.3)' : '0.5px solid #1A1A1A'}}>
                          {/* Numero serie */}
                          <div style={{width:22,height:22,borderRadius:6,background:log?'#3B8C5A':'#1C1C1C',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontSize:11,fontWeight:800,color:log?'white':'#555'}}>{setNum}</span>
                          </div>
                          {/* KG dropdown */}
                          <select
                            value={getInputVal(ex.exercise_name, setNum, 'weight_kg') || ''}
                            onChange={e=>{
                              setInputVal(ex.exercise_name, setNum, 'weight_kg', e.target.value)
                              if (log) updateWeight(ex, setNum, e.target.value)
                            }}
                            style={{flex:1,padding:'6px 4px',border:'0.5px solid #222',borderRadius:8,fontSize:14,fontWeight:700,color:log?'#3B8C5A':'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',textAlign:'center',cursor:'pointer'}}>
                            <option value="">{lastWeight ? `${lastWeight}` : '—'} kg</option>
                            {kgOptions.map(k => (
                              <option key={k} value={k}>{k % 1 === 0 ? k : k.toFixed(1)} kg</option>
                            ))}
                          </select>
                          <div style={{width:'0.5px',height:24,background:'#1C1C1C',flexShrink:0}}/>
                          {/* REPS dropdown */}
                          <select
                            value={getInputVal(ex.exercise_name, setNum, 'reps_done') || ''}
                            onChange={e=>{
                              setInputVal(ex.exercise_name, setNum, 'reps_done', e.target.value)
                              if (log) updateReps(ex, setNum, e.target.value)
                            }}
                            style={{flex:1,padding:'6px 4px',border:'0.5px solid #222',borderRadius:8,fontSize:14,fontWeight:700,color:log?'#3B8C5A':'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',textAlign:'center',cursor:'pointer'}}>
                            <option value="">{defaultReps} rep</option>
                            {repsOptions.map(r => (
                              <option key={r} value={r}>{r} rep</option>
                            ))}
                          </select>
                          {/* Check */}
                          <button onClick={()=>{toggleSet(ex,setNum);showToast(log?'Serie annullata':'Serie completata! 💪','')}} style={{
                            width:36,height:36,borderRadius:9,cursor:'pointer',flexShrink:0,
                            background:log?'#3B8C5A':'#1C1C1C',
                            border:'none',
                            display:'flex',alignItems:'center',justifyContent:'center',
                          }}>
                            <i className={log?'ti ti-check':'ti ti-circle'} style={{fontSize:17,color:log?'white':'#333'}}/>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{fontSize:11,color:'#555555',marginBottom:6}}>Note esercizio (opzionale)</div>
                  <textarea
                    value={getExerciseNote(ex.exercise_name)}
                    onChange={e=>updateNote(ex, e.target.value)}
                    placeholder="Sensazioni, tecnica, note per la prossima volta..."
                    style={{width:'100%',minHeight:60,padding:'8px 10px',border:'0.5px solid #1C1C1C',borderRadius:8,fontSize:12,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',lineHeight:1.5}}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* NOTE SESSIONI PASSATE PER QUESTO GIORNO */}
        {sessions.filter(s => s.day_label === activeDay && s.session_date !== today && s.notes).slice(0,3).length > 0 && (
          <div style={s.card}>
            <div style={{fontSize:11,color:'#555555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>
              <i className="ti ti-notes" style={{fontSize:13,marginRight:5,color:'#D4570A'}}/>Note delle scorse volte
            </div>
            {sessions.filter(s => s.day_label === activeDay && s.session_date !== today && s.notes).slice(0,3).map(sess => (
              <div key={sess.id} style={{background:'#161616',borderRadius:8,padding:'10px 12px',marginBottom:8,fontSize:12,color:'#F0F0F0',lineHeight:1.5}}>
                <div style={{fontSize:10,color:'#555555',marginBottom:4}}>
                  {new Date(sess.session_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'short'})} · {sess.sets_completed}/{sess.sets_total} serie
                </div>
                {sess.notes}
              </div>
            ))}
          </div>
        )}

        {/* BOTTONE TERMINA ALLENAMENTO */}
        <button onClick={()=>setShowFinish(true)} style={{
          width:'100%', padding:14, borderRadius:12, border:'none', cursor:'pointer', fontFamily:'inherit',
          fontSize:14, fontWeight:700, color:'white', marginTop:4, marginBottom:20,
          background: todaySession ? '#3B6D11' : '#D4570A',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          boxShadow: todaySession ? '0 2px 8px rgba(59,109,17,0.3)' : '0 2px 8px rgba(212,87,10,0.3)'
        }}>
          <i className={`ti ${todaySession ? 'ti-check' : 'ti-flag'}`} style={{fontSize:17}}/>
          {todaySession ? 'Allenamento completato — modifica note' : 'Termina allenamento'}
        </button>
      </div>

      {/* MODAL TERMINA ALLENAMENTO */}
      {showFinish && (
        <div onClick={e=>e.target===e.currentTarget&&setShowFinish(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
          <div style={{background:'#0D0D0D',borderRadius:16,padding:24,width:'100%',maxWidth:440}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <div style={{width:40,height:40,borderRadius:10,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <i className="ti ti-flag-filled" style={{fontSize:19,color:'#D4570A'}}/>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0'}}>Termina {activeDay}</div>
                <div style={{fontSize:12,color:'#555555'}}>{completedToday} serie completate</div>
              </div>
            </div>

            {/* FEEDBACK RAPIDO */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:'#555555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>
                Come ti senti?
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'space-between'}}>
                {[
                  {emoji:'😓',label:'Distrutto',val:1},
                  {emoji:'😐',label:'Stanco',val:2},
                  {emoji:'🙂',label:'Bene',val:3},
                  {emoji:'😊',label:'Ottimo',val:4},
                  {emoji:'🔥',label:'Esplosivo',val:5},
                ].map(f=>(
                  <button key={f.val} onClick={()=>setSessionFeeling(f.val)}
                    style={{flex:1,padding:'8px 4px',borderRadius:10,border:'0.5px solid',cursor:'pointer',fontFamily:'inherit',textAlign:'center',
                      background:sessionFeeling===f.val?'#FEF0E7':'var(--bg-input)',
                      borderColor:sessionFeeling===f.val?'#D4570A':'var(--border)',
                      transition:'all 0.15s',
                    }}>
                    <div style={{fontSize:22}}>{f.emoji}</div>
                    <div style={{fontSize:9,color:sessionFeeling===f.val?'#D4570A':'var(--text-muted)',marginTop:2,fontWeight:600}}>{f.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{fontSize:11,color:'#555555',textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 6px'}}>
              Note per il tuo coach (opzionale)
            </div>

            {/* SEZIONE PROGRESSIONE */}
            {(() => {
              const dayEx = exercises.filter(e => e.day_label===activeDay && e.weekly_targets?.length > 0 && progressionTracking[e.id])
              if (!dayEx.length) return null
              return (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:'#555555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>
                    📈 Progressione carichi — settimana corrente
                  </div>
                  {dayEx.map(ex => {
                    const prog = progressionTracking[ex.id]
                    const status = progressionStatus[ex.id]
                    return (
                      <div key={ex.id} style={{background:'#161616',borderRadius:10,padding:'12px',marginBottom:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0'}}>{ex.exercise_name}</div>
                            <div style={{fontSize:11,color:'#555555',marginTop:1}}>
                              Settimana {prog.week}/{prog.maxWeeks} · Obiettivo: <strong style={{color:'#D4570A'}}>{prog.targetKg}kg</strong>
                            </div>
                          </div>
                          {/* Mini storico puntini */}
                          <div style={{display:'flex',gap:3}}>
                            {prog.history.slice(-4).map((h,i)=>(
                              <div key={i} style={{width:10,height:10,borderRadius:'50%',background:h.completed?'#3B6D11':'#E24B4A'}} title={`S${h.week_number}: ${h.completed?'✓':'✗'}`}/>
                            ))}
                          </div>
                        </div>
                        {/* Bottoni CE L'HO FATTA / NON CE L'HO FATTA */}
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>setProgressionStatus(p=>({...p,[ex.id]:true}))} style={{
                            flex:1, padding:'9px', borderRadius:9, border:'0.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700,
                            background: status===true ? '#3B6D11' : 'var(--bg-card)',
                            color: status===true ? 'white' : 'var(--text-muted)',
                            borderColor: status===true ? '#3B6D11' : 'var(--border)',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:5
                          }}>
                            <i className="ti ti-circle-check" style={{fontSize:15}}/> Ce l'ho fatta!
                          </button>
                          <button onClick={()=>setProgressionStatus(p=>({...p,[ex.id]:false}))} style={{
                            flex:1, padding:'9px', borderRadius:9, border:'0.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700,
                            background: status===false ? '#E24B4A' : 'var(--bg-card)',
                            color: status===false ? 'white' : 'var(--text-muted)',
                            borderColor: status===false ? '#E24B4A' : 'var(--border)',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:5
                          }}>
                            <i className="ti ti-circle-x" style={{fontSize:15}}/> Non ce l'ho fatta
                          </button>
                        </div>
                        {/* Feedback dinamico */}
                        {status===true && (
                          <div style={{marginTop:8,fontSize:11,color:'#3B6D11',background:'rgba(59,140,90,0.1)',borderRadius:7,padding:'6px 10px'}}>
                            ✓ Ottimo! La prossima settimana: <strong>{Math.round((prog.targetKg + prog.increment)*4)/4}kg</strong>
                            {prog.week >= prog.maxWeeks && ' — Progressione completata! 🏆'}
                          </div>
                        )}
                        {status===false && (
                          <div style={{marginTop:8,fontSize:11,color:'#E24B4A',background:'rgba(226,75,74,0.1)',borderRadius:7,padding:'6px 10px'}}>
                            ✗ Ok, la prossima settimana rimani a <strong>{prog.targetKg}kg</strong> — riprova!
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <textarea
              value={sessionNotes}
              onChange={e=>setSessionNotes(e.target.value)}
              placeholder="Come ti sei sentito? Esercizi troppo facili/difficili? Dolori particolari? Suggerimenti per la prossima volta..."
              style={{width:'100%',minHeight:80,padding:'10px 12px',border:'0.5px solid #1C1C1C',borderRadius:10,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',lineHeight:1.5}}
            />

            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button onClick={finishSession} disabled={savingSession} style={{flex:1,padding:12,borderRadius:10,border:'none',background:'#D4570A',color:'white',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {savingSession ? 'Salvataggio...' : 'Salva e termina'}
              </button>
              <button onClick={()=>setShowFinish(false)} style={{padding:'12px 18px',borderRadius:10,border:'0.5px solid #1C1C1C',background:'#161616',color:'#555555',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <Confetti active={confettiActive} onDone={()=>setConfettiActive(false)}/>
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
