// Domande aggiuntive del report allenamento.
// UNICA fonte: da qui dipendono il modulo del cliente, la vista del coach, il PDF e i "segnali" per aggiornare i piani.
// Per togliere/aggiungere/cambiare una domanda basta modificare questo elenco: le risposte stanno in una sola colonna (answers),
// quindi non serve nessuna modifica al database.
//   type: 'single' (una scelta) | 'multi' (più scelte, max opzionale) | 'scale' (numeri da min a max) | 'text'
//   label = testo per il cliente · short = etichetta compatta per il coach · showIf = domanda mostrata solo se ...

export const SECTIONS = [
  { id: 'allenamento', icon: '🏋️', title: 'Allenamento — più nel dettaglio', hint: 'Domande facoltative, ma ogni risposta mi aiuta ad aggiornare la tua scheda e il tuo piano nel modo giusto.', questions: [
    { id: 'sedute_completate', type: 'single', short: 'Sedute fatte', label: 'Quante sedute hai fatto rispetto a quelle in programma?', options: ['Tutte', 'Quasi tutte (ne ho saltata 1)', 'Circa metà', 'Poche'] },
    { id: 'sedute_saltate_motivo', type: 'multi', short: 'Perché ne ha saltate', label: 'Perché hai saltato delle sedute?', options: ['Poco tempo / impegni', 'Stanchezza', 'Dolore o fastidio', 'Poca motivazione', 'Malattia', 'Viaggio / vacanza', 'Altro'], showIf: a => !!a.sedute_completate && a.sedute_completate !== 'Tutte' },
    { id: 'durata_seduta', type: 'single', short: 'Durata seduta', label: 'Quanto dura in media una seduta?', options: ['Meno di 30 min', '30-45 min', '45-60 min', '60-75 min', 'Più di 75 min'] },
    { id: 'intensita_rpe', type: 'scale', min: 1, max: 10, short: 'Sforzo medio', label: 'Quanto sono state impegnative in media? (1 = leggerissime · 10 = massimo sforzo)' },
    { id: 'scheda_volume', type: 'single', short: 'Volume scheda', label: 'Il numero di serie e ripetizioni ti è sembrato...', options: ['Troppo poco', 'Giusto', 'Troppo'] },
    { id: 'progressione', type: 'single', short: 'Progressione carichi', label: 'Riesci ad aumentare i carichi o le ripetizioni?', options: ['Sì, regolarmente', 'Ogni tanto', 'Faccio fatica', 'No, sono fermo'] },
  ] },
  { id: 'alimentazione', icon: '🥗', title: 'Alimentazione — più nel dettaglio', questions: [
    { id: 'aderenza_piano', type: 'single', short: 'Aderenza al piano', label: 'Quanto hai seguito il piano alimentare?', options: ['Quasi sempre (90% o più)', 'Spesso (70-90%)', 'A volte (50-70%)', 'Poco (meno del 50%)'] },
    { id: 'pesatura', type: 'single', short: 'Pesa gli alimenti', label: 'Hai pesato gli alimenti?', options: ['Sempre', 'Spesso', 'Raramente', 'Mai'] },
    { id: 'sgarri', type: 'single', short: 'Pasti fuori piano / sett.', label: 'Pasti fuori piano a settimana (cene fuori, aperitivi, extra)', options: ['0', '1', '2', '3-4', '5 o più'] },
    { id: 'alcol', type: 'single', short: 'Alcol / sett.', label: 'Bevande alcoliche a settimana', options: ['Nessuna', '1-3', '4-7', 'Più di 7'] },
    { id: 'acqua', type: 'single', short: 'Acqua / giorno', label: 'Acqua al giorno', options: ['Meno di 1 litro', '1-1,5 litri', '1,5-2 litri', 'Più di 2 litri'] },
    { id: 'fame_momento', type: 'multi', short: 'Quando ha più fame', label: 'Quando hai più fame?', options: ['Mattina', 'Metà mattina', 'Pomeriggio', 'Sera', 'Notte', 'Dopo gli allenamenti'] },
    { id: 'digestione', type: 'single', short: 'Digestione', label: 'Digestione e gonfiore', options: ['Ottima', 'Buona', 'Gonfiore frequente', 'Problemi intestinali'] },
    { id: 'cibi_modifiche', type: 'text', short: 'Alimenti da cambiare', label: 'Alimenti del piano da cambiare, o che vorresti inserire', placeholder: 'es. non riesco a mangiare il pesce a cena; vorrei più colazioni dolci...' },
  ] },
  { id: 'recupero', icon: '🩹', title: 'Dolori e sonno', questions: [
    { id: 'dolore_intensita', type: 'scale', min: 0, max: 10, short: 'Dolore max', label: 'Fastidi o dolori: intensità massima nel periodo (0 = nessuno · 10 = fortissimo)' },
    { id: 'dolore_zone', type: 'multi', short: 'Dove', label: 'In quale zona del corpo?', options: ['Schiena lombare', 'Schiena dorsale', 'Collo / cervicale', 'Spalle', 'Gomiti', 'Polsi', 'Anche', 'Ginocchia', 'Caviglie', 'Altro'], showIf: a => Number(a.dolore_intensita) > 0 },
    { id: 'dolore_quando', type: 'multi', short: 'Quando', label: 'Quando si presentano?', options: ['Durante gli esercizi', 'Dopo gli allenamenti', 'Al risveglio', 'Stando seduto a lungo', 'Di notte'], showIf: a => Number(a.dolore_intensita) > 0 },
    { id: 'dolore_esercizi', type: 'text', short: 'Esercizi che lo provocano', label: 'Quali esercizi lo provocano o lo peggiorano?', placeholder: 'es. stacchi, squat con il bilanciere...', showIf: a => Number(a.dolore_intensita) > 0 },
    { id: 'sonno_ore', type: 'single', short: 'Ore di sonno', label: 'Ore di sonno medie per notte', options: ['Meno di 5', '5-6', '6-7', '7-8', 'Più di 8'] },
  ] },
  { id: 'corpo', icon: '📏', title: 'Corpo e risultati', questions: [
    { id: 'specchio', type: 'single', short: 'Allo specchio', label: 'Come ti vedi allo specchio rispetto a inizio periodo?', options: ['Meglio', 'Uguale', 'Peggio'] },
    { id: 'vestiti', type: 'single', short: 'Vestiti', label: 'Come ti stanno i vestiti?', options: ['Più larghi', 'Uguali', 'Più stretti'] },
    { id: 'ciclo', type: 'single', short: 'Ciclo mestruale', label: 'Ciclo mestruale (facoltativo)', options: ['Regolare', 'Irregolare', 'Assente / menopausa', 'Preferisco non rispondere', 'Non applicabile'] },
  ] },
  { id: 'prossime', icon: '🎯', title: 'Prossime settimane', questions: [
    { id: 'priorita', type: 'multi', max: 3, short: 'Priorità', label: 'Cosa vuoi migliorare di più? (scegli fino a 3)', options: ['Perdere grasso', 'Aumentare massa muscolare', 'Forza', 'Energia', 'Postura e dolori', 'Costanza', 'Alimentazione più semplice'] },
    { id: 'sedute_prossime', type: 'single', short: 'Sedute a settimana', label: 'Quante sedute a settimana riesci a fare?', options: ['1-2', '3', '4', '5 o più'] },
    { id: 'tempo_prossime', type: 'single', short: 'Tempo per seduta', label: 'Quanto tempo hai per ogni seduta?', options: ['Meno di 30 min', '30-45 min', '45-60 min', 'Più di 60 min'] },
    { id: 'impegni', type: 'text', short: 'Impegni in arrivo', label: 'Viaggi, impegni o periodi particolari in arrivo?', placeholder: 'es. ferie dal 10 al 20, esami, trasferte di lavoro...' },
  ] },
]

