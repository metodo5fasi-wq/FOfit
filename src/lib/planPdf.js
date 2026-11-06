// ─────────────────────────────────────────────────────────────
// PDF del piano alimentare — stessa grafica di anamnesi e report (intestazione scura, titoli arancioni, piè di pagina FOfit)
// Pagina 1: profilo, obiettivi, riepilogo settimanale e note · una pagina per ogni giorno · ultima pagina: alimenti della settimana
// Le kcal sono la somma di quelle degli alimenti (come nella pagina del piano del cliente).
// ─────────────────────────────────────────────────────────────

export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const GOAL_LABEL = { dimagrimento: 'Dimagrimento', massa: 'Massa muscolare', ricomposizione: 'Ricomposizione corporea', mantenimento: 'Mantenimento', forza: 'Forza' }
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const fmt = (n, d = 0) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const initials = n => n ? n.split(' ').filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() : '?'

// ── calcoli ──────────────────────────────────────────────────
export function foodTotals(foods = []) {
  const t = { kcal: 0, p: 0, c: 0, g: 0 }
  foods.forEach(f => {
    const p = num(f.protein_g), c = num(f.carbs_g), g = num(f.fat_g), k = num(f.kcal)
    t.kcal += k > 0 ? k : p * 4 + c * 4 + g * 9; t.p += p; t.c += c; t.g += g
  })
  return t
}
export function groupByDay(meals = []) {
  const out = {}; for (let d = 1; d <= 7; d++) out[d] = []
  ;[...meals].sort((a, b) => (a.meal_order ?? 0) - (b.meal_order ?? 0)).forEach(m => { if (out[m.day_of_week]) out[m.day_of_week].push(m) })
  return out
}
export function dayTotals(dayMeals = []) { return foodTotals(dayMeals.flatMap(m => m.plan_meal_foods || [])) }
export function weekSummary(byDay) {
  const days = []; for (let d = 1; d <= 7; d++) { const meals = byDay[d] || []; days.push({ day: d, name: DAY_NAMES[d - 1], meals: meals.length, ...dayTotals(meals) }) }
  const filled = days.filter(d => d.meals > 0), n = filled.length || 1
  const avg = { kcal: filled.reduce((s, d) => s + d.kcal, 0) / n, p: filled.reduce((s, d) => s + d.p, 0) / n, c: filled.reduce((s, d) => s + d.c, 0) / n, g: filled.reduce((s, d) => s + d.g, 0) / n }
  return { days, avg, filledDays: filled.length }
}
// Alimenti della settimana (somma delle quantità per alimento): serve anche come base per la spesa
export function weekFoods(meals = []) {
  const map = new Map()
  meals.forEach(m => (m.plan_meal_foods || []).forEach(f => {
    const name = String(f.food_name || '').trim(); if (!name) return
    const key = name.toLowerCase() + '|' + String(f.brand || '').toLowerCase()
    const e = map.get(key) || { name, brand: f.brand && f.brand !== '—' ? f.brand : '', grams: 0, times: 0, days: new Set() }
    e.grams += num(f.quantity_g); e.times += 1; e.days.add(m.day_of_week); map.set(key, e)
  }))
  return [...map.values()].map(e => ({ name: e.name, brand: e.brand, grams: e.grams, times: e.times, days: e.days.size })).sort((a, b) => b.grams - a.grams)
}
export const bmi = (kg, cm) => (kg > 0 && cm > 0) ? Math.round(kg / ((cm / 100) ** 2) * 10) / 10 : null
const pctOf = (v, t) => t > 0 ? Math.round(v / t * 100) : null
const tone = pct => pct == null ? '#888780' : Math.abs(pct - 100) <= 5 ? '#3B6D11' : Math.abs(pct - 100) <= 10 ? '#B7791F' : '#C0392B'

