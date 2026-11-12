// ─────────────────────────────────────────────────────────────
// Note generali della scheda di allenamento: scritte dal coach (Crea / Modifica allenamento), lette dal cliente.
// Testo semplice con tre comodità: "# Titolo", elenchi con "-", **grassetto** e link https:// cliccabili.
// ─────────────────────────────────────────────────────────────
export const NOTES_MAX = 4000

// Ripulisce il testo prima di salvarlo: a capo uniformi, niente spazi a fine riga, al massimo una riga vuota di fila, nessun vuoto ai bordi, tetto di lunghezza
export function normalizeNotes(text) {
  let t = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t]+$/g, '')).join('\n')
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  return t.length > NOTES_MAX ? t.slice(0, NOTES_MAX).trimEnd() : t
}
export const hasNotes = text => normalizeNotes(text).length > 0

// Blocchi: { type: 'h', text } titolo · { type: 'ul', items } elenco · { type: 'p', text } paragrafo (a capo mantenuti)
export function parseNotes(text) {
  const lines = normalizeNotes(text).split('\n'), out = []
  let para = [], list = []
  const flushP = () => { if (para.length) { out.push({ type: 'p', text: para.join('\n') }); para = [] } }
  const flushL = () => { if (list.length) { out.push({ type: 'ul', items: list }); list = [] } }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushP(); flushL(); continue }
    const h = line.match(/^#{1,3}\s+(.+)$/), li = line.match(/^(?:[-*•])\s+(.+)$/)
    if (h) { flushP(); flushL(); out.push({ type: 'h', text: h[1].trim() }) }
    else if (li) { flushP(); list.push(li[1].trim()) }
    else { flushL(); para.push(line) }
  }
  flushP(); flushL(); return out
}

// Pezzi di una riga: testo normale, **grassetto**, link. Solo http/https (niente javascript: né altro).
export function splitInline(str) {
  const out = []; const re = /\*\*(.+?)\*\*|(https?:\/\/[^\s<>]+)/g; let last = 0, m
  const s = String(str ?? '')
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: m[1], b: true })
    else { const url = m[2].replace(/[.,;:!?)\]]+$/, ''), tail = m[2].slice(url.length); out.push({ t: url, href: url }); if (tail) out.push({ t: tail }) }
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ t: s.slice(last) })
  return out
}

// Impronta del testo: serve a sapere se il cliente ha già visto QUESTE note
export function notesHash(text) {
  const s = normalizeNotes(text); let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return String(h)
}
export const notesSeenKey = planId => `fofit_notes_seen_${planId}`
export const notesOpenKey = planId => `fofit_notes_open_${planId}`
export const readSeen = planId => { try { return localStorage.getItem(notesSeenKey(planId)) } catch { return null } }
export const writeSeen = (planId, text) => { try { localStorage.setItem(notesSeenKey(planId), notesHash(text)) } catch {} }
// null = mai viste · 'updated' = viste ma cambiate · false = già viste e uguali
export function notesStatus(planId, text) {
  if (!hasNotes(text)) return false
  const seen = readSeen(planId); if (seen === null || seen === undefined) return 'new'
  return seen === notesHash(text) ? false : 'updated'
}

// La colonna delle note è stata aggiunta al database con uno script: finché non è eseguito, salvare le note dà questo errore
export const isMissingNotesColumn = err => /general_notes/i.test(String(err?.message || err || ''))
export const MISSING_COLUMN_MSG = 'Per salvare le note serve un aggiornamento del database: esegui lo script SQL "fofit-note-allenamento.sql" in Supabase.'
