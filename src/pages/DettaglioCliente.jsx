import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import GraficoPeso from '../components/GraficoPeso'
import ProgressioneEsercizi from '../components/ProgressioneEsercizi'
import ReportAllenamento from './ReportAllenamento'
import Anamnesi from './Anamnesi'

const GOAL_LABEL = { dimagrimento:'Dimagrimento', massa:'Massa muscolare', mantenimento:'Mantenimento', forza:'Forza', resistenza:'Resistenza' }
const GOAL_COLOR = { dimagrimento:'#E24B4A', massa:'#3B6D11', mantenimento:'#E8A020', forza:'#7C3AED', resistenza:'#4A90D4' }
const initials = n => n ? n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() : 'U'

const s = {
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' },
  btnGreen: { background:'#EAF3DE', color:'#3B6D11', border:'0.5px solid #3B6D11', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'14px', marginBottom:12 },
  sectionTitle: { fontSize:10, fontWeight:700, color:'#888780', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, display:'flex', alignItems:'center', gap:5 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  badge: (bg, color) => ({ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:600, background:bg, color }),
  statBox: (color) => ({ background:'#F5F3EF', borderRadius:10, padding:'11px', textAlign:'center', border:'0.5px solid #E0DDD6' }),
}

const TABS = [
  { id:'overview', icon:'ti-layout-dashboard', label:'Overview' },
  { id:'nutrizione', icon:'ti-salad', label:'Nutrizione' },
  { id:'allenamento', icon:'ti-barbell', label:'Allenamento' },
  { id:'progressi', icon:'ti-chart-line', label:'Progressi' },
  { id:'note', icon:'ti-notes', label:'Note' },
]

export default function DettaglioCliente() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', clientId).single()
      .then(({ data }) => { setClient(data); setLoading(false) })
  }, [clientId])

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#F5F3EF'}}>
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',height:56,display:'flex',alignItems:'center',padding:'0 16px',gap:12,flexShrink:0}}>
        <button onClick={()=>navigate('/admin')} style={{...s.btnGray,padding:'5px 10px'}}><i className="ti ti-arrow-left" style={{fontSize:14}}/></button>
        <div style={{fontSize:15,fontWeight:600}}>Caricamento...</div>
      </div>
    </div>
  )

  if (!client) return null
  return <ClientDetail client={client} navigate={navigate} />
}

