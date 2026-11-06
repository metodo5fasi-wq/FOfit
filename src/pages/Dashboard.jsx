import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Link } from 'react-router-dom'
import { Confetti, Toast, AnimatedNumber, FadeIn } from '../components/Animations'
import GraficoPeso from '../components/LazyGraficoPeso'
import { loadWithCache, applyPending } from '../lib/offline'
import { buildToday, weekDateOf, streakOf, weeklyStats, planDays } from '../lib/homeToday'

const DOT = { done: '#3B8C5A', progress: '#D4570A', todo: '#777', info: '#4A90D4' }
const label = { fontSize: 11, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.09em', margin: '18px 2px 8px' }
const card = { background: '#0D0D0D', borderRadius: 14, border: '0.5px solid #1C1C1C', padding: '14px', marginBottom: 12 }

// ── Lettura dei dati della Home (con copia salvata per l'uso senza rete) ──
function useHomeData(profile) {
  const uid = profile?.id
  const [data, setData] = useState(null)
  const load = useCallback(async () => {
    if (!uid) return
    const today = new Date().toISOString().split('T')[0], weekDate = weekDateOf()
    const L = (name, fetcher, opt) => loadWithCache(uid, name, fetcher, opt)
    const wplanR = await L('wk_plan', () => supabase.from('workout_plans').select('*').eq('client_id', uid).eq('is_active', true).limit(1))
    const wplan = wplanR.data?.[0] || null
    const [exR, sessR, logsR, mealR, dayR, rowsR, measR, chkR, anamR, bookR, unreadR] = await Promise.all([
      wplan ? L('wk_ex_' + wplan.id, () => supabase.from('workout_exercises').select('*').eq('plan_id', wplan.id).order('order_index', { ascending: true })) : Promise.resolve({ data: [] }),
      L('wk_sessions', () => supabase.from('workout_sessions').select('*').eq('client_id', uid).order('session_date', { ascending: false }), { cacheMap: d => (d || []).slice(0, 200) }),
      L('wk_today_' + today, () => supabase.from('workout_logs').select('*').eq('client_id', uid).eq('log_date', today)),
      L('home_mealplan', () => supabase.from('meal_plans').select('*').eq('client_id', uid).eq('is_active', true).limit(1)),
      L('home_diary_' + today, () => supabase.from('diary_entries').select('kcal,protein_g,carbs_g,fat_g').eq('client_id', uid).eq('entry_date', today)),
      L('home_diary_rows', () => supabase.from('diary_entries').select('entry_date,kcal').eq('client_id', uid).order('entry_date', { ascending: false }).limit(200)),
      L('home_measure', () => supabase.from('progress_entries').select('*').eq('client_id', uid).order('entry_date', { ascending: false }).limit(1)),
      L('home_checkin_' + weekDate, () => supabase.from('weekly_checkins').select('id,week_date').eq('client_id', uid).eq('week_date', weekDate).limit(1)),
      L('home_anamnesi', () => supabase.from('anamnesi').select('completed_at').eq('client_id', uid).limit(1)),
      L('home_booking', () => supabase.from('call_bookings').select('booking_date,time_slot,status').eq('client_id', uid).eq('status', 'confirmed').gte('booking_date', today).order('booking_date', { ascending: true }).limit(1)),
      L('home_unread', async () => { const r = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('client_id', uid).eq('read', false); return { data: r.count ?? 0, error: r.error } }),
    ])
    const sessions = applyPending(sessR.data || [], 'workout_sessions', uid)
    const todayLogs = applyPending(logsR.data || [], 'workout_logs', uid).filter(l => l.log_date === today)
    const diaryRows = rowsR.data || [], day = dayR.data || []
    const sum = k => day.reduce((s, r) => s + (Number(r[k]) || 0), 0)
    setData({
      today, fromCache: [wplanR, exR, sessR, logsR, mealR, dayR, rowsR, measR].some(r => r.fromCache),
      mealPlan: mealR.data?.[0] || null, hasWorkoutPlan: !!wplan, exercises: exR.data || [], sessions, todayLogs,
      kcal: sum('kcal'), p: sum('protein_g'), c: sum('carbs_g'), g: sum('fat_g'),
      measurement: measR.data?.[0] || null, checkin: chkR.data?.[0] || null,
      anamnesi: anamR.error ? undefined : (anamR.data?.[0] || null), nextBooking: bookR.data?.[0] || null,
      unread: Number(unreadR.data) || 0, streak: streakOf(diaryRows.map(r => r.entry_date), today), stats: weeklyStats({ sessions, diaryRows, todayStr: today }),
    })
  }, [uid])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('online', load); return () => window.removeEventListener('online', load) }, [load])
  return data
}

