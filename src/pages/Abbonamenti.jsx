import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  badge: { fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:600 },
}

const TIPI = ['Mensile','Trimestrale','Semestrale','Annuale','Pacchetto sedute','Altro']
const initials = name => name ? name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'

function daysLeft(endDate) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate) - new Date()) / (1000*60*60*24))
}

function StatusBadge({ days }) {
  if (days === null) return <span style={{...s.badge, background:'#F5F3EF', color:'#888780'}}>Non impostato</span>
  if (days < 0) return <span style={{...s.badge, background:'#FEE2E2', color:'#E24B4A'}}>Scaduto {Math.abs(days)}gg fa</span>
  if (days <= 7) return <span style={{...s.badge, background:'#FEF0E7', color:'#D4570A'}}>⚠ Scade in {days}gg</span>
  if (days <= 30) return <span style={{...s.badge, background:'#FEF8E7', color:'#E8A020'}}>Scade in {days}gg</span>
  return <span style={{...s.badge, background:'#EAF3DE', color:'#3B6D11'}}>✓ Attivo ({days}gg)</span>
}

export default function Abbonamenti() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('tutti')

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    setLoading(true)
    const { data } = await supabase.from('profiles')
      .select('id,full_name,subscription_start,subscription_end,subscription_type,subscription_notes')
      .eq('role','client').order('full_name')
    setClients(data||[])
    setLoading(false)
  }

  function openEdit(c) {
    setEditing(c.id)
    setForm({
      subscription_start: c.subscription_start||'',
      subscription_end: c.subscription_end||'',
      subscription_type: c.subscription_type||'Mensile',
      subscription_notes: c.subscription_notes||'',
    })
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      subscription_start: form.subscription_start||null,
      subscription_end: form.subscription_end||null,
      subscription_type: form.subscription_type,
      subscription_notes: form.subscription_notes,
    }).eq('id', editing)
    if (error) {
      alert('Errore salvataggio: ' + error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setEditing(null)
    fetchClients()
  }

  async function renew(c) {
    if (!c.subscription_end || !c.subscription_type) return
    const end = new Date(c.subscription_end)
    const days = c.subscription_type==='Mensile'?30:c.subscription_type==='Trimestrale'?90:c.subscription_type==='Semestrale'?180:c.subscription_type==='Annuale'?365:30
    end.setDate(end.getDate() + days)
    await supabase.from('profiles').update({
      subscription_start: c.subscription_end,
      subscription_end: end.toISOString().split('T')[0],
    }).eq('id', c.id)
    fetchClients()
  }

  const today = new Date().toISOString().split('T')[0]
  const scaduti = clients.filter(c => c.subscription_end && c.subscription_end < today)
  const inScadenza = clients.filter(c => { const d = daysLeft(c.subscription_end); return d!==null && d>=0 && d<=7 })
  const attivi = clients.filter(c => { const d = daysLeft(c.subscription_end); return d!==null && d>7 })
  const nonImpostati = clients.filter(c => !c.subscription_end)

  const filtered = filter==='scaduti' ? scaduti : filter==='in_scadenza' ? inScadenza : filter==='attivi' ? attivi : filter==='non_impostati' ? nonImpostati : clients

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#111'}}>Abbonamenti</div>
          <div style={{fontSize:12,color:'#888780'}}>{clients.length} clienti · {attivi.length} attivi · {scaduti.length} scaduti</div>
        </div>
      </div>
      <div style={s.page}>

        {/* ALERT SCADENZE */}
        {(scaduti.length > 0 || inScadenza.length > 0) && (
          <div style={{background:'#FEF0E7',border:'0.5px solid #D4570A',borderRadius:12,padding:'14px',marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
              <i className="ti ti-alert-triangle" style={{fontSize:14}}/>
              {scaduti.length > 0 && `${scaduti.length} scaduto${scaduti.length>1?'i':''}`}
              {scaduti.length > 0 && inScadenza.length > 0 && ' · '}
              {inScadenza.length > 0 && `${inScadenza.length} in scadenza entro 7 giorni`}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[...scaduti,...inScadenza].map(c=>(
                <div key={c.id} style={{background:'white',borderRadius:8,padding:'6px 12px',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#111'}}>{c.full_name}</span>
                  <StatusBadge days={daysLeft(c.subscription_end)}/>
                  <button onClick={()=>renew(c)} style={{...s.btnSm,fontSize:10}}>Rinnova</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
          {[
            {l:'Totali',v:clients.length,c:'#4A90D4',f:'tutti'},
            {l:'Attivi',v:attivi.length,c:'#3B6D11',f:'attivi'},
            {l:'In scadenza',v:inScadenza.length,c:'#E8A020',f:'in_scadenza'},
            {l:'Scaduti',v:scaduti.length,c:'#E24B4A',f:'scaduti'},
          ].map(st=>(
            <div key={st.l} onClick={()=>setFilter(st.f)} style={{background:'white',borderRadius:10,border:`0.5px solid ${filter===st.f?st.c:'#E0DDD6'}`,padding:'12px',cursor:'pointer',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:st.c}}>{st.v}</div>
              <div style={{fontSize:10,color:'#888780',marginTop:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>{st.l}</div>
            </div>
          ))}
        </div>

        {/* LISTA */}
        {loading ? <div style={{textAlign:'center',padding:'40px',color:'#888780'}}>Caricamento...</div> :
          filtered.map(c => {
            const days = daysLeft(c.subscription_end)
            const isEditing = editing === c.id
            return (
              <div key={c.id} style={s.card}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:isEditing?12:0}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
                    {initials(c.full_name)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#111'}}>{c.full_name}</div>
                    <div style={{fontSize:11,color:'#888780',marginTop:2}}>
                      {c.subscription_type||'—'}
                      {c.subscription_start && ` · Dal ${new Date(c.subscription_start+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}`}
                      {c.subscription_end && ` · Al ${new Date(c.subscription_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}`}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                    <StatusBadge days={days}/>
                    {c.subscription_end && days <= 30 && (
                      <button onClick={()=>renew(c)} style={s.btnSm}>↻ Rinnova</button>
                    )}
                    <button onClick={()=>isEditing?setEditing(null):openEdit(c)} style={s.btnGray}>
                      {isEditing?'Annulla':'✏️'}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div style={{borderTop:'0.5px solid #E0DDD6',paddingTop:12}}>
                    <div style={s.grid2}>
                      <div><label style={s.label}>Tipo abbonamento</label>
                        <select style={s.select} value={form.subscription_type} onChange={e=>setForm(p=>({...p,subscription_type:e.target.value}))}>
                          {TIPI.map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div/>
                      <div><label style={s.label}>Data inizio</label><input style={s.input} type="date" value={form.subscription_start} onChange={e=>setForm(p=>({...p,subscription_start:e.target.value}))}/></div>
                      <div><label style={s.label}>Data scadenza</label><input style={s.input} type="date" value={form.subscription_end} onChange={e=>setForm(p=>({...p,subscription_end:e.target.value}))}/></div>
                    </div>
                    <div style={{marginTop:8}}><label style={s.label}>Note</label><input style={s.input} value={form.subscription_notes} onChange={e=>setForm(p=>({...p,subscription_notes:e.target.value}))} placeholder="es. pagamento mensile, bonifico..."/></div>
                    <div style={{marginTop:10,display:'flex',gap:8}}>
                      <button onClick={save} disabled={saving} style={{...s.btn,fontSize:12}}>{saving?'Salvo...':'Salva'}</button>
                    </div>
                  </div>
                )}
                {c.subscription_notes && !isEditing && (
                  <div style={{fontSize:11,color:'#888780',marginTop:8,fontStyle:'italic'}}>{c.subscription_notes}</div>
                )}
              </div>
            )
          })
        }
      </div>
    </>
  )
}
