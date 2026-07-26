export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key mancante' })

  const { dayText, macros } = req.body
  if (!dayText) return res.status(400).json({ pasti: [] })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: 'Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo aggiuntivo.',
        messages: [{
          role: 'user',
          content: `Estrai i pasti da questo testo alimentare. Rispondi SOLO con questo JSON:
{"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","alimenti":[{"nome":"Latte","marca":"","quantita_g":300,"kcal":150,"proteine_g":10,"carboidrati_g":14,"grassi_g":6,"opzioni":[]}],"alternative":[]}]}

Tipi validi: colazione, spuntino, pranzo, pre-workout, post-workout, cena, merenda, altro
DOPO PALESTRA = post-workout | DOPO LAVORO = spuntino | PRIMA DI DORMIRE = merenda
Usa i valori kcal e macro gia nel testo. Ignora note tra parentesi.

TESTO:
${dayText.substring(0, 2500)}`
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(200).json({ pasti: [], error: data.error?.message })

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    let parsed = null
    try { parsed = JSON.parse(clean) } catch(e) {
      const s = clean.indexOf('{'), e2 = clean.lastIndexOf('}')
      if (s !== -1 && e2 > s) try { parsed = JSON.parse(clean.substring(s, e2+1)) } catch(e3) {}
    }

    return res.status(200).json({ pasti: parsed?.pasti || [], macros: macros || null })
  } catch(e) {
    return res.status(200).json({ pasti: [], error: e.message })
  }
}
