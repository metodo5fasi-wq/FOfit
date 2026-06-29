export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, clientContext } = req.body
  if (!messages) return res.status(400).json({ error: 'Messaggi mancanti' })

  const {
    clientName, goal, kcalTarget, proteinTarget, carbsTarget, fatTarget,
    plan, recentProgress, anamnesi, workoutPlan, todayDiary, weeklyCheckin,
    dietType
  } = clientContext || {}

  // ── CONTESTO PIANO ALIMENTARE COMPLETO ─────────────────
  let planText = 'Nessun piano alimentare attivo.'
  if (plan?.giorni?.length > 0) {
    planText = plan.giorni.map(g => {
      const pasti = (g.pasti || []).map(p => {
        const alimenti = (p.alimenti || [])
          .map(a => `${a.nome} ${a.quantita_g}g (${a.kcal}kcal P${a.proteine_g}g C${a.carboidrati_g}g G${a.grassi_g}g)`)
          .join(', ')
        return `  ${p.nome}: ${alimenti}`
      }).join('\n')
      return `${g.giorno}:\n${pasti}`
    }).join('\n\n')
  }

  // ── CONTESTO SCHEDA ALLENAMENTO ─────────────────────────
  let workoutText = 'Nessuna scheda allenamento attiva.'
  if (workoutPlan?.giorni?.length > 0) {
    workoutText = workoutPlan.giorni.map(g =>
      `${g.label}: ${(g.esercizi||[]).map(e => `${e.nome} ${e.serie}x${e.reps}${e.kg?' @'+e.kg+'kg':''}`).join(', ')}`
    ).join('\n')
  }

  // ── CONTESTO PROGRESSI ──────────────────────────────────
  let progressText = 'Nessun dato disponibile.'
  if (recentProgress) {
    const parts = []
    if (recentProgress.weight_kg) parts.push(`Peso: ${recentProgress.weight_kg}kg`)
    if (recentProgress.waist_cm) parts.push(`Vita: ${recentProgress.waist_cm}cm`)
    if (recentProgress.body_fat_pct) parts.push(`Grasso: ${recentProgress.body_fat_pct}%`)
    progressText = parts.join(' | ') || progressText
  }

  // ── CONTESTO ANAMNESI ───────────────────────────────────
  let anamnesiText = ''
  if (anamnesi) {
    const parts = []
    if (anamnesi.peso_attuale) parts.push(`Peso attuale: ${anamnesi.peso_attuale}kg`)
    if (anamnesi.peso_desiderato) parts.push(`Peso desiderato: ${anamnesi.peso_desiderato}kg`)
    if (anamnesi.altezza) parts.push(`Altezza: ${anamnesi.altezza}cm`)
    if (anamnesi.proteine_gradite?.length) parts.push(`Proteine preferite: ${anamnesi.proteine_gradite.join(', ')}`)
    if (anamnesi.proteine_non_vuole) parts.push(`NON mangia: ${anamnesi.proteine_non_vuole}`)
    if (anamnesi.carboidrati_preferiti?.length) parts.push(`Carbo preferiti: ${anamnesi.carboidrati_preferiti.join(', ')}`)
    if (anamnesi.cibi_critici) parts.push(`Cibi critici: ${anamnesi.cibi_critici}`)
    if (anamnesi.cibi_non_togliere) parts.push(`Non può togliere: ${anamnesi.cibi_non_togliere}`)
    if (anamnesi.dolori_limitazioni) parts.push(`Limitazioni fisiche: ${anamnesi.dolori_limitazioni}`)
    if (anamnesi.intolleranze || anamnesi.condizioni_salute?.length) {
      parts.push(`Condizioni: ${[anamnesi.intolleranze, ...(anamnesi.condizioni_salute||[])].filter(Boolean).join(', ')}`)
    }
    if (anamnesi.livello_tracking) parts.push(`Tracking: ${anamnesi.livello_tracking}`)
    anamnesiText = parts.length ? '\nANAMNESI:\n' + parts.join('\n') : ''
  }

  // ── DIARIO OGGI ─────────────────────────────────────────
  let diaryText = ''
  if (todayDiary?.length > 0) {
    const totKcal = todayDiary.reduce((s,e)=>s+(e.kcal||0),0)
    const totP = todayDiary.reduce((s,e)=>s+(e.protein_g||0),0)
    diaryText = `\nDIARIO DI OGGI: ${totKcal}kcal consumate (P${Math.round(totP)}g) — ${todayDiary.length} alimenti inseriti`
    if (kcalTarget) {
      const remaining = kcalTarget - totKcal
      diaryText += ` | Rimanenti: ${remaining > 0 ? remaining + 'kcal' : 'obiettivo raggiunto'}`
    }
  }

  // ── CHECK-IN SETTIMANALE ────────────────────────────────
  let checkinText = ''
  if (weeklyCheckin) {
    const parts = []
    if (weeklyCheckin.energy) parts.push(`Energia: ${weeklyCheckin.energy}/5`)
    if (weeklyCheckin.sleep) parts.push(`Sonno: ${weeklyCheckin.sleep}/5`)
    if (weeklyCheckin.stress) parts.push(`Stress: ${weeklyCheckin.stress}/5`)
    if (weeklyCheckin.notes) parts.push(`Note: ${weeklyCheckin.notes}`)
    checkinText = parts.length ? '\nCHECK-IN SETTIMANALE: ' + parts.join(' | ') : ''
  }

  const systemPrompt = `Sei FO Coach, l'assistente AI nutrizionale di FOfit, creato dal coach Federico Obinu.
Sei esperto di nutrizione sportiva, composizione corporea e stile di vita sostenibile.

═══ PROFILO CLIENTE ═══
Nome: ${clientName || 'Cliente'}
Obiettivo: ${goal || 'non specificato'}
Target giornaliero: ${kcalTarget || '—'} kcal | Proteine: ${proteinTarget || '—'}g | Carbo: ${carbsTarget || '—'}g | Grassi: ${fatTarget || '—'}g
Tipo dieta: ${dietType || 'lineare'}
Progressi recenti: ${progressText}
${anamnesiText}
${diaryText}
${checkinText}

═══ PIANO ALIMENTARE ATTIVO ═══
${planText}

═══ SCHEDA ALLENAMENTO ═══
${workoutText}

═══ ISTRUZIONI DI RISPOSTA ═══
STILE:
- Tono caldo, professionale, motivante — come un coach vero che conosce bene il cliente
- Usa il nome del cliente quando è naturale
- Risposte concise e pratiche — no muri di testo
- Usa emoji con parsimonia per rendere la lettura piacevole
- Quando suggerisci alternative, dai sempre grammature PRECISE e macro equivalenti

COSA PUOI FARE:
- Suggerire ricette creative bilanciate sui macro del piano
- Proporre sostituzioni intelligenti agli alimenti del piano
- Analizzare il piano alimentare e dare feedback costruttivo
- Spiegare perché certi alimenti sono nel piano
- Aiutare con la lista della spesa
- Rispondere a dubbi su nutrizione, macro, timing dei pasti
- Considerare le preferenze dall'anamnesi quando suggerisci alimenti
- Commentare il diario di oggi e suggerire cosa mangiare per i pasti rimanenti

COSA NON FAI:
- Consigli medici o diagnosi
- Modifiche al piano senza indicare di consultare il coach
- Argomenti non legati a nutrizione/benessere

═══ RICETTE — FORMATO SPECIALE ═══
Quando il cliente chiede una ricetta, un piatto specifico, cosa mangiare o cosa cucinare, includi SEMPRE alla fine del messaggio questo JSON su UNA SOLA RIGA:

RECIPE_JSON:{"titolo":"Nome piatto","porzioni":1,"pasto":"pranzo","ingredienti":[{"nome":"Petto di pollo","quantita_g":200,"kcal":216,"p":44,"c":0,"g":4}],"kcal_totali":499,"p_totali":50,"c_totali":62,"g_totali":5}

Tipi pasto: colazione, spuntino, pranzo, pre-workout, cena, merenda
Calcola valori nutrizionali REALI e PRECISI per ogni ingrediente.
Rispetta i target del cliente nei totali della ricetta.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Errore AI' })

    const fullText = data.content?.[0]?.text || ''

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
