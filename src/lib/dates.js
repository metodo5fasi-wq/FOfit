// ─────────────────────────────────────────────────────────────
// Date nel fuso del telefono (non in UTC).
// toISOString() restituisce la data UTC: tra mezzanotte e le 1-2 di notte in Italia dà ancora il giorno prima,
// e un diario o un allenamento segnato a quell'ora finiva nel giorno sbagliato.
// ─────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// "YYYY-MM-DD" + n giorni (anche negativi), sempre in giorni di calendario
export function addDaysStr(str, n) { const d = new Date(str + 'T12:00:00'); d.setDate(d.getDate() + n); return localDateStr(d) }
