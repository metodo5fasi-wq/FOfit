import React from 'react'
import { KG_INTS, KG_DECS, splitKg, joinKg } from '../lib/kg.js'

const sel = done => ({ padding: '6px 2px', border: '0.5px solid #222', borderRadius: 8, fontSize: 14, fontWeight: 700, color: done ? '#3B8C5A' : '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', textAlign: 'center', cursor: 'pointer', minWidth: 0 })

// Due menu a scorrimento affiancati: kg interi e decimale (es. 6 , 2 → 6,2 kg). Il valore passato a onChange ha il punto ("6.2").
export default function KgPicker({ value, onChange, done = false }) {
  const { int, dec } = splitKg(value)
  const ints = int !== '' && int > KG_INTS[KG_INTS.length - 1] ? [...KG_INTS, int] : KG_INTS   // carichi oltre il massimo già salvati restano visibili
  return (
    <div style={{ flex: 1.8, display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
      <select aria-label="Kg (parte intera)" value={int === '' ? '' : String(int)} style={{ ...sel(done), flex: 1.3 }}
        onChange={e => onChange(e.target.value === '' ? '' : joinKg(parseInt(e.target.value), dec))}>
        <option value="">—</option>
        {ints.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
      <span style={{ color: '#888', fontWeight: 800, fontSize: 14 }}>,</span>
      <select aria-label="Kg (decimali)" value={String(dec)} style={{ ...sel(done), flex: 0.9, opacity: int === '' ? 0.55 : 1 }}
        onChange={e => onChange(joinKg(int === '' ? 0 : int, parseInt(e.target.value)))}>
        {KG_DECS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <span style={{ fontSize: 10, color: '#777', fontWeight: 600 }}>kg</span>
    </div>
  )
}
