import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0, paddingTop:'env(safe-area-inset-top)' },
  page: { flex:1, overflowY:'auto', padding:'16px 16px 8px', display:'flex', flexDirection:'column', gap:6 },
  msgUser: { alignSelf:'flex-end', background:'#D4570A', color:'white', borderRadius:'16px 16px 4px 16px', padding:'10px 14px', maxWidth:'78%', fontSize:13, lineHeight:1.5, wordBreak:'break-word' },
  msgCoach: { alignSelf:'flex-start', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'16px 16px 16px 4px', padding:'10px 14px', maxWidth:'78%', fontSize:13, lineHeight:1.5, color:'var(--text)', wordBreak:'break-word' },
  bottom: { padding:'10px 16px', paddingBottom:'calc(env(safe-area-inset-bottom) + 10px)', background:'var(--bg-card)', borderTop:'0.5px solid var(--border)', flexShrink:0 },
  input: { flex:1, padding:'10px 14px', border:'0.5px solid var(--border)', borderRadius:22, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', resize:'none', maxHeight:100, lineHeight:1.5 },
  sendBtn: { width:40, height:40, borderRadius:'50%', background:'#D4570A', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  dateLabel: { textAlign:'center', fontSize:11, color:'var(--text-muted)', margin:'8px 0', fontWeight:500 },
  timestamp: { fontSize:10, marginTop:3, opacity:0.6, textAlign:'right' },
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Oggi'
  if (dateStr === yesterday) return 'Ieri'
  return d.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })
}

export default function MessaggiCoach() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    fetchMessages()
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
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Ottimistic update
    const tempMsg = { id: 'tmp-' + Date.now(), message: text, sender_role: 'client', created_at: new Date().toISOString(), is_read: false }
    setMessages(prev => [...prev, tempMsg])

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: profile.id, message: text, senderRole: 'client' })
    })
    await fetchMessages()
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function handleInput(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
  }

  // Raggruppa messaggi per data
  const grouped = {}
  messages.forEach(m => {
    const date = m.created_at.split('T')[0]
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(m)
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', maxWidth:680, margin:'0 auto', width:'100%' }}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <button onClick={() => navigate(-1)} style={{ width:36, height:36, borderRadius:10, border:'0.5px solid var(--border)', background:'var(--bg-input)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:16, color:'var(--text)' }}/>
        </button>
        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#D4570A,#F4894A)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'white' }}>FO</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>Federico Obinu</div>
          <div style={{ fontSize:11, color:'#3B6D11' }}>● Coach</div>
        </div>
      </div>

      {/* MESSAGGI */}
      <div style={s.page}>
        {loading && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)', fontSize:13 }}>Caricamento...</div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:8 }}>Nessun messaggio ancora</div>
            <div style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6, maxWidth:260, margin:'0 auto' }}>
              Scrivi al tuo coach per domande, aggiornamenti o qualsiasi cosa ti serva.
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            <div style={s.dateLabel}>{formatDateLabel(date)}</div>
            {msgs.map(m => {
              const isMe = m.sender_role === 'client'
              return (
                <div key={m.id} style={{ display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom:4 }}>
                  {!isMe && (
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#D4570A,#F4894A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'white', flexShrink:0, marginRight:8, alignSelf:'flex-end' }}>FO</div>
                  )}
                  <div style={ isMe ? s.msgUser : s.msgCoach }>
                    <div style={{ whiteSpace:'pre-wrap' }}>{m.message}</div>
                    <div style={{ ...s.timestamp, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                      {new Date(m.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                      {isMe && <span style={{ marginLeft:4 }}>{m.is_read ? '✓✓' : '✓'}</span>}
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
      <div style={s.bottom}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea
            ref={textareaRef}
            style={s.input}
            placeholder="Scrivi un messaggio..."
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            style={{ ...s.sendBtn, opacity: (!input.trim() || sending) ? 0.5 : 1 }}
            onClick={send}
            disabled={!input.trim() || sending}
          >
            <i className="ti ti-send" style={{ fontSize:16, color:'white' }}/>
          </button>
        </div>
      </div>
    </div>
  )
}
