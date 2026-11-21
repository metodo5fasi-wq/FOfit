import React, { useState } from 'react'
import { num } from '../lib/installments'
import { PAY_KINDS, METHODS } from '../lib/ledger'
import { localDateStr } from '../lib/dates'
import { notify } from '../lib/toast'

const label = { fontSize: 11, color: '#CCC', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }
const input = { width: '100%', padding: '9px 12px', border: '0.5px solid #1C1C1C', borderRadius: 8, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const btn = { background: '#D4570A', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGray = { background: '#161616', color: '#CCC', border: '0.5px solid #1C1C1C', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

// Registra o modifica UN incasso. clients: elenco per la scelta (se manca `fixedClient`). onSave(payload) è asincrona: il modulo resta aperto se lancia/ritorna false.
export default function IncassoForm({ initial, clients = [], fixedClient, defaultAmount = '', defaultKind = 'abbonamento', onSave, onCancel }) {
  const [f, setF] = useState(() => ({
    client_id: initial?.client_id ?? fixedClient?.id ?? '', client_name: initial?.client_name || '',
    amount: initial?.amount ?? defaultAmount, paid_on: String(initial?.paid_on || localDateStr()).slice(0, 10),
    kind: initial?.kind || defaultKind, method: initial?.method || 'Bonifico', note: initial?.note || '',
  }))
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  async function submit(e) {
    e?.preventDefault?.()
    if (busy) return
    if (!(num(f.amount) > 0)) { notify('Inserisci un importo maggiore di zero', 'error'); return }
    if (!f.paid_on) { notify('Inserisci la data dell\'incasso', 'error'); return }
    const cl = fixedClient || clients.find(c => c.id === f.client_id)
    const name = cl?.full_name || (f.client_id ? f.client_name : '') || f.client_name.trim()
    if (!f.client_id && !name) { notify('Scegli il cliente o scrivi un nome', 'error'); return }
    setBusy(true)
    try { await onSave({ client_id: f.client_id || null, client_name: name || null, amount: Math.round(num(f.amount) * 100) / 100, paid_on: f.paid_on, kind: f.kind, method: f.method || null, note: f.note.trim() || null }) } finally { setBusy(false) }
  }
  return (
    <form data-testid="form-incasso" onSubmit={submit} style={{ background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {!fixedClient && (
          <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="inc-cliente">Cliente</label>
            <select id="inc-cliente" style={input} value={f.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Non è un cliente dell'app —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            {!f.client_id && <input aria-label="Nome" style={{ ...input, marginTop: 6 }} placeholder="Nome (facoltativo se il cliente è già scelto)" value={f.client_name} onChange={e => set('client_name', e.target.value)} />}
          </div>
        )}
        <div><label style={label} htmlFor="inc-importo">Importo (€)</label><input id="inc-importo" inputMode="decimal" style={input} placeholder="es. 150" value={f.amount} onChange={e => set('amount', e.target.value)} /></div>
        <div><label style={label} htmlFor="inc-data">Data incasso</label><input id="inc-data" type="date" style={input} value={f.paid_on} onChange={e => set('paid_on', e.target.value)} /></div>
        <div><label style={label} htmlFor="inc-tipo">Tipo</label>
          <select id="inc-tipo" style={input} value={f.kind} onChange={e => set('kind', e.target.value)}>{PAY_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
        <div><label style={label} htmlFor="inc-metodo">Metodo</label>
          <select id="inc-metodo" style={input} value={f.method} onChange={e => set('method', e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="inc-nota">Nota</label><input id="inc-nota" style={input} placeholder="facoltativa (es. acconto, saldo…)" value={f.note} onChange={e => set('note', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Salvo…' : initial ? 'Salva modifica' : 'Registra incasso'}</button>
        <button type="button" onClick={onCancel} style={btnGray}>Annulla</button>
      </div>
    </form>
  )
}
