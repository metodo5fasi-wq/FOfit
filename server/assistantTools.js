// ─────────────────────────────────────────────────────────────
// Strumenti dell'assistente nutrizionale. L'AI sceglie COSA proporre; i NUMERI li calcola l'app dal database alimenti:
//  • crea_ricetta: ingredienti + grammi → kcal e macro veri (grammi a multipli di 5), scarto dalle kcal volute, niente alimenti vietati
//  • trova_alternative: il motore di equivalenze (stesse calorie, quantità tonde, adatte al pasto, mai due volte lo stesso alimento)
// Sta in server/ (fuori da api/, limite funzioni Vercel). Importa solo file con estensione .js esplicita.
// ─────────────────────────────────────────────────────────────
import { FOOD_DB } from '../src/data/foodDatabase.js'
import { BASE_FOODS } from '../src/data/alimentiBase.js'
import { equivalents, kcalOf, norm } from '../src/lib/foodEquivalents.js'
import { blockedBy } from '../src/lib/assistantContext.js'

export const TOOLS = [
  {
    name: 'trova_alternative',
    description: 'Alternative sensate a un alimento del piano, con GRAMMI e KCAL già calcolati (stesse calorie, quantità tonde, adatte al pasto, senza alimenti vietati al cliente). Usalo SEMPRE quando il cliente chiede di sostituire o cambiare un alimento: non inventare tu i grammi.',
    input_schema: { type: 'object', properties: { alimento: { type: 'string', description: 'Nome dell\'alimento da sostituire, come nel piano' }, grammi: { type: 'number', description: 'Quantità nel piano, in grammi' }, pasto: { type: 'string', description: 'colazione, spuntino, pranzo, merenda, cena, pre-workout' }, giorno: { type: 'integer', description: 'Giorno 1-7 (facoltativo): varia le proposte nella settimana' } }, required: ['alimento', 'grammi', 'pasto'] },
  },
  {
    name: 'crea_ricetta',
    description: 'Calcola kcal e macro REALI di una ricetta (dal database alimenti) e la mostra al cliente come scheda con il pulsante «Aggiungi al diario». Usalo per ogni ricetta o piatto proposto. Se le kcal non sono vicine all\'obiettivo (±5%), correggi i grammi e richiamalo.',
    input_schema: {
      type: 'object', required: ['titolo', 'pasto', 'ingredienti'],
      properties: {
        titolo: { type: 'string' }, pasto: { type: 'string', description: 'colazione, spuntino, pranzo, pre-workout, cena, merenda' }, porzioni: { type: 'integer' },
        kcal_obiettivo: { type: 'number', description: 'Kcal che il piatto dovrebbe avere (es. quelle del pasto del piano che sostituisce)' },
        ingredienti: { type: 'array', items: { type: 'object', required: ['nome', 'grammi'], properties: { nome: { type: 'string', description: 'Nome semplice e comune (es. "Petto di pollo", "Riso basmati", "Olio extravergine oliva")' }, grammi: { type: 'number' }, per100: { type: 'object', description: 'SOLO se l\'alimento è davvero fuori dai comuni: valori per 100 g (stima)', properties: { kcal: { type: 'number' }, p: { type: 'number' }, c: { type: 'number' }, g: { type: 'number' } } } } } },
        passaggi: { type: 'array', items: { type: 'string' }, description: 'Procedimento in 2-5 passaggi brevi' },
      },
    },
  },
]

