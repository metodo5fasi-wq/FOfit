import React, { useMemo, useState } from 'react'
import { searchFoods } from '../data/foodDatabase.js'
import { searchCustom, mergeFoods } from '../lib/customFoods'
import { useCustomFoods, getCustomFoods } from '../lib/useCustomFoods'
import { scaleChoice, foodKcal } from '../lib/alternatives'
import { NuovoAlimentoModal } from './NuovoAlimentoForm'

const input = { width: '100%', padding: '8px 10px', border: '0.5px solid #333', borderRadius: 8, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const mini = { background: '#161616', color: '#CCC', border: '0.5px solid #333', borderRadius: 7, padding: '5px 10px', minHeight: 32, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }

// Alternativa scelta A MANO: cerchi un alimento (database o «miei alimenti»), decidi la quantità e la aggiungi.
//   food = alimento del piano (per le kcal di riferimento)   onAdd(scelta)   onClose()
export default function AltManualForm({ food, onAdd, onClose }) {
  useCustomFoods()
  const [q, setQ] = useState(''), [picked, setPicked] = useState(null), [mode, setMode] = useState('eq'), [val, setVal] = useState('')
  const [modal, setModal] = useState(false)
  const kcal0 = foodKcal(food)
  const results = useMemo(() => (q.trim().length >= 2 && !picked ? mergeFoods(searchCustom(getCustomFoods(), q), searchFoods(q), 8) : []), [q, picked])
  const choice = picked ? { name: picked.name, brand: picked.brand === '—' ? '' : picked.brand || '', cat: picked.cat || '', p: picked.p, c: picked.c, g: picked.g, ...(mode !== 'eq' && Number(String(val).replace(',', '.')) > 0 ? { mode, value: Number(String(val).replace(',', '.')) } : {}) } : null
  const sc = choice && (mode === 'eq' || choice.mode) ? scaleChoice(choice, kcal0) : null
  const pick = f => { setPicked(f); setQ(f.name); setVal('') }
  return (
    <div data-testid="alt-manuale" style={{ background: '#0D0D0D', border: '0.5px solid #333', borderRadius: 8, padding: 10, marginTop: 8 }}>
      <div style={{ fontSize: 11, color: '#CCC', marginBottom: 6 }}>Scegli tu l'alternativa a «{food.food_name}»</div>
      <input aria-label="Cerca alimento alternativo" style={input} placeholder="Cerca un alimento (anche tra i tuoi)" value={q} onChange={e => { setQ(e.target.value); setPicked(null) }} />
      {results.length > 0 && (
        <div data-testid="alt-risultati" style={{ border: '0.5px solid #222', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
          {results.map((f, i) => (
            <button type="button" key={i} onClick={() => pick(f)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '0.5px solid #1A1A1A', padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', color: '#F0F0F0', fontSize: 12 }}>
              <span>{f.custom && <span style={{ color: '#F4894A' }}>★ </span>}{f.name}{f.brand && f.brand !== '—' ? <span style={{ color: '#888' }}> · {f.brand}</span> : null}</span>
              <span style={{ color: '#AAA', whiteSpace: 'nowrap' }}>{Math.round(f.kcal100)} kcal/100g</span>
            </button>
          ))}
        </div>
      )}
      {!picked && q.trim().length >= 2 && <button type="button" data-testid="alt-crea-alimento" onClick={() => setModal(true)} style={{ ...mini, marginTop: 6, color: '#F4894A', background: 'none', border: 'none', padding: '4px 0' }}>+ Non lo trovi? Aggiungi «{q.trim()}» ai tuoi alimenti</button>}
      {picked && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 6px' }}>
            {[['eq', 'Pari calorie'], ['g', 'Grammi'], ['kcal', 'Kcal']].map(([m, l]) => (
              <button type="button" key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setVal('') }} style={{ ...mini, ...(mode === m ? { background: 'rgba(212,87,10,0.18)', borderColor: '#D4570A', color: '#F4894A', fontWeight: 700 } : {}) }}>{l}</button>
            ))}
          </div>
          {mode !== 'eq' && <input aria-label={mode === 'g' ? 'Grammi' : 'Kcal'} inputMode="decimal" style={{ ...input, marginBottom: 6 }} placeholder={mode === 'g' ? 'Grammi (es. 200)' : 'Kcal che deve avere (es. 350)'} value={val} onChange={e => setVal(e.target.value)} />}
          {sc
            ? <div data-testid="alt-anteprima" style={{ fontSize: 12, color: '#F0F0F0', marginBottom: 8 }}><b>{sc.grams} g</b> di {picked.name} = {sc.kcal} kcal <span style={{ color: Math.abs(sc.dKcal) <= 15 ? '#6FCF97' : '#E8C050' }}>({sc.dKcal > 0 ? '+' : sc.dKcal < 0 ? '−' : '±'}{Math.abs(sc.dKcal)} rispetto al piano)</span><span style={{ color: '#AAA' }}> · P {sc.pG} C {sc.cG} G {sc.gG}</span>{mode === 'eq' && <div style={{ fontSize: 10, color: '#888' }}>Segue la quantità del piano: se cambi i grammi dell'alimento, si adegua.</div>}{mode !== 'eq' && <div style={{ fontSize: 10, color: '#888' }}>Quantità fissa: non cambia se modifichi i grammi dell'alimento.</div>}</div>
            : mode !== 'eq' && <div style={{ fontSize: 11, color: '#AAA', marginBottom: 8 }}>Scrivi {mode === 'g' ? 'i grammi' : 'le kcal'} per vedere l'anteprima.</div>}
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button type="button" data-testid="alt-aggiungi" disabled={!picked || !sc} onClick={() => { onAdd(choice); onClose() }} style={{ ...mini, background: '#D4570A', borderColor: '#D4570A', color: '#fff', fontWeight: 600, opacity: picked && sc ? 1 : 0.5 }}>Aggiungi alternativa</button>
        <button type="button" onClick={onClose} style={mini}>Annulla</button>
      </div>
      {modal && <NuovoAlimentoModal defaultName={q.trim()} onClose={() => setModal(false)} onSaved={f => { setModal(false); pick(f) }} />}
    </div>
  )
}
