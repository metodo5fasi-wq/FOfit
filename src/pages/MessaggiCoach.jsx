import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

function formatDateLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Oggi'
  if (dateStr === yesterday) return 'Ieri'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })
}

export default function MessaggiCoach() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const pollRef = useRef(null)

  const isVisible = useRef(false)

  useEffect(() => {
    if (!profile) return
    isVisible.current = true
    fetchMessages(true) // prima apertura — segna come letti
    pollRef.current = setInterval(() => fetchMessages(false), 10000) // polling — NON segna come letti
    return () => {
      isVisible.current = false
      clearInterval(pollRef.current)
    }
  }, [profile])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages(markRead = false) {
    const { data } = await supabase.from('coach_messages')
      .select('*').eq('client_id', profile.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
    // Segna come letti solo quando il cliente apre la pagina
    if (markRead) {
      await supabase.from('coach_messages').update({ is_read: true })
        .eq('client_id', profile.id).eq('sender_role', 'coach').eq('is_read', false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    setMessages(prev => [...prev, {
      id: 'tmp-' + Date.now(), message: text,
      sender_role: 'client', created_at: new Date().toISOString(), is_read: false
    }])

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: profile.id, message: text, senderRole: 'client' })
    })
    await fetchMessages(true)
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function handleInput(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const grouped = {}
  messages.forEach(m => {
    const date = m.created_at.split('T')[0]
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(m)
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* TOPBAR */}
      <div style={{ background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 18px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#D4570A,#F4894A)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(212,87,10,0.3)' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'white' }}>FO</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', lineHeight:1.2 }}>Federico Obinu</div>
          <div style={{ fontSize:11, color:'#3B6D11', display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#3B6D11' }}/>
            Il tuo coach personale
          </div>
        </div>
        <div style={{ fontSize:10, color:'var(--text-muted)', background:'var(--bg-input)', padding:'4px 10px', borderRadius:12, border:'0.5px solid var(--border)' }}>
          Risponde entro 24h
        </div>
      </div>

      {/* AREA MESSAGGI */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:2 }}>

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              <div style={{ fontSize:24, marginBottom:8 }}>💬</div>
              Caricamento messaggi...
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ textAlign:'center', padding:'0 32px' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,#D4570A,#F4894A)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 4px 16px rgba(212,87,10,0.3)' }}>
                <i className="ti ti-message-circle" style={{ fontSize:28, color:'white' }}/>
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Inizia la conversazione</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7 }}>
                Scrivi al tuo coach per domande sul piano,<br/>aggiornamenti o qualsiasi cosa ti serva.
              </div>
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            {/* Etichetta data */}
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 0 8px' }}>
              <div style={{ flex:1, height:'0.5px', background:'var(--border)' }}/>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500, whiteSpace:'nowrap', padding:'2px 10px', background:'var(--bg-input)', borderRadius:10, border:'0.5px solid var(--border)' }}>
                {formatDateLabel(date)}
              </span>
              <div style={{ flex:1, height:'0.5px', background:'var(--border)' }}/>
            </div>

            {msgs.map((m, mi) => {
              const isMe = m.sender_role === 'client'
              const prevMsg = msgs[mi - 1]
              const isFirstOfGroup = !prevMsg || prevMsg.sender_role !== m.sender_role
              const isLastOfGroup = !msgs[mi + 1] || msgs[mi + 1].sender_role !== m.sender_role

              return (
                <div key={m.id} style={{
                  display:'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  alignItems:'flex-end',
                  gap:8,
                  marginBottom: isLastOfGroup ? 8 : 2,
                  marginTop: isFirstOfGroup ? 4 : 0,
                }}>
                  {/* Avatar coach */}
                  {!isMe && (
                    <div style={{
                      width:28, height:28, borderRadius:'50%',
                      background: isLastOfGroup ? 'linear-gradient(135deg,#D4570A,#F4894A)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:700, color:'white', flexShrink:0,
                    }}>
                      {isLastOfGroup ? 'FO' : ''}
                    </div>
                  )}

                  {/* Bolla */}
                  <div style={{
                    maxWidth:'75%',
                    padding:'10px 14px',
                    borderRadius: isMe
                      ? isFirstOfGroup ? '18px 18px 4px 18px' : isLastOfGroup ? '18px 4px 4px 18px' : '18px 4px 4px 18px'
                      : isFirstOfGroup ? '18px 18px 18px 4px' : isLastOfGroup ? '4px 18px 18px 4px' : '4px 18px 18px 4px',
                    background: isMe ? '#D4570A' : 'var(--bg-card)',
                    color: isMe ? 'white' : 'var(--text)',
                    border: isMe ? 'none' : '0.5px solid var(--border)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ fontSize:13, lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                      {m.message}
                    </div>
                    {isLastOfGroup && (
                      <div style={{ fontSize:10, marginTop:4, textAlign:'right', opacity:0.65, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:3 }}>
                        {new Date(m.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                        {isMe && (
                          <span style={{ fontSize:11 }}>{m.is_read ? '✓✓' : '✓'}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        <div ref={bottomRef}/>
      </div>

      {/* INPUT */}
      <div style={{ background:'var(--bg-card)', borderTop:'0.5px solid var(--border)', padding:'10px 16px', paddingBottom:'calc(env(safe-area-inset-bottom) + 10px)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end', background:'var(--bg-input)', borderRadius:24, border:'0.5px solid var(--border)', padding:'4px 4px 4px 14px' }}>
          <textarea
            ref={textareaRef}
            placeholder="Scrivi al tuo coach..."
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontSize:13, color:'var(--text)', fontFamily:'inherit',
              resize:'none', maxHeight:120, lineHeight:1.5,
              padding:'6px 0', alignSelf:'center',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer',
              background: input.trim() ? '#D4570A' : 'var(--border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0, transition:'background 0.2s',
            }}
          >
            <i className="ti ti-send" style={{ fontSize:15, color: input.trim() ? 'white' : 'var(--text-muted)' }}/>
          </button>
        </div>
      </div>
    </div>
  )
}
