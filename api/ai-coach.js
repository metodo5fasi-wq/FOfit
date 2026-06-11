export const config = { api: { bodyParser: { sizeLimit: '10mb' } }, maxDuration: 60 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, clientContext } = req.body
  if (!messages) return res.status(400).json({ error: 'Messaggi mancanti' })

  const { clientName, goal, kcalTarget, proteinTarget, carbsTarget, fatTarget, plan, recentProgress } = clientContext || {}

  let planText = 'Nessun piano alimentare attivo.'
  if (plan && plan.giorni && plan.giorni.length > 0) {
    planText = plan.giorni.slice(0, 2).map(g => {
      const pasti = (g.pasti || []).map(p => {
        const alimenti = (p.alimenti || []).map(a => `${a.nome} ${a.quantita_g}g`).join(', ')
        return `  ${p.nome}: ${alimenti}`
      }).join('\n')
      return `${g.giorno}:\n${pasti}`
    }).join('\n\n')
  }

  let progressText = 'Nessun dato disponibile.'
  if (recentProgress && recentProgress.weight_kg) {
    progressText = `Peso: ${recentProgress.weight_kg}kg`
    if (recentProgress.waist_cm) progressText += ` | Vita: ${recentProgress.waist_cm}cm`
  }

  const systemPrompt = `Sei FO Coach, l'assistente nutrizionale di FOfit creato dal coach Federico Obinu.

PROFILO CLIENTE:
- Nome: ${clientName || 'Cliente'}
- Obiettivo: ${goal || 'non specificato'}
- Target: ${kcalTarget || '—'} kcal | P: ${proteinTarget || '—'}g | C: ${carbsTarget || '—'}g | G: ${fatTarget || '—'}g
- Progressi: ${progressText}

PIANO ATTIVO:
${planText}

STILE:
- Professionale ma caldo, come un coach vero
- Risposte pratiche, creative, sostenibili
- Quando proponi sostituzioni: 3-4 opzioni con grammature precise e macro equivalenti
- La sostenibilità è la priorità — piatti che il cliente voglia davvero mangiare

FUNZIONE SPECIALE — RICETTE:
Quando il cliente chiede una ricetta, un piatto specifico, o cosa cucinare, rispondi SEMPRE con questo formato JSON esatto alla fine del messaggio (dopo il testo normale):

RECIPE_JSON:{"titolo":"Nome del piatto","porzioni":1,"pasto":"pranzo","ingredienti":[{"nome":"Petto di pollo","quantita_g":200,"kcal":216,"p":44,"c":0,"g":4},{"nome":"Riso basmati","quantita_g":80,"kcal":283,"p":6,"c":62,"g":1}],"kcal_totali":499,"p_totali":50,"c_totali":62,"g_totali":5}

Tipi pasto validi: colazione, spuntino, pranzo, pre-workout, cena, merenda
Calcola sempre i valori nutrizionali reali degli ingredienti.
Il JSON deve essere su UNA SOLA RIGA dopo "RECIPE_JSON:"

LIMITI:
- Solo nutrizione e piano alimentare
- Niente consigli medici
- Allenamento → rimanda al coach`

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Errore AI' })

    const fullText = data.content?.[0]?.text || ''

    // Estrai ricetta dal JSON se presente
    let recipe = null
    let displayText = fullText

    const recipeMatch = fullText.match(/RECIPE_JSON:(\{.*\})/)
    if (recipeMatch) {
      try {
        recipe = JSON.parse(recipeMatch[1])
        displayText = fullText.replace(/RECIPE_JSON:\{.*\}/, '').trim()
      } catch(e) {
        displayText = fullText.replace(/RECIPE_JSON:.*/, '').trim()
      }
    }

    return res.status(200).json({ reply: displayText, recipe })

  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
