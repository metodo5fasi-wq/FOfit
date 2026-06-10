export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { textContent } = req.body
  if (!textContent) return res.status(400).json({ error: 'Missing textContent' })

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
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Sei un assistente nutrizionale. Analizza il seguente testo di un piano alimentare e restituisci ESCLUSIVAMENTE un oggetto JSON valido. NON aggiungere NULLA prima o dopo il JSON. NON usare backtick. NON scrivere spiegazioni.

TESTO DEL PIANO:
${req.body.textContent}

STRUTTURA JSON RICHIESTA:
{"titolo":"string","kcal_totali":0,"proteine_g":0,"carboidrati_g":0,"grassi_g":0,"note_generali":"string","giorni":[{"giorno":"Lunedì","giorno_numero":1,"nota_giorno":"","kcal_giorno":0,"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","kcal":0,"alimenti":[{"nome":"string","marca":"","quantita_g":100,"kcal":0,"proteine_g":0,"carboidrati_g":0,"grassi_g":0}]}]}]}

Tipi pasto: colazione, spuntino, pranzo, pre-workout, cena, merenda, altro.
giorno_numero: 1=lunedì, 2=martedì, ..., 7=domenica.
Valori numerici mancanti: usa 0.
Se il piano è uguale ogni giorno, replicalo per tutti e 7 i giorni.
RISPONDI SOLO CON IL JSON, NIENT'ALTRO.`
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
    
    // Trova il JSON anche se c'è testo prima o dopo
    let plan
    try {
      // Prova prima il testo pulito
      plan = JSON.parse(clean)
    } catch(e1) {
      // Cerca il primo { e l'ultimo } per estrarre solo il JSON
      const start = clean.indexOf('{')
      const end = clean.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        try {
          plan = JSON.parse(clean.substring(start, end + 1))
        } catch(e2) {
          return res.status(500).json({ error: 'Impossibile interpretare il piano. Assicurati che il documento sia un piano alimentare strutturato.' })
        }
      } else {
        return res.status(500).json({ error: 'Impossibile interpretare il piano. Assicurati che il documento sia un piano alimentare strutturato.' })
      }
    }
    return res.status(200).json({ plan })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
