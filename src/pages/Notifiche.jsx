import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Notifiche() {
  const { profile } = useAuth()
  const [notifiche, setNotifiche] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile) fetchNotifiche() }, [profile])

  async function fetchNotifiche() {
    setLoading(true)
    const { data } = await supabase.from('notifications')
      .select('*').eq('client_id', profile.id)
      .order('created_at', { ascending: false }).limit(50)
    setNotifiche(data || [])
    setLoading(false)
    // Segna tutte come lette
    await supabase.from('notifications').update({ read: true })
      .eq('client_id', profile.id).eq('read', false)
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (d > 0) return `${d}g fa`
    if (h > 0) return `${h}h fa`
    return 'Ora'
  }

  const iconColor = type => {
    if (type.includes('expired')) return { bg:'#FEE2E2', color:'#E24B4A', icon:'ti-lock' }
    if (type.includes('expiring')) return { bg:'#FEF0E7', color:'#D4570A', icon:'ti-alert-triangle' }
    if (type.includes('renewed')) return { bg:'#EAF3DE', color:'#3B6D11', icon:'ti-check' }
    return { bg:'#EBF3FD', color:'#4A90D4', icon:'ti-bell' }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden', background:'var(--bg)' }}>
      <div style={{ background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 16px', height:56, display:'flex', alignItems:'center', flexShrink:0 }}>
        <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>Notifiche</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'14px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>Caricamento...</div>
        ) : notifiche.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>
            <i className="ti ti-bell-off" style={{ fontSize:40, display:'block', marginBottom:10, opacity:0.3 }} />
            <div>Nessuna notifica</div>
          </div>
        ) : notifiche.map(n => {
          const { bg, color, icon } = iconColor(n.type)
          return (
            <div key={n.id} style={{ background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'14px', marginBottom:10, display:'flex', gap:12, opacity: n.read ? 0.7 : 1 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${icon}`} style={{ fontSize:18, color }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{n.title}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.5 }}>{n.body}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:5 }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'#D4570A', flexShrink:0, marginTop:4 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
