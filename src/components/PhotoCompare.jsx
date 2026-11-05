import React, { useMemo, useRef, useState } from 'react'

const fmtDate = d => new Date(d + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
const weeksBetween = (a, b) => Math.round(Math.abs(new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000 / 7)
const chip = on => ({ padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', background: on ? '#D4570A' : '#161616', color: on ? 'white' : '#CCC', borderColor: on ? '#D4570A' : '#2A2A2A' })
const sel = { flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 9, border: '0.5px solid #2A2A2A', background: '#161616', color: '#F0F0F0', fontSize: 13, fontFamily: 'inherit' }

// Confronto prima / dopo con cursore: si trascina (o si usa la barra sotto) per scoprire la differenza.
// photos: [{ id, photo_url, photo_date, label }] — si confrontano foto dello stesso angolo (label).
export default function PhotoCompare({ photos = [] }) {
  const groups = useMemo(() => {
    const g = {}; photos.filter(p => p?.photo_url && p.photo_date).forEach(p => { const k = p.label || 'Foto'; (g[k] ||= []).push(p) })
    Object.values(g).forEach(a => a.sort((x, y) => x.photo_date.localeCompare(y.photo_date) || String(x.id).localeCompare(String(y.id))))
    return Object.fromEntries(Object.entries(g).filter(([, a]) => a.length >= 2))
  }, [photos])
  const labels = Object.keys(groups)
  const [label, setLabel] = useState(null), [pick, setPick] = useState({}), [pos, setPos] = useState(50)
  const box = useRef(null), dragging = useRef(false)
  if (!labels.length) return null
  const cur = labels.includes(label) ? label : labels.slice().sort((a, b) => groups[b].length - groups[a].length)[0]
  const list = groups[cur], p = pick[cur] || {}
  const before = list.find(x => x.id === p.before) || list[0], after = list.find(x => x.id === p.after && x.id !== before.id) || (before.id === list[list.length - 1].id ? list[list.length - 2] : list[list.length - 1])
  const setFromX = x => { const r = box.current?.getBoundingClientRect(); if (!r || !r.width) return; setPos(Math.max(0, Math.min(100, Math.round((x - r.left) / r.width * 100)))) }
  const choose = (k, id) => setPick(s => ({ ...s, [cur]: { ...(s[cur] || {}), [k]: id } }))

  return (
    <div data-testid="photo-compare" style={{ background: '#0D0D0D', borderRadius: 14, border: '0.5px solid #1C1C1C', padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#F4894A', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Confronto prima / dopo</div>
      {labels.length > 1 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{labels.map(l => <button key={l} type="button" aria-pressed={l === cur} onClick={() => setLabel(l)} style={chip(l === cur)}>{l}</button>)}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <label style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#AAA', fontWeight: 700, textTransform: 'uppercase' }}>Prima
          <select aria-label="Foto di prima" value={before.id} onChange={e => choose('before', e.target.value)} style={{ ...sel, display: 'block', width: '100%', marginTop: 4 }}>{list.filter(x => x.id !== after.id).map(x => <option key={x.id} value={x.id}>{fmtDate(x.photo_date)}</option>)}</select></label>
        <label style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#AAA', fontWeight: 700, textTransform: 'uppercase' }}>Dopo
          <select aria-label="Foto di dopo" value={after.id} onChange={e => choose('after', e.target.value)} style={{ ...sel, display: 'block', width: '100%', marginTop: 4 }}>{list.filter(x => x.id !== before.id).map(x => <option key={x.id} value={x.id}>{fmtDate(x.photo_date)}</option>)}</select></label>
      </div>
      <div ref={box} data-testid="compare-box"
        onPointerDown={e => { dragging.current = true; try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {} setFromX(e.clientX) }}
        onPointerMove={e => { if (dragging.current) setFromX(e.clientX) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}
        style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', maxHeight: 540, background: '#000', borderRadius: 12, overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none', cursor: 'ew-resize' }}>
        <img src={after.photo_url} alt={`Dopo — ${fmtDate(after.photo_date)}`} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        <div data-testid="before-layer" style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={before.photo_url} alt={`Prima — ${fmtDate(before.photo_date)}`} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: '#F4894A', transform: 'translateX(-1px)', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 34, height: 34, borderRadius: '50%', background: '#D4570A', border: '2px solid white', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-arrows-horizontal" style={{ fontSize: 17, color: 'white' }} /></div>
        </div>
        <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 8 }}>Prima · {fmtDate(before.photo_date)}</span>
        <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(212,87,10,0.9)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 8 }}>Dopo · {fmtDate(after.photo_date)}</span>
      </div>
      <input type="range" min="0" max="100" value={pos} onChange={e => setPos(Number(e.target.value))} aria-label="Sposta per confrontare prima e dopo" style={{ width: '100%', marginTop: 10, accentColor: '#D4570A' }} />
      <div style={{ fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 4 }}>{weeksBetween(before.photo_date, after.photo_date) > 0 ? `${weeksBetween(before.photo_date, after.photo_date)} settimane di differenza` : 'Foto dello stesso periodo'}</div>
    </div>
  )
}
