import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const MILESTONE_TEMPLATES = {
  dimagrimento: [
    { label: 'Primo kg perso', kg: -1, icon: '🎯' },
    { label: '-3 kg', kg: -3, icon: '💪' },
    { label: '-5 kg', kg: -5, icon: '🔥' },
    { label: '-10 kg', kg: -10, icon: '⭐' },
    { label: 'Obiettivo raggiunto', kg: null, icon: '🏆' },
  ],
  massa: [
    { label: 'Primo kg guadagnato', kg: 1, icon: '💪' },
    { label: '+3 kg', kg: 3, icon: '🔥' },
    { label: '+5 kg', kg: 5, icon: '⭐' },
    { label: 'Obiettivo raggiunto', kg: null, icon: '🏆' },
  ],
  mantenimento: [
    { label: '1 settimana nel range', weeks: 1, icon: '✅' },
    { label: '1 mese nel range', weeks: 4, icon: '🎯' },
    { label: '3 mesi nel range', weeks: 12, icon: '🏆' },
  ],
}

export default function Obiettivi() {
  const { profile } = useAuth()
  const [data, setData] = useState({ weight: null, targetWeight: null, startWeight: null, sessions: 0, streak: 0, anamnesi: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [measR, amnR, sessR, diaryR] = await Promise.all([
      supabase.from('progress_entries').select('weight_kg, entry_date').eq('client_id', profile.id).order('entry_date', { ascending: false }).limit(30),
      supabase.from('anamnesi').select('peso_attuale, peso_desiderato, obiettivo').eq('client_id', profile.id).maybeSingle(),
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('client_id', profile.id),
      supabase.from('diary_entries').select('entry_date').eq('client_id', profile.id).order('entry_date', { ascending: false }).limit(60),
    ])

    const measurements = measR.data || []
    const currentWeight = measurements[0]?.weight_kg || null
    const startWeight = measurements[measurements.length - 1]?.weight_kg || amnR.data?.peso_attuale || null
    const targetWeight = amnR.data?.peso_desiderato || null

    // Calcola streak
    let streak = 0
    const days = [...new Set((diaryR.data || []).map(d => d.entry_date))].sort().reverse()
    let cur = new Date().toISOString().split('T')[0]
    for (const day of days) {
      const diff = Math.round((new Date(cur) - new Date(day + 'T12:00')) / 86400000)
      if (diff <= 1) { streak++; cur = day } else break
    }

    setData({ weight: currentWeight, targetWeight, startWeight, sessions: sessR.count || 0, streak, anamnesi: amnR.data })
    setLoading(false)
  }

  const goal = data.anamnesi?.obiettivo || profile?.goal || 'dimagrimento'
  const weightLost = data.startWeight && data.weight ? Math.round((data.startWeight - data.weight) * 10) / 10 : 0
  const weightToGo = data.targetWeight && data.weight ? Math.round((data.weight - data.targetWeight) * 10) / 10 : null
  const progressPct = data.startWeight && data.targetWeight && data.weight
    ? Math.max(0, Math.min(100, Math.round(Math.abs(data.startWeight - data.weight) / Math.abs(data.startWeight - data.targetWeight) * 100)))
    : 0

  const milestones = MILESTONE_TEMPLATES[goal === 'massa' ? 'massa' : goal === 'mantenimento' ? 'mantenimento' : 'dimagrimento'] || MILESTONE_TEMPLATES.dimagrimento

  function isMilestoneReached(m) {
    if (m.kg === null) return progressPct >= 100
    if (goal === 'massa') return weightLost <= -Math.abs(m.kg)
    if (m.kg < 0) return weightLost >= Math.abs(m.kg)
    if (m.weeks) return data.streak >= m.weeks * 7
    return false
  }

  const HABIT_GOALS = [
    { label: '📓 Diario compilato oggi', reached: true, sub: `${data.streak} giorni di fila` },
    { label: '🏋️ 3 allenamenti questa settimana', reached: data.sessions >= 3, sub: `${data.sessions} sessioni totali` },
    { label: '🔥 Streak 7 giorni', reached: data.streak >= 7, sub: data.streak >= 7 ? 'Complimenti!' : `${data.streak}/7 giorni` },
    { label: '💪 Streak 30 giorni', reached: data.streak >= 30, sub: data.streak >= 30 ? 'Incredibile!' : `${data.streak}/30 giorni` },
    { label: '📊 50 sessioni totali', reached: data.sessions >= 50, sub: `${data.sessions}/50 sessioni` },
    { label: '🏆 100 sessioni totali', reached: data.sessions >= 100, sub: `${data.sessions}/100 sessioni` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>I miei obiettivi</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888780' }}>Caricamento...</div>
        ) : <>

          {/* PROGRESS VERSO OBIETTIVO PESO */}
          {data.startWeight && data.targetWeight && (
            <div style={{ background: 'linear-gradient(135deg,#1a0a00,#2d1200)', borderRadius: 16, padding: '18px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Obiettivo peso
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{data.startWeight}kg</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Inizio</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#F4894A' }}>{data.weight}kg</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Ora</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#3B6D11' }}>{data.targetWeight}kg</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Target</div>
                </div>
              </div>
              {/* BARRA PROGRESSO */}
              <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: 10, background: 'linear-gradient(90deg,#D4570A,#F4894A)', borderRadius: 6, width: `${progressPct}%`, transition: 'width 1s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{progressPct}% completato</span>
                {weightToGo !== null && weightToGo > 0 && (
                  <span style={{ color: '#F4894A', fontWeight: 600 }}>ancora {weightToGo}kg</span>
                )}
                {progressPct >= 100 && <span style={{ color: '#3B6D11', fontWeight: 700 }}>🏆 Obiettivo raggiunto!</span>}
              </div>
            </div>
          )}

          {/* MILESTONE PESO */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              🏅 Milestone
            </div>
            {milestones.map((m, i) => {
              const reached = isMilestoneReached(m)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < milestones.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: reached ? 'linear-gradient(135deg,#D4570A,#F4894A)' : '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: reached ? '0 2px 8px rgba(212,87,10,0.3)' : 'none' }}>
                    {reached ? m.icon : <span style={{ fontSize: 16, opacity: 0.3 }}>🔒</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: reached ? 'var(--text)' : '#888780' }}>{m.label}</div>
                    {reached && <div style={{ fontSize: 10, color: '#3B6D11', fontWeight: 600, marginTop: 2 }}>✓ Raggiunto!</div>}
                  </div>
                  {reached && <div style={{ fontSize: 20 }}>✅</div>}
                </div>
              )
            })}
          </div>

          {/* HABIT GOALS */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              🎯 Obiettivi abitudine
            </div>
            {HABIT_GOALS.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < HABIT_GOALS.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: g.reached ? '#EAF3DE' : '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {g.reached ? '✅' : '⬜'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: g.reached ? 'var(--text)' : '#888780' }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: g.reached ? '#3B6D11' : '#B0ADA8', marginTop: 1 }}>{g.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* STREAK CARD */}
          <div style={{ background: data.streak >= 7 ? 'linear-gradient(135deg,#1a0a00,#2d1200)' : 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🔥</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: data.streak >= 7 ? '#F4894A' : 'var(--text)', lineHeight: 1 }}>{data.streak}</div>
            <div style={{ fontSize: 12, color: data.streak >= 7 ? 'rgba(255,255,255,0.5)' : '#888780', marginTop: 4 }}>
              giorni di fila con il diario
            </div>
            {data.streak >= 7 && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#F4894A', fontWeight: 600 }}>
                Stai andando alla grande! 💪
              </div>
            )}
            {data.streak === 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#888780' }}>
                Compila il diario oggi per iniziare la tua streak!
              </div>
            )}
          </div>
        </>}
      </div>
    </div>
  )
}
