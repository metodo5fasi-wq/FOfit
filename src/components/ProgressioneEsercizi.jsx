import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'

export default function ProgressioneEsercizi({ clientId }) {
  const [logs, setLogs] = useState([])
  const [exercises, setExercises] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    async function fetch() {
      const thirtyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]
      const { data } = await supabase.from('workout_logs')
        .select('exercise_name, weight_kg, reps, log_date')
        .eq('client_id', clientId)
        .gte('log_date', thirtyDaysAgo)
        .not('weight_kg', 'is', null)
        .order('log_date', { ascending: true })
      const d = data || []
      setLogs(d)
      // Lista esercizi unici con peso
      const exMap = {}
      d.forEach(l => {
        if (!l.weight_kg) return
        if (!exMap[l.exercise_name]) exMap[l.exercise_name] = { name: l.exercise_name, maxWeight: 0, sessions: 0 }
        if (l.weight_kg > exMap[l.exercise_name].maxWeight) exMap[l.exercise_name].maxWeight = l.weight_kg
        exMap[l.exercise_name].sessions++
      })
      const exList = Object.values(exMap).sort((a,b) => b.sessions-a.sessions)
      setExercises(exList)
      if (exList.length) setSelected(exList[0].name)
      setLoading(false)
    }
    fetch()
  }, [clientId])

  if (loading) return <div style={{fontSize:12,color:'#888780',padding:'8px 0'}}>Caricamento...</div>
  if (!exercises.length) return <div style={{fontSize:12,color:'#888780',padding:'8px 0'}}>Nessun log allenamento disponibile</div>

  // Dati per il grafico dell'esercizio selezionato
  const exLogs = logs.filter(l => l.exercise_name === selected)
  const byDate = {}
  exLogs.forEach(l => {
    if (!byDate[l.log_date] || l.weight_kg > byDate[l.log_date]) byDate[l.log_date] = l.weight_kg
  })
  const chartData = Object.entries(byDate).map(([date, weight]) => ({
    date: new Date(date+'T12:00').toLocaleDateString('it-IT', {day:'numeric', month:'short'}),
    peso: weight
  }))

  // Trend
  const trend = chartData.length > 1 ? chartData[chartData.length-1].peso - chartData[0].peso : 0
  const stagnant = chartData.length >= 3 && chartData.slice(-3).every(d => d.peso === chartData[chartData.length-1].peso)

  return (
    <div>
      {/* Selector esercizi */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
        {exercises.slice(0,8).map(ex => (
          <button key={ex.name} onClick={()=>setSelected(ex.name)} style={{
            padding:'5px 10px', borderRadius:16, fontSize:11, fontWeight:500, cursor:'pointer',
            border:'0.5px solid', fontFamily:'inherit',
            background: selected===ex.name?'#D4570A':'white',
            color: selected===ex.name?'white':'#888780',
            borderColor: selected===ex.name?'#D4570A':'#E0DDD6',
          }}>{ex.name}</button>
        ))}
      </div>

      {/* Header stats */}
      {chartData.length > 0 && (
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:'#111'}}>{chartData[chartData.length-1].peso}kg</div>
            <div style={{fontSize:10,color:'#888780'}}>Ultimo max</div>
          </div>
          {trend !== 0 && (
            <div style={{background:trend>0?'#EAF3DE':'#FEE2E2',padding:'4px 10px',borderRadius:8}}>
              <span style={{fontSize:12,fontWeight:700,color:trend>0?'#3B6D11':'#E24B4A'}}>
                {trend>0?'+':''}{trend.toFixed(1)}kg
              </span>
              <div style={{fontSize:9,color:'#888780'}}>vs inizio</div>
            </div>
          )}
          {stagnant && (
            <div style={{background:'#FEF0E7',padding:'4px 10px',borderRadius:8}}>
              <span style={{fontSize:11,fontWeight:600,color:'#D4570A'}}>⚠ In stallo</span>
              <div style={{fontSize:9,color:'#888780'}}>Ultime 3 sessioni</div>
            </div>
          )}
        </div>
      )}

      {/* Grafico */}
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={chartData} margin={{top:5,right:5,bottom:0,left:-25}}>
            <XAxis dataKey="date" tick={{fontSize:9,fill:'#888780'}} tickLine={false} axisLine={false}
              interval={Math.ceil(chartData.length/4)}/>
            <YAxis tick={{fontSize:9,fill:'#888780'}} tickLine={false} axisLine={false}
              domain={[d=>Math.max(0,d-5), d=>d+5]}/>
            <Tooltip contentStyle={{background:'white',border:'0.5px solid #E0DDD6',borderRadius:8,fontSize:11}}
              formatter={v=>[`${v}kg`,'Max']}/>
            <Line type="monotone" dataKey="peso" stroke="#D4570A" strokeWidth={2}
              dot={{r:3,fill:'#D4570A'}} activeDot={{r:5}}/>
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{fontSize:11,color:'#888780'}}>Dati insufficienti per il grafico (min. 2 sessioni)</div>
      )}
    </div>
  )
}
