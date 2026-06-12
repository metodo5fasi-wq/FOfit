import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../App'

export default function NotifPanel() {
  const { theme } = useTheme()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const PRESETS = [
    { title: '📔 Diario di oggi', body: 'Hai registrato i pasti di oggi? Apri FOfit e traccia il tuo diario!' },
    { title: '💪 Continua così!', body: 'Stai facendo un ottimo lavoro. Controlla il tuo piano di oggi!' },
    { title: '📊 Nuovi progressi', body: 'Il tuo coach ha aggiornato il tuo piano. Dai un\'occhiata!' },
    { title: '🎯 Obiettivo vicino!', body: 'Sei quasi al tuo target settimanale. Ancora un piccolo sforzo!' },
  ]

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').neq('role','admin')
      .then(({data}) => setClients(data || []))
  }, [])

  async function send() {
    if (!title || !body) return
    setSending(true)
    try {
      // Prendi i clientId da notificare
      let clientIds = []
      if (selectedClient === 'all') {
        const { data } = await supabase.from('push_subscriptions').select('client_id')
        clientIds = (data || []).map(r => r.client_id)
      } else {
        clientIds = [selectedClient]
      }

      // Manda a tutti
      await Promise.all(clientIds.map(clientId =>
        fetch('/api/push-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, title, body, url: '/' })
        })
      ))
      setSent(true)
      setTimeout(() => { setSent(false); setTitle(''); setBody('') }, 3000)
    } catch(e) { console.error(e) }
    setSending(false)
  }

  return (
    <div style={{background:theme.bgCard,borderRadius:12,border:`0.5px solid ${theme.border}`,padding:'16px',marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
        <i className="ti ti-bell-ringing" style={{fontSize:15,color:theme.orange}}/>
        Invia notifica ai clienti
      </div>

      {/* Destinatario */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em'}}>Destinatario</div>
        <select value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}
          style={{width:'100%',padding:'9px 12px',border:`0.5px solid ${theme.border}`,borderRadius:8,fontSize:13,color:'var(--text)',background:theme.bgInput,outline:'none',fontFamily:'inherit'}}>
          <option value="all">Tutti i clienti</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {/* Preset messaggi */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em'}}>Messaggi rapidi</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {PRESETS.map((p,i) => (
            <button key={i} onClick={()=>{setTitle(p.title);setBody(p.body)}}
              style={{padding:'5px 10px',borderRadius:20,border:`0.5px solid ${theme.border}`,background:theme.bgSubtle,color:'var(--text-muted)',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* Titolo e corpo */}
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titolo notifica"
        style={{width:'100%',padding:'9px 12px',border:`0.5px solid ${theme.border}`,borderRadius:8,fontSize:13,color:'var(--text)',background:theme.bgInput,outline:'none',fontFamily:'inherit',marginBottom:8,boxSizing:'border-box'}}/>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Testo della notifica..."
        style={{width:'100%',padding:'9px 12px',border:`0.5px solid ${theme.border}`,borderRadius:8,fontSize:13,color:'var(--text)',background:theme.bgInput,outline:'none',fontFamily:'inherit',resize:'none',height:70,boxSizing:'border-box',marginBottom:10}}/>

      <button onClick={send} disabled={!title||!body||sending}
        style={{background:sent?'#3B8C5A':theme.orange,color:'white',border:'none',borderRadius:8,padding:'10px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,transition:'background 0.3s'}}>
        <i className={`ti ${sent?'ti-check':'ti-send'}`} style={{fontSize:14}}/>
        {sending?'Invio...' : sent?'Inviata!' : 'Invia notifica'}
      </button>
    </div>
  )
}
