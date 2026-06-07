import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Link } from 'react-router-dom'

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  title: { fontSize:15, fontWeight:500, color:'#111' },
  sub: { fontSize:12, color:'#888780' },
  badge: { background:'#FEF0E7', color:'#D4570A', fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 },
  grid2: { display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:12 },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'12px 14px' },
  cardTitle: { fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:7, marginBottom:12 },
  statLabel: { fontSize:10, color:'#888780', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
  statVal: { fontSize:20, fontWeight:500, color:'#111' },
  statUnit: { fontSize:11, color:'#888780', marginTop:2 },
  bar: { height:4, background:'#E0DDD6', borderRadius:2, marginTop:8 },
  barFill: { height:4, background:'#D4570A', borderRadius:2 },
  mealRow: { display:'flex', alignItems:'center', gap:9, padding:'8px 0', borderBottom:'0.5px solid #F5F3EF' },
  dot: { width:7, height:7, borderRadius:'50%', background:'#D4570A', flexShrink:0 },
  quickLink: { display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#F5F3EF', borderRadius:8, textDecoration:'none', color:'#111', fontSize:13, marginBottom:8 },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [measurements, setMeasurements] = useState(null)
  const [todayKcal, setTodayKcal] = useState(0)
  const [plan, setPlan] = useState(null)
  const today = new Date().toISOString().split('T')[0]
  const dayNames = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']
  const todayName = dayNames[new Date().getDay()]

  useEffect(() => {
    if (!profile) return
    // Ultima misurazione
    supabase.from('body_measurements').select('*')
      .eq('client_id', profile.id).order('measured_at', { ascending:false }).limit(1)
      .then(({ data }) => data?.length && setMeasurements(data[0]))
    // Calorie oggi dal diario
    supabase.from('diary_entries').select('kcal')
      .eq('client_id', profile.id).eq('entry_date', today)
      .then(({ data }) => {
        if (data) setTodayKcal(data.reduce((s,r) => s + (r.kcal||0), 0))
      })
    // Piano attivo
    supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1)
      .then(({ data }) => data?.length && setPlan(data[0]))
  }, [profile])

  const kcalTarget = plan?.kcal_target || 2200
  const kcalPct = Math.min(100, Math.round(todayKcal / kcalTarget * 100))
  const remaining = Math.max(0, kcalTarget - Math.round(todayKcal))

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={s.title}>Buongiorno, {profile?.full_name?.split(' ')[0] || 'utente'}</div>
          <div style={s.sub}>{todayName} · {new Date().toLocaleDateString('it-IT', { day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
        <span style={s.badge}>{kcalTarget.toLocaleString('it-IT')} kcal/giorno</span>
      </div>

      <div style={s.page}>
        {/* Stats */}
        <div style={s.grid4}>
          <div style={s.card}>
            <div style={s.statLabel}>Calorie oggi</div>
            <div style={s.statVal}>{Math.round(todayKcal).toLocaleString('it-IT')}</div>
            <div style={s.statUnit}>di {kcalTarget.toLocaleString('it-IT')} kcal</div>
            <div style={s.bar}><div style={{...s.barFill, width:`${kcalPct}%`}} /></div>
          </div>
          <div style={s.card}>
            <div style={s.statLabel}>Rimanenti</div>
            <div style={s.statVal}>{remaining.toLocaleString('it-IT')}</div>
            <div style={s.statUnit}>kcal ancora disponibili</div>
            <div style={s.bar}><div style={{...s.barFill, width:`${100-kcalPct}%`, background:'#F4894A'}} /></div>
          </div>
          <div style={s.card}>
            <div style={s.statLabel}>Peso attuale</div>
            <div style={s.statVal}>{measurements?.weight_kg ?? '—'}<span style={{fontSize:12}}>{measurements ? ' kg' : ''}</span></div>
            <div style={s.statUnit}>{measurements ? `Rilevato il ${new Date(measurements.measured_at).toLocaleDateString('it-IT')}` : 'Nessuna misurazione'}</div>
          </div>
          <div style={s.card}>
            <div style={s.statLabel}>% Grasso</div>
            <div style={s.statVal}>{measurements?.body_fat_pct ?? '—'}<span style={{fontSize:12}}>{measurements ? '%' : ''}</span></div>
            <div style={s.statUnit}>{measurements ? 'Ultima rilevazione' : 'Inserisci i dati'}</div>
          </div>
        </div>

        <div style={s.grid2}>
          {/* Accessi rapidi */}
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-layout-grid" style={{fontSize:16,color:'#D4570A'}} /> Accesso rapido</div>
            <Link to="/piano" style={s.quickLink}>
              <i className="ti ti-clipboard-list" style={{fontSize:18,color:'#D4570A'}} />
              <div><div style={{fontWeight:500}}>Piano alimentare</div><div style={{fontSize:11,color:'#888780'}}>Visualizza i tuoi pasti della settimana</div></div>
              <i className="ti ti-chevron-right" style={{marginLeft:'auto',color:'#E0DDD6'}} />
            </Link>
            <Link to="/diario" style={s.quickLink}>
              <i className="ti ti-pencil" style={{fontSize:18,color:'#D4570A'}} />
              <div><div style={{fontWeight:500}}>Diario di oggi</div><div style={{fontSize:11,color:'#888780'}}>Registra quello che mangi</div></div>
              <i className="ti ti-chevron-right" style={{marginLeft:'auto',color:'#E0DDD6'}} />
            </Link>
            <Link to="/progressi" style={s.quickLink}>
              <i className="ti ti-chart-line" style={{fontSize:18,color:'#D4570A'}} />
              <div><div style={{fontWeight:500}}>Tracker progressi</div><div style={{fontSize:11,color:'#888780'}}>Inserisci peso e misurazioni</div></div>
              <i className="ti ti-chevron-right" style={{marginLeft:'auto',color:'#E0DDD6'}} />
            </Link>
            <Link to="/ai" style={s.quickLink}>
              <i className="ti ti-robot" style={{fontSize:18,color:'#D4570A'}} />
              <div><div style={{fontWeight:500}}>Assistente AI</div><div style={{fontSize:11,color:'#888780'}}>Chiedi consiglio al tuo assistente</div></div>
              <i className="ti ti-chevron-right" style={{marginLeft:'auto',color:'#E0DDD6'}} />
            </Link>
          </div>

          {/* Info piano */}
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-target" style={{fontSize:16,color:'#D4570A'}} /> Il tuo piano</div>
            {plan ? (
              <>
                <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:12}}>{plan.title}</div>
                {[
                  { label:'Calorie', val:`${plan.kcal_target} kcal` },
                  { label:'Proteine', val:`${plan.protein_target_g}g` },
                  { label:'Carboidrati', val:`${plan.carbs_target_g}g` },
                  { label:'Grassi', val:`${plan.fat_target_g}g` },
                ].map(r => (
                  <div key={r.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'0.5px solid #F5F3EF'}}>
                    <span style={{fontSize:12,color:'#888780'}}>{r.label}</span>
                    <span style={{fontSize:12,fontWeight:500,color:'#111'}}>{r.val}</span>
                  </div>
                ))}
                {plan.notes && (
                  <div style={{marginTop:12,background:'#FEF0E7',borderLeft:'3px solid #D4570A',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#7a3508',lineHeight:1.5}}>
                    {plan.notes}
                  </div>
                )}
              </>
            ) : (
              <div style={{fontSize:13,color:'#888780',textAlign:'center',padding:'20px 0'}}>
                <i className="ti ti-clipboard-x" style={{fontSize:32,display:'block',marginBottom:8,color:'#E0DDD6'}} />
                Nessun piano attivo.<br />Contatta il tuo coach.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
