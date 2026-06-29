import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MUSCLE_GROUPS = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Gambe','Quadricipiti','Femorali','Polpacci','Glutei','Addominali','Cardio','Corpo libero','Altro']

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 16px' },
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', marginBottom:10, overflow:'hidden' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  btnDanger: { background:'#FEE2E2', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:7, padding:'5px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 },
  input: { padding:'7px 10px', border:'0.5px solid #E0DDD6', borderRadius:7, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  label: { fontSize:10, color:'#888780', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.07em' },
}

const EMPTY_EX = { exercise_name:'', muscle_group:'Petto', video_url:'', description:'', sets:3, reps:'10-12', rest_seconds:60, tut:'', progression_type:'none', progression_start_kg:'', progression_increment_kg:2.5, progression_weeks:4, progression_start_date:'', progression_reps_min:8, progression_reps_max:12, progression_rpe_target:8, progression_one_rm:'', progression_config:{}, _isNew:true }

const PROGRESSION_TYPES = [
  { value:'none',    label:'Nessuna',                short:'—',      desc:'Nessuna progressione pianificata' },
  { value:'linear',  label:'📈 Lineare',              short:'+kg/sett', desc:'Aumento fisso di kg ogni settimana' },
  { value:'double',  label:'🔁 Doppia progressione',  short:'Rep→Kg', desc:'Prima aumenta le reps nel range, poi il carico' },
  { value:'wup',     label:'🌊 Ondulazione settimanale (WUP)', short:'WUP', desc:'Carichi diversi in ciclo settimanale (pesante/medio/leggero)' },
  { value:'dup',     label:'⚡ Ondulazione giornaliera (DUP)', short:'DUP', desc:'Ogni sessione ha intensità diversa (forza/ipertrofia/resistenza)' },
  { value:'step',    label:'🪜 Step loading + Deload', short:'Step',  desc:'3 settimane di aumento + 1 settimana deload' },
  { value:'block',   label:'🧱 Periodizzazione a blocchi', short:'Block', desc:'Accumulo → Intensificazione → Picco' },
  { value:'oneRm',   label:'💯 % del massimale (1RM)', short:'%1RM', desc:'Carichi calcolati in percentuale del tuo massimale' },
]

function ProgressionForm({ ex, onChange, isNew=false }) {
  const type = ex.progression_type || 'none'
  const set = (field, val) => onChange(field, val)
  const cfg = ex.progression_config || {}
  const setConfig = (key, val) => onChange('progression_config', {...cfg, [key]:val})

  const inputStyle = { width:'100%', padding:'7px 10px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'white', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }
  const labelStyle = { fontSize:10, color:'#D4570A', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }
  const grid2 = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }
  const grid3 = { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:10 }
  const grid4 = { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:10 }

  // Anteprima settimane per progressioni con settimane
  function WeekPreview({ weeks, startKg, increment }) {
    if (!startKg || !weeks) return null
    const start = parseFloat(String(startKg).replace(',','.'))
    const inc = parseFloat(String(increment||2.5).replace(',','.'))
    return (
      <div style={{marginTop:8}}>
        <label style={labelStyle}>Anteprima settimane</label>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {Array.from({length:parseInt(weeks)},(_,i)=>(
            <div key={i} style={{background:'white',borderRadius:6,padding:'4px 8px',fontSize:11,textAlign:'center',border:'0.5px solid #F4C9A8'}}>
              <div style={{fontSize:9,color:'#888780'}}>S{i+1}</div>
              <div style={{fontWeight:700,color:'#D4570A'}}>{(start+i*inc).toFixed(1)}kg</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{gridColumn:'1/-1'}}>
      {/* SELEZIONE TIPO */}
      <label style={{...labelStyle, color:'#888780', fontSize:11}}>Tipo di progressione</label>
      <select
        value={type}
        onChange={e=>set('progression_type', e.target.value)}
        style={{...inputStyle, marginBottom: type==='none'?0:10}}
      >
        {PROGRESSION_TYPES.map(p=>(
          <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>
        ))}
      </select>

      {/* ── LINEARE ── */}
      {type==='linear' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={grid4}>
            <div><label style={labelStyle}>Carico S1 (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_start_kg||''} onChange={e=>set('progression_start_kg',e.target.value)} placeholder="es. 60"/></div>
            <div><label style={labelStyle}>+kg/settimana</label><input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_increment_kg||2.5} onChange={e=>set('progression_increment_kg',e.target.value)}/></div>
            <div><label style={labelStyle}>Settimane</label><input style={inputStyle} type="number" value={ex.progression_weeks||4} onChange={e=>set('progression_weeks',e.target.value)}/></div>
            <div><label style={labelStyle}>Data inizio</label><input style={inputStyle} type="date" value={ex.progression_start_date||''} onChange={e=>set('progression_start_date',e.target.value)}/></div>
          </div>
          <WeekPreview weeks={ex.progression_weeks} startKg={ex.progression_start_kg} increment={ex.progression_increment_kg}/>
        </div>
      )}

      {/* ── DOPPIA PROGRESSIONE ── */}
      {type==='double' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={{fontSize:11,color:'#888780',marginBottom:8,lineHeight:1.5}}>
            Il cliente aumenta le reps fino al massimo del range. Quando raggiunge il limite superiore, aumenta il carico e ricomincia dal minimo.
          </div>
          <div style={grid2}>
            <div><label style={labelStyle}>Carico iniziale (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_start_kg||''} onChange={e=>set('progression_start_kg',e.target.value)} placeholder="es. 60"/></div>
            <div><label style={labelStyle}>Aumento carico (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_increment_kg||2.5} onChange={e=>set('progression_increment_kg',e.target.value)}/></div>
            <div><label style={labelStyle}>Reps minimo</label><input style={inputStyle} type="number" value={ex.progression_reps_min||8} onChange={e=>set('progression_reps_min',e.target.value)} placeholder="es. 8"/></div>
            <div><label style={labelStyle}>Reps massimo</label><input style={inputStyle} type="number" value={ex.progression_reps_max||12} onChange={e=>set('progression_reps_max',e.target.value)} placeholder="es. 12"/></div>
          </div>
          {ex.progression_start_kg && (
            <div style={{marginTop:8,fontSize:11,color:'#D4570A',background:'white',borderRadius:7,padding:'6px 10px'}}>
              📌 Esempio: {ex.progression_start_kg}kg × {ex.progression_reps_min||8} reps → arriva a {ex.progression_reps_max||12} reps → passa a {parseFloat(String(ex.progression_start_kg).replace(',','.'))+parseFloat(String(ex.progression_increment_kg||2.5).replace(',','.'))}kg × {ex.progression_reps_min||8} reps
            </div>
          )}
        </div>
      )}

      {/* ── WUP — ONDULAZIONE SETTIMANALE ── */}
      {type==='wup' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={{fontSize:11,color:'#888780',marginBottom:8}}>Imposta il carico per ogni tipo di settimana nel ciclo.</div>
          <div style={grid3}>
            <div><label style={labelStyle}>Settimana PESANTE (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={cfg.heavy_kg||''} onChange={e=>setConfig('heavy_kg',e.target.value)} placeholder="es. 80"/></div>
            <div><label style={labelStyle}>Settimana MEDIA (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={cfg.medium_kg||''} onChange={e=>setConfig('medium_kg',e.target.value)} placeholder="es. 70"/></div>
            <div><label style={labelStyle}>Settimana LEGGERA (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={cfg.light_kg||''} onChange={e=>setConfig('light_kg',e.target.value)} placeholder="es. 60"/></div>
            <div><label style={labelStyle}>Serie settimana pesante</label><input style={inputStyle} type="number" value={cfg.heavy_sets||5} onChange={e=>setConfig('heavy_sets',e.target.value)}/></div>
            <div><label style={labelStyle}>Serie settimana media</label><input style={inputStyle} type="number" value={cfg.medium_sets||4} onChange={e=>setConfig('medium_sets',e.target.value)}/></div>
            <div><label style={labelStyle}>Serie settimana leggera</label><input style={inputStyle} type="number" value={cfg.light_sets||3} onChange={e=>setConfig('light_sets',e.target.value)}/></div>
          </div>
          <div style={{marginTop:8}}>
            <label style={labelStyle}>Ciclo (settimane)</label>
            <input style={{...inputStyle,width:80}} type="number" value={cfg.cycle_weeks||3} onChange={e=>setConfig('cycle_weeks',e.target.value)}/>
          </div>
          <div style={{marginTop:8,fontSize:11,color:'#D4570A',background:'white',borderRadius:7,padding:'6px 10px'}}>
            📌 Ciclo: {cfg.heavy_kg||'?'}kg (S1) → {cfg.medium_kg||'?'}kg (S2) → {cfg.light_kg||'?'}kg (S3) → ripete
          </div>
        </div>
      )}

      {/* ── DUP — ONDULAZIONE GIORNALIERA ── */}
      {type==='dup' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={{fontSize:11,color:'#888780',marginBottom:8}}>Ogni sessione ha intensità diversa nella stessa settimana.</div>
          <div style={grid3}>
            <div>
              <label style={labelStyle}>Sessione FORZA</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={cfg.strength_kg||''} onChange={e=>setConfig('strength_kg',e.target.value)} placeholder="kg"/>
              <input style={{...inputStyle,marginTop:4}} type="text" value={cfg.strength_reps||'3-5'} onChange={e=>setConfig('strength_reps',e.target.value)} placeholder="reps es. 3-5"/>
            </div>
            <div>
              <label style={labelStyle}>Sessione IPERTROFIA</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={cfg.hypertrophy_kg||''} onChange={e=>setConfig('hypertrophy_kg',e.target.value)} placeholder="kg"/>
              <input style={{...inputStyle,marginTop:4}} type="text" value={cfg.hypertrophy_reps||'8-12'} onChange={e=>setConfig('hypertrophy_reps',e.target.value)} placeholder="reps es. 8-12"/>
            </div>
            <div>
              <label style={labelStyle}>Sessione RESISTENZA</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={cfg.endurance_kg||''} onChange={e=>setConfig('endurance_kg',e.target.value)} placeholder="kg"/>
              <input style={{...inputStyle,marginTop:4}} type="text" value={cfg.endurance_reps||'15-20'} onChange={e=>setConfig('endurance_reps',e.target.value)} placeholder="reps es. 15-20"/>
            </div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:'#D4570A',background:'white',borderRadius:7,padding:'6px 10px'}}>
            📌 Lun: Forza {cfg.strength_kg||'?'}kg × {cfg.strength_reps||'3-5'} | Mer: Ipertrofia {cfg.hypertrophy_kg||'?'}kg × {cfg.hypertrophy_reps||'8-12'} | Ven: Resistenza {cfg.endurance_kg||'?'}kg × {cfg.endurance_reps||'15-20'}
          </div>
        </div>
      )}

      {/* ── STEP LOADING ── */}
      {type==='step' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={{fontSize:11,color:'#888780',marginBottom:8}}>3 settimane di aumento progressivo + 1 settimana di deload a carico ridotto.</div>
          <div style={grid4}>
            <div><label style={labelStyle}>Carico S1 (kg)</label><input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_start_kg||''} onChange={e=>set('progression_start_kg',e.target.value)} placeholder="es. 60"/></div>
            <div><label style={labelStyle}>+kg ogni step</label><input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_increment_kg||5} onChange={e=>set('progression_increment_kg',e.target.value)}/></div>
            <div><label style={labelStyle}>Settimane per step</label><input style={inputStyle} type="number" value={cfg.step_weeks||3} onChange={e=>setConfig('step_weeks',e.target.value)}/></div>
            <div><label style={labelStyle}>Deload % carico</label><input style={inputStyle} type="number" value={cfg.deload_pct||60} onChange={e=>setConfig('deload_pct',e.target.value)} placeholder="es. 60"/></div>
          </div>
          {ex.progression_start_kg && (
            <div style={{marginTop:8}}>
              <label style={labelStyle}>Anteprima blocco</label>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {Array.from({length:parseInt(cfg.step_weeks||3)+1},(_,i)=>{
                  const start = parseFloat(String(ex.progression_start_kg).replace(',','.'))
                  const inc = parseFloat(String(ex.progression_increment_kg||5).replace(',','.'))
                  const isDeload = i===parseInt(cfg.step_weeks||3)
                  const kg = isDeload ? Math.round(start*(parseInt(cfg.deload_pct||60)/100)*2)/2 : start+i*inc
                  return (
                    <div key={i} style={{background:isDeload?'#EBF3FD':'white',borderRadius:6,padding:'4px 8px',fontSize:11,textAlign:'center',border:`0.5px solid ${isDeload?'#4A90D4':'#F4C9A8'}`}}>
                      <div style={{fontSize:9,color:isDeload?'#4A90D4':'#888780'}}>{isDeload?'DELOAD':`S${i+1}`}</div>
                      <div style={{fontWeight:700,color:isDeload?'#4A90D4':'#D4570A'}}>{kg.toFixed(1)}kg</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PERIODIZZAZIONE A BLOCCHI ── */}
      {type==='block' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={{fontSize:11,color:'#888780',marginBottom:8}}>3 blocchi sequenziali: accumulo (volume) → intensificazione (intensità) → picco (massimale).</div>
          <div style={grid3}>
            <div style={{background:'white',borderRadius:8,padding:'10px'}}>
              <label style={{...labelStyle,color:'#3B6D11'}}>BLOCCO 1 — Accumulo</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={cfg.block1_kg||''} onChange={e=>setConfig('block1_kg',e.target.value)} placeholder="kg"/>
              <input style={{...inputStyle,marginTop:4}} type="text" value={cfg.block1_reps||'12-15'} onChange={e=>setConfig('block1_reps',e.target.value)} placeholder="reps"/>
              <input style={{...inputStyle,marginTop:4}} type="number" value={cfg.block1_weeks||4} onChange={e=>setConfig('block1_weeks',e.target.value)} placeholder="settimane"/>
            </div>
            <div style={{background:'white',borderRadius:8,padding:'10px'}}>
              <label style={{...labelStyle,color:'#E8A020'}}>BLOCCO 2 — Intensificazione</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={cfg.block2_kg||''} onChange={e=>setConfig('block2_kg',e.target.value)} placeholder="kg"/>
              <input style={{...inputStyle,marginTop:4}} type="text" value={cfg.block2_reps||'6-8'} onChange={e=>setConfig('block2_reps',e.target.value)} placeholder="reps"/>
              <input style={{...inputStyle,marginTop:4}} type="number" value={cfg.block2_weeks||3} onChange={e=>setConfig('block2_weeks',e.target.value)} placeholder="settimane"/>
            </div>
            <div style={{background:'white',borderRadius:8,padding:'10px'}}>
              <label style={{...labelStyle,color:'#E24B4A'}}>BLOCCO 3 — Picco</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={cfg.block3_kg||''} onChange={e=>setConfig('block3_kg',e.target.value)} placeholder="kg"/>
              <input style={{...inputStyle,marginTop:4}} type="text" value={cfg.block3_reps||'1-3'} onChange={e=>setConfig('block3_reps',e.target.value)} placeholder="reps"/>
              <input style={{...inputStyle,marginTop:4}} type="number" value={cfg.block3_weeks||2} onChange={e=>setConfig('block3_weeks',e.target.value)} placeholder="settimane"/>
            </div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:'#888780'}}>
            Durata totale: {(parseInt(cfg.block1_weeks||4)+parseInt(cfg.block2_weeks||3)+parseInt(cfg.block3_weeks||2))} settimane
          </div>
        </div>
      )}

      {/* ── % 1RM ── */}
      {type==='oneRm' && (
        <div style={{background:'#FEF0E7',borderRadius:10,padding:'12px'}}>
          <div style={{fontSize:11,color:'#888780',marginBottom:8}}>Inserisci il massimale (1RM) e imposta le % per ogni settimana.</div>
          <div style={grid2}>
            <div>
              <label style={labelStyle}>1RM attuale (kg)</label>
              <input style={inputStyle} type="text" inputMode="decimal" value={ex.progression_one_rm||''} onChange={e=>set('progression_one_rm',e.target.value)} placeholder="es. 100"/>
            </div>
            <div>
              <label style={labelStyle}>Settimane totali</label>
              <input style={inputStyle} type="number" value={ex.progression_weeks||4} onChange={e=>set('progression_weeks',e.target.value)}/>
            </div>
          </div>
          <div style={{marginTop:10}}>
            <label style={labelStyle}>% 1RM per settimana (separati da virgola)</label>
            <input style={inputStyle} value={cfg.percentages||'65,70,75,80'} onChange={e=>setConfig('percentages',e.target.value)} placeholder="es. 65,70,75,80"/>
          </div>
          {ex.progression_one_rm && cfg.percentages && (
            <div style={{marginTop:8}}>
              <label style={labelStyle}>Carichi calcolati</label>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {cfg.percentages.split(',').map((pct,i)=>{
                  const oneRm = parseFloat(String(ex.progression_one_rm).replace(',','.'))
                  const kg = Math.round(oneRm*(parseFloat(pct.trim())/100)*4)/4
                  return (
                    <div key={i} style={{background:'white',borderRadius:6,padding:'4px 8px',fontSize:11,textAlign:'center',border:'0.5px solid #F4C9A8'}}>
                      <div style={{fontSize:9,color:'#888780'}}>S{i+1} · {pct.trim()}%</div>
                      <div style={{fontWeight:700,color:'#D4570A'}}>{kg}kg</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ModificaAllenamento() {
  const { planId } = useParams()
  const [plan, setPlan] = useState(null)
  const [clientName, setClientName] = useState('')
  const [exercises, setExercises] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [dirty, setDirty] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayLabel, setNewDayLabel] = useState('')
  const [addingExToDay, setAddingExToDay] = useState(null)
  const [newEx, setNewEx] = useState({ ...EMPTY_EX })
  const [expandedEx, setExpandedEx] = useState(null)

  useEffect(() => { if (planId) fetchPlan() }, [planId])

  async function fetchPlan() {
    setLoading(true)
    const { data: planData } = await supabase.from('workout_plans').select('*').eq('id', planId).single()
    if (!planData) { setLoading(false); return }
    setPlan(planData)
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', planData.client_id).single()
    setClientName(prof?.full_name || '')
    const { data: exData } = await supabase.from('workout_exercises').select('*').eq('plan_id', planId).order('order_index', {ascending:true})
    setExercises(exData || [])
    if (exData?.length) {
      const days = [...new Set(exData.map(e=>e.day_label))]
      setSelectedDay(days[0])
    }
    setLoading(false)
  }

  const days = [...new Set(exercises.map(e=>e.day_label))]
  const dayExercises = exercises.filter(e=>e.day_label===selectedDay)

  function updateEx(id, field, value) {
    setExercises(prev => prev.map(e => e.id===id ? {...e, [field]:value} : e))
    setDirty(true)
  }

  function removeEx(id) {
    setExercises(prev => prev.filter(e => e.id!==id))
    setDirty(true)
  }

  function moveEx(id, dir) {
    const dayExs = exercises.filter(e=>e.day_label===selectedDay)
    const idx = dayExs.findIndex(e=>e.id===id)
    if (dir==='up' && idx===0) return
    if (dir==='down' && idx===dayExs.length-1) return
    const swapIdx = dir==='up' ? idx-1 : idx+1
    const newDayExs = [...dayExs]
    ;[newDayExs[idx], newDayExs[swapIdx]] = [newDayExs[swapIdx], newDayExs[idx]]
    const otherExs = exercises.filter(e=>e.day_label!==selectedDay)
    setExercises([...otherExs, ...newDayExs])
    setDirty(true)
  }

  function addExercise() {
    if (!newEx.exercise_name.trim()) return
    const ex = {
      ...newEx,
      id: 'new-' + Date.now(),
      plan_id: planId,
      day_label: selectedDay,
      order_index: dayExercises.length,
    }
    setExercises(prev => [...prev, ex])
    setNewEx({ ...EMPTY_EX })
    setAddingExToDay(null)
    setDirty(true)
  }

  function addDay() {
    if (!newDayLabel.trim()) return
    const ex = {
      ...EMPTY_EX,
      id: 'new-' + Date.now(),
      plan_id: planId,
      day_label: newDayLabel.trim(),
      order_index: 0,
    }
    setExercises(prev => [...prev, ex])
    setSelectedDay(newDayLabel.trim())
    setNewDayLabel('')
    setShowAddDay(false)
    setDirty(true)
  }

  function removeDay(dayLabel) {
    if (!window.confirm(`Rimuovere il giorno "${dayLabel}" e tutti i suoi esercizi?`)) return
    setExercises(prev => prev.filter(e=>e.day_label!==dayLabel))
    const remaining = days.filter(d=>d!==dayLabel)
    setSelectedDay(remaining[0] || null)
    setDirty(true)
  }

  async function saveAll() {
    setSaving(true)
    try {
      // Elimina esercizi rimossi
      const { data: dbExs } = await supabase.from('workout_exercises').select('id').eq('plan_id', planId)
      const currentIds = new Set(exercises.filter(e=>!e._isNew).map(e=>e.id))
      for (const dbEx of dbExs || []) {
        if (!currentIds.has(dbEx.id)) {
          await supabase.from('workout_exercises').delete().eq('id', dbEx.id)
        }
      }

      // Aggiorna/inserisce esercizi
      let orderIdx = 0
      for (const ex of exercises) {
        const payload = {
          plan_id: planId,
          day_label: ex.day_label,
          order_index: orderIdx++,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group || '',
          video_url: ex.video_url || '',
          description: ex.description || '',
          sets: parseInt(ex.sets) || 3,
          reps: ex.reps || '',
          rest_seconds: parseInt(ex.rest_seconds) || 60,
          tut: ex.tut || '',
          progression_type: ex.progression_type || 'none',
          progression_start_kg: ex.progression_start_kg ? parseFloat(String(ex.progression_start_kg).replace(',','.')) : null,
          progression_increment_kg: ex.progression_increment_kg ? parseFloat(String(ex.progression_increment_kg).replace(',','.')) : 2.5,
          progression_weeks: ex.progression_weeks ? parseInt(ex.progression_weeks) : 4,
          progression_start_date: ex.progression_start_date || null,
          progression_reps_min: ex.progression_reps_min ? parseInt(ex.progression_reps_min) : null,
          progression_reps_max: ex.progression_reps_max ? parseInt(ex.progression_reps_max) : null,
          progression_rpe_target: ex.progression_rpe_target ? parseFloat(ex.progression_rpe_target) : null,
          progression_one_rm: ex.progression_one_rm ? parseFloat(String(ex.progression_one_rm).replace(',','.')) : null,
          progression_config: ex.progression_config || {},
        }
        if (ex._isNew) {
          await supabase.from('workout_exercises').insert(payload)
        } else {
          await supabase.from('workout_exercises').update(payload).eq('id', ex.id)
        }
      }

      setDirty(false)
      setSavedMsg('✓ Scheda salvata!')
      setTimeout(() => setSavedMsg(''), 3000)
      fetchPlan()
    } catch(e) {
      setSavedMsg('Errore: ' + e.message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600}}>Modifica scheda</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#888780',fontSize:13}}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#F5F3EF'}}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <Link to="/admin" style={{width:32,height:32,borderRadius:8,border:'0.5px solid #E0DDD6',background:'#F5F3EF',display:'flex',alignItems:'center',justifyContent:'center',color:'#111',textDecoration:'none',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </Link>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'#111'}}>{plan?.title}</div>
          <div style={{fontSize:11,color:'#888780'}}>{clientName} · {days.length} giorni · {exercises.length} esercizi</div>
        </div>
        {dirty && (
          <button onClick={saveAll} disabled={saving} style={s.btn}>
            <i className="ti ti-device-floppy" style={{fontSize:14}}/>
            {saving ? 'Salvo...' : 'Salva'}
          </button>
        )}
        {savedMsg && <div style={{fontSize:12,color:'#3B6D11',fontWeight:600}}>{savedMsg}</div>}
      </div>

      {/* TAB GIORNI */}
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'8px 16px',display:'flex',gap:6,overflowX:'auto',flexShrink:0,alignItems:'center'}}>
        {days.map(day => (
          <div key={day} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
            <button onClick={()=>setSelectedDay(day)} style={{
              padding:'6px 12px',borderRadius:18,fontSize:12,fontWeight:600,cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
              background: selectedDay===day ? '#D4570A' : 'white',
              color: selectedDay===day ? 'white' : '#111',
              borderColor: selectedDay===day ? '#D4570A' : '#E0DDD6',
            }}>{day}</button>
            {selectedDay===day && (
              <button onClick={()=>removeDay(day)} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',padding:'0 2px',fontSize:14}}>×</button>
            )}
          </div>
        ))}
        {showAddDay ? (
          <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
            <input value={newDayLabel} onChange={e=>setNewDayLabel(e.target.value)}
              placeholder="Es. Giorno D - Braccia"
              style={{...s.input,width:200,padding:'5px 8px',fontSize:12}}
              onKeyDown={e=>e.key==='Enter'&&addDay()}
            />
            <button onClick={addDay} style={s.btnSm}>✓</button>
            <button onClick={()=>setShowAddDay(false)} style={s.btnGray}>✕</button>
          </div>
        ) : (
          <button onClick={()=>setShowAddDay(true)} style={{...s.btnGray,flexShrink:0,display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-plus" style={{fontSize:12}}/>Giorno
          </button>
        )}
      </div>

      {/* ESERCIZI */}
      <div style={s.page}>
        {selectedDay && dayExercises.length === 0 && (
          <div style={{textAlign:'center',padding:'30px 0',color:'#888780',fontSize:13}}>
            Nessun esercizio per {selectedDay}. Aggiungine uno.
          </div>
        )}

        {dayExercises.map((ex, ei) => {
          const isExpanded = expandedEx === ex.id
          return (
            <div key={ex.id} style={s.card}>
              {/* HEADER ESERCIZIO */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'}} onClick={()=>setExpandedEx(isExpanded?null:ex.id)}>
                <div style={{width:34,height:34,borderRadius:9,background:'#FEF0E7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <i className="ti ti-barbell" style={{fontSize:16,color:'#D4570A'}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.exercise_name}</div>
                  <div style={{fontSize:11,color:'#888780',marginTop:1}}>{ex.muscle_group} · {ex.sets}×{ex.reps} · {ex.rest_seconds}s{ex.tut ? ` · TUT ${ex.tut}` : ''}{ex.progression_type&&ex.progression_type!=='none' ? ` · 📈 ${PROGRESSION_TYPES.find(p=>p.value===ex.progression_type)?.short||ex.progression_type}` : ''}</div>
                </div>
                <div style={{display:'flex',gap:4,flexShrink:0}}>
                  <button onClick={e=>{e.stopPropagation();moveEx(ex.id,'up')}} style={{...s.btnGray,padding:'4px 7px'}} title="Su"><i className="ti ti-arrow-up" style={{fontSize:12}}/></button>
                  <button onClick={e=>{e.stopPropagation();moveEx(ex.id,'down')}} style={{...s.btnGray,padding:'4px 7px'}} title="Giù"><i className="ti ti-arrow-down" style={{fontSize:12}}/></button>
                  <button onClick={e=>{e.stopPropagation();removeEx(ex.id)}} style={{...s.btnDanger,padding:'4px 7px'}}><i className="ti ti-trash" style={{fontSize:12}}/></button>
                </div>
                <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{fontSize:14,color:'#888780'}}/>
              </div>

              {/* FORM MODIFICA */}
              {isExpanded && (
                <div style={{padding:'14px',borderTop:'0.5px solid #F5F3EF',background:'#FAFAF9'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <div style={{gridColumn:'1/-1'}}>
                      <label style={s.label}>Nome esercizio</label>
                      <input style={s.input} value={ex.exercise_name} onChange={e=>updateEx(ex.id,'exercise_name',e.target.value)}/>
                    </div>
                    <div>
                      <label style={s.label}>Gruppo muscolare</label>
                      <select style={s.input} value={ex.muscle_group||''} onChange={e=>updateEx(ex.id,'muscle_group',e.target.value)}>
                        {MUSCLE_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Link YouTube</label>
                      <input style={s.input} value={ex.video_url||''} onChange={e=>updateEx(ex.id,'video_url',e.target.value)} placeholder="https://youtube.com/..."/>
                    </div>
                    <div>
                      <label style={s.label}>Serie</label>
                      <input style={s.input} type="number" value={ex.sets||''} onChange={e=>updateEx(ex.id,'sets',e.target.value)}/>
                    </div>
                    <div>
                      <label style={s.label}>Ripetizioni</label>
                      <input style={s.input} value={ex.reps||''} onChange={e=>updateEx(ex.id,'reps',e.target.value)} placeholder="8-10"/>
                    </div>
                    <div>
                      <label style={s.label}>Recupero (secondi)</label>
                      <input style={s.input} type="number" value={ex.rest_seconds||''} onChange={e=>updateEx(ex.id,'rest_seconds',e.target.value)}/>
                    </div>
                    <div>
                      <label style={s.label}>TUT (es. 3-1-2-0)</label>
                      <input style={s.input} value={ex.tut||''} onChange={e=>updateEx(ex.id,'tut',e.target.value)} placeholder="eccentrica-pausa-concentrica-pausa"/>
                    </div>

                    {/* PROGRESSIONE */}
                    <ProgressionForm
                      ex={ex}
                      onChange={(field, val) => updateEx(ex.id, field, val)}
                    />
                    <div style={{gridColumn:'1/-1'}}>
                      <label style={s.label}>Note / Istruzioni esecuzione</label>
                      <textarea style={{...s.input,resize:'none',height:60}} value={ex.description||''} onChange={e=>updateEx(ex.id,'description',e.target.value)} placeholder="Istruzioni di esecuzione..."/>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* AGGIUNGI ESERCIZIO */}
        {selectedDay && (
          addingExToDay === selectedDay ? (
            <div style={{...s.card,padding:'14px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#111',marginBottom:10}}>Nuovo esercizio — {selectedDay}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={s.label}>Nome esercizio *</label>
                  <input style={s.input} placeholder="Es. Panca piana" value={newEx.exercise_name} onChange={e=>setNewEx(p=>({...p,exercise_name:e.target.value}))}/>
                </div>
                <div>
                  <label style={s.label}>Gruppo muscolare</label>
                  <select style={s.input} value={newEx.muscle_group} onChange={e=>setNewEx(p=>({...p,muscle_group:e.target.value}))}>
                    {MUSCLE_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Link YouTube</label>
                  <input style={s.input} value={newEx.video_url} onChange={e=>setNewEx(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..."/>
                </div>
                <div>
                  <label style={s.label}>Serie</label>
                  <input style={s.input} type="number" value={newEx.sets} onChange={e=>setNewEx(p=>({...p,sets:e.target.value}))}/>
                </div>
                <div>
                  <label style={s.label}>Ripetizioni</label>
                  <input style={s.input} value={newEx.reps} onChange={e=>setNewEx(p=>({...p,reps:e.target.value}))} placeholder="8-10"/>
                </div>
                <div>
                  <label style={s.label}>Recupero (sec)</label>
                  <input style={s.input} type="number" value={newEx.rest_seconds} onChange={e=>setNewEx(p=>({...p,rest_seconds:e.target.value}))}/>
                </div>
                <div>
                  <label style={s.label}>TUT (es. 3-1-2-0)</label>
                  <input style={s.input} value={newEx.tut||''} onChange={e=>setNewEx(p=>({...p,tut:e.target.value}))} placeholder="eccentrica-pausa-concentrica-pausa"/>
                </div>
                <ProgressionForm
                  ex={newEx}
                  onChange={(field, val) => setNewEx(p=>({...p,[field]:val}))}
                  isNew={true}
                />
                <div style={{gridColumn:'1/-1'}}>
                  <label style={s.label}>Note esecuzione</label>
                  <textarea style={{...s.input,resize:'none',height:50}} value={newEx.description} onChange={e=>setNewEx(p=>({...p,description:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={addExercise} style={{...s.btn,flex:1,justifyContent:'center',fontSize:12}}>
                  <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi esercizio
                </button>
                <button onClick={()=>{setAddingExToDay(null);setNewEx({...EMPTY_EX})}} style={s.btnGray}>Annulla</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setAddingExToDay(selectedDay)} style={{
              width:'100%',padding:'12px',background:'white',border:'0.5px dashed #D4570A',borderRadius:10,
              color:'#D4570A',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:20
            }}>
              <i className="ti ti-plus" style={{fontSize:15}}/>Aggiungi esercizio a {selectedDay}
            </button>
          )
        )}
      </div>
    </div>
  )
}
