// ─────────────────────────────────────────────────────────────
// Alimenti equivalenti ("vedi alternative"): dato un alimento del piano, propone alimenti che hanno SENSO in quel pasto
// e che portano la STESSA QUANTITÀ DI CALORIE (i macro cambiano, è normale).
//   • 90 g di riso = 320 kcal → 90 g di pasta, 110 g di pane, 120 g di patate… = 320 kcal
//   • quantità sempre tonde (5 g, oltre i 250 g di 10 in 10): niente 156 g o 148 g
// Cosa rende le alternative sensate:
//   • stessa FAMIGLIA (cereali con cereali/legumi/patate, carne e pesce con proteine, latticini con latticini, frutta con frutta…)
//   • adatte al PASTO: a colazione e negli spuntini niente riso, pasta, legumi, patate, carne o pesce; a pranzo e cena niente cereali da colazione né yogurt
//   • stesso tipo di alimento per gli oli (l'olio si cambia con un altro olio)
//   • un solo prodotto per nome, al massimo 2 per categoria, 8 in tutto, i più simili come composizione
//   • se con l'arrotondamento le calorie si scostano troppo (oltre l'8%, minimo 12 kcal), quell'alternativa non si propone
// Funzione pura: il database alimenti si passa da fuori (si carica solo quando serve).
// ─────────────────────────────────────────────────────────────
export const EQ = { minKcal: 40, minRatio: 0.35, maxRatio: 3, maxG: 600, perCategory: 2, total: 8, candShare: 0.55, mainPer100: 5, tolPct: 0.08, tolKcal: 12, lightKcal: 60, minCerealDensity: 120, dominantShare: 0.5 }

const FAM_MAIN = { cereali: 'c', frutta: 'c', proteine: 'p', latticini: 'p', grassi: 'g' }
const norm = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
const n = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }
const TUBER = /^(patat|mais\b|topinambur|manioca|yucca|igname|taro)/i
// Dolci, farine, prodotti arricchiti: non sono alternative sensate a riso, pane o pasta
const NOT_STAPLE = /panettone|pandoro|colomba|croissant|cornetto|brioche|biscotti|biscottini|merend|torta|plumcake|wafer|dolce|cioccolat|choco|frosted|nutella|barretta|\bbar\b|protein|overnight|granola|cookie|donut|krapfen|muffin|pancake|waffle|snack|gelato|crema|farina|amido|fecola|lievito|muesli|marmellata|miele|zucchero|sciroppo|gommos|caramell|nesquik|quaglia|wurstel|würstel|hamburger|salsicc|mortadella|salame|nuggets|cotoletta|polpett|cinghiale|agnello|brasato/i

function mainOf(p, c, g) {
  const k = { p: n(p) * 4, c: n(c) * 4, g: n(g) * 9 }, tot = k.p + k.c + k.g || 1
  const [main, val] = Object.entries(k).sort((a, b) => b[1] - a[1])[0]
  return { main, share: val / tot }
}
const profile = (p, c, g) => { const a = [n(p) * 4, n(c) * 4, n(g) * 9], t = a.reduce((x, y) => x + y, 0) || 1; return a.map(x => x / t) }
const kcalOf = f => n(f.p) * 4 + n(f.c) * 4 + n(f.g) * 9 || n(f.kcal100)      // kcal dai macro, come in Modifica piano

// Famiglia di un alimento del database (le categorie "Bevande", "Integratori", "Surgelati"… non sono famiglie: non vengono mai proposte)
export function familyOf(f) {
  const role = mainOf(f.p, f.c, f.g).main
  switch (f.cat) {
    case 'Pasta': case 'Riso': case 'Pane e forno': case 'Cereali colazione': return 'cereali'
    case 'Legumi': return role === 'p' ? 'proteine' : (f.c >= 15 ? 'cereali' : null)      // lenticchie, ceci, fagioli; non i piselli freschi
    case 'Verdure': return TUBER.test(f.name) ? 'cereali' : (f.c >= 12 ? null : 'verdura')     // patate e mais fanno da carboidrato; aglio, zenzero, pomodori secchi no
    case 'Frutta': return 'frutta'
    case 'Carne': case 'Pollo e tacchino': case 'Manzo e vitello': case 'Maiale e salumi': case 'Pesce': case 'Uova': case 'Vegan': return 'proteine'
    case 'Latticini': return 'latticini'
    case 'Condimenti': case 'Frutta secca': return 'grassi'
    case 'Snack e dolci': return 'snack'
    default: return null
  }
}

