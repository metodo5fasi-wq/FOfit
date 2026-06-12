import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import NotifPanel from '../components/NotifPanel'

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  tabs: { display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' },
  tab: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #E0DDD6', background:'white', color:'#888780' },
  tabActive: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #D4570A', background:'#D4570A', color:'white' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:14 },
  cardTitle: { fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:7, marginBottom:14 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'8px 12px', fontSize:10, color:'#888780', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'0.5px solid #E0DDD6', background:'#F5F3EF' },
  td: { padding:'10px 12px', borderBottom:'0.5px solid #F5F3EF', color:'#111', verticalAlign:'middle' },
  avatar: { width:30, height:30, borderRadius:'50%', background:'#D4570A', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'white', marginRight:8, flexShrink:0 },
  badge: { fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500 },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 },
  modalCard: { background:'white', borderRadius:14, padding:'28px', width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' },
  formGroup: { marginBottom:14 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  saveBtn: { width:'100%', padding:11, background:'#D4570A', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  cancelBtn: { width:'100%', padding:11, background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
}

const goalLabel = { dimagrimento:'Dimagrimento', massa:'Massa muscolare', mantenimento:'Mantenimento', forza:'Forza', resistenza:'Resistenza' }
const goalColor = { dimagrimento:'#FEE2E2', massa:'#EAF3DE', mantenimento:'#FEF0E7', forza:'#EDE9FE', resistenza:'#E0F2FE' }
const goalTextColor = { dimagrimento:'#9B1C1C', massa:'#3B6D11', mantenimento:'#7a3508', forza:'#4C1D95', resistenza:'#075985' }
const initials = name => name ? name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'U'
const today = new Date().toISOString().split('T')[0]

export default function AdminPanel() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('clienti')
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [clientStats, setClientStats] = useState({}) // { [clientId]: { diaryToday, activePlan, latestMeasure } }
  const [loading, setLoading] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [newClient, setNewClient] = useState({ email:'', password:'', full_name:'', goal:'dimagrimento', phone:'', height_cm:'', notes:'' })
  const [newPlan, setNewPlan] = useState({ client_id:'', title:'Piano alimentare', week_number:1, kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65, notes:'' })

  // Ricerca e filtri
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tutti') // tutti | no-piano | no-diario | piano-attivo

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*')
      .neq('role','admin').order('created_at',{ascending:false})
    setClients(prof||[])
    const { data: pl } = await supabase.from('meal_plans').select('*, profiles(full_name)').order('created_at',{ascending:false})
    setPlans(pl||[])

    // Carica statistiche per ogni cliente (diario oggi, piano attivo, ultima misurazione)
    if (prof?.length) {
      const ids = prof.map(c => c.id)
      const [diaryRes, measureRes] = await Promise.all([
        supabase.from('diary_entries').select('client_id').eq('entry_date', today).in('client_id', ids),
        supabase.from('progress_entries').select('client_id, entry_date, weight_kg').in('client_id', ids).order('entry_date', {ascending:false}),
      ])
      const diaryDoneIds = new Set((diaryRes.data||[]).map(d => d.client_id))
      const latestByClient = {}
      ;(measureRes.data||[]).forEach(m => { if (!latestByClient[m.client_id]) latestByClient[m.client_id] = m })

      const stats = {}
      prof.forEach(c => {
        const cp = (pl||[]).filter(p => p.client_id === c.id)
        stats[c.id] = {
          diaryToday: diaryDoneIds.has(c.id),
          activePlan: cp.find(p => p.is_active) || null,
          latestMeasure: latestByClient[c.id] || null,
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
    const { error } = await supabase.from('meal_plans').insert({ ...newPlan, created_by:profile.id, kcal_target:parseInt(newPlan.kcal_target), protein_target_g:parseInt(newPlan.protein_target_g), carbs_target_g:parseInt(newPlan.carbs_target_g), fat_target_g:parseInt(newPlan.fat_target_g), week_number:parseInt(newPlan.week_number) })
    if (error) { setMsg('Errore: '+error.message); setSaving(false); return }
    setMsg('Piano creato!')
    setShowNewPlan(false)
    setNewPlan({ client_id:'', title:'Piano alimentare', week_number:1, kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65, notes:'' })
    setTimeout(() => { setMsg(''); fetchAll() }, 2000)
    setSaving(false)
  }

  async function togglePlan(id, cur) { await supabase.from('meal_plans').update({is_active:!cur}).eq('id',id); fetchAll() }
  async function deletePlan(id) { if (!confirm('Eliminare?')) return; await supabase.from('meal_plans').delete().eq('id',id); fetchAll() }
  const macroKcal = p => (parseInt(p.protein_target_g||0)*4+parseInt(p.carbs_target_g||0)*4+parseInt(p.fat_target_g||0)*9)

  // Applica ricerca e filtri
  const filteredClients = clients.filter(c => {
    if (search && !c.full_name?.toLowerCase().includes(search.toLowerCase())) return false
    const st = clientStats[c.id]
    if (!st) return true
    if (filter === 'no-piano' && st.activePlan) return false
    if (filter === 'no-diario' && st.diaryToday) return false
    if (filter === 'piano-attivo' && !st.activePlan) return false
    return true
  })

  const countNoPiano = clients.filter(c => clientStats[c.id] && !clientStats[c.id].activePlan).length
  const countNoDiario = clients.filter(c => clientStats[c.id] && !clientStats[c.id].diaryToday).length

  return (
    <>
      <div style={s.topbar}>
        <div><div style={{fontSize:15,fontWeight:500,color:'#111'}}>Pannello Admin</div><div style={{fontSize:12,color:'#888780'}}>Gestisci clienti e piani</div></div>
        <div style={{display:'flex',gap:8}}>
          {tab==='clienti'&&<button style={s.btn} onClick={()=>setShowNewClient(true)}><i className="ti ti-user-plus" style={{fontSize:15}}/> Nuovo cliente</button>}
          {tab==='piani'&&<button style={s.btn} onClick={()=>setShowNewPlan(true)}><i className="ti ti-plus" style={{fontSize:15}}/> Nuovo piano</button>}
        </div>
      </div>
      <div style={s.page}>
        {msg&&<div style={{background:'#EAF3DE',border:'0.5px solid #3B6D11',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#3B6D11',marginBottom:14}}>{msg}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
          {[{l:'Clienti',v:clients.length,i:'ti-users'},{l:'Piani attivi',v:plans.filter(p=>p.is_active).length,i:'ti-clipboard-list'},{l:'Piani totali',v:plans.length,i:'ti-files'},{l:'Coach',v:'Federico Obinu',i:'ti-star',sm:true}].map(st=>(
            <div key={st.l} style={s.card}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><i className={`ti ${st.i}`} style={{fontSize:16,color:'#D4570A'}}/><span style={{fontSize:10,color:'#888780',textTransform:'uppercase',letterSpacing:'0.06em'}}>{st.l}</span></div><div style={{fontSize:st.sm?13:22,fontWeight:500,color:'#111'}}>{st.v}</div></div>
          ))}
        </div>
        <div style={s.tabs}>
          {['clienti','piani','progressi','calendario'].map(t=><div key={t} style={tab===t?s.tabActive:s.tab} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
        </div>

        {tab==='clienti'&&(
          <>
          <NotifPanel/>
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-users" style={{fontSize:16,color:'#D4570A'}}/> Clienti ({filteredClients.length}{filteredClients.length!==clients.length?` di ${clients.length}`:''})</div>

            {/* Ricerca */}
            <div style={{position:'relative',marginBottom:10}}>
              <i className="ti ti-search" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#888780'}}/>
              <input style={{...s.input,paddingLeft:36}} placeholder="Cerca cliente per nome..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* Filtri rapidi */}
            <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
              {[
                {id:'tutti', label:`Tutti (${clients.length})`},
                {id:'no-diario', label:`✗ Diario non fatto (${countNoDiario})`},
                {id:'no-piano', label:`Senza piano (${countNoPiano})`},
                {id:'piano-attivo', label:'Con piano attivo'},
              ].map(f=>(
                <button key={f.id} onClick={()=>setFilter(f.id)} style={{
                  padding:'5px 12px',borderRadius:16,fontSize:11,fontWeight:500,cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                  background:filter===f.id?'#D4570A':'white',
                  color:filter===f.id?'white':'#888780',
                  borderColor:filter===f.id?'#D4570A':'#E0DDD6'
                }}>{f.label}</button>
              ))}
            </div>

            {loading?<div style={{textAlign:'center',padding:'30px 0',color:'#888780'}}>Caricamento...</div>:filteredClients.length===0?(
              <div style={{textAlign:'center',padding:'30px 0'}}><i className="ti ti-users" style={{fontSize:40,color:'#E0DDD6',display:'block',marginBottom:10}}/><div style={{fontSize:13,color:'#888780'}}>{clients.length===0?'Nessun cliente ancora.':'Nessun cliente trovato con questi filtri.'}</div></div>
            ):(
              <table style={s.table}>
                <thead><tr><th style={s.th}>Cliente</th><th style={s.th}>Obiettivo</th><th style={s.th}>Diario oggi</th><th style={s.th}>Piano</th><th style={s.th}>Iscritto</th><th style={s.th}>Azioni</th></tr></thead>
                <tbody>{filteredClients.map(c=>{
                  const st = clientStats[c.id] || {}
                  return(
                  <tr key={c.id}>
                    <td style={s.td}><div style={{display:'flex',alignItems:'center'}}><div style={s.avatar}>{initials(c.full_name)}</div><div><div style={{fontWeight:500}}>{c.full_name}</div><div style={{fontSize:11,color:'#888780'}}>{c.height_cm?`${c.height_cm}cm`:'—'}</div></div></div></td>
                    <td style={s.td}><span style={{...s.badge,background:goalColor[c.goal]||'#F5F3EF',color:goalTextColor[c.goal]||'#888780'}}>{goalLabel[c.goal]||'—'}</span></td>
                    <td style={s.td}><span style={{...s.badge,background:st.diaryToday?'#EAF3DE':'#FEE2E2',color:st.diaryToday?'#3B6D11':'#E24B4A'}}>{st.diaryToday?'✓ Fatto':'✗ Da fare'}</span></td>
                    <td style={s.td}>{st.activePlan?<span style={{...s.badge,background:'#FEF0E7',color:'#D4570A'}}>{st.activePlan.title}</span>:<span style={{fontSize:11,color:'#888780'}}>Nessuno</span>}</td>
                    <td style={{...s.td,fontSize:12,color:'#888780'}}>{new Date(c.created_at).toLocaleDateString('it-IT')}</td>
                    <td style={s.td}><div style={{display:'flex',gap:6}}><button style={s.btnSm} onClick={()=>{setNewPlan(p=>({...p,client_id:c.id}));setShowNewPlan(true)}}>+ Piano</button><button style={s.btnGray} onClick={()=>setSelectedClient(c)}>Dettagli</button></div></td>
                  </tr>
                )})}</tbody>
              </table>
            )}
          </div>
          </>
        )}

        {tab==='piani'&&(
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-clipboard-list" style={{fontSize:16,color:'#D4570A'}}/> Piani ({plans.length})</div>
            {plans.length===0?<div style={{textAlign:'center',padding:'30px 0',fontSize:13,color:'#888780'}}>Nessun piano ancora.</div>:(
              <table style={s.table}>
                <thead><tr><th style={s.th}>Piano</th><th style={s.th}>Cliente</th><th style={s.th}>Kcal</th><th style={s.th}>Macro</th><th style={s.th}>Stato</th><th style={s.th}>Azioni</th></tr></thead>
                <tbody>{plans.map(p=>(
                  <tr key={p.id}>
                    <td style={s.td}><div style={{fontWeight:500}}>{p.title}</div><div style={{fontSize:11,color:'#888780'}}>Sett. {p.week_number}</div></td>
                    <td style={s.td}><div style={{display:'flex',alignItems:'center'}}><div style={{...s.avatar,width:24,height:24,fontSize:10,marginRight:6}}>{initials(p.profiles?.full_name||'')}</div><span style={{fontSize:12}}>{p.profiles?.full_name||'—'}</span></div></td>
                    <td style={s.td}><span style={{fontWeight:500}}>{p.kcal_target}</span><span style={{fontSize:11,color:'#888780'}}> kcal</span></td>
                    <td style={s.td}><div style={{fontSize:11,color:'#888780'}}>P{p.protein_target_g}g C{p.carbs_target_g}g G{p.fat_target_g}g</div></td>
                    <td style={s.td}><span style={{...s.badge,background:p.is_active?'#EAF3DE':'#F5F3EF',color:p.is_active?'#3B6D11':'#888780'}}>{p.is_active?'Attivo':'Inattivo'}</span></td>
                    <td style={s.td}><div style={{display:'flex',gap:6}}><button style={s.btnSm} onClick={()=>togglePlan(p.id,p.is_active)}>{p.is_active?'Disattiva':'Attiva'}</button><button style={{...s.btnGray,color:'#E24B4A'}} onClick={()=>deletePlan(p.id)}><i className="ti ti-trash" style={{fontSize:13}}/></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {tab==='progressi'&&(
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-chart-line" style={{fontSize:16,color:'#D4570A'}}/> Progressi clienti</div>
            {clients.length===0?<div style={{textAlign:'center',padding:'30px 0',fontSize:13,color:'#888780'}}>Nessun cliente ancora.</div>:<div style={{display:'flex',flexDirection:'column',gap:10}}>{clients.map(c=><ClientProgress key={c.id} client={c}/>)}</div>}
          </div>
        )}

        {tab==='calendario'&&<CalendarioAdmin/>}
      </div>

      {showNewClient&&(
        <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setShowNewClient(false)}>
          <div style={s.modalCard}>
            <div style={{fontSize:16,fontWeight:500,color:'#111',marginBottom:4}}>Nuovo cliente</div>
            <div style={{fontSize:12,color:'#888780',marginBottom:20}}>Crea l'account e comunicagli le credenziali.</div>
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
                <option value="dimagrimento">Dimagrimento</option><option value="massa">Massa muscolare</option><option value="mantenimento">Mantenimento</option><option value="forza">Forza</option><option value="resistenza">Resistenza</option>
              </select>
            </div>
            <div style={s.formGroup}><label style={s.label}>Note</label><textarea style={{...s.input,height:60,resize:'vertical'}} value={newClient.notes} onChange={e=>setNewClient(p=>({...p,notes:e.target.value}))}/></div>
            {msg&&<div style={{fontSize:12,color:'#D4570A',marginBottom:10}}>{msg}</div>}
            <button style={s.saveBtn} onClick={createClient} disabled={saving}>{saving?'Creazione...':'Crea cliente'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowNewClient(false)}>Annulla</button>
          </div>
        </div>
      )}

      {showNewPlan&&(
        <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setShowNewPlan(false)}>
          <div style={s.modalCard}>
            <div style={{fontSize:16,fontWeight:500,color:'#111',marginBottom:4}}>Nuovo piano alimentare</div>
            <div style={{fontSize:12,color:'#888780',marginBottom:20}}>Assegna un piano a un cliente.</div>
            <div style={s.formGroup}><label style={s.label}>Cliente *</label>
              <select style={s.select} value={newPlan.client_id} onChange={e=>setNewPlan(p=>({...p,client_id:e.target.value}))}>
                <option value="">Seleziona...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Titolo</label><input style={s.input} value={newPlan.title} onChange={e=>setNewPlan(p=>({...p,title:e.target.value}))}/></div>
              <div style={s.formGroup}><label style={s.label}>Settimana</label><input style={s.input} type="number" value={newPlan.week_number} onChange={e=>setNewPlan(p=>({...p,week_number:e.target.value}))}/></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Calorie target (kcal)</label><input style={s.input} type="number" value={newPlan.kcal_target} onChange={e=>setNewPlan(p=>({...p,kcal_target:e.target.value}))}/></div>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Proteine (g)</label><input style={s.input} type="number" value={newPlan.protein_target_g} onChange={e=>setNewPlan(p=>({...p,protein_target_g:e.target.value}))}/></div>
              <div style={s.formGroup}><label style={s.label}>Carboidrati (g)</label><input style={s.input} type="number" value={newPlan.carbs_target_g} onChange={e=>setNewPlan(p=>({...p,carbs_target_g:e.target.value}))}/></div>
              <div style={s.formGroup}><label style={s.label}>Grassi (g)</label><input style={s.input} type="number" value={newPlan.fat_target_g} onChange={e=>setNewPlan(p=>({...p,fat_target_g:e.target.value}))}/></div>
              <div style={s.formGroup}><label style={s.label}>Kcal dai macro</label><div style={{padding:'9px 12px',background:'#FEF0E7',borderRadius:8,fontSize:13,color:'#D4570A',fontWeight:500}}>{macroKcal(newPlan)} kcal</div></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Note coach</label><textarea style={{...s.input,height:60,resize:'vertical'}} value={newPlan.notes} onChange={e=>setNewPlan(p=>({...p,notes:e.target.value}))}/></div>
            {msg&&<div style={{fontSize:12,color:'#D4570A',marginBottom:10}}>{msg}</div>}
            <button style={s.saveBtn} onClick={createPlan} disabled={saving}>{saving?'Creazione...':'Crea piano'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowNewPlan(false)}>Annulla</button>
          </div>
        </div>
      )}

      {selectedClient&&(
        <ClientDetailModal
          client={selectedClient}
          plans={plans.filter(p=>p.client_id===selectedClient.id)}
          onClose={()=>setSelectedClient(null)}
          onSaved={fetchAll}
          onNewPlan={()=>{setNewPlan(p=>({...p,client_id:selectedClient.id}));setSelectedClient(null);setShowNewPlan(true)}}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
// VISTA DETTAGLIO CLIENTE COMPLETA
// ─────────────────────────────────────────────────────────
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
  const [allSessionsCount, setAllSessionsCount] = useState(0)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { loadData() }, [client.id])

  async function loadData() {
    setLoadingData(true)
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
    const [measRes, photoRes, diaryRes, sessionsRes, sessionsCountRes] = await Promise.all([
      supabase.from('progress_entries').select('*').eq('client_id', client.id).order('entry_date',{ascending:false}).limit(3),
      supabase.from('progress_photos').select('*').eq('client_id', client.id).order('photo_date',{ascending:false}).limit(6),
      supabase.from('diary_entries').select('entry_date, kcal').eq('client_id', client.id).gte('entry_date', sevenDaysAgo),
      supabase.from('workout_sessions').select('*').eq('client_id', client.id).order('session_date',{ascending:false}).limit(5),
      supabase.from('workout_sessions').select('id', {count:'exact', head:true}).eq('client_id', client.id),
    ])
    setAllSessionsCount(sessionsCountRes.count || 0)
    setMeasurements(measRes.data || [])
    setPhotos(photoRes.data || [])
    setWorkoutSessions(sessionsRes.data || [])

    // Raggruppa diario per giorno
    const byDay = {}
    ;(diaryRes.data||[]).forEach(d => { byDay[d.entry_date] = (byDay[d.entry_date]||0) + (d.kcal||0) })
    const days = []
    for (let i=6;i>=0;i--) {
      const d = new Date(Date.now() - i*24*60*60*1000).toISOString().split('T')[0]
      days.push({ date:d, kcal: Math.round(byDay[d]||0) })
    }
    setDiaryWeek(days)
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

  const activePlan = plans.find(p => p.is_active)
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
              <div style={{fontSize:16,fontWeight:600,color:'#111'}}>{client.full_name}</div>
            )}
            <div style={{fontSize:12,color:'#888780',marginTop:2}}>Iscritto il {new Date(client.created_at).toLocaleDateString('it-IT')}</div>
          </div>
          <button onClick={()=>setEditing(!editing)} style={{...s.btnSm, background: editing?'#F5F3EF':'#FEF0E7', color: editing?'#888780':'#D4570A', borderColor: editing?'#E0DDD6':'#D4570A'}}>
            <i className={`ti ${editing?'ti-x':'ti-pencil'}`} style={{fontSize:13,marginRight:4}}/>{editing?'Annulla':'Modifica'}
          </button>
        </div>

        {/* INFO PROFILO — vista o editing */}
        {editing ? (
          <div style={{background:'#F5F3EF',borderRadius:10,padding:14,marginBottom:16}}>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Obiettivo</label>
                <select style={s.select} value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))}>
                  <option value="dimagrimento">Dimagrimento</option><option value="massa">Massa muscolare</option><option value="mantenimento">Mantenimento</option><option value="forza">Forza</option><option value="resistenza">Resistenza</option>
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
                {l:'Piani totali',v:plans.length},
              ].map(r=>(
                <div key={r.l} style={{background:'#F5F3EF',borderRadius:8,padding:'8px 12px'}}>
                  <div style={{fontSize:10,color:'#888780',textTransform:'uppercase',letterSpacing:'0.06em'}}>{r.l}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#111',marginTop:2}}>{r.v}</div>
                </div>
              ))}
            </div>
            {client.notes&&(
              <div style={{marginBottom:10,background:'#F5F3EF',borderLeft:'3px solid #888780',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#555'}}>
                <div style={{fontSize:10,color:'#888780',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>Note</div>
                {client.notes}
              </div>
            )}
            {client.coach_notes&&(
              <div style={{marginBottom:14,background:'#FEF0E7',borderLeft:'3px solid #D4570A',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#7a3508'}}>
                <div style={{fontSize:10,color:'#D4570A',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:4}}><i className="ti ti-lock" style={{fontSize:10}}/>Note private coach</div>
                {client.coach_notes}
              </div>
            )}
          </>
        )}

        {/* PIANO ATTIVO */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Piano alimentare</div>
          {activePlan ? (
            <div style={{background:'#FEF0E7',border:'0.5px solid #F4C9A8',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'#7a3508'}}>{activePlan.title}</div>
                <div style={{fontSize:11,color:'#D4570A',marginTop:2}}>{activePlan.kcal_target} kcal · P{activePlan.protein_target_g}g C{activePlan.carbs_target_g}g G{activePlan.fat_target_g}g</div>
              </div>
              <span style={{...s.badge,background:'#3B6D11',color:'white'}}>Attivo</span>
            </div>
          ) : (
            <div style={{background:'#F5F3EF',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'#888780'}}>Nessun piano attivo</span>
              <button style={s.btnSm} onClick={onNewPlan}>+ Crea piano</button>
            </div>
          )}
        </div>

        {/* DIARIO ULTIMI 7 GIORNI */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Diario — ultimi 7 giorni</div>
          {loadingData ? (
            <div style={{fontSize:12,color:'#888780'}}>Caricamento...</div>
          ) : (
            <div style={{display:'flex',gap:4}}>
              {diaryWeek.map(d => {
                const target = activePlan?.kcal_target || 2200
                const pct = Math.min(100, Math.round(d.kcal/target*100))
                const dayLabel = new Date(d.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'}).slice(0,1).toUpperCase()
                return (
                  <div key={d.date} style={{flex:1,textAlign:'center'}}>
                    <div style={{height:50,background:'#F5F3EF',borderRadius:6,display:'flex',alignItems:'flex-end',overflow:'hidden'}}>
                      <div style={{width:'100%',height:`${Math.max(pct,d.kcal>0?8:0)}%`,background:d.kcal===0?'transparent':pct>=90?'#3B6D11':'#D4570A',borderRadius:6,transition:'height 0.3s'}}/>
                    </div>
                    <div style={{fontSize:9,color:'#888780',marginTop:3}}>{dayLabel}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* MISURAZIONI */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Ultime misurazioni</div>
          {measurements.length === 0 ? (
            <div style={{fontSize:12,color:'#888780'}}>Nessuna misurazione registrata</div>
          ) : (
            <div style={{display:'flex',gap:16,alignItems:'center'}}>
              {latest.weight_kg && (
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:'#111'}}>{latest.weight_kg}<span style={{fontSize:11,color:'#888780'}}>kg</span></div>
                  {weightDiff && <div style={{fontSize:11,color:parseFloat(weightDiff)<0?'#3B6D11':'#E24B4A',fontWeight:600}}>{parseFloat(weightDiff)>0?'+':''}{weightDiff}kg</div>}
                </div>
              )}
              {latest.waist_cm && <div><div style={{fontSize:18,fontWeight:700,color:'#111'}}>{latest.waist_cm}<span style={{fontSize:11,color:'#888780'}}>cm</span></div><div style={{fontSize:10,color:'#888780'}}>Vita</div></div>}
              {latest.body_fat_pct && <div><div style={{fontSize:18,fontWeight:700,color:'#111'}}>{latest.body_fat_pct}<span style={{fontSize:11,color:'#888780'}}>%</span></div><div style={{fontSize:10,color:'#888780'}}>Grasso</div></div>}
              <div style={{marginLeft:'auto',fontSize:11,color:'#888780'}}>{new Date(latest.entry_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>
            </div>
          )}
        </div>

        {/* NOTE ALLENAMENTO */}
        {workoutSessions.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                <i className="ti ti-barbell" style={{fontSize:12,marginRight:4}}/>Allenamenti recenti
              </div>
              {!showAllSessions && allSessionsCount > workoutSessions.length && (
                <button onClick={loadAllSessions} style={{background:'none',border:'none',color:'#D4570A',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  Vedi tutto ({allSessionsCount}) →
                </button>
              )}
            </div>
            <div style={{maxHeight: showAllSessions ? 320 : 'none', overflowY: showAllSessions ? 'auto' : 'visible'}}>
              {workoutSessions.map(sess => {
                const pct = sess.sets_total > 0 ? Math.round(sess.sets_completed/sess.sets_total*100) : 0
                return (
                  <div key={sess.id} style={{background:'#F5F3EF',borderRadius:8,padding:'10px 12px',marginBottom:6,fontSize:12,color:'#555',lineHeight:1.5}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#888780',marginBottom:sess.notes?3:0,fontWeight:600}}>
                      <span>{sess.day_label} · {new Date(sess.session_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                      <span style={{color: pct>=100?'#3B6D11':'#D4570A'}}>{sess.sets_completed}/{sess.sets_total} ({pct}%)</span>
                    </div>
                    {sess.notes}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FOTO RECENTI */}
        {photos.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Foto recenti ({photos.length})</div>
            <div style={{display:'flex',gap:6,overflowX:'auto'}}>
              {photos.map(p => (
                <img key={p.id} src={p.photo_url} alt={p.label} style={{width:60,height:80,objectFit:'cover',borderRadius:8,flexShrink:0}}/>
              ))}
            </div>
          </div>
        )}

        <button style={s.cancelBtn} onClick={onClose}>Chiudi</button>
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
    <div style={{background:'white',borderRadius:12,border:'0.5px solid #E0DDD6',padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:'white',flexShrink:0}}>{ini}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:500,color:'#111'}}>{client.full_name}</div>
          <div style={{fontSize:11,color:'#888780'}}>{client.goal || 'Obiettivo non impostato'}</div>
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
              <div style={{fontSize:14,fontWeight:600,color:'#111'}}>{m.v}</div>
              <div style={{fontSize:10,color:'#888780'}}>{m.l}</div>
            </div>
          ))}
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontSize:10,color:'#888780'}}>Ultima misurazione</div>
            <div style={{fontSize:11,color:'#111'}}>{new Date(latest.entry_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>
          </div>
        </div>
      ) : (
        <div style={{fontSize:11,color:'#888780',paddingTop:8,borderTop:'0.5px solid #F5F3EF'}}>
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
          <div style={{textAlign:'center',padding:'20px 0',color:'#888780',fontSize:13}}>Caricamento...</div>
        ) : confirmedBookings.length === 0 ? (
          <div style={{textAlign:'center',padding:'30px 0',fontSize:13,color:'#888780'}}>Nessuna chiamata prenotata.</div>
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
        <div style={{fontSize:12,color:'#888780',marginBottom:14}}>
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
                style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:8,border:'0.5px solid #E0DDD6',background:isSelected?'#D4570A':'#F5F3EF',color:isSelected?'white':'#111',fontFamily:'inherit',fontSize:13,fontWeight:500,cursor:'pointer'}}>
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
                          background: booked?'#FEF0E7':blocked?'#F5F3EF':'#EAF3DE',
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
        <div style={{display:'flex',gap:16,marginTop:14,fontSize:11,color:'#888780'}}>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#EAF3DE',marginRight:4,verticalAlign:'middle'}}/>Libero</div>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#F5F3EF',marginRight:4,verticalAlign:'middle'}}/>Bloccato (clicca per liberare)</div>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#FEF0E7',marginRight:4,verticalAlign:'middle'}}/>Prenotato</div>
        </div>
      </div>
    </>
  )
}
