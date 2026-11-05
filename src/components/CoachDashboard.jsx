import React, { useState, useMemo, useEffect } from 'react'
import { TYPES, relTime } from '../lib/coachInbox.js'

const FILTERS = [['all', 'Tutti'], ['checkin', 'Check-in'], ['message', 'Messaggi'], ['report', 'Report'], ['anamnesi', 'Anamnesi'], ['booking', 'Chiamate'], ['media', 'Foto e misure']]
const matches = (f, i) => f === 'all' || i.type === f || (f === 'media' && (i.type === 'photo' || i.type === 'measure'))
const TAB_OF = { checkin: 'check-in', report: 'report', anamnesi: 'anamnesi', booking: 'calendario' }
const GROUPS = [['today', 'Oggi'], ['tomorrow', 'Domani'], ['week', 'Questa settimana'], ['later', 'Più avanti']]

const S = {
  card: { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: '14px 16px', marginBottom: 12 },
  title: { fontSize: 13, fontWeight: 700, color: '#F0F0F0', display: 'flex', alignItems: 'center', gap: 8 },
  btn: { padding: '6px 11px', background: '#161616', color: '#DDD', border: '0.5px solid #2A2A2A', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tile: { background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C', padding: '12px 14px' },
}

function Tile({ label, value, color = '#F0F0F0', hint }) {
  return <div style={S.tile}><div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div><div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>{label}</div>{hint && <div style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>{hint}</div>}</div>
}

export default function CoachDashboard({ inbox, clients, onOpenTab, onOpenClient }) {
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(15)
  const [allAtt, setAllAtt] = useState(false)
  const byId = useMemo(() => Object.fromEntries((clients || []).map(c => [c.id, c])), [clients])
  const { unseen, counts, agenda, attention, week, loading, problems, seenTableOk } = inbox
  const now = new Date()

  // se il filtro scelto si svuota (es. ho letto tutto), si torna a "Tutti"
  useEffect(() => { if (filter !== 'all' && !counts[filter]) setFilter('all') }, [filter, counts])
  const list = unseen.filter(i => matches(filter, i))
  const open = i => { const tab = TAB_OF[i.type]; if (tab) onOpenTab(tab); else { const c = byId[i.clientId]; if (c) onOpenClient(c) } }
  const openClient = id => { const c = byId[id]; if (c) onOpenClient(c) }
  const expiring = attention.filter(a => a.flags.some(f => f.code.startsWith('sub'))).length
  const agendaTotal = GROUPS.reduce((n, [k]) => n + agenda[k].length, 0)
  const shownAtt = allAtt ? attention : attention.slice(0, 6)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F0F0' }}>Dashboard</div>
          <div style={{ fontSize: 12, color: '#999', textTransform: 'capitalize' }}>{now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button onClick={inbox.reload} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}><i className="ti ti-refresh" style={{ fontSize: 12 }} /> {loading ? 'Aggiorno...' : 'Aggiorna'}</button>
      </div>

      {problems.length > 0 && (
        <div role="alert" style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.4)', borderRadius: 10, padding: '10px 12px', color: '#F07070', fontSize: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <span>Alcune sezioni non si sono caricate ({problems.join(', ')}). I numeri potrebbero essere incompleti.</span>
          <button onClick={inbox.reload} style={S.btn}>Riprova</button>
        </div>
      )}
      {!seenTableOk && (
        <div style={{ background: 'rgba(232,160,32,0.08)', border: '0.5px solid rgba(232,160,32,0.35)', borderRadius: 10, padding: '10px 12px', color: '#E8C050', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
          I "letti" di check-in, chiamate, foto e misure per ora sono ricordati solo su questo dispositivo. Per averli ovunque esegui lo script <b>fofit-dashboard.sql</b> su Supabase.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 12 }}>
        <Tile label="Da gestire" value={counts.all} color={counts.all ? '#F4894A' : '#6FCF97'} />
        <Tile label="Chiamate oggi" value={agenda.today.length} color={agenda.today.length ? '#8CC2F5' : '#F0F0F0'} />
        <Tile label="Clienti da seguire" value={attention.length} color={attention.some(a => a.severity === 'red') ? '#F07070' : attention.length ? '#E8C050' : '#6FCF97'} />
        <Tile label="Abbonamenti in scadenza" value={expiring} color={expiring ? '#E8C050' : '#F0F0F0'} />
      </div>

      {/* DA GESTIRE */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={S.title}><i className="ti ti-inbox" style={{ fontSize: 16, color: '#D4570A' }} />Da gestire {counts.all > 0 && <span style={{ background: '#D4570A', color: 'white', fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 10 }}>{counts.all}</span>}</div>
          {list.length > 0 && <button onClick={() => inbox.markSeen(list)} style={S.btn}>Segna tutto come letto{filter !== 'all' ? ` (${list.length})` : ''}</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {FILTERS.filter(([id]) => id === 'all' || id === filter || counts[id] > 0).map(([id, label]) => (
            <button key={id} onClick={() => { setFilter(id); setLimit(15) }} style={{ padding: '5px 11px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid', background: filter === id ? '#D4570A' : '#161616', color: filter === id ? 'white' : '#DDD', borderColor: filter === id ? '#D4570A' : '#333' }}>{`${label} (${counts[id]})`}</button>))}
        </div>
        {list.length === 0 && <div style={{ textAlign: 'center', color: '#AAA', fontSize: 13, padding: '22px 0' }}>{loading ? 'Carico...' : 'Tutto in ordine: niente da gestire 🎉'}</div>}
        {list.slice(0, limit).map(i => {
          const meta = TYPES[i.type]
          return (
            <div key={i.key} data-testid="inbox-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '0.5px solid #151515' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className={`ti ${meta.icon}`} style={{ fontSize: 17, color: meta.color }} /></div>
              <div role="button" tabIndex={0} onClick={() => open(i)} onKeyDown={e => e.key === 'Enter' && open(i)} aria-label={`Apri: ${i.title} di ${i.clientName}`} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <div style={{ fontSize: 13, color: '#F0F0F0' }}><b>{i.clientName}</b> <span style={{ color: '#AAA' }}>· {i.title}</span></div>
                {i.detail && <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.detail}</div>}
              </div>
              <div style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>{relTime(i.at, now)}</div>
              <button onClick={() => inbox.markSeen(i)} aria-label={`Segna come letto: ${i.title} di ${i.clientName}`} title="Segna come letto" style={{ ...S.btn, padding: '6px 9px', color: '#6FCF97', borderColor: 'rgba(111,207,151,0.4)' }}><i className="ti ti-check" style={{ fontSize: 13 }} /></button>
            </div>
          )
        })}
        {list.length > limit && <button onClick={() => setLimit(l => l + 15)} style={{ ...S.btn, width: '100%', marginTop: 8 }}>Mostra altri ({list.length - limit})</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
        {/* AGENDA */}
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={{ ...S.title, marginBottom: 10 }}><i className="ti ti-phone" style={{ fontSize: 16, color: '#E8A020' }} />Chiamate in programma</div>
          {agendaTotal === 0 && <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Nessuna chiamata in programma.</div>}
          {GROUPS.map(([k, label]) => agenda[k].length > 0 && (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '6px 0' }}>{label}</div>
              {agenda[k].slice(0, k === 'later' ? 3 : 20).map(r => (
                <div key={r.id} data-testid="agenda-row" onClick={() => openClient(r.clientId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#E8A020', width: 46 }}>{r.time}</div>
                  <div style={{ fontSize: 13, color: '#F0F0F0', flex: 1 }}>{r.clientName}</div>
                  {(k === 'week' || k === 'later') && <div style={{ fontSize: 11, color: '#999' }}>{r.dayLabel}</div>}
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => onOpenTab('calendario')} style={{ ...S.btn, width: '100%', marginTop: 4 }}>Apri il calendario</button>
        </div>

        {/* CLIENTI DA SEGUIRE */}
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={{ ...S.title, marginBottom: 10 }}><i className="ti ti-eye-exclamation" style={{ fontSize: 16, color: '#F4894A' }} />Clienti da seguire {attention.length > 0 && <span style={{ color: '#999', fontWeight: 400 }}>({attention.length})</span>}</div>
          {attention.length === 0 && <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>{loading ? 'Carico...' : 'Tutti i clienti sono in linea 👌'}</div>}
          {shownAtt.map(a => (
            <div key={a.clientId} data-testid="attention-row" onClick={() => openClient(a.clientId)} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '0.5px solid #151515', cursor: 'pointer' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: a.severity === 'red' ? '#E24B4A' : '#E8A020', marginTop: 5, flexShrink: 0 }} aria-label={a.severity === 'red' ? 'Urgente' : 'Da controllare'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F0F0' }}>{a.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {a.flags.map(f => <span key={f.code} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: f.severity === 'red' ? 'rgba(226,75,74,0.14)' : 'rgba(232,160,32,0.12)', color: f.severity === 'red' ? '#F07070' : '#E8C050' }}>{f.text}</span>)}
                </div>
              </div>
            </div>
          ))}
          {attention.length > 6 && <button onClick={() => setAllAtt(v => !v)} style={{ ...S.btn, width: '100%', marginTop: 8 }}>{allAtt ? 'Mostra meno' : `Mostra tutti (${attention.length})`}</button>}
        </div>
      </div>

      {/* NUMERI DELLA SETTIMANA */}
      {week && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Ultimi 7 giorni</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            <Tile label="Allenamenti completati" value={week.workouts} />
            <Tile label="Diario compilato oggi" value={`${week.diaryToday}/${week.clients}`} />
            <Tile label="Clienti con check-in" value={week.checkins} />
            <Tile label="Aderenza media al piano" value={week.adherence === null ? '—' : `${week.adherence}%`} />
          </div>
        </div>
      )}
    </>
  )
}
