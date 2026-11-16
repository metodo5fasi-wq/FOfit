import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { done, notify } from '../lib/toast'
import { sendToClient } from '../lib/notify'
import { fetchAllRows } from '../lib/pagedQuery'
import { buildGiro, weekKey, reviewKey } from '../lib/giro'
import { dayKey, relTime } from '../lib/coachInbox'
import { fmtKg } from '../lib/trend'

const DAY = 86400000, LS = 'fofit_giro_seen'
const QUICK = ['Ottimo lavoro, continua così! 💪', 'Ho visto il tuo check-in: come ti senti? Ne parliamo?', 'Piccolo aggiustamento al piano: guarda le novità e dimmi come va 👍']
const readLocal = () => { try { return new Set(JSON.parse(localStorage.getItem(LS) || '[]')) } catch { return new Set() } }
const writeLocal = set => { try { localStorage.setItem(LS, JSON.stringify([...set].slice(-1500))) } catch {} }
const safe = p => Promise.resolve(p).then(r => r, e => ({ data: null, error: e }))

const S = {
  topbar: { background: '#0D0D0D', borderBottom: '0.5px solid #1A1A1A', padding: '10px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0, flexWrap: 'wrap' },
  page: { flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' },
  card: { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: 14, marginBottom: 10 },
  btn: { background: '#161616', color: '#DDD', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 42, display: 'inline-flex', alignItems: 'center', gap: 6 },
  main: { background: '#D4570A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 4 },
}

function Stat({ label, children, tone }) {
  return <div style={{ background: '#161616', borderRadius: 10, padding: '10px 12px', border: '0.5px solid #1C1C1C' }}><div style={S.label}>{label}</div><div style={{ fontSize: 14, fontWeight: 700, color: tone || '#F0F0F0' }}>{children}</div></div>
}

export default function GiroSettimanale() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(false), [seenOk, setSeenOk] = useState(true)
  const [reviewed, setReviewed] = useState(readLocal), [skipped, setSkipped] = useState([]), [reply, setReply] = useState(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const wk = weekKey()

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true); setError(false)
    const now = Date.now(), d = n => dayKey(new Date(now - n * DAY)), iso = n => new Date(now - n * DAY).toISOString()
    const prof = await fetchAllRows(() => supabase.from('profiles').select('id,full_name,goal,created_at,subscription_end,payment_type').eq('role', 'client').order('full_name').order('id'))
    if (prof.error || !prof.data) { if (alive.current) { setError(true); setLoading(false) } return }
    const ids = prof.data.map(c => c.id), inIds = q => q.in('client_id', ids)
    const [plans, wplans, diary, sessions, adh, checkins, weights, photos, msgs, rates, seen] = await Promise.all([
      safe(fetchAllRows(() => inIds(supabase.from('meal_plans').select('*')).order('created_at', { ascending: false }).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('workout_plans').select('id,client_id,is_active')).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('diary_entries').select('client_id,entry_date')).gte('entry_date', d(7)).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('workout_sessions').select('client_id,session_date')).gte('session_date', d(7)).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('meal_adherence').select('client_id,followed,adherence_date')).gte('adherence_date', d(7)).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('weekly_checkins').select('*')).gte('week_date', d(14)).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('progress_entries').select('client_id,entry_date,weight_kg')).gte('entry_date', d(60)).order('id'))),
      safe(fetchAllRows(() => inIds(supabase.from('progress_photos').select('client_id,created_at')).gte('created_at', iso(14)).order('id'))),
      safe(supabase.from('coach_messages').select('client_id,message,created_at').eq('sender_role', 'client').eq('is_read', false).order('created_at', { ascending: false }).limit(1000)),
      safe(supabase.from('subscription_installments').select('*').is('paid_at', null).limit(3000)),
      safe(supabase.from('coach_inbox_seen').select('item_key').eq('coach_id', profile.id).gte('seen_at', iso(8)).limit(3000)),
    ])
    if (!alive.current) return
    const rows = r => (r.error ? [] : r.data || [])
    setData({ clients: prof.data, plans: rows(plans), workoutPlans: wplans.error ? [] : rows(wplans), diary: rows(diary), sessions: rows(sessions), adherence: rows(adh), checkins: rows(checkins), weights: rows(weights), photos: rows(photos), messages: rows(msgs), rates: rows(rates) })
    setSeenOk(!seen.error)
    setReviewed(new Set([...readLocal(), ...(seen.error ? [] : (seen.data || []).map(r => r.item_key))]))
    setLoading(false)
  }, [profile?.id])
  useEffect(() => { load() }, [load])

  const giro = useMemo(() => (data ? buildGiro({ raw: data, reviewed }) : null), [data, reviewed])
  // "Salta" rimanda il cliente in fondo alla coda per questa sessione, senza segnarlo come visto
  const queue = useMemo(() => (giro ? [...giro.queue.filter(x => !skipped.includes(x.id)), ...giro.queue.filter(x => skipped.includes(x.id))] : []), [giro, skipped])
  const cur = queue[0]

  async function markDone(x) {
    const key = reviewKey(wk, x.id)
    const local = readLocal(); local.add(key); writeLocal(local)
    setReviewed(prev => new Set([...prev, key])); setReply(null)
    const r = await safe(supabase.from('coach_inbox_seen').upsert({ coach_id: profile.id, item_key: key }, { onConflict: 'coach_id,item_key' }))
    if (r.error && alive.current) setSeenOk(false)
  }
  async function sendReply(x) {
    const text = (reply?.text || '').trim(); if (!text || reply?.sending) return
    setReply(r => ({ ...r, sending: true, error: '' }))
    let ok = false; try { ok = (await sendToClient({ clientId: x.id, coachId: profile.id, body: text })).ok } catch {}
    if (ok) { done(`Messaggio inviato a ${x.name}`); setReply({ text: '', sent: true }) }
    else setReply(r => ({ ...r, sending: false, error: 'Non sono riuscito a inviare il messaggio. Riprova.' }))
  }

  if (loading && !data) return <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>Caricamento…</div>
  if (error || !giro) return <div style={{ padding: 40, textAlign: 'center', color: '#F07070' }}>Non riesco a caricare i clienti. <button style={S.btn} onClick={load}>Riprova</button></div>
  const n = giro.total, seen = giro.done.length, pct = n ? Math.round(seen / n * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={S.topbar}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>Giro settimanale</div>
          <div data-testid="giro-avanzamento" style={{ fontSize: 11, color: '#CCC' }}>{seen} di {n} clienti visti questa settimana</div>
        </div>
        <div style={{ width: 'min(220px,100%)', height: 6, background: '#1C1C1C', borderRadius: 3, overflow: 'hidden' }} aria-hidden="true"><div style={{ width: `${pct}%`, height: '100%', background: '#3B8C5A' }} /></div>
      </div>
      <div style={S.page}>
        {!seenOk && <div style={{ ...S.card, borderColor: 'rgba(232,160,32,0.4)', color: '#E8C050', fontSize: 12 }}>I clienti "già visti" per ora sono ricordati solo su questo dispositivo. Per averli ovunque esegui lo script <b>fofit-dashboard.sql</b> su Supabase.</div>}
        {!cur ? (
          <div data-testid="giro-finito" style={{ ...S.card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 34 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F0F0', margin: '8px 0 4px' }}>{n ? 'Giro completato' : 'Nessun cliente'}</div>
            <div style={{ fontSize: 13, color: '#AAA' }}>{n ? `Hai visto tutti i ${n} clienti di questa settimana.` : 'Quando avrai dei clienti compariranno qui.'}</div>
            {n > 0 && <button style={{ ...S.btn, marginTop: 16 }} onClick={() => { const local = readLocal(); giro.done.forEach(x => local.delete(reviewKey(wk, x.id))); writeLocal(local); setReviewed(prev => new Set([...prev].filter(k => !giro.done.some(x => reviewKey(wk, x.id) === k)))) }}>Ricomincia il giro</button>}
          </div>
        ) : <ClientCard key={cur.id} x={cur} position={seen + 1} total={n} reply={reply} setReply={setReply} sendReply={() => sendReply(cur)}
              onDone={() => markDone(cur)} onSkip={() => { setSkipped(s => [...s, cur.id]); setReply(null) }} navigate={navigate} isLast={queue.length === 1} />}
      </div>
    </div>
  )
}

function ClientCard({ x, position, total, reply, setReply, sendReply, onDone, onSkip, navigate, isLast }) {
  const c = x.checkin, red = x.severity === 'red'
  const wChange = x.weightChange
  return (
    <div data-testid="giro-cliente">
      <div style={{ ...S.card, borderColor: red ? 'rgba(226,75,74,0.5)' : x.severity ? 'rgba(232,160,32,0.4)' : '#1C1C1C' }}>
        <div style={{ fontSize: 11, color: '#AAA' }}>Cliente {position} di {total}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#F0F0F0' }}>{x.name}</div>
          {x.client.goal && <div style={{ fontSize: 11, color: '#CCC', textTransform: 'capitalize' }}>Obiettivo: {x.client.goal}</div>}
        </div>
        {x.flags.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{x.flags.map(f => <span key={f.code} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: f.severity === 'red' ? 'rgba(226,75,74,0.14)' : 'rgba(232,160,32,0.12)', color: f.severity === 'red' ? '#F07070' : '#E8C050' }}>{f.text}</span>)}</div>}
        {x.flags.length === 0 && <div style={{ fontSize: 12, color: '#6FCF97', marginTop: 8 }}>Tutto in regola 👌</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 10 }}>
        <Stat label="Peso">{x.weightNow ? `${fmtKg(x.weightNow.value)} kg` : '—'}{wChange != null && <span data-testid="giro-peso-trend" style={{ fontSize: 11, fontWeight: 600, color: '#AAA', marginLeft: 6 }}>{wChange > 0 ? '+' : wChange < 0 ? '−' : ''}{fmtKg(Math.abs(wChange))} in {Math.max(1, Math.round(x.weightSpan / 7))} sett.</span>}</Stat>
        <Stat label="Aderenza (7 giorni)" tone={x.adherencePct == null ? undefined : x.adherencePct >= 70 ? '#6FCF97' : '#E8C050'}>{x.adherencePct == null ? '—' : `${x.adherencePct}%`}</Stat>
        <Stat label="Diario (7 giorni)" tone={x.diaryDays >= 5 ? '#6FCF97' : x.diaryDays >= 3 ? '#E8C050' : '#F07070'}>{x.diaryDays} {x.diaryDays === 1 ? 'giorno' : 'giorni'}</Stat>
        <Stat label="Allenamenti (7 giorni)" tone={x.workouts ? '#6FCF97' : x.hasWorkoutPlan ? '#F07070' : undefined}>{x.hasWorkoutPlan || x.workouts ? x.workouts : 'senza scheda'}</Stat>
        <Stat label="Foto (14 giorni)">{x.photos || 'nessuna'}</Stat>
        <Stat label="Piano alimentare">{x.planAgeDays == null ? 'nessun piano' : x.planAgeDays === 0 ? 'modificato oggi' : `invariato da ${x.planAgeDays} gg`}</Stat>
      </div>

      <div style={S.card} data-testid="giro-checkin">
        <div style={S.label}>Ultimo check-in</div>
        {!c ? <div style={{ fontSize: 13, color: '#AAA' }}>Nessun check-in nelle ultime 2 settimane.</div> : (
          <>
            <div style={{ fontSize: 13, color: '#F0F0F0' }}>{[c.energy != null && `Energia ${c.energy}`, c.sleep != null && `Sonno ${c.sleep}`, c.stress != null && `Stress ${c.stress}`].filter(Boolean).join(' · ') || 'Compilato'}<span style={{ color: '#AAA', fontSize: 11 }}> · {relTime(c.created_at || `${c.week_date}T12:00:00`)}</span></div>
            {c.notes && <div style={{ fontSize: 13, color: '#CCC', marginTop: 6, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>“{c.notes}”</div>}
          </>
        )}
        {x.unread > 0 && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #1C1C1C', fontSize: 13, color: '#F0F0F0' }}><span style={{ color: '#B97AD6', fontWeight: 700 }}>{x.unread} {x.unread === 1 ? 'messaggio non letto' : 'messaggi non letti'}</span>{x.lastMessage && <span style={{ color: '#CCC' }}>: “{String(x.lastMessage.message).slice(0, 140)}”</span>}</div>}
      </div>

      <div style={S.card} data-testid="giro-risposta">
        <div style={S.label}>Rispondi</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>{QUICK.map(q => <button key={q} onClick={() => setReply({ text: q })} style={{ ...S.btn, minHeight: 34, fontSize: 11, padding: '6px 10px' }}>{q.length > 34 ? q.slice(0, 33) + '…' : q}</button>)}</div>
        <textarea aria-label={`Messaggio per ${x.name}`} value={reply?.text || ''} onChange={e => setReply({ text: e.target.value })} rows={3} placeholder="Scrivi un messaggio al cliente…" style={{ width: '100%', boxSizing: 'border-box', background: '#161616', color: '#F0F0F0', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button onClick={sendReply} disabled={!reply?.text?.trim() || reply?.sending} style={{ ...S.main, opacity: !reply?.text?.trim() || reply?.sending ? 0.5 : 1 }}>{reply?.sending ? 'Invio…' : 'Invia'}</button>
          {reply?.sent && <span style={{ fontSize: 12, color: '#6FCF97' }}>Inviato ✓</span>}
          {reply?.error && <span role="alert" style={{ fontSize: 12, color: '#F07070' }}>{reply.error}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button style={S.btn} onClick={() => navigate(`/cliente/${x.id}`)}><i className="ti ti-user" style={{ fontSize: 15 }} /> Scheda cliente</button>
        {x.planId && <button style={S.btn} onClick={() => navigate(`/modifica-piano/${x.planId}`)}><i className="ti ti-tools-kitchen-2" style={{ fontSize: 15 }} /> Modifica piano</button>}
        {x.hasWorkoutPlan && <button style={S.btn} onClick={() => navigate('/modifica-allenamento-cliente')}><i className="ti ti-barbell" style={{ fontSize: 15 }} /> Modifica scheda</button>}
      </div>

      <div style={{ display: 'flex', gap: 10, position: 'sticky', bottom: 0, background: '#050505', borderTop: '0.5px solid #1C1C1C', padding: '10px 0 6px', marginTop: 4 }}>
        <button onClick={onDone} style={{ ...S.main, flex: 1, justifyContent: 'center' }}><i className="ti ti-check" style={{ fontSize: 16 }} /> {isLast ? 'Visto: fine giro' : 'Visto, avanti'}</button>
        {!isLast && <button onClick={onSkip} style={S.btn}>Salta</button>}
      </div>
    </div>
  )
}
