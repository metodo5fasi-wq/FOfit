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

  // Costruisci il piano come testo leggibile
  let planText = 'Nessun piano alimentare attivo.'
  if (plan && plan.giorni && plan.giorni.length > 0) {
    planText = plan.giorni.slice(0, 2).map(g => {
      const pasti = (g.pasti || []).map(p => {
        const alimenti = (p.alimenti || []).map(a => `${a.nome} ${a.quantita_g}g`).join(', ')
        return `  ${p.nome}: ${alimenti}`
      }).join('\n')
      return `${g.giorno}:\n${pasti}`
    }).join('\n\n')
    if (plan.giorni.length > 2) planText += `\n\n...e altri ${plan.giorni.length - 2} giorni`
  }

  // Progressi recenti
  let progressText = 'Nessun dato di progresso disponibile.'
  if (recentProgress && recentProgress.weight_kg) {
    progressText = `Peso attuale: ${recentProgress.weight_kg}kg`
    if (recentProgress.waist_cm) progressText += ` | Vita: ${recentProgress.waist_cm}cm`
  }

  const systemPrompt = `Sei FO Coach, l'assistente nutrizionale personale di FOfit, creato dal coach Federico Obinu.

PROFILO CLIENTE:
- Nome: ${clientName || 'Cliente'}
- Obiettivo: ${goal || 'non specificato'}
- Target giornaliero: ${kcalTarget || '—'} kcal | Proteine: ${proteinTarget || '—'}g | Carboidrati: ${carbsTarget || '—'}g | Grassi: ${fatTarget || '—'}g
- Progressi recenti: ${progressText}

PIANO ALIMENTARE ATTIVO:
${planText}

IL TUO STILE:
- Sei professionale ma caldo, come un coach che conosce davvero il suo cliente
- Parli in italiano, in modo chiaro e diretto
- Non dai mai risposte generiche da manuale — sei specifico e pratico
- Quando proponi sostituzioni, dai sempre 3-4 opzioni CONCRETE con:
  * Nome del piatto (creativo e sfizioso, non solo "ingrediente X")
  * Grammature precise per mantenere le stesse calorie e macro
  * Contesto pratico (veloce, meal prep, gustoso, saziente, ecc.)
  * Perché funziona per l'obiettivo del cliente
- La SOSTENIBILITÀ è la tua priorità: il piano deve essere piacevole da seguire a lungo termine
- Suggerisci sempre piatti veri che il cliente vuole mangiare, non solo alimenti "corretti"
- Se non hai il piano completo, chiedi al cliente cosa sta cercando di sostituire e ti adatti

LIMITI:
- Parla solo di nutrizione e piano alimentare
- Non dare consigli medici
- Se chiedono di allenamento, digli di contattare il coach direttamente
- Risposte concise ma complete — mai troppo lunghe`

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Errore AI' })

    const reply = data.content?.[0]?.text || ''
    return res.status(200).json({ reply })

  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
