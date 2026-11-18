// ─────────────────────────────────────────────────────────────
// Logica del piano alimentare lato coach (Modifica piano): niente schermo qui dentro, così si può provare da sola.
//  • lettura: alimenti nell'ordine scelto dal coach, kcal coerenti con i macro
//  • controlli prima del salvataggio (valori negativi, grammi a zero o esagerati)
//  • piano di salvataggio: cosa inserire, cosa aggiornare, cosa eliminare — l'eliminazione per ULTIMA
//  • copia di un giorno, spostamento dei pasti
//  • bozza sul telefono (modifiche non salvate)
// ─────────────────────────────────────────────────────────────
import { normAlts, sameAlts } from './alternatives'
export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
export const MAX_FOOD_G = 2000            // oltre questa quantità per un singolo alimento si chiede conferma (di solito è un refuso)

export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
export const macroKcal = (p, c, g) => Math.round(num(p) * 4 + num(c) * 4 + num(g) * 9)
// Quantità del piano: al multiplo di 5 g più vicino (17 → 15, 18 → 20, 146 → 145, 148 → 150). Sotto i 10 g si arrotonda al grammo (olio, semi…).
export const roundGrams = q => { const v = num(q); if (v <= 0) return v; return v < 10 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5 }
const same = (a, b) => Math.abs(num(a) - num(b)) < 1e-9

// Gli alimenti di un pasto nell'ordine scelto dal coach (sort_order). Prima il database li restituiva in ordine casuale.
export const sortFoods = foods => (foods || []).map((f, i) => [f, i]).sort((a, b) => ((a[0].sort_order ?? 1e9) - (b[0].sort_order ?? 1e9)) || (a[1] - b[1])).map(x => x[0])

// Un alimento com'è letto dal database, con i valori originali per poter riproporzionare quando si cambia la quantità
export function enrichFood(f) {
  const qty = num(f.quantity_g), prot = num(f.protein_g), carbs = num(f.carbs_g), fat = num(f.fat_g), kcalDb = num(f.kcal)
  const kcal = (prot > 0 || carbs > 0 || fat > 0) ? macroKcal(prot, carbs, fat) : kcalDb      // con i macro presenti le kcal si ricalcolano per coerenza
  return { ...f, quantity_g: qty, kcal, protein_g: prot, carbs_g: carbs, fat_g: fat, _origQty: qty, _origKcal: kcal, _origProt: prot, _origCarbs: carbs, _origFat: fat }
}
export const enrichMeals = rows => (rows || []).map(m => ({ ...m, plan_meal_foods: sortFoods(m.plan_meal_foods).map(enrichFood) }))

// ── controlli ────────────────────────────────────────────────
const FIELD_LABEL = { quantity_g: 'grammi', kcal: 'kcal', protein_g: 'proteine', carbs_g: 'carboidrati', fat_g: 'grassi' }
// Bloccanti: valori negativi (non hanno senso e falsano i totali). Restituisce [{ id, day, fields }]
export function validateMeals(meals) {
  const out = []
  for (const m of meals) for (const f of (m.plan_meal_foods || [])) {
    const fields = Object.keys(FIELD_LABEL).filter(k => num(f[k]) < 0)
    if (!String(f.food_name || '').trim()) fields.push('food_name')
    if (fields.length) out.push({ id: f.id, mealId: m.id, day: m.day_of_week, name: f.food_name, fields })
  }
  return out
}
export function problemsMessage(problems) {
  if (!problems.length) return ''
  const p = problems[0], what = p.fields.map(k => k === 'food_name' ? 'il nome' : FIELD_LABEL[k]).join(', ')
  return problems.length === 1 ? `Controlla "${p.name || 'alimento'}": ${what} non valido (non può essere negativo o vuoto).`
    : `Ci sono ${problems.length} alimenti da controllare (valori negativi o nome vuoto), evidenziati in rosso. Il primo: "${p.name || 'alimento'}".`
}
// Da confermare (non bloccano): grammi a zero o esagerati, ma solo per gli alimenti toccati ora — quelli già così sul server non si segnalano ogni volta
export function suspiciousFoods(meals, serverFoods = new Map()) {
  const out = []
  for (const m of meals) for (const f of (m.plan_meal_foods || [])) {
    const s = serverFoods.get(f.id), touched = !s || !same(s.quantity_g, f.quantity_g)
    if (!touched) continue
    if (num(f.quantity_g) <= 0) out.push({ id: f.id, name: f.food_name, why: '0 g' })
    else if (num(f.quantity_g) > MAX_FOOD_G) out.push({ id: f.id, name: f.food_name, why: `${num(f.quantity_g)} g` })
  }
  return out
}
export function suspiciousMessage(list) {
  const show = list.slice(0, 4).map(x => `${x.name} (${x.why})`).join(', ') + (list.length > 4 ? '…' : '')
  return `${list.length === 1 ? 'Un alimento ha' : `${list.length} alimenti hanno`} una quantità insolita: ${show}.\n\nSalvare comunque?`
}

