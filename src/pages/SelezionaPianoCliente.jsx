import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const initials = name => name ? name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'

export default function SelezionaPianoCliente() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, goal').eq('role','client').order('full_name')
      const { data: plans } = await supabase
        .from('meal_plans').select('id, title, kcal_target, client_id, is_active').eq('is_active', true)

      const planByClient = {}
      ;(plans||[]).forEach(p => { planByClient[p.client_id] = p })

      setClients((profiles||[]).map(c => ({ ...c, plan: planByClient[c.id] || null })))
      setLoading(false)
    }
    fetchAll()
  }, [])

  return (
    <>
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'0 22px',height:56,display:'flex',alignItems:'center',flexShrink:0}}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#111'}}>Modifica piano alimentare</div>
          <div style={{fontSize:12,color:'#888780'}}>Seleziona il cliente</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'18px 22px'}}>
        {loading && <div style={{textAlign:'center',padding:'40px 0',color:'#888780',fontSize:13}}>Caricamento...</div>}
        {!loading && clients.map(c => (
          <div key={c.id} onClick={() => c.plan ? navigate(`/modifica-piano/${c.plan.id}`) : null}
            style={{background:'white',borderRadius:12,border:`0.5px solid ${c.plan?'#E0DDD6':'#F0EDEA'}`,padding:'14px 16px',marginBottom:10,cursor:c.plan?'pointer':'default',display:'flex',alignItems:'center',gap:12,opacity:c.plan?1:0.6}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
              {initials(c.full_name)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:'#111'}}>{c.full_name}</div>
              {c.plan
                ? <div style={{fontSize:12,color:'#3B6D11',marginTop:2}}>✓ {c.plan.title} · {c.plan.kcal_target} kcal</div>
                : <div style={{fontSize:12,color:'#888780',marginTop:2}}>Nessun piano attivo</div>
              }
            </div>
            {c.plan
              ? <i className="ti ti-chevron-right" style={{fontSize:18,color:'#D4570A'}}/>
              : <span style={{fontSize:11,color:'#888780',background:'#F5F3EF',padding:'3px 8px',borderRadius:8}}>Nessun piano</span>
            }
          </div>
        ))}
      </div>
    </>
  )
}
