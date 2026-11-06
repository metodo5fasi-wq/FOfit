import React, { Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const isChunkError = e => /dynamically imported module|Failed to fetch|Loading chunk|Importing a module script|ChunkLoadError|error loading dynamically/i.test(String(e?.message || e || ''))

export function PageLoading() {
  return (
    <div role="status" aria-label="Caricamento" style={{ minHeight: '55vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 13, gap: 10 }}>
      <i className="ti ti-loader-2" style={{ fontSize: 28, color: '#D4570A' }} />Caricamento…
    </div>
  )
}

class ChunkBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }) }   // cambiando pagina si riprova
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (!isChunkError(error)) throw error                // un errore vero della pagina resta gestito dalla schermata di errore generale
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return (
      <div role="alert" style={{ minHeight: '55vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#F0F0F0' }}>
        <i className={`ti ${offline ? 'ti-wifi-off' : 'ti-cloud-off'}`} style={{ fontSize: 36, color: '#F4894A', marginBottom: 10 }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{offline ? 'Questa sezione richiede la connessione' : 'Non riesco a caricare questa sezione'}</div>
        <div style={{ fontSize: 13, color: '#AAA', marginBottom: 18, maxWidth: 320, lineHeight: 1.5 }}>{offline ? 'Non l\'hai ancora aperta con la rete, quindi non è salvata sul telefono. Riprova quando sei online.' : 'Controlla la connessione e riprova.'}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.location.reload()} style={{ background: '#D4570A', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Riprova</button>
          <button onClick={this.props.onHome} style={{ background: '#161616', color: '#F0F0F0', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Torna alla home</button>
        </div>
      </div>
    )
  }
}

// Contenitore delle pagine caricate a richiesta: mostra "Caricamento…" e gestisce il download non riuscito
export default function RouteBoundary({ children }) {
  const loc = useLocation(), navigate = useNavigate()
  return <ChunkBoundary resetKey={loc.pathname} onHome={() => navigate('/')}><Suspense fallback={<PageLoading />}>{children}</Suspense></ChunkBoundary>
}
