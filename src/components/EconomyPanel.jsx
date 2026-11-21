import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildEconomy } from '../lib/economy'
import { money, fmtShort } from '../lib/installments'

const card = { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: 14, marginBottom: 14 }
const tile = { background: '#161616', borderRadius: 10, padding: '10px 12px', border: '0.5px solid #1C1C1C', textAlign: 'left' }
function Tile({ label, value, sub, color = '#F0F0F0', onClick, active, testid }) {
  return (
    <button data-testid={testid} onClick={onClick} aria-pressed={active} style={{ ...tile, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', outline: active ? '1px solid #D4570A' : 'none' }}>
      <div style={{ fontSize: 10, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, margin: '2px 0' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#AAA' }}>{sub}</div>}
    </button>
  )
}

// clients: elenco clienti (con subscription_end, payment_type) · rates: tutte le rate · onOpen(clientId) apre la scheda abbonamento
export default function EconomyPanel({ clients, rates, today, onOpen }) {
  const e = useMemo(() => buildEconomy({ clients, rates, today }), [clients, rates, today])
  const [open, setOpen] = useState(null)
  const toggle = k => setOpen(o => (o === k ? null : k))
  const diff = e.collectedMonth - e.collectedPrev
  const list = { overdue: e.overdue, upcoming: e.upcoming }[open]
  return (
    <div data-testid="riepilogo-economico" style={card}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F0F0', marginBottom: 10 }}>💶 Riepilogo economico <span style={{ fontWeight: 400, color: '#AAA' }}>(rate)</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        <Tile testid="eco-incassato" label="Incassato questo mese" value={money(e.collectedMonth)} color="#6FCF97" sub={e.collectedPrev ? `mese scorso ${money(e.collectedPrev)}${diff ? ` (${diff > 0 ? '+' : '−'}${money(Math.abs(diff))})` : ''}` : `${e.collectedMonthCount} ${e.collectedMonthCount === 1 ? 'rata' : 'rate'}`} />
        <Tile testid="eco-previsto" label="Previsto a fine mese" value={money(e.expectedMonth)} sub="incassato + da incassare" />
        <Tile testid="eco-in-arrivo" label={`In arrivo (30 giorni)`} value={money(e.upcomingTotal)} color="#E8C050" sub={`${e.upcoming.length} ${e.upcoming.length === 1 ? 'rata' : 'rate'}`} onClick={e.upcoming.length ? () => toggle('upcoming') : undefined} active={open === 'upcoming'} />
        <Tile testid="eco-scadute" label="Rate scadute" value={money(e.overdueTotal)} color={e.overdue.length ? '#F07070' : '#6FCF97'} sub={`${e.overdue.length} ${e.overdue.length === 1 ? 'rata' : 'rate'}`} onClick={e.overdue.length ? () => toggle('overdue') : undefined} active={open === 'overdue'} />
      </div>
      {list && (
        <div data-testid={`eco-elenco-${open}`} style={{ marginTop: 10 }}>
          {list.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '0.5px solid #151515', fontSize: 12 }}>
              <span style={{ flex: 1, fontWeight: 600, color: '#F0F0F0' }}>{r.name}</span>
              <span style={{ color: open === 'overdue' ? '#F07070' : '#CCC', fontSize: 11 }}>{open === 'overdue' ? (r.blocked ? `scaduta da ${r.late} gg · bloccato` : `scaduta da ${r.late} gg`) : fmtShort(r.due)}</span>
              <span style={{ fontWeight: 700, minWidth: 54, textAlign: 'right' }}>{money(r.amount)}</span>
              {onOpen && <button onClick={() => onOpen(r.clientId)} style={{ background: 'rgba(212,87,10,0.12)', color: '#F4894A', border: '0.5px solid #D4570A', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Apri</button>}
            </div>
          ))}
        </div>
      )}
      <div data-testid="eco-rinnovi" style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid #1C1C1C' }}>
        <div style={{ fontSize: 11, color: '#CCC', fontWeight: 600, marginBottom: 6 }}>Rinnovi nei prossimi 30 giorni: {e.renewals.length}</div>
        {e.renewals.length === 0 ? <div style={{ fontSize: 11, color: '#AAA' }}>Nessun abbonamento in scadenza.</div> :
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {e.renewals.map(r => (
              <button key={r.clientId} onClick={onOpen ? () => onOpen(r.clientId) : undefined} style={{ background: '#161616', border: '0.5px solid #1C1C1C', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#F0F0F0', cursor: onOpen ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {r.name} <span style={{ color: r.days <= 7 ? '#F4894A' : '#AAA' }}>· {r.days === 0 ? 'oggi' : `${r.days} gg`}</span>
              </button>
            ))}
          </div>}
      </div>
      {e.noDateCount > 0 && <div style={{ fontSize: 10, color: '#E8A020', marginTop: 10 }}>⚠ {e.noDateCount} {e.noDateCount === 1 ? 'rata senza scadenza non è inclusa' : 'rate senza scadenza non sono incluse'} nei totali «in arrivo».</div>}
      <div style={{ fontSize: 10, color: '#888', marginTop: 8 }}>Qui solo le rate. Incassi complessivi (anche a soluzione unica), andamento e registro: <Link to="/economia" style={{ color: '#F4894A' }}>sezione Economia</Link>.</div>
    </div>
  )
}
