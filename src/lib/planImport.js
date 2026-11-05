// ─────────────────────────────────────────────────────────────
// Importa piano — lettura del testo e controllo dei numeri (nessun accesso a rete o database)
//  • taglia il testo in giorni riconoscendo le intestazioni anche senza accenti ("MARTEDI"), con o senza "===", e "Giorno 1…7"
//  • legge i totali scritti all'italiana ("2.700 kcal", "2700,5")
//  • per ogni giorno confronta: somma degli alimenti · totale scritto nel documento · obiettivo, e segnala ciò che non torna
//  • non inventa MAI un valore di riserva (prima, se mancava tutto, compariva 2000)
// ─────────────────────────────────────────────────────────────

const DAYS = [['LUNEDI', 1, 'Lunedì'], ['MARTEDI', 2, 'Martedì'], ['MERCOLEDI', 3, 'Mercoledì'], ['GIOVEDI', 4, 'Giovedì'], ['VENERDI', 5, 'Venerdì'], ['SABATO', 6, 'Sabato'], ['DOMENICA', 7, 'Domenica']]
export const DAY_LABEL = Object.fromEntries(DAYS.map(([, n, l]) => [n, l]))
const ACC = { à: 'a', á: 'a', è: 'e', é: 'e', ì: 'i', í: 'i', ò: 'o', ó: 'o', ù: 'u', ú: 'u', À: 'A', Á: 'A', È: 'E', É: 'E', Ì: 'I', Í: 'I', Ò: 'O', Ó: 'O', Ù: 'U', Ú: 'U' }
// Stessa lunghezza del testo originale (le posizioni restano valide): maiuscolo e senza accenti
const fold = s => s.replace(/[àáèéìíòóùúÀÁÈÉÌÍÒÓÙÚ]/g, c => ACC[c]).toUpperCase().replace(/[’`´]/g, "'")

// "2.700" → 2700 · "2700,5" → 2700.5 · "1.234,5" → 1234.5 · "2198" → 2198
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v ?? '').trim().replace(/\s/g, ''); if (!s) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = parseFloat(s); return Number.isFinite(n) ? n : null
}

// Totale del giorno scritto nel documento: "TOTALE: 2198 kcal | P: 174g | C: 261g | G: 64g" (oppure solo le kcal)
export function extractMacros(text) {
  const full = String(text || '').match(/TOTALE[^\n\d]{0,25}([\d.,]+)\s*kcal[^\n]*?P[:\s]*([\d.,]+)\s*g[^\n]*?C[:\s]*([\d.,]+)\s*g[^\n]*?G[:\s]*([\d.,]+)\s*g/i)
  if (full) return { kcal: Math.round(parseNum(full[1])), proteine_g: Math.round(parseNum(full[2])), carboidrati_g: Math.round(parseNum(full[3])), grassi_g: Math.round(parseNum(full[4])) }
  const only = String(text || '').match(/TOTALE[^\n\d]{0,25}([\d.,]+)\s*kcal/i)
  return only ? { kcal: Math.round(parseNum(only[1])), proteine_g: null, carboidrati_g: null, grassi_g: null } : null
}

// ── divisione in giorni ──────────────────────────────────────
const STOPS = ['RIEPILOGO SETTIMANALE', 'RIEPILOGO', 'FONTI PROTEICHE', 'CONSIGLI PRATICI']
const HEAD = '(^|\\n)[ \\t=#*_\\-–—]*'
export function splitByDay(text) {
  let clean = String(text || '')
  for (const stop of STOPS) { const idx = fold(clean).indexOf(stop); if (idx > 100) { clean = clean.substring(0, idx); break } }
  const F = fold(clean), found = []
  // 1) intestazioni a inizio riga ("=== LUNEDÌ ===", "Martedi", "MERCOLEDÌ - allenamento")
  for (const [name, num] of DAYS) { const re = new RegExp(HEAD + name + '\\b[^\\n]{0,60}(?=\\n|$)', 'g'); let m; while ((m = re.exec(F))) { found.push({ num, index: m.index + m[1].length, len: m[0].length - m[1].length }) } }
  // 2) "Giorno 1 … Giorno 7" se non ci sono nomi di giorni
  if (!found.length) { const re = new RegExp(HEAD + '(?:GIORNO|DAY|DIA)\\s*([1-7])\\b[^\\n]{0,60}(?=\\n|$)', 'g'); let m; while ((m = re.exec(F))) found.push({ num: +m[2], index: m.index + m[1].length, len: m[0].length - m[1].length }) }
  // 3) ultima risorsa: il nome del giorno ovunque (come faceva la versione precedente), ma senza accenti obbligatori
  if (!found.length) for (const [name, num] of DAYS) { const re = new RegExp('(?:={3,}[^\\n]*\\n)?' + name + '(?:\\s*\\n={3,})?', 'g'); let m; while ((m = re.exec(F))) found.push({ num, index: m.index, len: m[0].length }) }
  found.sort((a, b) => a.index - b.index)
  const seen = new Set(), uniq = found.filter(p => seen.has(p.num) ? false : (seen.add(p.num), true))
  const blocks = []
  uniq.forEach((p, i) => {
    const start = p.index + p.len, end = i + 1 < uniq.length ? uniq[i + 1].index : clean.length
    const body = clean.substring(start, end).replace(/={3,}/g, '').trim()
    if (body.length > 30) blocks.push({ dayName: DAY_LABEL[p.num].toUpperCase(), dayNum: p.num, body, macros: extractMacros(body) })
  })
  return blocks
}
export const missingDays = blocks => { const have = new Set(blocks.map(b => b.dayNum)); return have.size ? [1, 2, 3, 4, 5, 6, 7].filter(n => !have.has(n)) : [] }

// ── somme e controlli ────────────────────────────────────────
export function foodsSum(pasti = []) {
  let kcal = 0, p = 0, c = 0, g = 0, foods = 0, missing = 0
  pasti.forEach(m => (m.alimenti || []).forEach(a => {
    foods++; const k = parseNum(a.kcal); if (k === null) missing++; else kcal += k
    p += parseNum(a.proteine_g) || 0; c += parseNum(a.carboidrati_g) || 0; g += parseNum(a.grassi_g) || 0
  }))
  return { kcal: Math.round(kcal), proteine_g: Math.round(p), carboidrati_g: Math.round(c), grassi_g: Math.round(g), foods, missing, meals: pasti.length }
}
// Costruisce il giorno per l'anteprima. kcal = SOMMA DEGLI ALIMENTI (è ciò che vedrà il cliente); il totale scritto nel documento resta accanto, per il confronto.
export function makeVariante(block, res) {
  const pasti = res?.pasti || [], s = foodsSum(pasti), doc = block.macros?.kcal ?? null
  return {
    nome: DAY_LABEL[block.dayNum] || block.dayName, dayNum: block.dayNum, pasti,
    kcal: s.kcal > 0 ? s.kcal : null, kcalDoc: doc, missingKcal: s.missing, foods: s.foods,
    proteine_g: block.macros?.proteine_g ?? (s.proteine_g || null), carboidrati_g: block.macros?.carboidrati_g ?? (s.carboidrati_g || null), grassi_g: block.macros?.grassi_g ?? (s.grassi_g || null),
    truncated: !!res?.truncated, failed: pasti.length === 0, docHasKcal: /kcal/i.test(block.body || ''),
  }
}
const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null
const sgn = n => (n > 0 ? '+' : '') + n

// Per ogni giorno: stato (ok / warn / error) e cosa non torna. target = kcal attese al giorno (può mancare)
export function checkDays(varianti = [], { target = null, tolerance = 5, targetTolerance = 5 } = {}) {
  const counts = varianti.filter(v => !v.failed).map(v => v.pasti.length), freq = {}; counts.forEach(n => { freq[n] = (freq[n] || 0) + 1 })
  const usual = counts.length > 2 ? +Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0] : null
  return varianti.map(v => {
    const flags = [], add = (code, level, text) => flags.push({ code, level, text })
    if (v.failed) add('failed', 'error', 'Giorno non letto: premi "Rileggi"')
    else {
      if (v.truncated) add('truncated', 'warn', 'Letto solo in parte (risposta troncata): probabilmente mancano alimenti')
      if (usual && v.pasti.length < usual) add('fewmeals', 'warn', `Ha ${v.pasti.length} pasti, gli altri giorni ${usual}`)
      if (v.missingKcal > 0) add('missing', 'warn', `${v.missingKcal} ${v.missingKcal === 1 ? 'alimento senza kcal' : 'alimenti senza kcal'}: usa "Ricalcola" dopo il salvataggio`)
      if (!v.docHasKcal) add('nokcal', 'warn', 'Il documento non riporta le kcal: i valori sono stime dell\'AI, da ricontrollare')
      if (v.kcalDoc != null && v.kcal != null) { const d = pct(v.kcal, v.kcalDoc); if (Math.abs(d) > tolerance) add('doc', 'warn', `Somma alimenti ${v.kcal} ≠ totale del documento ${v.kcalDoc} (${sgn(d)}%)`) }
      if (target && v.kcal != null) { const d = pct(v.kcal, target); if (Math.abs(d) > targetTolerance) add('target', 'warn', `${sgn(d)}% rispetto all'obiettivo di ${target} kcal`) }
    }
    return { name: v.nome, dayNum: v.dayNum, meals: v.pasti.length, foods: v.foods, sum: v.kcal, doc: v.kcalDoc, flags, status: v.failed ? 'error' : flags.length ? 'warn' : 'ok' }
  })
}
// Obiettivo giornaliero di partenza: il totale dichiarato dal documento (valore tipico dei giorni), altrimenti la media delle somme.
// Così un giorno letto male non sposta l'obiettivo e viene segnalato rispetto a quello vero.
export function planKcalTarget(varianti = []) {
  const ok = varianti.filter(v => !v.failed)
  const docs = ok.filter(v => v.kcalDoc != null).map(v => v.kcalDoc).sort((a, b) => a - b)
  if (docs.length && docs.length >= ok.length / 2) return Math.round(docs[Math.floor((docs.length - 1) / 2)])
  const ks = ok.filter(v => v.kcal != null).map(v => v.kcal); return ks.length ? Math.round(ks.reduce((a, b) => a + b, 0) / ks.length) : null
}