// ── piano di salvataggio ─────────────────────────────────────
export const foodPayload = (f, index) => ({ food_name: f.food_name, quantity_g: num(f.quantity_g), kcal: Math.round(num(f.kcal)), protein_g: num(f.protein_g), carbs_g: num(f.carbs_g), fat_g: num(f.fat_g), sort_order: index })

// Il pasto "capofila" di ogni giorno porta i totali del giorno (come faceva prima il salvataggio)
function dayTotalsMap(meals) {
  const t = {}
  for (const m of meals) {
    const d = t[m.day_of_week] || (t[m.day_of_week] = { kcal: 0, p: 0, c: 0, g: 0, first: m.id })
    for (const f of (m.plan_meal_foods || [])) { d.kcal += num(f.kcal); d.p += num(f.protein_g); d.c += num(f.carbs_g); d.g += num(f.fat_g) }
  }
  return t
}

// dbMeals / dbFoods: righe lette dal database ORA. meals: lo stato della pagina. Nessuna scrittura qui: restituisce solo cosa fare.
export function planSave({ planId, meals, dbMeals, dbFoods }) {
  const dbMealMap = new Map(dbMeals.map(m => [m.id, m])), dbFoodMap = new Map(dbFoods.map(f => [f.id, f]))
  const keepMeal = new Set(meals.map(m => m.id)), keepFood = new Set(meals.flatMap(m => (m.plan_meal_foods || []).map(f => f.id)))
  const totals = dayTotalsMap(meals), perDay = {}
  const insertMeals = [], updateMeals = [], insertFoods = [], updateFoods = []
  for (const m of meals) {
    const order = perDay[m.day_of_week] = (perDay[m.day_of_week] ?? -1) + 1
    const base = { day_of_week: m.day_of_week, meal_type: m.meal_type, meal_order: order }
    const tot = totals[m.day_of_week]
    const withTotals = tot.first === m.id ? { day_kcal_target: Math.round(tot.kcal), day_protein_target_g: Math.round(tot.p), day_carbs_target_g: Math.round(tot.c), day_fat_target_g: Math.round(tot.g) } : {}
    const db = dbMealMap.get(m.id)
    if (!db) {
      insertMeals.push({ id: m.id, plan_id: planId, ...base, day_label: m.day_label || DAY_NAMES[m.day_of_week - 1] || null, ...(m.meal_name != null ? { meal_name: m.meal_name } : {}), ...(m.coach_note != null ? { coach_note: m.coach_note } : {}), ...withTotals })
    } else {
      const next = { ...base, ...withTotals }
      if (Object.keys(next).some(k => typeof next[k] === 'number' ? !same(db[k], next[k]) : String(db[k] ?? '') !== String(next[k] ?? ''))) updateMeals.push({ id: m.id, ...next })
    }
    ;(m.plan_meal_foods || []).forEach((f, i) => {
      const p = foodPayload(f, i), db = dbFoodMap.get(f.id)
      // alternative scelte: si scrive la colonna solo quando serve (così, finché non si usano, il salvataggio non dipende da essa)
      const alts = normAlts(f.alternatives)
      if (!db) insertFoods.push({ id: f.id, plan_meal_id: m.id, ...p, ...(alts.length ? { alternatives: alts } : {}) })
      else {
        const altChanged = !sameAlts(db.alternatives, alts)
        if (altChanged || db.plan_meal_id !== m.id || db.food_name !== p.food_name || ['quantity_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'sort_order'].some(k => !same(db[k], p[k])))
          updateFoods.push({ id: f.id, plan_meal_id: m.id, ...p, ...(altChanged ? { alternatives: alts.length ? alts : null } : {}) })
      }
    })
  }
  return {
    insertMeals, updateMeals, insertFoods, updateFoods,
    deleteFoodIds: dbFoods.filter(f => !keepFood.has(f.id)).map(f => f.id),
    deleteMealIds: dbMeals.filter(m => !keepMeal.has(m.id)).map(m => m.id),
  }
}
export const hasWork = s => !!(s.insertMeals.length || s.updateMeals.length || s.insertFoods.length || s.updateFoods.length || s.deleteFoodIds.length || s.deleteMealIds.length)

// Target del piano (+ note). Restituisce solo ciò che è cambiato rispetto al server.
export function planPatch(plan, server, notes, serverNotes, normalize = x => x) {
  const out = {}
  for (const k of ['kcal_target', 'protein_target_g', 'carbs_target_g', 'fat_target_g']) {
    const v = Math.max(0, Math.round(num(plan?.[k])))
    if (!same(server?.[k], v)) out[k] = v
  }
  const n = normalize(notes), sn = normalize(serverNotes)
  if (n !== sn) out.notes = n || null
  return out
}

// ── giorni e pasti ───────────────────────────────────────────
// Copia tutti i pasti di un giorno su un altro (il giorno di arrivo viene sostituito). Id nuovi: niente si confonde con l'originale.
export function copyDay(meals, from, to, makeId) {
  const copies = meals.filter(m => m.day_of_week === from).map(m => ({
    ...m, id: makeId(), day_of_week: to, day_label: DAY_NAMES[to - 1],
    plan_meal_foods: (m.plan_meal_foods || []).map(f => ({ ...f, id: makeId(), plan_meal_id: undefined })),
  }))
  copies.forEach(m => m.plan_meal_foods.forEach(f => { f.plan_meal_id = m.id }))
  return [...meals.filter(m => m.day_of_week !== to), ...copies]
}
// Sposta un pasto prima/dopo quello vicino NELLO STESSO GIORNO
export function moveMeal(meals, id, dir) {
  const m = meals.find(x => x.id === id); if (!m) return meals
  const same = meals.map((x, i) => [x, i]).filter(([x]) => x.day_of_week === m.day_of_week)
  const at = same.findIndex(([x]) => x.id === id), to = dir === 'up' ? at - 1 : at + 1
  if (to < 0 || to >= same.length) return meals
  const out = [...meals]; const i = same[at][1], j = same[to][1]; [out[i], out[j]] = [out[j], out[i]]; return out
}
// Sposta un alimento prima/dopo un altro dello stesso pasto (trascinamento)
export function moveFood(foods, fromId, toId) {
  const from = foods.findIndex(f => f.id === fromId), to = foods.findIndex(f => f.id === toId)
  if (from < 0 || to < 0 || from === to) return foods
  const out = [...foods]; const [x] = out.splice(from, 1); out.splice(to, 0, x); return out
}

// ── bozza (modifiche non salvate) ────────────────────────────
export const draftKey = planId => `fofit_draft_meals_${planId}`
export function signature(meals, targets = {}, notes = '') {
  const s = JSON.stringify([
    (meals || []).map(m => [m.id, m.day_of_week, m.meal_type, (m.plan_meal_foods || []).map(f => [f.id, f.food_name, num(f.quantity_g), Math.round(num(f.kcal)), num(f.protein_g), num(f.carbs_g), num(f.fat_g), normAlts(f.alternatives).map(a => a.name + '|' + a.brand)])]),
    ['kcal_target', 'protein_target_g', 'carbs_target_g', 'fat_target_g'].map(k => num(targets[k])), String(notes || '').trim(),
  ])
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return String(h)
}
export function writeDraft(planId, state, base) { try { localStorage.setItem(draftKey(planId), JSON.stringify({ v: 1, planId, savedAt: new Date().toISOString(), baseSig: signature(base.meals, base.targets, base.notes), ...state })) } catch {} }
export function readDraft(planId) { try { const d = JSON.parse(localStorage.getItem(draftKey(planId)) || 'null'); return d && d.v === 1 && Array.isArray(d.meals) ? d : null } catch { return null } }
export function clearDraft(planId) { try { localStorage.removeItem(draftKey(planId)) } catch {} }
// Una bozza serve solo se è DIVERSA da ciò che c'è sul server
export const draftIsUseful = (d, base) => !!d && signature(d.meals, d.targets, d.notes) !== signature(base.meals, base.targets, base.notes)
// Stantia: il piano sul server è cambiato dopo che la bozza è stata scritta
export const draftIsStale = (d, base) => !!d && d.baseSig !== signature(base.meals, base.targets, base.notes)
