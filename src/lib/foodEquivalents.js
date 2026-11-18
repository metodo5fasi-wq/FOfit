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
import { BASE_FOODS } from '../data/alimentiBase.js'
const BASE_DB = BASE_FOODS.map(f => ({ ...f, _base: true }))
const BASE_KEYS = new Set(BASE_FOODS.map(f => String(f.name).toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim()))      // la lista del coach: prima scelta nelle alternative

export const EQ = { minKcal: 40, minRatio: 0.35, maxRatio: 3, maxRatioProt: 2, maxRatioDairy: 1.8, maxRatioCarb: 4.5, maxG: 600, perCategory: 2, total: 8, pool: 18, perMeal: 6, poolPerCategory: 7, candShare: 0.55, mainPer100: 5, tolPct: 0.08, tolKcal: 12, lightKcal: 60, minCerealDensity: 120, dominantShare: 0.5 }

const FAM_MAIN = { cereali: 'c', frutta: 'c', zuccheri: 'c', proteine: 'p', latticini: 'p', grassi: 'g' }
export const norm = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
export const n = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }
const TUBER = /^(patat|mais\b|topinambur|manioca|yucca|igname|taro)/i
// Dolci, farine, prodotti arricchiti: non sono alternative sensate a riso, pane o pasta
const NOT_STAPLE = /panettone|pandoro|colomba|croissant|cornetto|brioche|biscotti|biscottini|merend|torta|plumcake|wafer|dolce|cioccolat|choco|frosted|nutella|barretta|\bbar\b|protein|overnight|granola|cookie|donut|krapfen|muffin|pancake|waffle|snack|gelato|crema|farina|amido|fecola|lievito|muesli|marmellata|miele|zucchero|sciroppo|gommos|caramell|nesquik|quaglia|wurstel|würstel|hamburger|salsicc|mortadella|salame|nuggets|cotoletta|polpett|cinghiale|agnello|brasato/i

function mainOf(p, c, g) {
  const k = { p: n(p) * 4, c: n(c) * 4, g: n(g) * 9 }, tot = k.p + k.c + k.g || 1
  const [main, val] = Object.entries(k).sort((a, b) => b[1] - a[1])[0]
  return { main, share: val / tot }
}
const profile = (p, c, g) => { const a = [n(p) * 4, n(c) * 4, n(g) * 9], t = a.reduce((x, y) => x + y, 0) || 1; return a.map(x => x / t) }
export const kcalOf = f => n(f.p) * 4 + n(f.c) * 4 + n(f.g) * 9 || n(f.kcal100)      // kcal dai macro, come in Modifica piano

