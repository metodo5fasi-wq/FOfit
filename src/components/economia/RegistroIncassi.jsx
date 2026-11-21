import React, { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbSave } from '../../lib/db'
import { askConfirm } from '../../lib/confirm'
import { done } from '../../lib/toast'
import { money, fmtDate } from '../../lib/installments'
import { PAY_KINDS, kindLabel, filterPayments, paymentsCsv, ymOf, monthName } from '../../lib/ledger'
import IncassoForm from '../IncassoForm'
import { s, Empty } from './ui'

function download(name, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { /* nessun download disponibile */ }
}

export default function RegistroIncassi({ payments, clients, today, onChange }) {
  const [ym, setYm] = useState(ymOf(today))
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)        // null | 'new' | payment
  const months = useMemo(() => [...new Set([ymOf(today), ...payments.map(p => ymOf(p.paid_on))])].sort().reverse(), [payments, today])
  const rows = useMemo(() => filterPayments(payments, { ym, kind, q }), [payments, ym, kind, q])
  const total = Math.round(rows.reduce((a, p) => a + Number(p.amount || 0), 0) * 100) / 100

  async function save(payload) {
    const isNew = edit === 'new'
    const r = await dbSave(isNew ? supabase.from('payments').insert(payload) : supabase.from('payments').update(payload).eq('id', edit.id), 'l\'incasso', 'salvare', { done: isNew ? 'Incasso registrato' : 'Incasso aggiornato' })
    if (!r.ok) return false
    setEdit(null); onChange(); return true
  }
  async function remove(p) {
    if (!(await askConfirm(`Eliminare l'incasso di ${money(p.amount)} del ${fmtDate(p.paid_on)}${p.client_name ? ` (${p.client_name})` : ''}?`, { title: 'Eliminare l\'incasso?', confirmLabel: 'Elimina', danger: true }))) return
    const r = await dbSave(supabase.from('payments').delete().eq('id', p.id), 'l\'incasso', 'eliminare'); if (r.ok) onChange()
  }
  function exportCsv() {
    if (!rows.length) return
    download(`incassi-${ym || 'tutti'}.csv`, paymentsCsv(rows)); done('Esportato: si apre con Excel')
  }

  return (
    <div data-testid="registro" style={s.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ ...s.h, margin: 0, flex: 1 }}>🧾 Registro incassi</div>
        <button onClick={() => setEdit('new')} style={s.btnGreen}>+ Nuovo incasso</button>
        <button onClick={exportCsv} disabled={!rows.length} style={{ ...s.btnGray, opacity: rows.length ? 1 : 0.5 }}>⬇ Esporta per Excel</button>
      </div>
      {edit && <IncassoForm key={edit === 'new' ? 'new' : edit.id} initial={edit === 'new' ? null : edit} clients={clients} onSave={save} onCancel={() => setEdit(null)} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, margin: '10px 0' }}>
        <select aria-label="Mese" style={s.input} value={ym} onChange={e => setYm(e.target.value)}>
          <option value="">Tutti i mesi</option>{months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
        <select aria-label="Tipo" style={s.input} value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">Tutti i tipi</option>{PAY_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <input aria-label="Cerca" style={s.input} placeholder="Cerca cliente o nota" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div data-testid="totale-registro" style={{ fontSize: 12, color: '#F0F0F0', marginBottom: 4 }}>{rows.length} {rows.length === 1 ? 'incasso' : 'incassi'} · totale <b style={{ color: '#6FCF97' }}>{money(total)}</b></div>
      {rows.length === 0 && <Empty>Nessun incasso con questi filtri.</Empty>}
      {rows.map(p => (
        <div key={p.id} data-testid="riga-incasso" style={s.row}>
          <span style={{ color: '#AAA', minWidth: 84 }}>{fmtDate(p.paid_on)}</span>
          <span style={{ flex: 1, minWidth: 120 }}><b style={{ color: '#F0F0F0' }}>{p.client_name || 'Senza nome'}</b><span style={s.muted}> · {kindLabel(p.kind)}{p.method ? ` · ${p.method}` : ''}{p.note ? ` · ${p.note}` : ''}</span></span>
          <span style={{ fontWeight: 700, color: '#6FCF97' }}>{money(p.amount)}</span>
          {p.installment_id == null
            ? <><button aria-label={`Modifica incasso di ${p.client_name || ''}`} onClick={() => setEdit(p)} style={s.btnGray}>✏️</button><button aria-label={`Elimina incasso di ${p.client_name || ''}`} onClick={() => remove(p)} style={{ ...s.btnGray, color: '#E24B4A' }}>✕</button></>
            : <span title="Nasce da una rata: per toglierlo segna la rata «non pagata» in Abbonamenti" style={{ fontSize: 10, color: '#777' }}>da rata</span>}
        </div>
      ))}
    </div>
  )
}
