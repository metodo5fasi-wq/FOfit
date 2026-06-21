import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:10 },
}

export default function MessaggiCoach() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('coach_messages').select('*')
      .eq('client_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMessages(data||[])
        setLoading(false)
        // Segna tutti come letti
        supabase.from('coach_messages').update({ is_read: true })
          .eq('client_id', profile.id).eq('is_read', false).then(()=>{})
      })
  }, [profile])

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Messaggi dal coach</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>Aggiornamenti e feedback di Federico</div>
        </div>
      </div>
      <div style={s.page}>
        {loading && <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)',fontSize:13}}>Caricamento...</div>}

        {!loading && messages.length === 0 && (
          <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
            <i className="ti ti-message" style={{fontSize:44,color:'#E0DDD6',display:'block',marginBottom:14}}/>
            <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:6}}>Nessun messaggio ancora</div>
            <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>Il tuo coach ti invierà feedback e aggiornamenti qui.</div>
          </div>
        )}

        {!loading && messages.map(m => (
          <div key={m.id} style={{...s.card, borderLeft: m.is_read ? '0.5px solid var(--border)' : '3px solid #D4570A'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:700,color:'white'}}>FO</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Federico Obinu</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>
                  {new Date(m.created_at).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})} alle {new Date(m.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
              {!m.is_read && <div style={{width:8,height:8,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>}
            </div>
            <div style={{fontSize:13,color:'var(--text)',lineHeight:1.7,whiteSpace:'pre-line'}}>
              {m.message}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
