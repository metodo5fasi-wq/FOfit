import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px', WebkitOverflowScrolling:'touch' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' },
  btnGreen: { background:'#EAF3DE', color:'#3B6D11', border:'0.5px solid #3B6D11', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  badge: { fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:600 },
}

const TIPI = ['Mensile','Trimestrale','Semestrale','Annuale','Pacchetto sedute','Altro']
const initials = n => n ? n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'

function daysLeft(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / 86400000)
}

function StatusBadge({ days }) {
  if (days === null) return <span style={{...s.badge, background:'#F5F3EF', color:'#888780'}}>Non impostato</span>
  if (days < 0) return <span style={{...s.badge, background:'#FEE2E2', color:'#E24B4A'}}>Scaduto {Math.abs(days)}gg fa</span>
  if (days <= 4) return <span style={{...s.badge, background:'#FEE2E2', color:'#E24B4A'}}>⚠ Scade in {days}gg</span>
  if (days <= 7) return <span style={{...s.badge, background:'#FEF0E7', color:'#D4570A'}}>⚠ Scade in {days}gg</span>
  if (days <= 30) return <span style={{...s.badge, background:'#FEF8E7', color:'#E8A020'}}>Scade in {days}gg</span>
  return <span style={{...s.badge, background:'#EAF3DE', color:'#3B6D11'}}>✓ Attivo ({days}gg)</span>
}

