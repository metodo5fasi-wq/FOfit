import React from 'react'
import { reportSignals, answersForDisplay } from '../lib/reportQuestions.js'

const DOT = { red: '#E24B4A', amber: '#E8A020', info: '#6B7280' }

// Per il coach: cosa c'è di rilevante in questo report per aggiornare scheda e piano alimentare
export function ReportSignals({ r, goal }) {
  const signals = reportSignals(r, { goal })
  if (!signals.length) return null
  const areas = [...new Set(signals.map(s => s.area))]
  return (
    <div data-testid="report-signals" style={{ background: 'rgba(212,87,10,0.06)', border: '0.5px solid rgba(212,87,10,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#F4894A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🎯 Segnali per aggiornare i piani</div>
      {areas.map(area => (
        <div key={area} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{area}</div>
          {signals.filter(s => s.area === area).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
              <span aria-label={s.level === 'red' ? 'Urgente' : s.level === 'amber' ? 'Da valutare' : 'Informazione'} style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[s.level], marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#F0F0F0', lineHeight: 1.45 }}>{s.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Le risposte alle domande aggiuntive, raggruppate per tema
export function ReportAnswers({ r }) {
  const sections = answersForDisplay(r.answers || {})
  if (!sections.length) return null
  return (
    <div data-testid="report-answers" style={{ marginTop: 6 }}>
      {sections.map(sec => (
        <div key={sec.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{sec.icon} {sec.title}</div>
          <div style={{ background: '#161616', borderRadius: 8, padding: '4px 10px' }}>
            {sec.items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '0.5px solid #1C1C1C', fontSize: 13 }}>
                <span style={{ color: '#AAA' }}>{i.label}</span><span style={{ color: '#F0F0F0', textAlign: 'right' }}>{i.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
