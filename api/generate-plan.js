export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, kcalTarget, protTarget, carbsTarget, fatTarget } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt mancante' })

  const context = `Nutrizionista italiano. Piano alimentare 7 giorni.
Indicazioni: ${prompt}
${kcalTarget ? `Target: ${kcalTarget}kcal P${protTarget}g C${carbsTarget}g G${fatTarget}g` : ''}
Rispondi SOLO JSON, niente testo. 4 pasti/giorno (Colazione,Pranzo,Spuntino pomeriggio,Cena). Alimenti italiani realistici con grammature precise.
{"days":{"0":[{"meal_type":"Colazione","foods":[{"name":"Fiocchi avena","qty":60,"kcal100":372,"p100":13,"c100":67,"g100":7}]}],"1":[...],"2":[...],"3":[...],"4":[...],"5":[...],"6":[...]}}`

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
        max_tokens: 2500,
        messages: [{ role: 'user', content: context }],
      }),
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      return res.status(500).json({ error: data.error?.message || 'Errore API' })
    }

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return res.status(200).json({ ok: true, days: parsed.days })
  } catch (e) {
    console.error('[generate-plan]', e)
    return res.status(500).json({ error: e.message })
  }
}
