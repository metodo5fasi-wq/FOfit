import React from 'react'

// Avviso rata (banner in cima all'app e riquadro nelle Notifiche). Si calcola dalle scadenze: sparisce da solo appena la rata è segnata come pagata.
const TONE = {
  soon:    { bg: 'rgba(232,160,32,0.12)', bd: 'rgba(232,160,32,0.35)', fg: '#E8C050', ic: '#E8A020', icon: 'ti-calendar-dollar' },
  today:   { bg: 'rgba(226,75,74,0.14)',  bd: 'rgba(226,75,74,0.4)',   fg: '#F07070', ic: '#E24B4A', icon: 'ti-alert-triangle' },
  overdue: { bg: 'rgba(226,75,74,0.18)',  bd: 'rgba(226,75,74,0.5)',   fg: '#F07070', ic: '#E24B4A', icon: 'ti-alert-triangle' },
  blocked: { bg: 'rgba(226,75,74,0.18)',  bd: 'rgba(226,75,74,0.5)',   fg: '#F07070', ic: '#E24B4A', icon: 'ti-lock' },
}
export default function InstallmentNotice({ alert, compact = false }) {
  if (!alert) return null
  const t = TONE[alert.level] || TONE.soon
  return (
    <div role="alert" data-testid="avviso-rata" data-level={alert.level} style={{ background: t.bg, border: compact ? 'none' : `0.5px solid ${t.bd}`, borderBottom: `0.5px solid ${t.bd}`, borderRadius: compact ? 0 : 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginBottom: compact ? 0 : 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className={`ti ${t.icon}`} style={{ fontSize: 16, color: t.ic }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.fg }}>{alert.title}</div>
        <div style={{ fontSize: 11, color: '#BBB', marginTop: 1, lineHeight: 1.45 }}>{alert.text}</div>
      </div>
    </div>
  )
}

// Elenco delle rate del cliente (sezione Notifiche): scadenza, importo, stato
import { rateState, effectiveDue, fmtDate, money } from '../lib/installments'
const LABEL = { paid: ['Pagata', '#6FCF97'], blocked: ['Scaduta', '#F07070'], overdue: ['Scaduta', '#F07070'], due_today: ['Scade oggi', '#F07070'], due_soon: ['In scadenza', '#E8C050'], upcoming: ['Da pagare', '#CCC'], nodate: ['Da pagare', '#CCC'] }
export function RateList({ rows, today }) {
  if (!rows?.length) return null
  const dd = r => String(r.due_date || '9').slice(0, 10)
  const list = [...rows].sort((a, b) => (dd(a) < dd(b) ? -1 : dd(a) > dd(b) ? 1 : 0))   // stesso ordine (e stessi R1, R2…) del coach
  return (
    <div data-testid="elenco-rate" style={{ background: '#0D0D0D', border: '0.5px solid #1C1C1C', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Le tue rate</div>
      {list.map((r, i) => {
        const st = rateState(r, today), [text, color] = LABEL[st.code] || LABEL.upcoming
        return (
          <div key={r.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? '0.5px solid #1A1A1A' : 'none', fontSize: 12 }}>
            <span style={{ color: '#E8A020', fontWeight: 700, width: 26 }}>R{i + 1}</span>
            <span style={{ flex: 1, color: '#F0F0F0' }}>{fmtDate(effectiveDue(r))}{r.extended_until && effectiveDue(r) === String(r.extended_until).slice(0, 10) ? ' (prorogata)' : ''}</span>
            <span style={{ color: '#CCC', fontWeight: 600 }}>{money(r.amount)}</span>
            <span style={{ color, fontWeight: 700, minWidth: 74, textAlign: 'right' }}>{text}</span>
          </div>
        )
      })}
    </div>
  )
}
