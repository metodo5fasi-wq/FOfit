import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbSave } from '../../lib/db'
import { ReportAnswers, ReportSignals } from '../../components/ReportInsights'
import { flashEl } from './shared'
import { generateReportPDF } from './reportPdf'

// ─────────────────────────────────────────────────────────
// TAB REPORT
// ─────────────────────────────────────────────────────────
export default function ReportTab({ clients, clientStats, onRefresh, focus, clearFocus }) {
  const goalOf = id => (clients || []).find(c => c.id === id)?.goal
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('tutti')

  useEffect(() => { fetchReports() }, [])
  // arrivo dalla dashboard: si apre il report indicato
  useEffect(() => {
    if (focus?.type !== 'report' || loading) return
    const r = reports.find(x => x.id === focus.id)
    if (r) { setExpanded(r.id); if (!r.read_by_coach) markRead(r.id); flashEl(`[data-report-id="${r.id}"]`) }
    clearFocus?.()
  }, [focus, loading, reports])

  async function fetchReports() {
    setLoading(true)
    const { data } = await supabase.from('workout_reports')
      .select('*, profiles!workout_reports_client_id_fkey(full_name)')
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  async function markRead(reportId) {
    await dbSave(supabase.from('workout_reports').update({ read_by_coach: true }).eq('id', reportId), 'il report', 'salvare')
    setReports(p => p.map(r => r.id === reportId ? { ...r, read_by_coach: true } : r))
    // Rimuovi badge newReport dalla lista clienti
    // badge rimosso automaticamente al refresh
  }

  const nonLetti = reports.filter(r => !r.read_by_coach)
  const tutti = reports
  const displayed = filter === 'non_letti' ? nonLetti : tutti

  const initials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() : '?'

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#AAA' }}>
          {nonLetti.length > 0 && <span style={{ fontWeight: 700, color: '#B39DDB' }}>{nonLetti.length} non letto{nonLetti.length > 1 ? 'i' : ''} · </span>}
          {tutti.length} report totali
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'tutti', l: `Tutti (${tutti.length})` }, { id: 'non_letti', l: `Non letti (${nonLetti.length})` }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              border: '0.5px solid', fontFamily: 'inherit',
              background: filter === f.id ? '#7C3AED' : '#161616',
              color: filter === f.id ? 'white' : '#CCC',
              borderColor: filter === f.id ? '#7C3AED' : '#2A2A2A'
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#AAA' }}>Caricamento...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0D0D0D', borderRadius: 12, border: '0.5px solid #1C1C1C' }}>
          <i className="ti ti-clipboard-list" style={{ fontSize: 40, color: '#E0DDD6', display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: '#AAA' }}>Nessun report ricevuto ancora.</div>
        </div>
      )}

      {displayed.map(r => {
        const clientName = r.profiles?.full_name || clients.find(c => c.id === r.client_id)?.full_name || '—'
        const isExpanded = expanded === r.id
        const isNew = !r.read_by_coach

        return (
          <div key={r.id} data-report-id={r.id} style={{ background: '#0D0D0D', borderRadius: 12, border: `0.5px solid ${isNew ? 'rgba(155,89,182,0.4)' : '#2A2A2A'}`, marginBottom: 10, overflow: 'hidden' }}>
            {/* HEADER REPORT */}
            <div onClick={() => { setExpanded(isExpanded ? null : r.id); if (isNew) markRead(r.id) }}
              style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isNew ? '#140d1a' : '#0D0D0D' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: isNew ? '#7C3AED' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {initials(clientName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}>{clientName}</span>
                  {isNew && <span style={{ fontSize: 10, background: '#7C3AED', color: 'white', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>NUOVO</span>}
                </div>
                <div style={{ fontSize: 11, color: '#AAA' }}>
                  {r.period_start && r.period_end
                    ? `${new Date(r.period_start + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${new Date(r.period_end + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Inviato il ${new Date(r.submitted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </div>
              </div>
              {/* MINI STATS */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {r.benessere_generale && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 700, color: r.benessere_generale >= 7 ? '#6FCF97' : r.benessere_generale >= 5 ? '#E8A020' : '#E24B4A' }}>{r.benessere_generale}</div><div style={{ fontSize: 9, color: '#AAA' }}>😊</div></div>}
                {r.energia_allenamento && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 700, color: r.energia_allenamento >= 7 ? '#6FCF97' : r.energia_allenamento >= 5 ? '#E8A020' : '#E24B4A' }}>{r.energia_allenamento}</div><div style={{ fontSize: 9, color: '#AAA' }}>⚡</div></div>}
                {r.stress_periodo && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 700, color: r.stress_periodo <= 4 ? '#6FCF97' : r.stress_periodo <= 7 ? '#E8A020' : '#E24B4A' }}>{r.stress_periodo}</div><div style={{ fontSize: 9, color: '#AAA' }}>🧠</div></div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={(e)=>{e.stopPropagation();generateReportPDF(r,clientName,goalOf(r.client_id))}} style={{
                  background:'rgba(155,89,182,0.16)',color:'#B39DDB',border:'0.5px solid #7C3AED',
                  borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:4
                }}>
                  <i className="ti ti-file-type-pdf" style={{fontSize:12}}/>PDF
                </button>
                <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 14, color: '#AAA' }} />
              </div>
            </div>

            {/* CONTENUTO ESPANSO */}
            {isExpanded && (
              <div style={{ borderTop: '0.5px solid #1C1C1C', padding: '14px', maxHeight: 500, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

                {/* SEGNALI PER AGGIORNARE I PIANI */}
                <ReportSignals r={r} goal={goalOf(r.client_id)} />

                {/* PROGRESSI ESERCIZI */}
                {r.progressi_esercizi?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F4894A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🏋️ Progressi di carico</div>
                    {r.progressi_esercizi.map((ex, i) => {
                      const diff = ex.carico_fine && ex.carico_inizio ? (parseFloat(ex.carico_fine) - parseFloat(ex.carico_inizio)).toFixed(1) : null
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '0.5px solid #1C1C1C' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F0F0' }}>{ex.exercise_name}</div>
                            <div style={{ fontSize: 11, color: '#AAA' }}>{ex.carico_inizio}kg → {ex.carico_fine}kg</div>
                            {ex.note && <div style={{ fontSize: 11, color: '#AAA', fontStyle: 'italic', marginTop: 2 }}>"{ex.note}"</div>}
                          </div>
                          {diff !== null && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(diff) > 0 ? '#6FCF97' : parseFloat(diff) < 0 ? '#E24B4A' : '#888780', background: parseFloat(diff) > 0 ? 'rgba(59,140,90,0.16)' : parseFloat(diff) < 0 ? 'rgba(226,75,74,0.16)' : '#161616', padding: '2px 8px', borderRadius: 7, marginLeft: 8, flexShrink: 0 }}>
                              {parseFloat(diff) > 0 ? '+' : ''}{diff}kg
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* BENESSERE */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { l: 'Benessere', v: r.benessere_generale, emoji: '😊' },
                    { l: 'Energia', v: r.energia_allenamento, emoji: '⚡' },
                    { l: 'Sonno', v: r.qualita_sonno, emoji: '😴' },
                    { l: 'Stress', v: r.stress_periodo, emoji: '🧠', inverted: true },
                  ].filter(item => item.v !== null && item.v !== undefined && item.v !== '').map(item => (
                    <div key={item.l} style={{ background: '#161616', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{item.emoji}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F0F0' }}>{item.v}/10</div>
                      <div style={{ fontSize: 9, color: '#AAA', textTransform: 'uppercase' }}>{item.l}</div>
                    </div>
                  ))}
                </div>

                {/* CAMPI TESTO */}
                {[
                  { l: '⚖️ Peso inizio → fine periodo', v: (r.peso_inizio || r.peso_fine) ? `${r.peso_inizio ?? '—'} → ${r.peso_fine ?? '—'} kg` : null },
                  { l: '🥗 Alimentazione — difficoltà', v: r.difficolta_alimentazione },
                  { l: '🥗 Pasti saltati', v: r.pasti_saltati },
                  { l: '🥗 Fame/sazietà', v: r.fame_saziet },
                  { l: '🥗 Note alimentazione', v: r.note_alimentazione },
                  { l: '💤 DOMS', v: r.doms },
                  { l: '💤 Recupero', v: r.qualita_recupero },
                  { l: '💤 Zona affaticata', v: r.zona_affaticata },
                  { l: '💤 Dolori nuovi', v: r.dolori_nuovi },
                  { l: '📋 Esercizi amati', v: r.esercizi_amati },
                  { l: '📋 Esercizi difficili', v: r.esercizi_difficili },
                  { l: '📋 Cosa cambierebbe', v: r.cosa_cambieresti },
                  { l: '📋 Obiettivo prossimo periodo', v: r.obiettivo_prossimo },
                  { l: '💬 Note al coach', v: r.note_coach },
                ].filter(f => f.v !== null && f.v !== undefined && f.v !== '').map(f => (
                  <div key={f.l} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{f.l}</div>
                    <div style={{ fontSize: 13, color: '#F0F0F0', lineHeight: 1.5, background: '#161616', borderRadius: 8, padding: '8px 10px' }}>{f.v}</div>
                  </div>
                ))}
                {/* RISPOSTE ALLE DOMANDE AGGIUNTIVE */}
                <ReportAnswers r={r} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