function StatusDot({ status, icon }) {
  const c = DOT[status]
  if (status === 'done') return <div aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="ti ti-check" style={{ fontSize: 17, color: 'white' }} /></div>
  return <div aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${c}`, background: status === 'progress' ? 'rgba(212,87,10,0.18)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className={`ti ${icon}`} style={{ fontSize: 15, color: status === 'todo' ? '#AAA' : c === DOT.progress ? '#F4894A' : c }} /></div>
}

function TaskRow({ t }) {
  const stateText = { done: 'fatto', progress: 'in corso', todo: 'da fare', info: '' }[t.status]
  return (
    <Link to={t.to} onClick={() => { if (t.dayLabel && t.status !== 'done') localStorage.setItem('fofit_active_day', t.dayLabel) }} data-testid={`task-${t.id}`} data-status={t.status}
      aria-label={`${t.title}. ${t.sub}. ${stateText}`}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', minHeight: 62, background: '#0D0D0D', border: `0.5px solid ${t.status === 'todo' || t.status === 'progress' ? 'rgba(212,87,10,0.32)' : '#1C1C1C'}`, borderRadius: 14, marginBottom: 8, textDecoration: 'none' }}>
      <StatusDot status={t.status} icon={t.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}>{t.title}</div>
        <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{t.sub}</div>
        {t.progress != null && <div style={{ height: 4, background: '#1C1C1C', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}><div style={{ height: 4, borderRadius: 3, width: `${Math.round(t.progress * 100)}%`, background: t.status === 'done' ? '#3B8C5A' : '#D4570A' }} /></div>}
      </div>
      {t.cta && t.status !== 'done' ? <span style={{ background: '#D4570A', color: 'white', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 20, flexShrink: 0 }}>{t.cta}</span> : <i className="ti ti-chevron-right" style={{ fontSize: 15, color: '#AAA', flexShrink: 0 }} />}
    </Link>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const d = useHomeData(profile)
  const [confetti, setConfetti] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '', emoji: '' })
  const prevKcalRef = useRef(null)
  const now = new Date(), hour = now.getHours()
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const todayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][now.getDay()]
  const firstName = profile?.full_name?.split(' ')[0] || 'utente'
  const plan = d?.mealPlan
  const kcalTarget = plan?.kcal_target || 2200, pTarget = plan?.protein_target_g || 150, cTarget = plan?.carbs_target_g || 220, gTarget = plan?.fat_target_g || 65

  const tasks = useMemo(() => d ? buildToday({
    todayStr: d.today, exercises: d.exercises, sessions: d.sessions, todayLogs: d.todayLogs, hasWorkoutPlan: d.hasWorkoutPlan,
    activeDayStored: (() => { try { return localStorage.getItem('fofit_active_day') } catch { return null } })(),
    kcal: d.kcal, kcalTarget: plan?.kcal_target || null, measurement: d.measurement, checkin: d.checkin, anamnesi: d.anamnesi, nextBooking: d.nextBooking, unread: d.unread,
  }) : null, [d, plan])

  function showToast(message, emoji) { setToast({ visible: true, message, emoji }); setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500) }
  useEffect(() => {      // festa quando si raggiunge il target (solo se cambia durante la visita, non all'apertura)
    if (!d) return
    const prev = prevKcalRef.current; prevKcalRef.current = d.kcal
    if (prev === null) return
    if (prev < kcalTarget * 0.95 && d.kcal >= kcalTarget * 0.95 && d.kcal <= kcalTarget * 1.05) { setConfetti(true); showToast('Target calorico raggiunto!', '🎉') }
  }, [d?.kcal])

  const k = Math.round(d?.kcal || 0), remaining = Math.max(0, kcalTarget - k)
  const daysPerWeek = d ? planDays(d.exercises).length : 0
  const pct = tasks && tasks.totalToday ? tasks.doneToday / tasks.totalToday : 0
  const mood = !tasks ? '' : tasks.doneToday === tasks.totalToday ? 'Tutto fatto per oggi. Ottimo lavoro!' : tasks.doneToday === 0 ? 'Cominciamo: ecco cosa fare oggi.' : 'Ci sei quasi, continua così.'

  return (
    <>
      <Confetti active={confetti} onDone={() => setConfetti(false)} />
      <Toast message={toast.message} emoji={toast.emoji} visible={toast.visible} />

      {/* TESTATA: chi sei, come stai andando oggi, cosa fare adesso */}
      <div style={{ background: '#080808', padding: '18px 16px 16px', flexShrink: 0, borderBottom: '0.5px solid #111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: '#BBB', marginBottom: 4 }}>{todayName} · {now.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#F0F0F0', letterSpacing: -0.8, lineHeight: 1.1 }}>{greeting}, <span style={{ color: '#F4894A' }}>{firstName}</span></div>
          </div>
          {d?.streak > 0 && (
            <div title="Giorni consecutivi con il diario compilato" style={{ background: '#120800', border: '0.5px solid rgba(212,87,10,0.3)', borderRadius: 14, padding: '8px 12px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F4894A', lineHeight: 1 }}>{d.streak}</div>
              <div style={{ fontSize: 10, color: '#F4894A', fontWeight: 700, marginTop: 2 }}>giorni 🔥</div>
            </div>
          )}
        </div>

        {tasks && (
          <div data-testid="today-summary" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <svg width="54" height="54" viewBox="0 0 54 54" role="img" aria-label={`${tasks.doneToday} di ${tasks.totalToday} cose fatte oggi`}>
              <circle cx="27" cy="27" r="22" fill="none" stroke="#1C1C1C" strokeWidth="6" />
              <circle cx="27" cy="27" r="22" fill="none" stroke={pct === 1 ? '#3B8C5A' : '#D4570A'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${pct * 138.2} 138.2`} transform="rotate(-90 27 27)" />
              <text x="27" y="32" textAnchor="middle" fontSize="15" fontWeight="800" fill="#F0F0F0">{tasks.doneToday}/{tasks.totalToday}</text>
            </svg>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>Oggi: {tasks.doneToday} di {tasks.totalToday} fatte</div>
              <div style={{ fontSize: 12, color: '#BBB', marginTop: 2 }}>{mood}</div>
            </div>
          </div>
        )}

        {tasks && (tasks.next ? (
          <Link to={tasks.next.to} onClick={() => { if (tasks.next.dayLabel) localStorage.setItem('fofit_active_day', tasks.next.dayLabel) }} data-testid="next-step"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 16, textDecoration: 'none', background: 'linear-gradient(135deg, rgba(212,87,10,0.26), rgba(212,87,10,0.08))', border: '0.5px solid rgba(212,87,10,0.55)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#D4570A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className={`ti ${tasks.next.icon}`} style={{ fontSize: 22, color: 'white' }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#F4894A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Prossimo passo</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F0F0', marginTop: 1 }}>{tasks.next.title}</div>
              <div style={{ fontSize: 12, color: '#DDD', marginTop: 1 }}>{tasks.next.sub}</div>
            </div>
            <span style={{ background: '#D4570A', color: 'white', fontSize: 13, fontWeight: 800, padding: '10px 16px', borderRadius: 22, flexShrink: 0 }}>{tasks.next.cta || 'Vai'} →</span>
          </Link>
        ) : (
          <div data-testid="all-done" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 16, background: 'rgba(59,140,90,0.14)', border: '0.5px solid rgba(59,140,90,0.45)' }}>
            <div style={{ fontSize: 30 }}>🎉</div>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: '#F0F0F0' }}>Tutto fatto per oggi</div><div style={{ fontSize: 12, color: '#DDD', marginTop: 2 }}>Bel lavoro! Ci vediamo domani.</div></div>
          </div>
        ))}
        {d?.fromCache && <div data-testid="home-cache" style={{ marginTop: 10, fontSize: 11, color: '#F4894A', display: 'flex', alignItems: 'center', gap: 6 }}><i className="ti ti-device-mobile" style={{ fontSize: 13 }} /> Dati dell'ultimo aggiornamento salvati sul telefono</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        {!d && <div style={{ textAlign: 'center', color: '#AAA', fontSize: 13, padding: '40px 0' }}>Caricamento…</div>}

        {tasks?.alert && (
          <Link to="/notifiche" data-testid="unread-alert" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, background: '#0D0D0D', border: '0.5px solid rgba(212,87,10,0.4)', borderRadius: 14, padding: '12px 14px', margin: '14px 0 0' }}>
            <div style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: 'rgba(212,87,10,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-bell" style={{ fontSize: 18, color: '#F4894A' }} />
              <div style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: '#D4570A', border: '2px solid #0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', padding: '0 3px' }}>{tasks.alert.unread > 9 ? '9+' : tasks.alert.unread}</div>
            </div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}>{tasks.alert.unread} {tasks.alert.unread === 1 ? 'nuova notifica' : 'nuove notifiche'}</div><div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>Tocca per leggere</div></div>
            <i className="ti ti-chevron-right" style={{ fontSize: 15, color: '#AAA' }} />
          </Link>
        )}

        {tasks && (<>
          <div style={label}>Da fare oggi</div>
          {tasks.today.map(t => <TaskRow key={t.id} t={t} />)}

          <div style={label}>Questa settimana</div>
          {tasks.week.map(t => <TaskRow key={t.id} t={t} />)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 800, color: '#6FCF97', lineHeight: 1 }}>{d.stats.sessionsWeek}{daysPerWeek ? <span style={{ fontSize: 14, color: '#AAA', fontWeight: 600 }}> / {daysPerWeek}</span> : null}</div><div style={{ fontSize: 11, color: '#AAA', marginTop: 6, fontWeight: 600 }}>allenamenti</div></div>
            <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 800, color: '#8CC2F5', lineHeight: 1 }}>{d.stats.diaryDays}<span style={{ fontSize: 14, color: '#AAA', fontWeight: 600 }}> / 7</span></div><div style={{ fontSize: 11, color: '#AAA', marginTop: 6, fontWeight: 600 }}>giorni diario</div></div>
          </div>

          <div style={label}>Oggi in numeri</div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#CCC', fontWeight: 600 }}>Calorie</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}><AnimatedNumber value={k} duration={500} /><span style={{ color: '#AAA', fontWeight: 400, fontSize: 12 }}> / {kcalTarget.toLocaleString('it-IT')}</span></span>
            </div>
            <div style={{ height: 8, background: '#161616', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: 8, borderRadius: 6, width: `${Math.min(100, k / kcalTarget * 100)}%`, background: k / kcalTarget > 1.05 ? '#E24B4A' : k / kcalTarget > 0.95 ? '#3B8C5A' : '#D4570A', transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: '#AAA', marginTop: 6, textAlign: 'right' }}>{remaining > 0 ? `${remaining.toLocaleString('it-IT')} kcal rimanenti` : 'Target raggiunto 🎉'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
              {[{ l: 'Proteine', v: d.p, t: pTarget, c: '#4A90D4' }, { l: 'Carboidrati', v: d.c, t: cTarget, c: '#E8A020' }, { l: 'Grassi', v: d.g, t: gTarget, c: '#3B8C5A' }].map(m => (
                <div key={m.l} style={{ background: '#0A0A0A', borderRadius: 10, padding: '10px', border: '0.5px solid #161616' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}><span style={{ fontSize: 16, fontWeight: 800, color: '#F0F0F0' }}>{Math.round(m.v)}</span><span style={{ fontSize: 10, color: '#AAA' }}>/{m.t}g</span></div>
                  <div style={{ height: 3, background: '#1A1A1A', borderRadius: 3, marginBottom: 5, overflow: 'hidden' }}><div style={{ height: 3, borderRadius: 3, background: m.c, width: `${Math.min(100, m.t > 0 ? Math.round(m.v / m.t * 100) : 0)}%` }} /></div>
                  <div style={{ fontSize: 10, color: '#DDD', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>

          {d.stats.comp && (d.stats.comp.thisSess > 0 || (d.stats.comp.kcalDiff != null && d.stats.comp.kcalDiff !== 0)) && (<>
            <div style={label}>Rispetto alla settimana scorsa</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: d.stats.comp.sessDiff >= 0 ? '#6FCF97' : '#F07070' }}>{d.stats.comp.sessDiff > 0 ? '+' : ''}{d.stats.comp.sessDiff}</div>
                <div style={{ fontSize: 11, color: '#CCC', marginTop: 3 }}>allenamenti</div><div style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>{d.stats.comp.thisSess} ora · {d.stats.comp.lastSess} prima</div>
              </div>
              {d.stats.comp.kcalDiff != null && (
                <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: Math.abs(d.stats.comp.kcalDiff) < 150 ? '#6FCF97' : '#E8C050' }}>{d.stats.comp.kcalDiff > 0 ? '+' : ''}{d.stats.comp.kcalDiff}</div>
                  <div style={{ fontSize: 11, color: '#CCC', marginTop: 3 }}>kcal medie al giorno</div><div style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>{d.stats.comp.thisKcal} ora · {d.stats.comp.lastKcal} prima</div>
                </div>
              )}
            </div>
          </>)}

          {d.measurement && (<>
            <div style={label}>I tuoi progressi</div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F0F0' }}>Ultima misurazione · {new Date(d.measurement.entry_date + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>
                <Link to="/progressi" style={{ fontSize: 12, color: '#F4894A', fontWeight: 700, textDecoration: 'none' }}>Vedi tutto →</Link>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[{ l: 'Peso', v: d.measurement.weight_kg, u: 'kg', c: '#F4894A' }, { l: 'Vita', v: d.measurement.waist_cm, u: 'cm', c: '#8CC2F5' }, { l: 'Grasso', v: d.measurement.body_fat_pct, u: '%', c: '#C39BD3' }].filter(m => m.v).map(m => (
                  <div key={m.l} style={{ flex: 1, background: '#0A0A0A', borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: '0.5px solid #141414' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#F0F0F0', lineHeight: 1 }}>{String(m.v).replace('.', ',')}</div><div style={{ fontSize: 10, color: m.c, fontWeight: 700, margin: '3px 0 2px' }}>{m.u}</div><div style={{ fontSize: 10, color: '#AAA' }}>{m.l}</div>
                  </div>
                ))}
              </div>
              <GraficoPeso compact={true} />
            </div>
          </>)}

          {plan?.notes && (
            <div style={{ background: '#120800', borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(212,87,10,0.25)', margin: '18px 0 0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F4894A', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><i className="ti ti-message-circle" style={{ fontSize: 13 }} /> Note del coach</div>
              <div style={{ fontSize: 13, color: '#E8A06A', lineHeight: 1.6 }}>{plan.notes}</div>
            </div>
          )}
        </>)}
      </div>
    </>
  )
}
