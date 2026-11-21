import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbSave } from '../../lib/db'
import { askConfirm } from '../../lib/confirm'
import { notify } from '../../lib/toast'
import { num, money } from '../../lib/installments'
import { s, Empty } from './ui'

// Listino: i prezzi di riferimento. Durata (mesi) facoltativa: serve al ricavo mensile ricorrente.
export default function ListinoPrezzi({ items, onChange }) {
  const [edit, setEdit] = useState(null)        // null | 'new' | id
  const [f, setF] = useState({ name: '', amount: '', months: '' })
  const open = it => { setEdit(it ? it.id : 'new'); setF(it ? { name: it.name, amount: it.amount, months: it.months ?? '' } : { name: '', amount: '', months: '' }) }
  async function save() {
    if (!f.name.trim()) { notify('Scrivi il nome della voce (es. «Trimestrale»)', 'error'); return }
    if (!(num(f.amount) >= 0) || String(f.amount).trim() === '') { notify('Inserisci il prezzo', 'error'); return }
    const row = { name: f.name.trim(), amount: num(f.amount), months: num(f.months) > 0 ? num(f.months) : null }
    const q = edit === 'new' ? supabase.from('price_list').insert({ ...row, sort: items.length }) : supabase.from('price_list').update(row).eq('id', edit)
    const r = await dbSave(q, 'la voce del listino', 'salvare'); if (!r.ok) return
    setEdit(null); onChange()
  }
  async function remove(it) {
    if (!(await askConfirm(`Eliminare «${it.name}» dal listino? I prezzi già assegnati ai clienti non cambiano.`, { title: 'Eliminare la voce?', confirmLabel: 'Elimina', danger: true }))) return
    const r = await dbSave(supabase.from('price_list').delete().eq('id', it.id), 'la voce del listino', 'eliminare'); if (r.ok) onChange()
  }
  const form = (
    <div data-testid="form-listino" style={{ background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={s.label} htmlFor="lst-nome">Nome</label><input id="lst-nome" style={s.input} placeholder="es. Trimestrale" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label style={s.label} htmlFor="lst-prezzo">Prezzo (€)</label><input id="lst-prezzo" inputMode="decimal" style={s.input} value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} /></div>
        <div><label style={s.label} htmlFor="lst-mesi">Durata (mesi)</label><input id="lst-mesi" inputMode="decimal" style={s.input} placeholder="facoltativa" value={f.months} onChange={e => setF(p => ({ ...p, months: e.target.value }))} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button onClick={save} style={s.btn}>Salva voce</button><button onClick={() => setEdit(null)} style={{ ...s.btnGray, padding: '9px 14px', fontSize: 13 }}>Annulla</button></div>
    </div>
  )
  return (
    <div data-testid="listino" style={s.card}>
      <div style={s.h}>📋 Listino prezzi</div>
      <div style={{ ...s.muted, marginBottom: 8, lineHeight: 1.5 }}>Quando inserisci il prezzo di un cliente puoi sceglierlo da qui e poi cambiarlo (sconto, omaggio). La durata serve a calcolare quanto «vale» al mese un abbonamento.</div>
      {items.length === 0 && edit !== 'new' && <Empty>Il listino è vuoto. Aggiungi le tue voci (es. Mensile 100, Trimestrale 270…).</Empty>}
      {items.map(it => edit === it.id ? <div key={it.id}>{form}</div> : (
        <div key={it.id} data-testid="voce-listino" style={s.row}>
          <span style={{ flex: 1, fontWeight: 600, color: '#F0F0F0' }}>{it.name}</span>
          {it.months ? <span style={s.muted}>{it.months} {Number(it.months) === 1 ? 'mese' : 'mesi'}</span> : null}
          <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{money(it.amount)}</span>
          <button onClick={() => open(it)} style={s.btnGray}>Modifica</button>
          <button aria-label={`Elimina ${it.name}`} onClick={() => remove(it)} style={{ ...s.btnGray, color: '#E24B4A' }}>✕</button>
        </div>
      ))}
      {edit === 'new' ? form : <button onClick={() => open(null)} style={{ ...s.btnGreen, marginTop: 10 }}>+ Aggiungi voce</button>}
    </div>
  )
}
