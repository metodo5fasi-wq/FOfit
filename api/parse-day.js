import { applyCors, guard } from '../server/auth.js'
// Legge UN giorno di piano alimentare e lo trasforma in pasti/alimenti.
// Cambi rispetto alla versione precedente: il testo del giorno non viene più tagliato a 2500 caratteri, la risposta può essere lunga (4096 token invece di 1500),
// l'AI non deve inventare kcal/macro né contare le alternative come alimenti, e se la risposta viene comunque troncata si recuperano i pasti completi e si avvisa (truncated).

const MAX_TEXT = 12000
const MAX_TOKENS = 4096

// Estrae i pasti dalla risposta; se il JSON è incompleto salva i pasti arrivati interi
export function extractMeals(raw) {
  const clean = String(raw || '').replace(/```json|```/g, '').trim()
  try { const p = JSON.parse(clean); if (Array.isArray(p?.pasti)) return { pasti: p.pasti, complete: true } } catch {}
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  if (s !== -1 && e > s) { try { const p = JSON.parse(clean.substring(s, e + 1)); if (Array.isArray(p?.pasti)) return { pasti: p.pasti, complete: true } } catch {} }
  const k = clean.indexOf('"pasti"'), a = k === -1 ? -1 : clean.indexOf('[', k)
  if (a === -1) return { pasti: [], complete: false }
  const out = []; let depth = 0, inStr = false, esc = false, start = -1
  for (let i = a + 1; i < clean.length; i++) {
    const c = clean[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') { inStr = true; continue }
    if (c === '{') { if (depth === 0) start = i; depth++ }
    else if (c === '}') { depth--; if (depth === 0 && start !== -1) { try { out.push(JSON.parse(clean.substring(start, i + 1))) } catch {} start = -1 } }
    else if (c === ']' && depth === 0) break
  }
  return { pasti: out, complete: false }
}

export const buildPrompt = dayText => `Estrai i pasti da questo testo alimentare. Rispondi SOLO con questo JSON:
{"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","alimenti":[{"nome":"Latte","marca":"","quantita_g":300,"kcal":150,"proteine_g":10,"carboidrati_g":14,"grassi_g":6,"opzioni":[]}],"alternative":[]}]}

Tipi validi: colazione, spuntino, pranzo, pre-workout, post-workout, cena, merenda, altro
DOPO PALESTRA = post-workout | DOPO LAVORO = spuntino | PRIMA DI DORMIRE = merenda
REGOLE:
- Includi TUTTI i pasti del giorno e tutti gli alimenti, senza fermarti prima.
- Usa i valori kcal e macro scritti nel testo. NON inventare: se kcal o macro di un alimento non sono nel testo, metti null.
- Le alternative ("oppure", "in alternativa", "ALTERNATIVA") vanno SOLO in "opzioni" dell'alimento o in "alternative" del pasto, MAI come alimenti separati: altrimenti le kcal si contano due volte.
- Ignora note tra parentesi.

TESTO:
${String(dayText).substring(0, MAX_TEXT)}`

export default async function handler(req, res) {
  applyCors(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()
  const auth = await guard(req, res, { roles: ['admin'], limit: 60 }); if (!auth) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key mancante' })

  const { dayText, macros } = req.body || {}
  if (!dayText) return res.status(400).json({ pasti: [] })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        system: 'Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo aggiuntivo.',
        messages: [{ role: 'user', content: buildPrompt(dayText) }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(200).json({ pasti: [], error: data.error?.message })

    const { pasti, complete } = extractMeals(data.content?.[0]?.text || '')
    const truncated = data.stop_reason === 'max_tokens' || (!complete && pasti.length > 0) || String(dayText).length > MAX_TEXT
    return res.status(200).json({ pasti, macros: macros || null, truncated })
  } catch (e) {
    return res.status(200).json({ pasti: [], error: e.message })
  }
}
