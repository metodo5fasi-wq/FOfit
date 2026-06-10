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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: `Sei un parser di piani alimentari. Il tuo unico compito è leggere qualsiasi testo di piano alimentare — indipendentemente dal formato, dalla lingua, dalla struttura — e restituire un JSON valido. Non scrivere MAI nient'altro che il JSON. Nessuna spiegazione, nessun backtick, nessun markdown. Solo il JSON grezzo.`,
        messages: [{
          role: 'user',
          content: `Converti questo piano alimentare in JSON.

Il piano può avere qualsiasi formato:
- giorni della settimana (lunedì, martedì...)
- tipi di giorno (ON, OFF, allenamento, riposo, lavoro, weekend...)  
- piano unico uguale per tutti i giorni
- solo alcuni giorni specificati
- con o senza calorie
- con o senza macro
- con alternative ai pasti
- qualsiasi struttura testuale

REGOLE:
1. Se il piano distingue "Giorno ON" e "Giorno OFF": crea 7 giorni, ON = lun/mer/ven/sab, OFF = mar/gio/dom
2. Se il piano è uguale ogni giorno: replica per tutti e 7 i giorni
3. Se ci sono alternative (es. "COLAZIONE ALTERNATIVA 1"): includi SOLO il pasto principale
4. Calorie e macro mancanti: stima in modo realistico dagli alimenti
5. giorno_numero: 1=lunedì, 7=domenica

TESTO:
${textContent}

RISPONDI SOLO CON QUESTO JSON (compilato con i dati reali del piano):
{"titolo":"Piano alimentare","kcal_totali":2000,"proteine_g":150,"carboidrati_g":220,"grassi_g":60,"note_generali":"","giorni":[{"giorno":"Lunedì","giorno_numero":1,"nota_giorno":"","kcal_giorno":2000,"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","kcal":450,"alimenti":[{"nome":"nome alimento","marca":"","quantita_g":100,"kcal":200,"proteine_g":10,"carboidrati_g":30,"grassi_g":5}]}]}]}`
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
