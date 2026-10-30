export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Scheda allenamento: stessa funzione (limite Vercel di 12 funzioni), ramo separato
  if (req.body && req.body.kind === 'workout') return handleWorkout(req, res)

  const { formData, kcalTarget, protTarget, carbsTarget, fatTarget, dayCalories } = req.body
  if (!formData) return res.status(400).json({ error: 'Dati mancanti' })

  const DAY_NAMES = ['Lunedi','Martedi','Mercoledi','Giovedi','Venerdi','Sabato','Domenica']
  const days = {}

  // Banca alimenti diversi per giorno — forza varietà
  const PROTEIN_ROTATION = [
    'Petto di pollo alla griglia',
    'Salmone al forno',
    'Merluzzo al vapore',
    'Tonno al naturale',
    'Uova strapazzate',
    'Lonza di maiale arrosto',
    'Gamberetti saltati in padella'
  ]

  try {
    const clientCtx = buildClientContext(formData)
    // Accumula i pasti usati per forzare varieta
    const usedProteins = []
    const usedCarbs = []
    const usedVeg = []

    for (let d = 0; d < 7; d++) {
      const kcalDay = dayCalories?.[d] || kcalTarget || 2000
      const proteinSuggest = PROTEIN_ROTATION[d % PROTEIN_ROTATION.length]

      const avoidCtx = d > 0 ? `
OBBLIGATORIO: usa alimenti COMPLETAMENTE DIVERSI rispetto ai giorni precedenti.
Proteine gia usate (NON ripetere): ${usedProteins.join(', ')}
Carboidrati gia usati (NON ripetere): ${usedCarbs.join(', ')}
Verdure gia usate (varia): ${usedVeg.join(', ')}
Proteina suggerita per oggi: ${proteinSuggest}` : `Proteina suggerita per oggi: ${proteinSuggest}`

      const prompt = `Sei un nutrizionista esperto italiano. Crea i pasti di ${DAY_NAMES[d]} per questo cliente.

PROFILO CLIENTE: ${clientCtx}
TARGET: ${kcalDay} kcal totali (±80 kcal), P${protTarget||0}g C${carbsTarget||0}g G${fatTarget||0}g
PASTI DA CREARE: ${formData.pastiSelezionati || 'Colazione, Pranzo, Spuntino pomeriggio, Cena'}
STILE: ${formData.stileCucina || 'italiana'}, ${formData.preferenzePasti || 'gustosa e varia'}
METODI: ${formData.metodiCottura || 'qualsiasi'}, tempo: ${formData.tempoCottura || 'medio'}
${avoidCtx}

ISTRUZIONI CRITICHE:
- RISPOSTA: solo array JSON valido, zero testo fuori
- NON usare apostrofi nei nomi (scrivi "di" non apostrofo): "Fiocchi di avena" non "Fiocchi d'avena"
- Usa SOLO virgolette doppie
- kcal totali devono essere ESATTAMENTE ${kcalDay} (±80 kcal), distribuisci bene tra i pasti
- Pasti gustosi, realistici, non solo pollo e riso
- Campo "note_pasto": scrivi la RICETTA COMPLETA con passaggi numerati dettagliati, es:
  "1. Preriscalda forno a 180 gradi. 2. Condisci il salmone con olio EVO, limone e rosmarino. 3. Avvolgi in carta forno e cuoci 20 minuti. 4. Nel frattempo lessare le patate 15 minuti. 5. Servi con un filo di olio a crudo."
  Per spuntini semplici (frutta, yogurt): breve nota su come abbinarli al meglio.

FORMATO JSON ESATTO (rispetta questa struttura):
[
  {
    "meal_type": "Colazione",
    "note_pasto": "1. Pesa i fiocchi di avena e mettili in una ciotola. 2. Aggiungi il latte freddo e mescola. 3. Lascia riposare 5 minuti per ammorbidire. 4. Aggiungi la frutta fresca tagliata a pezzetti. 5. Puoi aggiungere un cucchiaino di miele se gradito.",
    "foods": [
      {"name": "Fiocchi di avena", "qty": 60, "kcal100": 372, "p100": 13, "c100": 67, "g100": 7, "prep": "a crudo"},
      {"name": "Latte parzialmente scremato", "qty": 200, "kcal100": 46, "p100": 3.4, "c100": 4.8, "g100": 1.6, "prep": "freddo"},
      {"name": "Fragole", "qty": 100, "kcal100": 32, "p100": 0.7, "c100": 7.7, "g100": 0.3, "prep": "fresche"}
    ]
  },
  {
    "meal_type": "Pranzo",
    "note_pasto": "1. Porta a bollore abbondante acqua salata per la pasta. 2. Nel frattempo taglia il petto di pollo a cubetti e marinalo con olio, aglio e rosmarino 10 minuti. 3. Cuoci la pasta al dente (circa 10 minuti). 4. In una padella antiaderente cuoci il pollo a fuoco medio 6-7 minuti per lato. 5. Griglia le zucchine tagliate a rondelle 3 minuti per lato. 6. Impiatta tutto e condisci con olio EVO a crudo.",
    "foods": [
      {"name": "Pasta di grano duro", "qty": 80, "kcal100": 351, "p100": 12, "c100": 70, "g100": 1.5, "prep": "al dente"},
      {"name": "Petto di pollo", "qty": 130, "kcal100": 110, "p100": 23, "c100": 0, "g100": 1.5, "prep": "padella con aglio e rosmarino"},
      {"name": "Zucchine", "qty": 150, "kcal100": 17, "p100": 1.2, "c100": 2.8, "g100": 0.2, "prep": "griglia"},
      {"name": "Olio extravergine di oliva", "qty": 10, "kcal100": 884, "p100": 0, "c100": 0, "g100": 100, "prep": "a crudo"}
    ]
  }
]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Errore API giorno ' + d)

      const text = data.content?.[0]?.text || ''
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error(`Giorno ${d}: nessun array JSON nella risposta`)

      let jsonStr = text.slice(start, end + 1)
      jsonStr = jsonStr
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

      let parsed
      try {
        parsed = JSON.parse(jsonStr)
        if (!Array.isArray(parsed)) throw new Error('Non array')
      } catch(e) {
        console.error(`Day ${d} JSON error:`, e.message, '\n', jsonStr.slice(0, 400))
        throw new Error(`Giorno ${d} JSON non valido: ${e.message}`)
      }

      days[String(d)] = parsed

      // Accumula proteine/carb/verdure usate per forzare varieta
      parsed.forEach(meal => {
        (meal.foods || []).forEach(f => {
          const n = (f.name || '').toLowerCase()
          if (f.p100 > 15) usedProteins.push(f.name)
          if (f.c100 > 30 && f.kcal100 > 200) usedCarbs.push(f.name)
          if (f.kcal100 < 50 && f.c100 < 10) usedVeg.push(f.name)
        })
      })
    }

    const feedback = await generateFeedback(days, kcalTarget, protTarget)
    return res.status(200).json({ ok: true, days, feedback })

  } catch (e) {
    console.error('[generate-plan]', e.message)
    return res.status(500).json({ error: e.message })
  }
}

function buildClientContext(f) {
  const parts = []
  if (f.eta) parts.push(`Eta ${f.eta} anni`)
  if (f.sesso && f.sesso !== '—') parts.push(f.sesso)
  if (f.peso) parts.push(`Peso ${f.peso}kg`)
  if (f.altezza) parts.push(`Altezza ${f.altezza}cm`)
  if (f.lavoro && f.lavoro !== '—') parts.push(`Lavoro: ${f.lavoro}`)
  if (f.attivita && f.attivita !== '—') parts.push(`Attivita: ${f.attivita}`)
  if (f.obiettivo && f.obiettivo !== '—') parts.push(`Obiettivo: ${f.obiettivo}`)
  if (f.variazione && f.variazione !== '—') parts.push(`Variazione calorica: ${f.variazione}`)
  if (f.intolleranze) parts.push(`ALLERGIE/INTOLLERANZE - VIETATI: ${f.intolleranze}`)
  if (f.patologie) parts.push(`Patologie: ${f.patologie}`)
  if (f.farmaci) parts.push(`Farmaci: ${f.farmaci}`)
  if (f.nonMangia) parts.push(`NON MANGIA - VIETATI: ${f.nonMangia}`)
  if (f.amaMangiare) parts.push(`Preferisce: ${f.amaMangiare}`)
  if (f.budget && f.budget !== '—') parts.push(`Budget: ${f.budget}`)
  if (f.mealPrep && f.mealPrep !== '—') parts.push(`Meal prep: ${f.mealPrep}`)
  if (f.noteExtra) parts.push(`NOTE COACH: ${f.noteExtra}`)
  return parts.length ? parts.join('. ') : 'Cliente generico'
}

async function generateFeedback(days, kcalTarget, protTarget) {
  try {
    const summary = Object.entries(days).map(([d, meals]) => {
      const tot = meals.reduce((acc, m) => {
        ;(m.foods || []).forEach(f => {
          acc.k += (f.kcal100||0)*(f.qty||100)/100
          acc.p += (f.p100||0)*(f.qty||100)/100
        })
        return acc
      }, {k:0, p:0})
      return `G${parseInt(d)+1}: ${Math.round(tot.k)}kcal P${Math.round(tot.p)}g`
    }).join(' | ')

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5', max_tokens: 200,
        messages: [{ role: 'user', content: `Nutrizionista. Analizza brevemente (max 100 parole) questo piano settimanale e dai 3 feedback pratici in italiano. Piano: ${summary}. Target: ${kcalTarget}kcal, P${protTarget}g. Scrivi: "Forza: [cosa va bene]. Attenzione: [cosa migliorare]. Suggerimento: [consiglio pratico]."` }]
      }),
    })
    const data = await r.json()
    return data.content?.[0]?.text || ''
  } catch { return '' }
}


// ══════════════════════════════════════════════════════════════
// SCHEDA ALLENAMENTO
// ══════════════════════════════════════════════════════════════
const WK_MUSCLES = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Gambe','Femorali','Glutei','Polpacci','Addominali','Cardio','Corpo libero']

async function callClaudeText(prompt, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await r.json()
  if (!r.ok || data.error) throw new Error(data.error?.message || 'Errore API')
  return data.content?.[0]?.text || ''
}

function parseExerciseList(text, label) {
  const clean = String(text).replace(/\/\/[^\n\r]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  let parsed
  const a = clean.indexOf('['), b = clean.lastIndexOf(']')
  if (a !== -1 && b > a) { try { parsed = JSON.parse(clean.slice(a, b + 1)) } catch (e) { /* riprovo come oggetto */ } }
  if (!parsed) {
    const c = clean.indexOf('{'), d = clean.lastIndexOf('}')
    if (c === -1 || d <= c) throw new Error(`${label}: nessun elenco di esercizi nella risposta`)
    try { parsed = JSON.parse(clean.slice(c, d + 1)) } catch (e) { throw new Error(`${label}: JSON non valido (${e.message})`) }
  }
  const list = Array.isArray(parsed) ? parsed : (parsed.exercises || parsed.esercizi)
  if (!Array.isArray(list) || !list.length) throw new Error(`${label}: elenco esercizi vuoto`)
  return list.filter(e => e && (e.name || e.exercise_name)).map(e => ({
    name: String(e.name || e.exercise_name).trim().slice(0, 80),
    muscle: String(e.muscle || e.muscle_group || '').trim().slice(0, 30),
    sets: Math.max(1, Math.min(10, parseInt(e.sets) || 3)),
    reps: String(e.reps || '8-12').slice(0, 20),
    rest: Math.max(15, Math.min(300, parseInt(e.rest ?? e.rest_seconds) || 90)),
    tut: e.tut ? String(e.tut).slice(0, 12) : '',
    note: e.note ? String(e.note).slice(0, 240) : '',
  }))
}

function workoutClientContext(f = {}) {
  const parts = []
  const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() && String(v).trim() !== '—') parts.push(`${k}: ${v}`) }
  add('Età', f.eta ? f.eta + ' anni' : ''); add('Sesso', f.sesso); add('Peso', f.peso ? f.peso + ' kg' : ''); add('Altezza', f.altezza ? f.altezza + ' cm' : '')
  add('Obiettivo', f.obiettivo); add('Livello', f.livello); add('Attrezzatura/luogo', f.attrezzatura)
  add('INFORTUNI/LIMITAZIONI (da rispettare)', f.infortuni); add('Mal di schiena', f.mal_schiena); add('Postura e lavoro sedentario', f.postura)
  add('Esercizi che ODIA (evitare)', f.evitare); add('Esercizi preferiti', f.preferiti)
  if (Array.isArray(f.enfasi) && f.enfasi.length) add('Gruppi da enfatizzare', f.enfasi.join(', '))
  if (f.cardio) add('Cardio', 'includere un finale cardio breve a fine seduta quando ha senso')
  if (f.correttivo) add('Approccio correttivo', 'includere in ogni seduta esercizi di mobilità/stabilità/core per postura e schiena')
  add('Note del coach', f.noteExtra)
  return parts.length ? parts.join('\n') : 'Cliente generico'
}

async function handleWorkout(req, res) {
  try {
    const { formData = {}, structure, library = {}, avoid = [] } = req.body
    if (!Array.isArray(structure) || !structure.length) return res.status(400).json({ error: 'Struttura giorni mancante' })
    const days = structure.slice(0, 7)
    const ctx = workoutClientContext(formData)
    const durata = Math.max(20, Math.min(120, parseInt(formData.durata) || 60))
    const nEx = Math.max(4, Math.min(9, Math.round(durata / 9)))
    const result = []
    const used = [...(Array.isArray(avoid) ? avoid : [])].slice(0, 60)

    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      const focus = (Array.isArray(d.focus) ? d.focus : []).filter(m => WK_MUSCLES.includes(m))
      const groups = [...new Set([...focus, ...(formData.cardio ? ['Cardio'] : []), ...(formData.correttivo ? ['Addominali', 'Corpo libero'] : [])])]
      const libLines = groups.map(g => `${g}: ${(library[g] || []).slice(0, 40).join(' | ')}`).filter(l => !l.endsWith(': ')).join('\n')
      const prompt = `Sei un personal trainer italiano esperto. Crea la seduta "${d.title || 'Giorno ' + (i + 1)}" (giorno ${i + 1} di ${days.length}) di una scheda di allenamento.

CLIENTE:
${ctx}

DURATA SEDUTA: circa ${durata} minuti → ${nEx} esercizi (riscaldamento escluso).
GRUPPI MUSCOLARI DI QUESTA SEDUTA: ${focus.join(', ') || 'a tua scelta'}
${libLines ? `ESERCIZI DISPONIBILI IN LIBRERIA (usa questi nomi ESATTI quando possibile):\n${libLines}\n` : ''}${used.length ? `ESERCIZI GIA' USATI NEI GIORNI PRECEDENTI (varia: stessa funzione ma esercizio o angolazione diversi):\n${used.join(', ')}\n` : ''}
REGOLE:
- Rispondi SOLO con un array JSON valido, zero testo prima o dopo, zero commenti.
- Ogni elemento: {"name":"...","muscle":"...","sets":3,"reps":"8-12","rest":90,"tut":"","note":"..."}
- "muscle" DEVE essere uno tra: ${WK_MUSCLES.join(', ')}.
- Nei nomi non usare apostrofi. Solo virgolette doppie.
- Prima i multiarticolari, poi gli esercizi di isolamento. Riposo: 120-180 s multiarticolari pesanti, 60-90 s isolamento.
- Ripetizioni coerenti con obiettivo e livello (forza 3-6, ipertrofia 6-12, resistenza/definizione 12-20).
- "note": 1-2 frasi in italiano, max 160 caratteri, con indicazioni tecniche di esecuzione per il cliente.
- Rispetta SEMPRE infortuni, limitazioni e mal di schiena: scegli varianti sicure.`
      const text = await callClaudeText(prompt, 2200)
      const exercises = parseExerciseList(text, d.title || `Giorno ${i + 1}`)
      result.push({ title: d.title || `Giorno ${i + 1}`, focus, exercises })
      exercises.forEach(e => used.push(e.name))
    }

    let feedback = ''
    try {
      const summary = result.map(d => `${d.title}: ${d.exercises.map(e => `${e.name} ${e.sets}x${e.reps}`).join('; ')}`).join('\n')
      feedback = await callClaudeText(`Sei un personal trainer. Valuta in modo breve e concreto (max 90 parole, in italiano) questa scheda per il cliente descritto.
CLIENTE:\n${ctx}\nDURATA: ${durata} min\nSCHEDA:\n${summary}\nFormato: "Forza: ... Attenzione: ... Suggerimento: ..."`, 260)
    } catch (e) { feedback = '' }

    return res.status(200).json({ ok: true, days: result, feedback })
  } catch (e) {
    console.error('[generate-plan:workout]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