export default function Abbonamenti() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [installments, setInstallments] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    setLoading(true)
    const { data } = await supabase.from('profiles')
      .select('id,full_name,subscription_start,subscription_end,subscription_type,subscription_notes,payment_type,installments,installment_amount,installments_paid')
      .eq('role','client').order('full_name')
    setClients(data||[])
    setLoading(false)
    // Notifiche automatiche scadenza
    if (data) sendExpiryNotifications(data)
  }

  async function sendExpiryNotifications(list) {
    for (const c of list) {
      const days = daysLeft(c.subscription_end)
      if (days === 4) {
        const { data: ex } = await supabase.from('notifications')
          .select('id').eq('client_id',c.id).eq('type','subscription_expiring')
          .gte('created_at', new Date(Date.now()-86400000).toISOString())
        if (!ex?.length) await supabase.from('notifications').insert({
          client_id:c.id, type:'subscription_expiring',
          title:'⚠️ Abbonamento in scadenza',
          body:`Il tuo abbonamento scadrà tra 4 giorni. Contatta il coach per il rinnovo.`
        })
      }
      if (days !== null && days <= 0) {
        const { data: ex } = await supabase.from('notifications')
          .select('id').eq('client_id',c.id).eq('type','subscription_expired')
          .gte('created_at', new Date(Date.now()-86400000).toISOString())
        if (!ex?.length) await supabase.from('notifications').insert({
          client_id:c.id, type:'subscription_expired',
          title:'🔒 Abbonamento scaduto',
          body:`Il tuo abbonamento è scaduto. Contatta il coach per rinnovare l'accesso.`
        })
      }
    }
  }

  async function openEdit(c) {
    setEditing(c.id)
    setForm({
      subscription_start: c.subscription_start||'',
      subscription_end: c.subscription_end||'',
      subscription_type: c.subscription_type||'Mensile',
      subscription_notes: c.subscription_notes||'',
      payment_type: c.payment_type||'unica',
      installments: c.installments||2,
      installment_amount: c.installment_amount||'',
      installments_paid: c.installments_paid||0,
    })
    const { data } = await supabase.from('subscription_installments')
      .select('*').eq('client_id',c.id).order('due_date')
    setInstallments(data||[])
  }

  function generateInstallments() {
    if (!form.installment_amount || !form.subscription_start) return
    const start = new Date(form.subscription_start)
    const list = []
    for (let i = 0; i < parseInt(form.installments||2); i++) {
      const d = new Date(start)
      d.setMonth(d.getMonth()+i)
      list.push({ due_date: d.toISOString().split('T')[0], amount: parseFloat(form.installment_amount), paid_at: null })
    }
    setInstallments(list)
  }

  async function markPaid(idx) {
    const updated = installments.map((inst,i) => i===idx ? {...inst, paid_at: new Date().toISOString()} : inst)
    setInstallments(updated)
    const paidCount = updated.filter(i=>i.paid_at).length
    setForm(p=>({...p, installments_paid: paidCount}))
  }

  async function unmarkPaid(idx) {
    const updated = installments.map((inst,i) => i===idx ? {...inst, paid_at: null} : inst)
    setInstallments(updated)
    const paidCount = updated.filter(i=>i.paid_at).length
    setForm(p=>({...p, installments_paid: paidCount}))
  }

  async function save() {
    setSaving(true)
    try {
      const paidCount = form.payment_type==='rate'
        ? installments.filter(i=>i.paid_at).length
        : null

      await supabase.from('profiles').update({
        subscription_start: form.subscription_start||null,
        subscription_end: form.subscription_end||null,
        subscription_type: form.subscription_type,
        subscription_notes: form.subscription_notes||null,
        payment_type: form.payment_type||'unica',
        installments: form.payment_type==='rate' ? parseInt(form.installments)||2 : 1,
        installment_amount: form.payment_type==='rate' ? parseFloat(form.installment_amount)||null : null,
        installments_paid: paidCount,
      }).eq('id', editing)

      // Salva rate
      if (form.payment_type==='rate' && installments.length > 0) {
        await supabase.from('subscription_installments').delete().eq('client_id', editing)
        await supabase.from('subscription_installments').insert(
          installments.map(inst=>({ client_id:editing, amount:inst.amount, due_date:inst.due_date||null, paid_at:inst.paid_at||null }))
        )
      }

      setEditing(null)
      fetchClients()
    } catch(e) { alert('Errore: '+e.message) }
    setSaving(false)
  }

  async function renew(c) {
    if (!c.subscription_end || !c.subscription_type) return
    const end = new Date(c.subscription_end)
    const days = {Mensile:30,Trimestrale:90,Semestrale:180,Annuale:365}[c.subscription_type]||30
    end.setDate(end.getDate()+days)
    await supabase.from('profiles').update({
      subscription_start: c.subscription_end,
      subscription_end: end.toISOString().split('T')[0],
    }).eq('id',c.id)
    await supabase.from('notifications').insert({
      client_id:c.id, type:'subscription_renewed',
      title:'✅ Abbonamento rinnovato',
      body:`Il tuo abbonamento è stato rinnovato fino al ${end.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}.`
    })
    fetchClients()
  }

  const today = new Date().toISOString().split('T')[0]
  const scaduti = clients.filter(c=>c.subscription_end && c.subscription_end < today)
  const inScadenza = clients.filter(c=>{ const d=daysLeft(c.subscription_end); return d!==null&&d>=0&&d<=7 })
  const attivi = clients.filter(c=>{ const d=daysLeft(c.subscription_end); return d!==null&&d>7 })

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'#111'}}>Abbonamenti</div>
          <div style={{fontSize:11,color:'#888780'}}>{clients.length} clienti · {attivi.length} attivi · {scaduti.length} scaduti</div>
        </div>
      </div>

      <div style={s.page}>
        {/* ALERT */}
        {(scaduti.length>0||inScadenza.length>0) && (
          <div style={{background:'#FEF0E7',border:'0.5px solid #D4570A',borderRadius:12,padding:'12px',marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:8}}>
              {scaduti.length>0&&`${scaduti.length} scadut${scaduti.length>1?'i':'o'}`}
              {scaduti.length>0&&inScadenza.length>0&&' · '}
              {inScadenza.length>0&&`${inScadenza.length} in scadenza entro 7 giorni`}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[...scaduti,...inScadenza].map(c=>(
                <div key={c.id} style={{background:'white',borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,fontWeight:600}}>{c.full_name}</span>
                  <StatusBadge days={daysLeft(c.subscription_end)}/>
                  <button onClick={()=>renew(c)} style={s.btnSm}>↻ Rinnova</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          {[
            {l:'Attivi',v:attivi.length,c:'#3B6D11'},
            {l:'In scadenza',v:inScadenza.length,c:'#E8A020'},
            {l:'Scaduti',v:scaduti.length,c:'#E24B4A'},
          ].map(st=>(
            <div key={st.l} style={{background:'white',borderRadius:10,border:'0.5px solid #E0DDD6',padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:st.c}}>{st.v}</div>
              <div style={{fontSize:10,color:'#888780',textTransform:'uppercase'}}>{st.l}</div>
            </div>
          ))}
        </div>

        {/* LISTA CLIENTI */}
        {loading ? <div style={{textAlign:'center',padding:40,color:'#888780'}}>Caricamento...</div> :
          clients.map(c => {
            const days = daysLeft(c.subscription_end)
            const isEditing = editing===c.id
            const isBlocked = days!==null && days<0
            const paidInst = c.installments_paid||0
            const totalInst = c.installments||1
            const hasUnpaidRate = c.payment_type==='rate' && paidInst < totalInst

            return (
              <div key={c.id} style={{...s.card, borderColor: isBlocked?'#E24B4A': hasUnpaidRate?'#E8A020':'#E0DDD6'}}>
                {/* HEADER */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:isEditing?12:0}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:isBlocked?'#FEE2E2':'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:isBlocked?'#E24B4A':'white',flexShrink:0}}>
                    {initials(c.full_name)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#111',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      {c.full_name}
                      {isBlocked && <span style={{fontSize:10,background:'#FEE2E2',color:'#E24B4A',padding:'2px 6px',borderRadius:6,fontWeight:700}}>🔒 BLOCCATO</span>}
                      {hasUnpaidRate && !isBlocked && <span style={{fontSize:10,background:'#FEF8E7',color:'#E8A020',padding:'2px 6px',borderRadius:6,fontWeight:700}}>⚠ RATA SCOPERTA</span>}
                    </div>
                    <div style={{fontSize:11,color:'#888780',marginTop:2}}>
                      {c.subscription_type||'—'}
                      {c.payment_type==='rate' && ` · Rate ${paidInst}/${totalInst}`}
                      {c.subscription_end && ` · Scade ${new Date(c.subscription_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}`}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                    <StatusBadge days={days}/>
                    {c.subscription_end && days<=30 && days>=0 && (
                      <button onClick={()=>renew(c)} style={s.btnSm}>↻</button>
                    )}
                    <button onClick={()=>isEditing?setEditing(null):openEdit(c)} style={s.btnGray}>
                      {isEditing?'✕':'✏️'}
                    </button>
                  </div>
                </div>

                {/* FORM MODIFICA */}
                {isEditing && (
                  <div style={{borderTop:'0.5px solid #F0EDE8',paddingTop:14}}>

                    {/* TIPO ABBONAMENTO + DATE */}
                    <div style={s.grid2}>
                      <div><label style={s.label}>Tipo abbonamento</label>
                        <select style={s.select} value={form.subscription_type} onChange={e=>setForm(p=>({...p,subscription_type:e.target.value}))}>
                          {TIPI.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={s.label}>Tipo pagamento</label>
                        <select style={s.select} value={form.payment_type} onChange={e=>setForm(p=>({...p,payment_type:e.target.value}))}>
                          <option value="unica">Soluzione unica</option>
                          <option value="rate">Pagamento a rate</option>
                        </select>
                      </div>
                      <div><label style={s.label}>Data inizio</label>
                        <input style={s.input} type="date" value={form.subscription_start} onChange={e=>setForm(p=>({...p,subscription_start:e.target.value}))}/>
                      </div>
                      <div><label style={s.label}>Data scadenza</label>
                        <input style={s.input} type="date" value={form.subscription_end} onChange={e=>setForm(p=>({...p,subscription_end:e.target.value}))}/>
                      </div>
                    </div>

                    {/* SEZIONE RATE */}
                    {form.payment_type==='rate' && (
                      <div style={{background:'#FEF8E7',borderRadius:10,padding:'14px',marginTop:12}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#E8A020',marginBottom:10}}>💳 Pagamento a rate</div>

                        <div style={s.grid2}>
                          <div><label style={s.label}>Numero rate</label>
                            <select style={s.select} value={form.installments} onChange={e=>setForm(p=>({...p,installments:parseInt(e.target.value)}))}>
                              {[2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n} rate</option>)}
                            </select>
                          </div>
                          <div><label style={s.label}>Importo per rata (€)</label>
                            <input style={s.input} type="number" placeholder="es. 100" value={form.installment_amount} onChange={e=>setForm(p=>({...p,installment_amount:e.target.value}))}/>
                          </div>
                        </div>

                        <button onClick={generateInstallments} style={{...s.btnSm,marginTop:10,marginBottom:12}}>
                          📅 Genera scadenze rate
                        </button>

                        {/* TABELLA RATE */}
                        {installments.length>0 && (
                          <div style={{borderRadius:9,overflow:'hidden',border:'0.5px solid #E0DDD6'}}>
                            {/* HEADER */}
                            <div style={{display:'grid',gridTemplateColumns:'40px 1fr 70px 90px',background:'#E8A020',padding:'7px 10px',gap:8}}>
                              {['#','Scadenza','€','Stato'].map(h=>(
                                <div key={h} style={{fontSize:9,fontWeight:700,color:'white',textTransform:'uppercase'}}>{h}</div>
                              ))}
                            </div>
                            {/* RIGHE */}
                            {installments.map((inst,idx)=>(
                              <div key={idx} style={{display:'grid',gridTemplateColumns:'40px 1fr 70px 90px',gap:8,padding:'8px 10px',background:inst.paid_at?'#EAF3DE':idx%2===0?'white':'#FAFAF9',alignItems:'center',borderBottom:'0.5px solid #F0EDE8'}}>
                                <div style={{fontSize:11,fontWeight:700,color:'#E8A020'}}>R{idx+1}</div>
                                <div style={{fontSize:11,color:'#111'}}>
                                  {inst.due_date ? new Date(inst.due_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                                </div>
                                <div style={{fontSize:11,fontWeight:600,color:'#111'}}>€{inst.amount}</div>
                                <div>
                                  {inst.paid_at
                                    ? <div style={{display:'flex',alignItems:'center',gap:4}}>
                                        <span style={{fontSize:10,color:'#3B6D11',fontWeight:700}}>✓ Pagata</span>
                                        <button onClick={()=>unmarkPaid(idx)} style={{background:'none',border:'none',cursor:'pointer',fontSize:10,color:'#888780'}}>✕</button>
                                      </div>
                                    : <button onClick={()=>markPaid(idx)} style={{...s.btnGreen,padding:'3px 8px',fontSize:10}}>Segna ✓</button>
                                  }
                                </div>
                              </div>
                            ))}
                            {/* TOTALE */}
                            <div style={{padding:'7px 10px',fontSize:11,fontWeight:600,color:'#111',background:'#F5F3EF',display:'flex',justifyContent:'space-between'}}>
                              <span>Totale: €{(installments[0]?.amount||0)*installments.length}</span>
                              <span style={{color:'#3B6D11'}}>Pagato: €{installments.filter(i=>i.paid_at).length*(installments[0]?.amount||0)}</span>
                            </div>
                          </div>
                        )}

                        {/* RATE PAGATE (contatore manuale) */}
                        {installments.length===0 && (
                          <div style={{marginTop:8}}>
                            <label style={s.label}>Rate già pagate</label>
                            <select style={s.select} value={form.installments_paid} onChange={e=>setForm(p=>({...p,installments_paid:parseInt(e.target.value)}))}>
                              {Array.from({length:(parseInt(form.installments)||2)+1},(_,i)=>(
                                <option key={i} value={i}>{i} {i===0?'(nessuna)':i===parseInt(form.installments)?'(tutte)':''}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{marginTop:10}}><label style={s.label}>Note</label>
                      <input style={s.input} value={form.subscription_notes} onChange={e=>setForm(p=>({...p,subscription_notes:e.target.value}))} placeholder="es. pagamento mensile, bonifico..."/>
                    </div>

                    <div style={{marginTop:12,display:'flex',gap:8}}>
                      <button onClick={save} disabled={saving} style={s.btn}>{saving?'Salvo...':'💾 Salva'}</button>
                      <button onClick={()=>setEditing(null)} style={s.btnGray}>Annulla</button>
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
    </div>
  )
}
