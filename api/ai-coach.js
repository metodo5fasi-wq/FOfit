export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key Anthropic mancante — configurare ANTHROPIC_API_KEY in Vercel' })

  let messages, clientContext
  try {
    messages = req.body?.messages
    clientContext = req.body?.clientContext || {}
  } catch(e) {
    return res.status(400).json({ error: 'Richiesta malformata' })
  }

  if (!messages?.length) return res.status(400).json({ error: 'Messaggi mancanti' })

  // Estrai context con fallback sicuri
  const clientName = clientContext?.clientName || 'Cliente'
  const goal = clientContext?.goal || 'non specificato'
  const kcalTarget = clientContext?.kcalTarget || null
  const proteinTarget = clientContext?.proteinTarget || null
  const carbsTarget = clientContext?.carbsTarget || null
  const fatTarget = clientContext?.fatTarget || null
  const dietType = clientContext?.dietType || 'lineare'

  // Piano alimentare — max 3 giorni per tenere il prompt corto
  let planText = 'Nessun piano alimentare attivo.'
  try {
    const giorni = clientContext?.plan?.giorni
    if (giorni?.length > 0) {
      planText = giorni.slice(0, 3).map(g => {
        const pasti = (g.pasti || []).map(p => {
          const alim = (p.alimenti || []).map(a => `${a.nome} ${a.quantita_g}g`).join(', ')
          return `  ${p.nome}: ${alim}`
        }).join('\n')
        return `${g.giorno}:\n${pasti}`
      }).join('\n\n')
    }
  } catch(e) {}

  // Scheda allenamento
  let workoutText = 'Nessuna scheda attiva.'
  try {
    const giorni = clientContext?.workoutPlan?.giorni
    if (giorni?.length > 0) {
      workoutText = giorni.map(g =>
        `${g.label}: ${(g.esercizi||[]).map(e=>`${e.nome} ${e.serie}x${e.reps}`).join(', ')}`
      ).join('\n')
    }
  } catch(e) {}

  // Progressi
  let progressText = ''
  try {
    const p = clientContext?.recentProgress
    if (p?.weight_kg) progressText = `Peso attuale: ${p.weight_kg}kg`
  } catch(e) {}

  // Preferenze da anamnesi
  let preferenzeText = ''
  try {
    const a = clientContext?.anamnesi
    if (a) {
      const parts = []
      if (a.proteine_gradite?.length) parts.push(`Proteine preferite: ${a.proteine_gradite.join(', ')}`)
      if (a.proteine_non_vuole) parts.push(`Non mangia: ${a.proteine_non_vuole}`)
      if (a.cibi_critici) parts.push(`Cibi critici: ${a.cibi_critici}`)
      if (a.dolori_limitazioni) parts.push(`Limitazioni: ${a.dolori_limitazioni}`)
      if (parts.length) preferenzeText = '\nPreferenze: ' + parts.join(' | ')
    }
  } catch(e) {}

  // Diario oggi
  let diaryText = ''
  try {
    const diary = clientContext?.todayDiary
    if (diary?.length > 0) {
      const totKcal = diary.reduce((s,e)=>s+(e.kcal||0),0)
      diaryText = `\nOggi ha già mangiato: ${Math.round(totKcal)} kcal`
      if (kcalTarget) diaryText += ` (mancano ${kcalTarget - Math.round(totKcal)} kcal)`
    }
  } catch(e) {}

  const systemPrompt = `Sei FO Coach, assistente nutrizionale AI di FOfit, creato dal coach Federico Obinu.

CLIENTE: ${clientName} | Obiettivo: ${goal} | Tipo dieta: ${dietType}
TARGET: ${kcalTarget||'—'} kcal | P${proteinTarget||'—'}g C${carbsTarget||'—'}g G${fatTarget||'—'}g
${progressText}${preferenzeText}${diaryText}

PIANO (primi 3 giorni):
${planText}

SCHEDA ALLENAMENTO:
${workoutText}

ISTRUZIONI:
- Tono caldo e professionale come un coach vero
- Risposte pratiche e concise
- Per sostituzioni: grammature precise con macro equivalenti
- Solo nutrizione e benessere, niente consigli medici

RICETTE — quando il cliente chiede cosa mangiare o una ricetta, aggiungi SEMPRE alla fine:
RECIPE_JSON:{"titolo":"Nome","porzioni":1,"pasto":"pranzo","ingredienti":[{"nome":"Pollo","quantita_g":200,"kcal":216,"p":44,"c":0,"g":4}],"kcal_totali":216,"p_totali":44,"c_totali":0,"g_totali":4}
Pasti validi: colazione, spuntino, pranzo, pre-workout, cena, merenda`

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-10).map(m => ({
          role: m.role,
          content: String(m.content || '')
        }))
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(500).json({ error: `Errore AI: ${data?.error?.message || response.status}` })
    }

    const fullText = data.content?.[0]?.text || ''
    let recipe = null
    let displayText = fullText

    const recipeMatch = fullText.match(/RECIPE_JSON:(\{.*?\})\s*$/)
    if (recipeMatch) {
      try {
        recipe = JSON.parse(recipeMatch[1])
        displayText = fullText.replace(/RECIPE_JSON:\{.*?\}\s*$/, '').trim()
      } catch(e) {
        displayText = fullText.replace(/RECIPE_JSON:.*$/, '').trim()
      }
    }

    return res.status(200).json({ reply: displayText, recipe })

  } catch(e) {
    console.error('Handler error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
