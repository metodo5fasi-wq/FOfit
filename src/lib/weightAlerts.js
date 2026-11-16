// ─────────────────────────────────────────────────────────────
// Avvisi sul peso per il coach. Si guarda la MEDIA degli ultimi 7 giorni (non il singolo peso, che sale e scende per acqua e sale).
//   • direzione opposta all'obiettivo (dimagrimento: peso in salita · massa: peso in discesa)
//   • perdita troppo rapida (oltre l'1% del peso a settimana; per chi non deve dimagrire, già oltre lo 0,5%)
//   • peso fermo da 3 settimane (solo per chi deve dimagrire o mettere massa)
// Servono almeno 4 pesate in 3 settimane e una pesata recente: con pochi dati non si segnala nulla (meglio nessun avviso che un falso allarme).
// Funzioni pure: si provano da sole.
// ─────────────────────────────────────────────────────────────
import { movingAverage, fmtKg } from './trend.js'

export const W = { windowDays: 21, fastDays: 14, minReadings: 4, minSpanDays: 17, recentDays: 10, stallKg: 0.3, oppositeKg: 0.5, fastPct: 1.0, fastPctOther: 0.5, fastRedPct: 1.5 }
const DAY = 86400000
const t = d => new Date(d + 'T12:00').getTime()
const days = (a, b) => Math.round((t(a) - t(b)) / DAY)
const r1 = n => Math.round(n * 10) / 10
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtKg(Math.abs(n))

export function goalKind(goal) {
  const g = String(goal || '').toLowerCase()
  if (/dimagr|definiz|cut|perdit/.test(g)) return 'cut'
  if (/massa|ipertrof|bulk/.test(g)) return 'bulk'
  if (/ricomp|mantenim|forza/.test(g)) return 'other'
  return null
}

// points: [{date:'YYYY-MM-DD', value}] · today: 'YYYY-MM-DD'. Restituisce null oppure { code, severity, text }
export function weightAlert(points = [], goal, today) {
  const series = movingAverage(points, 7)
  if (series.length < W.minReadings) return null
  const last = series[series.length - 1]
  if (days(today, last.date) > W.recentDays) return null          // nessuna pesata recente: ci pensa l'avviso "check-in mancante"
  const kind = goalKind(goal)

  const win = series.filter(p => days(last.date, p.date) <= W.windowDays)
  const first = win[0], span = days(last.date, first.date)
  const change = r1(last.avg - first.avg)
  const fullWin = win.length >= W.minReadings && span >= W.minSpanDays

  // 1) direzione opposta all'obiettivo
  if (fullWin && ((kind === 'cut' && change >= W.oppositeKg) || (kind === 'bulk' && change <= -W.oppositeKg)))
    return { code: 'weight_opposite', severity: 'amber', text: kind === 'cut' ? `Peso in salita (${sgn(change)} kg in ${weeks(span)}) con obiettivo dimagrimento` : `Peso in discesa (${sgn(change)} kg in ${weeks(span)}) con obiettivo massa` }

  // 2) perdita troppo rapida (finestra più corta: serve reagire in fretta)
  const fw = series.filter(p => days(last.date, p.date) <= W.fastDays), ff = fw[0], fspan = days(last.date, ff.date)
  if (fw.length >= 3 && fspan >= 10) {
    const perWeek = (last.avg - ff.avg) / (fspan / 7), pct = -perWeek / ff.avg * 100
    const limit = kind === 'cut' || kind === null ? W.fastPct : W.fastPctOther
    if (pct >= limit) return { code: 'weight_fast', severity: pct >= W.fastRedPct ? 'red' : 'amber', text: `Perdita rapida: ${sgn(r1(last.avg - ff.avg))} kg in ${weeks(fspan)} (${fmtKg(r1(pct))}% a settimana)` }
  }

  // 3) peso fermo (solo se l'obiettivo richiede che si muova)
  if (fullWin && (kind === 'cut' || kind === 'bulk') && Math.abs(change) < W.stallKg)
    return { code: 'weight_stalled', severity: 'amber', text: `Peso fermo da ${weeks(span)} (${sgn(change)} kg)` }
  return null
}
function weeks(d) { const w = Math.round(d / 7); return w <= 1 ? '1 settimana' : `${w} settimane` }
