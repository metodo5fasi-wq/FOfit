import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function MessaggiCoach() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    fetchMessages()
    // Polling ogni 10 secondi per nuovi messaggi
    pollRef.current = setInterval(fetchMessages, 10000)
    return () => clearInterval(pollRef.current)
  }, [profile])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    const { data } = await supabase.from('coach_messages')
      .select('*').eq('client_id', profile.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
    // Segna come letti i messaggi del coach
    await supabase.from('coach_messages').update({ is_read: true })
      .eq('client_id', profile.id).eq('sender_role', 'coach').eq('is_read', false)
  }

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const msg = { text: text.trim() }
    setText('')
    // Ottimistic update
    setMessages(prev => [...prev, {
      id: 'tmp-' + Date.now(), message: msg.text,
      sender_role: 'client', created_at: new Date().toISOString()
    }])

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: profile.id, message: msg.text, senderRole: 'client'
      })
    })
    fetchMessages()
    setSending(false)
  }

  const grouped = groupByDate(messages)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)'}}>
      {/* TOPBAR */}
      <div style={{background:'var(--bg-card)',borderBottom:'0.5px solid var(--border)',padding:'0 22px',height:56,display:'flex',alignItems:'center',gap:12,flexShrink:0,paddingTop:'env(safe-area-inset-top)'}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:700,color:'white'}}>FO</span>
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Federico Obinu</div>
          <div style={{fontSize:11,color:'#3B6D11'}}>● Online</div>
        </div>
      </div>

      {/* MESSAGGI */}
      <div style={{flex:1,overflowY:'auto',padding:'16px 16px 8px'}}>
        {loading && <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)',fontSize:13}}>Caricamento...</div>}

        {!loading && messages.length === 0 && (
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{fontSize:32,marginBottom:12}}>💬</div>
            <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:6}}>Nessun messaggio ancora</div>
            <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>Scrivi al tuo coach per fare domande o segnalare qualcosa.</div>
          </div>
        )}

        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            <div style={{textAlign:'center',margin:'12px 0',fontSize:11,color:'var(--text-muted)',fontWeight:500}}>
              {formatDateLabel(date)}
            </div>
            {msgs.map(m => {
              const isMe = m.sender_role === 'client'
              return (
                <div key={m.id} style={{display:'flex',justifyContent:isMe?'flex-end':'flex-start',marginBottom:6}}>
                  {!isMe && (
                    <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0,marginRight:8,alignSelf:'flex-end'}}>FO</div>
                  )}
                  <div style={{
                    maxWidth:'75%',padding:'10px 14px',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',
                    background:isMe?'#D4570A':'var(--bg-card)',
                    color:isMe?'white':'var(--text)',
                    border:isMe?'none':'0.5px solid var(--border)',
                    boxShadow:'0 1px 2px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{fontSize:13,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{m.message}</div>
                    <div style={{fontSize:10,marginTop:4,textAlign:'right',opacity:0.7}}>
                      {new Date(m.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
                      {isMe && <span style={{marginLeft:4}}>{m.is_read?'✓✓':'✓'}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>

      {/* INPUT */}
      <div style={{background:'var(--bg-card)',borderTop:'0.5px solid var(--border)',padding:'10px 16px',paddingBottom:'calc(env(safe-area-inset-bottom) + 10px)',display:'flex',gap:10,alignItems:'flex-end',flexShrink:0}}>
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
          placeholder="Scrivi un messaggio..."
          rows={1}
          style={{flex:1,padding:'10px 14px',border:'0.5px solid var(--border)',borderRadius:22,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',resize:'none',lineHeight:1.5,maxHeight:100,overflowY:'auto'}}
        />
        <button onClick={send} disabled={!text.trim()||sending} style={{width:40,height:40,borderRadius:'50%',background:text.trim()?'#D4570A':'var(--bg-input)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.2s'}}>
          <i className="ti ti-send" style={{fontSize:17,color:text.trim()?'white':'var(--text-muted)'}}/>
        </button>
      </div>
    </div>
  )
}

function groupByDate(messages) {
  const groups = {}
  messages.forEach(m => {
    const date = m.created_at.split('T')[0]
    if (!groups[date]) groups[date] = []
    groups[date].push(m)
  })
  return groups
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
  if (dateStr === today.toISOString().split('T')[0]) return 'Oggi'
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Ieri'
  return d.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'})
}
