// ─────────────────────────────────────────────────────────────
// Alimenti equivalenti ("vedi alternative"): dato un alimento del piano, propone altri alimenti con lo STESSO macro principale.
//   • 90 g di riso (≈70 g di carboidrati) → quanti grammi di pasta, pane, patate… portano gli stessi 70 g di carboidrati
//   • il pollo si pareggia sulle proteine, l'olio sui grassi
//   • accanto a ogni proposta la differenza di kcal rispetto all'originale
// Regole per avere alternative VERE e non cloni (stesso riso di cinque marche):
//   • solo alimenti della stessa "famiglia" (cereali con cereali/legumi/patate, carni e pesce con proteine, latticini con latticini…)
//   • un solo prodotto per nome (le marche non contano), al massimo 2 per categoria, 8 in tutto
//   • porzioni sensate: né meno del 40% né più di 2,5 volte l'originale
// Funzione pura: il database alimenti si passa da fuori (si carica solo quando serve).
// ─────────────────────────────────────────────────────────────
export const EQ = { minMainG: 6, minRatio: 0.4, maxRatio: 2.5, maxG: 600, perCategory: 2, total: 8, lightKcal: 60, minCerealDensity: 120, dominantShare: 0.5, candShare: 0.55, mainPer100: 5 }

const FAM_MAIN = { cereali: 'c', frutta: 'c', proteine: 'p', latticini: 'p', grassi: 'g' }
const MAIN_LABEL = { p: 'proteine', c: 'carboidrati', g: 'grassi' }
const norm = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
const n = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }

// Famiglia di un alimento del database (le categorie "Bevande", "Integratori", "Surgelati"… non sono famiglie: non vengono mai proposte)
export function familyOf(f) {
  const role = mainOf(f.p, f.c, f.g).main
  switch (f.cat) {
    case 'Pasta': case 'Riso': case 'Pane e forno': case 'Cereali colazione': return 'cereali'
    case 'Legumi': return role === 'p' ? 'proteine' : (f.c >= 15 ? 'cereali' : null)      // lenticchie, ceci, fagioli; non i piselli freschi
    case 'Verdure': return TUBER.test(f.name) ? 'cereali' : (f.c >= 12 ? null : 'verdura')     // patate e mais fanno da carboidrato; aglio, zenzero, pomodori secchi non sono né verdura né cereale
    case 'Frutta': return 'frutta'
    case 'Carne': case 'Pollo e tacchino': case 'Manzo e vitello': case 'Maiale e salumi': case 'Pesce': case 'Uova': case 'Vegan': return 'proteine'
    case 'Latticini': return 'latticini'
    case 'Condimenti': case 'Frutta secca': return 'grassi'
    case 'Snack e dolci': return 'snack'
    default: return null
  }
}
const TUBER = /^(patat|mais\b|topinambur|manioca|yucca|igname|taro)/i
function mainOf(p, c, g) {
  const k = { p: n(p) * 4, c: n(c) * 4, g: n(g) * 9 }, tot = k.p + k.c + k.g || 1
  const [main, val] = Object.entries(k).sort((a, b) => b[1] - a[1])[0]
  return { main, share: val / tot }
}
// Dolci, prodotti arricchiti e "da colazione": non sono alternative sensate a riso, pane o pasta
const NOT_STAPLE = /panettone|pandoro|colomba|croissant|cornetto|brioche|biscott|merend|torta|plumcake|wafer|dolce|cioccolat|nutella|barretta|\bbar\b|protein|overnight|granola|cookie|donut|krapfen|muffin|pancake|waffle|snack|gelato|crema|farina|amido|fecola|lievito|muesli|marmellata|miele|zucchero|sciroppo|gommos|caramell|cracker.*cioccol/i
const roundG = g => (g >= 30 ? Math.round(g / 5) * 5 : Math.round(g))

// L'alimento del piano nel database (stesso nome, a parità preferisce la stessa marca)
export function matchFood(row, db) {
  const nm = norm(row.food_name); if (!nm) return null
  let hits = db.filter(f => norm(f.name) === nm)
  if (!hits.length) {            // "Mela" → "Mela golden", "Spaghetti" → "Spaghetti n.5": nome contenuto all'inizio dell'altro, si sceglie il più simile per densità energetica
    const dens = n(row.quantity_g) > 0 ? n(row.kcal) / n(row.quantity_g) * 100 : 0
    hits = db.filter(f => { const k = norm(f.name); return (k.startsWith(nm + ' ') || nm.startsWith(k + ' ')) && (!dens || Math.abs(f.kcal100 - dens) <= dens * 0.4) })      // densità troppo diversa = è un altro alimento («Lasagne della casa» non sono i fogli di pasta secca)
      .sort((a, b) => Math.abs(a.kcal100 - dens) - Math.abs(b.kcal100 - dens)).slice(0, 1)
  }
  if (!hits.length) return null
  const b = String(row.brand || '').toLowerCase()
  return (b && hits.find(h => String(h.brand || '').toLowerCase() === b)) || hits[0]
}

