// ─────────────────────────────────────────────────────────────
// Assistente nutrizionale: cosa sa del cliente.
//  • buildContext: dalle righe del database (piano intero, anamnesi, diario di oggi, peso, allenamenti) a un oggetto compatto
//  • contextToPrompt: l'oggetto diventa il testo che legge l'AI (tutti e 7 i giorni, con kcal e macro, alternative del coach, note)
//  • allergeni: parole di allergie/intolleranze → blocchi RIGIDI (l'app toglie quegli alimenti dalle proposte, non solo "chiede" all'AI di evitarli)
//  • pickModel: domande semplici → modello veloce
// Niente import: lo usano sia la pagina sia il server (api/ai-coach.js).
// ─────────────────────────────────────────────────────────────
const DAY = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const p2 = n => String(n).padStart(2, '0')
const txt = v => (Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v ?? '')).replace(/\s+/g, ' ').trim()
const nz = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }
const r1 = v => Math.round(nz(v) * 10) / 10
const cut = (t, n) => (String(t || '').length > n ? String(t).slice(0, n - 1) + '…' : String(t || ''))
const kcalFromMacros = f => (nz(f.protein_g) > 0 || nz(f.carbs_g) > 0 || nz(f.fat_g) > 0) ? Math.round(nz(f.protein_g) * 4 + nz(f.carbs_g) * 4 + nz(f.fat_g) * 9) : Math.round(nz(f.kcal))
const lead = stems => new RegExp('(?:^|[^a-zà-ù])(?:' + stems + ')', 'i')

// ── allergeni e intolleranze (blocco rigido) ──────────────────
// trigger: parole che il cliente ha scritto in anamnesi · foods: alimenti da non proporre · ok: eccezioni (es. «senza lattosio»)
export const ALLERGENI = [
  { key: 'glutine', label: 'glutine', trigger: lead('glutin|celiac'), foods: lead('pasta|pastina|spaghett|penne|pennette|fusilli|rigatoni|maccheron|tagliatell|tagliolin|lasagn|ravioli|tortellin|cannelloni|orecchiett|bucatini|linguine|conchigli|farfalle|ditalini|noodles|udon|ramen|pizzocher|pane|pan |panin|panett|pandoro|colomba|bauletto|brioss|krapfen|cookies|rustici|tuc|crusca|farina|impanat|cotolett|nuggets|birra|toast|piadina|wrap|tortilla|farro|orzo|cous ?cous|cus ?cus|seitan|semola|frumento|grano|segale|kamut|spelta|fette biscottate|cracker|grissini|biscott|gnocchi|pizza|focaccia|pangrattato|muesli|granola|avena|corn ?flakes|cereali|special k|bulgur|taralli|crostini|croissant|brioche|cornetto|merendin|wafer|tramezzin|besciamella'), ok: /senza glutine|gluten free|di riso|di mais|riso|mais|saraceno|quinoa/i },
  { key: 'lattosio', label: 'lattosio / latticini', trigger: lead('lattosio|latte|latticin|caseina'), foods: lead('latte|yogurt|skyr|kefir|formagg|ricotta|mozzarella|burrata|parmigiano|grana|pecorino|mascarpone|philadelphia|stracchino|crescenza|fiocchi di latte|quark|panna|burro|gelato|budino|fontina|gorgonzola|asiago|provolone|scamorza|emmental|feta|halloumi|caciotta|robiola|cottage|besciamella|whey|siero|caseina|nutella'), ok: /senza lattosio|delattosat|zero lattosio|lactose free|vegetal|soia|mandorl|avena|di riso|cocco|burro di (arachidi|mandorle|cacao)/i },
  { key: 'uova', label: 'uova', trigger: lead('uov|uova|albume|tuorlo'), foods: lead('uov|uova|albume|tuorlo|frittata|maionese|omelette'), ok: null },
  { key: 'arachidi', label: 'arachidi', trigger: lead('arachid|noccioline'), foods: lead('arachid|noccioline|peanut'), ok: null },
  { key: 'guscio', label: 'frutta a guscio', trigger: lead('guscio|noci|nocciol|mandorl|pistacch|anacard'), foods: lead('noci|noce|nocciol|mandorl|pistacch|anacard|pinoli|nutella|frutta secca|mix frutta'), ok: /cocco|noce moscata/i },
  { key: 'crostacei', label: 'crostacei e molluschi', trigger: lead('crostace|mollusc|gamber|scamp|frutti di mare|cozz|vongol'), foods: lead('gamber|scamp|aragost|granch|astice|mazzancoll|cozz|vongol|calamar|polp|seppi|totan|ostric|capesant|frutti di mare|crostace|mollusc'), ok: null },
  { key: 'pesce', label: 'pesce', trigger: lead('pesce'), foods: lead('pesce|tonno|salmone|merluzz|nasello|orata|branzin|sogliol|spigola|trota|sgombro|acciug|alici|baccal|stoccafisso|sardin|platessa|halibut|persico|dentice|cernia|pangasio|tilapia|surimi'), ok: null, cat: 'Pesce' },
  { key: 'soia', label: 'soia', trigger: lead('soia'), foods: lead('soia|tofu|edamame|tempeh|miso'), ok: null },
  { key: 'sesamo', label: 'sesamo', trigger: lead('sesamo|tahin'), foods: lead('sesamo|tahin|gomasio'), ok: null },
]
// «glutine, lattosio» → ['glutine','lattosio']  (con "no", "nessuna", "/" non scatta nulla; se c'è un dubbio si blocca: meglio troppo che poco)
export function allergenKeys(text) {
  const t = String(Array.isArray(text) ? text.join(', ') : text || '')
  return ALLERGENI.filter(a => a.trigger.test(t)).map(a => a.key)
}
// perché un alimento non va proposto (null = va bene)
export function blockedBy(food, keys) {
  if (!keys || !keys.length) return null
  const name = String(food?.name || food?.food_name || food || ''), cat = food?.cat
  for (const a of ALLERGENI) {
    if (!keys.includes(a.key)) continue
    if (a.ok && a.ok.test(name)) continue
    if (a.foods.test(name) || (a.cat && cat === a.cat)) return a.label
  }
  return null
}