const r5 = g => (g < 10 ? Math.max(1, Math.round(g)) : Math.round(g / 5) * 5)
const r1 = v => Math.round(v * 10) / 10
const STOP = new Set(['di', 'd', 'del', 'della', 'dei', 'al', 'alla', 'con', 'e', 'in', 'a', 'da', 'il', 'la', 'lo', 'le', 'un', 'una', 'fresco', 'fresca'])
const toks = s => norm(String(s || '').replace(/['’]/g, ' ')).replace(/[^a-z0-9à-ù ]/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t))
const BASE_KEYS = new Set(BASE_FOODS.map(f => norm(f.name)))
const POOL = [...BASE_FOODS, ...FOOD_DB.filter(f => !BASE_KEYS.has(norm(f.name)))]

// nome dato dall'AI → alimento del database: prima la lista base del coach, poi nome identico, poi inizio uguale, poi tutte le parole contenute (il nome più corto vince)
export function findFood(name, pool = POOL) {
  const q = norm(String(name || '').replace(/['’]/g, ' ')); if (!q) return null
  const exact = pool.find(f => norm(f.name) === q); if (exact) return exact
  const starts = pool.filter(f => norm(f.name).startsWith(q + ' ')).sort((a, b) => a.name.length - b.name.length); if (starts.length) return starts[0]
  const qt = toks(name); if (!qt.length) return null
  const all = pool.filter(f => { const ft = toks(f.name); return qt.every(t => ft.some(x => x === t || x.startsWith(t) || (t.length > 3 && t.startsWith(x) && x.length > 3))) })
    .sort((a, b) => ((b.brand === '—' ? 1 : 0) - (a.brand === '—' ? 1 : 0)) || (a.name.length - b.name.length))
  return all[0] || null
}

export function runTool(name, input, { keys = [], pool = POOL } = {}) {
  try {
    if (name === 'crea_ricetta') return creaRicetta(input || {}, keys, pool)
    if (name === 'trova_alternative') return trovaAlternative(input || {}, keys, pool)
    return { result: { errore: 'Strumento sconosciuto' } }
  } catch (e) { return { result: { errore: 'Errore di calcolo: ' + e.message } } }
}

function creaRicetta(inp, keys, pool) {
  const ings = Array.isArray(inp.ingredienti) ? inp.ingredienti.slice(0, 25) : []
  if (!ings.length) return { result: { errore: 'Nessun ingrediente' } }
  const rows = [], errori = []
  for (const i of ings) {
    const g0 = Number(i.grammi), g = r5(g0)
    if (!(g0 > 0)) { errori.push(`${i.nome}: grammi mancanti`); continue }
    const f = findFood(i.nome, pool)
    let per, nome, stima = false
    if (f) { per = { kcal: kcalOf(f), p: f.p, c: f.c, g: f.g }; nome = f.name }
    else if (i.per100 && Number(i.per100.kcal) > 0) { per = { kcal: Number(i.per100.kcal), p: Number(i.per100.p) || 0, c: Number(i.per100.c) || 0, g: Number(i.per100.g) || 0 }; nome = String(i.nome); stima = true }
    else { errori.push(`${i.nome}: non c'è nel database. Usa un nome più comune oppure indica per100 (stima)`); continue }
    const why = blockedBy({ name: nome, cat: f?.cat }, keys) || blockedBy({ name: String(i.nome) }, keys)
    if (why) { errori.push(`${i.nome}: NON ammesso (${why}, dichiarato dal cliente). Sostituiscilo con un altro ingrediente`); continue }
    rows.push({ nome, quantita_g: g, kcal: Math.round(per.kcal * g / 100), p: r1(per.p * g / 100), c: r1(per.c * g / 100), g: r1(per.g * g / 100), ...(stima ? { stima: true } : {}) })
  }
  if (errori.length) return { result: { ok: false, errori, nota: 'Correggi gli ingredienti segnalati e richiama lo strumento. Nessuna scheda è stata mostrata.' } }
  const tot = rows.reduce((a, r) => ({ kcal: a.kcal + r.kcal, p: a.p + r.p, c: a.c + r.c, g: a.g + r.g }), { kcal: 0, p: 0, c: 0, g: 0 })
  const target = Number(inp.kcal_obiettivo) || 0
  const delta = target ? tot.kcal - target : null
  const recipe = {
    titolo: String(inp.titolo || 'Ricetta').slice(0, 80), pasto: String(inp.pasto || 'pranzo').toLowerCase(), porzioni: Number(inp.porzioni) || 1,
    ingredienti: rows, kcal_totali: Math.round(tot.kcal), p_totali: Math.round(tot.p), c_totali: Math.round(tot.c), g_totali: Math.round(tot.g),
    passaggi: (Array.isArray(inp.passaggi) ? inp.passaggi : []).map(s => String(s).slice(0, 200)).slice(0, 6),
  }
  const vicino = target ? Math.abs(delta) <= Math.max(target * 0.05, 15) : true
  return {
    recipe,
    result: { ok: true, totali: { kcal: recipe.kcal_totali, p: recipe.p_totali, c: recipe.c_totali, g: recipe.g_totali }, ingredienti: rows.map(r => `${r.nome} ${r.quantita_g}g = ${r.kcal} kcal`), ...(target ? { kcal_obiettivo: target, scarto_kcal: delta, vicino_all_obiettivo: vicino } : {}), nota: vicino ? 'Scheda mostrata al cliente. Commenta il piatto e riporta questi numeri, senza ricalcolarli.' : 'Scheda mostrata, ma lontana dall\'obiettivo: correggi i grammi e richiama lo strumento.' },
  }
}

function trovaAlternative(inp, keys, pool) {
  const f = findFood(inp.alimento, pool), grams = Number(inp.grammi)
  if (!(grams > 0)) return { result: { errore: 'Grammi mancanti' } }
  if (!f) return { result: { ok: false, motivo: `"${inp.alimento}" non è nel database: chiedi al cliente di precisare, oppure proponi tu solo alimenti semplici e calcolali con crea_ricetta.` } }
  const row = { food_name: f.name, brand: f.brand, quantity_g: grams, kcal: Math.round(kcalOf(f) * grams / 100), protein_g: f.p * grams / 100, carbs_g: f.c * grams / 100, fat_g: f.g * grams / 100 }
  const r = equivalents(row, pool, { mealType: String(inp.pasto || '').toLowerCase(), day: Number(inp.giorno) || undefined, exclude: x => !!blockedBy(x, keys) })
  if (!r.ok) return { result: { ok: false, motivo: { misto: 'piatto o mix: il motore non lo copre', piccolo: 'quantità piccola: non serve un cambio preciso', pasto: 'per questo pasto non ci sono equivalenze automatiche', dati: 'dati mancanti' }[r.reason] || 'nessuna alternativa trovata', nota: 'Proponi tu solo alimenti semplici e comuni e calcola i numeri con crea_ricetta.' } }
  const blocked = blockedBy(f, keys)
  return {
    result: {
      ok: true, alimento: `${f.name} ${grams} g`, kcal: r.kcal,
      alternative: (r.pool || r.items).slice(0, 16).map(i => ({ alimento: i.name, grammi: i.grams, kcal: i.kcal, p: i.p, c: i.c, g: i.g })),
      nota: 'Grammi e kcal sono già calcolati: riportali così, senza modificarli. Proponine 5-6 diverse tra loro (cereali, legumi, patate… non tutte dello stesso tipo) e aggiungi tu il tocco sfizioso (come cucinarle, abbinamenti). Se il cliente ne vuole altre, usa le restanti dell\'elenco.' + (blocked ? ` Attenzione: l'alimento del piano contiene ${blocked}.` : ''),
    },
  }
}
