function cleanText(text) {
  return text
    .replace(/\d{2}\/\d{2}\/\d{4}.*Pagina.*\n/g, '')
    .replace(/\.{3}Continua.*\n/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  try { return JSON.parse(clean) } catch(e) {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(clean.substring(start, end + 1)) } catch(e) {}
  }
  return null
}

async function callAI(apiKey, systemPrompt, userPrompt, maxTokens = 6000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Errore AI')
  return data.content?.[0]?.text || ''
}

const SYSTEM = 'Sei un parser di piani alimentari. Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo, zero backtick, zero spiegazioni. Solo il JSON grezzo.'

const SCHEMA_PASTI = `{"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","alimenti":[{"nome":"Petto di pollo","marca":"","quantita_g":200,"kcal":220,"proteine_g":46,"carboidrati_g":0,"grassi_g":3,"opzioni":[{"nome":"Petto di tacchino","quantita_g":200,"kcal":220,"proteine_g":47,"carboidrati_g":0,"grassi_g":2}]}],"alternative":[{"nome":"Alternativa 1","alimenti":[{"nome":"nome alimento alternativo","marca":"","quantita_g":100,"kcal":200,"proteine_g":10,"carboidrati_g":30,"grassi_g":5}]}]}]}`

const SCHEMA_INTEGRATORI = `{"integratori":[{"momento":"Colazione","nome":"Reishi","dosaggio":"3cps","link":"https://...","note":"prima di colazione"}]}`

