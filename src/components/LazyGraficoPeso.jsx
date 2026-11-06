import React, { lazy, Suspense } from 'react'
import { isChunkError } from './RouteBoundary'

// Il grafico del peso si carica a richiesta: la libreria dei grafici (la parte più pesante) non rallenta l'apertura della Home
const Chart = lazy(() => import('./GraficiProgressi').then(m => ({ default: m.GraficoPeso })))

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    if (!isChunkError(this.state.error)) throw this.state.error
    return <div style={{ fontSize: 12, color: '#AAA', textAlign: 'center', padding: '24px 0' }}>Il grafico non è disponibile senza connessione</div>
  }
}

export default function GraficoPesoLazy(props) {
  return (
    <Boundary>
      <Suspense fallback={<div role="status" aria-label="Caricamento grafico" style={{ minHeight: props.compact ? 190 : 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 12 }}>Caricamento grafico…</div>}>
        <Chart {...props} />
      </Suspense>
    </Boundary>
  )
}
