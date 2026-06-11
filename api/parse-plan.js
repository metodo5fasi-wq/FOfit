export const config = { 
  api: { bodyParser: { sizeLimit: '10mb' } },
  maxDuration: 60
}

function cleanText(text) {
  return text
    // Rimuovi righe con solo numeri di pagina, date, puntini
    .replace(/\d{2}\/\d{2}\/\d{4}.*Pagina.*\n/g, '')
    .replace(/\.{3}Continua.*\n/g, '')
    // Rimuovi blocchi ALTERNATIVA (da "ALTERNATIVA N" fino al prossimo pasto principale o fine)
    .replace(/\n[A-Z\s]+ ALTERNATIVA \d+[\s\S]*?(?=\n[A-Z]+(?:\s+MATT\.|\s+SERA)?\n|\nGiorno|\nCOLAZIONE\n|\nPRANZO\n|\nCENA\n|\nSPUNTINO\n|\nMEREND|\n---|\s*$)/gi, '\n')
    // Rimuovi righe vuote multiple
    .replace(/\n{3,}/g, '\n\n')
    // Rimuovi spazi multipli
    .replace(/ {2,}/g, ' ')
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
  const arrStart = clean.indexOf('[')
  const arrEnd = clean.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(clean.substring(arrStart, arrEnd + 1)) } catch(e) {}
  }
  return null
}

async function callAI(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Errore AI')
  return data.content?.[0]?.text || ''
}

const SYSTEM = 'Sei un parser di piani alimentari. Rispondi ESCLUSIVAMENTE con JSON valido. Zero testo, zero backtick, zero spiegazioni. Solo il JSON grezzo.'

const SCHEMA_GIORNO = `{"giorno":"Lunedì","giorno_numero":1,"nota_giorno":"","kcal_giorno":2000,"pasti":[{"nome":"Colazione","tipo":"colazione","orario":"07:30","kcal":450,"alimenti":[{"nome":"nome alimento","marca":"","quantita_g":100,"kcal":200,"proteine_g":10,"carboidrati_g":30,"grassi_g":5}],"alternative":[{"nome":"ALTERNATIVA 1","alimenti":[{"nome":"nome alimento alternativo","marca":"","quantita_g":100,"kcal":200,"proteine_g":10,"carboidrati_g":30,"grassi_g":5}]}]}]}`

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
    const cleaned = cleanText(textContent).substring(0, 4000)
    const hasON = /giorno\s+on/i.test(cleaned)
    const hasOFF = /giorno\s+off/i.test(cleaned)

    let giorni = []

    if (hasON || hasOFF) {
      // Separa ON da OFF
      const onIdx = cleaned.search(/giorno\s+on/i)
      const offIdx = cleaned.search(/giorno\s+off/i)

      const onText = onIdx !== -1 ? (offIdx !== -1 ? cleaned.substring(onIdx, offIdx) : cleaned.substring(onIdx)) : ''
      const offText = offIdx !== -1 ? cleaned.substring(offIdx) : ''

      // Elabora Giorno ON
      if (onText.trim().length > 50) {
        const raw = await callAI(apiKey, SYSTEM,
          `Estrai i pasti del GIORNO ON da questo testo e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_GIORNO}\n\nTipi pasto validi: colazione, spuntino, pranzo, pre-workout, cena, merenda\nSe mancano calorie, stimale. giorno_numero=1\n\nTESTO:\n${onText.substring(0, 2500)}`)
        const g = extractJSON(raw)
        if (g) {
          const onDays = [{g:'Lunedì',n:1},{g:'Mercoledì',n:3},{g:'Venerdì',n:5},{g:'Sabato',n:6}]
          onDays.forEach(d => giorni.push({...g, giorno:d.g, giorno_numero:d.n, nota_giorno:'Giorno di allenamento'}))
        }
      }

      // Elabora Giorno OFF
      if (offText.trim().length > 50) {
        const raw = await callAI(apiKey, SYSTEM,
          `Estrai i pasti del GIORNO OFF da questo testo e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_GIORNO}\n\nTipi pasto validi: colazione, spuntino, pranzo, pre-workout, cena, merenda\nSe mancano calorie, stimale. giorno_numero=2\n\nTESTO:\n${offText.substring(0, 2500)}`)
        const g = extractJSON(raw)
        if (g) {
          const offDays = [{g:'Martedì',n:2},{g:'Giovedì',n:4},{g:'Domenica',n:7}]
          offDays.forEach(d => giorni.push({...g, giorno:d.g, giorno_numero:d.n, nota_giorno:'Giorno di riposo'}))
        }
      }

    } else {
      // Piano senza ON/OFF — un piano unico per tutti i giorni
      const raw = await callAI(apiKey, SYSTEM,
        `Estrai i pasti da questo piano alimentare e restituisci UN oggetto JSON con questa struttura:\n${SCHEMA_GIORNO}\n\nTipi pasto: colazione, spuntino, pranzo, pre-workout, cena, merenda\nSe mancano calorie, stimale. giorno_numero=1\n\nTESTO:\n${cleaned.substring(0, 3000)}`)
      const g = extractJSON(raw)
      if (g) {
        const allDays = [{g:'Lunedì',n:1},{g:'Martedì',n:2},{g:'Mercoledì',n:3},{g:'Giovedì',n:4},{g:'Venerdì',n:5},{g:'Sabato',n:6},{g:'Domenica',n:7}]
        allDays.forEach(d => giorni.push({...g, giorno:d.g, giorno_numero:d.n}))
      }
    }

    if (giorni.length === 0) {
      return res.status(500).json({ error: 'Non riesco a leggere il piano. Controlla che il testo contenga almeno colazione, pranzo e cena.' })
    }

    giorni.sort((a, b) => a.giorno_numero - b.giorno_numero)

    // Calcola media kcal
    const avgKcal = Math.round(giorni.reduce((s, g) => s + (g.kcal_giorno || 2000), 0) / giorni.length)

    // Stima macro medi dai pasti
    let totP = 0, totC = 0, totG = 0, count = 0
    giorni.forEach(g => {
      ;(g.pasti || []).forEach(p => {
        ;(p.alimenti || []).forEach(a => {
          totP += a.proteine_g || 0
          totC += a.carboidrati_g || 0
          totG += a.grassi_g || 0
          count++
        })
      })
    })
    const daysCount = giorni.length || 1

    const plan = {
      titolo: 'Piano alimentare',
      kcal_totali: avgKcal,
      proteine_g: Math.round(totP / daysCount) || 150,
      carboidrati_g: Math.round(totC / daysCount) || 200,
      grassi_g: Math.round(totG / daysCount) || 65,
      note_generali: '',
      giorni
    }

    return res.status(200).json({ plan })

  } catch(e) {
    return res.status(500).json({ error: 'Errore: ' + e.message })
  }
}