// ── che giorno è oggi ─────────────────────────────────────────
// Nel piano il lunedì è il giorno 1 e la domenica il 7 (come in «Piano alimentare»). Senza fuso usa l'orologio del telefono; con tz (es. 'Europe/Rome') quello del server.
export function todayInfo(d = new Date(), tz = null) {
  let y, m, day, wd, hh, mm
  if (tz) {
    const P = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]))
    y = +P.year; m = +P.month; day = +P.day; wd = WD.indexOf(P.weekday); hh = +P.hour % 24; mm = +P.minute
  } else { y = d.getFullYear(); m = d.getMonth() + 1; day = d.getDate(); wd = d.getDay(); hh = d.getHours(); mm = d.getMinutes() }
  const n = ((wd + 6) % 7) + 1
  return { data: `${y}-${p2(m)}-${p2(day)}`, n, giorno: DAY[n - 1], label: `${DAY[n - 1]} ${day} ${MESI[m - 1]} ${y}`, ora: `${p2(hh)}:${p2(mm)}`, domani: { n: (n % 7) + 1, giorno: DAY[n % 7] }, ieri: { n: ((n + 5) % 7) + 1, giorno: DAY[(n + 5) % 7] } }
}

// ── costruzione del contesto (lato pagina) ────────────────────
// rows: { profile, plan, meals (plan_meals con plan_meal_foods), anamnesi, diary (voci di oggi), progress (ultime misure, dalla più recente), workoutPlan, workoutDays, sessions }
export function buildContext({ profile, plan, meals, anamnesi, diary, progress, workoutPlan, workoutDays, sessions, now } = {}) {
  const A = anamnesi || {}
  const giorni = []
  const alt = new Map()
  for (let d = 1; d <= 7; d++) {
    const dm = (meals || []).filter(m => m.day_of_week === d).sort((a, b) => nz(a.meal_order) - nz(b.meal_order))
    if (!dm.length) continue
    giorni.push({
      giorno: DAY[d - 1], pasti: dm.map(m => ({
        tipo: m.meal_type, nota: txt(m.coach_note || m.note_pasto),
        alimenti: [...(m.plan_meal_foods || [])].sort((a, b) => nz(a.sort_order) - nz(b.sort_order)).map(f => {
          const names = (Array.isArray(f.alternatives) ? f.alternatives : []).map(x => x?.name).filter(Boolean)
          if (names.length && !alt.has(f.food_name)) alt.set(f.food_name, names)
          return { n: f.food_name, g: nz(f.quantity_g), k: kcalFromMacros(f), p: r1(f.protein_g), c: r1(f.carbs_g), gr: r1(f.fat_g) }
        }),
      })),
    })
  }
  const dl = diary || []
  const tot = dl.reduce((a, e) => ({ kcal: a.kcal + nz(e.kcal), p: a.p + nz(e.protein_g), c: a.c + nz(e.carbs_g), g: a.g + nz(e.fat_g) }), { kcal: 0, p: 0, c: 0, g: 0 })
  return {
    oggi: todayInfo(now || new Date()),
    nome: txt(profile?.full_name), obiettivo: txt(profile?.goal || A.obiettivo),
    target: { kcal: nz(plan?.kcal_target) || null, p: nz(plan?.protein_target_g) || null, c: nz(plan?.carbs_target_g) || null, g: nz(plan?.fat_target_g) || null },
    pianoNote: txt(plan?.notes),
    piano: giorni.length ? { giorni, alternative: [...alt].map(([n, a]) => ({ n, a })) } : null,
    anamnesi: {
      allergie: txt(A.allergie_alimentari), intolleranze: txt(A.intolleranze_diagnosticate), reazioni: txt(A.reazioni_avverse_cibi),
      nonVuole: txt([A.proteine_non_vuole, A.verdure_no, A.cibi_critici, A.alimenti_evitati_per_paura]),
      preferiti: txt([A.piatti_preferiti, A.pasti_preferiti, A.verdure_ok, A.cibi_non_togliere]),
      gonfiano: txt(A.cibi_gonfiano), regole: txt(A.regole_alimentari),
      chiCucina: txt(A.chi_cucina), tempo: txt(A.tempo_preparazione_pasti), fuori: txt([A.mangia_fuori, A.porta_pasti_lavoro]),
      diagnosi: txt([A.diagnosi_attive, A.indicazioni_mediche_dettaglio || A.indicazioni_mediche]), gravidanza: txt(A.gravidanza_allattamento),
    },
    diario: { kcal: Math.round(tot.kcal), p: Math.round(tot.p), c: Math.round(tot.c), g: Math.round(tot.g), voci: dl.slice(0, 40).map(e => ({ pasto: e.meal_type, n: e.food_name, g: nz(e.quantity_g), k: Math.round(nz(e.kcal)) })) },
    peso: (progress || []).slice(0, 8).map(p => ({ d: p.entry_date, kg: nz(p.weight_kg) || null, vita: nz(p.waist_cm) || null })).filter(p => p.kg || p.vita),
    allenamenti: { scheda: txt(workoutPlan?.title), giorni: [...new Set((workoutDays || []).filter(Boolean))].slice(0, 8), ultimi: (sessions || []).slice(0, 6).map(s => s.session_date).filter(Boolean) },
  }
}

