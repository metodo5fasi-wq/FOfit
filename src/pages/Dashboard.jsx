import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useTheme } from '../App'
import { Link } from 'react-router-dom'
import { Confetti, Toast, AnimatedNumber, FadeIn, PulseDot } from '../components/Animations'
import { requestNotificationPermission, checkNotificationStatus, sendTestNotification } from '../lib/notifications'
import { GraficoPeso, GraficoKcal } from '../components/GraficiProgressi'

const QUICK_LINKS = [
  { to:'/piano', icon:'ti-clipboard-list', label:'Piano alimentare', sub:'I tuoi pasti della settimana', color:'#D4570A', bg:'#FEF0E7' },
  { to:'/diario', icon:'ti-pencil', label:'Diario di oggi', sub:'Registra quello che mangi', color:'#E8803A', bg:'#FEF3EC' },
  { to:'/progressi', icon:'ti-chart-line', label:'Progressi', sub:'Peso e misurazioni', color:'#3B8C5A', bg:'#EAF3DE' },
  { to:'/spesa', icon:'ti-shopping-cart', label:'Lista spesa', sub:'Generata dal tuo piano', color:'#4A90D4', bg:'#EBF3FD' },
  { to:'/ai', icon:'ti-robot', label:'FO Coach AI', sub:'Sostituzioni e consigli', color:'#9B59B6', bg:'#F5EEF8' },
]

// Cerchio SVG calorie animato
function CalorieRing({ current, target }) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0)
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct > 100 ? '#E24B4A' : pct > 75 ? '#F4894A' : '#D4570A'
  return (
    <div style={{position:'relative',width:140,height:140,flexShrink:0}}>
      <svg width="140" height="140" style={{transform:'rotate(-90deg)'}}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{transition:'stroke-dashoffset 0.8s ease, stroke 0.3s'}}/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:24,fontWeight:700,color:'white',lineHeight:1}}>
          <AnimatedNumber value={Math.round(current)} duration={400}/>
        </div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.65)',marginTop:2}}>kcal</div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.55)',marginTop:1}}>di {target.toLocaleString('it-IT')}</div>
      </div>
    </div>
  )
}

