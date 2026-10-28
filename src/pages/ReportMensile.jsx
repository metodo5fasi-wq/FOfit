import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', padding:'16px', marginBottom:12 },
}

export default function ReportMensile() {
  const { profile } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!profile) return
    supabase.from('monthly_reports').select('*')
      .eq('client_id', profile.id)
      .order('report_date', { ascending: false })
      .then(({ data }) => { setReports(data||[]); setLoading(false) })
  }, [profile])

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#F0F0F0'}}>Report mensili</div>
          <div style={{fontSize:12,color:'#CCC'}}>Analisi del tuo percorso</div>
        </div>
      </div>
      <div style={s.page}>
        {loading && <div style={{textAlign:'center',padding:'40px 0',color:'#CCC',fontSize:13}}>Caricamento...</div>}

        {!loading && reports.length === 0 && (
          <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
            <i className="ti ti-chart-bar" style={{fontSize:44,color:'#E0DDD6',display:'block',marginBottom:14}}/>
            <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0',marginBottom:6}}>Nessun report ancora</div>
            <div style={{fontSize:13,color:'#CCC',lineHeight:1.6}}>Il tuo coach genererà il primo report dopo il primo mese di percorso.</div>
          </div>
        )}

        {!loading && reports.map(r => (
          <div key={r.id} style={s.card}>
            <div onClick={()=>setExpanded(expanded===r.id?null:r.id)} style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
              <div style={{width:40,height:40,borderRadius:10,background:'rgba(212,87,10,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className="ti ti-chart-line" style={{fontSize:18,color:'#D4570A'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>
                  Report {new Date(r.report_date+'T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
                </div>
                <div style={{fontSize:11,color:'#CCC',marginTop:2}}>
                  {new Date(r.period_start+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})} – {new Date(r.period_end+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}
                </div>
              </div>
              <i className={`ti ti-chevron-${expanded===r.id?'up':'down'}`} style={{fontSize:16,color:'#CCC'}}/>
            </div>
            {expanded===r.id && (
              <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid #1A1A1A',fontSize:13,color:'#F0F0F0',lineHeight:1.8,whiteSpace:'pre-line'}}>
                {r.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
