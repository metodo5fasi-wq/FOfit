import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useTheme } from '../App'
import { Link } from 'react-router-dom'
import { Confetti, Toast, AnimatedNumber, FadeIn, PulseDot } from '../components/Animations'
import { requestNotificationPermission, checkNotificationStatus, sendTestNotification } from '../lib/notifications'

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
        <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2}}>kcal</div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:1}}>di {target.toLocaleString('it-IT')}</div>
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
        <div style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>giorni</div>
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
  const prevKcalRef = React.useRef(0)

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
  const pTarget = plan?.protein_target_g || 150
  const cTarget = plan?.carbs_target_g || 220
  const gTarget = plan?.fat_target_g || 65
  const kcalTarget = plan?.kcal_target || 2200
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
      {/* HERO */}
      <div style={{
        background:'linear-gradient(135deg, #1a0a00 0%, #2d1200 50%, #1a0a00 100%)',
        padding:'20px 22px 24px', flexShrink:0, position:'relative', overflow:'hidden'
      }}>
        <div style={{position:'absolute',top:-40,right:-40,width:180,height:180,borderRadius:'50%',background:'rgba(212,87,10,0.07)'}}/>
        <div style={{position:'absolute',bottom:-20,left:60,width:100,height:100,borderRadius:'50%',background:'rgba(244,137,74,0.05)'}}/>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,position:'relative'}}>
          <div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.38)',marginBottom:3}}>{todayName} · {new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long'})}</div>
            <div style={{fontSize:20,fontWeight:600,color:'white',letterSpacing:-0.3}}>
              {greeting}, <span style={{color:'#F4894A'}}>{firstName}</span> 👋
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.38)',marginTop:3}}>{motivMsg}</div>
          </div>
          <StreakBadge streak={streak}/>
        </div>

        {/* Cerchio + macro */}
        <div style={{display:'flex',alignItems:'center',gap:20,position:'relative'}}>
          <CalorieRing current={todayKcal} target={kcalTarget}/>

          <div style={{flex:1,display:'flex',flexDirection:'column',gap:10}}>
            {[
              { label:'Proteine', val:Math.round(todayP), target:pTarget, unit:'g', color:'#D4570A' },
              { label:'Carboidrati', val:Math.round(todayC), target:cTarget, unit:'g', color:'#F4894A' },
              { label:'Grassi', val:Math.round(todayG), target:gTarget, unit:'g', color:'#FAC775' },
            ].map(m => {
              const pct = Math.min(100, m.target > 0 ? Math.round(m.val/m.target*100) : 0)
              return (
                <div key={m.label}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>{m.label}</span>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.7)',fontWeight:500}}><AnimatedNumber value={m.val} duration={400}/><span style={{color:'rgba(255,255,255,0.3)'}}>/{m.target}{m.unit}</span></span>
                  </div>
                  <div style={{height:5,background:'rgba(255,255,255,0.08)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:5,borderRadius:3,background:m.color,width:`${pct}%`,transition:'width 0.6s ease'}}/>
                  </div>
                </div>
              )
            })}
            <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2}}>
              {remaining.toLocaleString('it-IT')} kcal rimanenti
            </div>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>

        {/* BANNER NOTIFICHE */}
        {notifStatus === 'default' && (
          <FadeIn delay={50}>
          <div style={{background:theme.bgCard,borderRadius:12,padding:'14px 16px',border:`0.5px solid ${theme.border}`,marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:theme.orangeLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <i className="ti ti-bell" style={{fontSize:18,color:theme.orange}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Attiva i promemoria</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>Ricevi un reminder serale per compilare il diario</div>
            </div>
            <button onClick={async()=>{
              const r = await requestNotificationPermission(profile.id)
              if (r.ok) {
                setNotifStatus('granted')
                sendTestNotification()
                showToast('Notifiche attivate!', '🔔')
              } else {
                setNotifStatus('denied')
              }
            }} style={{background:theme.orange,color:'white',border:'none',borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
              Attiva
            </button>
          </div>
          </FadeIn>
        )}

        {/* QUICK LINKS */}
        <FadeIn delay={100}>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:'#888780',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:10}}>Accesso rapido</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {QUICK_LINKS.map(link => (
              <Link key={link.to} to={link.to} style={{
                background:'white', borderRadius:14, padding:'16px 14px', textDecoration:'none',
                border:'0.5px solid #E0DDD6', display:'flex', flexDirection:'column', gap:10,
                boxShadow:'0 2px 6px rgba(0,0,0,0.06)'
              }}>
                <div style={{width:44,height:44,borderRadius:12,background:link.bg,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 2px 8px ${link.color}22`}}>
                  <i className={`ti ${link.icon}`} style={{fontSize:22,color:link.color}}/>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{link.label}</div>
                  <div style={{fontSize:11,color:'#888780',marginTop:2}}>{link.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        </FadeIn>

        {/* STATO FISICO */}
        {measurements && (
          <div style={{background:'white',borderRadius:12,padding:'14px 16px',border:'0.5px solid #E0DDD6',marginBottom:14,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#888780',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:12}}>Ultima misurazione</div>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {[
                { label:'Peso', val:measurements.weight_kg, unit:'kg' },
                { label:'Vita', val:measurements.waist_cm, unit:'cm' },
                { label:'% Grasso', val:measurements.body_fat_pct, unit:'%' },
              ].filter(m=>m.val).map(m=>(
                <div key={m.label}>
                  <div style={{fontSize:10,color:'#888780'}}>{m.label}</div>
                  <div style={{fontSize:20,fontWeight:600,color:'#111',lineHeight:1.2}}>{m.val}<span style={{fontSize:11,color:'#888780',fontWeight:400}}>{m.unit}</span></div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:'#888780',marginTop:8}}>
              {new Date(measurements.entry_date).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
            </div>
          </div>
        )}

        {/* NOTE COACH */}
        {plan?.notes && (
          <div style={{background:'linear-gradient(135deg,#FEF0E7,#FEF8F4)',borderRadius:12,padding:'14px 16px',border:'0.5px solid #F4C9A8',marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:600,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
              <i className="ti ti-message-circle" style={{fontSize:12}}/> Note del coach
            </div>
            <div style={{fontSize:13,color:'#7a3508',lineHeight:1.6}}>{plan.notes}</div>
          </div>
        )}

      </div>
    </>
  )
}
