// Il database restituisce al massimo 1000 righe per richiesta: per chi ha molto storico si leggono più pagine.
// makeQuery: () => richiesta già costruita (con select, filtri e ORDINE). Serve un ordine completo (con un campo unico alla fine),
// altrimenti righe con lo stesso valore possono comparire due volte o saltare tra una pagina e l'altra.
export async function fetchAllRows(makeQuery, { pageSize = 1000, maxRows = 5000 } = {}) {
  const rows = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1
    const { data, error } = await makeQuery().range(from, to)
    if (error) return { data: rows.length ? rows : null, error }
    rows.push(...(data || []))
    if (!data || data.length < to - from + 1) break
  }
  return { data: rows, error: null }
}
