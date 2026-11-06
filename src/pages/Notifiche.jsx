import React, { useState, useEffect } from 'react'
import { dbSave, notify } from '../lib/db'
import { supabase } from '../lib/supabase'
import { authFetch } from '../lib/authFetch'
import { useAuth } from '../App'

const PREFIX = /^↩️ In risposta a «[^»]*»: /           // contesto aggiunto alle risposte, perché il coach capisca a cosa si risponde
const snippet = (s, n = 60) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }

// A quale notifica del coach appartiene ogni risposta. Si usa il contesto scritto nella risposta («In risposta a …»), così una risposta a una notifica
// vecchia resta sotto di lei anche se nel frattempo ne sono arrivate di nuove; senza contesto, vale l'ultima notifica ricevuta prima della risposta.
export function threadFor(notifiche = [], replies = []) {
  const coach = notifiche.filter(n => n.type === 'coach_message').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const out = {}; coach.forEach(n => { out[n.id] = [] })
  ;[...replies].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(r => {
    const before = coach.filter(n => new Date(n.created_at) <= new Date(r.created_at))
    const ctx = String(r.message || '').match(/^↩️ In risposta a «([^»]*)»: /)
    let target = ctx ? [...before].reverse().find(n => snippet(n.body) === ctx[1]) : null
    if (!target) target = before[before.length - 1] || null
    if (target) out[target.id].push(r)
  })
  return out
}

export default function Notifiche() {
  const { profile } = useAuth()
  const [notifiche, setNotifiche] = useState([])
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(null)       // id della notifica a cui si sta rispondendo
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (profile) fetchNotifiche() }, [profile])

  async function fetchNotifiche() {
    setLoading(true)
    const { data } = await supabase.from('notifications')
      .select('*').eq('client_id', profile.id)
      .order('created_at', { ascending: false }).limit(50)
    setNotifiche(data || [])
    // le risposte già inviate (si rivedono sotto la notifica a cui appartengono)
    const { data: rep } = await supabase.from('coach_messages')
      .select('id,message,created_at').eq('client_id', profile.id).eq('sender_role', 'client')
      .order('created_at', { ascending: true }).limit(300)
    setReplies(rep || [])
    setLoading(false)
    // Segna tutte come lette
    await dbSave(supabase.from('notifications').update({ read: true })
      .eq('client_id', profile.id).eq('read', false), 'la notifica', 'salvare', { silent: true })
  }

  async function sendReply(n) {
    const t = text.trim(); if (!t || sending) return
    setSending(true); setError('')
    const message = `↩️ In risposta a «${snippet(n.body)}»: ${t}`
    let ok = false
    try { ok = (await authFetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: profile.id, message, senderRole: 'client' }) })).ok } catch {}
    setSending(false)
    if (!ok) { setError(navigator.onLine === false ? 'Nessuna connessione: la risposta non è stata inviata. Riprova quando torna la rete.' : 'Non sono riuscito a inviare la risposta. Riprova.'); return }      // il testo resta nel campo
    setReplies(r => [...r, { id: 'local-' + Date.now(), message, created_at: new Date().toISOString() }])
    setComposing(null); setText('')
    notify('Risposta inviata al coach', 'success')
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
    if (type.includes('expired')) return { bg: 'rgba(226,75,74,0.16)', color: '#F07070', icon: 'ti-lock' }
    if (type.includes('expiring')) return { bg: 'rgba(212,87,10,0.16)', color: '#F4894A', icon: 'ti-alert-triangle' }
    if (type.includes('renewed')) return { bg: 'rgba(59,140,90,0.16)', color: '#6FCF97', icon: 'ti-check' }
    return { bg: 'rgba(74,144,212,0.16)', color: '#8CC2F5', icon: 'ti-bell' }
  }
  const threads = threadFor(notifiche, replies)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', background: '#080808' }}>
      <div style={{ background: '#0D0D0D', borderBottom: '0.5px solid #1A1A1A', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>Notifiche</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#AAA' }}>Caricamento...</div>
        ) : notifiche.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#AAA' }}>
            <i className="ti ti-bell-off" style={{ fontSize: 40, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            <div>Nessuna notifica</div>
          </div>
        ) : notifiche.map(n => {
          const { bg, color, icon } = iconColor(n.type || '')
          const repliable = n.type === 'coach_message', mine = threads[n.id] || []
          return (
            <div key={n.id} data-testid={`notifica-${n.id}`} style={{ background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: '14px', marginBottom: 10, display: 'flex', gap: 12, opacity: n.read ? 0.7 : 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ti ${icon}`} style={{ fontSize: 18, color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F0F0', marginBottom: 3 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#CCC', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.body}</div>
                <div style={{ fontSize: 10, color: '#AAA', marginTop: 5 }}>{timeAgo(n.created_at)}</div>

                {mine.map(r => (
                  <div key={r.id} data-testid="mia-risposta" style={{ marginTop: 8, marginLeft: 'auto', maxWidth: '88%', background: 'rgba(212,87,10,0.14)', border: '0.5px solid rgba(212,87,10,0.3)', borderRadius: '12px 12px 4px 12px', padding: '8px 11px' }}>
                    <div style={{ fontSize: 10, color: '#F4894A', fontWeight: 700, marginBottom: 2 }}>Tu · {timeAgo(r.created_at)}</div>
                    <div style={{ fontSize: 12, color: '#F0F0F0', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{String(r.message || '').replace(PREFIX, '')}</div>
                  </div>
                ))}

                {repliable && composing !== n.id && (
                  <button onClick={() => { setComposing(n.id); setText(''); setError('') }} aria-label={`Rispondi a: ${n.title}`}
                    style={{ marginTop: 10, background: 'none', border: '0.5px solid rgba(212,87,10,0.45)', color: '#F4894A', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <i className="ti ti-arrow-back-up" style={{ fontSize: 14 }} /> Rispondi
                  </button>
                )}
                {repliable && composing === n.id && (
                  <div data-testid="risposta-box" style={{ marginTop: 10 }}>
                    <textarea aria-label="Scrivi la tua risposta" autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi la tua risposta al coach..." rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '0.5px solid #2A2A2A', borderRadius: 10, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                    {error && <div role="alert" style={{ color: '#F07070', fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => sendReply(n)} disabled={!text.trim() || sending}
                        style={{ background: '#D4570A', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !text.trim() || sending ? 0.55 : 1 }}>{sending ? 'Invio…' : 'Invia risposta'}</button>
                      <button onClick={() => { setComposing(null); setText(''); setError('') }}
                        style={{ background: '#161616', color: '#CCC', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annulla</button>
                    </div>
                  </div>
                )}
              </div>
              {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4570A', flexShrink: 0, marginTop: 4 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
