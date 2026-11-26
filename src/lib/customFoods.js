// ─────────────────────────────────────────────────────────────
// «I miei alimenti»: alimenti inseriti a mano dal coach (valori per 100 g).
// Funzioni pure: controllo dei valori, conversione da/verso il database, ricerca. Nessuno schermo, nessuna rete.
// Le kcal che usa l'app per i calcoli sono SEMPRE quelle dei macro (4/4/9), come in tutto il resto dei piani:
// per questo, se le kcal scritte non tornano con i macro, il modulo avvisa e propone di correggerle.
// ─────────────────────────────────────────────────────────────
export const CAT_OTHER = 'Altro'
export const MAX_NAME = 80, MAX_BRAND = 40

const val = v => { if (v == null || String(v).trim() === '') return NaN; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : NaN }
const r1 = x => Math.round(x * 10) / 10
export const macroKcal = (p, c, g) => Math.round((Number(p) || 0) * 4 + (Number(c) || 0) * 4 + (Number(g) || 0) * 9)

// Controlla il modulo. Ritorna { ok, food, errors:[], warnings:[], macroKcal }.
//  food = { name, brand, cat, kcal100, p, c, g }  (pronto da salvare). Con le kcal vuote si calcolano dai macro.
export function checkFood(input = {}) {
  const errors = [], warnings = []
  const name = String(input.name || '').replace(/\s+/g, ' ').trim()
  const brand = String(input.brand || '').replace(/\s+/g, ' ').trim()
  const cat = String(input.cat || '').trim() || CAT_OTHER
  if (name.length < 2) errors.push('Scrivi il nome dell\'alimento')
  if (name.length > MAX_NAME) errors.push(`Il nome è troppo lungo (massimo ${MAX_NAME} caratteri)`)
  if (brand.length > MAX_BRAND) errors.push(`La marca è troppo lunga (massimo ${MAX_BRAND} caratteri)`)
  const f = {}
  for (const [k, label] of [['p', 'Proteine'], ['c', 'Carboidrati'], ['g', 'Grassi']]) {
    const raw = input[k], x = val(raw)
    if (raw == null || String(raw).trim() === '') f[k] = 0            // macro vuoto = 0 g
    else if (Number.isNaN(x)) { errors.push(`${label}: scrivi un numero`); f[k] = 0 }
    else if (x < 0) { errors.push(`${label}: non può essere negativo`); f[k] = 0 }
    else if (x > 100) { errors.push(`${label}: in 100 g non possono esserci più di 100 g`); f[k] = 0 }
    else f[k] = r1(x)
  }
  if (f.p + f.c + f.g > 100.5) errors.push(`Proteine + carboidrati + grassi fanno ${r1(f.p + f.c + f.g)} g: in 100 g di alimento non possono superare 100`)
  const mk = macroKcal(f.p, f.c, f.g)
  let kcal100, auto = false
  const rawK = input.kcal100 ?? input.kcal
  if (rawK == null || String(rawK).trim() === '') { kcal100 = mk; auto = true }
  else {
    const k = val(rawK)
    if (Number.isNaN(k)) { errors.push('Kcal: scrivi un numero'); kcal100 = 0 }
    else if (k < 0) { errors.push('Kcal: non possono essere negative'); kcal100 = 0 }
    else if (k > 900) { errors.push('Kcal: più di 900 per 100 g non è possibile (il grasso puro ne ha 900)'); kcal100 = 0 }
    else kcal100 = r1(k)
  }
  if (!errors.length && !(kcal100 > 0) && !(mk > 0)) errors.push('Inserisci almeno le kcal oppure i valori di proteine, carboidrati e grassi')
  if (!errors.length && !auto && mk > 0 && Math.abs(kcal100 - mk) > Math.max(15, mk * 0.1)) {
    warnings.push(`Le kcal che hai scritto (${kcal100}) non tornano con i macro (${mk} kcal: proteine e carboidrati ×4, grassi ×9). L'app nei piani usa il calcolo dai macro.`)
  }
  return { ok: !errors.length, errors, warnings, macroKcal: mk, autoKcal: auto, food: { name, brand, cat, kcal100, p: f.p, c: f.c, g: f.g } }
}

// riga del database → alimento nel formato del database interno (FOOD_DB): brand «—» se manca
export const fromRow = r => ({ id: r.id, cat: r.cat || CAT_OTHER, name: r.name, brand: String(r.brand || '').trim() || '—', kcal100: Number(r.kcal100) || 0, p: Number(r.p) || 0, c: Number(r.c) || 0, g: Number(r.g) || 0, custom: true })
export const toRow = f => ({ name: f.name, brand: !f.brand || f.brand === '—' ? '' : f.brand, cat: f.cat || CAT_OTHER, kcal100: f.kcal100, p: f.p, c: f.c, g: f.g })

const low = s => String(s || '').toLowerCase()
// Ricerca nei propri alimenti (stesso criterio di searchFoods del database interno)
export function searchCustom(list, query) {
  const q = low(query).trim(); if (q.length < 2) return []
  const words = q.split(' ').filter(w => w.length > 1)
  return (list || []).map(f => {
    const n = low(f.name), b = low(f.brand), c = low(f.cat), full = `${n} ${b} ${c}`
    let score = 0
    if (n === q) score += 50; if (n.startsWith(q)) score += 40; if (n.includes(q)) score += 30; if (b.includes(q)) score += 20; if (c.includes(q)) score += 15
    words.forEach(w => { if (full.includes(w)) score += 5 })
    return { f, score }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.f)
}
// I tuoi alimenti per primi, poi quelli del database; mai lo stesso alimento (nome+marca) due volte
export function mergeFoods(mine, base, limit = 30) {
  const seen = new Set(), out = []
  for (const f of [...(mine || []), ...(base || [])]) {
    const k = `${low(f.name)}|${low(f.brand === '—' ? '' : f.brand)}`
    if (seen.has(k)) continue
    seen.add(k); out.push(f)
    if (out.length >= limit) break
  }
  return out
}
