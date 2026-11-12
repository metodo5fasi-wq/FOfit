import React, { useEffect, useState } from 'react'
import { RUNNING_BUILD, fetchLatestBuild, isUpdateAvailable, applyUpdate } from '../lib/appVersion'

const EVERY_MS = 10 * 60 * 1000

// Avviso "nuova versione disponibile": controlla all'apertura, quando si torna all'app e ogni 10 minuti.
export default function UpdateBanner({ check = fetchLatestBuild, running = RUNNING_BUILD, update = applyUpdate }) {
  const [latest, setLatest] = useState(null), [later, setLater] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    const run = async () => { const l = await check(); if (alive && isUpdateAvailable(running, l)) setLatest(l) }
    run()
    const onVis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(run, EVERY_MS)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); clearInterval(t) }
  }, [check, running])
  if (!latest || later === latest.id) return null
  return (
    <div role="status" data-testid="update-banner" style={{ position: 'fixed', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0, zIndex: 9500, background: '#D4570A', color: 'white', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>
      <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>È disponibile una nuova versione di FOfit. Salva quello che stai facendo, poi tocca Aggiorna.</span>
      <button onClick={() => setLater(latest.id)} disabled={busy} style={{ background: 'rgba(0,0,0,0.25)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Più tardi</button>
      <button onClick={async () => { setBusy(true); await update() }} disabled={busy} style={{ background: 'white', color: '#B14A07', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>{busy ? 'Aggiorno…' : 'Aggiorna'}</button>
    </div>
  )
}
