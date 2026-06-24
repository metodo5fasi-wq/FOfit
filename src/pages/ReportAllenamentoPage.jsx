import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import ReportAllenamento from './ReportAllenamento'

export default function ReportAllenamentoPage() {
  const { profile } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => { if (profile) fetchReports() }, [profile])

  async function fetchReports() {
    setLoading(true)
    const { data } = await supabase.from('workout_reports')
      .select('*').eq('client_id', profile.id)
      .order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  // Se sta compilando o vedendo un report
  if (showNew || selectedReport) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ReportAllenamento
          reportId={selectedReport?.id}
          onClose={() => { setShowNew(false); setSelectedReport(null); fetchReports() }}
        />
      </div>
    )
  }

  const submitted = reports.filter(r => r.submitted_at)
  const draft = reports.find(r => !r.submitted_at)

  return (
    <>
      <div style={{ background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Report allenamento</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aggiorna il tuo coach sui progressi</div>
        </div>
        <button onClick={() => draft ? setSelectedReport(draft) : setShowNew(true)} style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} />
          {draft ? 'Riprendi bozza' : 'Nuovo report'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>Caricamento...</div>}

        {!loading && reports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Nessun report ancora</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Il report ti permette di aggiornare il tuo coach sui progressi di carico, l'alimentazione e come ti sei sentito nel periodo.
            </div>
            <button onClick={() => setShowNew(true)} style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }}>
              <i className="ti ti-plus" style={{ fontSize: 14 }} /> Compila il primo report
            </button>
          </div>
        )}

        {/* BOZZA */}
        {draft && (
          <div style={{ background: '#FEF0E7', border: '0.5px solid #D4570A', borderRadius: 12, padding: '14px', marginBottom: 14, cursor: 'pointer' }} onClick={() => setSelectedReport(draft)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#D4570A' }}>📝 Bozza in corso</div>
                <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
                  Ultima modifica: {new Date(draft.updated_at || draft.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#D4570A', background: 'white', padding: '4px 10px', borderRadius: 8 }}>Continua →</span>
            </div>
          </div>
        )}

        {/* REPORT INVIATI */}
        {submitted.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
              Report inviati ({submitted.length})
            </div>
            {submitted.map(r => (
              <div key={r.id} onClick={() => setSelectedReport(r)}
                style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', padding: '14px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="ti ti-clipboard-check" style={{ fontSize: 18, color: '#7C3AED' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {r.period_start && r.period_end
                      ? `${new Date(r.period_start + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${new Date(r.period_end + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : new Date(r.submitted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                    {r.benessere_generale && <span>😊 {r.benessere_generale}/10</span>}
                    {r.energia_allenamento && <span>⚡ {r.energia_allenamento}/10</span>}
                    {r.doms && <span>💪 {r.doms}</span>}
                  </div>
                </div>
                <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text-muted)' }} />
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
