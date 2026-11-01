// Disponibilità per le chiamate: UNICA configurazione, usata sia dalla pagina di prenotazione del cliente
// sia dal calendario del coach (così non possono più andare fuori sincrono).
export const SLOT_MINUTES = 30

// giorno della settimana (0=Dom ... 6=Sab) → fasce [inizio, fine].
// "fine" = ora in cui termina l'ULTIMA chiamata (es. 09:00-12:00 → ultima chiamata alle 11:30).
// Un giorno presente con elenco vuoto resta nel calendario del coach, ma senza orari prenotabili.
export const AVAILABILITY = {
  1: [],                                          // Lunedì: nessuna disponibilità
  2: [['09:00', '12:00'], ['15:00', '18:00']],    // Martedì
  3: [['09:00', '12:00'], ['15:00', '18:00']],    // Mercoledì
  4: [['08:30', '11:30']],                        // Giovedì (solo mattina)
  5: [['08:30', '11:30']],                        // Venerdì (solo mattina)
  6: [['08:30', '11:30']],                        // Sabato (solo mattina)
}

const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`

// Orari prenotabili di un giorno, nel formato salvato nel database ("09:00", "08:30"...)
export function generateSlots(dow) {
  const ranges = AVAILABILITY[dow]
  if (!ranges) return []
  const out = []
  for (const [start, end] of ranges) for (let t = toMin(start); t + SLOT_MINUTES <= toMin(end); t += SLOT_MINUTES) out.push(fmt(t))
  return out
}

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const nice = hhmm => hhmm.replace(/^0/, '')
// Testo per i clienti, ricavato dalla configurazione (es. "Mar, Mer 9:00-12:00 e 15:00-18:00 · Gio, Ven, Sab 8:30-11:30")
export function describeAvailability() {
  const groups = new Map()
  ;[1, 2, 3, 4, 5, 6, 0].forEach(d => {
    const r = AVAILABILITY[d]; if (!r || !r.length) return
    const key = r.map(([s, e]) => `${nice(s)}-${nice(e)}`).join(' e ')
    groups.set(key, [...(groups.get(key) || []), DAY_SHORT[d]])
  })
  return [...groups.entries()].map(([hours, days]) => `${days.join(', ')} ${hours}`).join(' · ')
}
