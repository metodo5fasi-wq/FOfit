import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerConfirmHost } from '../lib/confirm'

// Finestra di conferma dell'app. Si monta una volta sola (App.jsx). Più richieste arrivano una alla volta, in ordine.
export default function ConfirmHost() {
  const [queue, setQueue] = useState([])
  const cancelRef = useRef(null), boxRef = useRef(null)
  useEffect(() => registerConfirmHost(req => setQueue(q => [...q, req])), [])
  const cur = queue[0]
  const finish = ok => { if (!cur) return; cur.resolve(ok); setQueue(q => q.slice(1)) }
  useEffect(() => { if (cur) cancelRef.current?.focus() }, [cur])                         // il focus parte su "Annulla": un Invio distratto non cancella nulla
  useEffect(() => {
    if (!cur) return
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false) }
      if (e.key === 'Tab') { const b = boxRef.current?.querySelectorAll('button'); if (!b?.length) return; const f = b[0], l = b[b.length - 1]; if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus() } else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus() } }
    }
    const back = () => finish(false)                                                        // il tasto "indietro" del telefono annulla
    window.addEventListener('keydown', key); window.addEventListener('popstate', back)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('popstate', back) }
  }, [cur])
  const pending = useRef([]); pending.current = queue
  useEffect(() => () => { pending.current.forEach(r => r.resolve(false)) }, [])               // se l'app si smonta, ciò che è in attesa conta come "no"
  if (!cur) return null
  const btn = { flex: 1, minHeight: 46, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }
  return createPortal(
    <div data-testid="confirm-backdrop" onClick={e => { if (e.target === e.currentTarget) finish(false) }} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby="fofit-confirm-title" aria-describedby="fofit-confirm-msg" style={{ width: '100%', maxWidth: 360, background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 18, padding: '22px 20px 18px', boxShadow: '0 12px 48px rgba(0,0,0,0.6)' }}>
        <div id="fofit-confirm-title" style={{ fontSize: 16, fontWeight: 800, color: '#F0F0F0', marginBottom: 8 }}>{cur.title}</div>
        <div id="fofit-confirm-msg" style={{ fontSize: 14, color: '#CCC', lineHeight: 1.5, marginBottom: 20, whiteSpace: 'pre-line' }}>{cur.message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button ref={cancelRef} onClick={() => finish(false)} style={{ ...btn, background: '#161616', color: '#F0F0F0', border: '0.5px solid #2A2A2A' }}>{cur.cancelLabel}</button>
          <button onClick={() => finish(true)} style={{ ...btn, background: cur.danger ? '#C93B3A' : '#C24E08', color: 'white' }}>{cur.confirmLabel}</button>
        </div>
      </div>
    </div>, document.body)
}
