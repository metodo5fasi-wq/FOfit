import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:500, cursor:'pointer' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 12px', fontSize:12, cursor:'pointer' },
  tabs: { display:'flex', gap:6, marginBottom:18 },
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
  modalCard: { background:'white', borderRadius:14, padding:'28px', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' },
  formGroup: { marginBottom:14 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  saveBtn: { width:'100%', padding:11, background:'#D4570A', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  cancelBtn: { width:'100%', padding:11, background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
}

const goalLabel = { dimagrimento:'Dimagrimento', massa:'Massa muscolare', mantenimento:'Mantenimento', forza:'Forza', resistenza:'Resistenza' }
const goalColor = { dimagrimento:'#FEE2E2', massa:'#EAF3DE', mantenimento:'#FEF0E7', forza:'#EDE9FE', resistenza:'#E0F2FE' }
const goalTextColor = { dimagrimento:'#9B1C1C', massa:'#3B6D11', mantenimento:'#7a3508', forza:'#4C1D95', resistenza:'#075985' }
const initials = name => name ? name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'U'

export default function AdminPanel() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('clienti')
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [newClient, setNewClient] = useState({ email:'', password:'', full_name:'', goal:'dimagrimento', phone:'', height_cm:'', notes:'' })
  const [newPlan, setNewPlan] = useState({ client_id:'', title:'Piano alimentare', week_number:1, kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65, notes:'' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*')
      .neq('role','admin').order('created_at',{ascending:false})
    setClients(prof||[])
    const { data: pl } = await supabase.from('meal_plans').select('*, profiles(full_name)').order('created_at',{ascending:false})
    setPlans(pl||[])
    setLoading(false)
  }

  async function createClient() {
    if (!newClient.email||!newClient.password||!newClient.full_name) { setMsg('Compila tutti i campi obbligatori'); return }
    setSaving(true)

    // Usa la API route per creare il cliente senza fare login automatico
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newClient.email,
          password: newClient.password,
          full_name: newClient.full_name,
          goal: newClient.goal,
          phone: newClient.phone,
          height_cm: newClient.height_cm,
          notes: newClient.notes,
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
          {['clienti','piani','progressi'].map(t=><div key={t} style={tab===t?s.tabActive:s.tab} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
        </div>

        {tab==='clienti'&&(
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-users" style={{fontSize:16,color:'#D4570A'}}/> Clienti ({clients.length})</div>
            {loading?<div style={{textAlign:'center',padding:'30px 0',color:'#888780'}}>Caricamento...</div>:clients.length===0?(
              <div style={{textAlign:'center',padding:'30px 0'}}><i className="ti ti-users" style={{fontSize:40,color:'#E0DDD6',display:'block',marginBottom:10}}/><div style={{fontSize:13,color:'#888780'}}>Nessun cliente ancora.</div></div>
            ):(
              <table style={s.table}>
                <thead><tr><th style={s.th}>Cliente</th><th style={s.th}>Obiettivo</th><th style={s.th}>Piani</th><th style={s.th}>Iscritto</th><th style={s.th}>Azioni</th></tr></thead>
                <tbody>{clients.map(c=>{const cp=plans.filter(p=>p.client_id===c.id);const ap=cp.find(p=>p.is_active);return(
                  <tr key={c.id}>
                    <td style={s.td}><div style={{display:'flex',alignItems:'center'}}><div style={s.avatar}>{initials(c.full_name)}</div><div><div style={{fontWeight:500}}>{c.full_name}</div><div style={{fontSize:11,color:'#888780'}}>{c.height_cm?`${c.height_cm}cm`:'—'}</div></div></div></td>
                    <td style={s.td}><span style={{...s.badge,background:goalColor[c.goal]||'#F5F3EF',color:goalTextColor[c.goal]||'#888780'}}>{goalLabel[c.goal]||'—'}</span></td>
                    <td style={s.td}><span style={{fontSize:12}}>{cp.length} piano{cp.length!==1?'i':''}</span>{ap&&<span style={{...s.badge,background:'#EAF3DE',color:'#3B6D11',marginLeft:6}}>attivo</span>}</td>
                    <td style={{...s.td,fontSize:12,color:'#888780'}}>{new Date(c.created_at).toLocaleDateString('it-IT')}</td>
                    <td style={s.td}><div style={{display:'flex',gap:6}}><button style={s.btnSm} onClick={()=>{setNewPlan(p=>({...p,client_id:c.id}));setShowNewPlan(true)}}>+ Piano</button><button style={s.btnGray} onClick={()=>setSelectedClient(c)}>Dettagli</button></div></td>
                  </tr>
                )})}</tbody>
              </table>
            )}
          </div>
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
        <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setSelectedClient(null)}>
          <div style={s.modalCard}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:'#D4570A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:500,color:'white'}}>{initials(selectedClient.full_name)}</div>
              <div><div style={{fontSize:16,fontWeight:500,color:'#111'}}>{selectedClient.full_name}</div><div style={{fontSize:12,color:'#888780'}}>Cliente FOfit</div></div>
            </div>
            {[{l:'Obiettivo',v:goalLabel[selectedClient.goal]||'—'},{l:'Altezza',v:selectedClient.height_cm?`${selectedClient.height_cm} cm`:'—'},{l:'Telefono',v:selectedClient.phone||'—'},{l:'Iscritto il',v:new Date(selectedClient.created_at).toLocaleDateString('it-IT')},{l:'Piani',v:plans.filter(p=>p.client_id===selectedClient.id).length}].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'0.5px solid #F5F3EF'}}><span style={{fontSize:12,color:'#888780'}}>{r.l}</span><span style={{fontSize:13,fontWeight:500,color:'#111'}}>{r.v}</span></div>
            ))}
            {selectedClient.notes&&<div style={{marginTop:12,background:'#FEF0E7',borderLeft:'3px solid #D4570A',borderRadius:6,padding:'10px 12px',fontSize:12,color:'#7a3508'}}>{selectedClient.notes}</div>}
            <button style={{...s.saveBtn,marginTop:20}} onClick={()=>{setNewPlan(p=>({...p,client_id:selectedClient.id}));setSelectedClient(null);setShowNewPlan(true)}}>+ Crea piano</button>
            <button style={s.cancelBtn} onClick={()=>setSelectedClient(null)}>Chiudi</button>
          </div>
        </div>
      )}
    </>
  )
}

function ClientProgress({ client }) {
  const [latest, setLatest] = useState(null)
  const [diaryToday, setDiaryToday] = useState(false)
  const [activePlan, setActivePlan] = useState(null)
  const today = new Date().toISOString().split('T')[0]

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
            <div style={{fontSize:11,color:'#111'}}>{new Date(latest.entry_date).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>
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
