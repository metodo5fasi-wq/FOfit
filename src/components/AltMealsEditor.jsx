import React, { useMemo, useState } from 'react'
import { searchFoods } from '../data/foodDatabase.js'
import { searchCustom, mergeFoods } from '../lib/customFoods'
import { useCustomFoods, getCustomFoods } from '../lib/useCustomFoods'
import { normAltMeals, newOption, itemFromFood, itemFromPlanFood, setItemGrams, optionTotals, MAX_OPTIONS, MAX_FOODS } from '../lib/altMeals'
import { NuovoAlimentoModal } from './NuovoAlimentoForm'

const input = { width: '100%', padding: '7px 10px', border: '0.5px solid #333', borderRadius: 8, fontSize: 12, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const mini = { background: '#161616', color: '#CCC', border: '0.5px solid #333', borderRadius: 7, padding: '5px 10px', minHeight: 32, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const link = { background: 'none', border: 'none', padding: '6px 4px', minHeight: 32, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#F4894A', display: 'inline-flex', alignItems: 'center', gap: 5 }

// Aggiunge un alimento a un'opzione: cerca (database + «miei alimenti»), quantità, aggiungi
function AddFood({ onAdd }) {
  useCustomFoods()
  const [q, setQ] = useState(''), [g, setG] = useState('100'), [modal, setModal] = useState(false)
  const results = useMemo(() => (q.trim().length >= 2 ? mergeFoods(searchCustom(getCustomFoods(), q), searchFoods(q), 8) : []), [q])
  const add = f => { const grams = Number(String(g).replace(',', '.')); if (!(grams > 0)) return; onAdd(itemFromFood(f, grams)); setQ(''); setG('100') }
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Cerca alimento per l'opzione" style={{ ...input, flex: 1 }} placeholder="Cerca un alimento da aggiungere" value={q} onChange={e => setQ(e.target.value)} />
        <input aria-label="Grammi" inputMode="decimal" style={{ ...input, width: 64, textAlign: 'center' }} value={g} onChange={e => setG(e.target.value)} />
      </div>
      {results.length > 0 && (
        <div data-testid="altpasto-risultati" style={{ border: '0.5px solid #222', borderRadius: 8, marginTop: 4, maxHeight: 190, overflowY: 'auto' }}>
          {results.map((f, i) => (
            <button type="button" key={i} onClick={() => add(f)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '0.5px solid #1A1A1A', padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', color: '#F0F0F0', fontSize: 12 }}>
              <span>{f.custom && <span style={{ color: '#F4894A' }}>★ </span>}{f.name}{f.brand && f.brand !== '—' ? <span style={{ color: '#888' }}> · {f.brand}</span> : null}</span>
              <span style={{ color: '#AAA', whiteSpace: 'nowrap' }}>{Math.round(f.kcal100)} kcal/100g</span>
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && <button type="button" onClick={() => setModal(true)} style={link}>+ Non lo trovi? Aggiungi «{q.trim()}» ai tuoi alimenti</button>}
      {modal && <NuovoAlimentoModal defaultName={q.trim()} onClose={() => setModal(false)} onSaved={f => { setModal(false); add(f) }} />}
    </div>
  )
}

// Editor dei pasti alternativi di UN pasto (lato coach).
//   options = alt_meals del pasto   meal = il pasto (per copiarne gli alimenti e confrontare le kcal)   onChange(nuoveOpzioni)
export default function AltMealsEditor({ options, mealFoods = [], mealKcal = 0, onChange }) {
  const list = normAltMeals(options)
  const [open, setOpen] = useState(list.length > 0)
  const [adding, setAdding] = useState(null)       // id opzione in cui si sta aggiungendo un alimento
  const set = (id, patch) => onChange(list.map(o => (o.id === id ? { ...o, ...patch } : o)))
  const setFood = (id, fi, fn) => set(id, { foods: list.find(o => o.id === id).foods.map((f, i) => (i === fi ? fn(f) : f)) })
  const addOption = copy => { const o = newOption(list); if (copy) o.foods = mealFoods.filter(f => f.food_name).map(itemFromPlanFood).slice(0, MAX_FOODS); onChange([...list, o]); setAdding(o.id); setOpen(true) }
  const empty = list.length === 0
  return (
    <div style={{ padding: '2px 12px 8px' }}>
      <button type="button" data-testid="altpasto-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)} style={link}>
        <i className="ti ti-repeat" style={{ fontSize: 13 }} />Pasti alternativi{list.length ? <span data-testid="altpasto-count" style={{ background: 'rgba(212,87,10,0.18)', borderRadius: 9, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>{list.length}</span> : null}
      </button>
      {open && (
        <div data-testid="altpasto-pannello" style={{ background: 'rgba(212,87,10,0.06)', border: '0.5px solid rgba(212,87,10,0.25)', borderRadius: 8, padding: '8px 10px' }}>
          {empty && <div style={{ fontSize: 12, color: '#AAA', marginBottom: 6, lineHeight: 1.5 }}>Qui puoi dare al cliente un pasto completo alternativo (Opzione B…): sceglie lui quale mangiare. Non cambia le calorie del giorno nel piano.</div>}
          {list.map(o => {
            const t = optionTotals(o), d = mealKcal > 0 ? Math.round(t.kcal) - Math.round(mealKcal) : null
            return (
              <div key={o.id} data-testid="altpasto-opzione" style={{ border: '0.5px solid rgba(212,87,10,0.2)', borderRadius: 8, padding: 8, marginBottom: 8, background: '#0D0D0D' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input aria-label="Nome dell'opzione" style={{ ...input, fontWeight: 700, flex: 1 }} value={o.name} onChange={e => set(o.id, { name: e.target.value })} />
                  <button type="button" aria-label={`Elimina ${o.name}`} onClick={() => onChange(list.filter(x => x.id !== o.id))} style={{ ...mini, color: '#E24B4A' }}>✕</button>
                </div>
                {o.foods.map((f, i) => (
                  <div key={i} data-testid="altpasto-alimento" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderTop: i ? '0.5px solid #151515' : 'none', fontSize: 12 }}>
                    <input aria-label={`Grammi di ${f.food_name}`} inputMode="decimal" style={{ ...input, width: 62, textAlign: 'center', padding: '5px 4px' }} value={f.quantity_g} onChange={e => setFood(o.id, i, x => setItemGrams(x, e.target.value))} />
                    <span style={{ flex: 1, color: '#F0F0F0', wordBreak: 'break-word' }}>{f.food_name}</span>
                    <span style={{ color: '#AAA', whiteSpace: 'nowrap' }}>{f.kcal} kcal</span>
                    <button type="button" aria-label={`Togli ${f.food_name}`} onClick={() => set(o.id, { foods: o.foods.filter((_, j) => j !== i) })} style={{ ...mini, padding: '3px 8px' }}>✕</button>
                  </div>
                ))}
                {o.foods.length === 0 && <div style={{ fontSize: 11, color: '#888', padding: '4px 0' }}>Nessun alimento: aggiungine almeno uno (le opzioni vuote non vengono salvate).</div>}
                {o.foods.length > 0 && (
                  <div data-testid="altpasto-totale" style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>
                    Totale <b style={{ color: '#F4894A' }}>{Math.round(t.kcal)} kcal</b> · P {Math.round(t.p)} · C {Math.round(t.c)} · G {Math.round(t.g)}
                    {d != null && <span style={{ color: Math.abs(d) <= 50 ? '#6FCF97' : '#E8C050' }}> ({d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)} rispetto al pasto)</span>}
                  </div>
                )}
                {o.foods.length < MAX_FOODS && (adding === o.id ? <AddFood onAdd={item => set(o.id, { foods: [...o.foods, item] })} /> : <button type="button" onClick={() => setAdding(o.id)} style={link}>+ Aggiungi alimento</button>)}
                <input aria-label="Nota per il cliente" style={{ ...input, marginTop: 4 }} placeholder="Nota per il cliente (facoltativa)" value={o.note} onChange={e => set(o.id, { note: e.target.value })} />
              </div>
            )
          })}
          {list.length < MAX_OPTIONS && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" data-testid="altpasto-aggiungi" onClick={() => addOption(false)} style={{ ...mini, color: '#F4894A' }}>+ Pasto alternativo vuoto</button>
              {mealFoods.some(f => f.food_name) && <button type="button" data-testid="altpasto-copia" onClick={() => addOption(true)} style={mini}>Parti dagli alimenti di questo pasto</button>}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#888', marginTop: 6, lineHeight: 1.4 }}>Il cliente vede le opzioni sotto il pasto e può sceglierne una al posto del pasto principale. Non contano nei totali del giorno.</div>
        </div>
      )}
    </div>
  )
}
