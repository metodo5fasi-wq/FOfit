import { applyCors, guard } from '../server/auth.js'
import { TOOLS, runTool } from '../server/assistantTools.js'
import { contextToPrompt, restrictionKeys, pickModel, todayInfo } from '../src/lib/assistantContext.js'

// Assistente nutrizionale FO Coach.
//  • risposta IN STREAMING (il testo compare mentre viene scritto)
//  • modello veloce per le domande semplici, modello principale per ricette, sostituzioni e analisi (cambiabili da Vercel: AI_MODEL_FAST, AI_MODEL_MAIN)
//  • l'AI usa due strumenti: crea_ricetta (numeri veri dal database) e trova_alternative (motore di equivalenze); allergie e intolleranze sono blocchi rigidi
const MAIN = () => process.env.AI_MODEL_MAIN || 'claude-sonnet-4-5'
const FAST = () => process.env.AI_MODEL_FAST || 'claude-haiku-4-5'
const MAX_HISTORY = 14, MAX_STEPS = 5

const BASE_PROMPT = `Sei FO Coach, l'assistente nutrizionale di FOfit creato dal coach Federico Obinu. Parli in italiano, con tono professionale ma caldo, da coach vero.

COME RISPONDI
- Rapido e concreto: di solito 3-6 righe. Niente premesse, niente ripetere la domanda. Elenchi solo quando servono.
- Sai che giorno è (vedi «OGGI È» sotto): "oggi", "stasera", "domani" si riferiscono a quel giorno del piano, mai a lunedì per default. Se ti chiede il piano di oggi, riporta il blocco «PIANO DI OGGI» così com'è, pasto per pasto, senza inventare.
- Sempre sul piano di QUESTO cliente: conosci i suoi 7 giorni, i macro, il diario di oggi, le sue preferenze e restrizioni (sotto). Citali quando servono ("a pranzo di martedì hai…").
- Sostenibilità prima di tutto: piatti sfiziosi, semplici, di tutti i giorni, che il cliente voglia davvero mangiare. Niente ingredienti strani.
- Se per rispondere bene ti manca un dato, fai UNA domanda precisa con 2-4 opzioni ("Per quale pasto? colazione / pranzo / cena"; "Quanto tempo hai: 10 minuti o di più?"; "Cucina o niente fornelli?"). Se puoi rispondere senza, rispondi e basta.

NUMERI (regola ferrea)
- Grammi, kcal e macro NON li inventi: per sostituire un alimento usa trova_alternative, per ogni ricetta o piatto usa crea_ricetta. Riporta i numeri che ti restituiscono, senza ricalcolarli.
- Una ricetta per un pasto deve avere kcal vicine a quelle del pasto del piano che sostituisce (passa kcal_obiettivo) e macro coerenti con il piano.
- Prima di usare uno strumento non scrivere testo. Dopo, commenta in breve il piatto o le alternative (come cucinarle, abbinamenti) e dì a che pasto stanno bene.
- Se il cliente chiede un'alternativa già scelta dal coach (elenco "ALTERNATIVE SCELTE DAL COACH"), parti da quelle.

RESTRIZIONI
- Allergie, intolleranze, cibi che non vuole: mai proposti. Se uno strumento rifiuta un ingrediente, sostituiscilo senza discutere.
- Niente consigli medici, diagnosi, integratori terapeutici: per questi, e per tutto sull'allenamento, rimanda al coach.
- Se il cliente racconta malessere, sintomi, abbuffate fuori controllo o ossessione per il cibo: rispondi con gentilezza, non dare cifre restrittive e invitalo a parlarne col coach.
- Un cliente che ha sgarrato: nessun senso di colpa e nessuna compensazione punitiva; indica come riprendere dal pasto successivo.`

function trimHistory(messages) {
  const m = (Array.isArray(messages) ? messages : []).filter(x => x && (x.role === 'user' || x.role === 'assistant') && String(x.content || '').trim())
    .map(x => ({ role: x.role, content: String(x.content).slice(0, 4000) })).slice(-MAX_HISTORY)
  while (m.length && m[0].role !== 'user') m.shift()
  return m
}

function call(model, system, convo) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1400, stream: true, system, tools: TOOLS, messages: convo }),
  })
}

