import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'

export default function GraficoPeso({ clientId, targetWeight }) {
  const [data, setData] = useState([])
  const [period, setPeriod] = useState(12) // settimane

  useEffect(() => {
    if (!clientId) return
    const from = new Date(Date.now() - period*7*24*60*60*1000).toISOString().split('T')[0]
    supabase.from('progress_entries').select('entry_date,weight_kg')
      .eq('client_id', clientId).gte('entry_date', from)
      .not('weight_kg', 'is', null).order('entry_date', {ascending:true})
      .then(({data:d}) => setData((d||[]).map(e=>({
        date: new Date(e.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'}),
        peso: parseFloat(e.weight_kg),
      }))))
  }, [clientId, period])

  if (data.length === 0) return (
    <div style={{textAlign:'center',padding:'20px 0',color:'#888780',fontSize:12}}>
      Nessuna misurazione nel periodo selezionato
    </div>
  )

  const min = Math.min(...data.map(d=>d.peso))
  const max = Math.max(...data.map(d=>d.peso))
  const diff = data.length > 1 ? (data[data.length-1].peso - data[0].peso).toFixed(1) : null
  const trend = diff > 0 ? `+${diff}kg` : `${diff}kg`
  const trendColor = diff > 0 ? '#E24B4A' : '#3B6D11'

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:20,fontWeight:800,color:'#111'}}>{data[data.length-1]?.peso}kg</span>
          {diff !== null && <span style={{fontSize:12,fontWeight:600,color:trendColor,background:trendColor+'15',padding:'2px 8px',borderRadius:8}}>{trend}</span>}
        </div>
        <div style={{display:'flex',gap:4}}>
          {[4,8,12,24].map(w=>(
            <button key={w} onClick={()=>setPeriod(w)} style={{padding:'4px 8px',borderRadius:6,border:'0.5px solid',fontSize:10,cursor:'pointer',fontFamily:'inherit',background:period===w?'#D4570A':'white',color:period===w?'white':'#888780',borderColor:period===w?'#D4570A':'#E0DDD6'}}>
              {w}w
            </button>
          ))}
        </div>
      </div>

      {/* Grafico */}
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{top:5,right:5,bottom:0,left:-20}}>
          <XAxis dataKey="date" tick={{fontSize:9,fill:'#888780'}} tickLine={false} axisLine={false}
            interval={Math.ceil(data.length/5)}/>
          <YAxis domain={[min-1, max+1]} tick={{fontSize:9,fill:'#888780'}} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={{background:'white',border:'0.5px solid #E0DDD6',borderRadius:8,fontSize:11}}
            formatter={(v)=>[`${v}kg`,'Peso']}/>
          {targetWeight && <ReferenceLine y={targetWeight} stroke="#3B6D11" strokeDasharray="4 2" label={{value:`Target ${targetWeight}kg`,fontSize:9,fill:'#3B6D11'}}/>}
          <Line type="monotone" dataKey="peso" stroke="#D4570A" strokeWidth={2} dot={{r:3,fill:'#D4570A'}} activeDot={{r:5}}/>
        </LineChart>
      </ResponsiveContainer>

      {/* Min/Max */}
      <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
        <span style={{fontSize:10,color:'#888780'}}>Min: <strong>{min}kg</strong></span>
        <span style={{fontSize:10,color:'#888780'}}>Max: <strong>{max}kg</strong></span>
        <span style={{fontSize:10,color:'#888780'}}>{data.length} misurazioni</span>
      </div>
    </div>
  )
}
