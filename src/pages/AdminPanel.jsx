import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useAuth } from '../App'
import Anamnesi from './Anamnesi'
import GraficoPeso from '../components/GraficoPeso'
import ProgressioneEsercizi from '../components/ProgressioneEsercizi'
import ReportAllenamento from './ReportAllenamento'

const s = {
  page: { flex:1, overflowY:'auto', padding:'16px 18px', background:'#080808' },
  topbar: { background:'#080808', borderBottom:'0.5px solid #111', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:9, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnSm: { background:'rgba(212,87,10,0.12)', color:'#D4570A', border:'0.5px solid rgba(212,87,10,0.25)', borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#161616', color:'#CCC', border:'0.5px solid #222', borderRadius:7, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  tabs: { display:'flex', gap:5, marginBottom:16, flexWrap:'wrap' },
  tab: { padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'0.5px solid #222', background:'#0D0D0D', color:'#CCC' },
  tabActive: { padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'0.5px solid rgba(212,87,10,0.4)', background:'rgba(212,87,10,0.15)', color:'#F4894A' },
  card: { background:'#0D0D0D', borderRadius:14, border:'0.5px solid #1C1C1C', padding:'16px', marginBottom:12 },
  cardTitle: { fontSize:12, fontWeight:700, color:'#F0F0F0', display:'flex', alignItems:'center', gap:7, marginBottom:14 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'8px 12px', fontSize:9, color:'#CCC', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'0.5px solid #1A1A1A', background:'#0A0A0A', fontWeight:700 },
  td: { padding:'10px 12px', borderBottom:'0.5px solid #111', color:'#C0C0C0', verticalAlign:'middle' },
  avatar: { width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#D4570A,#F4894A)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'white', marginRight:8, flexShrink:0 },
  badge: { fontSize:9, padding:'2px 8px', borderRadius:10, fontWeight:700 },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200, padding:0 },
  modalCard: { background:'#0D0D0D', borderRadius:'16px 16px 0 0', padding:'24px 20px', width:'100%', maxWidth:560, height:'90dvh', overflowY:'auto', WebkitOverflowScrolling:'touch', border:'0.5px solid #1C1C1C' },
  formGroup: { marginBottom:14 },
  label: { fontSize:10, color:'#CCC', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #222', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #222', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  saveBtn: { width:'100%', padding:11, background:'#D4570A', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  cancelBtn: { width:'100%', padding:11, background:'#161616', color:'#CCC', border:'0.5px solid #222', borderRadius:9, fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
}

const goalLabel = { dimagrimento:'Dimagrimento', massa:'Massa muscolare', mantenimento:'Mantenimento', forza:'Forza', resistenza:'Resistenza', ricomposizione:'Ricomposizione corporea' }
const goalColor = { dimagrimento:'#FEE2E2', massa:'#EAF3DE', mantenimento:'#FEF0E7', forza:'#EDE9FE', resistenza:'#E0F2FE', ricomposizione:'#E0F2FE' }
const goalTextColor = { dimagrimento:'#9B1C1C', massa:'#3B6D11', mantenimento:'#7a3508', forza:'#4C1D95', resistenza:'#075985', ricomposizione:'#075985' }
const initials = name => name ? name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'U'
const today = new Date().toISOString().split('T')[0]

function NotifBell({ clients }) {
  const [open, setOpen] = React.useState(false)
  const [selectedClient, setSelectedClient] = React.useState('all')
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const PRESETS = [
    { title:'📔 Diario di oggi', body:'Hai registrato i pasti di oggi? Apri FOfit e traccia il tuo diario!' },
    { title:'💪 Continua così!', body:'Stai facendo un ottimo lavoro. Controlla il tuo piano di oggi!' },
    { title:'📊 Piano aggiornato', body:"Il tuo coach ha aggiornato il tuo piano. Dai un'occhiata!" },
    { title:'🎯 Obiettivo vicino!', body:'Sei quasi al tuo target settimanale. Ancora un piccolo sforzo!' },
  ]

  async function send() {
    if (!title || !body) return
    setSending(true)
    try {
      let clientIds = []
      if (selectedClient === 'all') {
        const { data } = await supabase.from('push_subscriptions').select('client_id')
        clientIds = (data || []).map(r => r.client_id)
      } else {
        clientIds = [selectedClient]
      }
      await Promise.all(clientIds.map(clientId =>
        fetch('/api/push-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, title, body, url: '/' })
        })
      ))
      setSent(true)
      setTimeout(() => { setSent(false); setTitle(''); setBody(''); setOpen(false) }, 2000)
    } catch(e) { console.error(e) }
    setSending(false)
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        width:36, height:36, borderRadius:9, border:'0.5px solid #1C1C1C',
        background: open ? 'rgba(212,87,10,0.12)' : '#161616',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer',
      }}>
        <i className="ti ti-bell" style={{ fontSize:16, color: open ? '#D4570A' : '#CCC' }}/>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0, width:300,
          background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C',
          boxShadow:'0 8px 32px rgba(0,0,0,0.12)', zIndex:500, padding:14,
        }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#F0F0F0', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
            <i className="ti ti-bell-ringing" style={{ fontSize:14, color:'#D4570A' }}/>
            Invia notifica
            <button onClick={() => setOpen(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#CCC', fontSize:16, lineHeight:1 }}>✕</button>
          </div>
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
            style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #1C1C1C', borderRadius:8, fontSize:12, background:'#161616', outline:'none', fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }}>
            <option value="all">Tutti i clienti</option>
            {(clients||[]).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setTitle(p.title); setBody(p.body) }}
                style={{ padding:'4px 8px', borderRadius:14, border:'0.5px solid #1C1C1C', background:'#161616', color:'#CCC', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
                {p.title}
              </button>
            ))}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo..."
            style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #1C1C1C', borderRadius:8, fontSize:12, background:'#161616', outline:'none', fontFamily:'inherit', marginBottom:6, boxSizing:'border-box' }}/>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Testo della notifica..."
            style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #1C1C1C', borderRadius:8, fontSize:12, background:'#161616', outline:'none', fontFamily:'inherit', resize:'none', height:60, marginBottom:10, boxSizing:'border-box' }}/>
          <button onClick={send} disabled={!title || !body || sending}
            style={{ width:'100%', padding:'9px', background: sent ? '#3B6D11' : '#D4570A', color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:(!title||!body)?0.5:1 }}>
            {sending ? 'Invio...' : sent ? '✓ Inviata!' : '🔔 Invia notifica'}
          </button>
        </div>
      )}
    </div>
  )
}





function DayPicker({ field, color='#D4570A' }) {
  return (
    <div style={{display:'flex',gap:4,marginTop:6}}>
      {DAY_NAMES.map((dn,i) => {
        const day = i+1
        const active = (dietConfig[field]||[]).includes(day)
        return (
          <button key={day} onClick={()=>toggleDietDay(field, day)} style={{
            width:32,height:28,borderRadius:7,border:'0.5px solid',fontFamily:'inherit',fontSize:11,fontWeight:600,cursor:'pointer',
            background:active?color:'#161616', color:active?'white':'#AAA', borderColor:active?color:'#333'
          }}>{dn}</button>
        )
      })}
    </div>
  )
}


