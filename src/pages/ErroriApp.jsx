import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { dbSave } from '../lib/db'
import { askConfirm } from '../lib/confirm'
import { groupErrors } from '../lib/errorLog'
import { relTime } from '../lib/coachInbox'

const S = {
  topbar: { background: '#0D0D0D', borderBottom: '0.5px solid #1A1A1A', padding: '0 22px', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0, flexWrap: 'wrap' },
  page: { flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' },
  card: { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: 14, marginBottom: 10 },
  btn: { background: '#161616', color: '#CCC', border: '0.5px solid #2A2A2A', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 },
  btnMain: { background: 'rgba(59,140,90,0.12)', color: '#6FCF97', border: '0.5px solid #3B6D11', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 },
}

export default function ErroriApp() {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [missing, setMissing] = useState(false), [failed, setFailed] = useState(false)
  const [showResolved, setShowResolved] = useState(false), [openKey, setOpenKey] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const r = await supabase.from('app_errors').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(1000)
    if (r.error) { setRows([]); setLoading(false); if (/app_errors|relation|schema|does not exist/i.test(r.error.message || '')) setMissing(true); else setFailed(true); return }
    setMissing(false); setFailed(false); setRows(r.data || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const groups = groupErrors(rows), shown = groups.filter(g => showResolved || !g.resolved), open = groups.filter(g => !g.resolved).length

  async function resolve(ids) {
    const r = await dbSave(supabase.from('app_errors').update({ resolved: true }).in('id', ids), "l'errore", 'aggiornare', { done: 'Segnato come risolto' })
    if (r.ok !== false) load()
  }
  async function remove(g) {
    if (!(await askConfirm('Questo errore e tutte le sue segnalazioni verranno eliminati.', { title: 'Eliminare?', confirmLabel: 'Elimina', danger: true }))) return
    const r = await dbSave(supabase.from('app_errors').delete().in('id', g.ids), "l'errore", 'eliminare', { done: 'Eliminato' })
    if (r.ok !== false) load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={S.topbar}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>Errori dell'app</div>
          <div style={{ fontSize: 11, color: '#CCC' }}>{open} da controllare · ultimi 30 giorni</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowResolved(v => !v)} style={S.btn}>{showResolved ? 'Nascondi risolti' : 'Mostra risolti'}</button>
          {open > 0 && <button onClick={() => resolve(groups.filter(g => !g.resolved).flatMap(g => g.ids))} style={S.btnMain}>Segna tutti come risolti</button>}
          <button onClick={load} disabled={loading} style={S.btn}>{loading ? 'Aggiorno…' : 'Aggiorna'}</button>
        </div>
      </div>
      <div style={S.page}>
        {missing && <div data-testid="errori-manca-tabella" style={{ ...S.card, borderColor: '#E8A020', color: '#E8C050', fontSize: 13, lineHeight: 1.5 }}>Il registro non è ancora attivo: su Supabase (SQL Editor) esegui lo script <b>fofit-miglioramenti.sql</b>, poi premi «Aggiorna».</div>}
        {failed && <div style={{ ...S.card, borderColor: '#E24B4A', color: '#F07070', fontSize: 13 }}>Non riesco a leggere gli errori. Controlla la connessione e riprova.</div>}
        {!loading && !missing && !failed && shown.length === 0 && <div style={{ textAlign: 'center', color: '#AAA', padding: 40, fontSize: 13 }}>Nessun errore da controllare 👌</div>}
        {shown.map(g => (
          <div key={g.key} data-testid="errore" style={{ ...S.card, opacity: g.resolved ? 0.55 : 1 }}>
            <div onClick={() => setOpenKey(openKey === g.key ? null : g.key)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F0F0', wordBreak: 'break-word' }}>{g.message}</div>
              <div style={{ fontSize: 11, color: '#AAA', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span><b style={{ color: g.count > 5 ? '#F07070' : '#E8C050' }}>{g.count}</b> {g.count === 1 ? 'volta' : 'volte'}</span>
                <span>{g.users} {g.users === 1 ? 'utente' : 'utenti'}</span>
                <span>ultima {relTime(g.last)}</span>
                {g.url && <span>pagina {g.url}</span>}
                {g.version && <span>versione {g.version}</span>}
              </div>
            </div>
            {openKey === g.key && (
              <div style={{ marginTop: 10 }}>
                <pre style={{ margin: 0, padding: 10, background: '#050505', borderRadius: 8, fontSize: 10, color: '#CCC', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto' }}>{g.stack || '(nessun dettaglio tecnico)'}</pre>
                {g.ua && <div style={{ fontSize: 10, color: '#888', marginTop: 6, wordBreak: 'break-word' }}>{g.ua}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {!g.resolved && <button onClick={() => resolve(g.ids)} style={S.btnMain}>Segna come risolto</button>}
                  <button onClick={() => remove(g)} style={{ ...S.btn, color: '#E24B4A', borderColor: '#E24B4A' }}>Elimina</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
