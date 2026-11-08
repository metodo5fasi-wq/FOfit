import React, { useEffect, useRef } from 'react'

const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
const nav = (side, off) => ({ position: 'absolute', top: '50%', [side]: 10, transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: 'none', cursor: off ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: off ? 0.25 : 1 })

// Visualizzatore di foto a schermo intero: frecce, tastiera (← → Esc), scorrimento col dito, tocco fuori per chiudere.
// photos: [{ photo_url, label, photo_date, notes }] · index: foto aperta (null = chiuso) · onChange(nuovoIndice) · onClose()
export default function PhotoLightbox({ photos = [], index = null, onChange, onClose }) {
  const touch = useRef(null), multi = useRef(false)          // multi: sono apparse due dita (pizzico per ingrandire): non è uno scorrimento
  const open = index !== null && index !== undefined && index >= 0 && photos[index]
  const go = d => { const n = index + d; if (n >= 0 && n < photos.length) onChange?.(n) }
  useEffect(() => {
    if (!open) return
    const h = e => { if (e.key === 'Escape') onClose?.(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, index, photos.length])
  if (!open) return null
  const p = photos[index]
  return (
    <div role="dialog" aria-modal="true" aria-label={`Foto ${p.label || ''} ${fmt(p.photo_date)}`.trim()} data-testid="lightbox" onClick={onClose}
      onTouchStart={e => { if ((e.touches?.length || 0) > 1) { multi.current = true; touch.current = null; return } if (!multi.current) touch.current = e.touches[0].clientX }}
      onTouchEnd={e => { if ((e.touches?.length || 0) > 0) return; if (multi.current) { multi.current = false; touch.current = null; return } if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1) }}
      onTouchCancel={() => { touch.current = null; multi.current = false }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <button className="tap" type="button" aria-label="Chiudi" onClick={e => { e.stopPropagation(); onClose?.() }} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-x" style={{ fontSize: 19, color: 'white' }} /></button>
      {photos.length > 1 && <>
        <button type="button" aria-label="Foto precedente" disabled={index === 0} onClick={e => { e.stopPropagation(); go(-1) }} style={nav('left', index === 0)}><i className="ti ti-chevron-left" style={{ fontSize: 22, color: 'white' }} /></button>
        <button type="button" aria-label="Foto successiva" disabled={index === photos.length - 1} onClick={e => { e.stopPropagation(); go(1) }} style={nav('right', index === photos.length - 1)}><i className="ti ti-chevron-right" style={{ fontSize: 22, color: 'white' }} /></button>
      </>}
      <img src={p.photo_url} alt={`${p.label || 'Foto'} — ${fmt(p.photo_date)}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12 }} />
      <div style={{ marginTop: 12, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>{p.label}</div>
        {p.photo_date && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{fmt(p.photo_date)}</div>}
        {p.notes && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6, maxWidth: 360 }}>{p.notes}</div>}
        {photos.length > 1 && <div data-testid="lightbox-counter" style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{index + 1} di {photos.length}</div>}
      </div>
    </div>
  )
}
