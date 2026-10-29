export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, kcalTarget, protTarget, carbsTarget, fatTarget } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt mancante' })

  const target = kcalTarget
    ? `Target: ${kcalTarget} kcal, P${protTarget}g C${carbsTarget}g G${fatTarget}g.`
    : ''

  const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']

  // Genera UN giorno alla volta — evita che il modello usi placeholder
  const days = {}

  try {
    for (let d = 0; d < 7; d++) {
      const dayName = DAY_NAMES[d]
      const context = `Nutrizionista italiano. Piano alimentare per ${dayName}.
${target}
Indicazioni: ${prompt}

Rispondi SOLO con un array JSON valido dei pasti di ${dayName}. Zero testo, zero commenti.
Pasti da includere (adatta alle indicazioni del coach, di default: Colazione, Pranzo, Spuntino pomeriggio, Cena — aggiungi Spuntino mattina o Spuntino sera se richiesto).
Alimenti italiani reali, varia rispetto agli altri giorni.

Esempio formato (sostituisci con dati reali):
[{"meal_type":"Colazione","foods":[{"name":"Fiocchi avena","qty":60,"kcal100":372,"p100":13,"c100":67,"g100":7},{"name":"Latte scremato","qty":200,"kcal100":36,"p100":3.4,"c100":5,"g100":0.1}]},{"meal_type":"Pranzo","foods":[{"name":"Pasta integrale","qty":80,"kcal100":335,"p100":12,"c100":66,"g100":2},{"name":"Petto di pollo","qty":120,"kcal100":110,"p100":23,"c100":0,"g100":1.5},{"name":"Insalata mista","qty":100,"kcal100":15,"p100":1,"c100":2,"g100":0.2}]},{"meal_type":"Spuntino pomeriggio","foods":[{"name":"Yogurt greco","qty":150,"kcal100":57,"p100":10,"c100":3.6,"g100":0.2}]},{"meal_type":"Cena","foods":[{"name":"Salmone","qty":150,"kcal100":208,"p100":20,"c100":0,"g100":13},{"name":"Patate lesse","qty":200,"kcal100":86,"p100":2,"c100":19,"g100":0.1}]}]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1200,
          messages: [{ role: 'user', content: context }],
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Errore API')

      const text = data.content?.[0]?.text || ''
      // Estrai array JSON — trova [ ... ]
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error(`Giorno ${d}: nessun array JSON`)

      const jsonStr = text.slice(start, end + 1)
      days[String(d)] = JSON.parse(jsonStr)
    }

    return res.status(200).json({ ok: true, days })

  } catch (e) {
    console.error('[generate-plan]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