function ClientDetail({ client, navigate }) {
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name:client.full_name||'', goal:client.goal||'dimagrimento', height_cm:client.height_cm||'', phone:client.phone||'', notes:client.notes||'', coach_notes:client.coach_notes||'' })
  const [data, setData] = useState({
    measurements:[], photos:[], diaryWeek:[], sessions:[], logs:[],
    checkin:null, adherence:null, mealPlan:null, workoutPlan:null,
    anamnesi:null, reports:[], unreadMsgs:0
  })
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [comparePair, setComparePair] = useState([])
  const [showAnamnesi, setShowAnamnesi] = useState(false)
  const [editingPlan, setEditingPlan] = useState(false)
  const [planEdit, setPlanEdit] = useState({})
  const [quickMsg, setQuickMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [reports, setReports] = useState([])
  const [expandedReport, setExpandedReport] = useState(null)

  useEffect(() => { loadAll() }, [client.id])

  async function loadAll() {
    setLoading(true)
    const ago7 = new Date(Date.now()-7*86400000).toISOString().split('T')[0]
    try {
      const [measR, photoR, diaryR, sessR, sessCountR, logsR, checkinR, msgR, adhR, mealR, workR, amnR, repR] = await Promise.all([
        supabase.from('progress_entries').select('*').eq('client_id',client.id).order('entry_date',{ascending:false}).limit(12),
        supabase.from('progress_photos').select('*').eq('client_id',client.id).order('photo_date',{ascending:false}).limit(12),
        supabase.from('diary_entries').select('entry_date,kcal,protein_g,carbs_g,fat_g').eq('client_id',client.id).gte('entry_date',ago7),
        supabase.from('workout_sessions').select('*').eq('client_id',client.id).order('session_date',{ascending:false}).limit(10),
        supabase.from('workout_sessions').select('id',{count:'exact',head:true}).eq('client_id',client.id),
        supabase.from('workout_logs').select('*').eq('client_id',client.id).gte('log_date',ago7).order('log_date',{ascending:false}),
        supabase.from('weekly_checkins').select('*').eq('client_id',client.id).order('week_date',{ascending:false}).limit(1),
        supabase.from('coach_messages').select('id',{count:'exact',head:true}).eq('client_id',client.id).eq('sender_role','client').eq('is_read',false),
        supabase.from('meal_adherence').select('followed').eq('client_id',client.id).gte('adherence_date',ago7),
        supabase.from('meal_plans').select('*').eq('client_id',client.id).order('created_at',{ascending:false}).limit(5),
        supabase.from('workout_plans').select('*').eq('client_id',client.id).order('created_at',{ascending:false}).limit(5),
        supabase.from('anamnesi').select('*').eq('client_id',client.id).maybeSingle(),
        supabase.from('workout_reports').select('*').eq('client_id',client.id).not('submitted_at','is',null).order('submitted_at',{ascending:false}).limit(5),
      ])
      const mealPlans = mealR.data||[]
      const bestMeal = mealPlans.find(p=>p.is_active)||mealPlans[0]||null
      if (bestMeal) setPlanEdit({ title:bestMeal.title, kcal_target:bestMeal.kcal_target, protein_target_g:bestMeal.protein_target_g, carbs_target_g:bestMeal.carbs_target_g, fat_target_g:bestMeal.fat_target_g, notes:bestMeal.notes||'' })
      const workPlans = workR.data||[]
      const adh = adhR.data||[]
      const byDay = {}
      ;(diaryR.data||[]).forEach(d => { if (!byDay[d.entry_date]) byDay[d.entry_date]={kcal:0,p:0,c:0,g:0}; byDay[d.entry_date].kcal+=(d.kcal||0); byDay[d.entry_date].p+=(d.protein_g||0) })
      const diaryWeek = []
      for (let i=6;i>=0;i--) { const d=new Date(Date.now()-i*86400000).toISOString().split('T')[0]; diaryWeek.push({date:d,...(byDay[d]||{kcal:0,p:0})}) }
      setData({ measurements:measR.data||[], photos:photoR.data||[], diaryWeek, sessions:sessR.data||[], allCount:sessCountR.count||0, logs:logsR.data||[], checkin:checkinR.data?.[0]||null, adherence:adh.length?{followed:adh.filter(a=>a.followed).length,total:adh.length}:null, mealPlan:bestMeal, workoutPlan:workPlans.find(p=>p.is_active)||workPlans[0]||null, anamnesi:amnR.data||null, unreadMsgs:msgR.count||0 })
      setReports(repR.data||[])
      // Segna report come letti
      if (repR.data?.length) await supabase.from('workout_reports').update({read_by_coach:true}).eq('client_id',client.id).eq('read_by_coach',false)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name:form.full_name, goal:form.goal, height_cm:form.height_cm?parseInt(form.height_cm):null, phone:form.phone, notes:form.notes, coach_notes:form.coach_notes }).eq('id',client.id)
    setSaving(false); setEditing(false)
  }

  async function savePlanEdit() {
    if (!data.mealPlan) return
    await supabase.from('meal_plans').update({ title:planEdit.title, kcal_target:parseInt(planEdit.kcal_target), protein_target_g:parseInt(planEdit.protein_target_g), carbs_target_g:parseInt(planEdit.carbs_target_g), fat_target_g:parseInt(planEdit.fat_target_g), notes:planEdit.notes }).eq('id',data.mealPlan.id)
    setEditingPlan(false); loadAll()
  }

  async function sendQuickMsg() {
    if (!quickMsg.trim()) return
    setSendingMsg(true)
    await supabase.from('coach_messages').insert({ client_id:client.id, sender_role:'admin', content:quickMsg.trim(), is_read:false })
    setQuickMsg(''); setSendingMsg(false)
    alert('Messaggio inviato!')
  }

  function toggleCompare(photo) {
    setComparePair(prev => {
      if (prev.find(p=>p.id===photo.id)) return prev.filter(p=>p.id!==photo.id)
      if (prev.length>=2) return [prev[1],photo]
      return [...prev,photo]
    })
  }

  const { measurements, photos, diaryWeek, sessions, logs, checkin, adherence, mealPlan, workoutPlan, anamnesi, unreadMsgs } = data
  const latest = measurements[0]
  const prev = measurements[1]
  const weightDiff = latest?.weight_kg && prev?.weight_kg ? Math.round((latest.weight_kg-prev.weight_kg)*10)/10 : null
  const sessWeek = sessions.filter(s=>new Date(s.session_date)>new Date(Date.now()-7*86400000)).length
  const daysLeft = client.subscription_end ? Math.ceil((new Date(client.subscription_end)-new Date())/86400000) : null

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#F5F3EF',overflow:'hidden'}}>

      {/* TOPBAR */}
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'0 16px',height:56,display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <button onClick={()=>navigate('/admin')} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #E0DDD6',background:'#F5F3EF',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:15,color:'#111'}}/>
        </button>
        <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${GOAL_COLOR[client.goal]||'#D4570A'},${GOAL_COLOR[client.goal]||'#D4570A'}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
            {initials(client.full_name)}
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{client.full_name}</div>
            <div style={{fontSize:10,color:'#888780'}}>{GOAL_LABEL[client.goal]||'—'}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {unreadMsgs>0 && <div style={{background:'#D4570A',color:'white',borderRadius:10,padding:'2px 7px',fontSize:10,fontWeight:700}}>{unreadMsgs} msg</div>}
          <button onClick={()=>setShowAnamnesi(true)} style={{...s.btnSm, background:anamnesi?.completed_at?'#EAF3DE':'#F5F3EF', color:anamnesi?.completed_at?'#3B6D11':'#888780', borderColor:anamnesi?.completed_at?'#3B6D11':'#E0DDD6'}}>
            <i className="ti ti-clipboard-heart" style={{fontSize:12}}/>
          </button>
          <button onClick={()=>setEditing(!editing)} style={{...s.btnSm, background:editing?'#F5F3EF':'#FEF0E7', color:editing?'#888780':'#D4570A', borderColor:editing?'#E0DDD6':'#D4570A'}}>
            <i className={`ti ${editing?'ti-x':'ti-pencil'}`} style={{fontSize:12}}/>
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',display:'flex',overflowX:'auto',flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,minWidth:60,padding:'10px 4px',border:'none',background:'none',cursor:'pointer',fontFamily:'inherit',borderBottom:tab===t.id?'2px solid #D4570A':'2px solid transparent',color:tab===t.id?'#D4570A':'#888780',transition:'all 0.15s',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <i className={`ti ${t.icon}`} style={{fontSize:16}}/>
            <span style={{fontSize:9,fontWeight:tab===t.id?700:400,textTransform:'uppercase',letterSpacing:'0.05em'}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENUTO */}
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'14px'}}>

        {/* ── FORM MODIFICA ── */}
        {editing && (
          <div style={{...s.card,marginBottom:14,border:'0.5px solid #D4570A'}}>
            <div style={{...s.sectionTitle,color:'#D4570A'}}>✏️ Modifica profilo</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div><label style={s.label}>Nome completo</label><input style={s.input} value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))}/></div>
              <div><label style={s.label}>Obiettivo</label>
                <select style={s.select} value={form.goal} onChange={e=>setForm(p=>({...p,goal:e.target.value}))}>
                  {Object.entries(GOAL_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Altezza (cm)</label><input style={s.input} type="number" value={form.height_cm} onChange={e=>setForm(p=>({...p,height_cm:e.target.value}))}/></div>
              <div><label style={s.label}>Telefono</label><input style={s.input} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/></div>
            </div>
            <div style={{marginBottom:8}}><label style={s.label}>Note (visibili al cliente)</label><textarea style={{...s.input,minHeight:50,resize:'vertical'}} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
            <div style={{marginBottom:10}}><label style={{...s.label,color:'#D4570A'}}>🔒 Note private coach</label><textarea style={{...s.input,minHeight:60,resize:'vertical',borderColor:'#D4570A'}} placeholder="Solo tu puoi vederle..." value={form.coach_notes} onChange={e=>setForm(p=>({...p,coach_notes:e.target.value}))}/></div>
            <button onClick={save} disabled={saving} style={{...s.btn,width:'100%',justifyContent:'center'}}>{saving?'Salvo...':'💾 Salva modifiche'}</button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════ */}
        {tab==='overview' && <>

          {/* KPI RAPIDI */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
            {[
              {l:'Peso',v:latest?.weight_kg?latest.weight_kg+'kg':'—',sub:weightDiff!==null?(weightDiff>0?'+':'')+weightDiff+'kg':null,c:weightDiff!==null?(weightDiff<0?'#3B6D11':weightDiff>0?'#E24B4A':'#888780'):'#111'},
              {l:'Sessioni/7gg',v:sessWeek,sub:`Tot: ${data.allCount||0}`,c:sessWeek>=3?'#3B6D11':sessWeek>=1?'#E8A020':'#E24B4A'},
              {l:'Aderenza',v:adherence?Math.round(adherence.followed/adherence.total*100)+'%':'—',sub:adherence?`${adherence.followed}/${adherence.total}`:'7 giorni',c:adherence?(adherence.followed/adherence.total>=0.7?'#3B6D11':'#E8A020'):'#888780'},
              {l:'Abbonamento',v:daysLeft===null?'—':daysLeft<0?'Scaduto':daysLeft+'gg',sub:client.subscription_type||null,c:daysLeft===null?'#888780':daysLeft<0?'#E24B4A':daysLeft<=7?'#E8A020':'#3B6D11'},
            ].map(st=>(
              <div key={st.l} style={s.statBox(st.c)}>
                <div style={{fontSize:18,fontWeight:800,color:st.c,lineHeight:1.1}}>{st.v}</div>
                {st.sub&&<div style={{fontSize:9,color:'#888780',marginTop:1}}>{st.sub}</div>}
                <div style={{fontSize:8,color:'#B0ADA8',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:3}}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* INFO PROFILO */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-user" style={{fontSize:12}}/>Profilo</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:12}}>
              {[
                {l:'Obiettivo',v:<span style={{...s.badge(GOAL_COLOR[client.goal]+'22',GOAL_COLOR[client.goal])}}>{GOAL_LABEL[client.goal]||'—'}</span>},
                {l:'Altezza',v:client.height_cm?`${client.height_cm} cm`:'—'},
                {l:'Telefono',v:client.phone||'—'},
                {l:'Cliente dal',v:new Date(client.created_at).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})},
              ].map(r=>(
                <div key={r.l} style={{padding:'7px 10px',background:'#F5F3EF',borderRadius:8}}>
                  <div style={{fontSize:9,color:'#888780',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{r.l}</div>
                  <div style={{fontWeight:600,color:'#111'}}>{r.v}</div>
                </div>
              ))}
            </div>
            {client.coach_notes && (
              <div style={{marginTop:8,background:'#FEF0E7',borderLeft:'3px solid #D4570A',borderRadius:'0 8px 8px 0',padding:'8px 10px',fontSize:12,color:'#7a3508'}}>
                <div style={{fontSize:9,color:'#D4570A',textTransform:'uppercase',fontWeight:700,marginBottom:3}}>🔒 Note private</div>
                {client.coach_notes}
              </div>
            )}
            {client.notes && (
              <div style={{marginTop:6,background:'#F5F3EF',borderLeft:'3px solid #888780',borderRadius:'0 8px 8px 0',padding:'8px 10px',fontSize:12,color:'#555'}}>
                {client.notes}
              </div>
            )}
          </div>

          {/* TIMELINE ATTIVITÀ 7 GIORNI */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-timeline" style={{fontSize:12}}/>Timeline ultimi 7 giorni</div>
            <div style={{display:'flex',gap:4}}>
              {diaryWeek.map(d=>{
                const hasDiary = d.kcal>0
                const hasSess = sessions.some(s=>s.session_date===d.date)
                const dn = new Date(d.date+'T12:00').toLocaleDateString('it-IT',{weekday:'short'}).slice(0,1).toUpperCase()
                const isToday = d.date===new Date().toISOString().split('T')[0]
                const target = mealPlan?.kcal_target||2000
                const pct = Math.min(100,Math.round(d.kcal/target*100))
                return (
                  <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{height:48,width:'100%',background:'#F5F3EF',borderRadius:6,overflow:'hidden',position:'relative',display:'flex',alignItems:'flex-end'}}>
                      <div style={{width:'100%',height:`${Math.max(pct,hasDiary?6:0)}%`,background:hasDiary?(pct>=90?'#3B6D11':'#D4570A'):'transparent',borderRadius:6,transition:'height 0.3s'}}/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                      {hasSess && <div style={{width:6,height:6,borderRadius:'50%',background:'#4A90D4'}} title="Allenamento"/>}
                      {hasDiary && <div style={{width:6,height:6,borderRadius:'50%',background:'#3B6D11'}} title="Diario"/>}
                      {!hasSess && !hasDiary && <div style={{width:6,height:6,borderRadius:'50%',background:'#E0DDD6'}}/>}
                    </div>
                    <div style={{fontSize:9,color:isToday?'#D4570A':'#888780',fontWeight:isToday?700:400}}>{dn}</div>
                  </div>
                )
              })}
            </div>
            <div style={{display:'flex',gap:12,marginTop:8,fontSize:10,color:'#888780'}}>
              <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:'#3B6D11'}}/> Diario</span>
              <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:'#4A90D4'}}/> Allenamento</span>
            </div>
          </div>

          {/* CHECK-IN */}
          {checkin && (
            <div style={s.card}>
              <div style={s.sectionTitle}><i className="ti ti-check" style={{fontSize:12}}/>Check-in · {new Date(checkin.week_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:checkin.notes?8:0}}>
                {[
                  {l:'⚡ Energia',v:checkin.energy_level,max:5},
                  {l:'😴 Sonno',v:checkin.sleep_quality,max:5},
                  {l:'🧠 Stress',v:checkin.stress_level,max:5,inv:true},
                  {l:'🔥 Motivazione',v:checkin.motivation_level,max:5},
                ].filter(i=>i.v!=null).map(item=>{
                  const c = item.inv ? (item.v<=2?'#3B6D11':item.v<=3?'#E8A020':'#E24B4A') : (item.v>=4?'#3B6D11':item.v>=3?'#E8A020':'#E24B4A')
                  return (
                    <div key={item.l} style={{textAlign:'center',background:'#F5F3EF',borderRadius:9,padding:'8px 4px'}}>
                      <div style={{fontSize:18,fontWeight:800,color:c}}>{item.v}<span style={{fontSize:9,color:'#888780'}}>/{item.max}</span></div>
                      <div style={{fontSize:8,color:'#888780',marginTop:2}}>{item.l}</div>
                    </div>
                  )
                })}
              </div>
              {checkin.notes&&<div style={{fontSize:11,color:'#555',fontStyle:'italic',padding:'7px 10px',background:'#F5F3EF',borderRadius:7}}>"{checkin.notes}"</div>}
            </div>
          )}

          {/* MESSAGGIO RAPIDO */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-message-2" style={{fontSize:12}}/>Messaggio rapido{unreadMsgs>0&&<span style={{...s.badge('#FEE2E2','#E24B4A'),marginLeft:4}}>{unreadMsgs} non letti</span>}</div>
            <div style={{display:'flex',gap:8}}>
              <textarea value={quickMsg} onChange={e=>setQuickMsg(e.target.value)} placeholder="Scrivi un messaggio al cliente..."
                style={{...s.input,minHeight:60,resize:'vertical',flex:1}}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button onClick={sendQuickMsg} disabled={!quickMsg.trim()||sendingMsg} style={{...s.btn,flex:1,justifyContent:'center',opacity:!quickMsg.trim()?0.5:1}}>
                <i className="ti ti-send" style={{fontSize:13}}/>{sendingMsg?'Invio...':'Invia'}
              </button>
              <button onClick={()=>navigate(`/messaggi-coach?client=${client.id}`)} style={{...s.btnGray,padding:'9px 14px'}}>
                <i className="ti ti-external-link" style={{fontSize:13}}/>
              </button>
            </div>
          </div>
        </>}

        {/* ══════════════════════════════════════════
            TAB: NUTRIZIONE
        ══════════════════════════════════════════ */}
        {tab==='nutrizione' && <>
          {/* PIANO ALIMENTARE */}
          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={s.sectionTitle}><i className="ti ti-salad" style={{fontSize:12}}/>Piano alimentare</div>
              <div style={{display:'flex',gap:6}}>
                {mealPlan && <a href={`/modifica-piano/${mealPlan.id}`} style={{...s.btnSm,textDecoration:'none'}}><i className="ti ti-pencil" style={{fontSize:11}}/>Modifica</a>}
                {!mealPlan && <a href="/importa-piano" style={{...s.btnSm,textDecoration:'none'}}>+ Importa</a>}
              </div>
            </div>
            {mealPlan ? (
              <>
                <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px 14px',marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#7a3508'}}>{mealPlan.title}</div>
                    <span style={s.badge(mealPlan.is_active?'#EAF3DE':'#F5F3EF', mealPlan.is_active?'#3B6D11':'#888780')}>{mealPlan.is_active?'Attivo':'Non attivo'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                    {[{l:'Kcal',v:mealPlan.kcal_target,c:'#D4570A'},{l:'Prot',v:mealPlan.protein_target_g+'g',c:'#4A90D4'},{l:'Carbo',v:mealPlan.carbs_target_g+'g',c:'#E8A020'},{l:'Grassi',v:mealPlan.fat_target_g+'g',c:'#3B8C5A'}].map(m=>(
                      <div key={m.l} style={{textAlign:'center',background:'white',borderRadius:7,padding:'6px'}}>
                        <div style={{fontSize:14,fontWeight:800,color:m.c}}>{m.v}</div>
                        <div style={{fontSize:9,color:'#888780',textTransform:'uppercase'}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={()=>setEditingPlan(!editingPlan)} style={{...s.btnGray,width:'100%',justifyContent:'center',fontSize:11}}>
                  {editingPlan?'Chiudi':'✏️ Modifica target'}
                </button>
                {editingPlan && (
                  <div style={{marginTop:10}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                      <div><label style={s.label}>Kcal</label><input style={s.input} type="number" value={planEdit.kcal_target} onChange={e=>setPlanEdit(p=>({...p,kcal_target:e.target.value}))}/></div>
                      <div><label style={s.label}>Proteine (g)</label><input style={s.input} type="number" value={planEdit.protein_target_g} onChange={e=>setPlanEdit(p=>({...p,protein_target_g:e.target.value}))}/></div>
                      <div><label style={s.label}>Carboidrati (g)</label><input style={s.input} type="number" value={planEdit.carbs_target_g} onChange={e=>setPlanEdit(p=>({...p,carbs_target_g:e.target.value}))}/></div>
                      <div><label style={s.label}>Grassi (g)</label><input style={s.input} type="number" value={planEdit.fat_target_g} onChange={e=>setPlanEdit(p=>({...p,fat_target_g:e.target.value}))}/></div>
                    </div>
                    <div style={{marginBottom:8}}><label style={s.label}>Titolo</label><input style={s.input} value={planEdit.title} onChange={e=>setPlanEdit(p=>({...p,title:e.target.value}))}/></div>
                    <button onClick={savePlanEdit} style={{...s.btn,width:'100%',justifyContent:'center'}}>Salva</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{textAlign:'center',padding:'20px',color:'#888780',fontSize:12}}>Nessun piano alimentare caricato</div>
            )}
          </div>

          {/* DIARIO 7 GIORNI */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-book" style={{fontSize:12}}/>Diario — ultimi 7 giorni</div>
            <div style={{display:'flex',gap:5}}>
              {diaryWeek.map(d=>{
                const target = mealPlan?.kcal_target||2000
                const pct = Math.min(100,Math.round(d.kcal/target*100))
                const dn = new Date(d.date+'T12:00').toLocaleDateString('it-IT',{weekday:'short'}).slice(0,1).toUpperCase()
                const isToday = d.date===new Date().toISOString().split('T')[0]
                return (
                  <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    <div style={{height:56,width:'100%',background:'#F5F3EF',borderRadius:7,display:'flex',alignItems:'flex-end',overflow:'hidden'}}>
                      <div style={{width:'100%',height:`${Math.max(pct,d.kcal>0?6:0)}%`,background:d.kcal===0?'transparent':pct>=90?'#3B6D11':pct>=70?'#E8A020':'#D4570A',borderRadius:7}}/>
                    </div>
                    {d.kcal>0&&<div style={{fontSize:8,color:'#D4570A',fontWeight:600}}>{d.kcal}</div>}
                    <div style={{fontSize:9,color:isToday?'#D4570A':'#888780',fontWeight:isToday?700:400}}>{dn}</div>
                  </div>
                )
              })}
            </div>
            {adherence && (
              <div style={{marginTop:10,background:adherence.followed/adherence.total>=0.7?'#EAF3DE':'#FEF0E7',borderRadius:8,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'#555'}}>Aderenza piano</span>
                <span style={{fontSize:14,fontWeight:700,color:adherence.followed/adherence.total>=0.7?'#3B6D11':'#D4570A'}}>{Math.round(adherence.followed/adherence.total*100)}% · {adherence.followed}/{adherence.total} pasti</span>
              </div>
            )}
          </div>
        </>}

        {/* ══════════════════════════════════════════
            TAB: ALLENAMENTO
        ══════════════════════════════════════════ */}
        {tab==='allenamento' && <>
          {/* SCHEDA */}
          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={s.sectionTitle}><i className="ti ti-clipboard-list" style={{fontSize:12}}/>Scheda allenamento</div>
              {workoutPlan
                ? <a href={`/modifica-allenamento/${workoutPlan.id}`} style={{...s.btnSm,textDecoration:'none'}}><i className="ti ti-pencil" style={{fontSize:11}}/>Modifica</a>
                : <a href="/importa-allenamento" style={{...s.btnSm,textDecoration:'none'}}>+ Importa</a>
              }
            </div>
            {workoutPlan ? (
              <div style={{background:'#FEF0E7',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#7a3508'}}>{workoutPlan.name}</div>
                <div style={{fontSize:11,color:'#D4570A',marginTop:3}}>{workoutPlan.days_per_week} giorni/settimana · {workoutPlan.weeks_duration} settimane</div>
              </div>
            ) : (
              <div style={{textAlign:'center',padding:16,color:'#888780',fontSize:12}}>Nessuna scheda caricata</div>
            )}
          </div>

          {/* STATS ALLENAMENTO */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
            {[
              {l:'Sessioni 7gg',v:sessWeek,c:sessWeek>=3?'#3B6D11':sessWeek>=1?'#E8A020':'#E24B4A'},
              {l:'Totale sessioni',v:data.allCount||0,c:'#4A90D4'},
              {l:'Serie 7gg',v:logs.reduce((s,l)=>s+1,0),c:'#D4570A'},
            ].map(st=>(
              <div key={st.l} style={s.statBox(st.c)}>
                <div style={{fontSize:20,fontWeight:800,color:st.c}}>{st.v}</div>
                <div style={{fontSize:9,color:'#888780',textTransform:'uppercase',marginTop:2}}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* SESSIONI RECENTI */}
          {sessions.length>0 && (
            <div style={s.card}>
              <div style={s.sectionTitle}><i className="ti ti-history" style={{fontSize:12}}/>Sessioni recenti</div>
              {sessions.map(sess=>{
                const pct = sess.sets_total>0?Math.round(sess.sets_completed/sess.sets_total*100):0
                const sessLogs = logs.filter(l=>l.log_date===sess.session_date)
                const byEx = {}
                sessLogs.forEach(l=>{ if (!byEx[l.exercise_name]) byEx[l.exercise_name]=[]; byEx[l.exercise_name].push(l) })
                return (
                  <div key={sess.id} style={{background:'#F5F3EF',borderRadius:9,padding:'10px 12px',marginBottom:7}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#111'}}>{sess.day_label}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:11,color:'#888780'}}>{new Date(sess.session_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                        <span style={{...s.badge(pct>=80?'#EAF3DE':pct>=50?'#FEF0E7':'#FEE2E2', pct>=80?'#3B6D11':pct>=50?'#D4570A':'#E24B4A')}}>{pct}%</span>
                      </div>
                    </div>
                    {Object.entries(byEx).slice(0,4).map(([name,ls])=>(
                      <div key={name} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'2px 0',borderBottom:'0.5px solid #E0DDD6'}}>
                        <span style={{color:'#555'}}>{name}</span>
                        <span style={{color:'#D4570A',fontWeight:600}}>{ls.length}×{Math.max(...ls.map(l=>l.weight_kg||0))||'—'}kg</span>
                      </div>
                    ))}
                    {sess.notes&&<div style={{fontSize:10,color:'#888780',marginTop:5,fontStyle:'italic'}}>{sess.notes}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {/* PROGRESSIONE ESERCIZI */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-trending-up" style={{fontSize:12}}/>Progressione pesi</div>
            <ProgressioneEsercizi clientId={client.id}/>
          </div>

          {/* REPORT ALLENAMENTO */}
          {reports.length>0 && (
            <div style={s.card}>
              <div style={s.sectionTitle}><i className="ti ti-clipboard-check" style={{fontSize:12}}/>Report allenamento ({reports.length})</div>
              {reports.map(r=>(
                <div key={r.id} style={{background:'#F5F3EF',borderRadius:9,marginBottom:8,overflow:'hidden'}}>
                  <div onClick={()=>setExpandedReport(expandedReport===r.id?null:r.id)}
                    style={{padding:'10px 12px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'#111'}}>
                        {r.period_start&&r.period_end ? `${new Date(r.period_start+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})} – ${new Date(r.period_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}` : new Date(r.submitted_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
                      </div>
                      <div style={{fontSize:10,color:'#888780',marginTop:2,display:'flex',gap:8}}>
                        {r.benessere_generale!=null&&<span>😊 {r.benessere_generale}/10</span>}
                        {r.energia_allenamento!=null&&<span>⚡ {r.energia_allenamento}/10</span>}
                        {r.stress_periodo!=null&&<span>🧠 stress {r.stress_periodo}/10</span>}
                      </div>
                    </div>
                    <i className={`ti ti-chevron-${expandedReport===r.id?'up':'down'}`} style={{fontSize:13,color:'#888780'}}/>
                  </div>
                  {expandedReport===r.id && (
                    <div style={{borderTop:'0.5px solid #E0DDD6'}}>
                      <ReportAllenamento reportId={r.id} readOnly={true} adminView={true}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══════════════════════════════════════════
            TAB: PROGRESSI
        ══════════════════════════════════════════ */}
        {tab==='progressi' && <>
          {/* GRAFICO PESO */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-chart-line" style={{fontSize:12}}/>Andamento peso</div>
            <GraficoPeso clientId={client.id} targetWeight={anamnesi?.peso_desiderato}/>
          </div>

          {/* MISURAZIONI */}
          {measurements.length>0 && (
            <div style={s.card}>
              <div style={s.sectionTitle}><i className="ti ti-ruler-measure" style={{fontSize:12}}/>Ultime misurazioni</div>
              {measurements.slice(0,5).map((m,i)=>(
                <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid #F0EDE8'}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#111'}}>{m.weight_kg}kg</div>
                    <div style={{fontSize:10,color:'#888780'}}>{new Date(m.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</div>
                  </div>
                  {i>0 && measurements[i-1] && (
                    <span style={s.badge(
                      (m.weight_kg-measurements[i-1].weight_kg)<0?'#EAF3DE':'#FEE2E2',
                      (m.weight_kg-measurements[i-1].weight_kg)<0?'#3B6D11':'#E24B4A'
                    )}>
                      {(m.weight_kg-measurements[i-1].weight_kg)>0?'+':''}{Math.round((m.weight_kg-measurements[i-1].weight_kg)*10)/10}kg
                    </span>
                  )}
                  {m.body_fat_pct && <span style={{fontSize:11,color:'#888780'}}>{m.body_fat_pct}% BF</span>}
                </div>
              ))}
            </div>
          )}

          {/* FOTO PROGRESSI */}
          {photos.length>0 && (
            <div style={s.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={s.sectionTitle}><i className="ti ti-camera" style={{fontSize:12}}/>Foto progressi ({photos.length})</div>
                {comparePair.length>0 && <button onClick={()=>setComparePair([])} style={s.btnGray}>Cancella selezione</button>}
              </div>

              {/* CONFRONTO FOTO */}
              {comparePair.length===2 && (
                <div style={{marginBottom:12,background:'#F5F3EF',borderRadius:10,padding:10}}>
                  <div style={{fontSize:10,color:'#D4570A',fontWeight:700,textTransform:'uppercase',marginBottom:8}}>Confronto</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {comparePair.map(p=>(
                      <div key={p.id} style={{borderRadius:9,overflow:'hidden',aspectRatio:'3/4',position:'relative'}}>
                        <img src={p.photo_url} alt={p.label} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.7)',padding:'12px 6px 5px'}}>
                          <div style={{fontSize:9,color:'white',fontWeight:700}}>{p.label}</div>
                          <div style={{fontSize:8,color:'rgba(255,255,255,0.7)'}}>{p.photo_date?new Date(p.photo_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}):''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{fontSize:10,color:'#888780',marginBottom:6}}>
                {comparePair.length===0?'Tocca per ingrandire · Seleziona 2 foto per confrontarle':comparePair.length===1?'Seleziona un\'altra foto per confrontare':''}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {photos.map(p=>{
                  const isSelected = comparePair.find(x=>x.id===p.id)
                  return (
                    <div key={p.id} style={{position:'relative',borderRadius:10,overflow:'hidden',aspectRatio:'3/4',background:'#F0EDE8',cursor:'pointer',border:isSelected?'2.5px solid #D4570A':'2.5px solid transparent'}}
                      onClick={()=>setLightbox({url:p.photo_url,label:p.label,date:p.photo_date})}>
                      <img src={p.photo_url} alt={p.label} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.65))',padding:'14px 5px 4px'}}>
                        <div style={{fontSize:8,color:'white',fontWeight:600,textTransform:'uppercase'}}>{p.label}</div>
                        {p.photo_date&&<div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>{new Date(p.photo_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>}
                      </div>
                      <div style={{position:'absolute',top:4,left:4}}>
                        <button onClick={e=>{e.stopPropagation();toggleCompare(p)}}
                          style={{background:isSelected?'#D4570A':'rgba(0,0,0,0.4)',border:'none',borderRadius:6,padding:'2px 6px',fontSize:9,fontWeight:700,color:'white',cursor:'pointer',fontFamily:'inherit'}}>
                          {isSelected?'✓':'⊕'}
                        </button>
                      </div>
                      <div style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.4)',borderRadius:6,padding:'2px 5px'}}>
                        <i className="ti ti-zoom-in" style={{fontSize:10,color:'white'}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>}

        {/* ══════════════════════════════════════════
            TAB: NOTE
        ══════════════════════════════════════════ */}
        {tab==='note' && <>
          {/* ANAMNESI */}
          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={s.sectionTitle}><i className="ti ti-clipboard-heart" style={{fontSize:12}}/>Anamnesi</div>
              <button onClick={()=>setShowAnamnesi(true)} style={anamnesi?.completed_at?s.btnGreen:s.btnSm}>
                <i className={`ti ${anamnesi?.completed_at?'ti-eye':'ti-plus'}`} style={{fontSize:11}}/>
                {anamnesi?.completed_at?'Visualizza':'Apri anamnesi'}
              </button>
            </div>
            {anamnesi ? (
              <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>
                {anamnesi.completed_at && <div style={{...s.badge('#EAF3DE','#3B6D11'),display:'inline-flex',marginBottom:8}}>✓ Completata {new Date(anamnesi.completed_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</div>}
                {anamnesi.submitted_at && <div style={{...s.badge('#EBF3FD','#4A90D4'),display:'inline-flex',marginBottom:8,marginLeft:4}}>📨 Inviata al coach</div>}
                {anamnesi.motivazione && <div style={{background:'#F5F3EF',borderRadius:7,padding:'8px 10px',marginBottom:6,fontStyle:'italic'}}>"{anamnesi.motivazione}"</div>}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[
                    {l:'Obiettivo',v:anamnesi.obiettivo},
                    {l:'Peso attuale',v:anamnesi.peso_attuale?anamnesi.peso_attuale+'kg':null},
                    {l:'Lavoro',v:anamnesi.lavoro},
                    {l:'Orari',v:anamnesi.orari_lavoro?.join(', ')},
                  ].filter(r=>r.v).map(r=>(
                    <div key={r.l} style={{background:'#F5F3EF',borderRadius:7,padding:'7px 9px'}}>
                      <div style={{fontSize:9,color:'#888780',textTransform:'uppercase',marginBottom:1}}>{r.l}</div>
                      <div style={{fontSize:11,fontWeight:600,color:'#111'}}>{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{textAlign:'center',padding:16,color:'#888780',fontSize:12}}>Anamnesi non ancora compilata</div>
            )}
          </div>

          {/* NOTE COACH */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-lock" style={{fontSize:12}}/>Note private del coach</div>
            <textarea value={form.coach_notes} onChange={e=>setForm(p=>({...p,coach_notes:e.target.value}))}
              placeholder="Note riservate — solo tu le vedi..."
              style={{...s.input,minHeight:100,resize:'vertical',borderColor:'#D4570A',marginBottom:8}}/>
            <button onClick={save} disabled={saving} style={{...s.btn,width:'100%',justifyContent:'center'}}>
              {saving?'Salvo...':'💾 Salva note'}
            </button>
          </div>

          {/* NOTE CLIENTE */}
          <div style={s.card}>
            <div style={s.sectionTitle}><i className="ti ti-notes" style={{fontSize:12}}/>Note visibili al cliente</div>
            <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
              placeholder="Note che il cliente può leggere..."
              style={{...s.input,minHeight:80,resize:'vertical',marginBottom:8}}/>
            <button onClick={save} disabled={saving} style={{...s.btn,width:'100%',justifyContent:'center'}}>
              {saving?'Salvo...':'💾 Salva note'}
            </button>
          </div>
        </>}

      </div>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>
          <button onClick={()=>setLightbox(null)} style={{position:'absolute',top:16,right:16,width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <i className="ti ti-x" style={{fontSize:18,color:'white'}}/>
          </button>
          <img src={lightbox.url} alt={lightbox.label} onClick={e=>e.stopPropagation()}
            style={{maxWidth:'100%',maxHeight:'82vh',objectFit:'contain',borderRadius:12}}/>
          <div style={{marginTop:12,textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:700,color:'white',textTransform:'uppercase',letterSpacing:'0.05em'}}>{lightbox.label}</div>
            {lightbox.date&&<div style={{fontSize:11,color:'rgba(255,255,255,0.55)',marginTop:3}}>{new Date(lightbox.date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</div>}
            <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:8}}>Tocca fuori per chiudere</div>
          </div>
        </div>
      )}

      {/* ── MODALE ANAMNESI ── */}
      {showAnamnesi && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{width:'100%',maxWidth:640,maxHeight:'90vh',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <Anamnesi clientId={client.id} onClose={()=>setShowAnamnesi(false)}/>
          </div>
        </div>
      )}
    </div>
  )
}
