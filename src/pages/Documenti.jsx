import React, { useState } from 'react'
import Anamnesi from './Anamnesi'
import ReportAllenamentoPage from './ReportAllenamentoPage'

export default function Documenti() {
  const [tab, setTab] = useState('anamnesi')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'var(--bg)' }}>
      {/* TAB BAR */}
      <div style={{ display:'flex', background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', flexShrink:0 }}>
        <button onClick={()=>setTab('anamnesi')} style={{
          flex:1, padding:'14px 10px', border:'none', background:'transparent', cursor:'pointer',
          fontFamily:'inherit', fontSize:13, fontWeight:tab==='anamnesi'?700:500,
          color:tab==='anamnesi'?'#D4570A':'var(--text-muted)',
          borderBottom:tab==='anamnesi'?'2.5px solid #D4570A':'2.5px solid transparent',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.15s'
        }}>
          <i className="ti ti-clipboard-heart" style={{fontSize:15}}/>
          Anamnesi
        </button>
        <button onClick={()=>setTab('report')} style={{
          flex:1, padding:'14px 10px', border:'none', background:'transparent', cursor:'pointer',
          fontFamily:'inherit', fontSize:13, fontWeight:tab==='report'?700:500,
          color:tab==='report'?'#7C3AED':'var(--text-muted)',
          borderBottom:tab==='report'?'2.5px solid #7C3AED':'2.5px solid transparent',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.15s'
        }}>
          <i className="ti ti-clipboard-list" style={{fontSize:15}}/>
          Report allenamento
        </button>
      </div>

      {/* CONTENUTO */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {tab === 'anamnesi' && <Anamnesi hideTopbar={true}/>}
        {tab === 'report' && <ReportAllenamentoPage/>}
      </div>
    </div>
  )
}
