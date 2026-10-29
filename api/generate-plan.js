export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { formData, kcalTarget, protTarget, carbsTarget, fatTarget, dietType, dayCalories } = req.body
  if (!formData) return res.status(400).json({ error: 'Dati mancanti' })

  const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
  const days = {}

  try {
    // Costruisci contesto cliente completo
    const clientCtx = buildClientContext(formData)

    for (let d = 0; d < 7; d++) {
      const dayName = DAY_NAMES[d]
      const kcalDay = dayCalories?.[d] || kcalTarget || 2000

      const prompt = `Sei un nutrizionista italiano esperto. Crea i pasti di ${dayName} per questo cliente.

PROFILO CLIENTE:
${clientCtx}

TARGET ${dayName.toUpperCase()}: ${kcalDay} kcal, P${protTarget||''}g C${carbsTarget||''}g G${fatTarget||''}g
TOLLERANZA: ±50 kcal dal target. I macro DEVONO sommare esattamente al target calorico.

PASTI DA CREARE: ${formData.pastiSelezionati || 'Colazione, Pranzo, Spuntino pomeriggio, Cena'}

METODI PREPARAZIONE PREFERITI: ${formData.metodiCottura || 'qualsiasi'}
ATTREZZATURA DISPONIBILE: ${formData.attrezzatura || 'completa'}
TEMPO DISPONIBILE: ${formData.tempoCottura || 'medio'}
LIVELLO CULINARIO: ${formData.livelloCulinario || 'medio'}
BUDGET: ${formData.budget || 'medio'}
STILE CUCINA: ${formData.stileCucina || 'italiana'}
PASTI SFIZOSI: ${formData.preferenzePasti || 'normale varietà'}
MEAL PREP: ${formData.mealPrep || 'ogni giorno'}

REGOLE IMPORTANTI:
- Usa SOLO alimenti che il cliente può mangiare (rispetta allergie e intolleranze)
- Includi metodo di preparazione per ogni alimento nel campo "prep"
- Includi breve istruzione di preparazione del pasto nel campo "note_pasto"
- Varia gli alimenti rispetto agli altri giorni della settimana
- Pasti gustosi e realistici, non solo pollo e riso
- Le kcal totali di tutti i pasti del giorno DEVONO essere ${kcalDay} ±50 kcal

Rispondi SOLO con array JSON valido. Zero testo prima o dopo.
[
  {
    "meal_type": "Colazione",
    "note_pasto": "Preparazione rapida, ottima per chi ha poco tempo la mattina",
    "foods": [
      {"name": "Fiocchi d'avena", "qty": 60, "kcal100": 372, "p100": 13, "c100": 67, "g100": 7, "prep": "a crudo con latte"},
      {"name": "Latte parzialmente scremato", "qty": 200, "kcal100": 46, "p100": 3.4, "c100": 4.8, "g100": 1.6, "prep": "freddo"}
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
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Errore API giorno ' + d)

      const text = data.content?.[0]?.text || ''
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error(`Giorno ${d}: nessun array JSON`)

      try {
        days[String(d)] = JSON.parse(text.slice(start, end + 1))
      } catch(e) {
        throw new Error(`Giorno ${d} JSON non valido: ${e.message}`)
      }
    }

    // Genera feedback AI sul piano completo
    const feedback = await generateFeedback(days, { kcalTarget, protTarget, carbsTarget, fatTarget, dayCalories })

    return res.status(200).json({ ok: true, days, feedback })

  } catch (e) {
    console.error('[generate-plan]', e.message)
    return res.status(500).json({ error: e.message })
  }
}

function buildClientContext(f) {
  const lines = []
  if (f.eta) lines.push(`Età: ${f.eta} anni`)
  if (f.sesso && f.sesso !== '—') lines.push(`Sesso: ${f.sesso}`)
  if (f.peso) lines.push(`Peso: ${f.peso} kg`)
  if (f.altezza) lines.push(`Altezza: ${f.altezza} cm`)
  if (f.lavoro && f.lavoro !== '—') lines.push(`Lavoro: ${f.lavoro}`)
  if (f.attivita && f.attivita !== '—') lines.push(`Attività fisica: ${f.attivita}`)
  if (f.obiettivo && f.obiettivo !== '—') lines.push(`Obiettivo: ${f.obiettivo}`)
  if (f.obiettivoEstetico) lines.push(`Obiettivo estetico: ${f.obiettivoEstetico}`)
  if (f.pesoObiettivo) lines.push(`Peso obiettivo: ${f.pesoObiettivo} kg`)
  if (f.intolleranze) lines.push(`INTOLLERANZE/ALLERGIE (VIETATI): ${f.intolleranze}`)
  if (f.patologie) lines.push(`Patologie: ${f.patologie}`)
  if (f.farmaci) lines.push(`Farmaci: ${f.farmaci}`)
  if (f.nonMangia) lines.push(`Non mangia (VIETATI): ${f.nonMangia}`)
  if (f.amaMangiare) lines.push(`Preferisce: ${f.amaMangiare}`)
  if (f.integratoriUsati) lines.push(`Integratori già usati: ${f.integratoriUsati}`)
  if (f.orariPasti) lines.push(`Orari pasti: ${f.orariPasti}`)
  if (f.stilVita) lines.push(`Stile vita: ${f.stilVita}`)
  if (f.noteExtra) lines.push(`Note extra coach: ${f.noteExtra}`)
  return lines.join('\n')
}

async function generateFeedback(days, targets) {
  try {
    const summary = Object.entries(days).map(([d, meals]) => {
      const tot = meals.reduce((acc, m) => {
        m.foods.forEach(f => { acc.kcal += (f.kcal100||0)*(f.qty||0)/100; acc.p += (f.p100||0)*(f.qty||0)/100 })
        return acc
      }, {kcal:0, p:0})
      return `Giorno ${parseInt(d)+1}: ${Math.round(tot.kcal)} kcal, P${Math.round(tot.p)}g`
    }).join(' | ')

    const prompt = `Sei un nutrizionista. Analizza brevemente questo piano alimentare e dai feedback in 3 punti max.
Dati: ${summary}
Target: ${targets.kcalTarget} kcal/giorno
Rispondi in italiano, max 100 parole, formato: "✅ Punto di forza: ... ⚠️ Attenzione: ... 💡 Suggerimento: ..."`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || ''
  } catch { return '' }
}