// ── il pasto ────────────────────────────────────────────────
export const mealGroup = type => ({ colazione: 'breakfast', spuntino: 'snack', merenda: 'snack', 'pre-workout': 'pre', pranzo: 'main', cena: 'main' })[String(type || '').toLowerCase()] || null
const MORNING_CARB = /\bpane\b|fett[ae] biscottat|gallett|cracker|bagel|wasa|toast|grissin|avena|porridge|soffiat|crema di riso|fiocchi|segale|pancarr/i
const SALUMI_MAGRI = /bresaola|prosciutto cotto|fesa|tacchino a fette|speck|affumicat/i
const YOGURTISH = /yogurt|skyr|kefir|budino|dessert|gelato|\blatte (intero|parz|scremato|fresco|uht|di )|bevanda|drink/i
const LIGHT_DAIRY = /yogurt|skyr|kefir|ricotta|quark|fiocchi di latte|formaggio light|\blatte\b/i
// Ha senso mangiarlo in quel pasto? (grp null = pasto sconosciuto: nessun filtro)
export function suitableForMeal(f, fam, grp) {
  if (!grp) return true
  const name = String(f.name || '')
  switch (fam) {
    case 'cereali':
      if (grp === 'main') return f.cat !== 'Cereali colazione'
      if (grp === 'pre') return f.cat !== 'Legumi'
      return f.cat === 'Cereali colazione' || MORNING_CARB.test(name)           // colazione e spuntini: pane, fette biscottate, gallette, fiocchi d'avena… non riso, pasta, legumi, patate
    case 'proteine':
      if (grp === 'main') return true
      if (grp === 'breakfast') return f.cat === 'Uova' || SALUMI_MAGRI.test(name)
      if (grp === 'snack') return SALUMI_MAGRI.test(name)
      return false
    case 'latticini': return grp === 'main' ? !YOGURTISH.test(name) : LIGHT_DAIRY.test(name)
    case 'verdura': return grp === 'main'
    case 'grassi': return grp === 'main' ? true : (f.cat === 'Frutta secca' || /burro di|crema di/i.test(name))
    default: return true
  }
}

// Quantità tonde: oltre 250 g di 10 in 10, da 10 g di 5 in 5, sotto i 10 g al grammo
export const niceGrams = g => (g >= 250 ? Math.round(g / 10) * 10 : g >= 10 ? Math.round(g / 5) * 5 : Math.round(g))

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

