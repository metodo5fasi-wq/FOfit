import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SelezionaAllenamentoCliente() {
  const navigate = useNavigate()
  const [clientsWithPlan, setClientsWithPlan] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data: plans } = await supabase
        .from('workout_plans')
        .select('id, title, client_id, profiles(full_name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setClientsWithPlan(plans || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return (
    <>
      <div style={{background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', flexShrink:0}}>
        <div>
          <div style={{fontSize:15, fontWeight:600, color:'#111'}}>Modifica scheda allenamento</div>
          <div style={{fontSize:12, color:'#888780'}}>Seleziona il cliente da modificare</div>
        </div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:'18px 22px'}}>
        {loading && <div style={{textAlign:'center', padding:'40px 0', color:'#888780', fontSize:13}}>Caricamento...</div>}

        {!loading && clientsWithPlan.length === 0 && (
          <div style={{textAlign:'center', padding:'40px 20px', background:'white', borderRadius:12, border:'0.5px solid #E0DDD6'}}>
            <i className="ti ti-barbell" style={{fontSize:44, color:'#E0DDD6', display:'block', marginBottom:14}}/>
            <div style={{fontSize:14, fontWeight:600, color:'#111', marginBottom:6}}>Nessuna scheda attiva</div>
            <div style={{fontSize:13, color:'#888780'}}>Importa prima una scheda di allenamento per i tuoi clienti.</div>
          </div>
        )}

        {!loading && clientsWithPlan.map(plan => (
          <div key={plan.id} onClick={() => navigate(`/modifica-allenamento/${plan.id}`)}
            style={{background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'14px 16px', marginBottom:10, cursor:'pointer', display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
            <div style={{width:40, height:40, borderRadius:10, background:'#FEF0E7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <i className="ti ti-barbell" style={{fontSize:18, color:'#D4570A'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14, fontWeight:700, color:'#111'}}>{plan.profiles?.full_name}</div>
              <div style={{fontSize:12, color:'#888780', marginTop:2}}>{plan.title}</div>
            </div>
            <i className="ti ti-chevron-right" style={{fontSize:18, color:'#E0DDD6'}}/>
          </div>
        ))}
      </div>
    </>
  )
}
