import React, { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbMust } from '../../lib/db'
import { done, notify } from '../../lib/toast'
import { num, money } from '../../lib/installments'
import { missingPrices, r2 } from '../../lib/ledger'
import { localDateStr } from '../../lib/dates'
import { s, Empty } from './ui'

// Per i clienti già presenti prima della sezione Economia: il coach inserisce il prezzo (e, se già pagato, l'incasso) una volta sola.
export default function CompletaPrezzi({ clients, rates, priceList, onChange }) {
  const list = useMemo(() => missingPrices(clients), [clients])
  const [vals, setVals] = useState({})
  const [saving, setSaving] = useState(false)
  const rateSum = id => r2((rates || []).filter(r => r.client_id === id).reduce((a, r) => a + num(r.amount), 0))
  const get = x => vals[x.id] || { price: x.payment_type === 'rate' && rateSum(x.id) > 0 ? String(rateSum(x.id)) : '', paid: false, date: x.start || localDateStr() }
  const set = (x, patch) => setVals(p => ({ ...p, [x.id]: { ...get(x), ...patch } }))

  async function save() {
    const todo = list.map(x => ({ x, v: get(x) })).filter(({ v }) => num(v.price) > 0)
    if (!todo.length) { notify('Inserisci almeno un prezzo', 'error'); return }
    setSaving(true)
    let ok = 0
    try {
      for (const { x, v } of todo) {
        await dbMust(supabase.from('profiles').update({ price_agreed: num(v.price) }).eq('id', x.id), 'il prezzo', 'salvare')
        if (v.paid && x.payment_type !== 'rate') {
          if (!v.date) throw new Error('Per ' + x.name + ' manca la data dell\'incasso')
          await dbMust(supabase.from('payments').insert({ client_id: x.id, client_name: x.name, amount: num(v.price), paid_on: v.date, kind: 'abbonamento', note: 'Registrato dal completamento prezzi' }), 'l\'incasso', 'salvare')
        }
        ok++
      }
      done(ok === 1 ? 'Prezzo salvato' : `${ok} prezzi salvati`)
    } catch (e) { notify(e.message || 'Salvataggio non riuscito: riprova.', 'error') }
    setSaving(false); setVals({}); onChange()
  }

  if (!list.length) return <div data-testid="completa-prezzi" style={s.card}><div style={s.h}>✅ Prezzi dei clienti</div><Empty>Tutti i clienti hanno un prezzo.</Empty></div>
  return (
    <div data-testid="completa-prezzi" style={s.card}>
      <div style={s.h}>💶 Completa i prezzi ({list.length})</div>
      <div style={{ ...s.muted, lineHeight: 1.5, marginBottom: 8 }}>Inserisci quanto paga ogni cliente per l'abbonamento in corso. Se ha già pagato, spunta «già incassato»: l'incasso entra nel registro alla data indicata (di solito l'inizio dell'abbonamento). I clienti a rate partono dalla somma delle loro rate; le rate già pagate sono nel registro.</div>
      {list.map(x => {
        const v = get(x)
        return (
          <div key={x.id} data-testid="riga-prezzo" style={{ ...s.row, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 150px' }}><div style={{ fontWeight: 600, color: '#F0F0F0' }}>{x.name}</div><div style={s.muted}>{x.type || '—'} · {x.payment_type === 'rate' ? 'a rate' : 'soluzione unica'}{x.end ? ` · fino al ${x.end.split('-').reverse().join('/')}` : ''}</div></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input aria-label={`Prezzo ${x.name}`} inputMode="decimal" placeholder="€" style={{ ...s.input, width: 90 }} value={v.price} onChange={e => set(x, { price: e.target.value })} />
              {priceList.length > 0 && <select aria-label={`Listino ${x.name}`} style={{ ...s.input, width: 130 }} value="" onChange={e => { const it = priceList.find(i => i.id === e.target.value); if (it) set(x, { price: String(it.amount) }) }}><option value="">Listino…</option>{priceList.map(i => <option key={i.id} value={i.id}>{i.name} {money(i.amount)}</option>)}</select>}
              {x.payment_type !== 'rate' && <label style={{ fontSize: 11, color: '#CCC', display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" aria-label={`Già incassato ${x.name}`} checked={v.paid} onChange={e => set(x, { paid: e.target.checked })} /> già incassato</label>}
              {v.paid && x.payment_type !== 'rate' && <input type="date" aria-label={`Data incasso ${x.name}`} style={{ ...s.input, width: 140 }} value={v.date} onChange={e => set(x, { date: e.target.value })} />}
            </div>
          </div>
        )
      })}
      <button onClick={save} disabled={saving} style={{ ...s.btn, marginTop: 12, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvo…' : '💾 Salva i prezzi inseriti'}</button>
    </div>
  )
}