// row: riga del piano {food_name, brand, quantity_g, kcal, protein_g, carbs_g, fat_g} · db: FOOD_DB · mealType: 'colazione' | 'pranzo' | …
// → { ok, reason?, kcal, items:[{name, brand, cat, grams, kcal, dKcal, p, c, g}], equalGrams? }
export function equivalents(row, db, { mealType } = {}) {
  const grams = n(row.quantity_g), macroKcal = n(row.protein_g) * 4 + n(row.carbs_g) * 4 + n(row.fat_g) * 9
  const kcal0 = macroKcal > 0 ? Math.round(macroKcal) : n(row.kcal)      // come in Modifica piano: con i macro presenti le kcal si ricalcolano
  if (!(grams > 0) || !(kcal0 > 0) || !Array.isArray(db) || !db.length) return { ok: false, reason: 'dati', items: [] }
  const grp = mealGroup(mealType)
  const { main: rowMain, share } = mainOf(row.protein_g, row.carbs_g, row.fat_g)
  let mine = matchFood(row, db)
  if (mine && mainOf(mine.p, mine.c, mine.g).main !== rowMain) mine = null      // il nome somiglia ma i macro dicono un'altra cosa: non ci si fida
  // Senza un abbinamento nel database si deduce dai macro, con prudenza: un alimento "da carboidrati" ma molto leggero (frutta, verdura, cotti) potrebbe non essere un cereale
  const density = kcal0 / grams * 100
  const guessed = share >= EQ.dominantShare && !(rowMain === 'c' && density < EQ.minCerealDensity) ? { p: 'proteine', c: 'cereali', g: 'grassi' }[rowMain] : null
  const fam = (mine && familyOf(mine)) || guessed
  const main = (mine && FAM_MAIN[fam]) || rowMain      // la famiglia decide la "categoria di macro": salmone e uova (grassi per kcal) restano fonti di proteine
  const out = (items, extra = {}) => ({ ok: true, kcal: kcal0, items, ...extra })

  // Verdure e alimenti leggerissimi: si scambiano alla pari (stessi grammi)
  if (fam === 'verdura') {
    if (!suitableForMeal({ cat: 'Verdure', name: '' }, 'verdura', grp)) return { ok: false, reason: 'pasto', items: [] }
    const seen = new Set([norm(row.food_name), 'w:' + norm(row.food_name).split(' ')[0]]), cands = []
    for (const f of db) {
      if (familyOf(f) !== 'verdura') continue
      const first = norm(f.name).split(' ')[0], key = norm(f.name), sig = `${f.cat}|${f.kcal100}|${f.p}|${f.c}|${f.g}`
      if (seen.has(key) || seen.has(sig) || seen.has('w:' + first)) continue
      seen.add(key); seen.add(sig); seen.add('w:' + first)
      cands.push({ f, d: Math.abs(Math.log((f.kcal100 + 5) / ((mine?.kcal100 ?? density) + 5))) })
    }
    cands.sort((a, b) => a.d - b.d)
    const ref = mine ? Math.round(kcalOf(mine) * grams / 100) : kcal0      // scambio alla pari: il confronto è con le kcal reali di quella verdura
    return out(cands.slice(0, EQ.total).map(({ f }) => item(f, grams, ref)), { equalGrams: true })
  }
  if (!fam) return { ok: false, reason: 'misto', items: [] }
  if (kcal0 < EQ.minKcal) return { ok: false, reason: 'piccolo', items: [] }

  const isOil = /\bolio\b/i.test(row.food_name)
  const origSalumi = mine?.cat === 'Maiale e salumi' || /prosciutto|bresaola|speck|salame|mortadella|wurstel|würstel/i.test(row.food_name)
  const base = profile(row.protein_g, row.carbs_g, row.fat_g)
  const seen = new Set([norm(row.food_name)]), cands = []
  for (const f of db) {
    if (familyOf(f) !== fam) continue
    if (n(f[main]) < EQ.mainPer100) continue
    if (fam === 'proteine' || fam === 'latticini') { if (main === 'p' && n(f.p) < 10) continue }      // fonti di proteine: contano le proteine, anche se per kcal prevalgono i grassi
    else { const r = mainOf(f.p, f.c, f.g); if (r.main !== main || r.share < EQ.candShare) continue }
    if (!suitableForMeal(f, fam, grp)) continue                                   // ha senso in questo pasto?
    if (f.cat === 'Maiale e salumi' && !origSalumi && !SALUMI_MAGRI.test(f.name)) continue      // i salumi grassi non sostituiscono carne o pesce
    if (isOil && !/^olio|ghee|burro chiarificato/i.test(f.name)) continue          // l'olio si cambia con un altro olio
    const key = norm(f.name); if (seen.has(key) || NOT_STAPLE.test(f.name)) continue
    const sig = `${f.cat}|${f.kcal100}|${f.p}|${f.c}|${f.g}`; if (seen.has(sig)) continue      // stessi valori nella stessa categoria (formati di pasta, marche): ne basta uno
    const per100 = kcalOf(f), raw = kcal0 / per100 * 100          // grammi che portano le STESSE calorie
    if (raw < grams * EQ.minRatio || raw > grams * EQ.maxRatio || raw > EQ.maxG) continue
    const g = niceGrams(raw); if (g < 5) continue
    if (Math.abs(per100 * g / 100 - kcal0) > Math.max(EQ.tolPct * kcal0, EQ.tolKcal)) continue      // arrotondando le calorie si scostano troppo: non si propone
    seen.add(key); seen.add(sig)
    const pf = profile(f.p, f.c, f.g)
    cands.push({ f, g, d: pf.reduce((s, x, i) => s + Math.abs(x - base[i]), 0) })      // più simile come composizione = più in alto
  }
  cands.sort((a, b) => a.d - b.d)
  const perCat = {}, items = [], limit = ['frutta', 'latticini', 'snack'].includes(fam) ? EQ.total : EQ.perCategory      // famiglia di una sola categoria: il limite per categoria non ha senso
  for (const c of cands) {
    if ((perCat[c.f.cat] = (perCat[c.f.cat] || 0) + 1) > limit) continue
    items.push(item(c.f, c.g, kcal0))
    if (items.length >= EQ.total) break
  }
  return out(items)
}

function item(f, grams, kcal0) {
  const k = kcalOf(f) * grams / 100
  return { name: f.name, brand: f.brand && f.brand !== '—' && !norm(f.name).includes(norm(f.brand)) ? f.brand : '', cat: f.cat, grams, kcal: Math.round(k), dKcal: Math.round(k) - kcal0, p: Math.round(f.p * grams / 100), c: Math.round(f.c * grams / 100), g: Math.round(f.g * grams / 100) }
}
