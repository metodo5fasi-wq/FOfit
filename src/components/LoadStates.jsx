import React from 'react'

// Segnaposto mentre i dati arrivano per la prima volta (al posto di "Caricamento…"): la pagina ha già la sua forma
export function Skeleton({ rows = 4, height = 64, style = {} }) {
  return (
    <div role="progressbar" aria-busy="true" aria-label="Caricamento" style={{ padding: 14, ...style }}>
      <style>{`@keyframes fofit-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.fofit-sk{animation:none!important}}`}</style>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="fofit-sk" style={{ height, borderRadius: 14, marginBottom: 10, border: '0.5px solid #1C1C1C', background: 'linear-gradient(90deg,#0D0D0D 25%,#161616 37%,#0D0D0D 63%)', backgroundSize: '400% 100%', animation: 'fofit-shimmer 1.4s ease infinite', opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

// Una lettura non è riuscita e non c'è nessuna copia: lo si dice (invece di mostrare "nessun dato", che sarebbe falso)
export function LoadError({ onRetry, text = 'Non riesco a caricare i dati.', hint }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return (
    <div role="alert" style={{ textAlign: 'center', padding: '44px 24px', color: '#F0F0F0' }}>
      <i className={`ti ${offline ? 'ti-wifi-off' : 'ti-cloud-off'}`} style={{ fontSize: 38, color: '#F4894A', display: 'block', marginBottom: 10 }} />
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{offline ? 'Nessuna connessione' : text}</div>
      <div style={{ fontSize: 12.5, color: '#AAA', lineHeight: 1.5, maxWidth: 300, margin: '0 auto 16px' }}>{hint || (offline ? 'Questa schermata non è ancora salvata sul telefono. Riprova quando torna la rete.' : 'Controlla la connessione e riprova.')}</div>
      {onRetry && <button onClick={onRetry} style={{ background: '#D4570A', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Riprova</button>}
    </div>
  )
}

// Si stanno vedendo i dati salvati sul telefono perché non si riesce ad aggiornarli
export function StaleNotice({ onRetry, text = 'Dati salvati sul telefono: non riesco ad aggiornarli.' }) {
  return (
    <div role="status" data-testid="stale-notice" style={{ margin: '10px 14px 0', background: 'rgba(244,137,74,0.1)', border: '0.5px solid rgba(244,137,74,0.35)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#F4894A', display: 'flex', alignItems: 'center', gap: 8 }}>
      <i className="ti ti-cloud-off" style={{ fontSize: 14 }} /><span style={{ flex: 1 }}>{text}</span>
      {onRetry && <button onClick={onRetry} style={{ background: 'none', border: '0.5px solid rgba(244,137,74,0.5)', color: '#F4894A', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Riprova</button>}
    </div>
  )
}
