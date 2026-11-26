import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dbSave } from '../lib/db'
import { askConfirm } from '../lib/confirm'
import { done } from '../lib/toast'
import { useCustomFoods, refreshCustomFoods, customFoodsStatus } from '../lib/useCustomFoods'
import { searchCustom, macroKcal } from '../lib/customFoods'
import NuovoAlimentoForm from '../components/NuovoAlimentoForm'

const card = { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: 14, marginBottom: 12 }
const btn = { background: '#D4570A', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGray = { background: '#161616', color: '#CCC', border: '0.5px solid #1C1C1C', borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }

// «I miei alimenti»: gli alimenti inseriti a mano dal coach (valori per 100 g). Compaiono nella ricerca dei piani, nelle alternative, nel diario e per l'assistente.
export default function AlimentiMiei() {
  const { foods } = useCustomFoods()
  const st = customFoodsStatus()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)            // null | 'new' | alimento
  const list = useMemo(() => (q.trim().length >= 2 ? searchCustom(foods, q) : foods), [foods, q])

  async function remove(f) {
    if (!(await askConfirm(`Eliminare «${f.name}»? I piani in cui l'hai già usato non cambiano.`, { title: 'Eliminare l\'alimento?', confirmLabel: 'Elimina', danger: true }))) return
    const r = await dbSave(supabase.from('custom_foods').delete().eq('id', f.id), 'l\'alimento', 'eliminare', { silent: false, done: 'Alimento eliminato' })
    if (r.ok) await refreshCustomFoods()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ background: '#0D0D0D', borderBottom: '0.5px solid #1A1A1A', padding: '0 22px', height: 56, display: 'flex', alignItems: 'center', flexShrink: 0, gap: 12 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>I miei alimenti</div><div style={{ fontSize: 11, color: '#CCC' }}>Alimenti inseriti da te, valori per 100 g</div></div>
        <button onClick={() => setEdit('new')} style={btn}>+ Nuovo alimento</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
        {edit && (
          <div style={{ ...card, padding: 0 }}>
            <div style={{ padding: '12px 14px 0', fontSize: 13, fontWeight: 700, color: '#F0F0F0' }}>{edit === 'new' ? 'Nuovo alimento' : `Modifica «${edit.name}»`}</div>
            <NuovoAlimentoForm key={edit === 'new' ? 'new' : edit.id} initial={edit === 'new' ? null : edit} onSaved={() => setEdit(null)} onCancel={() => setEdit(null)} />
            {edit !== 'new' && <div style={{ padding: '0 14px 12px', fontSize: 10, color: '#888' }}>I piani già salvati non cambiano: i valori restano quelli di quando hai inserito l'alimento nel piano.</div>}
          </div>
        )}
        {!st.loaded && foods.length === 0 && <div data-testid="alimenti-caricamento" style={{ ...card, fontSize: 12, color: '#AAA' }}>Carico i tuoi alimenti…</div>}
        {st.error === 'sql' && <div role="alert" data-testid="alimenti-sql" style={{ ...card, fontSize: 12, color: '#E8C050', lineHeight: 1.6 }}>Manca la tabella degli alimenti su Supabase. Apri Supabase → SQL Editor, incolla il contenuto del file <b>fofit-alimenti-miei.sql</b> e premi Run (una volta sola), poi ricarica questa pagina.</div>}
        {st.error === 'rete' && <div role="alert" data-testid="alimenti-rete" style={{ ...card, fontSize: 12, color: '#E8C050', lineHeight: 1.6 }}>Non riesco a leggere i tuoi alimenti (connessione o permessi). <button onClick={() => refreshCustomFoods()} style={btnGray}>Riprova</button></div>}
        <input aria-label="Cerca tra i miei alimenti" style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #1C1C1C', borderRadius: 8, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }} placeholder="Cerca tra i miei alimenti" value={q} onChange={e => setQ(e.target.value)} />
        <div style={card} data-testid="elenco-alimenti-miei">
          {foods.length === 0 && st.loaded && !st.error && <div style={{ fontSize: 12, color: '#AAA', lineHeight: 1.6 }}>Non hai ancora inserito nessun alimento. Premi «+ Nuovo alimento», oppure aggiungilo direttamente dalla ricerca quando costruisci un piano.<div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>Se il salvataggio non funziona, esegui prima lo script fofit-alimenti-miei.sql su Supabase.</div></div>}
          {foods.length > 0 && list.length === 0 && <div style={{ fontSize: 12, color: '#AAA' }}>Nessun alimento con questo nome.</div>}
          {list.map(f => (
            <div key={f.id} data-testid="alimento-mio" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderTop: '0.5px solid #151515', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F0F0' }}>{f.name}{f.brand && f.brand !== '—' ? <span style={{ fontWeight: 400, color: '#888' }}> · {f.brand}</span> : null}</div>
                <div style={{ fontSize: 10, color: '#AAA' }}>{f.cat}</div>
              </div>
              <div style={{ fontSize: 11, color: '#CCC', whiteSpace: 'nowrap' }}><b style={{ color: '#F4894A' }}>{Math.round(f.kcal100)} kcal</b> · P {f.p} · C {f.c} · G {f.g}{Math.abs(f.kcal100 - macroKcal(f.p, f.c, f.g)) > Math.max(15, macroKcal(f.p, f.c, f.g) * 0.1) && macroKcal(f.p, f.c, f.g) > 0 ? <span title={`Dai macro: ${macroKcal(f.p, f.c, f.g)} kcal. Nei piani l'app usa il calcolo dai macro.`} style={{ color: '#E8C050' }}> ⚠</span> : null}</div>
              <button aria-label={`Modifica ${f.name}`} onClick={() => setEdit(f)} style={btnGray}>Modifica</button>
              <button aria-label={`Elimina ${f.name}`} onClick={() => remove(f)} style={{ ...btnGray, color: '#E24B4A' }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