// Famiglia di un alimento del database (le categorie "Bevande", "Integratori", "Surgelati"… non sono famiglie: non vengono mai proposte)
export function familyOf(f) {
  const role = mainOf(f.p, f.c, f.g).main
  if (/^(miele|marmellata|zucchero|sciroppo d)/i.test(f.name)) return 'zuccheri'      // dolcificanti da colazione: si cambiano tra loro
  if (/^avocado/i.test(f.name)) return 'grassi'                                       // grasso buono, non frutta
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

// ── solo cibi di tutti i giorni ─────────────────────────────
// Il database ha anche azuki, topinambur, daikon, cinghiale… non sono alternative da proporre: si pesca solo da questi alimenti comuni.
// (L'alimento che il cliente ha nel piano può essere qualsiasi cosa; la lista vale per le PROPOSTE.)
export const COMMON = {
  cereali: /^(pasta|spaghetti|penne|fusilli|rigatoni|farfalle|linguine|mezze maniche|orecchiette|bucatini|paccheri|tagliatelle|gnocchi|riso|orzo perlato|farro perlato|cous cous|pane|pan bauletto|pan carr|pan sandwich|piadina|tortilla|wrap|grissini|cracker|fette biscottate|gallette|fiocchi (di )?avena|corn flakes|special k|muesli classico|rice krispies|fitness|lenticchie (secche|in scatola)|ceci (secchi|in scatola)|fagioli (borlotti|cannellini|secchi)|farro|patate|mais dolce)/i,
  proteine: /^(petto di pollo|petto di tacchino|fesa|fettine di vitello|manzo magro|macinato manzo magro|filetto di manzo|bistecca manzo|controfiletto|vitello fesa|vitello magro|lonza|maiale lonza|bresaola|prosciutto (cotto|crudo)|speck|salmone fresco|tonno al naturale|tonno leggero|tonno fresco|merluzzo|nasello|orata|branzino|sogliola|pesce spada|trota|gamberetti|gamberi|calamari|uovo intero|albume|tofu)/i,
  latticini: /^(yogurt greco|yogurt naturale|yogurt bianco|yogurt proteico|skyr|latte (intero|parz|scremato|senza lattosio|di soia|di avena|di mandorla)|ricotta (vaccina|light)|fiocchi di latte|mozzarella|parmigiano|grana padano|scamorza|stracchino|caprino|cottage|quark|philadelphia|sottilette|formaggio light|cagliata)/i,
  frutta: /^(banana$|mela( |$)|pera( |$)|arancia|mandarino|clementine|pompelmo|fragole|mirtilli$|lamponi|kiwi$|uva( bianca| nera)?$|ananas|mango|pesche|nettarine|albicocche$|ciliegie|susine|cocomero|melone|fichi freschi|melograno)/i,
  grassi: /^(olio extravergine|olio di semi di girasole|olio di semi girasole|olio di girasole|olio di arachidi|olio di oliva|margarina|avocado$|burro$|burro (di )?(arachidi|mandorle)|crema di arachidi|mandorle|noci$|nocciole|anacardi|pistacchi|arachidi|mix frutta secca|semi di (chia|lino|girasole|zucca))/i,
  zuccheri: /^(miele|marmellata|zucchero)/i,
  verdura: /^(spinaci|broccoli|zucchine|pomodori (freschi|datterini|ciliegia)|insalata|lattuga|rucola|carote|peperon|melanzan|cavolfiore|cetrioli$|finocchio|funghi champignon|carciofi$|bietole|zucca$|verza|cavolo cappuccio|radicchio|asparagi|sedano$|cicoria|indivia|fagiolini|verdure miste)/i,
}
const RARE = /altamura|senza glutine|azzimo|gluten free|konjac|proteic|rosso|venere|selvatico|thai|jasmine|surgelat|affumicat|sott'olio|in scatola salmone/i      // varianti poco comuni di alimenti comuni
const isCommon = (f, fam) => (!COMMON[fam] || COMMON[fam].test(String(f.name || '').trim())) && !(fam !== 'latticini' && fam !== 'grassi' && RARE.test(f.name))

// ── «lo stesso alimento» ────────────────────────────────────
// Nel database "Petto di pollo fresco", "Petto di pollo bio" e "Petto di pollo" sono righe diverse, ma per chi legge sono lo STESSO alimento:
// nelle alternative non si ripete mai (né tra loro, né rispetto all'alimento del piano). La chiave riconosce l'alimento "di base".
const BASE_SYN = [
  [/^patate dolci|^patata dolce/, 'patate dolci'], [/^patat/, 'patate'],
  [/^riso soffiato|^soffiat/, 'riso soffiato'], [/^riso\b/, 'riso'],
  [/^(spaghetti|penne|fusilli|rigatoni|farfalle|linguine|mezze maniche|trofie|orecchiette|bucatini|paccheri|tagliatelle|ditalini|conchiglie|strozzapreti|vermicelli|trecce|pasta)\b/, 'pasta'],
  [/^(pane|pan bauletto|pan carr|pan sandwich|panino)/, 'pane'], [/^(fiocchi (di )?avena|avena|porridge)/, 'avena'], [/^gallette/, 'gallette'], [/^fette biscottate/, 'fette biscottate'],
  [/^(corn flakes|rice krispies|special k|fitness)/, 'cereali da colazione'],
  [/^(lenticchie|ceci|fagioli)/, ''],            // sotto: prima parola
  [/tacchino/, 'tacchino'], [/pollo/, 'pollo'], [/vitello|vitellone/, 'vitello'], [/manzo|bistecca|controfiletto|macinato|roast beef/, 'manzo'], [/maiale|lonza/, 'maiale'],
  [/^uov|^albume/, 'uovo'], [/^salmone/, 'salmone'], [/^tonno/, 'tonno'], [/^merluzzo/, 'merluzzo'], [/^gamberett|^gamberi|^mazzancolle/, 'gamberi'],
  [/^(yogurt|budino)/, 'yogurt'], [/fiocchi di latte|cottage/, 'fiocchi di latte'], [/^latte (di )?(soia|avena|mandorla)/, 'latte vegetale'], [/^latte/, 'latte'],
  [/^(mozzarella|burrata)/, 'mozzarella'], [/^ricotta/, 'ricotta'], [/^(parmigiano|grana)/, 'grana'], [/^formaggio light|^sottilette|^philadelphia/, 'formaggio light'],
  [/^olio (extravergine|di oliva)/, 'olio di oliva'], [/^olio di semi/, 'olio di semi'], [/^(burro|crema) (di )?arachidi|^arachidi/, 'arachidi'], [/^burro (di )?mandorle|^mandorle/, 'mandorle'],
  [/^prosciutto cotto/, 'prosciutto cotto'], [/^prosciutto crudo/, 'prosciutto crudo'],
]
const STOP = new Set(['di', 'del', 'della', 'al', 'alla', 'in', 'da', 'e', 'con'])
export function baseKey(name) {
  const t = norm(name).replace(/[.,%'’]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, key] of BASE_SYN) if (re.test(t)) return key || t.split(' ').filter(w => !STOP.has(w))[0]
  return t.split(' ').filter(w => !STOP.has(w))[0] || t
}

// ── spuntini dolci e salati ─────────────────────────────────
// Un quadratino di fondente non si cambia con un Kinder Bueno, un Ferrero Rocher, una patatina o un cheesecake: a pari calorie, ma non ha senso.
// Ogni spuntino ha un LIVELLO e un TIPO. Si può solo restare allo stesso livello o salire verso uno più leggero, mai scendere verso un dolce più "goloso":
//   livello 1 = leggeri (cioccolato fondente, frutta secca, datteri, barrette proteiche, gallette/pop corn…)
//   livello 2 = merende semplici (biscotti secchi, cioccolato al latte, cantucci, taralli…)
//   livello 3 = sfizi (Kinder, Ferrero, Snickers, patatine, gelato, torte…): si scambiano solo con sfizi dello STESSO tipo, o con livelli più leggeri
const SN_T1 = /cioccolato fondente|dattero|proteic|energy ball|rice cakes|pop corn|frutta disidratata|barrette cereali/i
const SN_T3 = /kit kat|snickers|\bmars\b|twix|bounty|kinder|ferrero|nutella|gelato|magnum|coppa del|sorbetto|tiramis|cheesecake|torta|budino|panna cotta|patatine|pringles|nachos|plumcake|cornetto|croissant|ciambella|macine|cuori|abbracci|baiocchi|pan di stelle|gocciole|amaretti|mochi|krapfen|donut|wafer/i
const SN_NEVER = /tic tac|caramell|gommos|liquirizia|chewing/i       // caramelle e simili: non sono alternative a niente
export const snackTier = name => SN_T1.test(name) ? 1 : SN_T3.test(name) ? 3 : 2
export const snackKind = name => /gelato|sorbetto|magnum|coppa del|tiramis|cheesecake|torta|budino|panna cotta|ciambella|plumcake/i.test(name) ? 'dessert'
  : /patatine|pringles|nachos|taralli|pop corn/i.test(name) ? 'salato'
  : /cioccolat|kit kat|snickers|\bmars\b|twix|bounty|kinder|ferrero|nutella/i.test(name) ? 'cioccolato' : 'biscotti'
// f può essere proposto al posto di uno spuntino di livello rowTier e tipo rowKind?
export function snackOk(f, rowTier, rowKind) {
  const name = String(f.name || ''); if (SN_NEVER.test(name)) return false
  const t = snackTier(name), k = snackKind(name)
  if ((rowKind === 'salato') !== (k === 'salato')) return false      // il salato si scambia col salato, il dolce col dolce
  if (t === rowTier) return t !== 3 || k === rowKind                 // stesso livello; gli sfizi solo con sfizi dello stesso tipo
  return t < rowTier                                                  // più leggero sì, più goloso mai
}

// ── il pasto ────────────────────────────────────────────────
export const mealGroup = type => ({ colazione: 'breakfast', spuntino: 'snack', merenda: 'snack', 'pre-workout': 'pre', pranzo: 'main', cena: 'main' })[String(type || '').toLowerCase()] || null
const MORNING_CARB = /\bpane\b|fett[ae] biscottat|gallett|cracker|bagel|wasa|toast|grissin|avena|porridge|soffiat|crema di riso|fiocchi|segale|pancarr/i
const COOKED = /\bcott[oae]\b|in scatola|scolat|bollit|alla griglia|arrosto|al forno|al vapore|alla piastra/i
const LIGHT_BREAD = /fette biscottate|gallette|cracker|grissini|wasa|fibra|soffiat/i
const SALTY_BAKERY = /cracker|grissini|taralli|schiacciatina|focaccia|piadina|wrap|tortilla|carasau/i      // a colazione non sono un'alternativa sensata
const SALUMI_MAGRI = /bresaola|prosciutto cotto|fesa (di )?tacchino|fesa tacchino|tacchino a fette|speck/i
const YOGURTISH = /yogurt|skyr|kefir|budino|dessert|gelato|\blatte (intero|parz|scremato|fresco|uht|di )|bevanda|drink/i
const LIGHT_DAIRY = /yogurt|skyr|kefir|ricotta|quark|fiocchi di latte|formaggio light|\blatte\b/i
// Ha senso mangiarlo in quel pasto? (grp null = pasto sconosciuto: nessun filtro)
export function suitableForMeal(f, fam, grp) {
  if (!grp) return true
  const name = String(f.name || '')
  switch (fam) {
    case 'cereali':
      if (grp === 'main') return f.cat !== 'Cereali colazione' && !/soffiat|proteic|fitness|special k|corn flakes|muesli|avena/i.test(name)
      if (grp === 'pre') return f.cat !== 'Legumi'
      return f.cat === 'Cereali colazione' || MORNING_CARB.test(name)           // colazione e spuntini: pane, fette biscottate, gallette, fiocchi d'avena… non riso, pasta, legumi, patate
    case 'proteine':
      if (grp === 'main') return true
      if (grp === 'breakfast') return f.cat === 'Uova' || SALUMI_MAGRI.test(name)
      if (grp === 'snack') return SALUMI_MAGRI.test(name)
      return false
    case 'latticini': return grp === 'main' ? !YOGURTISH.test(name) : LIGHT_DAIRY.test(name)
    case 'verdura': return grp === 'main'
    case 'zuccheri': return grp !== 'main'
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
export function equivalents(row, db, { mealType, day } = {}) {
  const grams = n(row.quantity_g), macroKcal = n(row.protein_g) * 4 + n(row.carbs_g) * 4 + n(row.fat_g) * 9
  const kcal0 = macroKcal > 0 ? Math.round(macroKcal) : n(row.kcal)      // come in Modifica piano: con i macro presenti le kcal si ricalcolano
  if (!(grams > 0) || !(kcal0 > 0) || !Array.isArray(db) || !db.length) return { ok: false, reason: 'dati', items: [] }
  const grp = mealGroup(mealType)
  const all = db.filter(f => !BASE_KEYS.has(norm(f.name))).concat(BASE_DB)      // il database + la lista base del coach (prima scelta: se un alimento è nella lista, vale quella versione)
  const { main: rowMain, share } = mainOf(row.protein_g, row.carbs_g, row.fat_g)
  let mine = matchFood(row, all)
  if (mine && mainOf(mine.p, mine.c, mine.g).main !== rowMain) mine = null      // il nome somiglia ma i macro dicono un'altra cosa: non ci si fida
  // Senza un abbinamento nel database si deduce dai macro, con prudenza: un alimento "da carboidrati" ma molto leggero (frutta, verdura, cotti) potrebbe non essere un cereale
  const density = kcal0 / grams * 100
  const guessed = share >= EQ.dominantShare && !(rowMain === 'c' && density < EQ.minCerealDensity) ? { p: 'proteine', c: 'cereali', g: 'grassi' }[rowMain] : null
  const fam = (mine && familyOf(mine)) || guessed
  const main = (mine && FAM_MAIN[fam]) || rowMain      // la famiglia decide la "categoria di macro": salmone e uova (grassi per kcal) restano fonti di proteine
  // pool = tutte le alternative sensate (per il coach che sceglie); items = quelle di QUEL giorno e pasto (la settimana ruota: non escono tutte nello stesso pasto)
  const out = (pool, extra = {}) => ({ ok: true, kcal: kcal0, pool, items: day ? weekWindow(pool, day, mealType) : pool.slice(0, EQ.total), ...extra })

  // Verdure e alimenti leggerissimi: si scambiano alla pari (stessi grammi)
  if (fam === 'verdura') {
    if (!suitableForMeal({ cat: 'Verdure', name: '' }, 'verdura', grp)) return { ok: false, reason: 'pasto', items: [] }
    const seen = new Set([norm(row.food_name), 'w:' + norm(row.food_name).split(' ')[0], 'b:' + baseKey(row.food_name)]), cands = []
    for (const f of all) {
      if (familyOf(f) !== 'verdura' || !isCommon(f, 'verdura') || /sott|trifolat|surgelat/i.test(f.name)) continue
      const first = norm(f.name).split(' ')[0], key = norm(f.name), sig = `${f.cat}|${f.kcal100}|${f.p}|${f.c}|${f.g}`
      if (seen.has(key) || seen.has(sig) || seen.has('w:' + first) || seen.has('b:' + baseKey(f.name))) continue
      seen.add(key); seen.add(sig); seen.add('w:' + first); seen.add('b:' + baseKey(f.name))
      cands.push({ f, d: Math.abs(Math.log((f.kcal100 + 5) / ((mine?.kcal100 ?? density) + 5))) })
    }
    cands.sort((a, b) => a.d - b.d)
    const ref = mine ? Math.round(kcalOf(mine) * grams / 100) : kcal0      // scambio alla pari: il confronto è con le kcal reali di quella verdura
    return out(cands.slice(0, EQ.pool).map(({ f }) => item(f, grams, ref)), { equalGrams: true })
  }
  if (!fam) return { ok: false, reason: 'misto', items: [] }
  if (kcal0 < EQ.minKcal) return { ok: false, reason: 'piccolo', items: [] }

  const isOil = /\bolio\b/i.test(row.food_name), rowCooked = COOKED.test(row.food_name)
  const origSalumi = mine?.cat === 'Maiale e salumi' || /prosciutto|bresaola|speck|salame|mortadella|wurstel|würstel/i.test(row.food_name)
  const isSnackFam = fam === 'snack', rowName = mine?.name || row.food_name, rowTier = snackTier(rowName), rowKind = snackKind(rowName)
  const AFFETTATI = /bresaola|prosciutto|speck|fesa (di )?tacchino|fesa tacchino|tacchino a fette/i
  const isMilk = /^latte\b/i.test(norm(row.food_name)), isVegan = mine?.cat === 'Vegan' || /^(tofu|seitan|tempeh)/i.test(norm(row.food_name))
  const rowLightBread = LIGHT_BREAD.test(row.food_name), rowSeed = /^semi\b/i.test(norm(row.food_name))
  const base = profile(row.protein_g, row.carbs_g, row.fat_g)
  const seen = new Set([norm(row.food_name)]), cands = [], baseSelf = baseKey(row.food_name)
  for (const f of all) {
    const nutForSnack = isSnackFam && f.cat === 'Frutta secca' && /^(mandorle|noci$|nocciole|anacardi|pistacchi|arachidi|mix frutta secca)/i.test(f.name) && isCommon(f, 'grassi')      // allo spuntino dolce la frutta secca è un'alternativa sensata
    if (!nutForSnack && (familyOf(f) !== fam || !isCommon(f, fam))) continue
    if (origSalumi && fam === 'proteine' && !AFFETTATI.test(f.name)) continue      // un salume si cambia con altri affettati magri, non con bistecca o salmone
    if (isVegan && fam === 'proteine' && !['Vegan', 'Uova'].includes(f.cat)) continue      // tofu e simili: alternative vegetali o uova
    if (isMilk && !/^(latte|yogurt|skyr|kefir)/i.test(f.name)) continue                    // il latte si cambia con yogurt, skyr o latte vegetale
    if (fam === 'cereali' && grp === 'main' && LIGHT_BREAD.test(f.name) && !rowLightBread) continue      // a pranzo e cena fette biscottate, cracker e gallette non sostituiscono un piatto
    if (fam === 'cereali' && grp === 'breakfast' && SALTY_BAKERY.test(f.name) && !SALTY_BAKERY.test(row.food_name)) continue      // a colazione niente grissini, cracker, wrap…
    if (fam === 'grassi' && /^semi\b/i.test(f.name) && !rowSeed) continue                  // i semi si scambiano con i semi, non con noci o creme
    if (isSnackFam && !nutForSnack && !snackOk(f, rowTier, rowKind)) continue
    if (baseKey(f.name) === baseSelf || (mine && baseKey(mine.name) === baseKey(f.name))) continue      // lo stesso alimento (altra marca, bio, integrale…) non è un'alternativa
    if (!isSnackFam && !isMilk && n(f[main]) < EQ.mainPer100) continue
    if (isSnackFam) { /* per gli spuntini conta la sensatezza (livello e tipo) e le calorie, non il macro principale */ }
    else if (fam === 'proteine' || fam === 'latticini') { if (main === 'p' && n(f.p) < (isMilk ? 3 : 10)) continue }      // fonti di proteine: contano le proteine, anche se per kcal prevalgono i grassi
    else { const r = mainOf(f.p, f.c, f.g); if (r.main !== main || r.share < EQ.candShare) continue }
    if (!suitableForMeal(f, fam, grp)) continue                                   // ha senso in questo pasto?
    const per100 = kcalOf(f), raw = kcal0 / per100 * 100          // grammi che portano le STESSE calorie
    if (f.cat === 'Maiale e salumi' && !origSalumi && (grp === 'main' || !SALUMI_MAGRI.test(f.name) || raw > 130)) continue      // i salumi grassi non sostituiscono carne o pesce
    if (fam === 'proteine' && grp && grp !== 'main' && f.cat !== 'Uova' && raw > 130) continue      // a colazione/spuntino un salume o una fesa non si porzionano a 190 g
    if (isOil && !/^olio|ghee|burro chiarificato/i.test(f.name)) continue          // l'olio si cambia con un altro olio
    if (!f._base && COOKED.test(f.name) && !rowCooked) continue      // la lista base è a crudo/secco: i piatti già cotti o in scatola si confondono con i grammi a crudo
    const key = norm(f.name); if (seen.has(key) || (!isSnackFam && fam !== 'zuccheri' && NOT_STAPLE.test(f.name))) continue
    const sig = `${f.cat}|${f.kcal100}|${f.p}|${f.c}|${f.g}`; if (seen.has(sig)) continue      // stessi valori nella stessa categoria (formati di pasta, marche): ne basta uno
    if (raw < grams * EQ.minRatio || raw > grams * (fam === 'proteine' ? EQ.maxRatioProt : fam === 'latticini' ? EQ.maxRatioDairy : fam === 'cereali' ? EQ.maxRatioCarb : EQ.maxRatio) || raw > EQ.maxG) continue
    const tol = Math.max(EQ.tolPct * kcal0, EQ.tolKcal)
    let g = niceGrams(raw)
    if (Math.abs(per100 * g / 100 - kcal0) > tol && raw < 40) g = Math.round(raw)      // porzioni piccole (noci, olio): se i 5 g di arrotondamento sballano le calorie, si va al grammo
    if (g < 1 || Math.abs(per100 * g / 100 - kcal0) > tol) continue      // arrotondando le calorie si scostano troppo: non si propone
    seen.add(key); seen.add(sig)
    const pf = profile(f.p, f.c, f.g)
    cands.push({ f, g, d: pf.reduce((s, x, i) => s + Math.abs(x - base[i]), 0) })      // più simile come composizione = più in alto
  }
  cands.sort((a, b) => ((b.f._base ? 1 : 0) - (a.f._base ? 1 : 0)) || (a.d - b.d))      // prima la lista base del coach, poi i più simili come composizione
  const perCat = {}, items = [], limit = fam === 'snack' ? 4 : ['frutta', 'latticini', 'grassi', 'zuccheri'].includes(fam) ? EQ.pool : EQ.poolPerCategory
  const usedBase = new Set()
  for (const c of cands) {
    const bk = baseKey(c.f.name); if (usedBase.has(bk)) continue      // mai due volte lo stesso alimento
    if ((perCat[c.f.cat] = (perCat[c.f.cat] || 0) + 1) > limit) continue
    usedBase.add(bk); items.push(item(c.f, c.g, kcal0))
    if (items.length >= EQ.pool) break
  }
  return out(interleave(items))
}

// Mescola le categorie (un po' di pasta, un po' di pane, un po' di legumi…) così ogni finestra della settimana è varia
function interleave(items) {
  const groups = new Map(); for (const it of items) { if (!groups.has(it.cat)) groups.set(it.cat, []); groups.get(it.cat).push(it) }
  const lists = [...groups.values()], out = []
  for (let i = 0; out.length < items.length; i++) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}
// Le alternative di UN giorno e UN pasto: la settimana (7 giorni × pranzo/cena) scorre su tutto l'elenco, quindi non escono tutte nello stesso pasto
export function weekWindow(pool, day, mealType, size = EQ.perMeal) {
  const N = pool.length; if (N <= size) return pool
  const d = Math.min(7, Math.max(1, parseInt(day) || 1)), second = /cena|merenda/i.test(String(mealType || '')) ? 1 : 0
  const slot = (d - 1) * 2 + second
  let step = size; const gcd = (a, b) => b ? gcd(b, a % b) : a
  while (gcd(step, N) !== 1) step++                                  // passo coprimo con la lunghezza: le 14 finestre della settimana partono da punti diversi e coprono tutto l'elenco
  const start = (slot * step) % N                                    // lunedì pranzo, lunedì cena, martedì pranzo…: ogni pasto riparte più avanti, nessun pasto ripete quello vicino
  return Array.from({ length: size }, (_, i) => pool[(start + i) % N])
}

function item(f, grams, kcal0) {
  const k = kcalOf(f) * grams / 100
  return { name: f.name, brand: f.brand && f.brand !== '—' && !norm(f.name).includes(norm(f.brand)) ? f.brand : '', cat: f.cat, grams, kcal: Math.round(k), dKcal: Math.round(k) - kcal0, p: Math.round(f.p * grams / 100), c: Math.round(f.c * grams / 100), g: Math.round(f.g * grams / 100), p100: n(f.p), c100: n(f.c), g100: n(f.g) }
}
