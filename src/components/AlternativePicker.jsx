import React from 'react'
import { equivalents } from '../lib/foodEquivalents'
import { normAlts, altKey, choiceFromItem, foodKcal, scaleChoice, toggleChoice } from '../lib/alternatives'

// «Alternative» sotto un alimento del piano (lato coach): l'app propone alimenti sensati per quel pasto, a pari calorie e con quantità tonde;
// il coach spunta quelli che vuole. Si salva solo la scelta: i grammi si ricalcolano dalla quantità dell'alimento.
//   food: l'alimento (food_name, quantity_g, kcal, protein_g, carbs_g, fat_g, alternatives)   mealType: 'colazione' | 'pranzo' | …
//   onChange(nuoveScelte)            onApplyAll(): riporta le scelte sugli stessi alimenti degli altri giorni (se manca il pulsante non compare)
export default function AlternativePicker({ food, mealType, onChange, onApplyAll, compact = false }) {
  const [open, setOpen] = React.useState(false)
  const [db, setDb] = React.useState(null), [failed, setFailed] = React.useState(false)
  const chosen = normAlts(food.alternatives)
  function toggle() {
    const next = !open; setOpen(next)
    if (next && !db && !failed) import('../data/foodDatabase.js').then(m => setDb(m.FOOD_DB || m.default || []), () => setFailed(true))
  }
  const kcal0 = foodKcal(food)
  const sugg = React.useMemo(() => (open && db ? equivalents({ food_name: food.food_name, brand: food.brand, quantity_g: food.quantity_g, kcal: food.kcal, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g }, db, { mealType }) : null),
    [open, db, food.food_name, food.brand, food.quantity_g, food.kcal, food.protein_g, food.carbs_g, food.fat_g, mealType])
  // righe: prima le scelte già fatte, poi i suggerimenti non ancora scelti
  const rows = []
  for (const c of chosen) { const sc = scaleChoice(c, kcal0); if (sc) rows.push({ choice: c, sc, on: true }) }
  for (const it of (sugg?.ok ? sugg.items : [])) { const c = choiceFromItem(it); if (!chosen.some(x => altKey(x) === altKey(c))) { const sc = scaleChoice(c, kcal0); if (sc) rows.push({ choice: c, sc, on: false }) } }
  const MSG = { misto: 'Piatto o mix: non propongo alternative automatiche.', piccolo: 'Quantità piccola: non serve un cambio preciso.', dati: 'Mancano i dati per calcolare le alternative.', pasto: 'Per questo pasto non propongo alternative automatiche.' }
  const btn = { background: 'none', border: 'none', padding: '6px 4px', minHeight: 32, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#F4894A', display: 'inline-flex', alignItems: 'center', gap: 5 }
  return (
    <div style={{ padding: compact ? '0' : '2px 0 0 19px' }}>
      <button type="button" onClick={toggle} aria-expanded={open} data-testid="alt-toggle" style={btn}>
        <i className="ti ti-refresh" style={{ fontSize: 13 }} />Alternative{chosen.length ? <span data-testid="alt-count" style={{ background: 'rgba(212,87,10,0.18)', borderRadius: 9, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>{chosen.length}</span> : null}
      </button>
      {open && (
        <div data-testid="alt-panel" style={{ background: 'rgba(212,87,10,0.06)', border: '0.5px solid rgba(212,87,10,0.25)', borderRadius: 8, padding: '8px 10px', margin: '2px 0 6px' }}>
          {failed && <div style={{ fontSize: 12, color: '#F07070' }}>Non riesco a caricare le alternative. Riprova tra poco.</div>}
          {!failed && !db && <div style={{ fontSize: 12, color: '#AAA' }}>Cerco le alternative…</div>}
          {db && sugg && !sugg.ok && !chosen.length && <div style={{ fontSize: 12, color: '#AAA' }}>{MSG[sugg.reason] || MSG.misto}</div>}
          {db && sugg?.ok && !rows.length && <div style={{ fontSize: 12, color: '#AAA' }}>Nessuna alternativa adatta trovata.</div>}
          {rows.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#CCC', marginBottom: 4 }}>Spunta quelle da proporre · stesse calorie (≈ {kcal0} kcal), i macro cambiano:</div>
              {rows.map(({ choice, sc, on }) => (
                <button type="button" key={altKey(choice)} role="checkbox" aria-checked={on} data-testid="alt-riga" data-on={on ? '1' : '0'}
                  onClick={() => onChange(toggleChoice(chosen, choice))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: '0.5px solid rgba(212,87,10,0.12)', padding: '6px 0', minHeight: 36, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#F0F0F0' }}>
                  <span aria-hidden style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid ' + (on ? '#D4570A' : '#666'), background: on ? '#D4570A' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                  <span style={{ minWidth: 44, fontWeight: 600 }}>{sc.grams} g</span>
                  <span style={{ flex: 1, wordBreak: 'break-word' }}>{choice.name}{choice.brand ? <span style={{ color: '#888' }}> · {choice.brand}</span> : null}</span>
                  <span style={{ color: '#AAA', whiteSpace: 'nowrap' }}>{sc.kcal} kcal <span style={{ color: Math.abs(sc.dKcal) <= 15 ? '#6FCF97' : '#E8C050' }}>({sc.dKcal > 0 ? '+' : sc.dKcal < 0 ? '−' : '±'}{Math.abs(sc.dKcal)})</span></span>
                </button>
              ))}
            </>
          )}
          {(chosen.length > 0 || rows.some(r => !r.on)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {rows.some(r => !r.on) && <button type="button" data-testid="alt-tutte" onClick={() => onChange(normAlts([...chosen, ...rows.filter(r => !r.on).map(r => r.choice)]))} style={miniBtn}>Seleziona tutte</button>}
              {chosen.length > 0 && <button type="button" data-testid="alt-svuota" onClick={() => onChange([])} style={miniBtn}>Svuota</button>}
              {chosen.length > 0 && onApplyAll && <button type="button" data-testid="alt-applica" onClick={onApplyAll} style={{ ...miniBtn, background: 'rgba(212,87,10,0.15)', borderColor: '#D4570A', color: '#F4894A' }}>Applica a tutti i giorni</button>}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#888', marginTop: 6, lineHeight: 1.4 }}>Il cliente vedrà solo le alternative spuntate. Le quantità si adeguano da sole se cambi i grammi dell'alimento.</div>
        </div>
      )}
    </div>
  )
}
const miniBtn = { background: '#161616', color: '#CCC', border: '0.5px solid #333', borderRadius: 7, padding: '5px 10px', minHeight: 32, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
