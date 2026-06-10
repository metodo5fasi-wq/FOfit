export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { textContent } = req.body
  if (!textContent) return res.status(400).json({ error: 'Testo mancante' })

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
        max_tokens: 8000,
        system: `Sei un parser di piani alimentari. Il tuo unico compito è leggere qualsiasi testo di piano alimentare — indipendentemente dal formato, dalla lingua, dalla struttura — e restituire un JSON valido. Non scrivere MAI nient'altro che il JSON. Nessuna spiegazione, nessun backtick, nessun markdown. Solo il JSON grezzo.`,
        messages: [{
          role: 'user',
          content: `Converti questo piano alimentare in JSON. Rispondi SOLO con il JSON, zero testo extra.

REGOLE IMPORTANTI:
- "Giorno ON" = giorni allenamento: lunedì(1), mercoledì(3), venerdì(5), sabato(6)
- "Giorno OFF" = giorni riposo: martedì(2), giovedì(4), domenica(7)
- Prendi SOLO il pasto principale, ignora tutte le ALTERNATIVE
- Stima calorie e macro se non indicati
- Il JSON deve essere completo e valido

TESTO PIANO:
${textContent}

JSON DA RESTITUIRE:
{"titolo":"Piano alimentare","kcal_totali":2000,"proteine_g":150,"carboidrati_g":220,"grassi_g":60,"note_generali":"","giorni":[{"giorno":"Lunedì","giorno_numero":1,"nota_giorno":"Giorno ON - allenamento","kcal_giorno":2000,"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","kcal":400,"alimenti":[{"nome":"nome","marca":"","quantita_g":100,"kcal":200,"proteine_g":10,"carboidrati_g":30,"grassi_g":5}]},{"nome":"Spuntino","tipo":"spuntino","orario":"10:30","kcal":100,"alimenti":[...]},{"nome":"Pranzo","tipo":"pranzo","orario":"13:00","kcal":600,"alimenti":[...]},{"nome":"Merenda","tipo":"merenda","orario":"16:30","kcal":200,"alimenti":[...]},{"nome":"Cena","tipo":"cena","orario":"20:00","kcal":700,"alimenti":[...]}]}]}`
        }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: `Errore AI: ${data.error?.message || 'Riprova'}` })
    }

    const rawText = data.content?.[0]?.text || ''
    if (!rawText) return res.status(500).json({ error: 'Risposta vuota' })

    // Estrai JSON in modo robusto
    let plan
    const clean = rawText.replace(/```json|```/g, '').trim()
    
    // Prova 1: parse diretto
    try { plan = JSON.parse(clean); return res.status(200).json({ plan }) } catch(e) {}
    
    // Prova 2: estrai tra prima { e ultima }
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try { plan = JSON.parse(clean.substring(start, end + 1)); return res.status(200).json({ plan }) } catch(e) {}
    }

    // Prova 3: cerca array giorni e ricostruisce
    try {
      const giorni_match = clean.match(/"giorni"\s*:\s*\[[\s\S]*?\]\s*}/)
      if (giorni_match) {
        plan = JSON.parse('{' + giorni_match[0])
        return res.status(200).json({ plan })
      }
    } catch(e) {}

    return res.status(500).json({ 
      error: 'Non riesco a leggere il formato di questo piano. Prova a incollare solo la parte dei pasti senza intestazioni e note extra.',
      debug: clean.substring(0, 300)
    })

  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
