export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { formData, kcalTarget, protTarget, carbsTarget, fatTarget, dayCalories } = req.body
  if (!formData) return res.status(400).json({ error: 'Dati mancanti' })

  const DAY_NAMES = ['Lunedi','Martedi','Mercoledi','Giovedi','Venerdi','Sabato','Domenica']
  const days = {}

  // Banca alimenti diversi per giorno — forza varietà
  const PROTEIN_ROTATION = [
    'Petto di pollo alla griglia',
    'Salmone al forno',
    'Merluzzo al vapore',
    'Tonno al naturale',
    'Uova strapazzate',
    'Lonza di maiale arrosto',
    'Gamberetti saltati in padella'
  ]

  try {
    const clientCtx = buildClientContext(formData)
    // Accumula i pasti usati per forzare varieta
    const usedProteins = []
    const usedCarbs = []
    const usedVeg = []

    for (let d = 0; d < 7; d++) {
      const kcalDay = dayCalories?.[d] || kcalTarget || 2000
      const proteinSuggest = PROTEIN_ROTATION[d % PROTEIN_ROTATION.length]

      const avoidCtx = d > 0 ? `
OBBLIGATORIO: usa alimenti COMPLETAMENTE DIVERSI rispetto ai giorni precedenti.
Proteine gia usate (NON ripetere): ${usedProteins.join(', ')}
Carboidrati gia usati (NON ripetere): ${usedCarbs.join(', ')}
Verdure gia usate (varia): ${usedVeg.join(', ')}
Proteina suggerita per oggi: ${proteinSuggest}` : `Proteina suggerita per oggi: ${proteinSuggest}`

      const prompt = `Sei un nutrizionista esperto italiano. Crea i pasti di ${DAY_NAMES[d]} per questo cliente.

PROFILO CLIENTE: ${clientCtx}
TARGET: ${kcalDay} kcal totali (±80 kcal), P${protTarget||0}g C${carbsTarget||0}g G${fatTarget||0}g
PASTI DA CREARE: ${formData.pastiSelezionati || 'Colazione, Pranzo, Spuntino pomeriggio, Cena'}
STILE: ${formData.stileCucina || 'italiana'}, ${formData.preferenzePasti || 'gustosa e varia'}
METODI: ${formData.metodiCottura || 'qualsiasi'}, tempo: ${formData.tempoCottura || 'medio'}
${avoidCtx}

ISTRUZIONI CRITICHE:
- RISPOSTA: solo array JSON valido, zero testo fuori
- NON usare apostrofi nei nomi (scrivi "di" non apostrofo): "Fiocchi di avena" non "Fiocchi d'avena"
- Usa SOLO virgolette doppie
- kcal totali devono essere ESATTAMENTE ${kcalDay} (±80 kcal), distribuisci bene tra i pasti
- Pasti gustosi, realistici, non solo pollo e riso
- Campo "note_pasto": scrivi la RICETTA COMPLETA con passaggi numerati dettagliati, es:
  "1. Preriscalda forno a 180 gradi. 2. Condisci il salmone con olio EVO, limone e rosmarino. 3. Avvolgi in carta forno e cuoci 20 minuti. 4. Nel frattempo lessare le patate 15 minuti. 5. Servi con un filo di olio a crudo."
  Per spuntini semplici (frutta, yogurt): breve nota su come abbinarli al meglio.

FORMATO JSON ESATTO (rispetta questa struttura):
[
  {
    "meal_type": "Colazione",
    "note_pasto": "1. Pesa i fiocchi di avena e mettili in una ciotola. 2. Aggiungi il latte freddo e mescola. 3. Lascia riposare 5 minuti per ammorbidire. 4. Aggiungi la frutta fresca tagliata a pezzetti. 5. Puoi aggiungere un cucchiaino di miele se gradito.",
    "foods": [
      {"name": "Fiocchi di avena", "qty": 60, "kcal100": 372, "p100": 13, "c100": 67, "g100": 7, "prep": "a crudo"},
      {"name": "Latte parzialmente scremato", "qty": 200, "kcal100": 46, "p100": 3.4, "c100": 4.8, "g100": 1.6, "prep": "freddo"},
      {"name": "Fragole", "qty": 100, "kcal100": 32, "p100": 0.7, "c100": 7.7, "g100": 0.3, "prep": "fresche"}
    ]
  },
  {
    "meal_type": "Pranzo",
    "note_pasto": "1. Porta a bollore abbondante acqua salata per la pasta. 2. Nel frattempo taglia il petto di pollo a cubetti e marinalo con olio, aglio e rosmarino 10 minuti. 3. Cuoci la pasta al dente (circa 10 minuti). 4. In una padella antiaderente cuoci il pollo a fuoco medio 6-7 minuti per lato. 5. Griglia le zucchine tagliate a rondelle 3 minuti per lato. 6. Impiatta tutto e condisci con olio EVO a crudo.",
    "foods": [
      {"name": "Pasta di grano duro", "qty": 80, "kcal100": 351, "p100": 12, "c100": 70, "g100": 1.5, "prep": "al dente"},
      {"name": "Petto di pollo", "qty": 130, "kcal100": 110, "p100": 23, "c100": 0, "g100": 1.5, "prep": "padella con aglio e rosmarino"},
      {"name": "Zucchine", "qty": 150, "kcal100": 17, "p100": 1.2, "c100": 2.8, "g100": 0.2, "prep": "griglia"},
      {"name": "Olio extravergine di oliva", "qty": 10, "kcal100": 884, "p100": 0, "c100": 0, "g100": 100, "prep": "a crudo"}
    ]
  }
]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Errore API giorno ' + d)

      const text = data.content?.[0]?.text || ''
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error(`Giorno ${d}: nessun array JSON nella risposta`)

      let jsonStr = text.slice(start, end + 1)
      jsonStr = jsonStr
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

      let parsed
      try {
        parsed = JSON.parse(jsonStr)
        if (!Array.isArray(parsed)) throw new Error('Non array')
      } catch(e) {
        console.error(`Day ${d} JSON error:`, e.message, '\n', jsonStr.slice(0, 400))
        throw new Error(`Giorno ${d} JSON non valido: ${e.message}`)
      }

      days[String(d)] = parsed

      // Accumula proteine/carb/verdure usate per forzare varieta
      parsed.forEach(meal => {
        (meal.foods || []).forEach(f => {
          const n = (f.name || '').toLowerCase()
          if (f.p100 > 15) usedProteins.push(f.name)
          if (f.c100 > 30 && f.kcal100 > 200) usedCarbs.push(f.name)
          if (f.kcal100 < 50 && f.c100 < 10) usedVeg.push(f.name)
        })
      })
    }

    const feedback = await generateFeedback(days, kcalTarget, protTarget)
    return res.status(200).json({ ok: true, days, feedback })

  } catch (e) {
    console.error('[generate-plan]', e.message)
    return res.status(500).json({ error: e.message })
  }
}

function buildClientContext(f) {
  const parts = []
  if (f.eta) parts.push(`Eta ${f.eta} anni`)
  if (f.sesso && f.sesso !== '—') parts.push(f.sesso)
  if (f.peso) parts.push(`Peso ${f.peso}kg`)
  if (f.altezza) parts.push(`Altezza ${f.altezza}cm`)
  if (f.lavoro && f.lavoro !== '—') parts.push(`Lavoro: ${f.lavoro}`)
  if (f.attivita && f.attivita !== '—') parts.push(`Attivita: ${f.attivita}`)
  if (f.obiettivo && f.obiettivo !== '—') parts.push(`Obiettivo: ${f.obiettivo}`)
  if (f.variazione && f.variazione !== '—') parts.push(`Variazione calorica: ${f.variazione}`)
  if (f.intolleranze) parts.push(`ALLERGIE/INTOLLERANZE - VIETATI: ${f.intolleranze}`)
  if (f.patologie) parts.push(`Patologie: ${f.patologie}`)
  if (f.farmaci) parts.push(`Farmaci: ${f.farmaci}`)
  if (f.nonMangia) parts.push(`NON MANGIA - VIETATI: ${f.nonMangia}`)
  if (f.amaMangiare) parts.push(`Preferisce: ${f.amaMangiare}`)
  if (f.budget && f.budget !== '—') parts.push(`Budget: ${f.budget}`)
  if (f.mealPrep && f.mealPrep !== '—') parts.push(`Meal prep: ${f.mealPrep}`)
  if (f.noteExtra) parts.push(`NOTE COACH: ${f.noteExtra}`)
  return parts.length ? parts.join('. ') : 'Cliente generico'
}

async function generateFeedback(days, kcalTarget, protTarget) {
  try {
    const summary = Object.entries(days).map(([d, meals]) => {
      const tot = meals.reduce((acc, m) => {
        ;(m.foods || []).forEach(f => {
          acc.k += (f.kcal100||0)*(f.qty||100)/100
          acc.p += (f.p100||0)*(f.qty||100)/100
        })
        return acc
      }, {k:0, p:0})
      return `G${parseInt(d)+1}: ${Math.round(tot.k)}kcal P${Math.round(tot.p)}g`
    }).join(' | ')

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5', max_tokens: 200,
        messages: [{ role: 'user', content: `Nutrizionista. Analizza brevemente (max 100 parole) questo piano settimanale e dai 3 feedback pratici in italiano. Piano: ${summary}. Target: ${kcalTarget}kcal, P${protTarget}g. Scrivi: "Forza: [cosa va bene]. Attenzione: [cosa migliorare]. Suggerimento: [consiglio pratico]."` }]
      }),
    })
    const data = await r.json()
    return data.content?.[0]?.text || ''
  } catch { return '' }
}