export const ALL_QUESTIONS = SECTIONS.flatMap(s => s.questions.map(q => ({ ...q, section: s.id })))
export const isVisible = (q, a) => !q.showIf || !!q.showIf(a || {})
const empty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

// Risposte pronte da salvare: solo domande note, visibili e con una risposta
export function cleanAnswers(a = {}) {
  const out = {}
  for (const q of ALL_QUESTIONS) {
    if (!isVisible(q, a)) continue
    const v = a[q.id]; if (empty(v)) continue
    if (q.type === 'scale') { const n = Number(v); if (Number.isFinite(n)) out[q.id] = n }
    else if (q.type === 'multi') { const arr = (Array.isArray(v) ? v : [v]).filter(x => q.options.includes(x)).slice(0, q.max || 99); if (arr.length) out[q.id] = arr }
    else if (q.type === 'single') { if (q.options.includes(v)) out[q.id] = v }
    else { const t = String(v).trim(); if (t) out[q.id] = t }
  }
  return out
}
export const hasAnswers = a => Object.keys(cleanAnswers(a || {})).length > 0

export function formatAnswer(q, v) {
  if (q.type === 'scale') return `${v}/${q.max}`
  if (q.type === 'multi') return (Array.isArray(v) ? v : [v]).join(', ')
  return String(v)
}
// Per la vista del coach / PDF: solo ciò che ha risposto
export function answersForDisplay(a = {}) {
  const clean = cleanAnswers(a)
  return SECTIONS.map(s => ({ id: s.id, icon: s.icon, title: s.title, items: s.questions.filter(q => clean[q.id] !== undefined).map(q => ({ id: q.id, label: q.short, text: formatAnswer(q, clean[q.id]) })) })).filter(s => s.items.length)
}