// row: riga del piano {food_name, brand, quantity_g, kcal, protein_g, carbs_g, fat_g} · db: FOOD_DB
// → { ok, reason?, main, mainLabel, mainG, items:[{name, brand, cat, grams, kcal, dKcal, p, c, g}] }
export function equivalents(row, db) {
  const grams = n(row.quantity_g), macroKcal = n(row.protein_g) * 4 + n(row.carbs_g) * 4 + n(row.fat_g) * 9
  const kcal0 = macroKcal > 0 ? Math.round(macroKcal) : n(row.kcal)      // come in Modifica piano: con i macro presenti le kcal si ricalcolano, così il confronto è coerente
  if (!(grams > 0) || !Array.isArray(db) || !db.length) return { ok: false, reason: 'dati', items: [] }
  const { main: rowMain, share } = mainOf(row.protein_g, row.carbs_g, row.fat_g)
  let main = rowMain
  let mine = matchFood(row, db)
  if (mine && mainOf(mine.p, mine.c, mine.g).main !== rowMain) mine = null      // il nome somiglia ma i macro dicono un'altra cosa: non ci si fida
  const mainG = n(row[{ p: 'protein_g', c: 'carbs_g', g: 'fat_g' }[main]])
  // Senza un abbinamento nel database si deduce dai macro, ma con prudenza: un alimento "da carboidrati" ma molto leggero (frutta, verdura, cotti) potrebbe non essere un cereale
  const density = grams > 0 ? kcal0 / grams * 100 : 0
  const guessed = share >= EQ.dominantShare && !(main === 'c' && density < EQ.minCerealDensity) ? { p: 'proteine', c: 'cereali', g: 'grassi' }[main] : null
  const fam = (mine && familyOf(mine)) || guessed
  if (mine && FAM_MAIN[fam]) main = FAM_MAIN[fam]      // la famiglia decide cosa si pareggia: il salmone o le uova (grassi per kcal) si pareggiano sulle PROTEINE
  const out = (items, extra = {}) => ({ ok: true, main, mainLabel: MAIN_LABEL[main], mainG: Math.round(mainG), items, ...extra })

  // Verdure e alimenti leggerissimi: si scambiano alla pari (stessi grammi)
  if (fam === 'verdura' || (kcal0 < EQ.lightKcal && fam === 'verdura')) {
    const seen = new Set([norm(row.food_name), 'w:' + norm(row.food_name).split(' ')[0]]), cands = []
    for (const f of db) {
      if (familyOf(f) !== 'verdura') continue
      const first = norm(f.name).split(' ')[0]
      const key = norm(f.name), sig = `${f.cat}|${f.kcal100}|${f.p}|${f.c}|${f.g}`; if (seen.has(key) || seen.has(sig) || seen.has('w:' + first)) continue; seen.add(key); seen.add(sig); seen.add('w:' + first)
      cands.push({ f, d: Math.abs(Math.log((f.kcal100 + 5) / ((mine?.kcal100 ?? kcal0 / grams * 100) + 5))) })
    }
    cands.sort((a, b) => a.d - b.d)
    return out(cands.slice(0, EQ.total).map(({ f }) => item(f, grams, kcal0)), { equalGrams: true })
  }
  if (!fam) return { ok: false, reason: 'misto', items: [] }
  if (mainG < EQ.minMainG) return { ok: false, reason: 'piccolo', items: [] }

  const seen = new Set([norm(row.food_name)]), cands = []
  const baseDensity = kcal0 / grams * 100
  for (const f of db) {
    if (familyOf(f) !== fam) continue
    const r = mainOf(f.p, f.c, f.g)
    if (n(f[main]) < EQ.mainPer100) continue
    if (fam === 'proteine' || fam === 'latticini') { if (main === 'p' && n(f.p) < 10) continue }      // fonti di proteine: contano le proteine, anche se per kcal prevalgono i grassi
    else if (r.main !== main || r.share < EQ.candShare) continue
    const key = norm(f.name); if (seen.has(key) || NOT_STAPLE.test(f.name)) continue
    const sig = `${f.cat}|${f.kcal100}|${f.p}|${f.c}|${f.g}`; if (seen.has(sig)) continue      // stessi valori nella stessa categoria (formati di pasta, marche): ne basta uno
    const g = mainG / n(f[main]) * 100
    if (g < grams * EQ.minRatio || g > grams * EQ.maxRatio || g > EQ.maxG || roundG(g) < 5) continue
    seen.add(key); seen.add(sig)
    cands.push({ f, g, d: Math.abs(Math.log((f.kcal100 + 5) / (baseDensity + 5))) })
  }
  cands.sort((a, b) => a.d - b.d)
  const perCat = {}, items = [], limit = ['frutta', 'latticini', 'snack'].includes(fam) ? EQ.total : EQ.perCategory      // famiglia di una sola categoria: il limite per categoria non ha senso
  for (const c of cands) {
    if ((perCat[c.f.cat] = (perCat[c.f.cat] || 0) + 1) > limit) continue
    items.push(item(c.f, roundG(c.g), kcal0))
    if (items.length >= EQ.total) break
  }
  return out(items)
}

function item(f, grams, kcal0) {
  const per100 = n(f.p) * 4 + n(f.c) * 4 + n(f.g) * 9 || n(f.kcal100)      // kcal dai macro, come in Modifica piano: il confronto con l'alimento del piano è alla pari
  const k = per100 * grams / 100
  return { name: f.name, brand: f.brand && f.brand !== '—' && !norm(f.name).includes(norm(f.brand)) ? f.brand : '', cat: f.cat, grams, kcal: Math.round(k), dKcal: Math.round(k - kcal0), p: Math.round(f.p * grams / 100), c: Math.round(f.c * grams / 100), g: Math.round(f.g * grams / 100) }
}
