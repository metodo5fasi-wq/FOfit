// Legge la risposta dell'assistente (eventi «data: {...}» separati da una riga vuota) e chiama on(evento) man mano che arrivano.
// Eventi: { t:'text', text } · { t:'status', text } · { t:'recipe', recipe } · { t:'error', error } · { t:'done' }
export async function readSse(res, on) {
  const handle = chunk => {
    const line = String(chunk).split('\n').find(l => l.startsWith('data:')); if (!line) return
    let ev; try { ev = JSON.parse(line.slice(5).trim()) } catch { return }
    on(ev)
  }
  const reader = res?.body?.getReader?.()
  if (!reader) { String(await res.text()).replace(/\r\n/g, '\n').split('\n\n').forEach(handle); return }
  const dec = new TextDecoder(); let buf = ''
  for (;;) {
    const { done, value } = await reader.read(); if (done) break
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let i; while ((i = buf.indexOf('\n\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2) }
  }
  if (buf.trim()) handle(buf)
}