// Trova blocchi "variante" tipo: header con Kcal/die / Carboidrati / Grassi / Proteine, precedenti un elenco pasti
function findVariants(text) {
  const re = /([^\n]{3,80})\n[^\n]*Kcal\/die:\s*([\d.,]+)[\s\S]{0,300}?Carboidrati:\s*(\d+)\s*g[\s\S]{0,300}?Grassi:\s*(\d+)\s*g[\s\S]{0,300}?Proteine:\s*(\d+)\s*g/gi
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return []

  const variants = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = m.index + m[0].length
    const end = i + 1 < matches.length ? matches[i+1].index : text.length
    let body = text.substring(start, end)
    // Tronca prima della sezione integratori/note se presenti dentro al corpo
    body = body.split(/Modulo Integrazione/i)[0]
    variants.push({
      nome: m[1].trim().replace(/\t/g, ' '),
      kcal: Math.round(parseFloat(m[2].replace(',', '.'))),
      carboidrati_g: parseInt(m[3]),
      grassi_g: parseInt(m[4]),
      proteine_g: parseInt(m[5]),
      bodyText: body.trim(),
    })
  }
  return variants
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key mancante' })

  try {
    // ── MODALITÀ GENERA BATCH (2-3 giorni alla volta) ────────
    if (req.body.mode === 'generate_batch') {
      const { prompt } = req.body
      const systemPrompt = 'Sei un nutrizionista esperto. Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo, zero backtick, zero spiegazioni. Solo il JSON grezzo.'
      const aiText = await callAI(apiKey, systemPrompt, prompt, 2000)
      const parsed = extractJSON(aiText)
      if (!parsed?.varianti) return res.status(200).json({ varianti: [] })
      return res.status(200).json({ varianti: parsed.varianti })
    }

    // ── MODALITÀ GENERA DA ZERO (legacy) ─────────────────────
    if (req.body.mode === 'generate') {
      const { kcal, protein, carbs, fat, meals_per_day, foods_liked, foods_avoided, lifestyle, goal, diet_type, phases } = req.body.preferences

      const systemPrompt = `Sei un nutrizionista esperto che crea piani alimentari personalizzati. Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo, zero backtick, zero spiegazioni. Solo il JSON grezzo.`

      let parametriStr = ''
      if (!phases || diet_type === 'lineare') {
        parametriStr = `- Kcal: ${kcal} | Proteine: ${protein}g | Carbo: ${carbs}g | Grassi: ${fat}g`
      } else if (diet_type === 'on_off') {
        parametriStr = `- DIETA ON/OFF:\n  - Giorno ON: ${phases[0].kcal}kcal | P${phases[0].protein}g C${phases[0].carbs}g G${phases[0].fat}g\n  - Giorno OFF: ${phases[1].kcal}kcal | P${phases[1].protein}g C${phases[1].carbs}g G${phases[1].fat}g\n  - Alterna ON/OFF per 7 giorni (4 ON + 3 OFF)`
      } else if (diet_type === 'onde') {
        parametriStr = `- DIETA AD ONDE:\n  - Giorno ALTO: ${phases[0].kcal}kcal | P${phases[0].protein}g C${phases[0].carbs}g G${phases[0].fat}g\n  - Giorno MEDIO: ${phases[1].kcal}kcal | P${phases[1].protein}g C${phases[1].carbs}g G${phases[1].fat}g\n  - Giorno BASSO: ${phases[2].kcal}kcal | P${phases[2].protein}g C${phases[2].carbs}g G${phases[2].fat}g\n  - Schema: Alto-Medio-Basso-Alto-Medio-Basso-Medio`
      } else if (diet_type === 'ciclico') {
        parametriStr = `- DIETA CICLICA:\n  - Giorno DEFICIT: ${phases[0].kcal}kcal | P${phases[0].protein}g C${phases[0].carbs}g G${phases[0].fat}g\n  - Giorno SURPLUS: ${phases[1].kcal}kcal | P${phases[1].protein}g C${phases[1].carbs}g G${phases[1].fat}g\n  - Schema: 4 giorni deficit + 3 surplus`
      } else if (diet_type === 'reverse') {
        parametriStr = `- REVERSE DIET:\n  - Settimana 1: ${phases[0].kcal}kcal | P${phases[0].protein}g C${phases[0].carbs}g G${phases[0].fat}g\n  - Incremento: +${phases[1].kcal_increment}kcal/settimana fino a ${phases[1].kcal_target}kcal\n  - Crea i 7 giorni della settimana 1`
      } else if (diet_type === 'refeed') {
        parametriStr = `- REFEED:\n  - Giorni BASE (${7-(phases[1].days||1)} giorni): ${phases[0].kcal}kcal | P${phases[0].protein}g C${phases[0].carbs}g G${phases[0].fat}g\n  - Giorno REFEED (${phases[1].days||1} giorno): ${phases[1].kcal}kcal | P${phases[1].protein}g C${phases[1].carbs}g G${phases[1].fat}g (carbo molto alti)\n  - Nel refeed aumenta principalmente i carboidrati`
      }

      const userPrompt = `Crea piano alimentare 7 giorni diversi.

PARAMETRI:
${parametriStr}
- Pasti/die: ${meals_per_day} | Obiettivo: ${goal}
- Preferiti: ${foods_liked || 'vari'} | Evitare: ${foods_avoided || 'nessuno'}

REGOLE: 7 giorni diversi, rispetta macro ±5%, 1 opzione alternativa per alimento, nomi pasti italiani, kcal e macro precisi.

JSON (solo JSON grezzo):
{"varianti":[{"nome":"Lunedì","kcal":${Math.round(kcal||2000)},"proteine_g":${Math.round(protein||150)},"carboidrati_g":${Math.round(carbs||200)},"grassi_g":${Math.round(fat||65)},"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","alimenti":[{"nome":"Fiocchi avena","quantita_g":80,"kcal":300,"proteine_g":10,"carboidrati_g":55,"grassi_g":5,"opzioni":[{"nome":"Yogurt greco","quantita_g":200,"kcal":120,"proteine_g":20,"carboidrati_g":6,"grassi_g":1}]}]}]}]}`

      const aiText = await callAI(apiKey, systemPrompt, userPrompt, 4000)
      const parsed = extractJSON(aiText)
      if (!parsed?.varianti) return res.status(500).json({ error: 'Piano non generato. Riprova.' })

      // Arrotonda tutti i valori
      parsed.varianti.forEach(v => {
        v.kcal = Math.round(v.kcal||0); v.proteine_g = Math.round(v.proteine_g||0)
        v.carboidrati_g = Math.round(v.carboidrati_g||0); v.grassi_g = Math.round(v.grassi_g||0)
        ;(v.pasti||[]).forEach(p => {
          ;(p.alimenti||[]).forEach(a => {
            a.kcal=Math.round(a.kcal||0); a.proteine_g=Math.round(a.proteine_g||0)
            a.carboidrati_g=Math.round(a.carboidrati_g||0); a.grassi_g=Math.round(a.grassi_g||0)
            a.quantita_g=Math.round(a.quantita_g||0)
            ;(a.opzioni||[]).forEach(o => {
              o.kcal=Math.round(o.kcal||0); o.proteine_g=Math.round(o.proteine_g||0)
              o.carboidrati_g=Math.round(o.carboidrati_g||0); o.grassi_g=Math.round(o.grassi_g||0)
              o.quantita_g=Math.round(o.quantita_g||0)
            })
          })
        })
      })

      return res.status(200).json({ plan: {
        titolo: 'Piano alimentare personalizzato',
        kcal_totali: Math.round(kcal),
        proteine_g: Math.round(protein),
        carboidrati_g: Math.round(carbs),
        grassi_g: Math.round(fat),
        diet_type: diet_type || 'lineare',
        note_generali: `Piano generato su misura. Obiettivo: ${goal}. Preferenze: ${foods_liked}.`,
        varianti: parsed.varianti,
        integratori: [],
        generated: true,
      }})
    }

    // ── MODALITÀ PARSE SINGOLO GIORNO ────────────────────────
    if (req.body.mode === 'parse_day') {
      const { dayName, dayText, macros } = req.body
      if (!dayText) return res.status(400).json({ error: 'Testo mancante' })
      const SPASTI = '{"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","alimenti":[{"nome":"Fiocchi avena","marca":"","quantita_g":80,"kcal":300,"proteine_g":10,"carboidrati_g":55,"grassi_g":5,"opzioni":[]}]}]}'
      const prompt = `Estrai pasti di ${dayName}. SOLO JSON:
${SPASTI}
Tipi validi: colazione,spuntino,pranzo,pre-workout,post-workout,cena,merenda,altro. DOPO PALESTRA=post-workout, DOPO LAVORO=spuntino, PRIMA DI DORMIRE=merenda. Usa i valori kcal/macro del testo. Ometti note tra parentesi.

TESTO:
${dayText.substring(0,2000)}`
      const aiText = await callAI(apiKey, SYSTEM, prompt, 1500)
      const parsed = extractJSON(aiText)
      return res.status(200).json({ pasti: parsed?.pasti || [], macros: macros || null })
    }

    // ── MODALITÀ IMPORTA TESTO ──────────────────────────────
    const { textContent } = req.body
    if (!textContent) return res.status(400).json({ error: 'Testo mancante' })
    const cleaned = cleanText(textContent)

    const MEAL_RULES = `REGOLE IMPORTANTI:
- Tipi pasto validi: colazione, spuntino, pranzo, pre-workout, post-workout, cena, merenda, altro.
- Mappatura nomi pasto: "DOPO PALESTRA" o "POST WORKOUT" → tipo "post-workout" | "DOPO LAVORO" → tipo "spuntino" | "PRIMA DI DORMIRE" o "PRE NANNA" → tipo "merenda" | "DOPO PRANZO" → tipo "spuntino".
- Quando un alimento ha alternative separate da "/" o "(alternative: ...)", metti la PRIMA opzione come alimento principale e le successive (massimo 3) nell'array "opzioni" di quell'alimento, stimando kcal/proteine/carboidrati/grassi per ciascuna in base a valori nutrizionali standard.
- "alternative" (a livello di pasto, es. "Pranzo Alternativa1)") sono pasti sostitutivi interi.
- Usa i valori kcal/macro già presenti nel testo se disponibili — NON stimarli se sono già scritti.
- Ometti note di preparazione dal nome alimento (es. "(NB: 180g pasta cruda = ~540g cotta)" → ignora).
- Mantieni l'ordine dei pasti come nel testo.`

    let varianti = []
    const detected = findVariants(cleaned)

    // Rileva il tipo di dieta dal testo
    function detectDietType(text) {
      const t = text.toLowerCase()
      if (/reverse diet|reverse|aumento progressivo|aumento settimanale/i.test(t)) return 'reverse'
      if (/refeed|giorno di ricarica|carico|carboidrati alti/i.test(t)) return 'refeed'
      if (/surplus.*deficit|deficit.*surplus|settimana a|settimana b/i.test(t)) return 'ciclico'
      if (/on.*off|off.*on|giorni on|giorni off|allenamento.*riposo/i.test(t)) return 'on_off'
      if (/alto.*medio.*basso|basso.*medio.*alto|high.*mid.*low|onde/i.test(t)) return 'onde'
      if (/lun|mar|mer|gio|ven|sab|dom/i.test(t) && /kcal/i.test(t)) return 'on_off'
      return 'lineare'
    }
    const detectedDietType = detectDietType(cleaned)

    // Rileva anche piani con giorni espliciti (LUNEDÌ, MARTEDÌ, ecc.)
    const hasDays = /LUNEDÌ|MARTEDÌ|MERCOLEDÌ|GIOVEDÌ|VENERDÌ|SABATO|DOMENICA/i.test(cleaned)

    if (detected.length > 0) {
      // Piano con varianti multiple (es. ON/OFF/Week diverse)
      for (const v of detected.slice(0, 4)) {
        if (v.bodyText.length < 30) continue
        const raw = await callAI(apiKey, SYSTEM,
          `Estrai i pasti di questo schema alimentare e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_PASTI}\n\n${MEAL_RULES}\n\nTESTO:\n${v.bodyText.substring(0, 6000)}`, 8000)
        const parsed = extractJSON(raw)
        if (parsed?.pasti?.length > 0) {
          varianti.push({
            nome: v.nome,
            kcal: v.kcal,
            proteine_g: v.proteine_g,
            carboidrati_g: v.carboidrati_g,
            grassi_g: v.grassi_g,
            pasti: parsed.pasti,
          })
        }
      }
    } else if (hasDays) {
      // Piano con giorni espliciti — supporta formato === GIORNO === e formato semplice
      const dayNames = ['LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO','DOMENICA']
      const dayMap = { 'LUNEDÌ':1,'MARTEDÌ':2,'MERCOLEDÌ':3,'GIOVEDÌ':4,'VENERDÌ':5,'SABATO':6,'DOMENICA':7 }

      // Pattern robusto: cattura giorno preceduto da === o da newline
      // Esclude menzioni nei riepiloghi (dopo RIEPILOGO, FONTI, CONSIGLI)
      const cleanedForDays = cleaned.split(/RIEPILOGO|FONTI|CONSIGLI|======[=]+\s*$|Note generali/i)[0]

      const dayPattern = /(?:={3,}[^\n]*\n)?(LUNEDÌ|MARTEDÌ|MERCOLEDÌ|GIOVEDÌ|VENERDÌ|SABATO|DOMENICA)(?:\n={3,})?/gi
      const dayMatches = [...cleanedForDays.matchAll(dayPattern)]

      // Rimuovi duplicati (stesso giorno più volte)
      const seenDays = new Set()
      const uniqueDayMatches = dayMatches.filter(m => {
        const d = m[1].toUpperCase()
        if (seenDays.has(d)) return false
        seenDays.add(d)
        return true
      })

      const dayBlocks = []
      for (let i = 0; i < uniqueDayMatches.length; i++) {
        const m = uniqueDayMatches[i]
        const dayName = m[1].toUpperCase()
        const start = m.index + m[0].length
        const end = i + 1 < uniqueDayMatches.length ? uniqueDayMatches[i+1].index : cleanedForDays.length
        let body = cleanedForDays.substring(start, end).trim()
        if (body.length > 30) dayBlocks.push({ dayName, dayNum: dayMap[dayName]||1, body })
      }

      // Estrai macro dal pattern "TOTALE: XXXX kcal | P: XXg | C: XXg | G: XXg"
      function extractDayMacros(body) {
        const m = body.match(/TOTALE:\s*([\d.,]+)\s*kcal\s*\|\s*P:\s*([\d.,]+)g\s*\|\s*C:\s*([\d.,]+)g\s*\|\s*G:\s*([\d.,]+)g/i)
        if (m) return { kcal: Math.round(parseFloat(m[1])), proteine_g: Math.round(parseFloat(m[2])), carboidrati_g: Math.round(parseFloat(m[3])), grassi_g: Math.round(parseFloat(m[4])) }
        // Fallback: calcola dai pasti
        return null
      }
      }

      // Elabora tutti i giorni in parallelo (max 7 chiamate)
      const results = await Promise.all(dayBlocks.map(async db => {
        const macros = extractDayMacros(db.body)
        const raw = await callAI(apiKey, SYSTEM,
          `Estrai pasti di ${db.dayName}. JSON con struttura:\n${SCHEMA_PASTI}\n${MEAL_RULES}\n\nTESTO:\n${db.body.substring(0, 2500)}`, 2000)
        const parsed = extractJSON(raw)
        return { dayName: db.dayName, dayNum: db.dayNum, pasti: parsed?.pasti || [], macros }
      }))

      for (const r of results) {
        if (!r.pasti.length) continue
        const macros = r.macros || {}
        const totKcal = r.pasti.reduce((s,p)=>(p.alimenti||[]).reduce((ss,a)=>ss+(a.kcal||0),s),0)
        varianti.push({
          nome: r.dayName.charAt(0) + r.dayName.slice(1).toLowerCase(),
          kcal: macros.kcal || totKcal || 2000,
          proteine_g: macros.proteine_g || 0,
          carboidrati_g: macros.carboidrati_g || 0,
          grassi_g: macros.grassi_g || 0,
          pasti: r.pasti,
          dayNum: r.dayNum,
        })
      }
    }

    if (varianti.length === 0) {
      // Piano semplice senza varianti rilevate: un'unica variante per tutta la settimana
      const raw = await callAI(apiKey, SYSTEM,
        `Estrai i pasti da questo piano alimentare e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_PASTI}\n\n${MEAL_RULES}\nSe non trovi le kcal totali del giorno, stimale dalla somma degli alimenti.\n\nTESTO:\n${cleaned.substring(0, 6000)}`, 8000)
      const parsed = extractJSON(raw)
      if (!parsed?.pasti?.length) {
        return res.status(500).json({ error: 'Non riesco a leggere il piano. Controlla che il testo contenga almeno colazione, pranzo e cena.' })
      }
      // Stima macro totali dai pasti
      let totKcal=0, totP=0, totC=0, totG=0
      parsed.pasti.forEach(p => (p.alimenti||[]).forEach(a => {
        totKcal += a.kcal||0; totP += a.proteine_g||0; totC += a.carboidrati_g||0; totG += a.grassi_g||0
      }))
      varianti.push({
        nome: 'Piano',
        kcal: totKcal || 2000,
        proteine_g: totP || 150,
        carboidrati_g: totC || 200,
        grassi_g: totG || 65,
        pasti: parsed.pasti,
      })
    }

    // ── INTEGRATORI ──
    let integratori = []
    const suppMatch = cleaned.match(/Modulo Integrazione[\s\S]{0,2000}?(?=\n\s*Note:|\nGIORNO|\s*$)/i)
    if (suppMatch && suppMatch[0].length > 30) {
      try {
        const raw = await callAI(apiKey, SYSTEM,
          `Estrai il piano integratori da questo testo e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_INTEGRATORI}\n\nIl testo è organizzato come una tabella MOMENTO -> contenuto. Un MOMENTO può contenere più integratori su righe diverse: creane una voce per ciascuno. "momento" è il momento della giornata (es. Colazione, Pranzo, Pre-WO, Prenanna). "nome" è il nome del prodotto/integratore. "dosaggio" è la quantità (es. "3cps", "2000ui", "5g"). "link" è l'eventuale URL. "note" sono eventuali indicazioni tra parentesi. Se una riga è vuota o "-", ignorala.\n\nTESTO:\n${suppMatch[0].substring(0, 2000)}`, 2000)
        const parsed = extractJSON(raw)
        if (parsed?.integratori?.length > 0) integratori = parsed.integratori
      } catch(e) { /* non bloccante */ }
    }

    // ── NOTE GENERALI ──
    let note_generali = ''
    const notesMatch = cleaned.match(/\nNote:\s*\n([\s\S]{0,2500}?)(?=\nGIORNO|\s*$)/i)
    if (notesMatch) {
      note_generali = notesMatch[1]
        .replace(/^[-•◦\s]+/gm, '• ')
        .replace(/\n{2,}/g, '\n')
        .trim()
        .substring(0, 1500)
    }

    // ── TITOLO E MACRO RIASSUNTIVI (media pesata sulle varianti) ──
    const avgKcal = Math.round(varianti.reduce((s,v)=>s+v.kcal,0) / varianti.length)
    const avgP = Math.round(varianti.reduce((s,v)=>s+v.proteine_g,0) / varianti.length)
    const avgC = Math.round(varianti.reduce((s,v)=>s+v.carboidrati_g,0) / varianti.length)
    const avgG = Math.round(varianti.reduce((s,v)=>s+v.grassi_g,0) / varianti.length)

    const plan = {
      titolo: 'Piano alimentare',
      kcal_totali: avgKcal,
      proteine_g: avgP,
      carboidrati_g: avgC,
      grassi_g: avgG,
      diet_type: detectedDietType,
      note_generali,
      varianti,
      integratori,
    }

    return res.status(200).json({ plan })

  } catch(e) {
    return res.status(500).json({ error: 'Errore: ' + e.message })
  }
}
