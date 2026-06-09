export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { base64, mediaType } = req.body
  if (!base64) return res.status(400).json({ error: 'Missing base64 data' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Ecco il contenuto testuale di un piano alimentare estratto da un file Word:\n\n${req.body.textContent}\n\nAnalizza questo piano alimentare e restituisci SOLO un JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.

Il JSON deve avere questa struttura ESATTA:
{
  "titolo": "string",
  "kcal_totali": number,
  "proteine_g": number,
  "carboidrati_g": number,
  "grassi_g": number,
  "note_generali": "string",
  "giorni": [
    {
      "giorno": "Lunedì",
      "giorno_numero": 1,
      "nota_giorno": "string",
      "kcal_giorno": number,
      "pasti": [
        {
          "nome": "Colazione",
          "tipo": "colazione",
          "orario": "07:30",
          "kcal": number,
          "alimenti": [
            {
              "nome": "string",
              "marca": "string o vuoto",
              "quantita_g": number,
              "kcal": number,
              "proteine_g": number,
              "carboidrati_g": number,
              "grassi_g": number
            }
          ]
        }
      ]
    }
  ]
}

Tipi pasto validi: colazione, spuntino, pranzo, pre-workout, cena, merenda, altro.
Giorni: usa sempre giorno_numero da 1 (lunedì) a 7 (domenica).
Se un valore numerico non è presente, usa 0.
Se il piano è uguale per tutti i giorni, replicalo per tutti e 7.
Rispondi SOLO con il JSON, nient'altro.`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      return res.status(500).json({ error: `Anthropic error: ${data.error?.message || 'Unknown error'}` })
    }
    
    const rawText = data.content?.[0]?.text || ''
    if (!rawText) {
      return res.status(500).json({ error: 'Risposta vuota da Anthropic' })
    }
    
    const clean = rawText.replace(/```json|```/g, '').trim()
    let plan
    try {
      plan = JSON.parse(clean)
    } catch(parseErr) {
      return res.status(500).json({ error: 'Impossibile interpretare il piano. Assicurati che il documento sia un piano alimentare strutturato.' })
    }
    return res.status(200).json({ plan })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
