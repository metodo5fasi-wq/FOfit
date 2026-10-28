import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

// ── TOOLTIP CUSTOM ───────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '0.5px solid #E0DDD6', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', fontSize: 12 }}>
      <div style={{ color: '#CCC', marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontWeight: 700, color: p.color }}>{p.value}{unit}</div>
      ))}
    </div>
  )
}

// ── GRAFICO PESO ─────────────────────────────────────────────
export function GraficoPeso({ clientId, targetWeight, compact = false }) {
  const { profile } = useAuth()
  const id = clientId || profile?.id
  const [data, setData] = useState([])
  const [range, setRange] = useState(30)

  useEffect(() => {
    if (!id) return
    const from = new Date(Date.now() - range * 86400000).toISOString().split('T')[0]
    supabase.from('progress_entries').select('entry_date, weight_kg, body_fat_pct')
      .eq('client_id', id).gte('entry_date', from)
      .order('entry_date').then(({ data: d }) => {
        setData((d || []).map(r => ({
          date: new Date(r.entry_date + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
          peso: r.weight_kg,
          bf: r.body_fat_pct,
        })))
      })
  }, [id, range])

  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: 24, color: '#CCC', fontSize: 12 }}>
      <i className="ti ti-chart-line" style={{ fontSize: 28, display: 'block', marginBottom: 6, opacity: 0.3 }} />
      Nessuna misurazione registrata
    </div>
  )

  const first = data[0]?.peso
  const last = data[data.length - 1]?.peso
  const diff = first && last ? Math.round((last - first) * 10) / 10 : null

  return (
    <div>
      {/* MINI STATS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: '#F5F3EF', borderRadius: 9, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{last}kg</div>
          <div style={{ fontSize: 9, color: '#CCC', textTransform: 'uppercase' }}>Attuale</div>
        </div>
        {diff !== null && (
          <div style={{ flex: 1, background: diff < 0 ? '#EAF3DE' : diff > 0 ? '#FEE2E2' : '#F5F3EF', borderRadius: 9, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: diff < 0 ? '#3B6D11' : diff > 0 ? '#E24B4A' : '#888780' }}>
              {diff > 0 ? '+' : ''}{diff}kg
            </div>
            <div style={{ fontSize: 9, color: '#CCC', textTransform: 'uppercase' }}>Variazione</div>
          </div>
        )}
        {targetWeight && (
          <div style={{ flex: 1, background: '#EBF3FD', borderRadius: 9, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#4A90D4' }}>{targetWeight}kg</div>
            <div style={{ fontSize: 9, color: '#CCC', textTransform: 'uppercase' }}>Target</div>
          </div>
        )}
      </div>

      {/* RANGE SELECTOR */}
      {!compact && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[7, 30, 90].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              flex: 1, padding: '5px', borderRadius: 7, border: '0.5px solid',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: range === r ? '#D4570A' : '#F5F3EF',
              color: range === r ? 'white' : '#888780',
              borderColor: range === r ? '#D4570A' : '#E0DDD6',
            }}>{r}gg</button>
          ))}
        </div>
      )}

      {/* GRAFICO */}
      <ResponsiveContainer width="100%" height={compact ? 80 : 160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
          {!compact && <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#888780' }} tickLine={false} />}
          <YAxis tick={{ fontSize: 9, fill: '#888780' }} tickLine={false} domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip unit="kg" />} />
          {targetWeight && <ReferenceLine y={targetWeight} stroke="#4A90D4" strokeDasharray="4 4" />}
          <Line type="monotone" dataKey="peso" stroke="#D4570A" strokeWidth={2.5}
            dot={{ fill: '#D4570A', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── GRAFICO KCAL SETTIMANALI ─────────────────────────────────
export function GraficoKcal({ clientId, targetKcal, compact = false }) {
  const { profile } = useAuth()
  const id = clientId || profile?.id
  const [data, setData] = useState([])

  useEffect(() => {
    if (!id) return
    const from = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]
    supabase.from('diary_entries').select('entry_date, kcal, protein_g, carbs_g, fat_g')
      .eq('client_id', id).gte('entry_date', from).order('entry_date')
      .then(({ data: d }) => {
        // Raggruppa per settimana
        const weeks = {}
        ;(d || []).forEach(r => {
          const date = new Date(r.entry_date + 'T12:00')
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay() + 1)
          const key = weekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          if (!weeks[key]) weeks[key] = { kcal: [], prot: [], carbs: [], fat: [] }
          weeks[key].kcal.push(r.kcal || 0)
          weeks[key].prot.push(r.protein_g || 0)
        })
        const result = Object.entries(weeks).map(([week, v]) => ({
          week: 'Sett ' + week,
          kcal: Math.round(v.kcal.reduce((s, x) => s + x, 0) / v.kcal.length),
          prot: Math.round(v.prot.reduce((s, x) => s + x, 0) / v.prot.length),
        }))
        setData(result)
      })
  }, [id])

  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: 20, color: '#CCC', fontSize: 12 }}>
      Nessun dato diario registrato
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={compact ? 80 : 150}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
        {!compact && <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#888780' }} tickLine={false} />}
        <YAxis tick={{ fontSize: 9, fill: '#888780' }} tickLine={false} />
        <Tooltip content={<CustomTooltip unit=" kcal" />} />
        {targetKcal && <ReferenceLine y={targetKcal} stroke="#3B6D11" strokeDasharray="4 4" />}
        <Bar dataKey="kcal" fill="#D4570A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── GRAFICO VOLUME ALLENAMENTO ───────────────────────────────
export function GraficoVolume({ clientId, compact = false }) {
  const { profile } = useAuth()
  const id = clientId || profile?.id
  const [data, setData] = useState([])

  useEffect(() => {
    if (!id) return
    const from = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
    supabase.from('workout_sessions').select('session_date, total_volume_kg, sets_completed')
      .eq('client_id', id).gte('session_date', from).order('session_date')
      .then(({ data: d }) => {
        setData((d || []).map(r => ({
          date: new Date(r.session_date + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
          volume: Math.round(r.total_volume_kg || 0),
          serie: r.sets_completed || 0,
        })))
      })
  }, [id])

  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: 20, color: '#CCC', fontSize: 12 }}>
      Nessuna sessione registrata
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={compact ? 80 : 150}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
        {!compact && <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#888780' }} tickLine={false} />}
        <YAxis tick={{ fontSize: 9, fill: '#888780' }} tickLine={false} />
        <Tooltip content={<CustomTooltip unit="kg" />} />
        <Bar dataKey="volume" fill="#4A90D4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── COMPONENTE UNICO PER PAGINA PROGRESSI ───────────────────
export default function GraficiProgressi() {
  const { profile } = useAuth()
  const [plan, setPlan] = useState(null)
  const [anamnesi, setAnamnesi] = useState(null)
  const [tab, setTab] = useState('peso')

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('meal_plans').select('kcal_target').eq('client_id', profile.id).eq('is_active', true).limit(1)
      .then(({ data }) => setPlan(data?.[0] || null))
    supabase.from('anamnesi').select('peso_desiderato').eq('client_id', profile.id).maybeSingle()
      .then(({ data }) => setAnamnesi(data))
  }, [profile?.id])

  const tabs = [
    { id: 'peso', label: '⚖️ Peso', icon: 'ti-chart-line' },
    { id: 'kcal', label: '🥗 Kcal', icon: 'ti-flame' },
    { id: 'volume', label: '🏋️ Volume', icon: 'ti-barbell' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
      {/* TOPBAR */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>I tuoi progressi</div>
      </div>

      {/* TABS */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', display: 'flex', flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '12px 4px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? '#D4570A' : '#888780',
            borderBottom: tab === t.id ? '2px solid #D4570A' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, WebkitOverflowScrolling: 'touch' }}>
        {/* PESO */}
        {tab === 'peso' && (
          <>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Andamento peso</div>
              <GraficoPeso targetWeight={anamnesi?.peso_desiderato} />
            </div>
          </>
        )}

        {/* KCAL */}
        {tab === 'kcal' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Medie caloriche settimanali
              {plan?.kcal_target && <span style={{ color: '#3B6D11', marginLeft: 8 }}>Target: {plan.kcal_target} kcal</span>}
            </div>
            <GraficoKcal targetKcal={plan?.kcal_target} />
          </div>
        )}

        {/* VOLUME */}
        {tab === 'volume' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Volume allenamento (kg totali per sessione)
            </div>
            <GraficoVolume />
          </div>
        )}
      </div>
    </div>
  )
}
