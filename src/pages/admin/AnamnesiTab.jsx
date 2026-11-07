import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dbSave } from '../../lib/db'
import Anamnesi from '../Anamnesi'
import { generateAnamnesiPDF } from './anamnesiPdf'

// ─────────────────────────────────────────────────────────
// TAB ANAMNESI
// ─────────────────────────────────────────────────────────
export default function AnamnesiTab({ clients, onRefresh, focus, clearFocus }) {
  const [anamnesi, setAnamnesi] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('nuove')
  const [openAnamnesi, setOpenAnamnesi] = useState(null)

  useEffect(() => { fetchAnamnesi() }, [])
  // arrivo dalla dashboard: si apre l'anamnesi indicata
  useEffect(() => {
    if (focus?.type !== 'anamnesi' || loading) return
    const a = anamnesi.find(x => x.id === focus.id) || anamnesi.find(x => x.client_id === focus.clientId)
    if (a) { setFilter('tutte'); setOpenAnamnesi(a.client_id); if (!a.read_by_coach) markRead(a.id) }
    clearFocus?.()
  }, [focus, loading, anamnesi])

  async function fetchAnamnesi() {
    setLoading(true)
    const { data } = await supabase.from('anamnesi')
      .select('*, profiles!anamnesi_client_id_fkey(full_name)')
      .not('completed_at','is',null)
      .order('completed_at',{ascending:false})
    setAnamnesi(data||[])
    setLoading(false)
  }

  async function markRead(id) {
    await dbSave(supabase.from('anamnesi').update({read_by_coach:true}).eq('id',id), "l'anamnesi", 'salvare', { quiet: true })
    setAnamnesi(p=>p.map(a=>a.id===id?{...a,read_by_coach:true}:a))
  }

  const nonLette = anamnesi.filter(a=>!a.read_by_coach)
  const displayed = filter==='nuove' ? nonLette : anamnesi
  const initials = n=>n?n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase():'?'

  return (
    <div style={{padding:'0 0 40px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:13,color:'#CCC'}}>
          {nonLette.length>0&&<span style={{fontWeight:700,color:'#6FCF97'}}>{nonLette.length} non letta{nonLette.length>1?'e':''} · </span>}
          {anamnesi.length} totali
        </div>
        <div style={{display:'flex',gap:6}}>
          {[{id:'nuove',l:`Non lette (${nonLette.length})`},{id:'tutte',l:`Tutte (${anamnesi.length})`}].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{
              padding:'5px 12px',borderRadius:16,fontSize:11,fontWeight:500,cursor:'pointer',
              border:'0.5px solid',fontFamily:'inherit',
              background:filter===f.id?'#3B6D11':'#161616',
              color:filter===f.id?'white':'#DDD',
              borderColor:filter===f.id?'#3B6D11':'#333'
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading&&<div style={{textAlign:'center',padding:'40px',color:'#CCC'}}>Caricamento...</div>}

      {!loading&&displayed.length===0&&(
        <div style={{textAlign:'center',padding:'60px 20px',background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C'}}>
          <i className="ti ti-clipboard-heart" style={{fontSize:40,color:'#AAA',display:'block',marginBottom:10}}/>
          <div style={{fontSize:13,color:'#CCC'}}>Nessuna anamnesi {filter==='nuove'?'non letta':'compilata'}.</div>
        </div>
      )}

      {displayed.map(a=>{
        const clientName = a.profiles?.full_name || clients.find(c=>c.id===a.client_id)?.full_name || '—'
        const isNew = !a.read_by_coach
        return (
          <div key={a.id} style={{background:'#0D0D0D',borderRadius:12,border:`0.5px solid ${isNew?'rgba(111,207,151,0.55)':'#1C1C1C'}`,marginBottom:10,overflow:'hidden'}}>
            <div style={{padding:'14px',display:'flex',alignItems:'center',gap:12,background:isNew?'rgba(59,140,90,0.12)':'#0D0D0D'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:isNew?'#3B6D11':'#333',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                {initials(clientName)}
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>{clientName}</span>
                  {isNew&&<span style={{fontSize:10,background:'#3B6D11',color:'white',padding:'2px 8px',borderRadius:8,fontWeight:600}}>NUOVA</span>}
                </div>
                <div style={{fontSize:11,color:'#CCC'}}>
                  Completata il {new Date(a.completed_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
                  {a.obiettivo&&` · Obiettivo: ${a.obiettivo}`}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>{setOpenAnamnesi(a.client_id);if(isNew)markRead(a.id)}} style={{
                  background:'rgba(74,144,212,0.14)',color:'#8CC2F5',border:'0.5px solid rgba(74,144,212,0.5)',
                  borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:4
                }}>
                  <i className="ti ti-eye" style={{fontSize:12}}/>Apri
                </button>
                <button onClick={()=>{generateAnamnesiPDF(a,clientName);if(isNew)markRead(a.id)}} style={{
                  background:'rgba(59,140,90,0.14)',color:'#6FCF97',border:'0.5px solid rgba(111,207,151,0.5)',
                  borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:4
                }}>
                  <i className="ti ti-file-type-pdf" style={{fontSize:12}}/>PDF
                </button>
                {isNew&&<button onClick={()=>markRead(a.id)} style={{background:'#161616',color:'#CCC',border:'0.5px solid #1C1C1C',borderRadius:7,padding:'6px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✓ Letta</button>}
              </div>
            </div>
          </div>
        )
      })}

      {openAnamnesi && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{width:'100%',maxWidth:640,maxHeight:'90vh',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <Anamnesi clientId={openAnamnesi} onClose={()=>setOpenAnamnesi(null)}/>
          </div>
        </div>
      )}
    </div>
  )
}
