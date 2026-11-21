import React from 'react'

export const s = {
  card: { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: 14, marginBottom: 12 },
  h: { fontSize: 12, fontWeight: 700, color: '#F0F0F0', marginBottom: 10 },
  label: { fontSize: 11, color: '#CCC', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 },
  input: { width: '100%', padding: '9px 12px', border: '0.5px solid #1C1C1C', borderRadius: 8, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  btn: { background: '#D4570A', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSm: { background: 'rgba(212,87,10,0.12)', color: '#F4894A', border: '0.5px solid #D4570A', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnGray: { background: '#161616', color: '#CCC', border: '0.5px solid #1C1C1C', borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  btnGreen: { background: 'rgba(59,140,90,0.12)', color: '#6FCF97', border: '0.5px solid #3B6D11', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '0.5px solid #151515', fontSize: 12, flexWrap: 'wrap' },
  muted: { fontSize: 11, color: '#AAA' },
}

export function Tile({ label, value, sub, color = '#F0F0F0', testid }) {
  return (
    <div data-testid={testid} style={{ background: '#161616', borderRadius: 10, padding: '10px 12px', border: '0.5px solid #1C1C1C' }}>
      <div style={{ fontSize: 10, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, margin: '2px 0' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#AAA' }}>{sub}</div>}
    </div>
  )
}
export const Grid = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 12 }}>{children}</div>
export const Empty = ({ children }) => <div style={{ fontSize: 12, color: '#AAA', padding: '8px 0' }}>{children}</div>

// barre orizzontali semplici: [{label, value}]
export function Bars({ items, color = '#D4570A', fmt }) {
  const max = Math.max(...items.map(i => i.value), 0.0001), tot = items.reduce((a, i) => a + i.value, 0) || 1
  return (
    <div>
      {items.map(i => (
        <div key={i.label} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F0F0F0', marginBottom: 3 }}><span>{i.label}</span><span><b>{fmt(i.value)}</b> <span style={{ color: '#888' }}>· {Math.round(i.value / tot * 100)}%</span></span></div>
          <div style={{ height: 6, background: '#161616', borderRadius: 3 }}><div style={{ width: `${Math.max(2, i.value / max * 100)}%`, height: 6, background: color, borderRadius: 3 }} /></div>
        </div>
      ))}
    </div>
  )
}
