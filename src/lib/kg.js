// Carichi in kg con decimali: parte intera e decimale (un decimo di kg) scelte a scorrimento.
export const KG_INT_MAX = 400
export const KG_INTS = Array.from({ length: KG_INT_MAX + 1 }, (_, i) => i)
export const KG_DECS = Array.from({ length: 10 }, (_, i) => i)

// "6.2" | "6,2" | 6.2 → { int: 6, dec: 2 }.  Vuoto o non valido → { int: '', dec: 0 }.
// Valori più precisi di un decimo (es. 17.25 salvato in passato) sono mostrati arrotondati al decimo, senza modificarli.
export function splitKg(v) {
  if (v === '' || v === null || v === undefined) return { int: '', dec: 0 }
  const n = parseFloat(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return { int: '', dec: 0 }
  let i = Math.floor(n + 1e-9), d = Math.round((n - i) * 10)
  if (d >= 10) { i += 1; d = 0 }
  return { int: i, dec: d }
}
// (6, 2) → "6.2"   (10, 0) → "10"   ('', x) → ""   — con il punto, come si aspetta il resto dell'app
export function joinKg(int, dec) {
  if (int === '' || int === null || int === undefined) return ''
  return dec ? `${int}.${dec}` : String(int)
}
// Per mostrare: "6.2" → "6,2"
export const formatKg = v => { const { int, dec } = splitKg(v); return int === '' ? '' : (dec ? `${int},${dec}` : String(int)) }
