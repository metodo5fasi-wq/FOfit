import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { searchFoods } from '../data/foodDatabase.js'

const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
const MEAL_TYPES = ['Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Spuntino sera']

function macroKcal(p,c,g) { return Math.round((parseFloat(p)||0)*4+(parseFloat(c)||0)*4+(parseFloat(g)||0)*9) }

export default function CreaPiano() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client')
  const { toast } = useToast()

  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(clientId || '')
  const [planName, setPlanName] = useState('Piano alimentare')
  const [kcalTarget, setKcalTarget] = useState('')
  const [protTarget, setProtTarget] = useState('')
  const [carbsTarget, setCarbsTarget] = useState('')
  const [fatTarget, setFatTarget] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [saving, setSaving] = useState(false)

  // Struttura: { 0: [{meal_type:'Colazione', foods:[{food_name,qty,kcal,prot,carbs,fat}]}], ... }
  const [days, setDays] = useState(() => {
    const d = {}
    for (let i=0;i<7;i++) d[i] = []
    return d
  })

  // Ricerca alimenti
  const [foodSearch, setFoodSearch] = useState('')
  const [foodResults, setFoodResults] = useState([])
  const [addingTo, setAddingTo] = useState(null) // {dayIdx, mealIdx}
  const [newQty, setNewQty] = useState('100')

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  function searchFood(q) {
    setFoodSearch(q)
    if (q.length < 2) { setFoodResults([]); return }
    setFoodResults(searchFoods(q).slice(0, 10))
  }

  function addMeal(dayIdx) {
    setDays(prev => {
      const d = {...prev}
      d[dayIdx] = [...d[dayIdx], { meal_type: MEAL_TYPES[0], foods: [] }]
      return d
    })
  }

  function removeMeal(dayIdx, mealIdx) {
    setDays(prev => {
      const d = {...prev}
      d[dayIdx] = d[dayIdx].filter((_,i) => i !== mealIdx)
      return d
    })
  }

  function setMealType(dayIdx, mealIdx, type) {
    setDays(prev => {
      const d = {...prev}
      d[dayIdx][mealIdx] = {...d[dayIdx][mealIdx], meal_type: type}
      return d
    })
  }

  function addFood(food) {
    if (!addingTo) return
    const {dayIdx, mealIdx} = addingTo
    const qty = parseFloat(newQty) || 100
    const item = {
      food_name: food.name,
      quantity_g: qty,
      kcal: Math.round(food.kcal100 * qty / 100),
      protein_g: Math.round(food.p * qty / 100 * 10) / 10,
      carbs_g: Math.round(food.c * qty / 100 * 10) / 10,
      fat_g: Math.round(food.g * qty / 100 * 10) / 10,
      _k100: food.kcal100, _p100: food.p, _c100: food.c, _g100: food.g,
    }
    setDays(prev => {
      const d = {...prev}
      d[dayIdx][mealIdx].foods = [...d[dayIdx][mealIdx].foods, item]
      return d
    })
    setFoodSearch('')
    setFoodResults([])
    setNewQty('100')
  }

  function removeFood(dayIdx, mealIdx, foodIdx) {
    setDays(prev => {
      const d = {...prev}
      d[dayIdx][mealIdx].foods = d[dayIdx][mealIdx].foods.filter((_,i) => i !== foodIdx)
      return d
    })
  }

  function updateFoodQty(dayIdx, mealIdx, foodIdx, qty) {
    setDays(prev => {
      const d = {...prev}
      const f = d[dayIdx][mealIdx].foods[foodIdx]
      const q = parseFloat(qty) || 0
      d[dayIdx][mealIdx].foods[foodIdx] = {
        ...f, quantity_g: q,
        kcal: Math.round((f._k100||0) * q / 100),
        protein_g: Math.round((f._p100||0) * q / 100 * 10) / 10,
        carbs_g: Math.round((f._c100||0) * q / 100 * 10) / 10,
        fat_g: Math.round((f._g100||0) * q / 100 * 10) / 10,
      }
      return d
    })
  }

  // Totali giornalieri
  function dayTotals(dayIdx) {
    const meals = days[dayIdx] || []
    return meals.reduce((acc, m) => {
      m.foods.forEach(f => {
        acc.kcal += parseFloat(f.kcal)||0
        acc.prot += parseFloat(f.protein_g)||0
        acc.carbs += parseFloat(f.carbs_g)||0
        acc.fat += parseFloat(f.fat_g)||0
      })
      return acc
    }, {kcal:0,prot:0,carbs:0,fat:0})
  }

  // Copia giorno su altri giorni
  function copyDay(fromIdx, toIdx) {
    setDays(prev => {
      const d = {...prev}
      d[toIdx] = JSON.parse(JSON.stringify(d[fromIdx]))
      return d
    })
    toast('Giorno copiato ✓', 'success')
  }

  async function savePlan() {
    if (!selectedClient) { toast('Seleziona un cliente', 'error'); return }
    const hasMeals = Object.values(days).some(d => d.length > 0)
    if (!hasMeals) { toast('Aggiungi almeno un pasto', 'error'); return }
    setSaving(true)
    try {
      // Disattiva piano esistente
      await supabase.from('meal_plans').update({is_active:false}).eq('client_id', selectedClient)

      // Crea piano
      const { data: plan, error: planErr } = await supabase.from('meal_plans').insert({
        client_id: selectedClient,
        name: planName,
        is_active: true,
        kcal_target: parseInt(kcalTarget)||null,
        protein_target_g: parseInt(protTarget)||null,
        carbs_target_g: parseInt(carbsTarget)||null,
        fat_target_g: parseInt(fatTarget)||null,
      }).select().single()
      if (planErr) throw planErr

      // Crea pasti e alimenti per ogni giorno
      for (const [dayIdx, meals] of Object.entries(days)) {
        const dayName = DAY_NAMES[parseInt(dayIdx)]
        for (const [mealIdx, meal] of meals.entries()) {
          if (!meal.foods.length) continue
          const { data: mealData, error: mealErr } = await supabase.from('plan_meals').insert({
            plan_id: plan.id,
            meal_type: meal.meal_type,
            day_of_week: parseInt(dayIdx),
            day_label: dayName,
            sort_order: mealIdx,
          }).select().single()
          if (mealErr) throw mealErr

          const foods = meal.foods.map((f,fi) => ({
            plan_meal_id: mealData.id,
            food_name: f.food_name,
            quantity_g: f.quantity_g,
            kcal: f.kcal,
            protein_g: f.protein_g,
            carbs_g: f.carbs_g,
            fat_g: f.fat_g,
            sort_order: fi,
          }))
          const { error: foodErr } = await supabase.from('plan_meal_foods').insert(foods)
          if (foodErr) throw foodErr
        }
      }

      toast('Piano creato con successo! 🎉', 'success')
      setTimeout(() => navigate(`/modifica-piano/${plan.id}`), 1000)
    } catch(e) {
      console.error(e)
      toast('Errore: ' + e.message, 'error')
    }
    setSaving(false)
  }

  const s = {
    page: {minHeight:'100dvh',background:'var(--bg)',color:'var(--text)',fontFamily:'inherit'},
    topbar: {background:'var(--bg-card)',borderBottom:'0.5px solid var(--border)',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50},
    card: {background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:10,border:'0.5px solid var(--border)'},
    label: {fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6},
    input: {width:'100%',padding:'9px 12px',border:'0.5px solid var(--border)',borderRadius:8,fontSize:14,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    select: {width:'100%',padding:'9px 12px',border:'0.5px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    btn: {padding:'10px 18px',background:'#D4570A',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
    btnGray: {padding:'8px 14px',background:'var(--bg-input)',color:'var(--text-muted)',border:'0.5px solid var(--border)',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'},
    btnDanger: {padding:'5px 10px',background:'none',color:'#E24B4A',border:'0.5px solid #E24B4A',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'},
  }

  const tot = dayTotals(selectedDay)

  return (
    <div style={s.page}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <button onClick={()=>navigate('/admin')} style={{width:32,height:32,borderRadius:8,border:'0.5px solid var(--border)',background:'var(--bg-input)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text)',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>Crea Piano Alimentare</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Costruisci la dieta giorno per giorno</div>
        </div>
        <button onClick={savePlan} disabled={saving} style={{...s.btn,display:'flex',alignItems:'center',gap:6}}>
          <i className="ti ti-device-floppy" style={{fontSize:14}}/>
          {saving ? 'Salvo...' : 'Salva piano'}
        </button>
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'16px'}}>

        {/* INFO PIANO */}
        <div style={s.card}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={s.label}>Cliente</label>
              <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                <option value="">— Seleziona cliente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={s.label}>Nome piano</label>
              <input style={s.input} value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="es. Piano ipocalorico fase 1"/>
            </div>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Target giornaliero</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[
              {label:'Kcal',val:kcalTarget,set:setKcalTarget,c:'#D4570A'},
              {label:'Proteine (g)',val:protTarget,set:v=>{setProtTarget(v);setKcalTarget(macroKcal(v,carbsTarget,fatTarget)||'')},c:'#4A90D4'},
              {label:'Carboidrati (g)',val:carbsTarget,set:v=>{setCarbsTarget(v);setKcalTarget(macroKcal(protTarget,v,fatTarget)||'')},c:'#E8A020'},
              {label:'Grassi (g)',val:fatTarget,set:v=>{setFatTarget(v);setKcalTarget(macroKcal(protTarget,carbsTarget,v)||'')},c:'#3B8C5A'},
            ].map(f => (
              <div key={f.label}>
                <label style={{...s.label,color:f.c}}>{f.label}</label>
                <input style={{...s.input,borderColor:f.c+'44',textAlign:'center',fontWeight:700,color:f.c}} type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder="—"/>
              </div>
            ))}
          </div>
        </div>

        {/* GIORNI */}
        <div style={{display:'flex',gap:6,marginBottom:12,overflowX:'auto',paddingBottom:4}}>
          {DAY_NAMES.map((d,i) => {
            const t = dayTotals(i)
            const hasMeals = days[i].length > 0
            return (
              <button key={i} onClick={()=>setSelectedDay(i)} style={{
                flexShrink:0,padding:'8px 12px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                background: selectedDay===i ? '#D4570A' : hasMeals ? 'var(--bg-input)' : 'var(--bg-card)',
                color: selectedDay===i ? 'white' : hasMeals ? 'var(--text)' : 'var(--text-muted)',
                border: selectedDay===i ? 'none' : '0.5px solid var(--border)',
                fontWeight: selectedDay===i ? 700 : 400,
              }}>
                <div style={{fontSize:12,fontWeight:700}}>{d.slice(0,3)}</div>
                {hasMeals && <div style={{fontSize:10,marginTop:2,color:selectedDay===i?'rgba(255,255,255,0.8)':'#D4570A'}}>{Math.round(t.kcal)} kcal</div>}
              </button>
            )
          })}
        </div>

        {/* BARRE MACRO GIORNO */}
        {days[selectedDay].length > 0 && (
          <div style={{...s.card,padding:'10px 14px',marginBottom:10}}>
            <div style={{display:'flex',gap:8}}>
              {[
                {l:'Kcal',v:Math.round(tot.kcal),t:parseInt(kcalTarget)||0,c:'#D4570A'},
                {l:'P',v:Math.round(tot.prot*10)/10,t:parseInt(protTarget)||0,c:'#4A90D4'},
                {l:'C',v:Math.round(tot.carbs*10)/10,t:parseInt(carbsTarget)||0,c:'#E8A020'},
                {l:'G',v:Math.round(tot.fat*10)/10,t:parseInt(fatTarget)||0,c:'#3B8C5A'},
              ].map(m => {
                const pct = m.t > 0 ? Math.min(Math.round(m.v/m.t*100),120) : 0
                const color = pct>110?'#E24B4A':pct>=90?'#3B6D11':m.c
                return (
                  <div key={m.l} style={{flex:1,textAlign:'center'}}>
                    <div style={{fontSize:9,color:m.c,fontWeight:700,marginBottom:2}}>{m.l}</div>
                    <div style={{fontSize:14,fontWeight:800,color}}>{m.v}</div>
                    <div style={{height:4,background:'var(--border)',borderRadius:3,margin:'3px 0',overflow:'hidden'}}>
                      <div style={{height:4,background:color,width:`${Math.min(pct,100)}%`,borderRadius:3,transition:'width 0.3s'}}/>
                    </div>
                    <div style={{fontSize:9,color:'var(--text-muted)'}}>{m.t>0?`/ ${m.t}`:''}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* COPIA GIORNO */}
        {days[selectedDay].length > 0 && (
          <div style={{marginBottom:12,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>Copia {DAY_NAMES[selectedDay]} su:</span>
            {DAY_NAMES.map((d,i) => i!==selectedDay && (
              <button key={i} onClick={()=>copyDay(selectedDay,i)} style={s.btnGray}>{d.slice(0,3)}</button>
            ))}
          </div>
        )}

        {/* PASTI DEL GIORNO */}
        {days[selectedDay].map((meal, mealIdx) => (
          <div key={mealIdx} style={s.card}>
            {/* Header pasto */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <select style={{...s.select,flex:1,fontWeight:700,fontSize:14}} value={meal.meal_type} onChange={e=>setMealType(selectedDay,mealIdx,e.target.value)}>
                {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={()=>removeMeal(selectedDay,mealIdx)} style={s.btnDanger}>
                <i className="ti ti-trash" style={{fontSize:13}}/>
              </button>
            </div>

            {/* Alimenti */}
            {meal.foods.map((food, foodIdx) => (
              <div key={foodIdx} style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg-input)',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{food.food_name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>
                    {food.kcal} kcal · P {food.protein_g}g · C {food.carbs_g}g · G {food.fat_g}g
                  </div>
                </div>
                <input type="number" value={food.quantity_g}
                  onChange={e=>updateFoodQty(selectedDay,mealIdx,foodIdx,e.target.value)}
                  style={{width:60,padding:'5px 6px',border:'0.5px solid var(--border)',borderRadius:6,fontSize:12,textAlign:'center',color:'var(--text)',background:'var(--bg-card)',outline:'none',fontFamily:'inherit'}}/>
                <span style={{fontSize:11,color:'var(--text-muted)',flexShrink:0}}>g</span>
                <button onClick={()=>removeFood(selectedDay,mealIdx,foodIdx)} style={{...s.btnDanger,padding:'4px 8px'}}>✕</button>
              </div>
            ))}

            {/* Totale pasto */}
            {meal.foods.length > 0 && (
              <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'right',marginTop:6,marginBottom:8}}>
                Totale: <strong style={{color:'var(--text)'}}>{meal.foods.reduce((s,f)=>s+(parseFloat(f.kcal)||0),0)} kcal</strong>
                {' · '}P {Math.round(meal.foods.reduce((s,f)=>s+(parseFloat(f.protein_g)||0),0)*10)/10}g
                {' · '}C {Math.round(meal.foods.reduce((s,f)=>s+(parseFloat(f.carbs_g)||0),0)*10)/10}g
                {' · '}G {Math.round(meal.foods.reduce((s,f)=>s+(parseFloat(f.fat_g)||0),0)*10)/10}g
              </div>
            )}

            {/* Aggiungi alimento */}
            {addingTo?.dayIdx===selectedDay && addingTo?.mealIdx===mealIdx ? (
              <div style={{borderTop:'0.5px solid var(--border)',paddingTop:10,marginTop:4}}>
                <div style={{display:'flex',gap:8,marginBottom:8}}>
                  <input style={{...s.input,flex:1}} value={foodSearch} onChange={e=>searchFood(e.target.value)}
                    placeholder="Cerca alimento..." autoFocus/>
                  <input type="number" value={newQty} onChange={e=>setNewQty(e.target.value)}
                    style={{...s.input,width:70,textAlign:'center'}} placeholder="g"/>
                </div>
                {foodResults.length > 0 && (
                  <div style={{background:'var(--bg-input)',borderRadius:8,border:'0.5px solid var(--border)',maxHeight:200,overflowY:'auto'}}>
                    {foodResults.map((f,i) => (
                      <div key={i} onClick={()=>addFood(f)}
                        style={{padding:'10px 12px',cursor:'pointer',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{f.name}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>{f.brand}</div>
                        </div>
                        <div style={{fontSize:11,color:'#D4570A',fontWeight:700,flexShrink:0}}>
                          {Math.round(f.kcal100*parseFloat(newQty||100)/100)} kcal
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={()=>{setAddingTo(null);setFoodSearch('');setFoodResults([])}} style={{...s.btnGray,marginTop:6}}>
                  Annulla
                </button>
              </div>
            ) : (
              <button onClick={()=>{setAddingTo({dayIdx:selectedDay,mealIdx});setFoodSearch('');setFoodResults([])}}
                style={{...s.btnGray,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:4}}>
                <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi alimento
              </button>
            )}
          </div>
        ))}

        {/* AGGIUNGI PASTO */}
        <button onClick={()=>addMeal(selectedDay)}
          style={{...s.btn,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'13px',marginBottom:20}}>
          <i className="ti ti-plus" style={{fontSize:16}}/>Aggiungi pasto — {DAY_NAMES[selectedDay]}
        </button>
      </div>
    </div>
  )
}
