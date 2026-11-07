import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerPdfHost, prepareDoc } from '../lib/pdfViewer'
import { notify } from '../lib/toast'

const PRINT_ID = 'fofit-pdf-print-style'
// Quando si stampa: sparisce l'app e resta solo il documento (la pagina dell'app ha overflow bloccato: va sbloccato)
const PRINT_BASE = `@media print {
  #root { display: none !important; }
  html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
  #fofit-pdf-overlay { position: static !important; background: #fff !important; display: block !important; }
  #fofit-pdf-toolbar { display: none !important; }
  #fofit-pdf-scroll { position: static !important; overflow: visible !important; height: auto !important; padding: 0 !important; background: #fff !important; }
  #fofit-pdf-paper { box-shadow: none !important; margin: 0 !important; max-width: none !important; width: auto !important; border-radius: 0 !important; }
}`

function Paper({ html }) {
  const ref = useRef(null)
  const prepared = React.useMemo(() => prepareDoc(html), [html])
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const root = el.shadowRoot || el.attachShadow({ mode: 'open' })         // gli stili del documento restano dentro: non toccano l'app
    root.innerHTML = `<style>.pdf-root{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}\n${prepared.css}</style><div class="pdf-root">${prepared.bodyHtml}</div>`
  }, [prepared])
  return <div ref={ref} data-testid="pdf-paper-host" />
}

function Viewer({ doc, onClose }) {
  const backRef = useRef(null)
  useEffect(() => { backRef.current?.focus() }, [])
  useEffect(() => {
    const prepared = prepareDoc(doc.html), style = document.createElement('style')
    style.id = PRINT_ID; style.textContent = PRINT_BASE + '\n' + prepared.pageCss; document.head.appendChild(style)
    return () => style.remove()
  }, [doc])
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const print = () => { try { window.print() } catch { notify('La stampa non è disponibile su questo dispositivo: usa "Apri nel browser".', 'info') } }
  const openInBrowser = () => {                                                // click diretto: il browser lo consente; l'app resta qui sotto
    let w = null
    try { const url = URL.createObjectURL(new Blob([doc.html], { type: 'text/html' })); w = window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 120000) } catch {}
    if (!w) notify('Il browser ha bloccato la finestra: consentila e riprova.', 'error')
  }
  const btn = { background: '#161616', color: '#F0F0F0', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, whiteSpace: 'nowrap' }
  return (
    <div id="fofit-pdf-overlay" role="dialog" aria-modal="true" aria-label={doc.title} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#2B2B2B', display: 'flex', flexDirection: 'column' }}>
      <div id="fofit-pdf-toolbar" style={{ background: '#0D0D0D', borderBottom: '0.5px solid #1C1C1C', padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button ref={backRef} onClick={onClose} aria-label="Torna all'app" style={{ ...btn, background: '#D4570A', border: 'none', color: 'white' }}><i className="ti ti-arrow-left" style={{ fontSize: 16 }} />Torna all'app</button>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#F0F0F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
          <button onClick={print} style={btn}><i className="ti ti-printer" style={{ fontSize: 15 }} />Stampa / Salva PDF</button>
          <button onClick={openInBrowser} aria-label="Apri nel browser" title="Apri nel browser" style={{ ...btn, padding: '9px 11px' }}><i className="ti ti-external-link" style={{ fontSize: 15 }} /></button>
        </div>
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6, lineHeight: 1.4 }}>Per salvare il PDF: tocca "Stampa / Salva PDF" e scegli "Salva come PDF" (o "Salva su File").</div>
      </div>
      <div id="fofit-pdf-scroll" style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 10px calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
        <div id="fofit-pdf-paper" style={{ background: '#fff', color: '#111', maxWidth: 820, margin: '0 auto', borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
          <Paper html={doc.html} />
        </div>
      </div>
    </div>
  )
}

// Si monta una volta sola nell'app. Il tasto "indietro" del telefono chiude l'anteprima (invece di uscire dalla pagina).
export default function PdfViewerHost() {
  const [doc, setDoc] = useState(null)
  const pushed = useRef(false)
  useEffect(() => registerPdfHost(d => setDoc(d)), [])
  useEffect(() => {
    if (!doc) return
    try { history.pushState({ ...(history.state || {}), fofitPdf: true }, ''); pushed.current = true } catch { pushed.current = false }
    const pop = () => { pushed.current = false; setDoc(null) }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [!!doc])
  const close = React.useCallback(() => {
    if (pushed.current) { pushed.current = false; try { history.back() } catch {} }     // toglie anche la voce di cronologia aggiunta all'apertura
    setDoc(null)
  }, [])
  return doc ? createPortal(<Viewer doc={doc} onClose={close} />, document.body) : null
}
