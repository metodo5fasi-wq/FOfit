// ─────────────────────────────────────────────────────────────
// Anteprima dei PDF DENTRO l'app.
// Prima i PDF si aprivano in una nuova finestra e, se il browser la bloccava (succede sempre su iPhone quando si apre dopo aver
// atteso i dati), si ripiegava sul sostituire l'intera app con il PDF: in un'app installata non c'è il tasto "indietro" e si restava bloccati.
// Ora il documento si mostra in un livello sopra l'app (components/PdfViewer.jsx) con "Torna all'app" sempre visibile: non si esce mai dall'app.
// ─────────────────────────────────────────────────────────────
import { done, notify } from './toast'

let host = null
// Il componente PdfViewerHost si registra qui quando l'app parte
export function registerPdfHost(fn) { host = fn; return () => { if (host === fn) host = null } }
export const hasPdfHost = () => !!host

// Apre l'anteprima nell'app. true = gestito.
export function showPdf(html, title = 'Anteprima PDF') { if (!host) return false; host({ html, title }); return true }

// Punto unico per tutti i PDF. Senza anteprima disponibile (non succede nell'app) ripiega su una nuova finestra,
// MAI sulla finestra dell'app stessa.
export function openPdf(html, title = 'Anteprima PDF') {
  if (showPdf(html, title)) return true
  let win = null
  try { win = window.open('', '_blank') } catch {}
  if (!win) { notify('Non riesco ad aprire il PDF. Riprova.', 'error'); return false }
  win.document.write(html); win.document.close(); win.focus()
  setTimeout(() => { try { win.print() } catch {} }, 600)
  done('PDF pronto: stampa o salva')
  return true
}

// Prepara il documento per mostrarlo nella pagina senza che i suoi stili tocchino l'app:
// niente script, selettori html/body riportati su .pdf-root, regole @page spostate a parte (valgono solo nel documento principale).
export function prepareDoc(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  // il documento ora vive nella pagina dell'app: niente codice eseguibile, qualunque sia il testo dentro (nomi, note, ecc.)
  doc.querySelectorAll('script, iframe, object, embed, link, meta, base, form').forEach(s => s.remove())
  doc.querySelectorAll('*').forEach(el => [...el.attributes].forEach(at => {
    const n = at.name.toLowerCase(), v = String(at.value || '').trim().toLowerCase()
    if (n.startsWith('on') || ((n === 'href' || n === 'src' || n === 'xlink:href' || n === 'action' || n === 'formaction') && /^(javascript|data:text\/html|vbscript):/.test(v.replace(/\s+/g, '')))) el.removeAttribute(at.name)
  }))
  let css = [...doc.querySelectorAll('style')].map(s => s.textContent || '').join('\n')
  doc.querySelectorAll('style').forEach(s => s.remove())
  const pageRules = []
  css = css.replace(/@page[^{]*\{[^}]*\}/g, m => { pageRules.push(m); return '' })
  css = css.replace(/(^|[,{};\s])(html|body)(?=\s*[,{:.#\[\s>+~])/g, '$1.pdf-root')
  return { css, pageCss: pageRules.join('\n'), bodyHtml: doc.body ? doc.body.innerHTML : '' }
}
