// ─────────────────────────────────────────────────────────────
// Peso: media mobile. Il peso cambia di giorno in giorno (acqua, sale, digestione): la linea che conta è la MEDIA degli ultimi giorni.
// points: [{ date: 'YYYY-MM-DD', value: numero }] in ordine di data. La finestra è di N giorni di calendario (default 7), non di N misure.
// ─────────────────────────────────────────────────────────────
const DAY = 86400000
const t = d => new Date(d + 'T12:00').getTime()
const r1 = n => Math.round(n * 10) / 10

export function movingAverage(points = [], days = 7) {
  // un peso vuoto non vale 0 kg: va scartato
  const clean = points.filter(p => p && p.date && p.value !== null && p.value !== '' && Number.isFinite(Number(p.value))).map(p => ({ date: p.date, value: Number(p.value) })).sort((a, b) => a.date.localeCompare(b.date))
  return clean.map(p => {
    const win = clean.filter(q => t(q.date) <= t(p.date) && t(q.date) > t(p.date) - days * DAY)
    return { date: p.date, value: p.value, avg: r1(win.reduce((s, q) => s + q.value, 0) / win.length), n: win.length }
  })
}

// Andamento sulla media: da dove sei partito, dove sei, quanto cambia a settimana
export function trendSummary(series = []) {
  if (!series.length) return null
  const first = series[0], last = series[series.length - 1]
  const span = Math.round((t(last.date) - t(first.date)) / DAY)
  const change = r1(last.avg - first.avg)
  return { firstAvg: first.avg, lastAvg: last.avg, lastValue: last.value, change, spanDays: span, perWeek: span >= 7 ? r1(change / (span / 7)) : null }
}
export const fmtKg = n => String(n).replace('.', ',')
