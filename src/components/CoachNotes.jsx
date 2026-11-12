import React, { useState } from 'react'
import { NOTES_MAX, parseNotes, splitInline, normalizeNotes, hasNotes, notesStatus, writeSeen, notesOpenKey } from '../lib/coachNotes'

function Inline({ text }) {
  return splitInline(text).map((p, i) => p.href
    ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" style={{ color: '#F4894A', textDecoration: 'underline', wordBreak: 'break-all' }}>{p.t}</a>
    : p.b ? <strong key={i} style={{ color: '#FFF', fontWeight: 700 }}>{p.t}</strong> : <React.Fragment key={i}>{p.t}</React.Fragment>)
}

// Il testo delle note, disegnato: titoli, elenchi, grassetto, link. Il testo viene sempre mostrato come testo (niente HTML).
export function NotesText({ text }) {
  const blocks = parseNotes(text)
  return (
    <div data-testid="notes-text" style={{ fontSize: 13, color: '#DDD', lineHeight: 1.55 }}>
      {blocks.map((b, i) => b.type === 'h'
        ? <div key={i} role="heading" aria-level={3} style={{ fontSize: 14, fontWeight: 800, color: '#F4894A', margin: i ? '14px 0 4px' : '0 0 4px' }}><Inline text={b.text} /></div>
        : b.type === 'ul'
          ? <ul key={i} style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{b.items.map((it, j) => <li key={j} style={{ marginBottom: 3 }}><Inline text={it} /></li>)}</ul>
          : <p key={i} style={{ margin: '0 0 8px', whiteSpace: 'pre-line' }}><Inline text={b.text} /></p>)}
    </div>
  )
}

// Per il coach: campo di scrittura con conteggio, suggerimento sul formato e anteprima "come lo vede il cliente"
export function NotesEditor({ value, onChange, idPrefix = 'note' }) {
  const [preview, setPreview] = useState(false)
  const n = (value || '').length, near = n > NOTES_MAX * 0.9
  return (
    <div data-testid="notes-editor">
      {preview ? (
        <div data-testid="notes-preview" style={{ background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '12px 14px', minHeight: 130 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Così lo vedrà il cliente</div>
          {hasNotes(value) ? <NotesText text={value} /> : <div style={{ fontSize: 12, color: '#888' }}>Non hai ancora scritto niente.</div>}
        </div>
      ) : (
        <textarea id={`${idPrefix}-testo`} aria-label="Note generali per il cliente" value={value || ''} maxLength={NOTES_MAX} rows={7}
          onChange={e => onChange(e.target.value)}
          placeholder={'Scrivi qui le indicazioni e i consigli per il cliente.\n\n# Riscaldamento\n- 5-10 minuti di cardio leggero\n- 2 serie leggere sul primo esercizio\n\n# Recuperi\nRispetta i tempi indicati: **non accorciarli**.'}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 150, padding: '10px 12px', background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 10, color: '#F0F0F0', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#888', flex: 1, minWidth: 200, lineHeight: 1.4 }}>Titolo: <b>#</b> a inizio riga · Elenco: <b>-</b> · Grassetto: <b>**così**</b> · I link https:// si aprono con un tocco</span>
        <span aria-label="Caratteri usati" style={{ fontSize: 11, color: near ? '#F4894A' : '#888', fontWeight: near ? 700 : 400 }}>{n}/{NOTES_MAX}</span>
        <button type="button" onClick={() => setPreview(p => !p)} aria-pressed={preview}
          style={{ background: preview ? '#D4570A' : '#161616', color: preview ? 'white' : '#CCC', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {preview ? '✎ Torna a scrivere' : '👁 Anteprima'}
        </button>
      </div>
    </div>
  )
}

// Per il cliente: riquadro richiudibile in cima alla sezione Allenamento. Si apre da solo se le note sono nuove o cambiate, poi resta chiuso.
export function ClientNotesCard({ planId, text }) {
  const status = React.useMemo(() => notesStatus(planId, text), [planId, text])   // calcolato PRIMA di segnarle come viste
  const [open, setOpen] = useState(() => { if (status) return true; try { return localStorage.getItem(notesOpenKey(planId)) === '1' } catch { return false } })
  React.useEffect(() => { if (hasNotes(text)) writeSeen(planId, text) }, [planId, text])
  if (!hasNotes(text)) return null
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem(notesOpenKey(planId), v ? '1' : '0') } catch {} }
  const first = normalizeNotes(text).split('\n').find(l => l.trim()).replace(/^#{1,3}\s+|^[-*•]\s+|\*\*/g, '').slice(0, 90)
  return (
    <div data-testid="client-notes" style={{ background: '#0D0D0D', border: '0.5px solid rgba(244,137,74,0.35)', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
      <button onClick={toggle} aria-expanded={open} aria-controls="note-del-coach" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(244,137,74,0.08)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(212,87,10,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="ti ti-notes" style={{ fontSize: 17, color: '#F4894A' }} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F0F0' }}>Note del tuo coach</span>
            {status && <span data-testid="notes-badge" style={{ fontSize: 9, fontWeight: 800, color: 'white', background: '#D4570A', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.04em' }}>{status === 'new' ? 'NUOVE' : 'AGGIORNATE'}</span>}
          </span>
          {!open && <span style={{ display: 'block', fontSize: 12, color: '#AAA', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{first}</span>}
        </span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 16, color: '#AAA' }} />
      </button>
      {open && <div id="note-del-coach" role="region" aria-label="Note del tuo coach" style={{ padding: '12px 14px 14px' }}><NotesText text={text} /></div>}
    </div>
  )
}
