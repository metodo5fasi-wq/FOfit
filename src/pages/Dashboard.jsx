import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Link } from 'react-router-dom'

const QUICK_LINKS = [
  { to:'/piano', icon:'ti-clipboard-list', label:'Piano alimentare', sub:'Visualizza i tuoi pasti', color:'#D4570A', bg:'#FEF0E7' },
  { to:'/diario', icon:'ti-pencil', label:'Diario di oggi', sub:'Registra quello che mangi', color:'#E8803A', bg:'#FEF3EC' },
  { to:'/progressi', icon:'ti-chart-line', label:'Progressi', sub:'Peso e misurazioni', color:'#3B8C5A', bg:'#EAF3DE' },
  { to:'/ai', icon:'ti-robot', label:'FO Coach AI', sub:'Chiedi consiglio', color:'#9B59B6', bg:'#F5EEF8' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const [measurements, setMeasurements] = useState(null)
  const [todayKcal, setTodayKcal] = useState(0)
  const [todayP, setTodayP] = useState(0)
  const [todayC, setTodayC] = useState(0)
  const [todayG, setTodayG] = useState(0)
  const [plan, setPlan] = useState(null)
  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const dayNames = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']
  const todayName = dayNames[new Date().getDay()]

  useEffect(() => {
    if (!profile) return
    supabase.from('progress_entries').select('*')
      .eq('client_id', profile.id).order('entry_date', { ascending:false }).limit(1)
      .then(({ data }) => data?.length && setMeasurements(data[0]))
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
    supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1)
      .then(({ data }) => data?.length && setPlan(data[0]))
  }, [profile])

  const kcalTarget = plan?.kcal_target || 2200
  const pTarget = plan?.protein_target_g || 150
  const cTarget = plan?.carbs_target_g || 220
  const gTarget = plan?.fat_target_g || 65
  const kcalPct = Math.min(100, Math.round(todayKcal / kcalTarget * 100))
  const remaining = Math.max(0, kcalTarget - Math.round(todayKcal))
  const firstName = profile?.full_name?.split(' ')[0] || 'utente'

  return (
    <>
      {/* HERO TOPBAR */}
      <div style={{
        background:'linear-gradient(135deg, #1a0a00 0%, #2d1200 50%, #1a0a00 100%)',
        padding:'20px 22px 22px', flexShrink:0, position:'relative', overflow:'hidden'
      }}>
        {/* Decorazione sfondo */}
        <div style={{position:'absolute',top:-30,right:-30,width:150,height:150,borderRadius:'50%',background:'rgba(212,87,10,0.08)'}}/>
        <div style={{position:'absolute',bottom:-20,right:60,width:80,height:80,borderRadius:'50%',background:'rgba(244,137,74,0.06)'}}/>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',position:'relative'}}>
          <div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:3}}>{todayName} · {new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long'})}</div>
            <div style={{fontSize:22,fontWeight:600,color:'white',letterSpacing:-0.5}}>
              {greeting}, <span style={{color:'#F4894A'}}>{firstName}</span> 👋
            </div>
            {plan && <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:4}}>{plan.title}</div>}
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>Target</div>
            <div style={{fontSize:18,fontWeight:600,color:'#F4894A'}}>{kcalTarget.toLocaleString('it-IT')}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>kcal/giorno</div>
          </div>
        </div>

        {/* Barra calorie principale */}
        <div style={{marginTop:18}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>Calorie oggi</span>
            <span style={{fontSize:12,color:'white',fontWeight:500}}>{Math.round(todayKcal).toLocaleString('it-IT')} / {kcalTarget.toLocaleString('it-IT')} kcal</span>
          </div>
          <div style={{height:8,background:'rgba(255,255,255,0.1)',borderRadius:4,overflow:'hidden'}}>
            <div style={{
              height:8, borderRadius:4, transition:'width 0.5s ease',
              width:`${kcalPct}%`,
              background: kcalPct > 100 ? '#E24B4A' : 'linear-gradient(90deg, #D4570A, #F4894A)'
            }}/>
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:5}}>{remaining.toLocaleString('it-IT')} kcal rimanenti</div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>

        {/* MACRO CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
          {[
            { label:'Proteine', val:Math.round(todayP), target:pTarget, unit:'g', color:'#D4570A', bg:'#FEF0E7' },
            { label:'Carboidrati', val:Math.round(todayC), target:cTarget, unit:'g', color:'#F4894A', bg:'#FEF3EC' },
            { label:'Grassi', val:Math.round(todayG), target:gTarget, unit:'g', color:'#FAC775', bg:'#FEF9EE' },
          ].map(m => {
            const pct = Math.min(100, Math.round(m.val / m.target * 100))
            return (
              <div key={m.label} style={{background:'white',borderRadius:12,padding:'12px',border:'0.5px solid #E0DDD6',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                <div style={{fontSize:10,color:'#888780',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>{m.label}</div>
                <div style={{fontSize:19,fontWeight:600,color:'#111',lineHeight:1}}>{m.val}<span style={{fontSize:11,color:'#888780',fontWeight:400}}>{m.unit}</span></div>
                <div style={{height:3,background:'#F5F3EF',borderRadius:2,marginTop:8}}>
                  <div style={{height:3,borderRadius:2,background:m.color,width:`${pct}%`,transition:'width 0.4s'}}/>
                </div>
                <div style={{fontSize:10,color:'#888780',marginTop:3}}>di {m.target}{m.unit}</div>
              </div>
            )
          })}
        </div>

        {/* ACCESSO RAPIDO */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'#888780',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Accesso rapido</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {QUICK_LINKS.map(link => (
              <Link key={link.to} to={link.to} style={{
                background:'white', borderRadius:12, padding:'14px', textDecoration:'none',
                border:'0.5px solid #E0DDD6', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                display:'flex', flexDirection:'column', gap:8, transition:'transform 0.15s'
              }}>
                <div style={{width:36,height:36,borderRadius:10,background:link.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${link.icon}`} style={{fontSize:18,color:link.color}}/>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'#111'}}>{link.label}</div>
                  <div style={{fontSize:11,color:'#888780',marginTop:1}}>{link.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* STATO FISICO */}
        {measurements && (
          <div style={{background:'white',borderRadius:12,padding:'14px 16px',border:'0.5px solid #E0DDD6',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:12,fontWeight:600,color:'#888780',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Ultima misurazione</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {[
                { label:'Peso', val:measurements.weight_kg, unit:'kg' },
                { label:'Vita', val:measurements.waist_cm, unit:'cm' },
                { label:'% Grasso', val:measurements.body_fat_pct, unit:'%' },
              ].filter(m=>m.val).map(m=>(
                <div key={m.label}>
                  <div style={{fontSize:10,color:'#888780'}}>{m.label}</div>
                  <div style={{fontSize:18,fontWeight:600,color:'#111'}}>{m.val}<span style={{fontSize:11,color:'#888780'}}>{m.unit}</span></div>
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
          <div style={{background:'linear-gradient(135deg,#FEF0E7,#FEF8F4)',borderRadius:12,padding:'14px 16px',border:'0.5px solid #F4894A',boxShadow:'0 1px 4px rgba(212,87,10,0.08)'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
              <i className="ti ti-message-circle" style={{fontSize:12}}/> Note del coach
            </div>
            <div style={{fontSize:13,color:'#7a3508',lineHeight:1.6}}>{plan.notes}</div>
          </div>
        )}

      </div>
    </>
  )
}
