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
      model: 'claude-sonnet-4-5',
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

  const { textContent } = req.body
  if (!textContent) return res.status(400).json({ error: 'Testo mancante' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key mancante' })

  try {
    const cleaned = cleanText(textContent)

    const MEAL_RULES = `REGOLE IMPORTANTI:
- Tipi pasto validi: colazione, spuntino, pranzo, pre-workout, cena, merenda.
- Quando un alimento ha alternative separate da "/" o "(alternative: ...)", metti la PRIMA opzione come alimento principale e le successive (massimo 3) nell'array "opzioni" di quell'alimento, stimando kcal/proteine/carboidrati/grassi per ciascuna in base a valori nutrizionali standard.
- "alternative" (a livello di pasto, es. "Pranzo Alternativa1)") sono pasti sostitutivi interi.
- Stima sempre kcal/proteine/carboidrati/grassi per alimenti e opzioni in base a valori standard per 100g.
- Ometti note di preparazione dal nome alimento ma mettile nel campo "orario" o ignorale.
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
      // Piano con giorni espliciti (Lunedì, Martedì...) — estrai ogni giorno separatamente
      const dayPattern = /(LUNEDÌ|MARTEDÌ|MERCOLEDÌ|GIOVEDÌ|VENERDÌ|SABATO|DOMENICA)/gi
      const dayMatches = [...cleaned.matchAll(dayPattern)]
      const dayMap = { 'LUNEDÌ':1,'MARTEDÌ':2,'MERCOLEDÌ':3,'GIOVEDÌ':4,'VENERDÌ':5,'SABATO':6,'DOMENICA':7 }

      const dayBlocks = []
      for (let i = 0; i < dayMatches.length; i++) {
        const m = dayMatches[i]
        const dayName = m[0].toUpperCase()
        const start = m.index
        const end = i + 1 < dayMatches.length ? dayMatches[i+1].index : cleaned.length
        const body = cleaned.substring(start, end).replace(/=+/g,'').trim()
        if (body.length > 30) dayBlocks.push({ dayName, dayNum: dayMap[dayName]||1, body })
      }

      // Elabora tutti i giorni in parallelo (max 7 chiamate)
      const results = await Promise.all(dayBlocks.map(async db => {
        const raw = await callAI(apiKey, SYSTEM,
          `Estrai i pasti di ${db.dayName} e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_PASTI}\n\n${MEAL_RULES}\nSe un alimento ha "alternative: X / Y" o "(alternative: X / Y)" metti X come principale e Y nelle opzioni.\n\nTESTO:\n${db.body.substring(0, 4000)}`, 6000)
        const parsed = extractJSON(raw)
        return { dayName: db.dayName, dayNum: db.dayNum, pasti: parsed?.pasti || [] }
      }))

      // Raggruppa giorni con pasti identici come unica variante
      const uniqueVariants = []
      for (const r of results) {
        if (!r.pasti.length) continue
        // Crea una variante per ogni giorno
        varianti.push({
          nome: r.dayName.charAt(0) + r.dayName.slice(1).toLowerCase(),
          kcal: r.pasti.reduce((s,p)=>(p.alimenti||[]).reduce((ss,a)=>ss+(a.kcal||0),s),0) || 2000,
          proteine_g: 0, carboidrati_g: 0, grassi_g: 0,
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
