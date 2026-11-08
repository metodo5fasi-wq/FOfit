import React from 'react'
import { askConfirm } from '../../lib/confirm'
import { done } from '../../lib/toast'
import { useAuth } from '../../App'
import { sendToClients } from '../../lib/notify'

const PRESETS = [
  { title: '📔 Diario di oggi', body: 'Hai registrato i pasti di oggi? Apri FOfit e traccia il tuo diario!' },
  { title: '💪 Continua così!', body: 'Stai facendo un ottimo lavoro. Controlla il tuo piano di oggi!' },
  { title: '📊 Piano aggiornato', body: "Il tuo coach ha aggiornato il tuo piano. Dai un'occhiata!" },
  { title: '🎯 Obiettivo vicino!', body: 'Sei quasi al tuo target settimanale. Ancora un piccolo sforzo!' },
]
const field = { width: '100%', padding: '7px 10px', border: '0.5px solid #1C1C1C', borderRadius: 8, fontSize: 12, background: '#161616', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }

// Campanella del coach: invia una notifica a un cliente o a tutti. Stesso percorso dei messaggi programmati:
// notifica nell'app (Home e Notifiche del cliente) + push se attiva + messaggio in conversazione, a cui il cliente può rispondere.
export default function NotifBell({ clients }) {
  const { profile } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [selectedClient, setSelectedClient] = React.useState('all')
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [result, setResult] = React.useState(null)       // { type: 'ok' | 'warn' | 'error', text }
  const ref = React.useRef(null)
  const list = clients || []

  React.useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function send() {
    if (!title.trim() || !body.trim() || sending) return
    const ids = selectedClient === 'all' ? list.map(c => c.id) : [selectedClient]
    if (!ids.length) { setResult({ type: 'error', text: 'Non ci sono clienti a cui inviare.' }); return }
    if (selectedClient === 'all' && !(await askConfirm(`Inviare questa notifica a tutti i ${ids.length} clienti?`, { confirmLabel: 'Invia a tutti' }))) return
    setSending(true); setResult(null)
    const { sent, failed } = await sendToClients(ids, { coachId: profile?.id, title: title.trim(), body: body.trim() })
    setSending(false)
    const names = failed.map(id => list.find(c => c.id === id)?.full_name || 'cliente').join(', ')
    if (!failed.length) {
      done(sent.length === 1 ? 'Notifica inviata' : `Notifica inviata a ${sent.length} clienti`)
      setResult({ type: 'ok', text: sent.length === 1 ? `✓ Inviata a ${list.find(c => c.id === sent[0])?.full_name || 'cliente'}` : `✓ Inviata a ${sent.length} clienti` })
      setTitle(''); setBody('')
      setTimeout(() => { setResult(null); setOpen(false) }, 2200)
    } else if (sent.length) setResult({ type: 'warn', text: `Inviata a ${sent.length}, NON a: ${names}. Riprova per questi.` })
    else setResult({ type: 'error', text: `Non inviata${ids.length === 1 ? '' : ' a nessuno'}. Controlla la connessione e riprova.` })
  }

  const rc = { ok: ['rgba(59,140,90,0.14)', '#6FCF97'], warn: ['rgba(232,160,32,0.12)', '#E8C050'], error: ['rgba(226,75,74,0.14)', '#F07070'] }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="tap" onClick={() => setOpen(!open)} aria-label="Invia notifica ai clienti" aria-expanded={open} style={{
        width: 36, height: 36, borderRadius: 9, border: '0.5px solid #1C1C1C',
        background: open ? 'rgba(212,87,10,0.12)' : '#161616',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        <i className="ti ti-bell" style={{ fontSize: 16, color: open ? '#D4570A' : '#CCC' }} />
      </button>
      {open && (
        <div role="dialog" aria-label="Invia notifica" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 300,
          background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 500, padding: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F0F0', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-bell-ringing" style={{ fontSize: 14, color: '#D4570A' }} />
            Invia notifica
            <button onClick={() => setOpen(false)} aria-label="Chiudi" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <select aria-label="Destinatario" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={field}>
            <option value="all">Tutti i clienti ({list.length})</option>
            {list.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setTitle(p.title); setBody(p.body) }}
                style={{ padding: '4px 8px', borderRadius: 14, border: '0.5px solid #2A2A2A', background: '#161616', color: '#CCC', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                {p.title}
              </button>
            ))}
          </div>
          <input aria-label="Titolo" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo..." style={field} />
          <textarea aria-label="Testo della notifica" value={body} onChange={e => setBody(e.target.value)} placeholder="Testo della notifica..." rows={3} style={{ ...field, resize: 'vertical' }} />
          {result && <div role={result.type === 'error' ? 'alert' : 'status'} style={{ background: rc[result.type][0], color: rc[result.type][1], fontSize: 12, lineHeight: 1.45, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>{result.text}</div>}
          <button onClick={send} disabled={!title.trim() || !body.trim() || sending}
            style={{ width: '100%', padding: '9px', background: '#D4570A', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: (!title.trim() || !body.trim() || sending) ? 'default' : 'pointer', opacity: (!title.trim() || !body.trim() || sending) ? 0.55 : 1, fontFamily: 'inherit' }}>
            {sending ? 'Invio...' : '🔔 Invia notifica'}
          </button>
          <div style={{ fontSize: 10, color: '#AAA', marginTop: 8, lineHeight: 1.4 }}>Il cliente la vede in Home e nella pagina Notifiche, e può risponderti da lì.</div>
        </div>
      )}
    </div>
  )
}
