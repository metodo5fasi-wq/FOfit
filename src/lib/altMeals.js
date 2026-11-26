// ─────────────────────────────────────────────────────────────
// Pasti ALTERNATIVI (Opzione B, C…): il coach affianca a un pasto del piano uno o più pasti completi tra cui il cliente può scegliere.
// Si salvano DENTRO il pasto (colonna plan_meals.alt_meals), non come pasti a parte: così non entrano mai nei totali del giorno,
// nella lista della spesa, nel diario o nei calcoli dell'assistente. Funzioni pure: nessuno schermo, nessun database.
// ─────────────────────────────────────────────────────────────
export const MAX_OPTIONS = 4, MAX_FOODS = 20
const n = v => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }
const r1 = x => Math.round(x * 10) / 10
const LETTERS = ['B', 'C', 'D', 'E', 'F']
export const macroKcal = (p, c, g) => Math.round(n(p) * 4 + n(c) * 4 + n(g) * 9)
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'o' + Math.random().toString(36).slice(2, 10))

// dal database (jsonb, a volte testo, a volte null) → lista pulita
export function normAltMeals(v) {
  let a = v
  if (typeof a === 'string') { try { a = JSON.parse(a) } catch { a = [] } }
  if (!Array.isArray(a)) return []
  const out = []
  for (const o of a) {
    if (!o || typeof o !== 'object') continue
    const foods = (Array.isArray(o.foods) ? o.foods : []).filter(f => f && String(f.food_name || '').trim() && n(f.quantity_g) > 0).slice(0, MAX_FOODS).map(f => {
      const per = f.per100 && typeof f.per100 === 'object' ? { kcal: r1(n(f.per100.kcal)), p: r1(n(f.per100.p)), c: r1(n(f.per100.c)), g: r1(n(f.per100.g)) } : null
      return { food_name: String(f.food_name).trim().slice(0, 80), quantity_g: r1(n(f.quantity_g)), kcal: Math.round(n(f.kcal)), protein_g: r1(n(f.protein_g)), carbs_g: r1(n(f.carbs_g)), fat_g: r1(n(f.fat_g)), ...(per ? { per100: per } : {}) }
    })
    out.push({ id: String(o.id || newId()), name: String(o.name || '').trim().slice(0, 40) || `Opzione ${LETTERS[out.length] || out.length + 2}`, note: String(o.note || '').trim().slice(0, 300), foods })
    if (out.length >= MAX_OPTIONS) break
  }
  return out
}
// versione da salvare: le opzioni senza alimenti non si salvano
export const altMealsToSave = v => normAltMeals(v).filter(o => o.foods.length)
export const sameAltMeals = (a, b) => JSON.stringify(altMealsToSave(a)) === JSON.stringify(altMealsToSave(b))

export const optionTotals = o => (o?.foods || []).reduce((t, f) => ({ kcal: t.kcal + n(f.kcal), p: t.p + n(f.protein_g), c: t.c + n(f.carbs_g), g: t.g + n(f.fat_g) }), { kcal: 0, p: 0, c: 0, g: 0 })

export function newOption(list) {
  const used = new Set(normAltMeals(list).map(o => o.name))
  const letter = LETTERS.find(l => !used.has(`Opzione ${l}`)) || String((list || []).length + 2)
  return { id: newId(), name: `Opzione ${letter}`, note: '', foods: [] }
}

// Alimento del database (cat,name,brand,kcal100,p,c,g per 100 g) → riga del pasto alla quantità data. Le kcal si calcolano dai macro (come nei piani).
export function itemFromFood(f, grams) {
  const q = Math.max(0, n(grams)), per = { kcal: n(f.kcal100), p: n(f.p), c: n(f.c), g: n(f.g) }
  return scaleItem({ food_name: f.name, per100: per }, q)
}
const scaleItem = (item, q) => {
  const per = item.per100 || { kcal: 0, p: 0, c: 0, g: 0 }
  const mk = macroKcal(per.p, per.c, per.g) || n(per.kcal)
  return { ...item, quantity_g: q, kcal: Math.round(mk * q / 100), protein_g: r1(per.p * q / 100), carbs_g: r1(per.c * q / 100), fat_g: r1(per.g * q / 100) }
}
// Cambia i grammi di una riga: i valori si ricalcolano (da per100; se mancano, in proporzione)
export function setItemGrams(item, grams) {
  const q = Math.max(0, n(grams))
  if (item.per100) return scaleItem(item, q)
  const old = n(item.quantity_g), k = old > 0 ? q / old : 0
  return { ...item, quantity_g: q, kcal: Math.round(n(item.kcal) * k), protein_g: r1(n(item.protein_g) * k), carbs_g: r1(n(item.carbs_g) * k), fat_g: r1(n(item.fat_g) * k) }
}
// Parte dagli alimenti del pasto come base da modificare (riga del piano → riga dell'opzione)
export const itemFromPlanFood = f => ({ food_name: String(f.food_name), quantity_g: r1(n(f.quantity_g)), kcal: Math.round(n(f.kcal)), protein_g: r1(n(f.protein_g)), carbs_g: r1(n(f.carbs_g)), fat_g: r1(n(f.fat_g)),
  ...(n(f.quantity_g) > 0 ? { per100: { kcal: r1(n(f.kcal) / n(f.quantity_g) * 100), p: r1(n(f.protein_g) / n(f.quantity_g) * 100), c: r1(n(f.carbs_g) / n(f.quantity_g) * 100), g: r1(n(f.fat_g) / n(f.quantity_g) * 100) } } : {}) })

// Per il cliente (e per l'assistente): ogni opzione con i suoi totali e lo scarto rispetto al pasto del piano
export function describeOptions(list, mealKcal) {
  return altMealsToSave(list).map(o => { const t = optionTotals(o); return { ...o, totals: { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) }, dKcal: mealKcal > 0 ? Math.round(t.kcal) - Math.round(mealKcal) : null } })
}