// legge il flusso di Anthropic: invia il testo man mano e restituisce i blocchi completi (testo e richieste di strumenti)
export async function readStream(resp, onText) {
  const reader = resp.body.getReader(), dec = new TextDecoder()
  let buf = '', stop = null; const blocks = []
  const handle = raw => {
    const line = raw.split('\n').find(l => l.startsWith('data:')); if (!line) return
    let ev; try { ev = JSON.parse(line.slice(5).trim()) } catch { return }
    if (ev.type === 'error') throw new Error(ev.error?.message || 'Errore AI')
    if (ev.type === 'content_block_start') blocks[ev.index] = ev.content_block.type === 'tool_use' ? { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, _json: '' } : { type: 'text', text: '' }
    else if (ev.type === 'content_block_delta') {
      const b = blocks[ev.index]; if (!b) return
      if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; onText(ev.delta.text) }
      else if (ev.delta.type === 'input_json_delta') b._json += ev.delta.partial_json
    } else if (ev.type === 'message_delta') stop = ev.delta?.stop_reason || stop
  }
  for (;;) {
    const { done, value } = await reader.read(); if (done) break
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let i; while ((i = buf.indexOf('\n\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2) }
  }
  if (buf.trim()) handle(buf)
  const content = blocks.filter(Boolean).map(b => {
    if (b.type === 'tool_use') { let input = {}; try { input = b._json ? JSON.parse(b._json) : {} } catch {} return { type: 'tool_use', id: b.id, name: b.name, input } }
    return b
  }).filter(b => b.type !== 'text' || b.text.trim())
  return { content, stop }
}

export default async function handler(req, res) {
  applyCors(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = await guard(req, res, { limit: 20 }); if (!auth) return
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Chiave AI non configurata' })

  const { messages, clientContext } = req.body || {}
  const history = trimHistory(messages)
  if (!history.length) return res.status(400).json({ error: 'Messaggi mancanti' })

  const ctx = clientContext && typeof clientContext === 'object' ? clientContext : {}
  const keys = restrictionKeys(ctx)
  const rome = todayInfo(new Date(), 'Europe/Rome'), ora = ctx.oggi?.ora && /^\d\d:\d\d$/.test(ctx.oggi.ora) ? ctx.oggi.ora : rome.ora
  // il blocco lungo (piano, anamnesi…) resta uguale tra un messaggio e l'altro e si mette in cache; l'ora cambia sempre, quindi sta in un blocco a parte
  const system = [{ type: 'text', text: BASE_PROMPT + '\n\n' + contextToPrompt(ctx, rome).slice(0, 30000), cache_control: { type: 'ephemeral' } }, { type: 'text', text: `ORA ATTUALE: ${ora} (usala per capire quale pasto è il prossimo).` }]
  const convo = history.map(m => ({ role: m.role, content: m.content }))

  // prima chiamata PRIMA di aprire il flusso: se il modello veloce non risponde si riprova con quello principale, e un errore arriva come errore vero (non a metà)
  let model = pickModel(history, { fast: FAST(), main: MAIN() }), first
  try {
    first = await call(model, system, convo)
    if (!first.ok && model !== MAIN()) { model = MAIN(); first = await call(model, system, convo) }
  } catch (e) { return res.status(502).json({ error: 'Servizio AI non raggiungibile' }) }
  if (!first.ok) { let msg = 'Errore AI'; try { msg = (await first.json())?.error?.message || msg } catch {} return res.status(502).json({ error: msg }) }

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' })
  const send = o => { try { res.write('data: ' + JSON.stringify(o) + '\n\n') } catch {} }
  let recipe = null
  try {
    let resp = first
    for (let step = 0; step < MAX_STEPS; step++) {
      if (step > 0) { resp = await call(model, system, convo); if (!resp.ok) { let m = 'Errore AI'; try { m = (await resp.json())?.error?.message || m } catch {} throw new Error(m) } }
      const { content, stop } = await readStream(resp, t => send({ t: 'text', text: t }))
      const uses = content.filter(b => b.type === 'tool_use')
      if (stop !== 'tool_use' || !uses.length) break
      convo.push({ role: 'assistant', content })
      const results = []
      for (const u of uses) {
        send({ t: 'status', text: u.name === 'crea_ricetta' ? 'Calcolo i valori della ricetta…' : 'Cerco le alternative giuste…' })
        const out = runTool(u.name, u.input, { keys })
        if (out.recipe) recipe = out.recipe
        results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out.result) })
      }
      convo.push({ role: 'user', content: results })
    }
    if (recipe) send({ t: 'recipe', recipe })
    send({ t: 'done' })
  } catch (e) { send({ t: 'error', error: 'Non sono riuscito a completare la risposta. Riprova.' }) }
  res.end()
}
