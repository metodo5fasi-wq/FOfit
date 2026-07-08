import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }
const MEAL_TYPES = ['colazione','spuntino','pranzo','pre-workout','merenda','cena']
const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', marginBottom:12, overflow:'hidden' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  btnDanger: { background:'#FEE2E2', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  input: { padding:'7px 10px', border:'0.5px solid #E0DDD6', borderRadius:7, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  label: { fontSize:10, color:'#888780', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.07em' },
}

// Calcola valori per 100g a partire da quantità e valori assoluti
function per100(val, qty) {
  if (!qty || qty === 0) return 0
  return (val / qty) * 100
}

// Ricalcola i valori in base alla nuova quantità
function recalc(food, newQty) {
  const q = parseFloat(newQty) || 0
  const p100kcal = per100(food._origKcal ?? food.kcal, food._origQty ?? food.quantity_g)
  const p100prot = per100(food._origProt ?? food.protein_g, food._origQty ?? food.quantity_g)
  const p100carbs = per100(food._origCarbs ?? food.carbs_g, food._origQty ?? food.quantity_g)
  const p100fat = per100(food._origFat ?? food.fat_g, food._origQty ?? food.quantity_g)
  return {
    quantity_g: q,
    kcal: Math.round(p100kcal * q / 100),
    protein_g: Math.round(p100prot * q / 100 * 10) / 10,
    carbs_g: Math.round(p100carbs * q / 100 * 10) / 10,
    fat_g: Math.round(p100fat * q / 100 * 10) / 10,
  }
}