// ── pagina HTML ──────────────────────────────────────────────
const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;font-size:13px}
.header{background:linear-gradient(135deg,#1A1A1A,#2D2D2D);color:white;padding:28px 36px 24px}.brand{font-size:22px;font-weight:900;margin-bottom:20px;display:flex;justify-content:space-between}.brand span{color:#D4570A}.brand-meta{font-size:11px;opacity:0.6;text-align:right;font-weight:400}
.av{width:44px;height:44px;border-radius:50%;background:#D4570A;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;margin-right:10px;vertical-align:middle}.cn{font-size:19px;font-weight:800;vertical-align:middle}.cs{font-size:12px;opacity:0.6;margin-top:6px}
.bp{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.5);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-left:10px;vertical-align:middle}
.body{padding:26px 36px}.sec{margin-bottom:22px}.st{font-size:11px;font-weight:700;color:#D4570A;text-transform:uppercase;letter-spacing:0.1em;border-bottom:2px solid #FEF0E7;padding-bottom:6px;margin-bottom:12px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.box{background:#F8F7F5;border-radius:10px;padding:14px;margin-bottom:8px;border:0.5px solid #EEECE8}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid #EEECE8;font-size:12px}.row:last-child{border-bottom:none}.k{color:#888780}.v{font-weight:600}
.tile{background:#F8F7F5;border:0.5px solid #EEECE8;border-radius:10px;padding:12px;text-align:center}.tile b{display:block;font-size:22px;font-weight:800;color:#111;line-height:1.1}.tile small{display:block;font-size:10px;color:#888780;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em}.tile i{display:block;font-style:normal;font-size:10px;color:#D4570A;margin-top:3px;font-weight:700}
.bar{display:flex;height:10px;border-radius:6px;overflow:hidden;margin:12px 0 6px}.leg{display:flex;gap:16px;font-size:11px;color:#555}.leg span:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:var(--c)}
table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#888780;padding:6px 8px;border-bottom:1.5px solid #E5E2DC}td{padding:7px 8px;border-bottom:0.5px solid #EEECE8}td.n,th.n{text-align:right;white-space:nowrap}tr.tot td{font-weight:800;border-top:1.5px solid #E5E2DC;border-bottom:none;background:#FAF9F7}
.day{page-break-before:always}.dh{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px}.dh h2{font-size:24px;font-weight:900;letter-spacing:-0.5px}.dh h2 span{color:#D4570A}.dh p{font-size:11px;color:#888780}
.meal{border:0.5px solid #E5E2DC;border-radius:12px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid}.mh{background:#F8F7F5;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid #E5E2DC}.mh strong{font-size:13px;text-transform:capitalize}.mh span{font-size:11px;color:#555}.mh em{font-style:normal;color:#D4570A;font-weight:700}
.note{background:#FFF8F5;border:1px solid #FDDCC4;border-radius:10px;padding:12px;font-size:12px;line-height:1.7;color:#444;font-style:italic;margin-top:6px}.mn{padding:8px 12px 10px;font-size:11px;color:#555;line-height:1.6;background:#FFF8F5;border-top:0.5px solid #FDDCC4;white-space:pre-wrap}
.sub{font-size:10px;color:#888780}.footer{margin-top:24px;padding:14px 36px;background:#F8F7F5;border-top:0.5px solid #EEECE8;display:flex;justify-content:space-between;font-size:10px;color:#888780}.footer strong{color:#D4570A}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm 0}.header{margin-top:-10mm;padding-top:38px}}`

export function buildPlanHtml({ plan = {}, meals = [], client = {}, weight = null }) {
  const name = client.full_name || 'Cliente', byDay = groupByDay(meals), sum = weekSummary(byDay)
  const kt = num(plan.kcal_target), pt = num(plan.protein_target_g), ct = num(plan.carbs_target_g), gt = num(plan.fat_target_g)
  const created = plan.created_at ? new Date(plan.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const head = (sub) => `<div class="header"><div class="brand"><div>FO<span>fit</span></div><div class="brand-meta">Federico Obinu · Coach<br>fofit.fit</div></div><div><div class="av">${esc(initials(name))}</div><span class="cn">${esc(name)}</span><span class="bp">Piano alimentare</span></div><div class="cs">${esc(sub)}</div></div>`
  const sub = [plan.title, plan.week_number ? `Settimana ${plan.week_number}` : null, created ? `Creato il ${created}` : null].filter(Boolean).join(' · ')
  let h = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Piano alimentare — ${esc(name)}</title><style>${CSS}</style></head><body>`
  h += head(sub)
  // ── pagina 1 ──
  h += '<div class="body"><div class="g2"><div class="sec"><div class="st">Il tuo profilo</div><div class="box">'
  const w = weight?.weight_kg ? num(weight.weight_kg) : 0, hcm = num(client.height_cm), b = bmi(w, hcm)
  const rows = [['Obiettivo', GOAL_LABEL[client.goal] || client.goal], ['Altezza', hcm ? `${fmt(hcm)} cm` : null], ['Peso attuale', w ? `${fmt(w, 1)} kg${weight.entry_date ? ` (${new Date(weight.entry_date + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})` : ''}` : null], ['IMC', b ? fmt(b, 1) : null], ['Giorni con pasti', `${sum.filledDays} su 7`]].filter(r => r[1])
  h += rows.map(r => `<div class="row"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('') + '</div></div>'
  const tp = pt * 4, tc = ct * 4, tg = gt * 9, tt = tp + tc + tg || 1
  h += '<div class="sec"><div class="st">Obiettivi giornalieri</div>'
  h += `<div class="g4" style="grid-template-columns:repeat(2,1fr)"><div class="tile"><b>${kt ? fmt(kt) : '—'}</b><small>kcal</small></div><div class="tile"><b>${pt ? fmt(pt) + ' g' : '—'}</b><small>Proteine</small>${pt ? `<i>${Math.round(tp / tt * 100)}% kcal</i>` : ''}</div><div class="tile"><b>${ct ? fmt(ct) + ' g' : '—'}</b><small>Carboidrati</small>${ct ? `<i>${Math.round(tc / tt * 100)}% kcal</i>` : ''}</div><div class="tile"><b>${gt ? fmt(gt) + ' g' : '—'}</b><small>Grassi</small>${gt ? `<i>${Math.round(tg / tt * 100)}% kcal</i>` : ''}</div></div>`
  if (pt + ct + gt > 0) h += `<div class="bar"><div style="width:${tp / tt * 100}%;background:#4A90D4"></div><div style="width:${tc / tt * 100}%;background:#E8A020"></div><div style="width:${tg / tt * 100}%;background:#3B8C5A"></div></div><div class="leg"><span style="--c:#4A90D4">Proteine</span><span style="--c:#E8A020">Carboidrati</span><span style="--c:#3B8C5A">Grassi</span></div>`
  h += '</div></div>'
  h += '<div class="sec"><div class="st">Riepilogo della settimana</div><table><thead><tr><th>Giorno</th><th class="n">Pasti</th><th class="n">Kcal</th><th class="n">Prot.</th><th class="n">Carb.</th><th class="n">Grassi</th><th class="n">vs obiettivo</th></tr></thead><tbody>'
  sum.days.forEach(d => {
    if (!d.meals) { h += `<tr><td>${d.name}</td><td class="n" colspan="6" style="color:#888780">nessun pasto inserito</td></tr>`; return }
    const p = pctOf(d.kcal, kt)
    h += `<tr><td><strong>${d.name}</strong></td><td class="n">${d.meals}</td><td class="n"><strong>${fmt(d.kcal)}</strong></td><td class="n">${fmt(d.p)} g</td><td class="n">${fmt(d.c)} g</td><td class="n">${fmt(d.g)} g</td><td class="n" style="color:${tone(p)};font-weight:700">${p == null ? '—' : p + '%'}</td></tr>`
  })
  if (sum.filledDays) h += `<tr class="tot"><td>Media</td><td class="n"></td><td class="n">${fmt(sum.avg.kcal)}</td><td class="n">${fmt(sum.avg.p)} g</td><td class="n">${fmt(sum.avg.c)} g</td><td class="n">${fmt(sum.avg.g)} g</td><td class="n" style="color:${tone(pctOf(sum.avg.kcal, kt))}">${pctOf(sum.avg.kcal, kt) == null ? '—' : pctOf(sum.avg.kcal, kt) + '%'}</td></tr>`
  h += '</tbody></table></div>'
  if (plan.notes) h += `<div class="sec"><div class="st">Note del coach</div><div class="note">${esc(plan.notes).replace(/\n/g, '<br>')}</div></div>`
  h += '</div>'
  // ── un giorno per pagina ──
  sum.days.filter(d => d.meals).forEach(d => {
    const p = pctOf(d.kcal, kt)
    h += `<div class="day"><div class="body"><div class="dh"><div><h2>${d.name}</h2><p>${d.meals} ${d.meals === 1 ? 'pasto' : 'pasti'}${p != null ? ` · ${p}% dell'obiettivo calorico` : ''}</p></div><p style="text-align:right"><strong style="font-size:18px;color:#111">${fmt(d.kcal)} kcal</strong><br>P ${fmt(d.p)} g · C ${fmt(d.c)} g · G ${fmt(d.g)} g</p></div>`
    byDay[d.day].forEach(m => {
      const foods = m.plan_meal_foods || [], t = foodTotals(foods), type = m.meal_type || 'pasto'
      const title = m.meal_name && m.meal_name.trim().toLowerCase() !== String(type).toLowerCase() ? `${type} — ${m.meal_name}` : type
      h += `<div class="meal"><div class="mh"><strong>${esc(title)}</strong><span><em>${fmt(t.kcal)} kcal</em> · P ${fmt(t.p)} · C ${fmt(t.c)} · G ${fmt(t.g)}</span></div>`
      if (foods.length) {
        h += '<table><thead><tr><th>Alimento</th><th class="n">Quantità</th><th class="n">Kcal</th><th class="n">P</th><th class="n">C</th><th class="n">G</th></tr></thead><tbody>'
        h += foods.map(f => { const ft = foodTotals([f]); return `<tr><td>${esc(f.food_name)}${f.brand && f.brand !== '—' ? `<div class="sub">${esc(f.brand)}</div>` : ''}</td><td class="n"><strong>${fmt(num(f.quantity_g))} g</strong></td><td class="n">${fmt(ft.kcal)}</td><td class="n">${fmt(ft.p, 1)}</td><td class="n">${fmt(ft.c, 1)}</td><td class="n">${fmt(ft.g, 1)}</td></tr>` }).join('')
        h += '</tbody></table>'
      } else h += '<div style="padding:10px 12px;font-size:11px;color:#888780">Nessun alimento inserito</div>'
      if (m.coach_note) h += `<div class="mn">${esc(m.coach_note)}</div>`
      h += '</div>'
    })
    h += '</div></div>'
  })
  // ── alimenti della settimana ──
  const foods = weekFoods(meals)
  if (foods.length) {
    h += '<div class="day"><div class="body"><div class="sec"><div class="st">Alimenti della settimana</div><p class="sub" style="margin-bottom:10px">Quantità totali previste nei 7 giorni: utili per fare la spesa.</p><table><thead><tr><th>Alimento</th><th class="n">Quantità totale</th><th class="n">Volte</th><th class="n">Giorni</th></tr></thead><tbody>'
    h += foods.map(f => `<tr><td>${esc(f.name)}${f.brand ? `<div class="sub">${esc(f.brand)}</div>` : ''}</td><td class="n"><strong>${f.grams >= 1000 ? fmt(f.grams / 1000, 2) + ' kg' : fmt(f.grams) + ' g'}</strong></td><td class="n">${f.times}</td><td class="n">${f.days}</td></tr>`).join('')
    h += '</tbody></table></div></div></div>'
  }
  h += `<div class="footer"><span><strong>FOfit</strong> · Piano alimentare di ${esc(name)}</span><span>Piano personalizzato — per qualsiasi dubbio scrivi al tuo coach · fofit.fit</span></div></body></html>`
  return h
}

// ── lettura dei dati e apertura per la stampa ────────────────
export async function loadPlanForPdf(supabase, planId) {
  const { data: plan } = await supabase.from('meal_plans').select('*').eq('id', planId).maybeSingle()
  if (!plan) throw new Error('Piano non trovato')
  const [{ data: client }, { data: meals }, { data: w }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, goal, height_cm').eq('id', plan.client_id).maybeSingle(),
    supabase.from('plan_meals').select('*, plan_meal_foods(*)').eq('plan_id', planId).order('meal_order'),
    supabase.from('progress_entries').select('weight_kg, entry_date').eq('client_id', plan.client_id).order('entry_date', { ascending: false }).limit(1),
  ])
  return { plan, meals: meals || [], client: client || {}, weight: (w && w[0]) || null }
}
export function openPrintWindow(html) {
  let win = null
  try { win = window.open('', '_blank') } catch {}
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => { try { win.print() } catch {} }, 600); return true }
  try { const url = URL.createObjectURL(new Blob([html + '<script>setTimeout(function(){window.print()},600)</script>'], { type: 'text/html' })); window.location.href = url; return true } catch { return false }
}
export async function exportPlanPdf(supabase, planId) {
  const data = await loadPlanForPdf(supabase, planId)
  return openPrintWindow(buildPlanHtml(data))
}
