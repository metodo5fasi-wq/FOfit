import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  textarea: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', resize:'vertical', minHeight:80, boxSizing:'border-box', lineHeight:1.6 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  btnDanger: { background:'#FEE2E2', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  badge: { fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:600 },
}

const TEMPLATES = [
  { label:'📅 Reminder check-in', text:'Ciao! È ora del check-in settimanale 💪 Come ti sei sentito questa settimana? Rispondi qui con energia, sonno e stress (1-5).' },
  { label:'🏋️ Motivazione allenamento', text:'Ciao! Questa settimana sei andato alla grande in palestra. Continua così, i risultati arriveranno! 🔥' },
  { label:'📊 Revisione piano', text:'Ciao! È il momento di rivedere il tuo piano. Fissami un appuntamento per analizzare insieme i tuoi progressi.' },
  { label:'🎉 Compleanno', text:'Auguri! 🎂 Spero tu stia festeggiando al meglio. Ricordati che oggi puoi goderti un pasto libero, lo hai guadagnato!' },
  { label:'⚠️ Assenza diario', text:'Ciao! Ho notato che non stai compilando il diario. Ricorda che è fondamentale per seguirti al meglio. Ci riesci?' },
]

const initials = n => n ? n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() : '?'

export default function MessaggiProgrammati() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(null)
  const [form, setForm] = useState({
    client_id: '', message: '', scheduled_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('pending') // pending | sent

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').eq('role','client').order('full_name').then(({data})=>setClients(data||[]))
    fetchScheduled()
  }, [])

  async function fetchScheduled() {
    setLoading(true)
    const { data } = await supabase.from('scheduled_messages')
      .select('*, profiles!scheduled_messages_client_id_fkey(full_name)')
      .order('scheduled_at', {ascending:true})
    setScheduled(data||[])
    setLoading(false)
  }

  async function save() {
    if (!form.client_id || !form.message || !form.scheduled_at) return
    setSaving(true)
    await supabase.from('scheduled_messages').insert({
      coach_id: profile.id,
      client_id: form.client_id,
      message: form.message,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      sent: false,
    })
    setForm({ client_id:'', message:'', scheduled_at:'' })
    setShowForm(false)
    fetchScheduled()
    setSaving(false)
  }

  async function sendNow(msg) {
    setSending(msg.id)
    await fetch('/api/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clientId: msg.client_id, coachId: profile.id, message: msg.message, senderRole: 'coach' })
    })
    await supabase.from('scheduled_messages').update({ sent:true, sent_at: new Date().toISOString() }).eq('id', msg.id)
    fetchScheduled()
    setSending(null)
  }

  async function remove(id) {
    await supabase.from('scheduled_messages').delete().eq('id', id)
    fetchScheduled()
  }

  // Controlla e invia messaggi scaduti automaticamente
  useEffect(() => {
    async function checkAndSend() {
      const now = new Date().toISOString()
      const { data: toSend } = await supabase.from('scheduled_messages')
        .select('*').eq('sent', false).lte('scheduled_at', now)
      for (const msg of toSend||[]) {
        await fetch('/api/messages', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ clientId: msg.client_id, coachId: msg.coach_id, message: msg.message, senderRole: 'coach' })
        })
        await supabase.from('scheduled_messages').update({ sent:true, sent_at: now }).eq('id', msg.id)
      }
      if (toSend?.length) fetchScheduled()
    }
    checkAndSend()
    const interval = setInterval(checkAndSend, 60000)
    return () => clearInterval(interval)
  }, [])

  const pending = scheduled.filter(m => !m.sent)
  const sent = scheduled.filter(m => m.sent)
  const displayed = filter==='pending' ? pending : sent

  // Imposta datetime minimo = ora + 5 min
  const minDateTime = new Date(Date.now() + 5*60000).toISOString().slice(0,16)

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#111'}}>Messaggi programmati</div>
          <div style={{fontSize:12,color:'#888780'}}>{pending.length} in attesa · {sent.length} inviati</div>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={s.btn}>
          <i className="ti ti-plus" style={{fontSize:14}}/> Programma messaggio
        </button>
      </div>
      <div style={s.page}>

        {/* FORM NUOVO MESSAGGIO */}
        {showForm && (
          <div style={{...s.card, border:'0.5px solid #D4570A', marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:'#111',marginBottom:14}}>Nuovo messaggio programmato</div>

            {/* Template rapidi */}
            <div style={{marginBottom:12}}>
              <label style={s.label}>Template rapidi</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {TEMPLATES.map(t=>(
                  <button key={t.label} onClick={()=>setForm(p=>({...p,message:t.text}))} style={{
                    padding:'5px 10px', borderRadius:16, fontSize:11, cursor:'pointer', border:'0.5px solid #E0DDD6',
                    background:'white', color:'#555', fontFamily:'inherit',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            <div style={s.grid2}>
              <div>
                <label style={s.label}>Cliente *</label>
                <select style={s.select} value={form.client_id} onChange={e=>setForm(p=>({...p,client_id:e.target.value}))}>
                  <option value="">Seleziona...</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Invia il *</label>
                <input style={s.input} type="datetime-local" min={minDateTime} value={form.scheduled_at} onChange={e=>setForm(p=>({...p,scheduled_at:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginTop:10}}>
              <label style={s.label}>Messaggio *</label>
              <textarea style={s.textarea} placeholder="Scrivi il messaggio..." value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <button onClick={save} disabled={saving||!form.client_id||!form.message||!form.scheduled_at} style={{...s.btn,flex:1,justifyContent:'center'}}>
                <i className="ti ti-calendar-plus" style={{fontSize:14}}/>{saving?'Salvataggio...':'Programma'}
              </button>
              <button onClick={()=>setShowForm(false)} style={s.btnGray}>Annulla</button>
            </div>
          </div>
        )}

        {/* FILTRI */}
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          {[{id:'pending',l:`In attesa (${pending.length})`},{id:'sent',l:`Inviati (${sent.length})`}].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{
              padding:'6px 14px', borderRadius:18, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit',
              background:filter===f.id?'#D4570A':'white', color:filter===f.id?'white':'#888780', borderColor:filter===f.id?'#D4570A':'#E0DDD6'
            }}>{f.l}</button>
          ))}
        </div>

        {/* LISTA */}
        {loading ? <div style={{textAlign:'center',padding:'40px',color:'#888780'}}>Caricamento...</div> :
          displayed.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px 20px',background:'white',borderRadius:12,border:'0.5px solid #E0DDD6'}}>
              <i className="ti ti-calendar-off" style={{fontSize:40,color:'#E0DDD6',display:'block',marginBottom:10}}/>
              <div style={{fontSize:13,color:'#888780'}}>{filter==='pending'?'Nessun messaggio in attesa.':'Nessun messaggio inviato.'}</div>
            </div>
          ) :
          displayed.map(msg => {
            const client = clients.find(c=>c.id===msg.client_id)
            const scheduledDate = new Date(msg.scheduled_at)
            const isPast = scheduledDate < new Date()
            const isSending = sending === msg.id
            return (
              <div key={msg.id} style={s.card}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                    {initials(client?.full_name||msg.profiles?.full_name)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{client?.full_name||msg.profiles?.full_name||'—'}</div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        {msg.sent ? (
                          <span style={{...s.badge,background:'#EAF3DE',color:'#3B6D11'}}>✓ Inviato {msg.sent_at&&new Date(msg.sent_at).toLocaleDateString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                        ) : isPast ? (
                          <span style={{...s.badge,background:'#FEF0E7',color:'#D4570A'}}>⏰ In invio...</span>
                        ) : (
                          <span style={{...s.badge,background:'#EBF3FD',color:'#4A90D4'}}>
                            📅 {scheduledDate.toLocaleDateString('it-IT',{day:'numeric',month:'short'})} alle {scheduledDate.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:'#555',lineHeight:1.5,background:'#F5F3EF',borderRadius:8,padding:'8px 10px',marginBottom:8}}>
                      {msg.message}
                    </div>
                    {!msg.sent && (
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>sendNow(msg)} disabled={isSending} style={{...s.btn,fontSize:11,padding:'6px 12px'}}>
                          <i className="ti ti-send" style={{fontSize:12}}/>{isSending?'Invio...':'Invia ora'}
                        </button>
                        <button onClick={()=>remove(msg.id)} style={s.btnDanger}>
                          <i className="ti ti-trash" style={{fontSize:11}}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>
    </>
  )
}