export default function ModificaPiano() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [clientName, setClientName] = useState('')
  const [meals, setMeals] = useState([]) // tutti i pasti flat
  const [selectedDay, setSelectedDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [dirty, setDirty] = useState(false)

  // Stato per nuovo pasto
  const [showAddMeal, setShowAddMeal] = useState(false)
  const [newMealType, setNewMealType] = useState('spuntino')

  // Stato per nuovo alimento
  const [addingFoodToMeal, setAddingFoodToMeal] = useState(null)
  const [newFood, setNewFood] = useState({ food_name:'', quantity_g:100, kcal:0, protein_g:0, carbs_g:0, fat_g:0 })

  useEffect(() => { if (planId) fetchPlan() }, [planId])

  async function fetchPlan() {
    setLoading(true)
    const { data: planData } = await supabase.from('meal_plans').select('*').eq('id', planId).single()
    if (!planData) { setLoading(false); return }
    setPlan(planData)

    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', planData.client_id).single()
    setClientName(prof?.full_name || '')

    const { data: mealsData } = await supabase.from('plan_meals')
      .select('*, plan_meal_foods(*)')
      .eq('plan_id', planId)
      .order('day_of_week').order('meal_order')

    // Arricchisce ogni alimento con i valori originali per il ricalcolo
    const enriched = (mealsData || []).map(m => ({
      ...m,
      plan_meal_foods: (m.plan_meal_foods || []).map(f => ({
        ...f,
        _origQty: f.quantity_g,
        _origKcal: f.kcal,
        _origProt: f.protein_g,
        _origCarbs: f.carbs_g,
        _origFat: f.fat_g,
      }))
    }))
    setMeals(enriched)
    setLoading(false)
  }

  const dayMeals = meals.filter(m => m.day_of_week === selectedDay)

  // Totali giornalieri
  const dayTotals = dayMeals.reduce((acc, m) => {
    ;(m.plan_meal_foods || []).forEach(f => {
      acc.kcal += f.kcal || 0
      acc.protein += f.protein_g || 0
      acc.carbs += f.carbs_g || 0
      acc.fat += f.fat_g || 0
    })
    return acc
  }, { kcal:0, protein:0, carbs:0, fat:0 })

  // Modifica grammatura di un alimento
  function updateFoodQty(mealId, foodId, newQty) {
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      return {
        ...m,
        plan_meal_foods: m.plan_meal_foods.map(f => {
          if (f.id !== foodId) return f
          return { ...f, ...recalc(f, newQty), quantity_g: newQty } // mantieni stringa per input
        })
      }
    }))
    setDirty(true)
  }

  // Rimuovi alimento
  function removeFood(mealId, foodId) {
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      return { ...m, plan_meal_foods: m.plan_meal_foods.filter(f => f.id !== foodId) }
    }))
    setDirty(true)
  }

  // Rimuovi pasto intero
  async function removeMeal(mealId) {
    if (!window.confirm('Rimuovere questo pasto e tutti i suoi alimenti?')) return
    setMeals(prev => prev.filter(m => m.id !== mealId))
    setDirty(true)
  }

  // Aggiunge nuovo alimento a un pasto
  async function addFood(mealId) {
    if (!newFood.food_name.trim()) return
    const food = {
      id: 'new-' + Date.now(),
      plan_meal_id: mealId,
      food_name: newFood.food_name,
      quantity_g: parseFloat(newFood.quantity_g) || 100,
      kcal: parseInt(newFood.kcal) || 0,
      protein_g: parseFloat(newFood.protein_g) || 0,
      carbs_g: parseFloat(newFood.carbs_g) || 0,
      fat_g: parseFloat(newFood.fat_g) || 0,
      sort_order: 999,
      _origQty: parseFloat(newFood.quantity_g) || 100,
      _origKcal: parseInt(newFood.kcal) || 0,
      _origProt: parseFloat(newFood.protein_g) || 0,
      _origCarbs: parseFloat(newFood.carbs_g) || 0,
      _origFat: parseFloat(newFood.fat_g) || 0,
      _isNew: true,
    }
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, plan_meal_foods: [...m.plan_meal_foods, food] } : m))
    setNewFood({ food_name:'', quantity_g:100, kcal:0, protein_g:0, carbs_g:0, fat_g:0 })
    setAddingFoodToMeal(null)
    setDirty(true)
  }

  // Aggiunge nuovo pasto
  async function addMeal() {
    const { data: mealData } = await supabase.from('plan_meals').insert({
      plan_id: planId, day_of_week: selectedDay,
      meal_type: newMealType, meal_order: dayMeals.length,
    }).select().single()
    if (mealData) {
      setMeals(prev => [...prev, { ...mealData, plan_meal_foods: [] }])
      setShowAddMeal(false)
      setDirty(true)
    }
  }

  // Salva tutto
  async function saveAll() {
    setSaving(true)
    setSavedMsg('')
    try {
      // Raccogli tutti gli update/insert
      const toUpdate = []
      const toInsert = []

      for (const meal of meals) {
        for (const food of meal.plan_meal_foods) {
          const payload = {
            quantity_g: parseFloat(String(food.quantity_g).replace(',','.')) || 0,
            kcal: Math.round(parseFloat(food.kcal) || 0),
            protein_g: parseFloat(food.protein_g) || 0,
            carbs_g: parseFloat(food.carbs_g) || 0,
            fat_g: parseFloat(food.fat_g) || 0,
          }
          if (food._isNew) {
            toInsert.push({ ...payload, plan_meal_id: meal.id, food_name: food.food_name, sort_order: food.sort_order || 0 })
          } else {
            toUpdate.push({ id: food.id, ...payload })
          }
        }
      }

      // INSERT tutti i nuovi in una sola chiamata
      if (toInsert.length > 0) {
        const { error } = await supabase.from('plan_meal_foods').insert(toInsert)
        if (error) throw new Error('Insert: ' + error.message)
      }

      // UPDATE in batch da 20 alla volta
      const batchSize = 20
      for (let i = 0; i < toUpdate.length; i += batchSize) {
        const batch = toUpdate.slice(i, i + batchSize)
        await Promise.all(batch.map(f => {
          const { id, ...data } = f
          return supabase.from('plan_meal_foods').update(data).eq('id', id)
        }))
      }

      // 2. Elimina pasti rimossi
      const { data: dbMeals } = await supabase.from('plan_meals').select('id').eq('plan_id', planId)
      const currentIds = new Set(meals.map(m => m.id))
      const deleteMealPromises = (dbMeals || [])
        .filter(dbMeal => !currentIds.has(dbMeal.id))
        .map(async dbMeal => {
          await supabase.from('plan_meal_foods').delete().eq('plan_meal_id', dbMeal.id)
          await supabase.from('plan_meals').delete().eq('id', dbMeal.id)
        })
      await Promise.all(deleteMealPromises)

      // 3. Elimina alimenti rimossi IN PARALLELO
      const deleteFoodPromises = []
      for (const meal of meals) {
        const { data: dbFoods } = await supabase.from('plan_meal_foods').select('id').eq('plan_meal_id', meal.id)
        const currentFoodIds = new Set(meal.plan_meal_foods.filter(f=>!f._isNew).map(f=>f.id))
        for (const dbFood of dbFoods || []) {
          if (!currentFoodIds.has(dbFood.id)) {
            deleteFoodPromises.push(supabase.from('plan_meal_foods').delete().eq('id', dbFood.id))
          }
        }
      }
      await Promise.all(deleteFoodPromises)

      // 4. Aggiorna macro target piano
      const allFoods = meals.flatMap(m => m.plan_meal_foods)
      const totalKcal = Math.round(allFoods.reduce((s,f)=>s+(f.kcal||0),0) / 7)
      const totalProt = Math.round(allFoods.reduce((s,f)=>s+(f.protein_g||0),0) / 7)
      const totalCarbs = Math.round(allFoods.reduce((s,f)=>s+(f.carbs_g||0),0) / 7)
      const totalFat = Math.round(allFoods.reduce((s,f)=>s+(f.fat_g||0),0) / 7)
      if (totalKcal > 0) {
        await supabase.from('meal_plans').update({
          kcal_target: totalKcal,
          protein_target_g: totalProt,
          carbs_target_g: totalCarbs,
          fat_target_g: totalFat,
        }).eq('id', planId)
      }

      setDirty(false)
      setSavedMsg('✓ Piano salvato!')
      setTimeout(() => setSavedMsg(''), 4000)
      // Non ricaricare da rete — aggiorna solo i flag _isNew localmente
      setMeals(prev => prev.map(m => ({
        ...m,
        plan_meal_foods: m.plan_meal_foods.map(f => ({
          ...f,
          _isNew: false,
        }))
      })))
    } catch(e) {
      setSavedMsg('❌ Errore: ' + e.message)
      setTimeout(() => setSavedMsg(''), 5000)
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600}}>Modifica piano</div></div>
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
          <div style={{fontSize:11,color:'#888780'}}>{clientName} · {plan?.kcal_target} kcal</div>
        </div>
        {dirty && (
          <button onClick={saveAll} disabled={saving} style={{...s.btn, minWidth:90}}>
            {saving
              ? <><i className="ti ti-loader-2" style={{fontSize:14, animation:'spin 1s linear infinite'}}/> Salvo...</>
              : <><i className="ti ti-device-floppy" style={{fontSize:14}}/> Salva</>
            }
          </button>
        )}
        {savedMsg && (
          <div style={{
            fontSize:12, fontWeight:700, padding:'7px 12px', borderRadius:8,
            background: savedMsg.startsWith('❌') ? '#FEE2E2' : '#EAF3DE',
            color: savedMsg.startsWith('❌') ? '#E24B4A' : '#3B6D11',
            border: `0.5px solid ${savedMsg.startsWith('❌') ? '#E24B4A' : '#3B6D11'}`,
          }}>{savedMsg}</div>
        )}
      </div>

      {/* TAB GIORNI */}
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'8px 16px',display:'flex',gap:4,overflowX:'auto',flexShrink:0}}>
        {DAY_NAMES.map((dn,i) => {
          const day = i+1
          const hasMeals = meals.some(m=>m.day_of_week===day && m.plan_meal_foods?.length>0)
          return (
            <button key={day} onClick={()=>setSelectedDay(day)} style={{
              padding:'6px 12px',borderRadius:18,fontSize:12,fontWeight:600,cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',whiteSpace:'nowrap',flexShrink:0,
              background: selectedDay===day ? '#D4570A' : 'white',
              color: selectedDay===day ? 'white' : hasMeals ? '#111' : '#888780',
              borderColor: selectedDay===day ? '#D4570A' : hasMeals ? '#E0DDD6' : '#F5F3EF',
            }}>{dn.slice(0,3)}</button>
          )
        })}
      </div>

      {/* TOTALI GIORNO */}
      <div style={{background:'white',padding:'10px 16px',borderBottom:'0.5px solid #E0DDD6',display:'flex',gap:16,flexShrink:0}}>
        {[
          {l:'Kcal',v:Math.round(dayTotals.kcal),t:plan?.kcal_target,u:''},
          {l:'Proteine',v:Math.round(dayTotals.protein*10)/10,t:plan?.protein_target_g,u:'g'},
          {l:'Carboidrati',v:Math.round(dayTotals.carbs*10)/10,t:plan?.carbs_target_g,u:'g'},
          {l:'Grassi',v:Math.round(dayTotals.fat*10)/10,t:plan?.fat_target_g,u:'g'},
        ].map(item => {
          const pct = item.t > 0 ? Math.round(item.v/item.t*100) : 0
          const ok = pct >= 90 && pct <= 110
          return (
            <div key={item.l} style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:800,color:ok?'#3B6D11':'#D4570A'}}>{item.v}<span style={{fontSize:10,fontWeight:400}}>{item.u}</span></div>
              <div style={{fontSize:9,color:'#888780',textTransform:'uppercase'}}>{item.l}</div>
              {item.t>0 && <div style={{fontSize:9,color:ok?'#3B6D11':'#D4570A'}}>{pct}% target</div>}
            </div>
          )
        })}
      </div>

      {/* PASTI */}
      <div style={s.page}>
        {dayMeals.length === 0 && (
          <div style={{textAlign:'center',padding:'30px 0',color:'#888780',fontSize:13}}>
            Nessun pasto per {DAY_NAMES[selectedDay-1]}.<br/>Aggiungine uno qui sotto.
          </div>
        )}

        {dayMeals.map(meal => {
          const mealKcal = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(f.kcal||0),0))
          const mealProt = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(f.protein_g||0),0)*10)/10
          const mealCarbs = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(f.carbs_g||0),0)*10)/10
          const mealFat = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(f.fat_g||0),0)*10)/10

          return (
            <div key={meal.id} style={s.card}>
              {/* HEADER PASTO */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'#FEF0E7',borderBottom:'0.5px solid #F4C9A8'}}>
                <i className={`ti ${MEAL_ICONS[meal.meal_type]||'ti-circle'}`} style={{fontSize:16,color:'#D4570A'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#D4570A',textTransform:'capitalize'}}>{meal.meal_type}</div>
                  <div style={{fontSize:11,color:'#7a3508'}}>{mealKcal} kcal · P{mealProt}g C{mealCarbs}g G{mealFat}g</div>
                </div>
                <button onClick={()=>removeMeal(meal.id)} style={s.btnDanger}>
                  <i className="ti ti-trash" style={{fontSize:12}}/> Rimuovi pasto
                </button>
              </div>

              {/* ALIMENTI */}
              {(meal.plan_meal_foods||[]).map((food, fi) => (
                <div key={food.id} style={{padding:'10px 14px',borderBottom:'0.5px solid #F5F3EF'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <div style={{flex:1,fontSize:13,fontWeight:600,color:'#111'}}>{food.food_name}</div>
                    <button onClick={()=>removeFood(meal.id, food.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',padding:'0 4px'}}>
                      <i className="ti ti-x" style={{fontSize:14}}/>
                    </button>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <label style={s.label}>Grammi</label>
                      <input
                        type="number" inputMode="decimal"
                        value={food.quantity_g}
                        onChange={e=>updateFoodQty(meal.id, food.id, e.target.value)}
                        style={{...s.input,width:70,textAlign:'center',padding:'5px 8px'}}
                      />
                      <span style={{fontSize:11,color:'#888780'}}>g</span>
                    </div>
                    <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap'}}>
                      {[
                        {l:'Kcal',v:Math.round(food.kcal||0),c:'#D4570A'},
                        {l:'P',v:Math.round((food.protein_g||0)*10)/10,c:'#3B8C5A'},
                        {l:'C',v:Math.round((food.carbs_g||0)*10)/10,c:'#F4894A'},
                        {l:'G',v:Math.round((food.fat_g||0)*10)/10,c:'#888780'},
                      ].map(n=>(
                        <div key={n.l} style={{background:'#F5F3EF',borderRadius:7,padding:'4px 8px',fontSize:11,textAlign:'center'}}>
                          <span style={{fontWeight:700,color:n.c}}>{n.v}</span>
                          <span style={{color:'#888780',fontSize:9,marginLeft:1}}>{n.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* AGGIUNGI ALIMENTO */}
              {addingFoodToMeal === meal.id ? (
                <div style={{padding:'12px 14px',background:'#F5F3EF',borderTop:'0.5px solid #E0DDD6'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#111',marginBottom:10}}>Nuovo alimento</div>
                  <div style={{marginBottom:8}}>
                    <label style={s.label}>Nome alimento</label>
                    <input style={s.input} placeholder="Es. Petto di pollo" value={newFood.food_name} onChange={e=>setNewFood(p=>({...p,food_name:e.target.value}))}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:10}}>
                    {[{k:'quantity_g',l:'Grammi'},{k:'kcal',l:'Kcal'},{k:'protein_g',l:'Prot'},{k:'carbs_g',l:'Carbo'},{k:'fat_g',l:'Grassi'}].map(f=>(
                      <div key={f.k}>
                        <label style={s.label}>{f.l}</label>
                        <input style={{...s.input,textAlign:'center',padding:'5px 4px'}} type="number" value={newFood[f.k]} onChange={e=>setNewFood(p=>({...p,[f.k]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>addFood(meal.id)} style={{...s.btn,flex:1,justifyContent:'center',fontSize:12}}>
                      <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi
                    </button>
                    <button onClick={()=>{setAddingFoodToMeal(null);setNewFood({food_name:'',quantity_g:100,kcal:0,protein_g:0,carbs_g:0,fat_g:0})}} style={s.btnGray}>Annulla</button>
                  </div>
                </div>
              ) : (
                <div style={{padding:'8px 14px'}}>
                  <button onClick={()=>setAddingFoodToMeal(meal.id)} style={{...s.btnSm,width:'100%',justifyContent:'center',display:'flex',alignItems:'center',gap:4}}>
                    <i className="ti ti-plus" style={{fontSize:12}}/>Aggiungi alimento
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* AGGIUNGI PASTO */}
        {showAddMeal ? (
          <div style={{...s.card,padding:'14px'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#111',marginBottom:10}}>Nuovo pasto per {DAY_NAMES[selectedDay-1]}</div>
            <div style={{marginBottom:12}}>
              <label style={s.label}>Tipo pasto</label>
              <select value={newMealType} onChange={e=>setNewMealType(e.target.value)}
                style={{...s.input,cursor:'pointer'}}>
                {MEAL_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={addMeal} style={{...s.btn,flex:1,justifyContent:'center'}}>
                <i className="ti ti-plus" style={{fontSize:14}}/>Aggiungi pasto
              </button>
              <button onClick={()=>setShowAddMeal(false)} style={s.btnGray}>Annulla</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>setShowAddMeal(true)} style={{
            width:'100%',padding:'12px',background:'white',border:'0.5px dashed #D4570A',borderRadius:10,
            color:'#D4570A',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
            display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:20
          }}>
            <i className="ti ti-plus" style={{fontSize:15}}/>Aggiungi pasto a {DAY_NAMES[selectedDay-1]}
          </button>
        )}
      </div>
    </div>
  )
}
