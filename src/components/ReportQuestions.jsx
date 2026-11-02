import React from 'react'
import { SECTIONS, isVisible, answersForDisplay } from '../lib/reportQuestions.js'

const C = {
  card: { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: '16px', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: 700, color: '#F0F0F0', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 },
  label: { fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, lineHeight: 1.4 },
  chip: on => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', background: on ? 'rgba(212,87,10,0.2)' : '#161616', color: on ? '#F4894A' : '#DDD', borderColor: on ? '#D4570A' : '#2A2A2A' }),
  num: on => ({ width: 38, height: 38, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', background: on ? '#D4570A' : '#161616', color: on ? 'white' : '#DDD', borderColor: on ? '#D4570A' : '#2A2A2A' }),
  textarea: { width: '100%', padding: '9px 12px', border: '0.5px solid #1C1C1C', borderRadius: 9, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', minHeight: 60 },
}

function Question({ q, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }} data-testid={`q-${q.id}`}>
      <span style={C.label} id={`lbl-${q.id}`}>{q.label}</span>
      {q.type === 'single' && (
        <div role="group" aria-labelledby={`lbl-${q.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {q.options.map(o => <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(q.id, value === o ? null : o)} style={C.chip(value === o)}>{o}</button>)}
        </div>
      )}
      {q.type === 'multi' && (() => {
        const sel = Array.isArray(value) ? value : [], full = q.max && sel.length >= q.max
        return (
          <div role="group" aria-labelledby={`lbl-${q.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {q.options.map(o => { const on = sel.includes(o); return <button key={o} type="button" aria-pressed={on} disabled={!on && full} onClick={() => onChange(q.id, on ? sel.filter(x => x !== o) : [...sel, o])} style={{ ...C.chip(on), opacity: !on && full ? 0.4 : 1 }}>{on ? '✓ ' : ''}{o}</button> })}
          </div>
        )
      })()}
      {q.type === 'scale' && (
        <div role="group" aria-labelledby={`lbl-${q.id}`} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map(n => <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(q.id, value === n ? null : n)} style={C.num(value === n)}>{n}</button>)}
        </div>
      )}
      {q.type === 'text' && <textarea aria-labelledby={`lbl-${q.id}`} style={C.textarea} value={value || ''} placeholder={q.placeholder || ''} onChange={e => onChange(q.id, e.target.value)} />}
    </div>
  )
}

// Una scheda di domande. In modifica: tutte le domande visibili. In sola lettura (coach, report già inviato): solo ciò a cui ha risposto.
export default function ReportQuestions({ sectionId, answers, onChange, disabled }) {
  const sec = SECTIONS.find(s => s.id === sectionId); if (!sec) return null
  const a = answers || {}
  if (disabled) {
    const view = answersForDisplay(a).find(s => s.id === sectionId); if (!view) return null
    return (
      <div style={C.card} data-testid={`rq-${sectionId}`}>
        <div style={{ ...C.title, marginBottom: 10 }}><span>{sec.icon}</span> {sec.title}</div>
        {view.items.map(i => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '0.5px solid #151515', fontSize: 13 }}>
            <span style={{ color: '#AAA' }}>{i.label}</span><span style={{ color: '#F0F0F0', textAlign: 'right' }}>{i.text}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={C.card} data-testid={`rq-${sectionId}`}>
      <div style={C.title}><span>{sec.icon}</span> {sec.title}</div>
      {sec.hint && <div style={{ fontSize: 12, color: '#AAA', marginBottom: 14, lineHeight: 1.5 }}>{sec.hint}</div>}
      {sec.questions.filter(q => isVisible(q, a)).map(q => <Question key={q.id} q={q} value={a[q.id]} onChange={onChange} />)}
    </div>
  )
}
