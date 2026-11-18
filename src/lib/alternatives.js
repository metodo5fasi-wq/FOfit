// ─────────────────────────────────────────────────────────────
// Alternative SCELTE dal coach, salvate su ogni alimento del piano (colonna plan_meal_foods.alternatives).
// Si salva solo CHI è l'alternativa (nome, marca e i valori per 100 g): i grammi non si salvano, si ricalcolano ogni volta
// a pari calorie dall'alimento a cui sono collegate. Così se cambi la quantità del riso, le alternative seguono da sole,
// e riportare le alternative su un altro giorno dà già le grammature giuste per quel giorno.
// Funzioni pure: nessuno schermo, nessun database.
// ─────────────────────────────────────────────────────────────
import { niceGrams, kcalOf, mealGroup, norm, n, baseKey } from './foodEquivalents'

export const MAX_ALTS = 12

// Quello che arriva dal database (jsonb, a volte testo, a volte null) → lista pulita
export function normAlts(v) {
  let a = v
  if (typeof a === 'string') { try { a = JSON.parse(a) } catch { a = [] } }
  if (!Array.isArray(a)) return []
  const out = [], seen = new Set()
  for (const x of a) {
    if (!x || typeof x !== 'object' || !String(x.name || '').trim()) continue
    const c = { name: String(x.name).trim(), brand: String(x.brand || '').trim(), cat: String(x.cat || ''), p: n(x.p), c: n(x.c), g: n(x.g) }
    if (!(kcalOf(c) > 0)) continue
    const k = altKey(c); if (seen.has(k)) continue
    seen.add(k); out.push(c)
    if (out.length >= MAX_ALTS) break
  }
  return out
}
export const altKey = c => `${norm(c.name)}|${norm(c.brand)}`
export const sameAlts = (a, b) => JSON.stringify(normAlts(a)) === JSON.stringify(normAlts(b))

// Un suggerimento di equivalents() → la scelta da salvare
export const choiceFromItem = it => ({ name: it.name, brand: it.brand || '', cat: it.cat || '', p: it.p100, c: it.c100, g: it.g100 })

// Le calorie dell'alimento del piano (come in Modifica piano: se ci sono i macro, le kcal si ricalcolano)
export function foodKcal(food) {
  const m = n(food.protein_g) * 4 + n(food.carbs_g) * 4 + n(food.fat_g) * 9
  return m > 0 ? Math.round(m) : n(food.kcal)
}

// La scelta, alla quantità giusta per avere le STESSE calorie dell'alimento. null se non si può calcolare.
export function scaleChoice(choice, kcal0) {
  const per100 = kcalOf(choice); if (!(per100 > 0) || !(kcal0 > 0)) return null
  const grams = niceGrams(kcal0 / per100 * 100); if (grams < 1) return null
  const k = per100 * grams / 100
  return { ...choice, grams, kcal: Math.round(k), dKcal: Math.round(k) - kcal0, pG: Math.round(choice.p * grams / 100), cG: Math.round(choice.c * grams / 100), gG: Math.round(choice.g * grams / 100) }
}
// Mai lo stesso alimento due volte (es. «Pasta di semola» e «Pasta integrale»): resta il primo scelto
export function scaleChoices(choices, kcal0) {
  const seen = new Set()
  return normAlts(choices).filter(c => { const k = baseKey(c.name); if (seen.has(k)) return false; seen.add(k); return true }).map(c => scaleChoice(c, kcal0)).filter(Boolean)
}

export function toggleChoice(list, choice) {
  const cur = normAlts(list), k = altKey(choice)
  return cur.some(c => altKey(c) === k) ? cur.filter(c => altKey(c) !== k) : normAlts([...cur, choice])
}

// ── riporto su tutti i giorni ────────────────────────────────
// items: [{ key, day, mealType, name, alts }]  (key = come ritrovare l'alimento nella pagina)
// Un alimento con alternative scelte le passa agli alimenti con lo STESSO nome, nello stesso tipo di pasto (pranzo e cena contano
// come lo stesso: sono entrambi pasti principali), negli altri giorni. Le grammature non si copiano: si ricalcolano da ogni alimento.
// overwrite=false: chi ha già le sue scelte non viene toccato. Restituisce { updates: Map(key → alts), count, kept }.
export function planPropagation(items, { fromKey = null, day = null, overwrite = false } = {}) {
  const id = it => norm(it.name), grp = it => mealGroup(it.mealType) || String(it.mealType || '')
  const sources = items.filter(it => normAlts(it.alts).length && (fromKey == null ? (day == null || it.day === day) : it.key === fromKey))
  const updates = new Map(); let kept = 0
  for (const src of sources) {
    for (const t of items) {
      if (t.key === src.key || t.day === src.day || id(t) !== id(src) || grp(t) !== grp(src)) continue
      if (updates.has(t.key)) continue                                    // più fonti per lo stesso alimento: vale la prima
      if (!overwrite && normAlts(t.alts).length) { kept++; continue }
      if (sameAlts(t.alts, src.alts)) continue
      updates.set(t.key, normAlts(src.alts))
    }
  }
  return { updates, count: updates.size, kept }
}