function MacroBox({ label, prefix, color='#D4570A', bg='#FEF0E7' }) {
  const total = dcMacroKcal(prefix)
  return (
    <div style={{background:bg,borderRadius:10,padding:'12px',border:`0.5px solid ${color}33`,marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>{label}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
        <div>
          <label style={{...s.label,color:'#CCC'}}>Kcal</label>
          <input style={{...s.input,padding:'7px 8px',fontSize:12,textAlign:'center'}} type="number"
            value={dietConfig[`${prefix}_kcal`]||''}
            onChange={e=>handleDcKcalChange(prefix, e.target.value)}/>
        </div>
        {[{k:'protein',l:'Pro (g)'},{k:'carbs',l:'Carbo (g)'},{k:'fat',l:'Grassi (g)'}].map(f=>(
          <div key={f.k}>
            <label style={{...s.label,color:'#CCC'}}>{f.l}</label>
            <input style={{...s.input,padding:'7px 8px',fontSize:12,textAlign:'center'}} type="number"
              value={dietConfig[`${prefix}_${f.k}`]||''}
              onChange={e=>handleDcMacroChange(prefix, f.k, e.target.value)}/>
          </div>
        ))}
      </div>
      <div style={{marginTop:8,fontSize:11,color,fontWeight:600,display:'flex',alignItems:'center',gap:4}}>
        <i className="ti ti-check" style={{fontSize:12}}/> Totale da macro: {total} kcal
        {Math.abs(total - (dietConfig[`${prefix}_kcal`]||0)) > 5 && (
          <span style={{color:'#E24B4A',fontWeight:400,fontSize:10,marginLeft:4}}>⚠️ differenza di {Math.abs(total-(dietConfig[`${prefix}_kcal`]||0))} kcal</span>
        )}
      </div>
    </div>
  )
}


export default function AdminPanel() {
  const toast = useToast()
  const { profile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [clientStats, setClientStats] = useState({}) // { [clientId]: { diaryToday, activePlan, latestMeasure } }
  const [loading, setLoading] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  const [newClient, setNewClient] = useState({ email:'', password:'', full_name:'', goal:'dimagrimento', phone:'', height_cm:'', notes:'' })
  const [newPlan, setNewPlan] = useState({ client_id:'', title:'Piano alimentare', week_number:1, kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65, notes:'' })
  const [dietType, setDietType] = useState('lineare')
  const [dietConfig, setDietConfig] = useState({
    // ON/OFF
    on_kcal:2200, on_protein:160, on_carbs:250, on_fat:65,
    off_kcal:1900, off_protein:155, off_carbs:190, off_fat:65,
    on_days:[1,3,5], // Lun Mer Ven
    // AD ONDE
    high_kcal:2400, high_protein:170, high_carbs:280, high_fat:65,
    mid_kcal:2100, mid_protein:155, mid_carbs:230, mid_fat:65,
    low_kcal:1800, low_protein:150, low_carbs:175, low_fat:65,
    high_days:[1,3,5], mid_days:[2,4], low_days:[6,7],
    // REVERSE
    base_kcal:1800, base_protein:150, base_carbs:175, base_fat:60,
    weekly_increase_pct:5, weeks:8,
    // DEFICIT/SURPLUS CICLICO
    deficit_kcal:1800, deficit_protein:155, deficit_carbs:175, deficit_fat:60,
    surplus_kcal:2400, surplus_protein:160, surplus_carbs:290, surplus_fat:70,
    // REFEED
    normal_kcal:1900, normal_protein:155, normal_carbs:185, normal_fat:62,
    refeed_kcal:2500, refeed_protein:160, refeed_carbs:350, refeed_fat:50,
    refeed_days:[6,7],
  })

  const DIET_TYPES = [
    { value:'lineare', label:'🔵 Lineare', desc:'Stesso schema ogni giorno' },
    { value:'on_off', label:'🟠 ON / OFF', desc:'Kcal diverse nei giorni di allenamento e riposo' },
    { value:'onde', label:'🌊 Ad onde', desc:'3 livelli: alto / medio / basso su 7 giorni' },
    { value:'reverse', label:'📈 Reverse diet', desc:'Aumento progressivo settimanale delle kcal' },
    { value:'ciclico', label:'🔄 Deficit/Surplus ciclico', desc:'Settimane alternate deficit e surplus' },
    { value:'refeed', label:'⚡ Refeed', desc:'Dieta base con 1-2 giorni di ricarica kcal' },
  ]
  const DAY_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

  function toggleDietDay(field, day) {
    setDietConfig(p => {
      const arr = p[field] || []
      return { ...p, [field]: arr.includes(day) ? arr.filter(d=>d!==day) : [...arr, day] }
    })
  }

  function buildPlanFromDiet() {
    const dc = dietConfig
    const r = Math.round
    switch(dietType) {
      case 'lineare': return { kcal_target:r(newPlan.kcal_target)||2000, protein_target_g:r(newPlan.protein_target_g)||150, carbs_target_g:r(newPlan.carbs_target_g)||200, fat_target_g:r(newPlan.fat_target_g)||65, diet_type:'lineare', diet_config:null }
      case 'on_off': {
        const onDays = dc.on_days.length, offDays = 7-onDays
        return { kcal_target:r((dc.on_kcal*onDays+dc.off_kcal*offDays)/7), protein_target_g:r((dc.on_protein*onDays+dc.off_protein*offDays)/7), carbs_target_g:r((dc.on_carbs*onDays+dc.off_carbs*offDays)/7), fat_target_g:r((dc.on_fat*onDays+dc.off_fat*offDays)/7), diet_type:'on_off', diet_config:JSON.stringify({on:{kcal:r(dc.on_kcal),protein:r(dc.on_protein),carbs:r(dc.on_carbs),fat:r(dc.on_fat),days:dc.on_days},off:{kcal:r(dc.off_kcal),protein:r(dc.off_protein),carbs:r(dc.off_carbs),fat:r(dc.off_fat)}}) }
      }
      case 'onde': return { kcal_target:r((dc.high_kcal*dc.high_days.length+dc.mid_kcal*dc.mid_days.length+dc.low_kcal*dc.low_days.length)/7), protein_target_g:r((dc.high_protein*dc.high_days.length+dc.mid_protein*dc.mid_days.length+dc.low_protein*dc.low_days.length)/7), carbs_target_g:r((dc.high_carbs*dc.high_days.length+dc.mid_carbs*dc.mid_days.length+dc.low_carbs*dc.low_days.length)/7), fat_target_g:r((dc.high_fat*dc.high_days.length+dc.mid_fat*dc.mid_days.length+dc.low_fat*dc.low_days.length)/7), diet_type:'onde', diet_config:JSON.stringify({high:{kcal:r(dc.high_kcal),protein:r(dc.high_protein),carbs:r(dc.high_carbs),fat:r(dc.high_fat),days:dc.high_days},mid:{kcal:r(dc.mid_kcal),protein:r(dc.mid_protein),carbs:r(dc.mid_carbs),fat:r(dc.mid_fat),days:dc.mid_days},low:{kcal:r(dc.low_kcal),protein:r(dc.low_protein),carbs:r(dc.low_carbs),fat:r(dc.low_fat),days:dc.low_days}}) }
      case 'reverse': return { kcal_target:r(dc.base_kcal), protein_target_g:r(dc.base_protein), carbs_target_g:r(dc.base_carbs), fat_target_g:r(dc.base_fat), diet_type:'reverse', diet_config:JSON.stringify({base:{kcal:r(dc.base_kcal),protein:r(dc.base_protein),carbs:r(dc.base_carbs),fat:r(dc.base_fat)},weekly_increase_pct:dc.weekly_increase_pct,weeks:dc.weeks}) }
      case 'ciclico': return { kcal_target:r((dc.deficit_kcal+dc.surplus_kcal)/2), protein_target_g:r((dc.deficit_protein+dc.surplus_protein)/2), carbs_target_g:r((dc.deficit_carbs+dc.surplus_carbs)/2), fat_target_g:r((dc.deficit_fat+dc.surplus_fat)/2), diet_type:'ciclico', diet_config:JSON.stringify({deficit:{kcal:r(dc.deficit_kcal),protein:r(dc.deficit_protein),carbs:r(dc.deficit_carbs),fat:r(dc.deficit_fat)},surplus:{kcal:r(dc.surplus_kcal),protein:r(dc.surplus_protein),carbs:r(dc.surplus_carbs),fat:r(dc.surplus_fat)}}) }
      case 'refeed': return { kcal_target:r(dc.normal_kcal), protein_target_g:r(dc.normal_protein), carbs_target_g:r(dc.normal_carbs), fat_target_g:r(dc.normal_fat), diet_type:'refeed', diet_config:JSON.stringify({normal:{kcal:r(dc.normal_kcal),protein:r(dc.normal_protein),carbs:r(dc.normal_carbs),fat:r(dc.normal_fat)},refeed:{kcal:r(dc.refeed_kcal),protein:r(dc.refeed_protein),carbs:r(dc.refeed_carbs),fat:r(dc.refeed_fat),days:dc.refeed_days}}) }
      default: return { kcal_target:r(newPlan.kcal_target)||2000, protein_target_g:r(newPlan.protein_target_g)||150, carbs_target_g:r(newPlan.carbs_target_g)||200, fat_target_g:r(newPlan.fat_target_g)||65, diet_type:'lineare', diet_config:null }
    }
  }

  // Ricerca e filtri
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tutti') // tutti | no-piano | no-diario | piano-attivo

  useEffect(() => {
    fetchAll()
    // Aggiorna dati quando torni da un'altra pagina (es. ModificaPiano)
    const onFocus = () => fetchAll()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*')
      .neq('role','admin').order('created_at',{ascending:false})
    setClients(prof||[])
    // Nessuna unione con "profiles": meal_plans ha DUE collegamenti verso profiles (client_id e created_by),
    // quindi l'unione è ambigua e può fallire in silenzio → nessun piano riconosciuto. Il nome arriva dai clienti già caricati.
    const { data: plRaw, error: plErr } = await supabase.from('meal_plans').select('*').order('created_at',{ascending:false})
    if (plErr) console.error('Errore caricamento piani:', plErr)
    const pl = (plRaw||[]).map(pp => ({ ...pp, profiles: { full_name: (prof||[]).find(cc => cc.id === pp.client_id)?.full_name } }))
    setPlans(pl)

    if (prof?.length) {
      const ids = prof.map(c => c.id)
      const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0]
      const [diaryRes, measureRes, sessionsRes, checkinRes, msgRes, adherenceRes] = await Promise.all([
        supabase.from('diary_entries').select('client_id,entry_date,kcal').in('client_id', ids).gte('entry_date', weekAgo),
        supabase.from('progress_entries').select('client_id,entry_date,weight_kg').in('client_id', ids).order('entry_date',{ascending:false}),
        supabase.from('workout_sessions').select('client_id,session_date,sets_completed,sets_total').in('client_id', ids).gte('session_date', weekAgo),
        supabase.from('weekly_checkins').select('client_id,energy,sleep,stress,week_date').in('client_id', ids).order('week_date',{ascending:false}),
        supabase.from('coach_messages').select('client_id,is_read,sender_role,created_at').in('client_id', ids).eq('sender_role','client').eq('is_read',false),
        supabase.from('meal_adherence').select('client_id,followed,adherence_date').in('client_id', ids).gte('adherence_date', weekAgo),
      ])

      // workout_reports separato — tabella potrebbe non esistere
      let reportsRes = { data: [] }
      try {
        const { data: repData } = await supabase.from('workout_reports')
          .select('client_id,id,submitted_at,read_by_coach')
          .in('client_id', ids).not('submitted_at','is',null).eq('read_by_coach',false)
        reportsRes = { data: repData || [] }
      } catch(e) { /* tabella non ancora creata */ }

      // anamnesi non lette
      let anamnesiRes = { data: [] }
      try {
        const { data: amnData } = await supabase.from('anamnesi')
          .select('client_id,id,completed_at,read_by_coach')
          .in('client_id', ids).not('completed_at','is',null).eq('read_by_coach',false)
        anamnesiRes = { data: amnData || [] }
      } catch(e) { /* colonna non ancora creata */ }

      const diaryByClient = {}
      ;(diaryRes.data||[]).forEach(d => {
        if (!diaryByClient[d.client_id]) diaryByClient[d.client_id] = []
        diaryByClient[d.client_id].push(d)
      })

      const latestByClient = {}
      ;(measureRes.data||[]).forEach(m => { if (!latestByClient[m.client_id]) latestByClient[m.client_id] = m })

      const sessionsByClient = {}
      ;(sessionsRes.data||[]).forEach(s => {
        if (!sessionsByClient[s.client_id]) sessionsByClient[s.client_id] = []
        sessionsByClient[s.client_id].push(s)
      })

      const checkinByClient = {}
      ;(checkinRes.data||[]).forEach(c => { if (!checkinByClient[c.client_id]) checkinByClient[c.client_id] = c })

      const unreadByClient = {}
      ;(msgRes.data||[]).forEach(m => { unreadByClient[m.client_id] = (unreadByClient[m.client_id]||0)+1 })

      const newReportByClient = {}
      ;(reportsRes.data||[]).forEach(r => { newReportByClient[r.client_id] = r })

      const newAnamnesiByClient = {}
      ;(anamnesiRes.data||[]).forEach(a => { newAnamnesiByClient[a.client_id] = a })

      const adherenceByClient = {}
      ;(adherenceRes.data||[]).forEach(a => {
        if (!adherenceByClient[a.client_id]) adherenceByClient[a.client_id] = {followed:0,total:0}
        adherenceByClient[a.client_id].total++
        if (a.followed) adherenceByClient[a.client_id].followed++
      })

      const stats = {}
      prof.forEach(c => {
        const cp = (pl||[]).filter(p => p.client_id === c.id)
        const diaryDays = (diaryByClient[c.id]||[]).map(d=>d.entry_date)
        stats[c.id] = {
          diaryToday: diaryDays.includes(today),
          diaryDays7: diaryDays.length,
          activePlan: cp.find(p => p.is_active) || null,
          inactivePlan: cp.some(p => p.is_active) ? null : (cp[0] || null),   // i piani arrivano dal più recente
          latestMeasure: latestByClient[c.id] || null,
          sessions7: sessionsByClient[c.id] || [],
          lastCheckin: checkinByClient[c.id] || null,
          unreadMessages: unreadByClient[c.id] || 0,
          adherence: adherenceByClient[c.id] || null,
          newReport: newReportByClient[c.id] || null,
          newAnamnesi: newAnamnesiByClient[c.id] || null,
        }
      })
      setClientStats(stats)
    }
    setLoading(false)
  }

  async function createClient() {
    if (!newClient.email||!newClient.password||!newClient.full_name) { setMsg('Compila tutti i campi obbligatori'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newClient.email, password: newClient.password, full_name: newClient.full_name,
          goal: newClient.goal, phone: newClient.phone, height_cm: newClient.height_cm, notes: newClient.notes,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore creazione')
      setMsg('Cliente creato! Comunicagli email e password.')
      setShowNewClient(false)
      setNewClient({ email:'', password:'', full_name:'', goal:'dimagrimento', phone:'', height_cm:'', notes:'' })
      setTimeout(() => { setMsg(''); fetchAll() }, 2000)
    } catch(e) {
      setMsg('Errore: ' + e.message)
    }
    setSaving(false)
  }

  async function createPlan() {
    if (!newPlan.client_id||!newPlan.title) { setMsg('Seleziona un cliente'); return }
    setSaving(true)
    const dietData = buildPlanFromDiet()

    // Disattiva piano precedente del cliente
    await supabase.from('meal_plans').update({is_active:false}).eq('client_id', newPlan.client_id)

    // Insert base senza colonne opzionali
    const payload = {
      client_id: newPlan.client_id,
      created_by: profile.id,
      title: newPlan.title,
      week_number: parseInt(newPlan.week_number) || 1,
      kcal_target: Math.round(dietData.kcal_target) || 2000,
      protein_target_g: Math.round(dietData.protein_target_g) || 150,
      carbs_target_g: Math.round(dietData.carbs_target_g) || 200,
      fat_target_g: Math.round(dietData.fat_target_g) || 65,
      notes: newPlan.notes || '',
      is_active: true,
    }

    // Prova ad aggiungere diet_type/diet_config solo se il campo esiste
    const { error } = await supabase.from('meal_plans').insert(payload)

    if (error) {
      // Se l'errore è sulle colonne diet_type, riprova senza
      if (error.message?.includes('diet_type') || error.message?.includes('diet_config')) {
        const { error: error2 } = await supabase.from('meal_plans').insert(payload)
        if (error2) { setMsg('Errore: ' + error2.message); setSaving(false); return }
      } else {
        setMsg('Errore: ' + error.message)
        setSaving(false)
        return
      }
    }

    setMsg('✓ Piano creato e assegnato al cliente!')
    setShowNewPlan(false)
    setDietType('lineare')
    setNewPlan({ client_id:'', title:'Piano alimentare', week_number:1, kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65, notes:'' })
    setTimeout(() => { setMsg(''); fetchAll() }, 2000)
    setSaving(false)
  }

  async function reactivatePlan(planId) {
    const { error } = await supabase.from('meal_plans').update({ is_active: true }).eq('id', planId)
    if (error) { alert('Errore riattivazione piano: ' + error.message); return }
    fetchAll()
  }
  async function togglePlan(id, cur) { await supabase.from('meal_plans').update({is_active:!cur}).eq('id',id); fetchAll() }
  async function deletePlan(id) { if (!confirm('Eliminare?')) return; await supabase.from('meal_plans').delete().eq('id',id); fetchAll() }
  const macroKcal = p => (parseInt(p.protein_target_g||0)*4+parseInt(p.carbs_target_g||0)*4+parseInt(p.fat_target_g||0)*9)
  const dcMacroKcal = (prefix) => (parseInt(dietConfig[`${prefix}_protein`]||0)*4+parseInt(dietConfig[`${prefix}_carbs`]||0)*4+parseInt(dietConfig[`${prefix}_fat`]||0)*9)

  // Sync kcal → macro per dietConfig (mantiene proporzioni)
  function handleDcKcalChange(prefix, newKcal) {
    setDietConfig(p => {
      const kcalNum = parseInt(newKcal) || 0
      const currentTotal = dcMacroKcal(prefix)
      if (currentTotal === 0) return {
        ...p, [`${prefix}_kcal`]: kcalNum,
        [`${prefix}_protein`]: Math.round(kcalNum*0.30/4),
        [`${prefix}_carbs`]: Math.round(kcalNum*0.40/4),
        [`${prefix}_fat`]: Math.round(kcalNum*0.30/9),
      }
      const ratio = kcalNum / currentTotal
      return {
        ...p, [`${prefix}_kcal`]: kcalNum,
        [`${prefix}_protein`]: Math.round((parseInt(p[`${prefix}_protein`])||0)*ratio),
        [`${prefix}_carbs`]: Math.round((parseInt(p[`${prefix}_carbs`])||0)*ratio),
        [`${prefix}_fat`]: Math.round((parseInt(p[`${prefix}_fat`])||0)*ratio),
      }
    })
  }

  // Sync macro → kcal per dietConfig
  function handleDcMacroChange(prefix, field, value) {
    setDietConfig(p => {
      const updated = { ...p, [`${prefix}_${field}`]: parseInt(value)||0 }
      updated[`${prefix}_kcal`] = (parseInt(updated[`${prefix}_protein`]||0)*4)+(parseInt(updated[`${prefix}_carbs`]||0)*4)+(parseInt(updated[`${prefix}_fat`]||0)*9)
      return updated
    })
  }

  // Quando cambiano le kcal totali -> riproporziona i macro mantenendo le proporzioni attuali
  function handleKcalChange(newKcal) {
    setNewPlan(p => {
      const kcalNum = parseInt(newKcal) || 0
      const currentTotal = macroKcal(p)
      if (currentTotal === 0) {
        // Nessun macro impostato: usa una distribuzione di default 30% proteine / 40% carbo / 30% grassi
        return {
          ...p, kcal_target: newKcal,
          protein_target_g: Math.round(kcalNum * 0.30 / 4),
          carbs_target_g: Math.round(kcalNum * 0.40 / 4),
          fat_target_g: Math.round(kcalNum * 0.30 / 9),
        }
      }
      const ratio = kcalNum / currentTotal
      return {
        ...p, kcal_target: newKcal,
        protein_target_g: Math.round((parseInt(p.protein_target_g)||0) * ratio),
        carbs_target_g: Math.round((parseInt(p.carbs_target_g)||0) * ratio),
        fat_target_g: Math.round((parseInt(p.fat_target_g)||0) * ratio),
      }
    })
  }

  // Quando cambia un macro -> ricalcola le kcal totali dalla somma dei macro
  function handleMacroChange(field, value) {
    setNewPlan(p => {
      const updated = { ...p, [field]: value }
      updated.kcal_target = macroKcal(updated)
      return updated
    })
  }

  // Applica ricerca e filtri
  const filteredClients = clients.filter(c => {
    if (search && !c.full_name?.toLowerCase().includes(search.toLowerCase())) return false
    const st = clientStats[c.id]
    if (!st) return true
    if (filter === 'no-piano' && (st.activePlan || st.inactivePlan)) return false
    if (filter === 'no-diario' && st.diaryToday) return false
    if (filter === 'piano-attivo' && !st.activePlan) return false
    if (filter === 'piano-non-attivo' && !st.inactivePlan) return false
    return true
  })

  const countNoPiano = clients.filter(c => clientStats[c.id] && !clientStats[c.id].activePlan && !clientStats[c.id].inactivePlan).length
  const countPianoNonAttivo = clients.filter(c => clientStats[c.id]?.inactivePlan).length
  const countNoDiario = clients.filter(c => clientStats[c.id] && !clientStats[c.id].diaryToday).length

  const SIDEBAR_TABS = [
    { id:'clienti', icon:'ti-users', label:'Clienti' },
    { id:'report', icon:'ti-clipboard-check', label:'Report' },
    { id:'anamnesi', icon:'ti-clipboard-heart', label:'Anamnesi' },
    { id:'check-in', icon:'ti-activity', label:'Check-in' },
    { id:'calendario', icon:'ti-calendar', label:'Calendario' },
  ]

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:'#161616'}}>

      {/* ── SIDEBAR PC ── */}
      {!isMobile && (
        <div style={{width:220,flexShrink:0,background:'#111',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* BRAND */}
          <div style={{padding:'20px 18px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
            <div style={{fontSize:20,fontWeight:900,color:'white',letterSpacing:-0.5}}>
              FO<span style={{color:'#D4570A'}}>fit</span>
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:2}}>Dashboard Coach</div>
          </div>

          {/* QUICK ACTIONS */}
          <div style={{padding:'12px 12px 8px'}}>
            <button onClick={()=>setShowNewClient(true)} style={{
              width:'100%',padding:'9px 12px',background:'linear-gradient(135deg,#D4570A,#E8703A)',
              color:'white',border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
              fontFamily:'inherit',display:'flex',alignItems:'center',gap:7,marginBottom:6,
              boxShadow:'0 2px 8px rgba(212,87,10,0.4)'
            }}>
              <i className="ti ti-user-plus" style={{fontSize:15}}/>Nuovo cliente
            </button>
            <div style={{marginBottom:6}}>
              <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.55)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Crea da zero</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                <button onClick={()=>window.location.href='/crea-piano'} style={{padding:'8px',background:'rgba(212,87,10,0.2)',color:'#F4894A',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <i className="ti ti-pencil-plus" style={{fontSize:15}}/>Piano
                </button>
                <button onClick={()=>window.location.href='/crea-allenamento'} style={{padding:'8px',background:'rgba(212,87,10,0.2)',color:'#F4894A',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <i className="ti ti-pencil-plus" style={{fontSize:15}}/>Scheda
                </button>
              </div>
            </div>
            <div>
              <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.55)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Importa</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                <button onClick={()=>window.location.href='/importa'} style={{padding:'8px',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.7)',border:'0.5px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <i className="ti ti-salad" style={{fontSize:15}}/>Piano
                </button>
                <button onClick={()=>window.location.href='/importa-allenamento'} style={{padding:'8px',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.7)',border:'0.5px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <i className="ti ti-barbell" style={{fontSize:15}}/>Scheda
                </button>
              </div>
            </div>
          </div>

          {/* NAVIGATION */}
          <nav style={{flex:1,overflowY:'auto',padding:'4px 8px'}}>
            {SIDEBAR_TABS.map(t => (
              <button key={t.id} onClick={()=>{setTab(t.id);setSelectedClient(null)}} style={{
                width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 10px',
                borderRadius:9,border:'none',cursor:'pointer',fontFamily:'inherit',
                background:tab===t.id?'rgba(212,87,10,0.15)':'transparent',
                color:tab===t.id?'#F4894A':'rgba(255,255,255,0.7)',
                fontSize:13,fontWeight:tab===t.id?700:400,
                marginBottom:2,textAlign:'left',
                borderLeft:tab===t.id?'3px solid #D4570A':'3px solid transparent',
                transition:'all 0.15s',
              }}>
                <i className={`ti ${t.icon}`} style={{fontSize:17,flexShrink:0}}/>
                {t.label}
              </button>
            ))}
          </nav>

          {/* FOOTER SIDEBAR */}
          <div style={{padding:'12px 14px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:2}}>
              {new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>
              {clients.length} clienti · {Object.values(clientStats).filter(s=>s.newReport).length} nuovi report
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden',flexDirection:'column'}}>

        {/* TOPBAR */}
        <div style={{background:'#0D0D0D',borderBottom:'0.5px solid #1A1A1A',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {isMobile && (
              <div style={{fontSize:16,fontWeight:900,color:'#F0F0F0'}}>FO<span style={{color:'#D4570A'}}>fit</span></div>
            )}
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>
                {tab==='clienti'?'👥 Clienti':tab==='report'?'📋 Report':tab==='anamnesi'?'📝 Anamnesi':tab==='check-in'?'✅ Check-in':tab==='calendario'?'📅 Calendario':'Dashboard'}
              </div>
              {!isMobile && <div style={{fontSize:11,color:'#CCC'}}>{filteredClients.length} clienti visualizzati</div>}
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <NotifBell clients={clients}/>
            {tab==='clienti' && (
              <>
                <button style={s.btnSm} onClick={()=>setShowNewClient(true)}>
                  <i className="ti ti-user-plus" style={{fontSize:13}}/>
                  {!isMobile && ' Nuovo'}
                </button>
                <button style={s.btnGray} onClick={fetchAll}>
                  <i className="ti ti-refresh" style={{fontSize:13}}/>
                </button>
              </>
            )}
          </div>
        </div>

        {/* CONTENT AREA — con eventuale pannello cliente affiancato */}
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>

          {/* CONTENUTO PRINCIPALE */}
          <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'16px'}}>
            {msg && <div style={{background:'rgba(59,109,17,0.1)',border:'0.5px solid #3B6D11',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#3B6D11',marginBottom:14}}>{msg}</div>}

            {/* TAB MOBILE */}
            {isMobile && (
              <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:4}}>
                {SIDEBAR_TABS.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setSelectedClient(null)}} style={{
                    flexShrink:0,padding:'6px 14px',borderRadius:16,fontSize:11,fontWeight:600,cursor:'pointer',
                    border:'0.5px solid',fontFamily:'inherit',
                    background:tab===t.id?'#D4570A':'#161616',
                    color:tab===t.id?'white':'#AAA',
                    borderColor:tab===t.id?'#D4570A':'#E0DDD6',
                  }}>{t.label}</button>
                ))}
              </div>
            )}

            {/* TAB CLIENTI */}
            {tab==='clienti' && (
              <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',overflow:'hidden'}}>
                {/* FILTRI */}
                <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F0EDE8',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  <div style={{position:'relative',flex:1,minWidth:180}}>
                    <i className="ti ti-search" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'#CCC'}}/>
                    <input style={{...s.input,paddingLeft:32,fontSize:13,height:34}} placeholder="Cerca cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    {[
                      {id:'tutti',label:`Tutti (${clients.length})`},
                      {id:'no-diario',label:`✗ Diario (${countNoDiario})`},
                      {id:'no-piano',label:`Senza piano (${countNoPiano})`},
                      {id:'piano-attivo',label:'Con piano'},...(countPianoNonAttivo>0?[{id:'piano-non-attivo',label:`Piano non attivo (${countPianoNonAttivo})`}]:[]),
                    ].map(f=>(
                      <button key={f.id} onClick={()=>setFilter(f.id)} style={{
                        padding:'5px 11px',borderRadius:14,fontSize:11,fontWeight:filter===f.id?700:500,
                        cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                        background:filter===f.id?'#D4570A':'#161616',
                        color:filter===f.id?'white':'#AAA',
                        borderColor:filter===f.id?'#D4570A':'#E0DDD6',
                      }}>{f.label}</button>
                    ))}
                  </div>
                </div>

                {/* GRIGLIA CLIENTI */}
                {loading ? (
                  <div style={{textAlign:'center',padding:'40px',color:'#CCC'}}>Caricamento...</div>
                ) : filteredClients.length === 0 ? (
                  <div style={{textAlign:'center',padding:'40px',color:'#CCC'}}>
                    <i className="ti ti-users" style={{fontSize:36,display:'block',marginBottom:8,opacity:0.3}}/>
                    {clients.length===0?'Nessun cliente ancora.':'Nessun risultato per questi filtri.'}
                  </div>
                ) : (
                  <div style={{
                    display:'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap:1,
                    background:'#141414',
                  }}>
                    {filteredClients.map(c => {
                      const st = clientStats[c.id] || {}
                      const isSelected = selectedClient?.id === c.id
                      const days = c.subscription_end ? Math.ceil((new Date(c.subscription_end)-new Date())/86400000) : null
                      const sessWeek = (st.sessions7||[]).length
                      const adherencePct = st.adherence ? Math.round(st.adherence.followed/st.adherence.total*100) : null

                      return (
                        <div key={c.id}
                          style={{
                            background: isSelected ? '#1A1A1A' : '#0D0D0D',
                            padding:'12px 14px',
                            borderLeft: isSelected ? '3px solid #D4570A' : '3px solid transparent',
                            transition:'background 0.12s',
                          }}>

                          {/* RIGA 1: Avatar + Nome + Info + Badges */}
                          <div onClick={()=>setSelectedClient(isSelected?null:c)} style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,cursor:'pointer'}}>
                            <div style={{
                              width:38,height:38,borderRadius:10,flexShrink:0,
                              background: isSelected ? '#D4570A' : 'rgba(212,87,10,0.15)',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:12,fontWeight:800,
                              color: isSelected ? 'white' : '#D4570A',
                            }}>{initials(c.full_name)}</div>

                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.full_name}</div>
                              <div style={{fontSize:10,color:'#CCC',marginTop:1,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                                <span>{goalLabel[c.goal]||'—'}</span>{st.inactivePlan && <><span style={{color:'#D0CFC9'}}>·</span><span style={{color:'#F5B041',fontWeight:700}}>Piano non attivo</span></>}
                                {st.activePlan && <><span style={{color:'#D0CFC9'}}>·</span><span style={{color:'#D4570A',fontWeight:600}}>{st.activePlan.kcal_target} kcal</span></>}
                                {days!==null && <span style={{padding:'1px 5px',borderRadius:5,fontSize:9,fontWeight:600,background:days<0?'rgba(226,75,74,0.15)':days<=7?'rgba(212,87,10,0.15)':'rgba(59,140,90,0.15)',color:days<0?'#E24B4A':days<=7?'#D4570A':'#3B8C5A'}}>{days<0?'Scaduto':`${days}gg`}</span>}
                              </div>
                            </div>

                            <div style={{display:'flex',gap:3,flexShrink:0}}>
                              {st.newReport && <span title="Nuovo report" style={{width:18,height:18,borderRadius:'50%',background:'#7C3AED',color:'white',fontSize:8,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>R</span>}
                              {st.newAnamnesi && <span title="Nuova anamnesi" style={{width:18,height:18,borderRadius:'50%',background:'#4A90D4',color:'white',fontSize:8,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>A</span>}
                              {st.unreadMessages>0 && <span style={{width:18,height:18,borderRadius:'50%',background:'#D4570A',color:'white',fontSize:8,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{st.unreadMessages}</span>}
                            </div>
                          </div>

                          {/* RIGA 2: Stats */}
                          <div onClick={()=>setSelectedClient(isSelected?null:c)} style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:9,cursor:'pointer'}}>
                            {[
                              {l:'Peso',v:st.latestMeasure?.weight_kg?`${st.latestMeasure.weight_kg}kg`:'—',c:st.latestMeasure?.weight_kg?'#F0F0F0':'#444'},
                              {l:'Diario',v:st.diaryToday?'✓':'✗',c:st.diaryToday?'#3B6D11':'#E24B4A'},
                              {l:'Sessioni',v:sessWeek,c:sessWeek>=3?'#3B6D11':sessWeek>=1?'#E8A020':'#E24B4A'},
                              {l:'Aderenza',v:adherencePct!==null?`${adherencePct}%`:'—',c:adherencePct!==null?(adherencePct>=70?'#3B8C5A':adherencePct>=50?'#E8A020':'#E24B4A'):'#444'},
                            ].map(stat=>(
                              <div key={stat.l} style={{background:'#1A1A1A',borderRadius:7,padding:'5px 3px',textAlign:'center'}}>
                                <div style={{fontSize:13,fontWeight:700,color:stat.c,lineHeight:1.1}}>{stat.v}</div>
                                <div style={{fontSize:7.5,color:'#B8B5B0',textTransform:'uppercase',letterSpacing:'0.04em',marginTop:1}}>{stat.l}</div>
                              </div>
                            ))}
                          </div>

                          {/* RIGA 3: Azioni */}
                          <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                            {st.activePlan ? (
                              <a href={`/modifica-piano/${st.activePlan.id}`} onClick={e=>{e.preventDefault();window.location.href=`/modifica-piano/${st.activePlan.id}`}}
                                style={{flex:1,padding:'6px 4px',background:'rgba(212,87,10,0.1)',color:'#D4570A',border:'0.5px solid #F4C9A8',borderRadius:7,fontSize:10,fontWeight:600,textDecoration:'none',textAlign:'center'}}>
                                🥗 Piano
                              </a>
                            ) : st.inactivePlan ? (
                              <button onClick={()=>reactivatePlan(st.inactivePlan.id)} style={{flex:1,padding:'6px 4px',background:'rgba(245,176,65,0.15)',color:'#F5B041',border:'0.5px solid rgba(245,176,65,0.5)',borderRadius:7,fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                                ↻ Riattiva piano
                              </button>
                            ) : (
                              <a href="/importa" onClick={e=>{e.preventDefault();window.location.href='/importa'}}
                                style={{flex:1,padding:'6px 4px',background:'#161616',color:'#CCC',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:10,fontWeight:500,textDecoration:'none',textAlign:'center'}}>
                                + Piano
                              </a>
                            )}
                            <button onClick={()=>{setNewPlan(p=>({...p,client_id:c.id}));setShowNewPlan(true)}}
                              style={{flex:1,padding:'6px 4px',background:'#161616',color:'#CCC',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                              + Nuovo
                            </button>
                            <button onClick={()=>setSelectedClient(isSelected?null:c)}
                              style={{flex:1,padding:'6px 4px',background:isSelected?'#222':'#161616',color:isSelected?'#F0F0F0':'#AAA',border:`0.5px solid ${isSelected?'#444':'#222'}`,borderRadius:7,fontSize:10,fontWeight:isSelected?700:500,cursor:'pointer',fontFamily:'inherit'}}>
                              {isSelected?'✕ Chiudi':'Apri →'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab==='calendario' && <CalendarioAdmin/>}
            {tab==='check-in' && <CheckinAdmin/>}
            {tab==='report' && <ReportTab clients={clients} clientStats={clientStats} onRefresh={fetchAll}/>}
            {tab==='anamnesi' && <AnamnesiTab clients={clients} onRefresh={fetchAll}/>}
          </div>

          {/* PANNELLO DETTAGLIO CLIENTE — slide-in a destra su PC */}
          {selectedClient && !isMobile && (
            <div style={{
              width:440,flexShrink:0,borderLeft:'0.5px solid #1A1A1A',
              overflowY:'auto',background:'#0D0D0D',
              WebkitOverflowScrolling:'touch',
              animation:'slideInRight 0.2s ease-out',
            }}>
              <ClientDetailModal
                client={selectedClient}
                plans={plans.filter(p=>p.client_id===selectedClient.id)}
                onClose={()=>setSelectedClient(null)}
                onSaved={fetchAll}
                onNewPlan={()=>{setNewPlan(p=>({...p,client_id:selectedClient.id}));setShowNewPlan(true)}}
              />
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETTAGLIO MOBILE */}
      {selectedClient && isMobile && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setSelectedClient(null)}>
          <div style={{background:'#0D0D0D',borderRadius:'16px 16px 0 0',width:'100%',maxHeight:'90dvh',overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
            <ClientDetailModal
              client={selectedClient}
              plans={plans.filter(p=>p.client_id===selectedClient.id)}
              onClose={()=>setSelectedClient(null)}
              onSaved={fetchAll}
              onNewPlan={()=>{setNewPlan(p=>({...p,client_id:selectedClient.id}));setShowNewPlan(true);setSelectedClient(null)}}
            />
          </div>
        </div>
      )}

      {/* MODAL NUOVO CLIENTE */}
      {showNewClient && (
        <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setShowNewClient(false)}>
          <div style={s.modalCard}>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>Nuovo cliente</div>
            <div style={{fontSize:12,color:'#CCC',marginBottom:20}}>Crea l'account e comunicagli le credenziali.</div>
            <div style={s.formGroup}><label style={s.label}>Nome completo *</label><input style={s.input} placeholder="Es. Marco Rossi" value={newClient.full_name} onChange={e=>setNewClient(p=>({...p,full_name:e.target.value}))}/></div>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Email *</label><input style={s.input} type="email" value={newClient.email} onChange={e=>setNewClient(p=>({...p,email:e.target.value}))}/></div>
              <div style={s.formGroup}><label style={s.label}>Password *</label><input style={s.input} type="text" value={newClient.password} onChange={e=>setNewClient(p=>({...p,password:e.target.value}))}/></div>
            </div>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Telefono</label><input style={s.input} value={newClient.phone} onChange={e=>setNewClient(p=>({...p,phone:e.target.value}))}/></div>
              <div style={s.formGroup}><label style={s.label}>Altezza (cm)</label><input style={s.input} type="number" value={newClient.height_cm} onChange={e=>setNewClient(p=>({...p,height_cm:e.target.value}))}/></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Obiettivo</label>
              <select style={s.select} value={newClient.goal} onChange={e=>setNewClient(p=>({...p,goal:e.target.value}))}>
                <option value="dimagrimento">Dimagrimento</option><option value="massa">Massa muscolare</option><option value="ricomposizione">Ricomposizione corporea</option><option value="mantenimento">Mantenimento</option><option value="forza">Forza</option><option value="resistenza">Resistenza</option>
              </select>
            </div>
            <div style={s.formGroup}><label style={s.label}>Note</label><textarea style={{...s.input,height:60,resize:'vertical'}} value={newClient.notes} onChange={e=>setNewClient(p=>({...p,notes:e.target.value}))}/></div>
            {msg && <div style={{fontSize:12,color:'#D4570A',marginBottom:10}}>{msg}</div>}
            <button style={s.saveBtn} onClick={createClient} disabled={saving}>{saving?'Creazione...':'Crea cliente'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowNewClient(false)}>Annulla</button>
          </div>
        </div>
      )}

      {showNewPlan && (
        <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setShowNewPlan(false)}>
          <div style={{...s.modalCard, maxWidth:620}}>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>Nuovo piano alimentare</div>
            <div style={{fontSize:12,color:'#CCC',marginBottom:16}}>Assegna un piano a un cliente.</div>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Cliente *</label>
                <select style={s.select} value={newPlan.client_id} onChange={e=>setNewPlan(p=>({...p,client_id:e.target.value}))}>
                  <option value="">Seleziona...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div style={s.formGroup}><label style={s.label}>Titolo</label><input style={s.input} value={newPlan.title} onChange={e=>setNewPlan(p=>({...p,title:e.target.value}))}/></div>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Tipo di approccio alimentare</label>
              <select style={{...s.select, fontWeight:500}} value={dietType} onChange={e=>setDietType(e.target.value)}>
                {DIET_TYPES.map(d=><option key={d.value} value={d.value}>{d.label} — {d.desc}</option>)}
              </select>
            </div>
            {dietType==='lineare' && (
              <>
                <div style={s.formGroup}><label style={s.label}>Calorie target (kcal)</label><input style={s.input} type="number" value={newPlan.kcal_target} onChange={e=>handleKcalChange(e.target.value)}/></div>
                <div style={s.grid2}>
                  <div style={s.formGroup}><label style={s.label}>Proteine (g)</label><input style={s.input} type="number" value={newPlan.protein_target_g} onChange={e=>handleMacroChange('protein_target_g', e.target.value)}/></div>
                  <div style={s.formGroup}><label style={s.label}>Carboidrati (g)</label><input style={s.input} type="number" value={newPlan.carbs_target_g} onChange={e=>handleMacroChange('carbs_target_g', e.target.value)}/></div>
                  <div style={s.formGroup}><label style={s.label}>Grassi (g)</label><input style={s.input} type="number" value={newPlan.fat_target_g} onChange={e=>handleMacroChange('fat_target_g', e.target.value)}/></div>
                  <div style={s.formGroup}><label style={s.label}>Totale da macro</label><div style={{padding:'9px 12px',background:'rgba(59,109,17,0.1)',borderRadius:8,fontSize:13,color:'#3B6D11',fontWeight:600}}>{macroKcal(newPlan)} kcal ✓</div></div>
                </div>
              </>
            )}
            {dietType!=='lineare' && (
              <div style={{background:'rgba(212,87,10,0.1)',borderRadius:10,padding:'12px',marginBottom:12}}>
                <div style={{fontSize:12,color:'#D4570A',fontWeight:600}}>Per i piani avanzati (ON/OFF, Ad onde, ecc.) usa la sezione Importa piano.</div>
              </div>
            )}
            <div style={s.formGroup}><label style={s.label}>Note per il cliente</label><textarea style={{...s.input,height:60,resize:'vertical'}} value={newPlan.notes} onChange={e=>setNewPlan(p=>({...p,notes:e.target.value}))}/></div>
            {msg && <div style={{fontSize:12,color:'#D4570A',marginBottom:10}}>{msg}</div>}
            <button style={s.saveBtn} onClick={createPlan} disabled={saving}>{saving?'Creazione...':'Crea piano'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowNewPlan(false)}>Annulla</button>
          </div>
        </div>
      )}

    </div>
  )
}


function ClientDetailModal({ client, plans, onClose, onSaved, onNewPlan }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: client.full_name || '',
    goal: client.goal || 'dimagrimento',
    height_cm: client.height_cm || '',
    phone: client.phone || '',
    notes: client.notes || '',
    coach_notes: client.coach_notes || '',
  })
  const [measurements, setMeasurements] = useState([])
  const [photos, setPhotos] = useState([])
  const [diaryWeek, setDiaryWeek] = useState([])
  const [workoutSessions, setWorkoutSessions] = useState([])
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [allSessionsCount, setAllSessionsCount] = useState(0)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [lastCheckin, setLastCheckin] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [adherenceWeek, setAdherenceWeek] = useState(null)
  const [activeWorkoutPlan, setActiveWorkoutPlan] = useState(null)
  const [activeMealPlan, setActiveMealPlan] = useState(null)
  const [anamnesi, setAnamnesi] = useState(null)
  const [showAnamnesi, setShowAnamnesi] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { loadData() }, [client.id])

  async function loadData() {
    setLoadingData(true)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
      const [measRes, photoRes, diaryRes, sessionsRes, sessionsCountRes, logsRes, checkinRes, msgRes, adherenceRes, mealPlanRes, workoutPlanRes] = await Promise.all([
        supabase.from('progress_entries').select('*').eq('client_id', client.id).order('entry_date',{ascending:false}).limit(3),
        supabase.from('progress_photos').select('*').eq('client_id', client.id).order('photo_date',{ascending:false}).limit(6),
        supabase.from('diary_entries').select('entry_date, kcal').eq('client_id', client.id).gte('entry_date', sevenDaysAgo),
        supabase.from('workout_sessions').select('*').eq('client_id', client.id).order('session_date',{ascending:false}).limit(5),
        supabase.from('workout_sessions').select('id', {count:'exact', head:true}).eq('client_id', client.id),
        supabase.from('workout_logs').select('*').eq('client_id', client.id).gte('log_date', sevenDaysAgo).order('log_date',{ascending:false}),
        supabase.from('weekly_checkins').select('*').eq('client_id', client.id).order('week_date',{ascending:false}).limit(1),
        supabase.from('coach_messages').select('id',{count:'exact',head:true}).eq('client_id', client.id).eq('sender_role','client').eq('is_read',false),
        supabase.from('meal_adherence').select('followed').eq('client_id', client.id).gte('adherence_date', sevenDaysAgo),
        supabase.from('meal_plans').select('*').eq('client_id', client.id).eq('is_active', true).limit(1),
        supabase.from('workout_plans').select('*').eq('client_id', client.id).eq('is_active', true).limit(1),
      ])
      setAllSessionsCount(sessionsCountRes.count || 0)
      setMeasurements(measRes.data || [])
      setPhotos(photoRes.data || [])
      setWorkoutSessions(sessionsRes.data || [])
      setWorkoutLogs(logsRes.data || [])
      setLastCheckin(checkinRes.data?.[0] || null)
      setUnreadCount(msgRes.count || 0)
      const adh = adherenceRes.data || []
      setAdherenceWeek(adh.length > 0 ? { followed: adh.filter(a=>a.followed).length, total: adh.length } : null)
      setActiveMealPlan(mealPlanRes.data?.[0] || null)
      if (mealPlanRes.data?.[0]) {
        const mp = mealPlanRes.data[0]
        setPlanEdit({ title: mp.title, kcal_target: mp.kcal_target, protein_target_g: mp.protein_target_g, carbs_target_g: mp.carbs_target_g, fat_target_g: mp.fat_target_g, notes: mp.notes||'' })
      }
      setActiveWorkoutPlan(workoutPlanRes.data?.[0] || null)
      // Anamnesi
      const { data: amnData } = await supabase.from('anamnesi').select('*').eq('client_id', client.id).maybeSingle()
      setAnamnesi(amnData || null)
      const byDay = {}
      ;(diaryRes.data||[]).forEach(d => { byDay[d.entry_date] = (byDay[d.entry_date]||0) + (d.kcal||0) })
      const days = []
      for (let i=6;i>=0;i--) {
        const d = new Date(Date.now() - i*24*60*60*1000).toISOString().split('T')[0]
        days.push({ date:d, kcal: Math.round(byDay[d]||0) })
      }
      setDiaryWeek(days)
    } catch(e) {
      console.error('loadData error:', e)
    }
    setLoadingData(false)
  }

  async function loadAllSessions() {
    const { data } = await supabase.from('workout_sessions')
      .select('*').eq('client_id', client.id).order('session_date',{ascending:false})
    setWorkoutSessions(data || [])
    setShowAllSessions(true)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      goal: form.goal,
      height_cm: form.height_cm ? parseInt(form.height_cm) : null,
      phone: form.phone,
      notes: form.notes,
      coach_notes: form.coach_notes,
    }).eq('id', client.id)
    setSaving(false)
    if (!error) {
      setEditing(false)
      onSaved()
    }
  }

  const [editingPlan, setEditingPlan] = useState(false)
  const [planEdit, setPlanEdit] = useState({ title:'', kcal_target:'', protein_target_g:'', carbs_target_g:'', fat_target_g:'', notes:'' })

  async function savePlanEdit() {
    if (!activeMealPlan) return
    await supabase.from('meal_plans').update({
      title: planEdit.title,
      kcal_target: parseInt(planEdit.kcal_target),
      protein_target_g: parseInt(planEdit.protein_target_g),
      carbs_target_g: parseInt(planEdit.carbs_target_g),
      fat_target_g: parseInt(planEdit.fat_target_g),
      notes: planEdit.notes,
    }).eq('id', activeMealPlan.id)
    setEditingPlan(false)
    onSaved()
  }

  async function deactivatePlan(planId) {
    if (!window.confirm('Disattivare questo piano? Il cliente non lo vedrà più nell\'app.')) return
    await supabase.from('meal_plans').update({ is_active: false }).eq('id', planId)
    setEditingPlan(false)
    onSaved()
  }
  const latest = measurements[0]
  const prevM = measurements[1]
  const weightDiff = latest?.weight_kg && prevM?.weight_kg ? (latest.weight_kg - prevM.weight_kg).toFixed(1) : null

  return (
    <div style={s.modal} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modalCard}>

        {/* HEADER */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:600,color:'white',flexShrink:0}}>{initials(client.full_name)}</div>
          <div style={{flex:1}}>
            {editing ? (
              <input style={{...s.input,fontSize:15,fontWeight:600,padding:'6px 10px'}} value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/>
            ) : (
              <div style={{fontSize:16,fontWeight:600,color:'#F0F0F0'}}>{client.full_name}</div>
            )}
            <div style={{fontSize:12,color:'#CCC',marginTop:2}}>Iscritto il {new Date(client.created_at).toLocaleDateString('it-IT')}</div>
          </div>
          <button onClick={()=>setEditing(!editing)} style={{...s.btnSm, background: editing?'#161616':'rgba(212,87,10,0.12)', color: editing?'#AAA':'#D4570A', borderColor: editing?'#333':'#D4570A'}}>
            <i className={`ti ${editing?'ti-x':'ti-pencil'}`} style={{fontSize:13,marginRight:4}}/>{editing?'Annulla':'Modifica'}
          </button>
          <button onClick={()=>setShowAnamnesi(true)} style={{...s.btnSm, background: anamnesi?.completed_at?'rgba(59,140,90,0.12)':'#161616', color: anamnesi?.completed_at?'#3B6D11':'#AAA', borderColor: anamnesi?.completed_at?'#3B6D11':'#333', display:'flex', alignItems:'center', gap:4}}>
            <i className="ti ti-clipboard-heart" style={{fontSize:13}}/>
            {anamnesi?.completed_at ? 'Anamnesi ✓' : anamnesi ? 'Anamnesi (incompleta)' : 'Anamnesi'}
          </button>
        </div>

        {/* INFO PROFILO — vista o editing */}
        {editing ? (
          <div style={{background:'#161616',borderRadius:10,padding:14,marginBottom:16}}>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Obiettivo</label>
                <select style={s.select} value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))}>
                  <option value="dimagrimento">Dimagrimento</option><option value="massa">Massa muscolare</option><option value="ricomposizione">Ricomposizione corporea</option><option value="mantenimento">Mantenimento</option><option value="forza">Forza</option><option value="resistenza">Resistenza</option>
                </select>
              </div>
              <div style={s.formGroup}><label style={s.label}>Altezza (cm)</label><input style={s.input} type="number" value={form.height_cm} onChange={e=>setForm(f=>({...f,height_cm:e.target.value}))}/></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Telefono</label><input style={s.input} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
            <div style={s.formGroup}><label style={s.label}>Note (visibili al cliente non sono — uso interno)</label><textarea style={{...s.input,height:50,resize:'vertical'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            <div style={s.formGroup}>
              <label style={s.label}><i className="ti ti-lock" style={{fontSize:11,marginRight:3}}/>Note private del coach</label>
              <textarea style={{...s.input,height:60,resize:'vertical',borderColor:'#D4570A'}} placeholder="Es. intolleranza al lattosio, preferisce pasti veloci, infortunio al ginocchio..." value={form.coach_notes} onChange={e=>setForm(f=>({...f,coach_notes:e.target.value}))}/>
            </div>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving?'Salvataggio...':'Salva modifiche'}</button>
          </div>
        ) : (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:14}}>
              {[
                {l:'Obiettivo',v:goalLabel[client.goal]||'—'},
                {l:'Altezza',v:client.height_cm?`${client.height_cm} cm`:'—'},
                {l:'Telefono',v:client.phone||'—'},
                {l:'Abbonamento',v:client.subscription_type||(client.subscription_end?'—':'Non impostato')},
                {l:'Scadenza',v:client.subscription_end?new Date(client.subscription_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}):'—'},
                {l:'Stato',v:!client.subscription_end?'—':Math.ceil((new Date(client.subscription_end)-new Date())/(1000*60*60*24)) < 0 ? '⚠️ Scaduto' : Math.ceil((new Date(client.subscription_end)-new Date())/(1000*60*60*24)) <=7 ? `⚠️ Scade in ${Math.ceil((new Date(client.subscription_end)-new Date())/(1000*60*60*24))}gg` : `✓ Attivo`},
              ].map(r=>(
                <div key={r.l} style={{background:'#161616',borderRadius:8,padding:'8px 12px'}}>
                  <div style={{fontSize:10,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.06em'}}>{r.l}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0',marginTop:2}}>{r.v}</div>
                </div>
              ))}
            </div>
            {client.notes&&(
              <div style={{marginBottom:10,background:'#161616',borderLeft:'3px solid #888780',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#CCC'}}>
                <div style={{fontSize:10,color:'#CCC',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>Note</div>
                {client.notes}
              </div>
            )}
            {client.coach_notes&&(
              <div style={{marginBottom:14,background:'rgba(212,87,10,0.1)',borderLeft:'3px solid #D4570A',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#7a3508'}}>
                <div style={{fontSize:10,color:'#D4570A',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:4}}><i className="ti ti-lock" style={{fontSize:10}}/>Note private coach</div>
                {client.coach_notes}
              </div>
            )}
          </>
        )}

        {/* ── SEZIONE ALIMENTAZIONE ── */}
        <div style={{fontSize:12,fontWeight:700,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,display:'flex',alignItems:'center',gap:6,borderBottom:'1px solid #FEF0E7',paddingBottom:8}}>
          <i className="ti ti-clipboard-list" style={{fontSize:14}}/>Alimentazione
        </div>

        {/* PIANO ATTIVO */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Piano alimentare</div>
          {activeMealPlan ? (
            <div>
              <div style={{background:'rgba(212,87,10,0.1)',border:'0.5px solid #F4C9A8',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'#7a3508'}}>{activeMealPlan.title}</div>
                  <div style={{fontSize:11,color:'#D4570A',marginTop:2}}>{activeMealPlan.kcal_target} kcal · P{activeMealPlan.protein_target_g}g C{activeMealPlan.carbs_target_g}g G{activeMealPlan.fat_target_g}g</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{...s.badge,background:'#3B6D11',color:'white'}}>Attivo</span>
                  <a href={`/modifica-piano/${activeMealPlan.id}`} style={{...s.btnSm,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
                    <i className="ti ti-tools-kitchen-2" style={{fontSize:12}}/>Modifica pasti
                  </a>
                  <button onClick={()=>setEditingPlan(!editingPlan)} style={{...s.btnSm,background:editingPlan?'#D4570A':'#F5F3EF',color:editingPlan?'white':'#888780'}}>
                    {editingPlan?'Chiudi':'✏️ Target'}
                  </button>
                </div>
              </div>
              {editingPlan && (
                <div style={{background:'#161616',borderRadius:10,padding:'14px',border:'0.5px solid #1C1C1C'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                    <div><label style={s.label}>Kcal target</label><input style={s.input} type="number" value={planEdit.kcal_target} onChange={e=>setPlanEdit(p=>({...p,kcal_target:e.target.value}))}/></div>
                    <div><label style={s.label}>Proteine (g)</label><input style={s.input} type="number" value={planEdit.protein_target_g} onChange={e=>setPlanEdit(p=>({...p,protein_target_g:e.target.value}))}/></div>
                    <div><label style={s.label}>Carboidrati (g)</label><input style={s.input} type="number" value={planEdit.carbs_target_g} onChange={e=>setPlanEdit(p=>({...p,carbs_target_g:e.target.value}))}/></div>
                    <div><label style={s.label}>Grassi (g)</label><input style={s.input} type="number" value={planEdit.fat_target_g} onChange={e=>setPlanEdit(p=>({...p,fat_target_g:e.target.value}))}/></div>
                  </div>
                  <div style={{marginBottom:10}}><label style={s.label}>Titolo</label><input style={s.input} value={planEdit.title} onChange={e=>setPlanEdit(p=>({...p,title:e.target.value}))}/></div>
                  <div style={{marginBottom:10}}><label style={s.label}>Note</label><textarea style={{...s.input,resize:'none',height:60}} value={planEdit.notes||''} onChange={e=>setPlanEdit(p=>({...p,notes:e.target.value}))}/></div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={savePlanEdit} style={{...s.btn,flex:1,justifyContent:'center',fontSize:12}}>Salva modifiche</button>
                    <button onClick={()=>deactivatePlan(activeMealPlan.id)} style={{...s.btnGray,fontSize:12}}>Disattiva piano</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{background:'#161616',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'#CCC'}}>Nessun piano attivo</span>
              <button style={s.btnSm} onClick={onNewPlan}>+ Crea piano</button>
            </div>
          )}
        </div>

        {/* DIARIO ULTIMI 7 GIORNI */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Diario — ultimi 7 giorni</div>
          {loadingData ? (
            <div style={{fontSize:12,color:'#CCC'}}>Caricamento...</div>
          ) : (
            <div style={{display:'flex',gap:4}}>
              {diaryWeek.map(d => {
                const target = activeMealPlan?.kcal_target || 2200
                const pct = Math.min(100, Math.round(d.kcal/target*100))
                const dayLabel = new Date(d.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'}).slice(0,1).toUpperCase()
                return (
                  <div key={d.date} style={{flex:1,textAlign:'center'}}>
                    <div style={{height:50,background:'#161616',borderRadius:6,display:'flex',alignItems:'flex-end',overflow:'hidden'}}>
                      <div style={{width:'100%',height:`${Math.max(pct,d.kcal>0?8:0)}%`,background:d.kcal===0?'transparent':pct>=90?'#3B6D11':'#D4570A',borderRadius:6,transition:'height 0.3s'}}/>
                    </div>
                    <div style={{fontSize:9,color:'#CCC',marginTop:3}}>{dayLabel}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* GRAFICO PESO */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Andamento peso</div>
          <div style={{background:'#161616',borderRadius:10,padding:'12px'}}>
            <GraficoPeso clientId={client.id} targetWeight={anamnesi?.peso_desiderato}/>
          </div>
        </div>

        {/* INDICATORI RAPIDI */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
          {/* Messaggi non letti */}
          <div style={{background: unreadCount>0?'#FEF0E7':'#F5F3EF',borderRadius:9,padding:'10px 12px',textAlign:'center',border: unreadCount>0?'0.5px solid #D4570A':'0.5px solid #E0DDD6'}}>
            <div style={{fontSize:18,fontWeight:800,color:unreadCount>0?'#D4570A':'#888780'}}>{unreadCount}</div>
            <div style={{fontSize:9,color:unreadCount>0?'#D4570A':'#888780',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>Msg non letti</div>
          </div>
          {/* Aderenza piano */}
          <div style={{background:'#161616',borderRadius:9,padding:'10px 12px',textAlign:'center',border:'0.5px solid #1C1C1C'}}>
            <div style={{fontSize:18,fontWeight:800,color: adherenceWeek ? (adherenceWeek.followed/adherenceWeek.total>=0.7?'#3B6D11':'#D4570A') : '#888780'}}>
              {adherenceWeek ? `${Math.round(adherenceWeek.followed/adherenceWeek.total*100)}%` : '—'}
            </div>
            <div style={{fontSize:9,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>Aderenza pasti</div>
          </div>
          {/* Allenamenti settimana */}
          <div style={{background:'#161616',borderRadius:9,padding:'10px 12px',textAlign:'center',border:'0.5px solid #1C1C1C'}}>
            <div style={{fontSize:18,fontWeight:800,color:'#D4570A'}}>{workoutSessions.filter(s=>{const d=new Date(s.session_date);return(new Date()-d)<7*24*60*60*1000}).length}</div>
            <div style={{fontSize:9,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>Allenamenti/7gg</div>
          </div>
        </div>

        {/* ULTIMO CHECK-IN */}
        {lastCheckin && (
          <div style={{background:'#161616',borderRadius:9,padding:'12px',marginBottom:14}}>
            <div style={{fontSize:10,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>
              Check-in — settimana del {new Date(lastCheckin.week_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}
            </div>
            <div style={{display:'flex',gap:16}}>
              {[{l:'⚡ Energia',v:lastCheckin.energy},{l:'😴 Sonno',v:lastCheckin.sleep},{l:'🧘 Stress',v:lastCheckin.stress}].map(item=>(
                <div key={item.l} style={{flex:1,textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:800,color:item.v>=4?'#3B6D11':item.v<=2?'#D4570A':'#111'}}>{item.v}<span style={{fontSize:10,color:'#CCC'}}>/5</span></div>
                  <div style={{fontSize:9,color:'#CCC',marginTop:2}}>{item.l}</div>
                </div>
              ))}
            </div>
            {lastCheckin.notes && <div style={{fontSize:11,color:'#CCC',marginTop:8,fontStyle:'italic'}}>"{lastCheckin.notes}"</div>}
          </div>
        )}

        {/* ── SEZIONE ALLENAMENTO ── */}
        <div style={{fontSize:12,fontWeight:700,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #FEF0E7',paddingBottom:8}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><i className="ti ti-barbell" style={{fontSize:14}}/>Allenamento</span>
          {activeWorkoutPlan && (
            <a href={`/modifica-allenamento/${activeWorkoutPlan.id}`} style={{...s.btnSm,textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:11}}>
              <i className="ti ti-pencil" style={{fontSize:11}}/>Modifica scheda
            </a>
          )}
          {!activeWorkoutPlan && (
            <a href="/importa-allenamento" onClick={e=>{e.preventDefault();window.history.pushState({},"","/importa-allenamento");window.dispatchEvent(new PopStateEvent("popstate"))}} style={{...s.btnSm,textDecoration:'none',fontSize:11}}>+ Importa scheda</a>
          )}
        </div>

        {/* PROGRESSIONE PESI */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Progressione esercizi</div>
          <div style={{background:'#161616',borderRadius:10,padding:'12px'}}>
            <ProgressioneEsercizi clientId={client.id}/>
          </div>
        </div>

        {/* NOTE ALLENAMENTO */}
        {workoutSessions.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                <i className="ti ti-barbell" style={{fontSize:12,marginRight:4}}/>Allenamenti recenti
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {activeWorkoutPlan && (
                  <a href={`/modifica-allenamento/${activeWorkoutPlan.id}`} style={{...s.btnSm,textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:11}}>
                    <i className="ti ti-pencil" style={{fontSize:11}}/>Modifica scheda
                  </a>
                )}
                {!showAllSessions && allSessionsCount > workoutSessions.length && (
                  <button onClick={loadAllSessions} style={{background:'none',border:'none',color:'#D4570A',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    Vedi tutto ({allSessionsCount}) →
                  </button>
                )}
              </div>
            </div>
            <div style={{maxHeight: 'none', overflowY: 'visible'}}>
              {workoutSessions.map(sess => {
                const pct = sess.sets_total > 0 ? Math.round(sess.sets_completed/sess.sets_total*100) : 0
                // Trova i log di quella sessione
                const sessLogs = workoutLogs.filter(l => l.log_date === sess.session_date)
                const byEx = {}
                sessLogs.forEach(l => { if (!byEx[l.exercise_name]) byEx[l.exercise_name] = []; byEx[l.exercise_name].push(l) })
                return (
                  <div key={sess.id} style={{background:'#161616',borderRadius:8,padding:'10px 12px',marginBottom:6,fontSize:12,color:'#CCC',lineHeight:1.5}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#CCC',marginBottom:6,fontWeight:600}}>
                      <span>{sess.day_label} · {new Date(sess.session_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                      <span style={{color: pct>=100?'#3B6D11':'#D4570A'}}>{sess.sets_completed}/{sess.sets_total} ({pct}%)</span>
                    </div>
                    {Object.entries(byEx).map(([exName, logs]) => {
                      const maxW = Math.max(...logs.map(l=>l.weight_kg||0))
                      return (
                        <div key={exName} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 0',borderBottom:'0.5px solid #1A1A1A'}}>
                          <span style={{color:'#F0F0F0',fontWeight:500}}>{exName}</span>
                          <span style={{color:'#D4570A',fontWeight:700}}>{logs.length} serie {maxW>0?`· max ${maxW}kg`:''}</span>
                        </div>
                      )
                    })}
                    {sess.notes && <div style={{fontSize:11,color:'#CCC',marginTop:6,fontStyle:'italic'}}>{sess.notes}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FOTO RECENTI */}
        {photos.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Foto recenti ({photos.length})</div>
            <div style={{display:'flex',gap:6,overflowX:'auto'}}>
              {photos.map(p => (
                <img key={p.id} src={p.photo_url} alt={p.label} style={{width:60,height:80,objectFit:'cover',borderRadius:8,flexShrink:0}}/>
              ))}
            </div>
          </div>
        )}

        <button style={s.cancelBtn} onClick={onClose}>Chiudi</button>

        {/* MODALE ANAMNESI */}
        {showAnamnesi && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{width:'100%',maxWidth:640,maxHeight:'90vh',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <Anamnesi clientId={client.id} onClose={()=>setShowAnamnesi(false)}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TAB PROGRESSI
// ─────────────────────────────────────────────────────────
function ClientProgress({ client }) {
  const [latest, setLatest] = useState(null)
  const [diaryToday, setDiaryToday] = useState(false)
  const [activePlan, setActivePlan] = useState(null)

  useEffect(() => {
    supabase.from('progress_entries').select('*')
      .eq('client_id', client.id).order('entry_date', {ascending:false}).limit(1)
      .then(({data}) => data?.length && setLatest(data[0]))
    supabase.from('diary_entries').select('id')
      .eq('client_id', client.id).eq('entry_date', today).limit(1)
      .then(({data}) => setDiaryToday(data?.length > 0))
    supabase.from('meal_plans').select('title,kcal_target')
      .eq('client_id', client.id).eq('is_active', true).limit(1)
      .then(({data}) => data?.length && setActivePlan(data[0]))
  }, [client.id])

  const ini = client.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'U'

  return (
    <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:'white',flexShrink:0}}>{ini}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:500,color:'#F0F0F0'}}>{client.full_name}</div>
          <div style={{fontSize:11,color:'#CCC'}}>{goalLabel[client.goal] || client.goal || 'Obiettivo non impostato'}</div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <div style={{fontSize:10,fontWeight:500,padding:'3px 8px',borderRadius:20,background:diaryToday?'#EAF3DE':'#FEE2E2',color:diaryToday?'#3B6D11':'#E24B4A'}}>
            {diaryToday ? '✓ Diario' : '✗ Diario'}
          </div>
          <div style={{fontSize:10,fontWeight:500,padding:'3px 8px',borderRadius:20,background:activePlan?'#FEF0E7':'#F5F3EF',color:activePlan?'#D4570A':'#888780'}}>
            {activePlan ? '📋 Piano attivo' : 'Nessun piano'}
          </div>
        </div>
      </div>
      {latest ? (
        <div style={{display:'flex',gap:16,padding:'10px 0',borderTop:'0.5px solid #F5F3EF',flexWrap:'wrap'}}>
          {[
            {l:'Peso',v:latest.weight_kg?`${latest.weight_kg}kg`:'—'},
            {l:'Vita',v:latest.waist_cm?`${latest.waist_cm}cm`:'—'},
            {l:'% Grasso',v:latest.body_fat_pct?`${latest.body_fat_pct}%`:'—'},
          ].map(m=>(
            <div key={m.l} style={{textAlign:'center'}}>
              <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0'}}>{m.v}</div>
              <div style={{fontSize:10,color:'#CCC'}}>{m.l}</div>
            </div>
          ))}
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontSize:10,color:'#CCC'}}>Ultima misurazione</div>
            <div style={{fontSize:11,color:'#F0F0F0'}}>{new Date(latest.entry_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>
          </div>
        </div>
      ) : (
        <div style={{fontSize:11,color:'#CCC',paddingTop:8,borderTop:'0.5px solid #F5F3EF'}}>
          Nessuna misurazione ancora registrata
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TAB CALENDARIO — gestione prenotazioni chiamate
// ─────────────────────────────────────────────────────────
const AVAIL_ADMIN = {
  1: { start:'09:00', end:'12:00' },
  2: { start:'15:00', end:'18:30' },
  3: { start:'09:00', end:'12:00' },
  4: { start:'15:00', end:'18:30' },
  5: { start:'09:00', end:'12:00' },
}
const DAY_NAMES_ADMIN = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

function genSlotsAdmin(dow) {
  const avail = AVAIL_ADMIN[dow]
  if (!avail) return []
  const slots = []
  let [h,m] = avail.start.split(':').map(Number)
  const [eh,em] = avail.end.split(':').map(Number)
  while (h < eh || (h===eh && m < em)) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
    m += 30
    if (m>=60) { m-=60; h+=1 }
  }
  return slots
}

function CalendarioAdmin() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { fetchBookings() }, [])

  async function fetchBookings() {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('call_bookings')
      .select('*, profiles(full_name)')
      .gte('booking_date', todayStr)
      .order('booking_date', {ascending:true}).order('time_slot', {ascending:true})
    setBookings(data || [])
    setLoading(false)
  }

  async function cancelBooking(id) {
    if (!confirm('Eliminare questa prenotazione?')) return
    await supabase.from('call_bookings').delete().eq('id', id)
    fetchBookings()
  }

  async function toggleBlock(date, slot) {
    const existing = bookings.find(b => b.booking_date===date && b.time_slot===slot && b.status==='blocked')
    if (existing) {
      await supabase.from('call_bookings').delete().eq('id', existing.id)
    } else {
      await supabase.from('call_bookings').insert({ client_id:null, booking_date:date, time_slot:slot, status:'blocked' })
    }
    fetchBookings()
  }

  // Prossime 3 settimane di giorni disponibili
  const upcomingDates = []
  const now = new Date()
  for (let i=0;i<21;i++) {
    const d = new Date(now)
    d.setDate(now.getDate()+i)
    if (AVAIL_ADMIN[d.getDay()]) upcomingDates.push(d)
  }

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed')

  return (
    <>
      {/* PRENOTAZIONI CONFERMATE */}
      <div style={s.card}>
        <div style={s.cardTitle}><i className="ti ti-calendar-event" style={{fontSize:16,color:'#D4570A'}}/> Prenotazioni ({confirmedBookings.length})</div>
        {loading ? (
          <div style={{textAlign:'center',padding:'20px 0',color:'#CCC',fontSize:13}}>Caricamento...</div>
        ) : confirmedBookings.length === 0 ? (
          <div style={{textAlign:'center',padding:'30px 0',fontSize:13,color:'#CCC'}}>Nessuna chiamata prenotata.</div>
        ) : (
          <table style={s.table}>
            <thead><tr><th style={s.th}>Cliente</th><th style={s.th}>Data</th><th style={s.th}>Ora</th><th style={s.th}>Azioni</th></tr></thead>
            <tbody>{confirmedBookings.map(b=>(
              <tr key={b.id}>
                <td style={s.td}><div style={{display:'flex',alignItems:'center'}}><div style={{...s.avatar,width:24,height:24,fontSize:10,marginRight:6}}>{initials(b.profiles?.full_name||'')}</div><span style={{fontSize:12}}>{b.profiles?.full_name||'—'}</span></div></td>
                <td style={s.td}>{new Date(b.booking_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}</td>
                <td style={s.td}><span style={{fontWeight:600}}>{b.time_slot}</span></td>
                <td style={s.td}><button style={{...s.btnGray,color:'#E24B4A'}} onClick={()=>cancelBooking(b.id)}><i className="ti ti-trash" style={{fontSize:13}}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* GESTIONE DISPONIBILITÀ */}
      <div style={s.card}>
        <div style={s.cardTitle}><i className="ti ti-calendar-cog" style={{fontSize:16,color:'#D4570A'}}/> Gestisci disponibilità</div>
        <div style={{fontSize:12,color:'#CCC',marginBottom:14}}>
          Clicca su uno slot per segnarlo come "occupato" — non sarà visibile ai clienti come disponibile. Utile per simulare un'agenda piena o bloccare orari per impegni personali.
        </div>

        {upcomingDates.map(date => {
          const dateKey = date.toISOString().split('T')[0]
          const slots = genSlotsAdmin(date.getDay())
          const isSelected = selectedDate === dateKey
          return (
            <div key={dateKey} style={{marginBottom:8}}>
              <button
                onClick={()=>setSelectedDate(isSelected?null:dateKey)}
                style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:8,border:'0.5px solid #1C1C1C',background:isSelected?'#D4570A':'#F5F3EF',color:isSelected?'white':'#111',fontFamily:'inherit',fontSize:13,fontWeight:500,cursor:'pointer'}}>
                <span>{DAY_NAMES_ADMIN[date.getDay()]} {date.getDate()}/{date.getMonth()+1}</span>
                <span style={{fontSize:11}}>{isSelected?'▲':'▼'}</span>
              </button>
              {isSelected && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginTop:8}}>
                  {slots.map(slot => {
                    const booked = bookings.find(b=>b.booking_date===dateKey && b.time_slot===slot && b.status==='confirmed')
                    const blocked = bookings.find(b=>b.booking_date===dateKey && b.time_slot===slot && b.status==='blocked')
                    return (
                      <button
                        key={slot}
                        disabled={!!booked}
                        onClick={()=>toggleBlock(dateKey, slot)}
                        style={{
                          padding:'8px',borderRadius:7,border:'0.5px solid',fontSize:12,fontWeight:600,fontFamily:'inherit',
                          cursor:booked?'not-allowed':'pointer',
                          background: booked?'rgba(212,87,10,0.15)':blocked?'rgba(226,75,74,0.12)':'rgba(59,140,90,0.12)',
                          color: booked?'#D4570A':blocked?'#888780':'#3B6D11',
                          borderColor: booked?'#D4570A':blocked?'#E0DDD6':'#3B6D11',
                        }}>
                        {slot}{booked?' 📞':blocked?' 🚫':''}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <div style={{display:'flex',gap:16,marginTop:14,fontSize:11,color:'#CCC'}}>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'rgba(59,109,17,0.1)',marginRight:4,verticalAlign:'middle'}}/>Libero</div>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#161616',marginRight:4,verticalAlign:'middle'}}/>Bloccato (clicca per liberare)</div>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'rgba(212,87,10,0.1)',marginRight:4,verticalAlign:'middle'}}/>Prenotato</div>
        </div>
      </div>
    </>
  )
}

// ── DASHBOARD COACH ──────────────────────────────────────────
function DashboardCoach({ clients, clientStats, plans, onOpenClient, onOpenReport, onOpenAnamnesi }) {
  const today = new Date().toISOString().split('T')[0]
  const ALERT = '#D4570A'
  const OK = '#3B6D11'

  // Metriche aggregate
  const totalClients = clients.length
  const trainedToday = clients.filter(c => clientStats[c.id]?.sessions7?.some(s => s.session_date === today)).length
  const diaryToday = clients.filter(c => clientStats[c.id]?.diaryToday).length
  const newReports = clients.filter(c => clientStats[c.id]?.newReport)
  const newAnamnesi = clients.filter(c => clientStats[c.id]?.newAnamnesi)
  const totalUnread = clients.reduce((sum,c) => sum + (clientStats[c.id]?.unreadMessages||0), 0)
  const withPlan = clients.filter(c => clientStats[c.id]?.activePlan).length
  const pianoNonAttivo = clients.filter(c => clientStats[c.id]?.inactivePlan).length
  const noPlan = totalClients - withPlan - pianoNonAttivo
  const inScadenza = clients.filter(c => {
    if (!c.subscription_end) return false
    const days = Math.ceil((new Date(c.subscription_end) - new Date()) / (1000*60*60*24))
    return days >= 0 && days <= 7
  })
  const scaduti = clients.filter(c => c.subscription_end && c.subscription_end < new Date().toISOString().split('T')[0])
  const inactiveToday = clients.filter(c => {
    const st = clientStats[c.id]
    return st && !st.diaryToday && !st.sessions7?.length
  })

  return (
    <div>
      {/* STATS CARD ROW */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
        <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'16px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:'rgba(74,144,212,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className="ti ti-users" style={{fontSize:20,color:'#4A90D4'}}/>
          </div>
          <div>
            <div style={{fontSize:26,fontWeight:800,color:'#4A90D4',lineHeight:1}}>{totalClients}</div>
            <div style={{fontSize:11,color:'#CCC',marginTop:3}}>Clienti totali</div>
          </div>
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontSize:12,fontWeight:600,color:OK}}>{withPlan} con piano</div>
            {noPlan > 0 && <div style={{fontSize:11,color:ALERT}}>{noPlan} senza piano</div>}
            {pianoNonAttivo > 0 && <div style={{fontSize:11,color:'#F5B041'}}>{pianoNonAttivo} con piano non attivo</div>}
          </div>
        </div>

        <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'16px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className="ti ti-barbell" style={{fontSize:20,color:ALERT}}/>
          </div>
          <div>
            <div style={{fontSize:26,fontWeight:800,color:ALERT,lineHeight:1}}>{trainedToday}</div>
            <div style={{fontSize:11,color:'#CCC',marginTop:3}}>Allenati oggi</div>
          </div>
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontSize:12,fontWeight:600,color:OK}}>{diaryToday} diario ok</div>
            {inactiveToday.length > 0 && <div style={{fontSize:11,color:'#CCC'}}>{inactiveToday.length} inattivi</div>}
          </div>
        </div>
      </div>

      {/* ALERT ABBONAMENTI */}
      {(scaduti.length > 0 || inScadenza.length > 0) && (
        <div style={{background:'rgba(212,87,10,0.1)',border:'0.5px solid #D4570A',borderRadius:12,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
            <i className="ti ti-credit-card" style={{fontSize:14}}/>
            {scaduti.length>0&&`${scaduti.length} abbonamento${scaduti.length>1?'i':''} scaduto${scaduti.length>1?'i':''}`}
            {scaduti.length>0&&inScadenza.length>0&&' · '}
            {inScadenza.length>0&&`${inScadenza.length} in scadenza entro 7 giorni`}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {[...scaduti,...inScadenza].map(c=>(
              <div key={c.id} onClick={()=>onOpenClient(c)} style={{background:'#0D0D0D',borderRadius:8,padding:'5px 10px',fontSize:12,fontWeight:600,color:'#F0F0F0',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                {c.full_name?.split(' ')[0]}
                <span style={{fontSize:10,color:'#D4570A'}}>{c.subscription_end&&Math.ceil((new Date(c.subscription_end)-new Date())/(1000*60*60*24))<0?'Scaduto':'⚠'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NUOVI REPORT ALLENAMENTO */}
      {newReports.length > 0 && (
        <div style={{background:'#EDE9FE',border:'0.5px solid #7C3AED',borderRadius:12,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#7C3AED',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
            <i className="ti ti-clipboard-list" style={{fontSize:14}}/>
            {newReports.length} nuovo{newReports.length>1?'i':''} report allenamento
          </div>
          {newReports.map(c=>(
            <div key={c.id} onClick={()=>onOpenReport(c)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:'#0D0D0D',borderRadius:9,marginBottom:6,cursor:'pointer',border:'0.5px solid #C4B5FD'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'#7C3AED',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                {c.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{c.full_name}</div>
              <span style={{fontSize:10,background:'#7C3AED',color:'white',padding:'2px 8px',borderRadius:8,fontWeight:600}}>Apri</span>
              <i className="ti ti-chevron-right" style={{fontSize:13,color:'#7C3AED'}}/>
            </div>
          ))}
        </div>
      )}

      {/* NUOVE ANAMNESI */}
      {newAnamnesi.length > 0 && (
        <div style={{background:'rgba(59,109,17,0.1)',border:'0.5px solid #3B6D11',borderRadius:12,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#3B6D11',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
            <i className="ti ti-clipboard-heart" style={{fontSize:14}}/>
            {newAnamnesi.length} nuova{newAnamnesi.length>1?'e':''} anamnesi compilata{newAnamnesi.length>1?'e':''}
          </div>
          {newAnamnesi.map(c=>(
            <div key={c.id} onClick={()=>onOpenAnamnesi(c)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:'#0D0D0D',borderRadius:9,marginBottom:6,cursor:'pointer',border:'0.5px solid #A7D9A0'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'#3B6D11',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                {c.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{c.full_name}</div>
              <span style={{fontSize:10,background:'#3B6D11',color:'white',padding:'2px 8px',borderRadius:8,fontWeight:600}}>Apri</span>
              <i className="ti ti-chevron-right" style={{fontSize:13,color:'#3B6D11'}}/>
            </div>
          ))}
        </div>
      )}

      {/* MESSAGGI NON LETTI */}
      {totalUnread > 0 && (
        <div style={{background:'rgba(212,87,10,0.1)',border:'0.5px solid #D4570A',borderRadius:12,padding:'14px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <i className="ti ti-message-2" style={{fontSize:15,color:ALERT}}/>
            <div style={{fontSize:13,fontWeight:700,color:ALERT}}>Messaggi non letti ({totalUnread})</div>
          </div>
          {clients.filter(c=>clientStats[c.id]?.unreadMessages>0).map(c=>(
            <div key={c.id} onClick={()=>onOpenClient(c)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'#0D0D0D',borderRadius:9,marginBottom:6,cursor:'pointer',border:'0.5px solid #F4C9A8'}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                {c.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,fontSize:13,fontWeight:600,color:'#F0F0F0'}}>{c.full_name}</div>
              <div style={{background:'#D4570A',color:'white',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:10}}>
                {clientStats[c.id].unreadMessages} nuovi
              </div>
              <i className="ti ti-chevron-right" style={{fontSize:14,color:'#D4570A'}}/>
            </div>
          ))}
        </div>
      )}

      {/* INATTIVI OGGI */}
      {inactiveToday.length > 0 && (
        <div style={{background:'#0D0D0D',border:'0.5px solid #1C1C1C',borderRadius:12,padding:'14px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <i className="ti ti-alert-circle" style={{fontSize:15,color:'#CCC'}}/>
            <div style={{fontSize:13,fontWeight:700,color:'#CCC'}}>Inattivi oggi ({inactiveToday.length})</div>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {inactiveToday.map(c=>(
              <div key={c.id} onClick={()=>onOpenClient(c)}
                style={{display:'flex',alignItems:'center',gap:6,background:'#161616',borderRadius:20,padding:'5px 12px 5px 6px',cursor:'pointer'}}>
                <div style={{width:22,height:22,borderRadius:'50%',background:'#E0DDD6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#CCC'}}>
                  {c.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <span style={{fontSize:12,color:'#CCC',fontWeight:500}}>{c.full_name?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA CLIENTI CON STATO */}
      <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:600}}>
        Stato clienti oggi
      </div>
      {clients.map(c => {
        const st = clientStats[c.id] || {}
        const sessions7 = st.sessions7?.length || 0
        const checkin = st.lastCheckin
        const adh = st.adherence
        const pct = adh ? Math.round(adh.followed/adh.total*100) : null

        return (
          <div key={c.id} onClick={()=>onOpenClient(c)}
            style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'12px 14px',marginBottom:8,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'box-shadow 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,0.08)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
          >
            {/* Avatar */}
            <div style={{width:40,height:40,borderRadius:11,background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
              {c.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.full_name}</div>
              <div style={{fontSize:11,color:'#CCC',marginTop:2}}>
                {st.latestMeasure?.weight_kg ? `${st.latestMeasure.weight_kg}kg · ` : ''}
                {st.activePlan ? st.activePlan.title : 'Nessun piano'}
              </div>
            </div>

            {/* Indicatori */}
            <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
              {/* Diario */}
              <div title={st.diaryToday?'Diario compilato':'Diario non fatto'}
                style={{width:28,height:28,borderRadius:8,background:st.diaryToday?'#EAF3DE':'#FEE2E2',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <i className="ti ti-pencil" style={{fontSize:13,color:st.diaryToday?OK:'#E24B4A'}}/>
              </div>
              {/* Allenamento */}
              <div title={`${sessions7} allenamenti questa settimana`}
                style={{width:28,height:28,borderRadius:8,background:sessions7>0?'rgba(59,140,90,0.15)':'#161616',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <i className="ti ti-barbell" style={{fontSize:13,color:sessions7>0?OK:'#E0DDD6'}}/>
              </div>
              {/* Aderenza */}
              {pct !== null && (
                <div title={`Aderenza piano: ${pct}%`}
                  style={{height:28,minWidth:28,borderRadius:8,background:pct>=70?'#EAF3DE':'#FEF0E7',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 6px'}}>
                  <span style={{fontSize:11,fontWeight:700,color:pct>=70?OK:ALERT}}>{pct}%</span>
                </div>
              )}
              {/* Messaggi non letti */}
              {st.unreadMessages > 0 && (
                <div style={{width:28,height:28,borderRadius:8,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:10,fontWeight:700,color:ALERT}}>{st.unreadMessages}</span>
                </div>
              )}
              {/* Nuovo report */}
              {st.newReport && (
                <div title="Nuovo report allenamento" style={{width:28,height:28,borderRadius:8,background:'#EDE9FE',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className="ti ti-clipboard-list" style={{fontSize:12,color:'#7C3AED'}}/>
                </div>
              )}
              {/* Check-in energia */}
              {checkin && (
                <div title={`Energia: ${checkin.energy}/5 · Sonno: ${checkin.sleep}/5 · Stress: ${checkin.stress}/5`}
                  style={{width:28,height:28,borderRadius:8,background:'#161616',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:11,fontWeight:700,color:checkin.energy>=4?OK:checkin.energy<=2?ALERT:'#888780'}}>{checkin.energy}⚡</span>
                </div>
              )}
            </div>
            <i className="ti ti-chevron-right" style={{fontSize:14,color:'#E0DDD6',flexShrink:0}}/>
          </div>
        )
      })}
    </div>
  )
}


// ── COMPONENTE MESSAGGI ADMIN (CHAT) ──────────────────────────────
function MessaggiAdmin() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [allReportResult, setAllReportResult] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})
  const bottomRef = useRef(null)
  const channelRef2 = useRef(null)

  async function generateAllReports() {
    if (!window.confirm(`Generare il report mensile per tutti i ${clients.length} clienti? L'operazione richiede circa 1 minuto.`)) return
    setGeneratingAll(true)
    setAllReportResult(null)
    let success = 0, skipped = 0, errors = 0
    for (const client of clients) {
      try {
        const r = await fetch('/api/monthly-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: client.id, autoGenerated: true })
        })
        const data = await r.json()
        if (data.content) success++
        else skipped++
      } catch(e) { errors++ }
      await new Promise(r => setTimeout(r, 1500))
    }
    setAllReportResult({ success, skipped, errors })
    setGeneratingAll(false)
  }

  const channelRef = useRef(null)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name').then(({data}) => {
      setClients(data||[])
    })
    fetchUnread()
  }, [])

  useEffect(() => {
    if (!selectedClient) return

    fetchMessages(selectedClient.id)

    // Rimuovi canale precedente
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    // Supabase Realtime per questo cliente
    const channel = supabase
      .channel(`admin_messages_${selectedClient.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'coach_messages',
        filter: `client_id=eq.${selectedClient.id}`,
      }, (payload) => {
        const newMsg = payload.new
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        // Segna come letto se è del cliente
        if (newMsg.sender_role === 'client') {
          supabase.from('coach_messages').update({ is_read: true }).eq('id', newMsg.id)
          fetchUnread()
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [selectedClient])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchUnread() {
    const { data } = await supabase.from('coach_messages')
      .select('client_id').eq('sender_role','client').eq('is_read',false)
    const counts = {}
    data?.forEach(m => { counts[m.client_id] = (counts[m.client_id]||0)+1 })
    setUnreadCounts(counts)
  }

  async function fetchMessages(clientId) {
    const { data } = await supabase.from('coach_messages')
      .select('*').eq('client_id', clientId).order('created_at', {ascending:true})
    setMessages(data||[])
    // Segna come letti i messaggi del cliente
    await supabase.from('coach_messages').update({is_read:true})
      .eq('client_id', clientId).eq('sender_role','client').eq('is_read',false)
    fetchUnread()
  }

  async function send() {
    if (!text.trim() || !selectedClient || sending) return
    setSending(true)
    const msg = text.trim()
    setText('')
    setMessages(prev => [...prev, {
      id: 'tmp-'+Date.now(), message: msg,
      sender_role: 'coach', created_at: new Date().toISOString()
    }])
    await fetch('/api/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clientId: selectedClient.id, coachId: profile.id, message: msg, senderRole: 'coach' })
    })
    fetchMessages(selectedClient.id)
    setSending(false)
  }

  async function generateReport() {
    if (!selectedClient) return
    setGeneratingReport(true)
    try {
      const r = await fetch('/api/monthly-report', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ clientId: selectedClient.id })
      })
      const data = await r.json()
      if (data.content) setText(data.content)
    } catch(e) { alert('Errore: '+e.message) }
    setGeneratingReport(false)
  }

  const grouped = {}
  messages.forEach(m => {
    const date = m.created_at.split('T')[0]
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(m)
  })

  const s2 = {
    clientBtn: { width:'100%', padding:'10px 14px', background:'#0D0D0D', border:'0.5px solid #1C1C1C', borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:10, marginBottom:6 },
    clientBtnActive: { width:'100%', padding:'10px 14px', background:'rgba(212,87,10,0.1)', border:'0.5px solid #D4570A', borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:10, marginBottom:6 },
  }

  return (
    <div style={{display:'flex',height:'calc(100dvh - 120px)',gap:0}}>
      {/* LISTA CLIENTI */}
      <div style={{width:200,borderRight:'0.5px solid #1A1A1A',overflowY:'auto',padding:14,flexShrink:0}}>
        <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Conversazioni</div>

        {/* BOTTONE GENERA REPORT PER TUTTI */}
        <button onClick={generateAllReports} disabled={generatingAll || clients.length === 0} style={{
          width:'100%', padding:'9px 10px', marginBottom:12,
          background: generatingAll ? '#161616' : 'rgba(212,87,10,0.12)',
          color: generatingAll ? '#888780' : '#D4570A',
          border:'0.5px solid #D4570A', borderRadius:9,
          fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', justifyContent:'center', gap:5
        }}>
          {generatingAll
            ? <><div style={{width:12,height:12,border:'2px solid #D4570A',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> Generando report...</>
            : <><i className="ti ti-sparkles" style={{fontSize:13}}/>Report mensili per tutti</>
          }
        </button>

        {/* RISULTATO GENERAZIONE */}
        {allReportResult && (
          <div style={{background:'rgba(59,109,17,0.1)',borderRadius:8,padding:'8px 10px',marginBottom:10,fontSize:11,color:'#3B6D11',lineHeight:1.6}}>
            ✓ {allReportResult.success} generati
            {allReportResult.skipped > 0 && ` · ${allReportResult.skipped} saltati`}
            {allReportResult.errors > 0 && ` · ${allReportResult.errors} errori`}
          </div>
        )}
        {clients.map(c => (
          <button key={c.id} onClick={()=>setSelectedClient(c)} style={selectedClient?.id===c.id?s2.clientBtnActive:s2.clientBtn}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
              {c.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.full_name}</div>
            </div>
            {unreadCounts[c.id] > 0 && (
              <div style={{width:18,height:18,borderRadius:'50%',background:'#D4570A',fontSize:10,fontWeight:700,color:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {unreadCounts[c.id]}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* CHAT */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {!selectedClient ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#CCC',fontSize:13}}>
            Seleziona un cliente per aprire la chat
          </div>
        ) : (
          <>
            {/* Header chat */}
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #1A1A1A',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#0D0D0D'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>{selectedClient.full_name}</div>
              <button onClick={generateReport} disabled={generatingReport} style={{padding:'6px 12px',background:'rgba(212,87,10,0.1)',color:'#D4570A',border:'0.5px solid #D4570A',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
                <i className="ti ti-sparkles" style={{fontSize:13}}/>{generatingReport?'Generando...':'+Report AI'}
              </button>
            </div>

            {/* Messaggi */}
            <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
              {Object.entries(grouped).map(([date, msgs]) => (
                <div key={date}>
                  <div style={{textAlign:'center',margin:'10px 0',fontSize:11,color:'#CCC'}}>
                    {date === new Date().toISOString().split('T')[0] ? 'Oggi' : new Date(date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})}
                  </div>
                  {msgs.map(m => {
                    const isCoach = m.sender_role === 'coach'
                    return (
                      <div key={m.id} style={{display:'flex',justifyContent:isCoach?'flex-end':'flex-start',marginBottom:6}}>
                        <div style={{
                          maxWidth:'70%',padding:'9px 13px',
                          borderRadius:isCoach?'16px 16px 4px 16px':'16px 16px 16px 4px',
                          background:isCoach?'#D4570A':'#F5F3EF',
                          color:isCoach?'white':'#111',
                        }}>
                          <div style={{fontSize:12,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{m.message}</div>
                          <div style={{fontSize:10,marginTop:3,textAlign:'right',opacity:0.7}}>
                            {new Date(m.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
                            {isCoach && <span style={{marginLeft:3}}>{m.is_read?'✓✓':'✓'}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{padding:'10px 16px',borderTop:'0.5px solid #1A1A1A',display:'flex',gap:8,background:'#0D0D0D'}}>
              <textarea value={text} onChange={e=>setText(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
                placeholder="Scrivi un messaggio..." rows={1}
                style={{flex:1,padding:'9px 14px',border:'0.5px solid #1C1C1C',borderRadius:20,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',resize:'none',maxHeight:80,overflowY:'auto'}}/>
              <button onClick={send} disabled={!text.trim()||sending} style={{width:38,height:38,borderRadius:'50%',background:text.trim()?'#D4570A':'#E0DDD6',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className="ti ti-send" style={{fontSize:16,color:'white'}}/>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── COMPONENTE CHECK-IN ADMIN ──────────────────────────────
function ScoreBar({v, max=5, inv=false}) {
  const pct = Math.min(100, Math.round((v/max)*100))
  const col = inv ? (v<=2?'#3B6D11':v<=3?'#E8A020':'#E24B4A') : (v>=4?'#3B6D11':v>=3?'#E8A020':'#E24B4A')
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{flex:1,height:5,background:'#141414',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:5,width:`${pct}%`,background:col,borderRadius:3}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:col,minWidth:16,textAlign:'right'}}>{v}</span>
    </div>
  )
}

function CheckinAdmin() {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [clientProfile, setClientProfile] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [photos, setPhotos] = useState([])
  const [sessions, setSessions] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [expandedCheckin, setExpandedCheckin] = useState(null)
  const [isMobile] = useState(window.innerWidth < 900)

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,goal').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  useEffect(() => {
    if (!selectedClient) return
    setLoading(true)
    const from = new Date(Date.now() - 90*86400000).toISOString().split('T')[0]
    Promise.all([
      supabase.from('profiles').select('*').eq('id',selectedClient).single(),
      supabase.from('weekly_checkins').select('*').eq('client_id',selectedClient).order('week_date',{ascending:false}).limit(12),
      supabase.from('progress_photos').select('*').eq('client_id',selectedClient).order('photo_date',{ascending:false}).limit(24),
      supabase.from('workout_sessions').select('*').eq('client_id',selectedClient).order('session_date',{ascending:false}).limit(20),
      supabase.from('progress_entries').select('*').eq('client_id',selectedClient).order('entry_date',{ascending:false}).limit(16),
      supabase.from('workout_logs').select('*').eq('client_id',selectedClient).gte('log_date',from).order('log_date',{ascending:false}),
    ]).then(([profR, chkR, photoR, sessR, measR, logsR]) => {
      setClientProfile(profR.data)
      setCheckins(chkR.data||[])
      setPhotos(photoR.data||[])
      setSessions(sessR.data||[])
      setMeasurements(measR.data||[])
      setLogs(logsR.data||[])
      setLoading(false)
    })
  }, [selectedClient])

  function scoreColor(v, inv=false) {
    if (!v) return '#888780'
    if (inv) return v<=2?'#3B6D11':v<=3?'#E8A020':'#E24B4A'
    return v>=4?'#3B6D11':v>=3?'#E8A020':'#E24B4A'
  }

  const latest = measurements[0]
  const prev = measurements[1]
  const weightDiff = latest?.weight_kg && prev?.weight_kg
    ? Math.round((latest.weight_kg - prev.weight_kg)*10)/10 : null

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>

      {/* SELEZIONE CLIENTE */}
      <div style={{padding:'12px 16px',borderBottom:'0.5px solid #1A1A1A',background:'#0D0D0D',flexShrink:0}}>
        <select value={selectedClient} onChange={e=>{setSelectedClient(e.target.value);setExpandedCheckin(null);setExpandedSession(null)}}
          style={{width:'100%',padding:'10px 12px',border:'0.5px solid #1C1C1C',borderRadius:10,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',fontWeight:selectedClient?600:400}}>
          <option value="">👤 Seleziona cliente...</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {/* STATO VUOTO */}
      {!selectedClient && (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#CCC',gap:10}}>
          <i className="ti ti-activity" style={{fontSize:48,opacity:0.2}}/>
          <div style={{fontSize:13}}>Seleziona un cliente per vedere il suo riepilogo completo</div>
        </div>
      )}

      {selectedClient && loading && (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#CCC',fontSize:13}}>
          Caricamento...
        </div>
      )}

      {selectedClient && !loading && (
        <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'14px'}}>

          {/* HEADER CLIENTE */}
          <div style={{background:'linear-gradient(135deg,#1a0a00,#2d1200)',borderRadius:12,padding:'14px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:'#D4570A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:800,color:'white',flexShrink:0}}>
              {clientProfile?.full_name?.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:800,color:'white'}}>{clientProfile?.full_name}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>
                {checkins.length} check-in · {sessions.length} sessioni · {photos.length} foto
              </div>
            </div>
            {latest?.weight_kg && (
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:900,color:'#F4894A'}}>{latest.weight_kg}kg</div>
                {weightDiff!==null && <div style={{fontSize:11,color:weightDiff<0?'#3B6D11':'#E24B4A',fontWeight:600}}>{weightDiff>0?'+':''}{weightDiff}kg</div>}
              </div>
            )}
          </div>

          {/* KPI RAPIDI */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            {[
              {l:'Peso',v:latest?.weight_kg?`${latest.weight_kg}kg`:'—',c:latest?.weight_kg?'#111':'#C0BDB8'},
              {l:'Check-in',v:checkins.length,c:'#4A90D4'},
              {l:'Sessioni',v:sessions.length,c:'#D4570A'},
              {l:'Foto',v:photos.length,c:'#9B59B6'},
            ].map(st=>(
              <div key={st.l} style={{background:'#0D0D0D',borderRadius:10,border:'0.5px solid #1C1C1C',padding:'10px 6px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,color:st.c,lineHeight:1}}>{st.v}</div>
                <div style={{fontSize:9,color:'#AAA',textTransform:'uppercase',marginTop:2}}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* GRAFICO PESO */}
          {measurements.length > 1 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>⚖️ Andamento peso</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:3,height:60}}>
                {measurements.slice(0,12).reverse().map((m,i,arr)=>{
                  const vals = arr.map(x=>x.weight_kg)
                  const min = Math.min(...vals), max = Math.max(...vals)
                  const range = max-min || 1
                  const pct = Math.round((m.weight_kg-min)/range*80)+10
                  const isLast = i===arr.length-1
                  return (
                    <div key={m.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                      <div style={{width:'100%',background:isLast?'#D4570A':'#E0DDD6',borderRadius:'3px 3px 0 0',height:`${pct}%`,minHeight:4,transition:'height 0.3s'}}/>
                      <div style={{fontSize:7,color:isLast?'#D4570A':'#B0ADA8',fontWeight:isLast?700:400}}>{m.weight_kg}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#AAA',marginTop:4}}>
                <span>{new Date(measurements.slice(0,12).reverse()[0]?.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                <span>{new Date(measurements[0]?.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
              </div>
            </div>
          )}

          {/* FOTO */}
          {photos.length > 0 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>📷 Foto progressi</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {photos.map(p=>(
                  <div key={p.id} onClick={()=>setLightbox(p)}
                    style={{position:'relative',cursor:'pointer',borderRadius:9,overflow:'hidden',aspectRatio:'3/4',background:'#141414'}}>
                    <img loading="lazy" src={p.photo_url} alt={p.label} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.7))',padding:'10px 5px 4px'}}>
                      <div style={{fontSize:8,color:'white',fontWeight:600,textTransform:'uppercase'}}>{p.label}</div>
                      {p.photo_date&&<div style={{fontSize:7,color:'rgba(255,255,255,0.6)'}}>{new Date(p.photo_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>}
                    </div>
                    <div style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.4)',borderRadius:5,padding:'2px 4px'}}>
                      <i className="ti ti-zoom-in" style={{fontSize:9,color:'white'}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHECK-IN SETTIMANALI */}
          {checkins.length > 0 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>✅ Check-in settimanali</div>
              {checkins.map(ck=>{
                const isExp = expandedCheckin===ck.id
                const dateLabel = new Date(ck.week_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
                return (
                  <div key={ck.id} style={{borderRadius:10,border:'0.5px solid #1C1C1C',marginBottom:8,overflow:'hidden'}}>
                    {/* HEADER */}
                    <div onClick={()=>setExpandedCheckin(isExp?null:ck.id)}
                      style={{padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:'#0D0D0D'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0'}}>Settimana {dateLabel}</div>
                        <div style={{fontSize:10,color:'#CCC',marginTop:2,display:'flex',gap:10}}>
                          {ck.energy_level!=null&&<span>⚡{ck.energy_level}/5</span>}
                          {ck.sleep_quality!=null&&<span>😴{ck.sleep_quality}/5</span>}
                          {ck.stress_level!=null&&<span>🧠{ck.stress_level}/5</span>}
                          {ck.motivation_level!=null&&<span>🔥{ck.motivation_level}/5</span>}
                          {ck.weight_kg&&<span style={{color:'#D4570A',fontWeight:600}}>⚖️{ck.weight_kg}kg</span>}
                        </div>
                      </div>
                      <i className={`ti ti-chevron-${isExp?'up':'down'}`} style={{fontSize:13,color:'#CCC',flexShrink:0}}/>
                    </div>

                    {/* DETTAGLIO */}
                    {isExp && (
                      <div style={{padding:'12px',borderTop:'0.5px solid #F0EDE8',background:'#FAFAF9'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:ck.notes?10:0}}>
                          {[
                            {l:'⚡ Energia',v:ck.energy_level,max:5},
                            {l:'😴 Sonno',v:ck.sleep_quality,max:5},
                            {l:'🧠 Stress',v:ck.stress_level,max:5,inv:true},
                            {l:'🔥 Motivazione',v:ck.motivation_level,max:5},
                          ].filter(x=>x.v!=null).map(item=>(
                            <div key={item.l}>
                              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                                <span style={{color:'#CCC'}}>{item.l}</span>
                                <span style={{fontWeight:700,color:scoreColor(item.v,item.inv)}}>{item.v}/{item.max}</span>
                              </div>
                              <ScoreBar v={item.v} max={item.max} inv={item.inv}/>
                            </div>
                          ))}
                        </div>
                        {ck.weight_kg && (
                          <div style={{background:'rgba(212,87,10,0.1)',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:ck.notes?8:0}}>
                            <span style={{color:'#CCC'}}>Peso dichiarato: </span>
                            <span style={{fontWeight:700,color:'#D4570A'}}>{ck.weight_kg}kg</span>
                          </div>
                        )}
                        {ck.notes && (
                          <div style={{background:'#161616',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#CCC',lineHeight:1.6,fontStyle:'italic'}}>
                            "{ck.notes}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ALLENAMENTI */}
          {sessions.length > 0 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>🏋️ Allenamenti recenti</div>
              {sessions.map(sess=>{
                const isExp = expandedSession===sess.id
                const pct = sess.sets_total>0?Math.round(sess.sets_completed/sess.sets_total*100):0
                const sessLogs = logs.filter(l=>l.log_date===sess.session_date)
                const byEx = {}
                sessLogs.forEach(l=>{ if(!byEx[l.exercise_name]) byEx[l.exercise_name]=[]; byEx[l.exercise_name].push(l) })
                const dateLabel = new Date(sess.session_date+'T12:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})

                return (
                  <div key={sess.id} style={{borderRadius:10,border:'0.5px solid #1C1C1C',marginBottom:8,overflow:'hidden'}}>
                    {/* HEADER */}
                    <div onClick={()=>setExpandedSession(isExp?null:sess.id)}
                      style={{padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:'#0D0D0D'}}>
                      <div style={{width:36,height:36,borderRadius:9,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <i className="ti ti-barbell" style={{fontSize:16,color:'#D4570A'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sess.day_label||'Allenamento'}</div>
                        <div style={{fontSize:10,color:'#CCC',marginTop:1,display:'flex',gap:8,alignItems:'center'}}>
                          <span>{dateLabel}</span>
                          {sess.total_volume_kg&&<span style={{color:'#D4570A',fontWeight:600}}>{Math.round(sess.total_volume_kg)}kg vol.</span>}
                          {sess.feeling && <span>{['','😓','😐','🙂','😊','🔥'][sess.feeling]}</span>}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:8,fontWeight:600,
                          background:pct>=80?'#EAF3DE':pct>=50?'#FEF0E7':'#FEE2E2',
                          color:pct>=80?'#3B6D11':pct>=50?'#D4570A':'#E24B4A'}}>
                          {pct}%
                        </span>
                        <i className={`ti ti-chevron-${isExp?'up':'down'}`} style={{fontSize:13,color:'#CCC'}}/>
                      </div>
                    </div>

                    {/* DETTAGLIO ESERCIZI */}
                    {isExp && (
                      <div style={{borderTop:'0.5px solid #F0EDE8',background:'#FAFAF9'}}>
                        {Object.keys(byEx).length > 0 ? (
                          <div style={{padding:'10px 12px'}}>
                            {Object.entries(byEx).map(([name,ls])=>{
                              const maxKg = Math.max(...ls.map(l=>parseFloat(l.weight_kg)||0))
                              const maxReps = Math.max(...ls.map(l=>parseInt(l.reps_done)||0))
                              return (
                                <div key={name} style={{padding:'7px 0',borderBottom:'0.5px solid #F0EDE8',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{name}</div>
                                    <div style={{fontSize:10,color:'#CCC',marginTop:1}}>{ls.length} serie{maxReps>0?` · ${maxReps} reps`:''}</div>
                                  </div>
                                  {maxKg>0 && <span style={{fontSize:13,fontWeight:700,color:'#D4570A'}}>{maxKg}kg</span>}
                                </div>
                              )
                            })}
                            {sess.notes && (
                              <div style={{marginTop:8,fontSize:11,color:'#CCC',fontStyle:'italic',padding:'6px 8px',background:'#161616',borderRadius:7}}>"{sess.notes}"</div>
                            )}
                          </div>
                        ) : (
                          <div style={{padding:'12px',fontSize:11,color:'#CCC',textAlign:'center'}}>Nessun dettaglio esercizi registrato</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* NESSUN DATO */}
          {checkins.length===0 && sessions.length===0 && photos.length===0 && (
            <div style={{textAlign:'center',padding:'40px 0',color:'#CCC',fontSize:13}}>
              <i className="ti ti-mood-empty" style={{fontSize:36,display:'block',marginBottom:8,opacity:0.3}}/>
              Nessun dato ancora per questo cliente
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>
          <button onClick={()=>setLightbox(null)} style={{position:'absolute',top:16,right:16,width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <i className="ti ti-x" style={{fontSize:18,color:'white'}}/>
          </button>
          <img loading="lazy" src={lightbox.photo_url} alt={lightbox.label} onClick={e=>e.stopPropagation()}
            style={{maxWidth:'100%',maxHeight:'82vh',objectFit:'contain',borderRadius:12}}/>
          <div style={{marginTop:12,textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:700,color:'white',textTransform:'uppercase'}}>{lightbox.label}</div>
            {lightbox.photo_date&&<div style={{fontSize:11,color:'rgba(255,255,255,0.55)',marginTop:3}}>
              {new Date(lightbox.photo_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
            </div>}
            <div style={{fontSize:10,color:'rgba(255,255,255,0.55)',marginTop:8}}>Tocca fuori per chiudere</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TAB REPORT
// ─────────────────────────────────────────────────────────
function ReportTab({ clients, clientStats, onRefresh }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('tutti')

  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    setLoading(true)
    const { data } = await supabase.from('workout_reports')
      .select('*, profiles!workout_reports_client_id_fkey(full_name)')
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  async function markRead(reportId) {
    await supabase.from('workout_reports').update({ read_by_coach: true }).eq('id', reportId)
    setReports(p => p.map(r => r.id === reportId ? { ...r, read_by_coach: true } : r))
    // Rimuovi badge newReport dalla lista clienti
    const rep = reports.find(r => r.id === reportId)
    // badge rimosso automaticamente al refresh
  }

  const nonLetti = reports.filter(r => !r.read_by_coach)
  const tutti = reports
  const displayed = filter === 'non_letti' ? nonLetti : tutti

  const initials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() : '?'

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#AAA' }}>
          {nonLetti.length > 0 && <span style={{ fontWeight: 700, color: '#7C3AED' }}>{nonLetti.length} non letto{nonLetti.length > 1 ? 'i' : ''} · </span>}
          {tutti.length} report totali
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'tutti', l: `Tutti (${tutti.length})` }, { id: 'non_letti', l: `Non letti (${nonLetti.length})` }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              border: '0.5px solid', fontFamily: 'inherit',
              background: filter === f.id ? '#7C3AED' : '#161616',
              color: filter === f.id ? 'white' : '#CCC',
              borderColor: filter === f.id ? '#7C3AED' : '#E0DDD6'
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#AAA' }}>Caricamento...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C' }}>
          <i className="ti ti-clipboard-list" style={{ fontSize: 40, color: '#E0DDD6', display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: '#AAA' }}>Nessun report ricevuto ancora.</div>
        </div>
      )}

      {displayed.map(r => {
        const clientName = r.profiles?.full_name || clients.find(c => c.id === r.client_id)?.full_name || '—'
        const isExpanded = expanded === r.id
        const isNew = !r.read_by_coach

        return (
          <div key={r.id} style={{ background: '#0D0D0D', borderRadius: 12, border: `0.5px solid ${isNew ? '#C4B5FD' : '#E0DDD6'}`, marginBottom: 10, overflow: 'hidden' }}>
            {/* HEADER REPORT */}
            <div onClick={() => { setExpanded(isExpanded ? null : r.id); if (isNew) markRead(r.id) }}
              style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isNew ? '#140d1a' : '#0D0D0D' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: isNew ? '#7C3AED' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {initials(clientName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}>{clientName}</span>
                  {isNew && <span style={{ fontSize: 10, background: '#7C3AED', color: 'white', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>NUOVO</span>}
                </div>
                <div style={{ fontSize: 11, color: '#AAA' }}>
                  {r.period_start && r.period_end
                    ? `${new Date(r.period_start + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${new Date(r.period_end + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Inviato il ${new Date(r.submitted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </div>
              </div>
              {/* MINI STATS */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {r.benessere_generale && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 700, color: r.benessere_generale >= 7 ? '#3B6D11' : r.benessere_generale >= 5 ? '#E8A020' : '#E24B4A' }}>{r.benessere_generale}</div><div style={{ fontSize: 9, color: '#AAA' }}>😊</div></div>}
                {r.energia_allenamento && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 700, color: r.energia_allenamento >= 7 ? '#3B6D11' : r.energia_allenamento >= 5 ? '#E8A020' : '#E24B4A' }}>{r.energia_allenamento}</div><div style={{ fontSize: 9, color: '#AAA' }}>⚡</div></div>}
                {r.stress_periodo && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 700, color: r.stress_periodo <= 4 ? '#3B6D11' : r.stress_periodo <= 7 ? '#E8A020' : '#E24B4A' }}>{r.stress_periodo}</div><div style={{ fontSize: 9, color: '#AAA' }}>🧠</div></div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={(e)=>{e.stopPropagation();generateReportPDF(r,clientName)}} style={{
                  background:'#EDE9FE',color:'#7C3AED',border:'0.5px solid #7C3AED',
                  borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:4
                }}>
                  <i className="ti ti-file-type-pdf" style={{fontSize:12}}/>PDF
                </button>
                <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 14, color: '#AAA' }} />
              </div>
            </div>

            {/* CONTENUTO ESPANSO */}
            {isExpanded && (
              <div style={{ borderTop: '0.5px solid #F5F3EF', padding: '14px', maxHeight: 500, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

                {/* PROGRESSI ESERCIZI */}
                {r.progressi_esercizi?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#D4570A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🏋️ Progressi di carico</div>
                    {r.progressi_esercizi.map((ex, i) => {
                      const diff = ex.carico_fine && ex.carico_inizio ? (parseFloat(ex.carico_fine) - parseFloat(ex.carico_inizio)).toFixed(1) : null
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '0.5px solid #F5F3EF' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F0F0' }}>{ex.exercise_name}</div>
                            <div style={{ fontSize: 11, color: '#AAA' }}>{ex.carico_inizio}kg → {ex.carico_fine}kg</div>
                            {ex.note && <div style={{ fontSize: 11, color: '#AAA', fontStyle: 'italic', marginTop: 2 }}>"{ex.note}"</div>}
                          </div>
                          {diff !== null && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(diff) > 0 ? '#3B6D11' : parseFloat(diff) < 0 ? '#E24B4A' : '#888780', background: parseFloat(diff) > 0 ? '#EAF3DE' : parseFloat(diff) < 0 ? '#FEE2E2' : '#F5F3EF', padding: '2px 8px', borderRadius: 7, marginLeft: 8, flexShrink: 0 }}>
                              {parseFloat(diff) > 0 ? '+' : ''}{diff}kg
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* BENESSERE */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { l: 'Benessere', v: r.benessere_generale, emoji: '😊' },
                    { l: 'Energia', v: r.energia_allenamento, emoji: '⚡' },
                    { l: 'Sonno', v: r.qualita_sonno, emoji: '😴' },
                    { l: 'Stress', v: r.stress_periodo, emoji: '🧠', inverted: true },
                  ].filter(item => item.v !== null && item.v !== undefined && item.v !== '').map(item => (
                    <div key={item.l} style={{ background: '#161616', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{item.emoji}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F0F0' }}>{item.v}/10</div>
                      <div style={{ fontSize: 9, color: '#AAA', textTransform: 'uppercase' }}>{item.l}</div>
                    </div>
                  ))}
                </div>

                {/* CAMPI TESTO */}
                {[
                  { l: '⚖️ Peso inizio → fine periodo', v: (r.peso_inizio || r.peso_fine) ? `${r.peso_inizio ?? '—'} → ${r.peso_fine ?? '—'} kg` : null },
                  { l: '🥗 Alimentazione — difficoltà', v: r.difficolta_alimentazione },
                  { l: '🥗 Pasti saltati', v: r.pasti_saltati },
                  { l: '🥗 Fame/sazietà', v: r.fame_saziet },
                  { l: '🥗 Note alimentazione', v: r.note_alimentazione },
                  { l: '💤 DOMS', v: r.doms },
                  { l: '💤 Recupero', v: r.qualita_recupero },
                  { l: '💤 Zona affaticata', v: r.zona_affaticata },
                  { l: '💤 Dolori nuovi', v: r.dolori_nuovi },
                  { l: '📋 Esercizi amati', v: r.esercizi_amati },
                  { l: '📋 Esercizi difficili', v: r.esercizi_difficili },
                  { l: '📋 Cosa cambierebbe', v: r.cosa_cambieresti },
                  { l: '📋 Obiettivo prossimo periodo', v: r.obiettivo_prossimo },
                  { l: '💬 Note al coach', v: r.note_coach },
                ].filter(f => f.v !== null && f.v !== undefined && f.v !== '').map(f => (
                  <div key={f.l} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{f.l}</div>
                    <div style={{ fontSize: 13, color: '#F0F0F0', lineHeight: 1.5, background: '#161616', borderRadius: 8, padding: '8px 10px' }}>{f.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PDF GENERATORS
// ─────────────────────────────────────────────────────────
function _initials(n) { return n ? n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() : '?' }

function generateReportPDF(r, clientName) {
  function bar(val, max, color) {
    const pct = Math.min(Math.round((val/max)*100),100)
    return '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:5px;background:#F0EDE8;border-radius:3px"><div style="height:5px;width:'+pct+'%;background:'+color+';border-radius:3px"></div></div><span style="font-size:11px;font-weight:700;color:'+color+';min-width:20px;text-align:right">'+val+'</span></div>'
  }
  function sc(v, inv) {
    if (v==null) return '#888780'
    if (inv) return v<=3?'#3B6D11':v<=6?'#E8A020':'#E24B4A'
    return v>=8?'#3B6D11':v>=5?'#E8A020':'#E24B4A'
  }
  var dateLabel = r.period_start&&r.period_end
    ? new Date(r.period_start+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})+' – '+new Date(r.period_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    : 'Inviato il '+new Date(r.submitted_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})

  var bw = r.benessere_generale!=null?'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">😊 Benessere</span><span style="font-weight:700;color:'+sc(r.benessere_generale)+'">'+r.benessere_generale+'/10</span></div>'+bar(r.benessere_generale,10,sc(r.benessere_generale))+'</div>':''
  var en = r.energia_allenamento!=null?'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">⚡ Energia</span><span style="font-weight:700;color:'+sc(r.energia_allenamento)+'">'+r.energia_allenamento+'/10</span></div>'+bar(r.energia_allenamento,10,sc(r.energia_allenamento))+'</div>':''
  var st = r.stress_periodo!=null?'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">🧠 Stress</span><span style="font-weight:700;color:'+sc(r.stress_periodo,true)+'">'+r.stress_periodo+'/10</span></div>'+bar(r.stress_periodo,10,sc(r.stress_periodo,true))+'</div>':''
  var rc = r.qualita_recupero!=null?'<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">😴 Recupero</span><span style="font-weight:700;color:'+sc(r.qualita_recupero)+'">'+r.qualita_recupero+'/10</span></div>'+bar(r.qualita_recupero,10,sc(r.qualita_recupero))+'</div>':''

  var progHtml = ''
  if (r.progressi_esercizi&&r.progressi_esercizi.length) {
    progHtml = r.progressi_esercizi.map(function(ex){
      var diff=ex.carico_fine&&ex.carico_inizio?(parseFloat(ex.carico_fine)-parseFloat(ex.carico_inizio)).toFixed(1):null
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid #EEECE8;font-size:12px"><div><strong>'+ex.exercise_name+'</strong>'+(ex.note?'<br><span style="font-size:10px;color:#888780;font-style:italic">'+ex.note+'</span>':'')+'</div><div style="display:flex;align-items:center;gap:6px"><span style="color:#888780">'+(ex.carico_inizio||'—')+'→'+(ex.carico_fine||'—')+'kg</span>'+(diff!=null?'<span style="padding:2px 7px;border-radius:7px;font-size:10px;font-weight:700;background:'+(parseFloat(diff)>0?'#EAF3DE':parseFloat(diff)<0?'#FEE2E2':'#F5F3EF')+';color:'+(parseFloat(diff)>0?'#3B6D11':parseFloat(diff)<0?'#E24B4A':'#888780')+'">'+(parseFloat(diff)>0?'+':'')+diff+'kg</span>':'')+'</div></div>'
    }).join('')
  }

  var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Report — '+clientName+'</title>'
  html += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;font-size:13px}.header{background:linear-gradient(135deg,#1A1A1A,#2D2D2D);color:white;padding:28px 36px 24px}.brand{font-size:22px;font-weight:900;margin-bottom:20px;display:flex;justify-content:space-between}.brand span{color:#D4570A}.brand-meta{font-size:11px;opacity:0.6;text-align:right}.av{width:44px;height:44px;border-radius:50%;background:#D4570A;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;margin-right:10px;vertical-align:middle}.cn{font-size:19px;font-weight:800;vertical-align:middle}.cs{font-size:12px;opacity:0.6;margin-top:6px}.bp{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.5);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-left:10px;vertical-align:middle}.body{padding:28px 36px}.sec{margin-bottom:22px}.st{font-size:11px;font-weight:700;color:#D4570A;text-transform:uppercase;letter-spacing:0.1em;border-bottom:2px solid #FEF0E7;padding-bottom:6px;margin-bottom:12px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box{background:#F8F7F5;border-radius:10px;padding:14px;margin-bottom:8px;border:0.5px solid #EEECE8}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid #EEECE8;font-size:12px}.row:last-child{border-bottom:none}.k{color:#888780}.v{font-weight:600}.note{background:#FFF8F5;border:1px solid #FDDCC4;border-radius:10px;padding:12px;font-size:12px;line-height:1.7;color:#444;font-style:italic;margin-top:6px}.footer{margin-top:24px;padding:14px 36px;background:#F8F7F5;border-top:0.5px solid #EEECE8;display:flex;justify-content:space-between;font-size:10px;color:#888780}.footer strong{color:#D4570A}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>'
  html += '<div class="header"><div class="brand"><div>FO<span>fit</span></div><div class="brand-meta">Federico Obinu · Coach<br>fofit.fit</div></div>'
  html += '<div><div class="av">'+_initials(clientName)+'</div><span class="cn">'+clientName+'</span><span class="bp">Report allenamento</span></div>'
  html += '<div class="cs">'+dateLabel+'</div></div>'
  html += '<div class="body"><div class="g2"><div>'
  if (bw||en||st||rc) {
    html += '<div class="sec"><div class="st">😊 Benessere e performance</div><div class="box">'+bw+en+st+rc+'</div></div>'
  }
  if (r.sessioni_completate!=null||r.peso_inizio||r.peso_fine||r.ore_sonno_medie) {
    html += '<div class="sec"><div class="st">📋 Dati periodo</div><div class="box">'
    if (r.sessioni_completate!=null) html += '<div class="row"><span class="k">Sessioni completate</span><span class="v">'+r.sessioni_completate+(r.sessioni_pianificate?'/'+r.sessioni_pianificate:'')+'</span></div>'
    if (r.peso_inizio||r.peso_fine) html += '<div class="row"><span class="k">Peso</span><span class="v">'+(r.peso_inizio||'—')+'kg → '+(r.peso_fine||'—')+'kg</span></div>'
    if (r.ore_sonno_medie) html += '<div class="row"><span class="k">Sonno medio</span><span class="v">'+r.ore_sonno_medie+'h/notte</span></div>'
    html += '</div></div>'
  }
  if (progHtml) {
    html += '<div class="sec"><div class="st">📈 Progressi di carico</div><div class="box">'+progHtml+'</div></div>'
  }
  html += '</div><div>'
  if (r.difficolta_alimentazione||r.fame_saziet||r.pasti_saltati||r.note_alimentazione) {
    html += '<div class="sec"><div class="st">🥗 Alimentazione</div>'
    if (r.fame_saziet||r.pasti_saltati) {
      html += '<div class="box">'
      if (r.fame_saziet) html += '<div class="row"><span class="k">Fame/sazietà</span><span class="v">'+r.fame_saziet+'</span></div>'
      if (r.pasti_saltati) html += '<div class="row"><span class="k">Pasti saltati</span><span class="v">'+r.pasti_saltati+'</span></div>'
      html += '</div>'
    }
    if (r.difficolta_alimentazione) html += '<div class="note"><strong style="font-style:normal;color:#D4570A;font-size:10px;text-transform:uppercase">Difficoltà</strong><br>'+r.difficolta_alimentazione+'</div>'
    if (r.note_alimentazione) html += '<div class="note">'+r.note_alimentazione+'</div>'
    html += '</div>'
  }
  if (r.doms||r.zona_affaticata||r.dolori_nuovi) {
    html += '<div class="sec"><div class="st">💤 Recupero fisico</div><div class="box">'
    if (r.doms) html += '<div class="row"><span class="k">DOMS</span><span class="v">'+r.doms+'</span></div>'
    if (r.zona_affaticata) html += '<div class="row"><span class="k">Zona affaticata</span><span class="v">'+r.zona_affaticata+'</span></div>'
    if (r.dolori_nuovi) html += '<div class="row"><span class="k">Dolori nuovi</span><span class="v">'+r.dolori_nuovi+'</span></div>'
    html += '</div></div>'
  }
  if (r.esercizi_amati||r.esercizi_difficili||r.cosa_cambieresti||r.obiettivo_prossimo) {
    html += '<div class="sec"><div class="st">📋 Feedback scheda</div><div class="box">'
    if (r.esercizi_amati) html += '<div class="row"><span class="k">✅ Amati</span><span class="v">'+r.esercizi_amati+'</span></div>'
    if (r.esercizi_difficili) html += '<div class="row"><span class="k">😓 Difficili</span><span class="v">'+r.esercizi_difficili+'</span></div>'
    if (r.cosa_cambieresti) html += '<div class="row"><span class="k">💡 Migliorare</span><span class="v">'+r.cosa_cambieresti+'</span></div>'
    if (r.obiettivo_prossimo) html += '<div class="row"><span class="k">🎯 Prossimo</span><span class="v">'+r.obiettivo_prossimo+'</span></div>'
    html += '</div></div>'
  }
  if (r.note_coach) {
    html += '<div class="sec"><div class="st">💬 Note al coach</div><div class="note">"'+r.note_coach+'"</div></div>'
  }
  html += '</div></div></div>'
  html += '<div class="footer"><span>Generato il <strong>'+new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})+'</strong></span><span>FOfit · Federico Obinu Coach · <strong>fofit.fit</strong></span></div>'
  html += '</body></html>'

  var win = window.open('','_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(function(){win.print()},600)
}

function generateAnamnesiPDF(a, clientName) {
  function field(label, value) {
    if (!value) return ''
    if (typeof value === 'string' && value.trim().charAt(0) === '[') {
      try { var parsed = JSON.parse(value); if (Array.isArray(parsed)) value = parsed } catch (e) {}
    }
    if (Array.isArray(value) && value.length === 0) return ''
    var v = Array.isArray(value) ? value.join(', ') : String(value)
    return '<div class="field"><div class="fl">'+label+'</div><div class="fv">'+v+'</div></div>'
  }
  function section(title, fields) {
    var content = fields.join('')
    if (!content) return ''
    return '<div class="sec"><div class="st">'+title+'</div>'+content+'</div>'
  }

  var dateLabel = a.completed_at
    ? 'Compilata il '+new Date(a.completed_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    : (a.submitted_at ? 'Inviata il '+new Date(a.submitted_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}) : '')

  var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Anamnesi — '+clientName+'</title>'
  html += '<style>'
  html += '*{margin:0;padding:0;box-sizing:border-box}'
  html += 'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;font-size:13px}'
  html += '.header{background:linear-gradient(135deg,#1A1A1A,#2D2D2D);color:white;padding:28px 36px 24px}'
  html += '.brand{font-size:22px;font-weight:900;margin-bottom:20px;display:flex;justify-content:space-between}'
  html += '.brand span{color:#3B6D11}'
  html += '.brand-meta{font-size:11px;opacity:0.6;text-align:right}'
  html += '.av{width:44px;height:44px;border-radius:50%;background:#3B6D11;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;margin-right:10px;vertical-align:middle}'
  html += '.cn{font-size:19px;font-weight:800;vertical-align:middle}'
  html += '.cs{font-size:12px;opacity:0.6;margin-top:6px}'
  html += '.bp{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.5);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-left:10px;vertical-align:middle}'
  html += '.body{padding:28px 36px}'
  html += '.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}'
  html += '.sec{margin-bottom:20px}'
  html += '.st{font-size:11px;font-weight:700;color:#3B6D11;text-transform:uppercase;letter-spacing:0.1em;border-bottom:2px solid #EAF3DE;padding-bottom:6px;margin-bottom:12px}'
  html += '.field{margin-bottom:8px}'
  html += '.fl{font-size:10px;font-weight:700;color:#888780;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px}'
  html += '.fv{font-size:13px;color:#111;line-height:1.5;background:#F8F7F5;border-radius:8px;padding:8px 10px;border:0.5px solid #EEECE8}'
  html += '.highlight{background:#EAF3DE;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}'
  html += '.hval{font-size:20px;font-weight:900;color:#3B6D11;text-align:center}'
  html += '.hlbl{font-size:9px;color:#888780;text-transform:uppercase;letter-spacing:0.07em;text-align:center;margin-top:2px}'
  html += '.footer{margin-top:24px;padding:14px 36px;background:#F8F7F5;border-top:0.5px solid #EEECE8;display:flex;justify-content:space-between;font-size:10px;color:#888780}'
  html += '.footer strong{color:#3B6D11}'
  html += '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
  html += '</style></head><body>'

  // HEADER
  html += '<div class="header">'
  html += '<div class="brand"><div>FO<span>fit</span></div><div class="brand-meta">Federico Obinu · Coach<br>fofit.fit</div></div>'
  html += '<div><div class="av">'+_initials(clientName)+'</div><span class="cn">'+clientName+'</span><span class="bp">Anamnesi completa</span></div>'
  html += '<div class="cs">'+dateLabel+'</div>'
  html += '</div>'

  html += '<div class="body">'

  // KPI IN EVIDENZA
  var hasKpi = a.peso_attuale||a.peso_desiderato||a.altezza||a.frequenza_allenamento
  if (hasKpi) {
    html += '<div class="highlight">'
    if (a.peso_attuale) html += '<div><div class="hval">'+a.peso_attuale+'kg</div><div class="hlbl">Peso attuale</div></div>'
    if (a.peso_desiderato) html += '<div><div class="hval">'+a.peso_desiderato+'kg</div><div class="hlbl">Target</div></div>'
    if (a.altezza) html += '<div><div class="hval">'+a.altezza+'cm</div><div class="hlbl">Altezza</div></div>'
    if (a.frequenza_allenamento) html += '<div><div class="hval">'+a.frequenza_allenamento+'x</div><div class="hlbl">Sessioni/sett</div></div>'
    html += '</div>'
  }

  // LAYOUT 2 COLONNE
  html += '<div class="g2"><div>'

  html += section('1. Dati anagrafici', [
    field('Data di nascita', a.data_nascita),
    field('Città', a.citta),
    field('Lavoro', a.lavoro),
    field('Orari di lavoro', a.orari_lavoro),
  ])

  html += section('2. Obiettivo', [
    field('Obiettivo principale', a.obiettivo),
    field('Motivazione', a.motivazione),
    field('Tempistiche', a.tempo_cambiamento),
    field('Importanza (0-10)', a.importanza_obiettivo),
  ])

  html += section('3. Lavoro e stile di vita', [
    field('Tipo di lavoro', a.tipo_lavoro),
    field('Altro (specificato)', a.tipo_lavoro_altro),
    field('Ore seduto/a al giorno', a.ore_seduto),
    field('Ore consecutive senza alzarsi', a.ore_consecutive_seduto),
    field('Postazione di lavoro', a.postazione_lavoro),
    field('Pause attive', a.pause_attive),
    field('In cosa consistono le pause', a.tipo_pause),
    field('Come arriva al lavoro', a.mezzo_lavoro),
    field('Passi medi al giorno', a.passi_die),
    field('Sensazioni a fine giornata', a.sensazioni_fine_lavoro),
    field('Dopo il lavoro', a.dopo_lavoro),
  ])

  html += section('4. Postura e mal di schiena', [
    field('Mal di schiena', a.mal_schiena),
    field('Zona del dolore', a.zona_dolore_schiena),
    field('Da quanto tempo', a.durata_dolore_schiena),
    field('Intensità media (0-10)', a.intensita_dolore_schiena),
    field('Tipo di dolore', a.tipo_dolore_schiena),
    field('Quando peggiora', a.quando_peggio_schiena),
    field('Quando migliora', a.quando_meglio_schiena),
    field('Cosa dà sollievo', a.sollievo_schiena),
    field('Irradiazione', a.irradiazione_dolore),
    field('Esami / visite fatte', a.visite_schiena),
    field('Diagnosi', a.diagnosi_schiena),
    field('Impatto sulla vita quotidiana', a.impatto_schiena_vita),
    field('Traumi / incidenti', a.traumi_schiena),
    field('Dettaglio traumi', a.traumi_schiena_dettaglio),
    field('Correlazione con lo stress', a.stress_schiena),
    field('Postura abituale', a.postura_abituale),
    field('Postura alla scrivania', a.postura_scrivania),
    field('Posizione del monitor', a.posizione_monitor),
    field('Zone di tensione', a.zone_tensione),
    field('Tensione collo/spalle', a.frequenza_tensione_collo),
    field('Formicolii a braccia/mani', a.formicolio_mani),
    field('Stretching / mobilità', a.stretching_mobilita),
    field('Movimenti evitati', a.movimenti_evitati_dolore),
    field('Rapporto con la schiena (sue parole)', a.rapporto_schiena),
  ])

  html += section('5. Salute generale', [
    field('Diagnosi attive', a.diagnosi_attive),
    field('Interventi chirurgici', a.interventi_chirurgici),
    field('Condizioni particolari', a.condizioni_salute),
    field('Familiarità', a.familiarita),
  ])

  html += section('6. Farmaci e stimolanti', [
    field('Farmaci', a.farmaci),
    field('Integratori', a.integratori),
    field('Caffeina', a.caffeina),
    field('Fumo', a.fumo===true?'Sì':a.fumo===false?'No':null),
    field('Alcol', a.alcol),
  ])

  html += section('7. Sonno e recupero', [
    field('Ore di sonno', a.ore_sonno),
    field('Orario letto / sveglia', a.orario_letto&&a.orario_sveglia ? a.orario_letto+' → '+a.orario_sveglia : a.orario_letto||a.orario_sveglia),
    field('Qualità sonno', a.qualita_sonno ? a.qualita_sonno+'/10' : null),
    field('Risvegli notturni', a.risvegli_notte),
    field('Cosa rovina il sonno', a.cosa_rovina_sonno),
  ])

  html += section('8. Stress ed energia', [
    field('Stress medio', a.stress_medio ? a.stress_medio+'/10' : null),
    field('Crollo energia', a.crollo_energia),
    field('Sintomi frequenti', a.sintomi_frequenti),
    field('Fonti di stress', [a.fonte_stress_1, a.fonte_stress_2].filter(Boolean).join(', ')||null),
  ])

  html += '</div><div>'

  html += section('9. Digestione', [
    field('Gonfiore', a.gonfiore),
    field('Reflusso', a.reflusso),
    field('Evacuazione', a.evacuazione),
    field('Cibi che gonfiano', a.cibi_gonfiano),
  ])

  html += section('10. Storia peso', [
    field('Peso minimo (5 anni)', a.peso_minimo ? a.peso_minimo+'kg' : null),
    field('Peso massimo (5 anni)', a.peso_massimo ? a.peso_massimo+'kg' : null),
    field('Accumulo grasso', a.accumulo_grasso),
    field('Tentativi passati', a.tentativi_dieta),
    field('Perché non ha funzionato', a.perche_non_funzionato),
  ])

  html += section('11. Alimentazione', [
    field('Pasti preferiti', a.pasti_preferiti),
    field('Quando ha più fame', a.quando_fame),
    field('Giorno tipo', a.giorno_tipo),
    field('Acqua', a.acqua),
    field('Proteine gradite', a.proteine_gradite),
    field('Proteine non vuole', a.proteine_non_vuole),
    field('Carboidrati preferiti', a.carboidrati_preferiti),
    field('Piatti preferiti', a.piatti_preferiti),
    field('Cibi critici', a.cibi_critici),
    field('Livello tracking', a.livello_tracking),
  ])

  html += section('12. Allenamento', [
    field('Si allena', a.si_allena===true?'Sì':a.si_allena===false?'No':null),
    field('Tipologia', a.tipo_allenamento),
    field('Orario preferito', a.orario_allenamento),
    field('Durata sessione', a.durata_seduta),
    field('Energia in allenamento', a.energia_allenamento ? a.energia_allenamento+'/10' : null),
    field('DOMS', a.doms),
    field('Esercizi che ama', a.esercizi_ama),
    field('Esercizi che odia', a.esercizi_odia),
    field('Dolori/limitazioni', a.dolori_limitazioni),
  ])

  html += section('13. Vincoli e sostenibilità', [
    field('Tempo disponibile', a.tempo_settimana),
    field('Giorni migliori', a.giorni_migliori),
    field('Cibi da non togliere', a.cibi_non_togliere),
    field('Cosa non fare', a.cosa_non_fare),
  ])

  if (a.note_finali) {
    html += section('14. Note finali', [field('Note aggiuntive', a.note_finali)])
  }

  html += '</div></div>'
  html += '</div>'

  html += '<div class="footer"><span>Generato il <strong>'+new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})+'</strong></span><span>FOfit · Federico Obinu Coach · <strong>fofit.fit</strong></span></div>'
  html += '</body></html>'

  var win = window.open('','_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(function(){win.print()},600)
}


// ─────────────────────────────────────────────────────────
// TAB ANAMNESI
// ─────────────────────────────────────────────────────────
function AnamnesiTab({ clients, onRefresh }) {
  const [anamnesi, setAnamnesi] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('nuove')
  const [openAnamnesi, setOpenAnamnesi] = useState(null)

  useEffect(() => { fetchAnamnesi() }, [])

  async function fetchAnamnesi() {
    setLoading(true)
    const { data } = await supabase.from('anamnesi')
      .select('*, profiles!anamnesi_client_id_fkey(full_name)')
      .not('completed_at','is',null)
      .order('completed_at',{ascending:false})
    setAnamnesi(data||[])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('anamnesi').update({read_by_coach:true}).eq('id',id)
    setAnamnesi(p=>p.map(a=>a.id===id?{...a,read_by_coach:true}:a))
  }

  const nonLette = anamnesi.filter(a=>!a.read_by_coach)
  const displayed = filter==='nuove' ? nonLette : anamnesi
  const initials = n=>n?n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase():'?'

  return (
    <div style={{padding:'0 0 40px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:13,color:'#CCC'}}>
          {nonLette.length>0&&<span style={{fontWeight:700,color:'#6FCF97'}}>{nonLette.length} non letta{nonLette.length>1?'e':''} · </span>}
          {anamnesi.length} totali
        </div>
        <div style={{display:'flex',gap:6}}>
          {[{id:'nuove',l:`Non lette (${nonLette.length})`},{id:'tutte',l:`Tutte (${anamnesi.length})`}].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{
              padding:'5px 12px',borderRadius:16,fontSize:11,fontWeight:500,cursor:'pointer',
              border:'0.5px solid',fontFamily:'inherit',
              background:filter===f.id?'#3B6D11':'#161616',
              color:filter===f.id?'white':'#DDD',
              borderColor:filter===f.id?'#3B6D11':'#333'
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading&&<div style={{textAlign:'center',padding:'40px',color:'#CCC'}}>Caricamento...</div>}

      {!loading&&displayed.length===0&&(
        <div style={{textAlign:'center',padding:'60px 20px',background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C'}}>
          <i className="ti ti-clipboard-heart" style={{fontSize:40,color:'#444',display:'block',marginBottom:10}}/>
          <div style={{fontSize:13,color:'#CCC'}}>Nessuna anamnesi {filter==='nuove'?'non letta':'compilata'}.</div>
        </div>
      )}

      {displayed.map(a=>{
        const clientName = a.profiles?.full_name || clients.find(c=>c.id===a.client_id)?.full_name || '—'
        const isNew = !a.read_by_coach
        return (
          <div key={a.id} style={{background:'#0D0D0D',borderRadius:12,border:`0.5px solid ${isNew?'rgba(111,207,151,0.55)':'#1C1C1C'}`,marginBottom:10,overflow:'hidden'}}>
            <div style={{padding:'14px',display:'flex',alignItems:'center',gap:12,background:isNew?'rgba(59,140,90,0.12)':'#0D0D0D'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:isNew?'#3B6D11':'#333',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                {initials(clientName)}
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>{clientName}</span>
                  {isNew&&<span style={{fontSize:10,background:'#3B6D11',color:'white',padding:'2px 8px',borderRadius:8,fontWeight:600}}>NUOVA</span>}
                </div>
                <div style={{fontSize:11,color:'#CCC'}}>
                  Completata il {new Date(a.completed_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
                  {a.obiettivo&&` · Obiettivo: ${a.obiettivo}`}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>{setOpenAnamnesi(a.client_id);if(isNew)markRead(a.id)}} style={{
                  background:'rgba(74,144,212,0.14)',color:'#8CC2F5',border:'0.5px solid rgba(74,144,212,0.5)',
                  borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:4
                }}>
                  <i className="ti ti-eye" style={{fontSize:12}}/>Apri
                </button>
                <button onClick={()=>{generateAnamnesiPDF(a,clientName);if(isNew)markRead(a.id)}} style={{
                  background:'rgba(59,140,90,0.14)',color:'#6FCF97',border:'0.5px solid rgba(111,207,151,0.5)',
                  borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:4
                }}>
                  <i className="ti ti-file-type-pdf" style={{fontSize:12}}/>PDF
                </button>
                {isNew&&<button onClick={()=>markRead(a.id)} style={{background:'#161616',color:'#CCC',border:'0.5px solid #1C1C1C',borderRadius:7,padding:'6px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✓ Letta</button>}
              </div>
            </div>
          </div>
        )
      })}

      {openAnamnesi && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{width:'100%',maxWidth:640,maxHeight:'90vh',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <Anamnesi clientId={openAnamnesi} onClose={()=>setOpenAnamnesi(null)}/>
          </div>
        </div>
      )}
    </div>
  )
}