// Streak flame
function StreakBadge({ streak }) {
  if (!streak) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(244,137,74,0.15)',border:'0.5px solid rgba(244,137,74,0.3)',borderRadius:20,padding:'5px 12px'}}>
      <span style={{fontSize:16}}>🔥</span>
      <div>
        <div style={{fontSize:14,fontWeight:700,color:'#F4894A',lineHeight:1}}>{streak}</div>
        <div style={{fontSize:9,color:'rgba(255,255,255,0.65)'}}>giorni</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { theme, darkMode } = useTheme()
  const [measurements, setMeasurements] = useState(null)
  const [todayKcal, setTodayKcal] = useState(0)
  const [todayP, setTodayP] = useState(0)
  const [todayC, setTodayC] = useState(0)
  const [todayG, setTodayG] = useState(0)
  const [plan, setPlan] = useState(null)
  const [streak, setStreak] = useState(0)
  const [confetti, setConfetti] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '', emoji: '' })
  const [notifStatus, setNotifStatus] = useState('default')
  const [weeklyComp, setWeeklyComp] = useState(null) // confronto settimana precedente
  const [nextWorkout, setNextWorkout] = useState(null)
  const [nextWorkoutExercises, setNextWorkoutExercises] = useState([])
  const [weekStats, setWeekStats] = useState(null)
  const prevKcalRef = useRef(0)

  useEffect(() => {
    checkNotificationStatus().then(setNotifStatus)
  }, [])
  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const dayNames = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']
  const todayName = dayNames[new Date().getDay()]

  useEffect(() => {
    if (!profile) return
    // Ultima misurazione
    supabase.from('progress_entries').select('*')
      .eq('client_id', profile.id).order('entry_date', { ascending:false }).limit(1)
      .then(({ data }) => data?.length && setMeasurements(data[0]))
    // Calorie oggi
    supabase.from('diary_entries').select('kcal,protein_g,carbs_g,fat_g')
      .eq('client_id', profile.id).eq('entry_date', today)
      .then(({ data }) => {
        if (data) {
          setTodayKcal(data.reduce((s,r) => s+(r.kcal||0), 0))
          setTodayP(data.reduce((s,r) => s+(r.protein_g||0), 0))
          setTodayC(data.reduce((s,r) => s+(r.carbs_g||0), 0))
          setTodayG(data.reduce((s,r) => s+(r.fat_g||0), 0))
        }
      })
    // Piano attivo
    supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1)
      .then(({ data }) => data?.length && setPlan(data[0]))
    // Calcola streak
    calcStreak()
    // Confronto settimana precedente
    calcWeeklyComparison()
    // Prossimo allenamento
    loadNextWorkout()
    // Riepilogo settimana
    loadWeekStats()
    // Riepilogo settimana
    loadWeekStats()
  }, [profile])

  async function calcStreak() {
    // Prendi ultimi 60 giorni di diario
    const { data } = await supabase.from('diary_entries')
      .select('entry_date')
      .eq('client_id', profile.id)
      .order('entry_date', { ascending: false })
      .limit(200)
    if (!data || data.length === 0) { setStreak(0); return }
    // Giorni unici
    const days = [...new Set(data.map(d => d.entry_date))].sort().reverse()
    let count = 0
    let current = new Date(today)
    for (const day of days) {
      const d = new Date(day)
      const diff = Math.round((current - d) / (1000 * 60 * 60 * 24))
      if (diff === 0 || diff === 1) { count++; current = d }
      else break
    }
    setStreak(count)
  }

  async function calcWeeklyComparison() {
    const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - 7)
    const lastWeekStart = new Date(); lastWeekStart.setDate(lastWeekStart.getDate() - 14)
    const [thisW, lastW, thisSess, lastSess] = await Promise.all([
      supabase.from('diary_entries').select('kcal').eq('client_id', profile.id)
        .gte('entry_date', thisWeekStart.toISOString().split('T')[0]),
      supabase.from('diary_entries').select('kcal').eq('client_id', profile.id)
        .gte('entry_date', lastWeekStart.toISOString().split('T')[0])
        .lt('entry_date', thisWeekStart.toISOString().split('T')[0]),
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('client_id', profile.id)
        .gte('session_date', thisWeekStart.toISOString().split('T')[0]),
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('client_id', profile.id)
        .gte('session_date', lastWeekStart.toISOString().split('T')[0])
        .lt('session_date', thisWeekStart.toISOString().split('T')[0]),
    ])
    const thisKcal = Math.round((thisW.data || []).reduce((s, r) => s + (r.kcal || 0), 0) / Math.max((thisW.data?.length || 1), 1))
    const lastKcal = Math.round((lastW.data || []).reduce((s, r) => s + (r.kcal || 0), 0) / Math.max((lastW.data?.length || 1), 1))
    setWeeklyComp({
      kcalDiff: thisKcal - lastKcal,
      sessDiff: (thisSess.count || 0) - (lastSess.count || 0),
      thisSess: thisSess.count || 0,
      lastSess: lastSess.count || 0,
    })
  }

  async function loadNextWorkout() {
    const { data } = await supabase.from('workout_plans')
      .select('id, name, days_per_week').eq('client_id', profile.id)
      .eq('is_active', true).limit(1)
    if (!data?.[0]) return
    setNextWorkout(data[0])
    // Carica esercizi del giorno corrente
    const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
    const { data: exData } = await supabase.from('workout_exercises')
      .select('exercise_name, muscle_group, sets, reps')
      .eq('plan_id', data[0].id)
      .eq('day_of_week', todayDow)
      .order('sort_order')
      .limit(6)
    if (exData?.length) {
      setNextWorkoutExercises(exData)
    } else {
      // Prova col giorno dopo
      const nextDow = (todayDow + 1) % 7
      const { data: nextEx } = await supabase.from('workout_exercises')
        .select('exercise_name, muscle_group, sets, reps')
        .eq('plan_id', data[0].id)
        .eq('day_of_week', nextDow)
        .order('sort_order')
        .limit(6)
      setNextWorkoutExercises(nextEx || [])
    }
  }

  async function loadWeekStats() {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const [diary, sessions] = await Promise.all([
      supabase.from('diary_entries').select('entry_date')
        .eq('client_id', profile.id).gte('entry_date', weekStartStr),
      supabase.from('workout_sessions').select('id')
        .eq('client_id', profile.id).gte('session_date', weekStartStr),
    ])
    const diaryDays = new Set((diary.data||[]).map(d => d.entry_date)).size
    const sessions_count = sessions.data?.length || 0
    setWeekStats({ diaryDays, sessions: sessions_count })
  }

  function showToast(message, emoji) {
    setToast({ visible: true, message, emoji })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500)
  }

  useEffect(() => {
    if (!plan) return
    const target = plan.kcal_target || 2200
    const prev = prevKcalRef.current
    // Confetti quando si raggiunge il 95-105% del target
    if (prev < target * 0.95 && todayKcal >= target * 0.95 && todayKcal <= target * 1.05) {
      setConfetti(true)
      showToast('Target calorico raggiunto!', '🎉')
    }
    // Toast proteine
    if (prev < (plan.protein_target_g || 150) && todayP >= (plan.protein_target_g || 150)) {
      showToast('Target proteico raggiunto!', '💪')
    }
    prevKcalRef.current = todayKcal
  }, [todayKcal, todayP, plan])
  const kcalTarget = plan?.kcal_target || 2200
  const pTarget = plan?.protein_target_g || 150
  const cTarget = plan?.carbs_target_g || 220
  const gTarget = plan?.fat_target_g || 65
  const remaining = Math.max(0, kcalTarget - Math.round(todayKcal))
  const firstName = profile?.full_name?.split(' ')[0] || 'utente'

  // Messaggio motivazionale
  const kcalPct = todayKcal / kcalTarget * 100
  const motivMsg = kcalPct === 0 ? 'Inizia a registrare i tuoi pasti! 💪'
    : kcalPct < 30 ? 'Ottimo inizio, continua così!'
    : kcalPct < 70 ? 'Sei sulla strada giusta 🎯'
    : kcalPct < 95 ? 'Quasi al target, stai andando benissimo!'
    : kcalPct <= 105 ? 'Target raggiunto! Grande lavoro oggi 🎉'
    : 'Attenzione: hai superato il target calorico'

  return (
    <>
      <Confetti active={confetti} onDone={() => setConfetti(false)}/>
      <Toast message={toast.message} emoji={toast.emoji} visible={toast.visible}/>

      {/* HERO — sfondo dark premium */}
      <div style={{
        background:'#080808',
        padding:'18px 18px 20px',
        flexShrink:0,
        borderBottom:'0.5px solid #111',
      }}>
        {/* Saluto + streak */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:'#A0A0A0',marginBottom:4,fontWeight:500}}>
              {todayName} · {new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long'})}
            </div>
            <div style={{fontSize:22,fontWeight:800,color:'#F0F0F0',letterSpacing:-0.8,lineHeight:1.1}}>
              {greeting}, <span style={{color:'#F4894A'}}>{firstName}</span>
            </div>
            <div style={{fontSize:12,color:'#DDD',marginTop:5}}>{motivMsg}</div>
          </div>
          {streak > 0 && (
            <div style={{background:'#120800',border:'0.5px solid rgba(212,87,10,0.25)',borderRadius:14,padding:'8px 12px',textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:22,fontWeight:800,color:'#F4894A',lineHeight:1}}>
                <AnimatedNumber value={streak} duration={400}/>
              </div>
              <div style={{fontSize:9,color:'#D4570A',fontWeight:700,marginTop:2}}>giorni 🔥</div>
            </div>
          )}
        </div>

        {/* Barra kcal principale */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
            <span style={{fontSize:11,color:'#CCC',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em'}}>Kcal oggi</span>
            <span style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>
              <AnimatedNumber value={Math.round(todayKcal)} duration={500}/>
              <span style={{color:'#A0A0A0',fontWeight:400,fontSize:11}}> / {kcalTarget.toLocaleString('it-IT')}</span>
            </span>
          </div>
          {/* Barra con pallino scorrevole */}
          <div style={{position:'relative',height:8,background:'#161616',borderRadius:6,overflow:'visible'}}>
            <div style={{
              height:8,
              borderRadius:6,
              background: todayKcal/kcalTarget > 1.05 ? '#E24B4A' : todayKcal/kcalTarget > 0.95 ? '#3B8C5A' : '#D4570A',
              width:`${Math.min(100, todayKcal/kcalTarget*100)}%`,
              transition:'width 0.8s ease',
              position:'relative',
            }}>
              {todayKcal > 0 && (
                <div style={{position:'absolute',right:-5,top:'50%',transform:'translateY(-50%)',width:14,height:14,background:'#F4894A',borderRadius:'50%',border:'2px solid #080808'}}/>
              )}
            </div>
          </div>
          <div style={{fontSize:10,color:'#A0A0A0',marginTop:5,textAlign:'right'}}>
            {remaining > 0 ? `${remaining.toLocaleString('it-IT')} kcal rimanenti` : 'Target raggiunto 🎉'}
          </div>
        </div>

        {/* Macro trio */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[
            {label:'Proteine', val:Math.round(todayP), target:pTarget, color:'#4A90D4'},
            {label:'Carboidrati', val:Math.round(todayC), target:cTarget, color:'#E8A020'},
            {label:'Grassi', val:Math.round(todayG), target:gTarget, color:'#3B8C5A'},
          ].map(m => {
            const pct = Math.min(100, m.target > 0 ? Math.round(m.val/m.target*100) : 0)
            return (
              <div key={m.label} style={{background:'#0D0D0D',borderRadius:10,padding:'10px 10px 8px',border:'0.5px solid #161616'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
                  <span style={{fontSize:16,fontWeight:800,color:'#F0F0F0'}}>
                    <AnimatedNumber value={m.val} duration={400}/>
                  </span>
                  <span style={{fontSize:9,color:'#A0A0A0',fontWeight:500}}>/{m.target}g</span>
                </div>
                <div style={{height:3,background:'#1A1A1A',borderRadius:3,marginBottom:5,overflow:'hidden'}}>
                  <div style={{height:3,borderRadius:3,background:m.color,width:`${pct}%`,transition:'width 0.6s ease'}}/>
                </div>
                <div style={{fontSize:9,color:'#DDD',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CONTENUTO SCROLLABILE */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>

        {/* BANNER NOTIFICHE */}
        {notifStatus === 'default' && (
          <FadeIn delay={50}>
          <div style={{background:'#0D0D0D',borderRadius:12,padding:'12px 14px',border:'0.5px solid rgba(212,87,10,0.2)',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:'rgba(212,87,10,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <i className="ti ti-bell" style={{fontSize:16,color:'#D4570A'}}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0'}}>Attiva i promemoria</div>
              <div style={{fontSize:10,color:'#BBB',marginTop:1}}>Reminder serale per il diario</div>
            </div>
            <button onClick={async()=>{
              const r = await requestNotificationPermission(profile.id)
              if (r.ok) { setNotifStatus('granted'); sendTestNotification(); showToast('Notifiche attivate!','🔔') }
              else setNotifStatus('denied')
            }} style={{background:'#D4570A',color:'white',border:'none',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
              Attiva
            </button>
          </div>
          </FadeIn>
        )}

        {/* PROSSIMO ALLENAMENTO */}
        {nextWorkout && (
          <FadeIn delay={80}>
          <Link to="/allenamento" style={{textDecoration:'none',display:'block',marginBottom:12}}>
            <div style={{background:'#0D0D0D',borderRadius:14,border:'0.5px solid #1C1C1C',overflow:'hidden'}}>
              <div style={{padding:'12px 14px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:34,height:34,borderRadius:10,background:'rgba(59,140,90,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <i className="ti ti-barbell" style={{fontSize:17,color:'#3B8C5A'}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>
                      {new Date().toLocaleDateString('it-IT',{weekday:'long'}).charAt(0).toUpperCase() + new Date().toLocaleDateString('it-IT',{weekday:'long'}).slice(1)}
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>
                      {nextWorkout.name}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {nextWorkoutExercises.length > 0 && (
                    <div style={{background:'rgba(59,140,90,0.15)',borderRadius:20,padding:'3px 9px',fontSize:10,fontWeight:700,color:'#3B8C5A'}}>
                      {nextWorkoutExercises.length} es.
                    </div>
                  )}
                  <i className="ti ti-chevron-right" style={{fontSize:14,color:'#333'}}/>
                </div>
              </div>
              {nextWorkoutExercises.length > 0 && (
                <div style={{padding:'0 14px 12px',display:'flex',flexDirection:'column',gap:5}}>
                  {nextWorkoutExercises.slice(0,4).map((ex,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:5,height:5,borderRadius:'50%',background:'#3B8C5A',flexShrink:0}}/>
                      <span style={{fontSize:12,color:'#DDD',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.exercise_name}</span>
                      <span style={{fontSize:10,color:'#555',flexShrink:0}}>{ex.sets}×{ex.reps}</span>
                    </div>
                  ))}
                  {nextWorkoutExercises.length > 4 && (
                    <div style={{fontSize:10,color:'#555',marginLeft:13}}>+{nextWorkoutExercises.length-4} altri esercizi</div>
                  )}
                </div>
              )}
              {nextWorkoutExercises.length === 0 && (
                <div style={{padding:'0 14px 12px',fontSize:12,color:'#555'}}>Nessun esercizio per oggi — giorno di riposo 😌</div>
              )}
            </div>
          </Link>
          </FadeIn>
        )}



        {/* SCHEDA ALLENAMENTO */}
        {nextWorkout && (
          <FadeIn delay={80}>
          <Link to="/allenamento" style={{textDecoration:'none',display:'block',marginBottom:12}}>
            <div style={{background:'#0D0D0D',borderRadius:14,border:'0.5px solid #1C1C1C',overflow:'hidden'}}>
              {/* Header */}
              <div style={{padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'0.5px solid #161616'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:'rgba(59,140,90,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <i className="ti ti-barbell" style={{fontSize:17,color:'#3B8C5A'}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>La tua scheda</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>{nextWorkout.name}</div>
                  </div>
                </div>
                <i className="ti ti-chevron-right" style={{fontSize:14,color:'#444'}}/>
              </div>
              {/* Gruppi muscolari */}
              {nextWorkoutExercises.length > 0 && (
                <div style={{padding:'10px 14px'}}>
                  <div style={{fontSize:9,color:'#555',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Muscoli allenati</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {[...new Set(nextWorkoutExercises.map(e=>e.muscle_group).filter(Boolean))].map((g,i) => (
                      <div key={i} style={{background:'rgba(59,140,90,0.12)',borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:600,color:'#3B8C5A',border:'0.5px solid rgba(59,140,90,0.2)'}}>
                        {g}
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:'#555',marginTop:8}}>
                    {nextWorkoutExercises.length} esercizi totali nella scheda
                  </div>
                </div>
              )}
            </div>
          </Link>
          </FadeIn>
        )}

        {/* RIEPILOGO SETTIMANA */}
        {weekStats && (
          <FadeIn delay={100}>
          <div style={{background:'#0D0D0D',borderRadius:14,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Questa settimana</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:'#0A0A0A',borderRadius:10,padding:'12px',textAlign:'center',border:'0.5px solid #161616'}}>
                <div style={{fontSize:28,fontWeight:800,color:'#3B8C5A',lineHeight:1}}>{weekStats.sessions}</div>
                <div style={{fontSize:10,color:'#888',marginTop:5,fontWeight:600}}>allenamenti</div>
              </div>
              <div style={{background:'#0A0A0A',borderRadius:10,padding:'12px',textAlign:'center',border:'0.5px solid #161616'}}>
                <div style={{fontSize:28,fontWeight:800,color:'#4A90D4',lineHeight:1}}>{weekStats.diaryDays}</div>
                <div style={{fontSize:10,color:'#888',marginTop:5,fontWeight:600}}>giorni diario</div>
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* ULTIMA MISURAZIONE */}
        {measurements && (
          <FadeIn delay={100}>
          <div style={{background:'#0D0D0D',borderRadius:14,padding:'14px 16px',border:'0.5px solid #161616',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:9,fontWeight:700,color:'#F0F0F0',textTransform:'uppercase',letterSpacing:'0.1em'}}>Ultima misurazione</div>
              <div style={{fontSize:10,color:'#A0A0A0'}}>{new Date(measurements.entry_date).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>
            </div>
            <div style={{display:'flex',gap:12}}>
              {[
                {label:'Peso', val:measurements.weight_kg, unit:'kg', color:'#F4894A'},
                {label:'Vita', val:measurements.waist_cm, unit:'cm', color:'#4A90D4'},
                {label:'Grasso', val:measurements.body_fat_pct, unit:'%', color:'#9B59B6'},
              ].filter(m=>m.val).map(m=>(
                <div key={m.label} style={{flex:1,background:'#0A0A0A',borderRadius:10,padding:'10px 8px',textAlign:'center',border:'0.5px solid #141414',borderBottom:`2px solid ${m.color}40`}}>
                  <div style={{fontSize:20,fontWeight:800,color:'#F0F0F0',lineHeight:1}}>{m.val}</div>
                  <div style={{fontSize:9,color:m.color,fontWeight:700,margin:'3px 0 2px'}}>{m.unit}</div>
                  <div style={{fontSize:9,color:'#A0A0A0'}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
          </FadeIn>
        )}

        {/* CONFRONTO SETTIMANA */}
        {weeklyComp && (weeklyComp.thisSess > 0 || weeklyComp.kcalDiff !== 0) && (
          <FadeIn delay={120}>
          <div style={{background:'#0D0D0D',borderRadius:14,padding:'14px 16px',border:'0.5px solid #161616',marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:'#F0F0F0',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Vs settimana scorsa</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:'#0A0A0A',borderRadius:10,padding:'10px',textAlign:'center',border:'0.5px solid #141414'}}>
                <div style={{fontSize:22,fontWeight:800,color:weeklyComp.sessDiff>=0?'#3B8C5A':'#E24B4A'}}>
                  {weeklyComp.sessDiff>0?'+':''}{weeklyComp.sessDiff}
                </div>
                <div style={{fontSize:9,color:'#BBB',marginTop:3}}>sessioni allenamento</div>
                <div style={{fontSize:9,color:'#BBB',marginTop:2}}>{weeklyComp.thisSess} questa · {weeklyComp.lastSess} scorsa</div>
              </div>
              <div style={{background:'#0A0A0A',borderRadius:10,padding:'10px',textAlign:'center',border:'0.5px solid #141414'}}>
                <div style={{fontSize:22,fontWeight:800,color:Math.abs(weeklyComp.kcalDiff)<150?'#3B8C5A':'#E8A020'}}>
                  {weeklyComp.kcalDiff>0?'+':''}{weeklyComp.kcalDiff}
                </div>
                <div style={{fontSize:9,color:'#BBB',marginTop:3}}>kcal medie/giorno</div>
                <div style={{fontSize:9,color:'#BBB',marginTop:2}}>rispetto alla sett. scorsa</div>
              </div>
            </div>
          </div>
          </FadeIn>
        )}

        {/* GRAFICO PESO */}
        {measurements && (
          <FadeIn delay={140}>
          <div style={{background:'#0D0D0D',borderRadius:14,padding:'14px 16px',border:'0.5px solid #161616',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:9,fontWeight:700,color:'#F0F0F0',textTransform:'uppercase',letterSpacing:'0.1em'}}>Andamento peso</div>
              <Link to="/progressi" style={{fontSize:10,color:'#D4570A',fontWeight:700,textDecoration:'none'}}>Vedi tutto →</Link>
            </div>
            <GraficoPeso compact={true}/>
          </div>
          </FadeIn>
        )}

        {/* NOTE COACH */}
        {plan?.notes && (
          <div style={{background:'#120800',borderRadius:14,padding:'14px 16px',border:'0.5px solid rgba(212,87,10,0.2)',marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
              <i className="ti ti-message-circle" style={{fontSize:12}}/> Note del coach
            </div>
            <div style={{fontSize:13,color:'#C5783A',lineHeight:1.6}}>{plan.notes}</div>
          </div>
        )}

      </div>
    </>
  )
}
