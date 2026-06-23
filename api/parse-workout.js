function extractJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  try { return JSON.parse(clean) } catch(e) {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(clean.substring(start, end + 1)) } catch(e) {}
  }
  return null
}

async function callAI(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Errore AI')
  return data.content?.[0]?.text || ''
}

const SYSTEM = 'Sei un parser di schede di allenamento. Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo, zero backtick, zero spiegazioni. Solo il JSON grezzo.'

const SCHEMA = `{"days":[{"day_label":"Giorno A - Petto e Tricipiti","exercises":[{"exercise_name":"Panca piana","muscle_group":"Petto","video_url":"https://youtube.com/...","description":"Scendi controllato, spingi senza bloccare i gomiti","sets":4,"reps":"8-10","rest_seconds":90}]}]}`

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { text } = req.body
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Testo della scheda mancante o troppo corto' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    const userPrompt = `Analizza questa scheda di allenamento e trasformala in JSON secondo questo schema esatto:

${SCHEMA}

REGOLE:
- Raggruppa gli esercizi per giorno/scheda (es. "Giorno A", "Giorno B", "Lunedì - Petto", ecc.) — usa l'etichetta del giorno come scritta nel testo originale.
- "sets" è un numero intero (es. 4). Se scritto come "4x8-10" allora sets=4 e reps="8-10".
- "reps" è una stringa, può essere un range "8-10" o un numero singolo "12" o testo come "AMRAP", "fino a cedimento".
- "rest_seconds" è il recupero in secondi tra le serie. Se scritto "90 sec" o "1:30" => 90. Se non specificato, usa 60 come default.
- "tut" è il Time Under Tension nel formato X-X-X-X (eccentrica-pausa-concentrica-pausa). Es: "3-1-2-0", "4-0-1-0". Se non specificato lascia stringa vuota "".
- "muscle_group" è il gruppo muscolare (es. "Petto", "Schiena", "Gambe", "Spalle", "Bicipiti", "Tricipiti", "Addominali", "Cardio"). Deducilo dal nome esercizio se non specificato.
- "video_url" è il link YouTube se presente nel testo, altrimenti stringa vuota "".
- "description" è la descrizione/istruzioni di esecuzione fornite, altrimenti stringa vuota "".
- Mantieni l'ordine degli esercizi come nel testo originale.

TESTO DELLA SCHEDA:
${text}

Rispondi SOLO con il JSON, nessun altro testo.`

    const aiResponse = await callAI(apiKey, SYSTEM, userPrompt)
    const parsed = extractJSON(aiResponse)

    if (!parsed || !parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      return res.status(500).json({ error: 'Non riesco a interpretare la scheda. Controlla il formato del testo.' })
    }

    return res.status(200).json({ workout: parsed })

  } catch(e) {
    return res.status(500).json({ error: 'Errore: ' + e.message })
  }
}
