export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, kcalTarget, protTarget, carbsTarget, fatTarget } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt mancante' })

  const target = kcalTarget
    ? `Target: ${kcalTarget} kcal/giorno, Proteine ${protTarget}g, Carboidrati ${carbsTarget}g, Grassi ${fatTarget}g.`
    : ''

  const context = `Sei un nutrizionista italiano. Devi creare un piano alimentare per 7 giorni.
${target}
Indicazioni: ${prompt}

IMPORTANTE: rispondi SOLO con JSON valido e completo. Niente testo prima o dopo.
Ogni giorno deve avere 4 pasti reali con alimenti italiani e valori nutrizionali corretti per 100g.
Non usare [...] come placeholder - scrivi i dati reali per tutti e 7 i giorni.

Struttura richiesta:
{
  "days": {
    "0": [
      {
        "meal_type": "Colazione",
        "foods": [
          {"name": "Fiocchi d'avena", "qty": 60, "kcal100": 372, "p100": 13, "c100": 67, "g100": 7},
          {"name": "Latte parzialmente scremato", "qty": 200, "kcal100": 46, "p100": 3.4, "c100": 4.8, "g100": 1.6}
        ]
      },
      {
        "meal_type": "Pranzo",
        "foods": [
          {"name": "Petto di pollo", "qty": 150, "kcal100": 110, "p100": 23, "c100": 0, "g100": 1.5},
          {"name": "Riso basmati", "qty": 80, "kcal100": 352, "p100": 7, "c100": 78, "g100": 0.5}
        ]
      },
      {
        "meal_type": "Spuntino pomeriggio",
        "foods": [
          {"name": "Yogurt greco 0%", "qty": 150, "kcal100": 57, "p100": 10, "c100": 3.6, "g100": 0.2}
        ]
      },
      {
        "meal_type": "Cena",
        "foods": [
          {"name": "Salmone", "qty": 150, "kcal100": 208, "p100": 20, "c100": 0, "g100": 13},
          {"name": "Verdure miste", "qty": 200, "kcal100": 25, "p100": 2, "c100": 4, "g100": 0.3}
        ]
      }
    ],
    "1": [ ... dati reali per Martedì ... ],
    "2": [ ... dati reali per Mercoledì ... ],
    "3": [ ... dati reali per Giovedì ... ],
    "4": [ ... dati reali per Venerdì ... ],
    "5": [ ... dati reali per Sabato ... ],
    "6": [ ... dati reali per Domenica ... ]
  }
}

Scrivi i dati reali per TUTTI i giorni, varia gli alimenti ogni giorno.`

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
        messages: [{ role: 'user', content: context }],
      }),
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      return res.status(500).json({ error: data.error?.message || 'Errore API' })
    }

    const text = data.content?.[0]?.text || ''
    console.log('[generate-plan] Response length:', text.length)

    // Estrai JSON robusto
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(500).json({ error: 'Nessun JSON nella risposta' })
    }

    const jsonStr = text.slice(jsonStart, jsonEnd + 1)

    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch(parseErr) {
      console.error('[generate-plan] JSON parse error:', parseErr.message)
      console.error('[generate-plan] Raw text:', text.slice(0, 500))
      return res.status(500).json({ error: 'JSON malformato: ' + parseErr.message })
    }

    if (!parsed.days) {
      return res.status(500).json({ error: 'Struttura days mancante' })
    }

    return res.status(200).json({ ok: true, days: parsed.days })

  } catch (e) {
    console.error('[generate-plan]', e)
    return res.status(500).json({ error: e.message })
  }
}