// parole dell'anamnesi → chiavi dei blocchi rigidi
export const restrictionKeys = ctx => allergenKeys([ctx?.anamnesi?.allergie, ctx?.anamnesi?.intolleranze, ctx?.anamnesi?.reazioni])

// ── testo per l'AI ────────────────────────────────────────────
const dayIndex = name => DAY.indexOf(name) + 1
function dayText(g, tag = '') {
  let dk = 0, dp = 0, dc = 0, dg = 0
  const pasti = g.pasti.map(p => {
    const k = p.alimenti.reduce((a, f) => a + f.k, 0); dk += k
    p.alimenti.forEach(f => { dp += f.p; dc += f.c; dg += f.gr })
    return `  ${p.tipo} (${k} kcal)${p.nota ? ` — nota: ${cut(p.nota, 160)}` : ''}: ` + p.alimenti.map(f => `${f.n} ${f.g}g [${f.k} kcal P${f.p} C${f.c} G${f.gr}]`).join('; ')
  }).join('\n')
  return `${g.giorno.toUpperCase()}${tag} — totale ${Math.round(dk)} kcal · P${Math.round(dp)} C${Math.round(dc)} G${Math.round(dg)}\n${pasti}`
}
export function planText(piano, oggi = null) {
  if (!piano || !piano.giorni?.length) return 'Nessun piano alimentare attivo.'
  return piano.giorni.map(g => {
    const n = dayIndex(g.giorno)
    return dayText(g, oggi && n === oggi.n ? ' (OGGI)' : oggi && n === oggi.domani?.n ? ' (DOMANI)' : '')
  }).join('\n\n')
}