// ── Segnali per aggiornare i piani ───────────────────────────
// level: red (urgente) · amber (da valutare) · info.  area: Allenamento | Salute e recupero | Alimentazione | Risultati | Prossime settimane
const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null }
const LEVEL = { red: 0, amber: 1, info: 2 }
export function reportSignals(r = {}, ctx = {}) {
  const a = cleanAnswers(r.answers || {}), out = [], goal = String(ctx.goal || '').toLowerCase()
  const add = (level, area, text) => out.push({ level, area, text })
  const has = (k, ...vals) => vals.includes(a[k])
  const incl = (k, v) => Array.isArray(a[k]) && a[k].includes(v)
  // Allenamento
  if (has('sedute_completate', 'Circa metà', 'Poche')) add('amber', 'Allenamento', `Sedute completate: ${a.sedute_completate.toLowerCase()} — valuta meno sedute o più brevi`)
  if (incl('sedute_saltate_motivo', 'Dolore o fastidio')) add('amber', 'Allenamento', 'Ha saltato sedute per dolore o fastidio')
  if (a.intensita_rpe >= 9) add('amber', 'Allenamento', `Sforzo percepito molto alto (${a.intensita_rpe}/10) — valuta di ridurre volume o intensità`)
  else if (a.intensita_rpe !== undefined && a.intensita_rpe <= 4) add('info', 'Allenamento', `Sforzo percepito basso (${a.intensita_rpe}/10) — puoi alzare carichi o volume`)
  if (has('scheda_volume', 'Troppo')) add('amber', 'Allenamento', 'Volume della scheda percepito eccessivo')
  if (has('scheda_volume', 'Troppo poco')) add('info', 'Allenamento', 'Volume della scheda percepito basso — puoi aggiungere serie')
  if (has('progressione', 'Faccio fatica', 'No, sono fermo')) add('amber', 'Allenamento', `Progressione: "${a.progressione}" — valuta uno scarico (deload) o una progressione diversa`)
  // Salute e recupero
  if (a.dolore_intensita >= 3) {
    const det = [a.dolore_zone && `zone: ${a.dolore_zone.join(', ')}`, a.dolore_quando && `quando: ${a.dolore_quando.join(', ').toLowerCase()}`, a.dolore_esercizi && `esercizi: ${a.dolore_esercizi}`].filter(Boolean).join(' · ')
    add(a.dolore_intensita >= 6 ? 'red' : 'amber', 'Salute e recupero', `Dolore ${a.dolore_intensita}/10${det ? ' — ' + det : ''}`)
  }
  if (r.qualita_recupero === 'Scarso') add('amber', 'Salute e recupero', 'Recupero tra le sedute scarso')
  if (r.doms === 'Invalidanti') add('amber', 'Salute e recupero', 'DOMS invalidanti — riduci il volume')
  if (has('sonno_ore', 'Meno di 5', '5-6')) add('amber', 'Salute e recupero', `Sonno insufficiente (${a.sonno_ore} ore)`)
  if (num(r.stress_periodo) >= 8) add('amber', 'Salute e recupero', `Stress alto (${r.stress_periodo}/10)`)
  if (num(r.benessere_generale) !== null && num(r.benessere_generale) <= 4) add('amber', 'Salute e recupero', `Benessere generale basso (${r.benessere_generale}/10)`)
  // Alimentazione
  if (has('aderenza_piano', 'A volte (50-70%)', 'Poco (meno del 50%)')) add('amber', 'Alimentazione', `Aderenza al piano bassa (${a.aderenza_piano.toLowerCase()}) — semplifica o adatta il piano`)
  if (has('sgarri', '3-4', '5 o più')) add('amber', 'Alimentazione', `Pasti fuori piano a settimana: ${a.sgarri}`)
  if (has('alcol', '4-7', 'Più di 7')) add('amber', 'Alimentazione', `Alcol: ${a.alcol.toLowerCase()} a settimana`)
  if (has('acqua', 'Meno di 1 litro')) add('info', 'Alimentazione', 'Beve meno di 1 litro di acqua al giorno')
  if (r.fame_saziet === 'Troppa fame') add('amber', 'Alimentazione', 'Troppa fame durante il piano — valuta fibre, volume dei pasti o una diversa distribuzione')
  if (incl('fame_momento', 'Sera') || incl('fame_momento', 'Notte')) add('info', 'Alimentazione', 'Fame serale o notturna — valuta di spostare calorie a cena o aggiungere uno spuntino')
  if (has('digestione', 'Gonfiore frequente', 'Problemi intestinali')) add('amber', 'Alimentazione', `Digestione: ${a.digestione.toLowerCase()}`)
  if (a.cibi_modifiche) add('info', 'Alimentazione', `Alimenti da cambiare o inserire: ${a.cibi_modifiche}`)
  // Risultati
  const p0 = num(r.peso_inizio), p1 = num(r.peso_fine)
  if (p0 !== null && p1 !== null) {
    const d = Math.round((p1 - p0) * 10) / 10
    if (/dimagr|ricomp|definiz/.test(goal) && d >= 0.2) add('amber', 'Risultati', `Peso ${d > 0 ? '+' : ''}${d} kg con obiettivo dimagrimento — rivedi kcal e aderenza`)
    else if (/massa/.test(goal) && d <= -0.3) add('amber', 'Risultati', `Peso ${d} kg con obiettivo massa — valuta più calorie`)
    else add('info', 'Risultati', `Peso ${d > 0 ? '+' : ''}${d} kg nel periodo`)
  }
  if (has('specchio', 'Peggio')) add('amber', 'Risultati', 'Si vede peggio allo specchio')
  if (has('vestiti', 'Più stretti') && /dimagr|ricomp|definiz/.test(goal)) add('amber', 'Risultati', 'I vestiti sono più stretti con obiettivo dimagrimento')
  // Prossime settimane
  if (a.priorita) add('info', 'Prossime settimane', `Priorità: ${a.priorita.join(', ').toLowerCase()}`)
  if (a.sedute_prossime || a.tempo_prossime) add('info', 'Prossime settimane', `Disponibilità: ${[a.sedute_prossime && `${a.sedute_prossime} sedute a settimana`, a.tempo_prossime && `${a.tempo_prossime.toLowerCase()} per seduta`].filter(Boolean).join(' · ')}`)
  if (a.impegni) add('info', 'Prossime settimane', `Impegni in arrivo: ${a.impegni}`)
  return out.sort((x, y) => LEVEL[x.level] - LEVEL[y.level])
}

// ── HTML per il PDF (stesse classi del PDF del report) ──
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function reportExtraHtml(r = {}, ctx = {}) {
  let h = ''
  const sig = reportSignals(r, ctx).filter(s => s.level !== 'info' || true)
  if (sig.length) {
    h += '<div class="sec"><div class="st">🎯 Segnali per aggiornare i piani</div><div class="box">'
    sig.forEach(s => { h += `<div class="row"><span class="k">${s.level === 'red' ? '🔴' : s.level === 'amber' ? '🟠' : '⚪'} ${esc(s.area)}</span><span class="v">${esc(s.text)}</span></div>` })
    h += '</div></div>'
  }
  answersForDisplay(r.answers || {}).forEach(sec => {
    h += `<div class="sec"><div class="st">${sec.icon} ${esc(sec.title)}</div><div class="box">`
    sec.items.forEach(i => { h += `<div class="row"><span class="k">${esc(i.label)}</span><span class="v">${esc(i.text)}</span></div>` })
    h += '</div></div>'
  })
  return h
}
