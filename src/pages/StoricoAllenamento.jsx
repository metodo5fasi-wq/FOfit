import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Link } from 'react-router-dom'

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  backBtn: { width:34, height:34, borderRadius:9, border:'0.5px solid var(--border)', background:'var(--bg-input)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'var(--text)', textDecoration:'none' },
  tab: { padding:'6px 13px', borderRadius:18, fontSize:12, fontWeight:600, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', whiteSpace:'nowrap' },
  shareBtn: { background:'var(--bg-input)', border:'0.5px solid var(--border)', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 },
}

const DAY_LETTERS = ['L','M','M','G','V','S','D'] // Lun...Dom

function colorForPct(pct) {
  if (pct === null) return 'var(--bg-input)'
  if (pct >= 100) return '#D4570A'
  if (pct >= 50) return '#F4894A'
  if (pct > 0) return '#FAC9A8'
  return 'var(--bg-input)'
}

export default function StoricoAllenamento() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('tutti')
  const [editingSession, setEditingSession] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function saveEditSession() {
    if (!editingSession) return
    setSavingEdit(true)
    await supabase.from('workout_sessions').update({ notes: editNotes }).eq('id', editingSession.id)
    setSessions(prev => prev.map(s => s.id===editingSession.id ? {...s, notes:editNotes} : s))
    setSavingEdit(false)
    setEditingSession(null)
  }
  const [sharingId, setSharingId] = useState(null)
  const [shareLink, setShareLink] = useState('')
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0])
  const [copiedId, setCopiedId] = useState(null)

  const [generatedLink, setGeneratedLink] = useState('')

  async function shareSession(session) {
    setSharingId(session.id)
    try {
      const r = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: profile.id, shareType: 'session', sessionId: session.id })
      })
      const data = await r.json()
      if (data.token) {
        const link = `${window.location.origin}/share/${data.token}`
        setGeneratedLink(link)
        setCopiedId(session.id)
        setTimeout(() => setCopiedId(null), 3000)
      }
    } catch(e) { alert('Errore: ' + e.message) }
    setSharingId(null)
  }

  async function sharePeriod() {
    setSharingId('period')
    try {
      const r = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: profile.id, shareType: 'period', periodStart, periodEnd })
      })
      const data = await r.json()
      if (data.token) {
        const link = `${window.location.origin}/share/${data.token}`
        setGeneratedLink(link)
        setCopiedId('period')
        setTimeout(() => setCopiedId(null), 3000)
        setShowPeriodModal(false)
      }
    } catch(e) { alert('Errore: ' + e.message) }
    setSharingId(null)
  }

  useEffect(() => { if (profile) fetchSessions() }, [profile])

  async function fetchSessions() {
    setLoading(true)
    const { data } = await supabase.from('workout_sessions')
      .select('*').eq('client_id', profile.id).order('session_date', {ascending:false})
    setSessions(data || [])
    setLoading(false)
  }

  const dayLabels = [...new Set(sessions.map(s=>s.day_label))]
  const filteredSessions = filter === 'tutti' ? sessions : sessions.filter(s=>s.day_label===filter)

  // ── CONSISTENCY CALENDAR: ultime 12 settimane, griglia 12 colonne x 7 righe ──
  const WEEKS = 12
  const today = new Date()
  // Trova il lunedì della settimana corrente
  const todayDow = today.getDay() // 0=Dom
  const daysSinceMonday = todayDow === 0 ? 6 : todayDow - 1
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() - daysSinceMonday)

  // Costruisci mappa data -> miglior % completamento di quel giorno
  const sessionByDate = {}
  sessions.forEach(s => {
    const pct = s.sets_total > 0 ? Math.round(s.sets_completed / s.sets_total * 100) : 0
    if (!sessionByDate[s.session_date] || pct > sessionByDate[s.session_date]) {
      sessionByDate[s.session_date] = pct
    }
  })

  // Genera colonne (settimane), dalla più vecchia alla più recente
  const weeks = []
  for (let w = WEEKS - 1; w >= 0; w--) {
    const weekStart = new Date(currentMonday)
    weekStart.setDate(currentMonday.getDate() - w * 7)
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + d)
      const dateKey = date.toISOString().split('T')[0]
      const isFuture = date > today
      days.push({ date: dateKey, pct: isFuture ? null : (sessionByDate[dateKey] ?? 0), isFuture, label: date.getDate() })
    }
    weeks.push(days)
  }

  // Statistiche
  const totalSessions = sessions.length
  const last30 = sessions.filter(s => {
    const d = new Date(s.session_date)
    return (today - d) / (1000*60*60*24) <= 30
  }).length

  return (
    <>
      <div style={s.topbar}>
        <Link to="/allenamento" style={s.backBtn}><i className="ti ti-arrow-left" style={{fontSize:17}}/></Link>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Storico allenamenti</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>{totalSessions} sessioni totali</div>
        </div>
        <button onClick={()=>setShowPeriodModal(true)} style={{...s.shareBtn, background:'#FEF0E7', color:'#D4570A', borderColor:'#D4570A'}}>
          <i className="ti ti-share" style={{fontSize:13}}/>Condividi periodo
        </button>
      </div>

      <div style={s.page}>

        {/* CONSISTENCY CALENDAR */}
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Ultime 12 settimane</div>
            <div style={{fontSize:12,color:'#D4570A',fontWeight:700}}>{last30} allenamenti / 30gg</div>
          </div>
          <div style={{display:'flex',gap:3,overflowX:'auto',paddingBottom:4}}>
            {/* Colonna lettere giorni */}
            <div style={{display:'flex',flexDirection:'column',gap:3,marginRight:2,flexShrink:0}}>
              {DAY_LETTERS.map((l,i)=>(
                <div key={i} style={{width:11,height:11,fontSize:8,color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>{l}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} style={{display:'flex',flexDirection:'column',gap:3,flexShrink:0}}>
                {week.map((day,di) => (
                  <div key={di} title={`${day.date}${day.pct!==null?` — ${day.pct}%`:''}`} style={{
                    width:11, height:11, borderRadius:3,
                    background: colorForPct(day.pct),
                    opacity: day.isFuture ? 0.3 : 1,
                  }}/>
                ))}
              </div>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:10,color:'var(--text-muted)'}}>
            <span>Meno</span>
            <div style={{display:'flex',gap:3}}>
              {[null,0,30,60,100].map((p,i)=>(
                <div key={i} style={{width:11,height:11,borderRadius:3,background:colorForPct(p===null?0:p), opacity: p===null?1:1}}/>
              ))}
            </div>
            <span>Più</span>
          </div>
        </div>

        {/* FILTRI */}
        {dayLabels.length > 1 && (
          <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
            {['tutti', ...dayLabels].map(d => (
              <button key={d} onClick={()=>setFilter(d)} style={{
                ...s.tab,
                background: filter===d ? '#D4570A' : 'var(--bg-card)',
                color: filter===d ? 'white' : 'var(--text-muted)',
                borderColor: filter===d ? '#D4570A' : 'var(--border)',
              }}>{d === 'tutti' ? 'Tutti' : d}</button>
            ))}
          </div>
        )}

        {/* LISTA SESSIONI */}
        {loading ? (
          <div style={{textAlign:'center',padding:'30px 0',color:'var(--text-muted)',fontSize:13}}>Caricamento...</div>
        ) : filteredSessions.length === 0 ? (
          <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
            <i className="ti ti-history" style={{fontSize:44,color:'#E0DDD6',display:'block',marginBottom:14}}/>
            <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:6}}>Nessun allenamento ancora</div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>Le sessioni completate appariranno qui.</div>
          </div>
        ) : (
          filteredSessions.map(sess => {
            const pct = sess.sets_total > 0 ? Math.round(sess.sets_completed/sess.sets_total*100) : 0
            return (
              <div key={sess.id} style={s.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:sess.notes?10:0}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{sess.day_label}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                      {new Date(sess.session_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:10}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:700,color: pct>=100?'#3B6D11':'#D4570A'}}>{sess.sets_completed}/{sess.sets_total}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)'}}>serie · {pct}%</div>
                    </div>
                    <button onClick={()=>{setEditingSession(sess);setEditNotes(sess.notes||'')}} style={s.shareBtn}>
                      <i className="ti ti-pencil" style={{fontSize:12}}/>Modifica
                    </button>
                    <button onClick={()=>shareSession(sess)} disabled={sharingId===sess.id} style={s.shareBtn}>
                      {copiedId===sess.id ? <><i className="ti ti-check" style={{fontSize:13,color:'#3B6D11'}}/>Ok!</> : sharingId===sess.id ? '...' : <><i className="ti ti-share" style={{fontSize:13}}/>Condividi</>}
                    </button>
                  </div>
                </div>
                {sess.notes && (
                  <div style={{fontSize:12,color:'var(--text)',background:'var(--bg-input)',borderRadius:8,padding:'10px 12px',lineHeight:1.5}}>
                    {sess.notes}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* MODAL MODIFICA SESSIONE */}
        {editingSession && (
          <div onClick={e=>e.target===e.currentTarget&&setEditingSession(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
            <div style={{background:'var(--bg-card)',borderRadius:16,padding:24,width:'100%',maxWidth:440}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:2}}>Modifica sessione</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>
                {editingSession.day_label} · {new Date(editingSession.session_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Note</div>
              <textarea
                value={editNotes}
                onChange={e=>setEditNotes(e.target.value)}
                placeholder="Come ti sei sentito? Dolori? Note per il prossimo allenamento..."
                style={{width:'100%',minHeight:120,padding:'10px 12px',border:'0.5px solid var(--border)',borderRadius:10,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',lineHeight:1.5,marginBottom:16}}
              />
              <div style={{display:'flex',gap:10}}>
                <button onClick={saveEditSession} disabled={savingEdit} style={{flex:1,padding:12,background:'#D4570A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                  {savingEdit ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
                <button onClick={()=>setEditingSession(null)} style={{padding:'12px 16px',background:'var(--bg-input)',border:'0.5px solid var(--border)',borderRadius:10,fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'var(--text-muted)'}}>
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
        )}

        {/* MODAL LINK GENERATO — sempre visibile in primo piano */}
        {generatedLink && (
          <div onClick={e=>e.target===e.currentTarget&&setGeneratedLink('')} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
            <div style={{background:'var(--bg-card)',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:10,background:'#FEF0E7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <i className="ti ti-link" style={{fontSize:19,color:'#D4570A'}}/>
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>Link generato!</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>Valido per 30 giorni</div>
                </div>
              </div>
              <input readOnly value={generatedLink} onFocus={e=>e.target.select()}
                style={{width:'100%',padding:'10px 12px',border:'0.5px solid var(--border)',borderRadius:9,fontSize:12,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'monospace',boxSizing:'border-box',marginBottom:14}}/>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <button onClick={()=>{
                  if (navigator.share) { navigator.share({ url: generatedLink, title: 'Il mio allenamento FOfit' }) }
                  else {
                    const el = document.createElement('textarea')
                    el.value = generatedLink; el.style.position='fixed'; el.style.opacity='0'
                    document.body.appendChild(el); el.focus(); el.select()
                    document.execCommand('copy'); document.body.removeChild(el)
                  }
                }} style={{flex:1,padding:'11px',background:'#D4570A',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                  <i className="ti ti-share" style={{fontSize:14}}/>{navigator.share?'Condividi':'Copia link'}
                </button>
                <button onClick={()=>window.open(generatedLink,'_blank')} style={{flex:1,padding:'11px',background:'#FEF0E7',color:'#D4570A',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                  <i className="ti ti-eye" style={{fontSize:14}}/>Vedi anteprima
                </button>
              </div>
              <button onClick={()=>setGeneratedLink('')} style={{width:'100%',padding:11,background:'var(--bg-input)',border:'0.5px solid var(--border)',borderRadius:9,fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'var(--text-muted)'}}>
                Chiudi
              </button>
            </div>
          </div>
        )}

        {/* MODAL CONDIVIDI PERIODO */}
        {showPeriodModal && (
          <div onClick={e=>e.target===e.currentTarget&&setShowPeriodModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
            <div style={{background:'var(--bg-card)',borderRadius:16,padding:24,width:'100%',maxWidth:380}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:4}}>Condividi riepilogo periodo</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:20}}>Scegli il periodo da condividere. Verrà generato un link pubblico valido 30 giorni.</div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Dal</div>
                <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'0.5px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Al</div>
                <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'0.5px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={sharePeriod} disabled={sharingId==='period'} style={{flex:1,padding:11,background:'#D4570A',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  {copiedId==='period'?<><i className="ti ti-check"/>Link copiato!</>:sharingId==='period'?'Generazione...':<><i className="ti ti-link"/>Genera e copia link</>}
                </button>
                <button onClick={()=>setShowPeriodModal(false)} style={{padding:'11px 16px',background:'var(--bg-input)',border:'0.5px solid var(--border)',borderRadius:9,fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'var(--text-muted)'}}>Annulla</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
