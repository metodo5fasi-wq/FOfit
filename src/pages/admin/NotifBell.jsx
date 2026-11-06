import React from 'react'
import { supabase } from '../../lib/supabase'
import { authFetch } from '../../lib/authFetch'

export default function NotifBell({ clients }) {
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
        authFetch('/api/push-send', {
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
