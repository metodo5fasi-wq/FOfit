export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { formData, kcalTarget, protTarget, carbsTarget, fatTarget, dayCalories } = req.body
  if (!formData) return res.status(400).json({ error: 'Dati mancanti' })

  const DAY_NAMES = ['Lunedi','Martedi','Mercoledi','Giovedi','Venerdi','Sabato','Domenica']
  const days = {}

  try {
    const clientCtx = buildClientContext(formData)

    for (let d = 0; d < 7; d++) {
      const kcalDay = dayCalories?.[d] || kcalTarget || 2000

      const prompt = `Sei un nutrizionista. Crea i pasti di ${DAY_NAMES[d]} per questo cliente.

CLIENTE: ${clientCtx}
TARGET: ${kcalDay} kcal, P${protTarget||0}g C${carbsTarget||0}g G${fatTarget||0}g
PASTI: ${formData.pastiSelezionati || 'Colazione, Pranzo, Spuntino pomeriggio, Cena'}
CUCINA: ${formData.stileCucina || 'italiana'}, ${formData.preferenzePasti || 'varia e gustosa'}
PREPARAZIONE: ${formData.metodiCottura || 'qualsiasi'}, ${formData.tempoCottura || 'tempo medio'}

REGOLE JSON:
1. Rispondi SOLO con array JSON, zero testo prima o dopo
2. Nei nomi degli alimenti NON usare apostrofi - scrivi "Fiocchi di avena" non "Fiocchi d'avena"
3. Usa solo virgolette doppie nel JSON
4. Le kcal totali dei pasti devono essere ${kcalDay} kcal (±80 kcal)
5. Alimenti italiani gustosi e variati, non solo pollo e riso

FORMATO (segui esattamente):
[{"meal_type":"Colazione","note_pasto":"Preparazione in 5 minuti","foods":[{"name":"Fiocchi di avena","qty":60,"kcal100":372,"p100":13,"c100":67,"g100":7,"prep":"a crudo con latte"},{"name":"Latte parzialmente scremato","qty":200,"kcal100":46,"p100":3.4,"c100":4.8,"g100":1.6,"prep":"freddo"}]},{"meal_type":"Pranzo","note_pasto":"Pasto completo e bilanciato","foods":[{"name":"Petto di pollo","qty":150,"kcal100":110,"p100":23,"c100":0,"g100":1.5,"prep":"griglia"},{"name":"Riso basmati","qty":80,"kcal100":352,"p100":7,"c100":78,"g100":0.5,"prep":"bollitura"},{"name":"Zucchine","qty":150,"kcal100":17,"p100":1.2,"c100":2.8,"g100":0.2,"prep":"padella con olio"}]},{"meal_type":"Spuntino pomeriggio","note_pasto":"Spuntino proteico","foods":[{"name":"Yogurt greco 0%","qty":150,"kcal100":57,"p100":10,"c100":3.6,"g100":0.2,"prep":"freddo"},{"name":"Mandorle","qty":20,"kcal100":579,"p100":21,"c100":22,"g100":50,"prep":"al naturale"}]},{"meal_type":"Cena","note_pasto":"Cena leggera e gustosa","foods":[{"name":"Salmone","qty":150,"kcal100":208,"p100":20,"c100":0,"g100":13,"prep":"forno con limone"},{"name":"Patate lesse","qty":200,"kcal100":77,"p100":2,"c100":17,"g100":0.1,"prep":"bollite"},{"name":"Insalata mista","qty":100,"kcal100":15,"p100":1,"c100":2,"g100":0.2,"prep":"cruda con aceto balsamico"}]}]`

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
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Errore API')

      const text = data.content?.[0]?.text || ''
      
      // Estrai array JSON robusto
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error(`Giorno ${d}: nessun array`)

      let jsonStr = text.slice(start, end + 1)
      
      // Sanitizza
      jsonStr = jsonStr
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

      try {
        const parsed = JSON.parse(jsonStr)
        if (!Array.isArray(parsed)) throw new Error('Non è un array')
        days[String(d)] = parsed
      } catch(e) {
        console.error(`Day ${d} error:`, e.message, jsonStr.slice(0, 300))
        throw new Error(`Giorno ${d}: ${e.message}`)
      }
    }

    // Feedback AI
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
  if (f.sesso && f.sesso !== '—') parts.push(`Sesso ${f.sesso}`)
  if (f.peso) parts.push(`Peso ${f.peso}kg`)
  if (f.altezza) parts.push(`Altezza ${f.altezza}cm`)
  if (f.lavoro && f.lavoro !== '—') parts.push(`Lavoro: ${f.lavoro}`)
  if (f.attivita && f.attivita !== '—') parts.push(`Attivita: ${f.attivita}`)
  if (f.obiettivo && f.obiettivo !== '—') parts.push(`Obiettivo: ${f.obiettivo}`)
  if (f.variazione && f.variazione !== '—') parts.push(`Variazione: ${f.variazione}`)
  if (f.intolleranze) parts.push(`VIETATI per intolleranze: ${f.intolleranze}`)
  if (f.patologie) parts.push(`Patologie: ${f.patologie}`)
  if (f.farmaci) parts.push(`Farmaci: ${f.farmaci}`)
  if (f.nonMangia) parts.push(`Non mangia (VIETATI): ${f.nonMangia}`)
  if (f.amaMangiare) parts.push(`Preferisce: ${f.amaMangiare}`)
  if (f.budget && f.budget !== '—') parts.push(`Budget: ${f.budget}`)
  if (f.noteExtra) parts.push(`Note: ${f.noteExtra}`)
  return parts.length ? parts.join('. ') : 'Cliente generico'
}

async function generateFeedback(days, kcalTarget, protTarget) {
  try {
    const summary = Object.entries(days).map(([d, meals]) => {
      const tot = meals.reduce((acc, m) => {
        ;(m.foods || []).forEach(f => { acc.k += (f.kcal100||0)*(f.qty||0)/100; acc.p += (f.p100||0)*(f.qty||0)/100 })
        return acc
      }, {k:0, p:0})
      return `G${parseInt(d)+1}: ${Math.round(tot.k)}kcal P${Math.round(tot.p)}g`
    }).join(' | ')

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 150,
        messages: [{ role: 'user', content: `Nutrizionista. Feedback breve (max 80 parole) su questo piano: ${summary}. Target: ${kcalTarget}kcal, P${protTarget}g. Formato: "Forza: ... Attenzione: ... Suggerimento: ..."` }] }),
    })
    const data = await r.json()
    return data.content?.[0]?.text || ''
  } catch { return '' }
}
