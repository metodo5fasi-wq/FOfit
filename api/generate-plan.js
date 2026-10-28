export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, kcalTarget, protTarget, carbsTarget, fatTarget } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt mancante' })

  const target = kcalTarget
    ? `Target giornaliero: ${kcalTarget} kcal, Proteine ${protTarget}g, Carboidrati ${carbsTarget}g, Grassi ${fatTarget}g.`
    : ''

  // Prompt molto diretto per ottenere solo JSON
  const context = `Sei un nutrizionista. Crea un piano alimentare di 7 giorni.
${target}
Indicazioni del coach: ${prompt}

Regole:
- Rispondi ESCLUSIVAMENTE con il JSON, zero parole prima o dopo
- 4 pasti per giorno: Colazione, Pranzo, Spuntino pomeriggio, Cena
- Almeno 3 alimenti per pasto
- Alimenti italiani comuni con valori nutrizionali realistici
- 0=Lunedì, 1=Martedì, 2=Mercoledì, 3=Giovedì, 4=Venerdì, 5=Sabato, 6=Domenica

JSON (inizia subito con la parentesi graffa):
{"days":{"0":[{"meal_type":"Colazione","foods":[{"name":"nome alimento","qty":100,"kcal100":0,"p100":0,"c100":0,"g100":0}]}],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: context }],
      }),
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('[generate-plan] API error:', data.error)
      return res.status(500).json({ error: data.error?.message || 'Errore API Anthropic' })
    }

    const text = data.content?.[0]?.text || ''
    console.log('[generate-plan] Raw response length:', text.length)

    // Estrai JSON robusto — trova la prima { e l'ultima }
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('[generate-plan] No JSON found in:', text.slice(0, 200))
      return res.status(500).json({ error: 'Risposta AI non in formato JSON' })
    }

    const jsonStr = text.slice(jsonStart, jsonEnd + 1)
    const parsed = JSON.parse(jsonStr)

    if (!parsed.days) {
      return res.status(500).json({ error: 'Struttura JSON non valida' })
    }

    return res.status(200).json({ ok: true, days: parsed.days })

  } catch (e) {
    console.error('[generate-plan] Error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
