// Trascinamento dal solo "maniglione" (l'icona con i puntini verticali), non dall'intera scheda.
// Se l'intera scheda è trascinabile, il browser non permette più di selezionare il testo nei campi che contiene:
// il mouse trascina la scheda invece di selezionare, e la pagina "si sposta insieme al mouse".
export function startHandleDrag(e) {
  const dt = e.dataTransfer; if (!dt) return
  dt.effectAllowed = 'move'
  try { dt.setData('text/plain', 'fofit-riordina') } catch {}                           // Firefox non avvia il trascinamento senza dati
  const card = e.currentTarget?.closest?.('[data-drag-card]')                          // durante il trascinamento si vede la scheda intera, sotto il mouse
  if (card && typeof dt.setDragImage === 'function') { const r = card.getBoundingClientRect(); dt.setDragImage(card, Math.max(0, (e.clientX || 0) - r.left), Math.max(0, (e.clientY || 0) - r.top)) }
}
