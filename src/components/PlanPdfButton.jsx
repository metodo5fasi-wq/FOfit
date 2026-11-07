import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'
import { exportPlanPdf } from '../lib/planPdf'

// Pulsante "PDF" del piano alimentare (cliente e coach). Il PDF usa la versione salvata del piano.
export default function PlanPdfButton({ planId, confirmMessage = null, style = {}, label = 'PDF' }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e?.stopPropagation?.()
    if (!planId || busy) return
    if (navigator.onLine === false) { toast?.('Per creare il PDF serve la connessione', 'error'); return }
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setBusy(true)
    try { const ok = await exportPlanPdf(supabase, planId); if (!ok) toast?.('Impossibile aprire il PDF. Riprova.', 'error') }
    catch (err) { toast?.('Errore nella creazione del PDF: ' + (err?.message || 'riprova'), 'error') }
    setBusy(false)
  }
  return (
    <button type="button" onClick={go} disabled={!planId || busy} aria-label="Scarica il piano in PDF" title="Scarica il piano in PDF"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(212,87,10,0.14)', color: '#F4894A', border: '0.5px solid rgba(212,87,10,0.45)', borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: planId ? 1 : 0.5, ...style }}>
      <i className={`ti ${busy ? 'ti-loader-2' : 'ti-file-download'}`} style={{ fontSize: 14 }} />{busy ? 'Creo…' : label}
    </button>
  )
}
