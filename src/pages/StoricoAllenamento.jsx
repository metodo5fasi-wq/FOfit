import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Link } from 'react-router-dom'

const DAY_LETTERS = ['L','M','M','G','V','S','D']

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getWeekLabel(weekStart) {
  const start = new Date(weekStart + 'T12:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const sDay = start.getDate()
  const eDay = end.getDate()
  const sMonth = start.toLocaleDateString('it-IT', { month: 'short' })
  const eMonth = end.toLocaleDateString('it-IT', { month: 'short' })
  return sMonth === eMonth ? `${sDay}–${eDay} ${eMonth}` : `${sDay} ${sMonth} – ${eDay} ${eMonth}`
}

export default function StoricoAllenamento() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState([])
  const [allLogs, setAllLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedWeek, setExpandedWeek] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [editLogs, setEditLogs] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [sharingId, setSharingId] = useState(null)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0])
  const [prs, setPrs] = useState({}) // { exercise_name: maxKg }

  useEffect(() => { if (profile) fetchAll() }, [profile])

  async function fetchAll() {
    setLoading(true)
    const threeMonthsAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]
    const [sessRes, logsRes] = await Promise.all([
      supabase.from('workout_sessions').select('*').eq('client_id', profile.id)
        .order('session_date', { ascending: false }),
      supabase.from('workout_logs').select('*').eq('client_id', profile.id)
        .gte('log_date', threeMonthsAgo).order('log_date').order('exercise_name').order('set_number'),
    ])
    const sessData = sessRes.data || []
    const logsData = logsRes.data || []
    setSessions(sessData)
    setAllLogs(logsData)

    // Calcola PR per ogni esercizio
    const prMap = {}
    logsData.forEach(l => {
      if (!l.weight_kg) return
      if (!prMap[l.exercise_name] || l.weight_kg > prMap[l.exercise_name]) {
        prMap[l.exercise_name] = l.weight_kg
      }
    })
    setPrs(prMap)

    // Espandi settimana corrente di default
    if (sessData.length) {
      setExpandedWeek(getWeekStart(sessData[0].session_date))
    }
    setLoading(false)
  }

  async function openEdit(session) {
    setEditingSession(session)
    setEditNotes(session.notes || '')
    const { data: logs } = await supabase.from('workout_logs')
      .select('*').eq('client_id', profile.id).eq('log_date', session.session_date)
      .order('exercise_name').order('set_number')
    setEditLogs(logs || [])
  }

  function updateLog(id, field, val) {
    setEditLogs(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l))
  }

  async function saveEdit() {
    setSavingEdit(true)
    await supabase.from('workout_sessions').update({ notes: editNotes }).eq('id', editingSession.id)
    for (const log of editLogs) {
      await supabase.from('workout_logs').update({
        weight_kg: log.weight_kg ? parseFloat(String(log.weight_kg).replace(',', '.')) : null,
        reps_done: log.reps_done ? parseInt(log.reps_done) : null,
        exercise_note: log.exercise_note || null,
      }).eq('id', log.id)
    }
    setSavingEdit(false)
    setEditingSession(null)
    setEditLogs([])
    fetchAll()
  }

  async function shareSession(session) {
    setSharingId(session.id)
    try {
      const r = await fetch('/api/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: profile.id, shareType: 'session', sessionId: session.id })
      })
      const data = await r.json()
      if (data.token) {
        setGeneratedLink(`${window.location.origin}/share/${data.token}`)
        setCopiedId(session.id)
        setTimeout(() => setCopiedId(null), 3000)
      }
    } catch (e) { }
    setSharingId(null)
  }

  async function sharePeriod() {
    setSharingId('period')
    try {
      const r = await fetch('/api/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: profile.id, shareType: 'period', periodStart, periodEnd })
      })
      const data = await r.json()
      if (data.token) {
        setGeneratedLink(`${window.location.origin}/share/${data.token}`)
        setShowPeriodModal(false)
      }
    } catch (e) { }
    setSharingId(null)
  }

  // ── STATS GENERALI ─────────────────────────────────────
  const thisMonth = new Date().toISOString().slice(0, 7)
  const sessionsThisMonth = sessions.filter(s => s.session_date?.startsWith(thisMonth))
  const totalSeries = allLogs.length
  const tonnellaggio = allLogs.reduce((sum, l) => {
    if (!l.weight_kg || !l.reps_done) return sum
    return sum + (parseFloat(l.weight_kg) * parseInt(l.reps_done))
  }, 0)

  // ── CALENDARIO 4 SETTIMANE ──────────────────────────────
  const today = new Date()
  const sessionDates = new Set(sessions.map(s => s.session_date))
  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 27 + i)
    return d.toISOString().split('T')[0]
  })

  // ── RAGGRUPPA PER SETTIMANA ─────────────────────────────
  const byWeek = {}
  sessions.forEach(s => {
    const ws = getWeekStart(s.session_date)
    if (!byWeek[ws]) byWeek[ws] = []
    byWeek[ws].push(s)
  })
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  // ── LOG PER SESSIONE ────────────────────────────────────
  function getLogsForSession(session) {
    return allLogs.filter(l => l.log_date === session.session_date)
  }

  // ── CONFRONTO CON SESSIONE PRECEDENTE ──────────────────
  function getPrevSessionLogs(session, exerciseName) {
    const prevSessions = sessions.filter(s => s.session_date < session.session_date && s.day_label === session.day_label)
    if (!prevSessions.length) return null
    const prevDate = prevSessions[0].session_date
    const prevLogs = allLogs.filter(l => l.log_date === prevDate && l.exercise_name === exerciseName)
    if (!prevLogs.length) return null
    return Math.max(...prevLogs.map(l => parseFloat(l.weight_kg || 0)))
  }

  const s = {
    card: { background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden' },
    shareBtn: { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 },
    inp: { padding: '6px 8px', border: '0.5px solid var(--border)', borderRadius: 7, fontSize: 12, color: 'var(--text)', background: 'var(--bg-card)', outline: 'none', fontFamily: 'inherit', textAlign: 'center', width: '100%', boxSizing: 'border-box' },
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      <div style={{ textAlign: 'center' }}>
        <i className="ti ti-loader-2" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
        Caricamento storico...
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* TOPBAR */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/allenamento" style={{ width: 34, height: 34, borderRadius: 9, border: '0.5px solid var(--border)', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', textDecoration: 'none' }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
          </Link>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Storico allenamenti</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sessions.length} sessioni totali</div>
          </div>
        </div>
        <button onClick={() => setShowPeriodModal(true)} style={s.shareBtn}>
          <i className="ti ti-share" style={{ fontSize: 12 }} />Condividi periodo
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 14px 40px' }}>

        {/* STATISTICHE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { icon: 'ti-calendar-check', label: 'Questo mese', value: sessionsThisMonth.length, unit: 'sess.' },
            { icon: 'ti-layers', label: 'Serie (90gg)', value: totalSeries, unit: '' },
            { icon: 'ti-barbell', label: 'Tonnellaggio', value: tonnellaggio >= 1000 ? (tonnellaggio / 1000).toFixed(1) + 't' : Math.round(tonnellaggio) + 'kg', unit: '' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: '12px 10px', textAlign: 'center' }}>
              <i className={`ti ${stat.icon}`} style={{ fontSize: 18, color: '#D4570A', display: 'block', marginBottom: 4 }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{stat.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* CALENDARIO 4 SETTIMANE */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: '14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Ultime 4 settimane
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(28,1fr)', gap: 3 }}>
            {last28.map(date => {
              const trained = sessionDates.has(date)
              const isToday = date === today.toISOString().split('T')[0]
              return (
                <div key={date} title={date} style={{
                  aspectRatio: '1', borderRadius: 4,
                  background: trained ? '#D4570A' : 'var(--bg-input)',
                  border: isToday ? '2px solid #D4570A' : 'none',
                  opacity: date > today.toISOString().split('T')[0] ? 0.2 : 1,
                }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>4 sett. fa</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-input)' }} /><span>Riposo</span>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#D4570A' }} /><span>Allenato</span>
            </div>
            <span>Oggi</span>
          </div>
        </div>

        {/* SESSIONI PER SETTIMANA */}
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <i className="ti ti-barbell" style={{ fontSize: 40, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nessuna sessione ancora</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Inizia il tuo primo allenamento!</div>
          </div>
        ) : weeks.map(ws => {
          const wSessions = byWeek[ws]
          const wSeries = wSessions.reduce((s, sess) => s + (sess.sets_completed || 0), 0)
          const wTonnellaggio = wSessions.reduce((sum, sess) => {
            const logs = getLogsForSession(sess)
            return sum + logs.reduce((s, l) => s + (l.weight_kg && l.reps_done ? parseFloat(l.weight_kg) * parseInt(l.reps_done) : 0), 0)
          }, 0)
          const isExpanded = expandedWeek === ws

          return (
            <div key={ws} style={s.card}>
              {/* HEADER SETTIMANA */}
              <div onClick={() => setExpandedWeek(isExpanded ? null : ws)}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isExpanded ? '#FEF0E7' : 'var(--bg-card)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isExpanded ? '#D4570A' : 'var(--text)' }}>
                    {getWeekLabel(ws)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                    <span>🏋️ {wSessions.length} session{wSessions.length !== 1 ? 'i' : 'e'}</span>
                    <span>📊 {wSeries} serie</span>
                    {wTonnellaggio > 0 && <span>⚖️ {wTonnellaggio >= 1000 ? (wTonnellaggio / 1000).toFixed(1) + 't' : Math.round(wTonnellaggio) + 'kg'}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {wSessions.map(sess => {
                      const pct = sess.sets_total > 0 ? sess.sets_completed / sess.sets_total : 0
                      return (
                        <div key={sess.id} title={sess.day_label} style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: pct >= 1 ? '#3B6D11' : pct >= 0.5 ? '#E8A020' : '#E24B4A'
                        }} />
                      )
                    })}
                  </div>
                  <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 14, color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* SESSIONI DELLA SETTIMANA */}
              {isExpanded && wSessions.map(sess => {
                const sessLogs = getLogsForSession(sess)
                const pct = sess.sets_total > 0 ? Math.round(sess.sets_completed / sess.sets_total * 100) : 0
                const isExpSess = expandedSession === sess.id
                const byEx = {}
                sessLogs.forEach(l => {
                  if (!byEx[l.exercise_name]) byEx[l.exercise_name] = []
                  byEx[l.exercise_name].push(l)
                })

                return (
                  <div key={sess.id} style={{ borderTop: '0.5px solid var(--border)' }}>
                    {/* HEADER SESSIONE */}
                    <div onClick={() => setExpandedSession(isExpSess ? null : sess.id)}
                      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      {/* Indicatore completamento */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: pct >= 100 ? '#EAF3DE' : pct >= 50 ? '#FEF0E7' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`ti ${pct >= 100 ? 'ti-check' : 'ti-barbell'}`} style={{ fontSize: 16, color: pct >= 100 ? '#3B6D11' : '#D4570A' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {sess.day_label || 'Allenamento'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', gap: 8 }}>
                          <span>{new Date(sess.session_date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                          <span>·</span>
                          <span>{sess.sets_completed}/{sess.sets_total} serie</span>
                          {pct > 0 && <span style={{ color: pct >= 100 ? '#3B6D11' : '#E8A020', fontWeight: 600 }}>{pct}%</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); openEdit(sess) }} style={s.shareBtn}>
                          <i className="ti ti-pencil" style={{ fontSize: 11 }} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); shareSession(sess) }} style={s.shareBtn} disabled={sharingId === sess.id}>
                          <i className="ti ti-share" style={{ fontSize: 11 }} />
                        </button>
                        <i className={`ti ti-chevron-${isExpSess ? 'up' : 'down'}`} style={{ fontSize: 13, color: 'var(--text-muted)' }} />
                      </div>
                    </div>

                    {/* DETTAGLIO SESSIONE */}
                    {isExpSess && (
                      <div style={{ padding: '0 14px 12px', borderTop: '0.5px solid var(--border)' }}>
                        {/* Note */}
                        {sess.notes && (
                          <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '8px 10px', marginTop: 10, marginBottom: 10, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            💬 {sess.notes}
                          </div>
                        )}
                        {/* Esercizi */}
                        {Object.entries(byEx).map(([exName, exLogs]) => {
                          const maxKg = Math.max(...exLogs.map(l => parseFloat(l.weight_kg || 0)))
                          const prevMax = getPrevSessionLogs(sess, exName)
                          const isPR = maxKg > 0 && maxKg >= (prs[exName] || 0)
                          const diff = prevMax !== null && maxKg > 0 ? maxKg - prevMax : null

                          return (
                            <div key={exName} style={{ marginTop: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {exName}
                                  {isPR && maxKg > 0 && <span style={{ fontSize: 10, background: '#FEF0E7', color: '#D4570A', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>🏆 PR</span>}
                                </div>
                                {diff !== null && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: diff > 0 ? '#3B6D11' : diff < 0 ? '#E24B4A' : '#888780' }}>
                                    {diff > 0 ? `+${diff}kg` : diff < 0 ? `${diff}kg` : '= stallo'}
                                  </span>
                                )}
                              </div>
                              {/* Serie */}
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {exLogs.map(log => (
                                  <div key={log.id} style={{ background: 'var(--bg-input)', borderRadius: 7, padding: '4px 8px', fontSize: 11, textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>S{log.set_number}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{log.weight_kg || '—'}kg</div>
                                    <div style={{ color: 'var(--text-muted)' }}>×{log.reps_done || '—'}</div>
                                  </div>
                                ))}
                              </div>
                              {exLogs.some(l => l.exercise_note) && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                                  {exLogs.find(l => l.exercise_note)?.exercise_note}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {Object.keys(byEx).length === 0 && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                            Nessun dato registrato per questa sessione
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* MODAL MODIFICA SESSIONE */}
      {editingSession && (
        <div onClick={e => e.target === e.currentTarget && setEditingSession(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 500, maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Modifica sessione</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {editingSession.day_label} · {new Date(editingSession.session_date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {/* LOG PER ESERCIZIO */}
              {Object.entries(editLogs.reduce((acc, l) => {
                if (!acc[l.exercise_name]) acc[l.exercise_name] = []
                acc[l.exercise_name].push(l)
                return acc
              }, {})).map(([exName, exLogs]) => (
                <div key={exName} style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{exName}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr', gap: 6, marginBottom: 4 }}>
                    {['Serie', 'Kg', 'Reps', 'Note'].map(h => (
                      <div key={h} style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center' }}>{h}</div>
                    ))}
                  </div>
                  {exLogs.map(log => (
                    <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#D4570A', textAlign: 'center' }}>S{log.set_number}</div>
                      <input type="text" inputMode="decimal" value={log.weight_kg || ''} onChange={e => updateLog(log.id, 'weight_kg', e.target.value)} placeholder="kg" style={s.inp} />
                      <input type="number" value={log.reps_done || ''} onChange={e => updateLog(log.id, 'reps_done', e.target.value)} placeholder="reps" style={s.inp} />
                      <input type="text" value={log.exercise_note || ''} onChange={e => updateLog(log.id, 'exercise_note', e.target.value)} placeholder="nota" style={{ ...s.inp, textAlign: 'left' }} />
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 600 }}>Note sessione</div>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                placeholder="Come ti sei sentito? Dolori? Note..."
                style={{ width: '100%', minHeight: 70, padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', background: 'var(--bg-input)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5, marginBottom: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
              <button onClick={saveEdit} disabled={savingEdit}
                style={{ flex: 1, padding: 12, background: '#D4570A', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {savingEdit ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
              <button onClick={() => { setEditingSession(null); setEditLogs([]) }}
                style={{ padding: '12px 16px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-muted)' }}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LINK */}
      {generatedLink && (
        <div onClick={e => e.target === e.currentTarget && setGeneratedLink('')}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF0E7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-link" style={{ fontSize: 19, color: '#D4570A' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Link generato!</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Valido per 30 giorni</div>
              </div>
            </div>
            <input readOnly value={generatedLink} onFocus={e => e.target.select()}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 9, fontSize: 12, color: 'var(--text)', background: 'var(--bg-input)', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                if (navigator.share) navigator.share({ url: generatedLink, title: 'Il mio allenamento FOfit' })
                else { navigator.clipboard?.writeText(generatedLink) }
              }} style={{ flex: 1, padding: 11, background: '#D4570A', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Condividi / Copia link
              </button>
              <button onClick={() => setGeneratedLink('')}
                style={{ padding: '11px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-muted)' }}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERIODO */}
      {showPeriodModal && (
        <div onClick={e => e.target === e.currentTarget && setShowPeriodModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Condividi periodo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Dal</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--bg-input)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Al</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--bg-input)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={sharePeriod} disabled={sharingId === 'period'}
              style={{ width: '100%', padding: 12, background: '#D4570A', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {sharingId === 'period' ? 'Generazione...' : 'Genera link periodo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
