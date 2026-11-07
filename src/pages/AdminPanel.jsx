import React, { useState, useEffect } from 'react'
import { done } from '../lib/toast'
import { dbSave } from '../lib/db'
import { sendToClient } from '../lib/notify'
import { authFetch } from '../lib/authFetch'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useNavigate } from 'react-router-dom'
import { useCoachInbox } from '../lib/useCoachInbox.js'
import CoachDashboard from '../components/CoachDashboard'
import NotifBell from './admin/NotifBell'
import ClientDetailModal from './admin/ClientDetailModal'
import CalendarioAdmin from './admin/CalendarioAdmin'
import CheckinAdmin from './admin/CheckinAdmin'
import ReportTab from './admin/ReportTab'
import AnamnesiTab from './admin/AnamnesiTab'
import { s, goalLabel, initials, today } from './admin/shared'

export default function AdminPanel() {
  const navigate = useNavigate()
  // "Nuovo piano": porta direttamente su Crea piano con il cliente già selezionato
  const goCreaPiano = (clientId) => navigate('/crea-piano?client=' + clientId)
  const goCreaAllenamento = (clientId) => navigate('/crea-allenamento?client=' + clientId)
  const { profile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [clientStats, setClientStats] = useState({}) // { [clientId]: { diaryToday, activePlan, latestMeasure } }
  const [loading, setLoading] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  // "vai a questo dato": la scheda di destinazione riceve il dato e lo apre da sola
  const [focus, setFocus] = useState(null)
  const clearFocus = React.useCallback(() => setFocus(null), [])
  useEffect(() => { if (focus && focus.tab !== tab) setFocus(null) }, [tab])        // se si cambia scheda prima di arrivare, il "vai a" decade
  function openItem(i) {
    const f = { type: i.type, id: i.id, clientId: i.clientId, extra: i.extra || {} }
    const to = { checkin: 'check-in', photo: 'check-in', measure: 'check-in', report: 'report', anamnesi: 'anamnesi', booking: 'calendario' }[i.type]
    if (to) { setSelectedClient(null); setFocus({ ...f, tab: to }); setTab(to) }
    else { const c = clients.find(c => c.id === i.clientId); if (c) setSelectedClient(c) }       // messaggi: si apre il cliente
  }
  async function replyToClient(clientId, text) {
    // stesso percorso dei messaggi programmati: il cliente la vede in Home e nelle Notifiche (e può rispondere ancora)
    const r = await sendToClient({ clientId, coachId: profile?.id, title: 'Risposta del coach', body: text })
    return r.ok
  }
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  // Dashboard: tutto ciò che i clienti hanno inviato (check-in, messaggi, report, anamnesi, chiamate, foto, misure)
  const inbox = useCoachInbox({ clients, clientStats, coachId: profile?.id, onChanged: fetchAll })
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
          lastDiary: diaryDays.length ? [...diaryDays].sort().pop() : null,
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
      const res = await authFetch('/api/create-user', {
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
      done('Cliente creato')
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
    await dbSave(supabase.from('meal_plans').update({is_active:false}).eq('client_id', newPlan.client_id), 'il piano alimentare', 'salvare', { quiet: true })

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
      done('Piano creato e assegnato')
    setShowNewPlan(false)
    setDietType('lineare')
    setNewPlan({ client_id:'', title:'Piano alimentare', week_number:1, kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65, notes:'' })
    setTimeout(() => { setMsg(''); fetchAll() }, 2000)
    setSaving(false)
  }

  async function reactivatePlan(planId) {
    const r = await dbSave(supabase.from('meal_plans').update({ is_active: true }).eq('id', planId), 'il piano alimentare', 'riattivare', { done: 'Piano riattivato' })
    if (!r.ok) return
    fetchAll()
  }
  const macroKcal = p => (parseInt(p.protein_target_g||0)*4+parseInt(p.carbs_target_g||0)*4+parseInt(p.fat_target_g||0)*9)

  // Sync kcal → macro per dietConfig (mantiene proporzioni)

  // Sync macro → kcal per dietConfig

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
    { id:'overview', icon:'ti-layout-dashboard', label:'Dashboard', badge: inbox.unseenCount },
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
              FO<span style={{color:'#F4894A'}}>fit</span>
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
                {t.badge > 0 && <span style={{marginLeft:'auto',background:'#D4570A',color:'white',fontSize:10,fontWeight:800,padding:'1px 7px',borderRadius:10}}>{t.badge}</span>}
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
              <div style={{fontSize:16,fontWeight:900,color:'#F0F0F0'}}>FO<span style={{color:'#F4894A'}}>fit</span></div>
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
            {msg && <div style={{background:'rgba(59,109,17,0.1)',border:'0.5px solid #3B6D11',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#6FCF97',marginBottom:14}}>{msg}</div>}

            {/* TAB MOBILE */}
            {isMobile && (
              <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:4}}>
                {SIDEBAR_TABS.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setSelectedClient(null)}} style={{
                    flexShrink:0,padding:'6px 14px',borderRadius:16,fontSize:11,fontWeight:600,cursor:'pointer',
                    border:'0.5px solid',fontFamily:'inherit',
                    background:tab===t.id?'#D4570A':'#161616',
                    color:tab===t.id?'white':'#AAA',
                    borderColor:tab===t.id?'#D4570A':'#2A2A2A',
                  }}>{t.label}{t.badge > 0 && <span style={{marginLeft:6,background:tab===t.id?'rgba(255,255,255,0.25)':'#D4570A',color:'white',fontSize:10,fontWeight:800,padding:'1px 6px',borderRadius:10}}>{t.badge}</span>}</button>
                ))}
              </div>
            )}

            {/* TAB DASHBOARD */}
            {tab==='overview' && (
              <CoachDashboard inbox={inbox} clients={clients}
                onOpenTab={(id)=>{setTab(id);setSelectedClient(null)}}
                onOpenClient={(c)=>setSelectedClient(c)}
                onOpenItem={openItem} onReply={replyToClient}/>
            )}

            {/* TAB CLIENTI */}
            {tab==='clienti' && (
              <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',overflow:'hidden'}}>
                {/* FILTRI */}
                <div style={{padding:'12px 16px',borderBottom:'0.5px solid #1C1C1C',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
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
                        borderColor:filter===f.id?'#D4570A':'#2A2A2A',
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
                              color: isSelected ? 'white' : '#F4894A',
                            }}>{initials(c.full_name)}</div>

                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.full_name}</div>
                              <div style={{fontSize:10,color:'#CCC',marginTop:1,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                                <span>{goalLabel[c.goal]||'—'}</span>{st.inactivePlan && <><span style={{color:'#D0CFC9'}}>·</span><span style={{color:'#F5B041',fontWeight:700}}>Piano non attivo</span></>}
                                {st.activePlan && <><span style={{color:'#D0CFC9'}}>·</span><span style={{color:'#F4894A',fontWeight:600}}>{st.activePlan.kcal_target} kcal</span></>}
                                {days!==null && <span style={{padding:'1px 5px',borderRadius:5,fontSize:9,fontWeight:600,background:days<0?'rgba(226,75,74,0.15)':days<=7?'rgba(212,87,10,0.15)':'rgba(59,140,90,0.15)',color:days<0?'#E24B4A':days<=7?'#F4894A':'#3B8C5A'}}>{days<0?'Scaduto':`${days}gg`}</span>}
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
                              {l:'Peso',v:st.latestMeasure?.weight_kg?`${st.latestMeasure.weight_kg}kg`:'—',c:st.latestMeasure?.weight_kg?'#F0F0F0':'#AAA'},
                              {l:'Diario',v:st.diaryToday?'✓':'✗',c:st.diaryToday?'#6FCF97':'#E24B4A'},
                              {l:'Sessioni',v:sessWeek,c:sessWeek>=3?'#6FCF97':sessWeek>=1?'#E8A020':'#E24B4A'},
                              {l:'Aderenza',v:adherencePct!==null?`${adherencePct}%`:'—',c:adherencePct!==null?(adherencePct>=70?'#3B8C5A':adherencePct>=50?'#E8A020':'#E24B4A'):'#AAA'},
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
                                style={{flex:1,padding:'6px 4px',background:'rgba(212,87,10,0.1)',color:'#F4894A',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:7,fontSize:10,fontWeight:600,textDecoration:'none',textAlign:'center'}}>
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
                            <button onClick={()=>goCreaPiano(c.id)}
                              style={{flex:1,padding:'6px 4px',background:'#161616',color:'#CCC',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                              + Nuovo
                            </button>
                            <button onClick={()=>goCreaAllenamento(c.id)}
                              style={{flex:1,padding:'6px 4px',background:'#161616',color:'#CCC',border:'0.5px solid #1C1C1C',borderRadius:7,fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                              + Scheda
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

            {tab==='calendario' && <CalendarioAdmin focus={focus} clearFocus={clearFocus}/>}
            {tab==='check-in' && <CheckinAdmin focus={focus} clearFocus={clearFocus}/>}
            {tab==='report' && <ReportTab clients={clients} clientStats={clientStats} onRefresh={fetchAll} focus={focus} clearFocus={clearFocus}/>}
            {tab==='anamnesi' && <AnamnesiTab clients={clients} onRefresh={fetchAll} focus={focus} clearFocus={clearFocus}/>}
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
                onNewPlan={()=>goCreaPiano(selectedClient.id)} onOpenCheckin={(c)=>{ setSelectedClient(null); setFocus({ type:'photo', id:null, clientId:c.id, extra:{}, tab:'check-in' }); setTab('check-in') }}
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
              onNewPlan={()=>goCreaPiano(selectedClient.id)} onOpenCheckin={(c)=>{ setSelectedClient(null); setFocus({ type:'photo', id:null, clientId:c.id, extra:{}, tab:'check-in' }); setTab('check-in') }}
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
            {msg && <div style={{fontSize:12,color:'#F4894A',marginBottom:10}}>{msg}</div>}
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
                  <div style={s.formGroup}><label style={s.label}>Totale da macro</label><div style={{padding:'9px 12px',background:'rgba(59,109,17,0.1)',borderRadius:8,fontSize:13,color:'#6FCF97',fontWeight:600}}>{macroKcal(newPlan)} kcal ✓</div></div>
                </div>
              </>
            )}
            {dietType!=='lineare' && (
              <div style={{background:'rgba(212,87,10,0.1)',borderRadius:10,padding:'12px',marginBottom:12}}>
                <div style={{fontSize:12,color:'#F4894A',fontWeight:600}}>Per i piani avanzati (ON/OFF, Ad onde, ecc.) usa la sezione Importa piano.</div>
              </div>
            )}
            <div style={s.formGroup}><label style={s.label}>Note per il cliente</label><textarea style={{...s.input,height:60,resize:'vertical'}} value={newPlan.notes} onChange={e=>setNewPlan(p=>({...p,notes:e.target.value}))}/></div>
            {msg && <div style={{fontSize:12,color:'#F4894A',marginBottom:10}}>{msg}</div>}
            <button style={s.saveBtn} onClick={createPlan} disabled={saving}>{saving?'Creazione...':'Crea piano'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowNewPlan(false)}>Annulla</button>
          </div>
        </div>
      )}

    </div>
  )
}