export function contextToPrompt(ctx = {}, fallbackToday = null) {
  const A = ctx.anamnesi || {}, T = ctx.target || {}, keys = restrictionKeys(ctx)
  const oggi = ctx.oggi?.n >= 1 && ctx.oggi?.n <= 7 ? ctx.oggi : fallbackToday
  const line = (label, v) => (v ? `- ${label}: ${cut(v, 400)}\n` : '')
  let out = ''
  if (oggi) {
    const today = ctx.piano?.giorni?.find(g => dayIndex(g.giorno) === oggi.n)
    out += `OGGI È ${String(oggi.label || oggi.giorno).toUpperCase()} → giorno ${oggi.n} del piano. Domani è ${oggi.domani?.giorno}, ieri era ${oggi.ieri?.giorno}.\n`
    out += 'Quando il cliente dice "oggi", "stasera", "domani", "ieri" o non indica il giorno, vale SEMPRE questa data: non usare mai lunedì per default e non scegliere un altro giorno.\n\n'
    out += `PIANO DI OGGI (${oggi.giorno})\n` + (today ? dayText(today) : `Il piano non ha pasti per ${oggi.giorno}: dillo, non inventarli.`) + '\n\n'
  }
  out += `PROFILO CLIENTE\n- Nome: ${cut(ctx.nome, 60) || 'Cliente'}\n- Obiettivo: ${cut(ctx.obiettivo, 200) || 'non specificato'}\n- Target giornaliero: ${T.kcal || '—'} kcal · P ${T.p || '—'} g · C ${T.c || '—'} g · G ${T.g || '—'} g\n`
  if (ctx.pianoNote) out += `- Note del coach sul piano: ${cut(ctx.pianoNote, 600)}\n`
  out += '\n'
  // RESTRIZIONI: in cima, perché vengono prima di tutto
  const hard = [A.allergie && `allergie: ${A.allergie}`, A.intolleranze && `intolleranze: ${A.intolleranze}`, A.reazioni && `reazioni avverse: ${A.reazioni}`].filter(Boolean)
  out += 'RESTRIZIONI (da rispettare sempre)\n'
  out += hard.length ? `- ALLERGIE/INTOLLERANZE dichiarate: ${cut(hard.join(' · '), 500)}. Non proporre MAI questi alimenti, nemmeno "in piccole quantità". Gli strumenti li escludono già; se un ingrediente ti viene rifiutato, sostituiscilo.\n` : '- Nessuna allergia o intolleranza dichiarata.\n'
  out += line('Non vuole / evita', A.nonVuole) + line('Cibi che gli danno gonfiore', A.gonfiano) + line('Regole alimentari personali', A.regole)
  out += line('Diagnosi e indicazioni mediche (non dare consigli medici: rimanda al coach)', A.diagnosi) + line('Gravidanza / allattamento', A.gravidanza)
  out += '\nPREFERENZE E VITA REALE\n' + (line('Piatti e cibi che ama', A.preferiti) + line('Chi cucina', A.chiCucina) + line('Tempo per preparare i pasti', A.tempo) + line('Pasti fuori casa / al lavoro', A.fuori) || '- (non indicato)\n')
  out += `\nPIANO ALIMENTARE ATTIVO (tutti i giorni; valori per la quantità indicata, alimenti crudi/secchi dove non scritto diversamente)\n${planText(ctx.piano, oggi)}\n`
  if (ctx.piano?.alternative?.length) out += `\nALTERNATIVE SCELTE DAL COACH (hanno la precedenza quando il cliente chiede un cambio)\n` + ctx.piano.alternative.slice(0, 60).map(x => `- ${x.n}: ${x.a.slice(0, 12).join(', ')}`).join('\n') + '\n'
  const D = ctx.diario
  if (D) out += `\nDIARIO DI OGGI\n` + (D.voci?.length ? `- Già mangiato: ${D.kcal} kcal · P${D.p} C${D.c} G${D.g}${T.kcal ? ` — restano circa ${Math.max(0, T.kcal - D.kcal)} kcal` : ''}\n` + D.voci.map(v => `  · ${v.pasto}: ${v.n} ${v.g}g (${v.k} kcal)`).join('\n') + '\n' : '- Oggi non ha ancora registrato nulla nel diario.\n')
  if (ctx.peso?.length) out += `\nPESO E MISURE (dalla più recente)\n` + ctx.peso.map(p => `- ${p.d}: ${p.kg ? p.kg + ' kg' : ''}${p.vita ? ` · vita ${p.vita} cm` : ''}`).join('\n') + '\n'
  const W = ctx.allenamenti
  if (W && (W.scheda || W.ultimi?.length)) out += `\nALLENAMENTO\n- Scheda: ${W.scheda || '—'}${W.giorni?.length ? ` (giorni: ${W.giorni.join(', ')})` : ''}\n${W.ultimi?.length ? `- Ultime sedute: ${W.ultimi.join(', ')}\n` : ''}`
  return out
}

// ── modello: veloce per le domande semplici ───────────────────
const COMPLEX = /ricett|sostitu|alternativ|cambia|cambiar|al posto|analizz|bilanci|menu|menù|settimana|calcol|macro|cucin|prepar|ristorante|pizza|fuori|sgarr|spesa|lista|proposta|piatto|idea|combin|quanto (devo|posso)|quanti|grammi/i
export function pickModel(history, { fast, main } = {}) {
  const last = [...(history || [])].reverse().find(m => m.role === 'user')
  const t = String(last?.content || '')
  const simple = t.length > 0 && t.length <= 120 && !COMPLEX.test(t)
  return simple ? fast : main
}
