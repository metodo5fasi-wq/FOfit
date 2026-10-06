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
  const [foodSearch, setFoodSearch] = useState('')
  const [foodResults, setFoodResults] = useState([])
  const [searchingFood, setSearchingFood] = useState(false)
  const searchTimeoutRef = React.useRef(null)
  const [savedTemplates, setSavedTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(null) // mealId
  const [showSaveTemplate, setShowSaveTemplate] = useState(null) // mealId
  const [templateName, setTemplateName] = useState('')
  const [showCopyDay, setShowCopyDay] = useState(false)
  const [dragFoodId, setDragFoodId] = useState(null)
  const [dragFoodMeal, setDragFoodMeal] = useState(null)
  const [dragOverFoodId, setDragOverFoodId] = useState(null)
  const [showMacroTarget, setShowMacroTarget] = useState(false)
  const [mealTargets, setMealTargets] = useState({})

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
  // ── RICERCA ALIMENTI ─────────────────────────────────────
  async function searchFood(query) {
    setFoodSearch(query)
    if (!query || query.length < 2) { setFoodResults([]); return }
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingFood(true)
      try {
        const r = await fetch(`/api/search-food?q=${encodeURIComponent(query)}&limit=10`)
        const data = await r.json()
        setFoodResults(data.foods || [])
      } catch(e) { setFoodResults([]) }
      setSearchingFood(false)
    }, 300)
  }

  function selectFoodFromSearch(food) {
    const qty = parseFloat(newFood.quantity_g) || 100
    const k100 = food.kcal_100 ?? food.kcal ?? 0
    const p100 = food.protein_100 ?? food.protein_g ?? 0
    const c100 = food.carbs_100 ?? food.carbs_g ?? 0
    const f100 = food.fat_100 ?? food.fat_g ?? 0
    setNewFood({
      food_name: food.name || food.food_name,
      quantity_g: qty,
      kcal: Math.round(k100 * qty / 100),
      protein_g: Math.round(p100 * qty / 100 * 10) / 10,
      carbs_g: Math.round(c100 * qty / 100 * 10) / 10,
      fat_g: Math.round(f100 * qty / 100 * 10) / 10,
      _k100: k100, _p100: p100, _c100: c100, _f100: f100,
    })
    setFoodSearch('')
    setFoodResults([])
  }

  function updateNewFoodQty(qty) {
    const q = parseFloat(qty) || 0
    setNewFood(p => ({
      ...p, quantity_g: qty,
      ...(p._k100 != null ? {
        kcal: Math.round(p._k100 * q / 100),
        protein_g: Math.round(p._p100 * q / 100 * 10) / 10,
        carbs_g: Math.round(p._c100 * q / 100 * 10) / 10,
        fat_g: Math.round(p._f100 * q / 100 * 10) / 10,
      } : {})
    }))
  }

  // ── TEMPLATE PASTI ───────────────────────────────────────
  function saveTemplate(mealId) {
    const meal = meals.find(m => m.id === mealId)
    if (!meal || !templateName.trim()) return
    const template = {
      id: Date.now(),
      name: templateName.trim(),
      meal_type: meal.meal_type,
      foods: meal.plan_meal_foods.map(f => ({
        food_name: f.food_name, quantity_g: f.quantity_g,
        kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
        _origQty: f.quantity_g, _origKcal: f.kcal, _origProt: f.protein_g, _origCarbs: f.carbs_g, _origFat: f.fat_g,
      })),
    }
    const updated = [...savedTemplates, template]
    setSavedTemplates(updated)
    try { localStorage.setItem('fofit_meal_templates', JSON.stringify(updated)) } catch(e) {}
    setShowSaveTemplate(null)
    setTemplateName('')
    alert(`Template "${template.name}" salvato!`)
  }

  function loadTemplates() {
    try {
      const saved = localStorage.getItem('fofit_meal_templates')
      if (saved) setSavedTemplates(JSON.parse(saved))
    } catch(e) {}
  }

  function applyTemplate(mealId, template) {
    const newFoods = template.foods.map(f => ({
      ...f, id: 'new-' + Date.now() + Math.random(), _isNew: true,
    }))
    setMeals(prev => prev.map(m => m.id === mealId
      ? { ...m, plan_meal_foods: [...(m.plan_meal_foods||[]), ...newFoods] }
      : m
    ))
    setShowTemplates(null)
    setDirty(true)
  }

  function deleteTemplate(id) {
    const updated = savedTemplates.filter(t => t.id !== id)
    setSavedTemplates(updated)
    try { localStorage.setItem('fofit_meal_templates', JSON.stringify(updated)) } catch(e) {}
  }

  // ── COPIA GIORNO INTERO ──────────────────────────────────
  function copyDayTo(targetDay) {
    const sourceMeals = meals.filter(m => m.day_of_week === selectedDay)
    const newMeals = sourceMeals.map((m, mi) => ({
      ...m,
      id: 'new-' + Date.now() + mi,
      day_of_week: targetDay,
      _isNew: true,
      plan_meal_foods: (m.plan_meal_foods||[]).map((f,fi) => ({
        ...f, id: 'new-' + Date.now() + mi + fi, _isNew: true,
      })),
    }))
    // Rimuovi pasti esistenti nel giorno target e sostituisci
    setMeals(prev => [
      ...prev.filter(m => m.day_of_week !== targetDay),
      ...newMeals,
    ])
    setShowCopyDay(false)
    setDirty(true)
  }

  // ── DRAG ALIMENTI DENTRO PASTO ───────────────────────────
  function handleFoodDragStart(mealId, foodId) {
    setDragFoodMeal(mealId); setDragFoodId(foodId)
  }
  function handleFoodDragOver(e, foodId) { e.preventDefault(); setDragOverFoodId(foodId) }
  function handleFoodDrop(mealId, targetFoodId) {
    if (!dragFoodId || dragFoodId === targetFoodId || dragFoodMeal !== mealId) {
      setDragFoodId(null); setDragOverFoodId(null); return
    }
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      const foods = [...(m.plan_meal_foods||[])]
      const fromIdx = foods.findIndex(f => f.id === dragFoodId)
      const toIdx = foods.findIndex(f => f.id === targetFoodId)
      if (fromIdx === -1 || toIdx === -1) return m
      const [moved] = foods.splice(fromIdx, 1)
      foods.splice(toIdx, 0, moved)
      return { ...m, plan_meal_foods: foods }
    }))
    setDragFoodId(null); setDragOverFoodId(null); setDragFoodMeal(null)
    setDirty(true)
  }
  function handleFoodDragEnd() { setDragFoodId(null); setDragOverFoodId(null); setDragFoodMeal(null) }

  // Carica template al mount
  React.useEffect(() => { loadTemplates() }, [])

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

      // 4. Aggiorna macro target piano — dividi per i giorni reali del piano
      const allFoods = meals.flatMap(m => m.plan_meal_foods)
      const numDays = new Set(meals.map(m => m.day_of_week)).size || 7
      const totalKcal = Math.round(allFoods.reduce((s,f)=>s+(parseFloat(f.kcal)||0),0) / numDays)
      const totalProt = Math.round(allFoods.reduce((s,f)=>s+(parseFloat(f.protein_g)||0),0) / numDays)
      const totalCarbs = Math.round(allFoods.reduce((s,f)=>s+(parseFloat(f.carbs_g)||0),0) / numDays)
      const totalFat = Math.round(allFoods.reduce((s,f)=>s+(parseFloat(f.fat_g)||0),0) / numDays)

      if (totalKcal > 0) {
        const { error: planUpdateErr } = await supabase.from('meal_plans').update({
          kcal_target: totalKcal,
          protein_target_g: totalProt,
          carbs_target_g: totalCarbs,
          fat_target_g: totalFat,
        }).eq('id', planId)
        if (planUpdateErr) throw new Error('Errore aggiornamento macro: ' + planUpdateErr.message)
        setPlan(prev => prev ? {...prev, kcal_target: totalKcal, protein_target_g: totalProt, carbs_target_g: totalCarbs, fat_target_g: totalFat} : prev)
      }

      // 5. Aggiorna day_kcal_target per ogni giorno — così PianoAlimentare mostra il valore giusto
      const dayTotals = {}
      meals.forEach(m => {
        if (!dayTotals[m.day_of_week]) dayTotals[m.day_of_week] = {kcal:0,protein:0,carbs:0,fat:0}
        const foods = m.plan_meal_foods
        dayTotals[m.day_of_week].kcal += foods.reduce((s,f)=>s+(parseFloat(f.kcal)||0),0)
        dayTotals[m.day_of_week].protein += foods.reduce((s,f)=>s+(parseFloat(f.protein_g)||0),0)
        dayTotals[m.day_of_week].carbs += foods.reduce((s,f)=>s+(parseFloat(f.carbs_g)||0),0)
        dayTotals[m.day_of_week].fat += foods.reduce((s,f)=>s+(parseFloat(f.fat_g)||0),0)
      })
      // Aggiorna il primo pasto di ogni giorno con i totali del giorno
      const dayUpdatePromises = []
      for (const [day, totals] of Object.entries(dayTotals)) {
        const firstMealOfDay = meals.find(m => m.day_of_week === parseInt(day))
        if (firstMealOfDay && !firstMealOfDay.id?.startsWith('new')) {
          dayUpdatePromises.push(
            supabase.from('plan_meals').update({
              day_kcal_target: Math.round(totals.kcal),
              day_protein_target_g: Math.round(totals.protein),
              day_carbs_target_g: Math.round(totals.carbs),
              day_fat_target_g: Math.round(totals.fat),
            }).eq('id', firstMealOfDay.id)
          )
        }
      }
      await Promise.all(dayUpdatePromises)

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

      {/* TOTALI GIORNO — barre live + copia giorno */}
      <div style={{background:'white',padding:'10px 14px',borderBottom:'0.5px solid #E0DDD6',flexShrink:0}}>
        <div style={{display:'flex',gap:10,marginBottom:6}}>
          {[
            {l:'Kcal',v:Math.round(dayTotals.kcal),t:plan?.kcal_target,u:'',c:'#D4570A'},
            {l:'P',v:Math.round(dayTotals.protein*10)/10,t:plan?.protein_target_g,u:'g',c:'#4A90D4'},
            {l:'C',v:Math.round(dayTotals.carbs*10)/10,t:plan?.carbs_target_g,u:'g',c:'#E8A020'},
            {l:'G',v:Math.round(dayTotals.fat*10)/10,t:plan?.fat_target_g,u:'g',c:'#3B8C5A'},
          ].map(item => {
            const pct = item.t > 0 ? Math.min(Math.round(item.v/item.t*100),120) : 0
            const ok = pct >= 90 && pct <= 110
            const over = pct > 110
            const barColor = over ? '#E24B4A' : ok ? '#3B6D11' : item.c
            return (
              <div key={item.l} style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                  <span style={{fontWeight:800,color:barColor}}>{item.v}{item.u}</span>
                  <span style={{color:'#C0BDB8',fontSize:9}}>{item.t||'—'}{item.u}</span>
                </div>
                <div style={{height:5,background:'#F0EDE8',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:5,borderRadius:3,background:barColor,width:`${Math.min(pct,100)}%`,transition:'width 0.25s'}}/>
                </div>
                <div style={{fontSize:9,color:barColor,marginTop:1,fontWeight:600}}>{item.l}{item.t>0?` ${pct}%`:''}</div>
              </div>
            )
          })}
        </div>
        {/* AZIONI GIORNO */}
        <div style={{display:'flex',gap:6,marginTop:4}}>
          <button onClick={()=>setShowCopyDay(!showCopyDay)} style={{fontSize:10,background:'#F5F3EF',border:'0.5px solid #E0DDD6',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontFamily:'inherit',color:'#888780',display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-copy" style={{fontSize:11}}/> Copia giorno su...
          </button>
          <button onClick={()=>setShowMacroTarget(!showMacroTarget)} style={{fontSize:10,background:'#F5F3EF',border:'0.5px solid #E0DDD6',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontFamily:'inherit',color:'#888780',display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-target" style={{fontSize:11}}/> Target per pasto
          </button>
        </div>
        {/* COPIA GIORNO */}
        {showCopyDay && (
          <div style={{marginTop:8,padding:'8px',background:'#FEF0E7',borderRadius:8}}>
            <div style={{fontSize:11,fontWeight:700,color:'#D4570A',marginBottom:6}}>Copia {DAY_NAMES[selectedDay-1]} su:</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {DAY_NAMES.filter((_,i)=>i+1!==selectedDay).map((dn,i)=>(
                <button key={dn} onClick={()=>copyDayTo(i+1<selectedDay?i+1:i+2)}
                  style={{fontSize:11,fontWeight:600,background:'white',border:'0.5px solid #D4570A',borderRadius:6,padding:'5px 10px',cursor:'pointer',fontFamily:'inherit',color:'#D4570A'}}>
                  {dn}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* TARGET PER PASTO */}
        {showMacroTarget && (
          <div style={{marginTop:8,padding:'8px',background:'#EBF3FD',borderRadius:8}}>
            <div style={{fontSize:11,fontWeight:700,color:'#4A90D4',marginBottom:6}}>Target kcal per pasto (% del totale)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {dayMeals.map(m=>(
                <div key={m.id}>
                  <div style={{fontSize:9,color:'#4A90D4',textTransform:'uppercase',fontWeight:600,marginBottom:2}}>{m.meal_type}</div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <input type="number" min="0" max="100"
                      value={mealTargets[m.id]||''}
                      onChange={e=>setMealTargets(p=>({...p,[m.id]:e.target.value}))}
                      style={{width:'100%',padding:'4px 6px',border:'0.5px solid #BCD8F5',borderRadius:6,fontSize:12,fontFamily:'inherit',textAlign:'center'}}
                      placeholder="30"/>
                    <span style={{fontSize:10,color:'#4A90D4'}}>%</span>
                  </div>
                  {mealTargets[m.id] && plan?.kcal_target && (
                    <div style={{fontSize:9,color:'#888780',marginTop:1}}>
                      = {Math.round(plan.kcal_target * parseInt(mealTargets[m.id]||0) / 100)} kcal
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
              <div style={{background:'#FEF0E7',borderBottom:'0.5px solid #F4C9A8'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px'}}>
                  <i className={`ti ${MEAL_ICONS[meal.meal_type]||'ti-circle'}`} style={{fontSize:15,color:'#D4570A'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#D4570A',textTransform:'capitalize'}}>{meal.meal_type}</div>
                    <div style={{fontSize:10,color:'#7a3508'}}>{mealKcal} kcal · P{mealProt}g C{mealCarbs}g G{mealFat}g
                      {mealTargets[meal.id] && plan?.kcal_target && (
                        <span style={{color:Math.abs(mealKcal - Math.round(plan.kcal_target*parseInt(mealTargets[meal.id]||0)/100)) < 50 ? '#3B6D11':'#E24B4A',fontWeight:700}}>
                          {' '}· target {Math.round(plan.kcal_target*parseInt(mealTargets[meal.id]||0)/100)} kcal
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    <button onClick={()=>setShowSaveTemplate(showSaveTemplate===meal.id?null:meal.id)} title="Salva come template"
                      style={{...s.btnGray,padding:'4px 7px',fontSize:11}}><i className="ti ti-bookmark" style={{fontSize:12}}/></button>
                    <button onClick={()=>{setShowTemplates(showTemplates===meal.id?null:meal.id);loadTemplates()}} title="Carica template"
                      style={{...s.btnGray,padding:'4px 7px',fontSize:11}}><i className="ti ti-bookmark-filled" style={{fontSize:12}}/></button>
                    <button onClick={()=>removeMeal(meal.id)} style={{...s.btnDanger,padding:'4px 7px',fontSize:11}}>
                      <i className="ti ti-trash" style={{fontSize:12}}/>
                    </button>
                  </div>
                </div>
                {/* SALVA TEMPLATE */}
                {showSaveTemplate===meal.id && (
                  <div style={{padding:'8px 12px',borderTop:'0.5px solid #F4C9A8',display:'flex',gap:6}}>
                    <input value={templateName} onChange={e=>setTemplateName(e.target.value)}
                      placeholder="Nome template (es. Pranzo proteico)..."
                      style={{flex:1,padding:'5px 8px',border:'0.5px solid #F4C9A8',borderRadius:6,fontSize:11,fontFamily:'inherit'}}/>
                    <button onClick={()=>saveTemplate(meal.id)} style={{...s.btn,padding:'5px 10px',fontSize:11}}>Salva</button>
                  </div>
                )}
                {/* CARICA TEMPLATE */}
                {showTemplates===meal.id && (
                  <div style={{padding:'8px 12px',borderTop:'0.5px solid #F4C9A8'}}>
                    {savedTemplates.length===0
                      ? <div style={{fontSize:11,color:'#888780'}}>Nessun template salvato</div>
                      : savedTemplates.map(t=>(
                        <div key={t.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'0.5px solid #F5F3EF'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:'#111'}}>{t.name}</div>
                            <div style={{fontSize:10,color:'#888780'}}>{t.foods?.length} alimenti · {t.foods?.reduce((s,f)=>s+(f.kcal||0),0)} kcal</div>
                          </div>
                          <button onClick={()=>applyTemplate(meal.id,t)} style={{...s.btn,padding:'3px 8px',fontSize:10}}>Usa</button>
                          <button onClick={()=>deleteTemplate(t.id)} style={{...s.btnDanger,padding:'3px 6px',fontSize:10}}><i className="ti ti-trash" style={{fontSize:10}}/></button>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* ALIMENTI con drag */}
              {(meal.plan_meal_foods||[]).map((food, fi) => (
                <div key={food.id}
                  draggable
                  onDragStart={()=>handleFoodDragStart(meal.id,food.id)}
                  onDragOver={e=>handleFoodDragOver(e,food.id)}
                  onDrop={()=>handleFoodDrop(meal.id,food.id)}
                  onDragEnd={handleFoodDragEnd}
                  style={{padding:'9px 12px',borderBottom:'0.5px solid #F5F3EF',
                    opacity:dragFoodId===food.id?0.4:1,
                    background:dragOverFoodId===food.id?'#FEF0E7':'transparent',
                    transition:'background 0.1s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <i className="ti ti-grip-vertical" style={{fontSize:14,color:'#C0BDB8',cursor:'grab',flexShrink:0}}/>
                    <div style={{flex:1,fontSize:12,fontWeight:600,color:'#111'}}>{food.food_name}</div>
                    <button onClick={()=>removeFood(meal.id, food.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#C0BDB8',padding:'0 2px'}}>
                      <i className="ti ti-x" style={{fontSize:13}}/>
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
                  <div style={{fontSize:11,fontWeight:700,color:'#111',marginBottom:8}}>Aggiungi alimento</div>

                  {/* RICERCA AUTOCOMPLETE */}
                  <div style={{position:'relative',marginBottom:8}}>
                    <div style={{position:'relative'}}>
                      <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#888780',pointerEvents:'none'}}/>
                      <input
                        style={{...s.input,paddingLeft:28,fontSize:12}}
                        placeholder="Cerca alimento nel database..."
                        value={foodSearch !== '' ? foodSearch : newFood.food_name}
                        onChange={e=>{
                          setNewFood(p=>({...p,food_name:e.target.value,_k100:null}))
                          searchFood(e.target.value)
                        }}
                      />
                      {searchingFood && <i className="ti ti-loader-2" style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'#888780',animation:'spin 1s linear infinite'}}/>}
                    </div>
                    {foodResults.length > 0 && (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,background:'white',border:'0.5px solid #E0DDD6',borderRadius:9,boxShadow:'0 4px 20px rgba(0,0,0,0.12)',zIndex:100,maxHeight:220,overflowY:'auto'}}>
                        {foodResults.map((food,i)=>(
                          <div key={i} onClick={()=>selectFoodFromSearch(food)}
                            style={{padding:'9px 12px',borderBottom:'0.5px solid #F5F3EF',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                            onMouseEnter={e=>e.currentTarget.style.background='#FEF0E7'}
                            onMouseLeave={e=>e.currentTarget.style.background='white'}>
                            <div>
                              <div style={{fontSize:12,fontWeight:600,color:'#111'}}>{food.name||food.food_name}</div>
                              {food.brand&&<div style={{fontSize:10,color:'#888780'}}>{food.brand}</div>}
                            </div>
                            <div style={{fontSize:10,color:'#D4570A',fontWeight:600,textAlign:'right',flexShrink:0}}>
                              <div>{Math.round(food.kcal_100??food.kcal??0)} kcal/100g</div>
                              <div style={{color:'#888780'}}>P{food.protein_100??food.protein_g??0}g C{food.carbs_100??food.carbs_g??0}g G{food.fat_100??food.fat_g??0}g</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* GRAMMI + MACRO */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:8}}>
                    <div>
                      <label style={s.label}>Grammi</label>
                      <input style={{...s.input,textAlign:'center',padding:'5px 4px',fontWeight:700,color:'#D4570A'}}
                        type="number" value={newFood.quantity_g} onChange={e=>updateNewFoodQty(e.target.value)}/>
                    </div>
                    {[{k:'kcal',l:'Kcal'},{k:'protein_g',l:'Prot'},{k:'carbs_g',l:'Carbo'},{k:'fat_g',l:'Grassi'}].map(f=>(
                      <div key={f.k}>
                        <label style={s.label}>{f.l}</label>
                        <input style={{...s.input,textAlign:'center',padding:'5px 4px',background:newFood._k100!=null?'#EAF3DE':'#F5F3EF'}}
                          type="number" value={newFood[f.k]} onChange={e=>setNewFood(p=>({...p,[f.k]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>

                  {/* ANTEPRIMA */}
                  {newFood.kcal > 0 && (
                    <div style={{background:'white',borderRadius:7,padding:'6px 10px',marginBottom:8,display:'flex',gap:10,fontSize:11,border:'0.5px solid #E0DDD6'}}>
                      <span style={{fontWeight:700,color:'#D4570A'}}>{Math.round(newFood.kcal)} kcal</span>
                      <span style={{color:'#4A90D4'}}>P {newFood.protein_g}g</span>
                      <span style={{color:'#E8A020'}}>C {newFood.carbs_g}g</span>
                      <span style={{color:'#3B8C5A'}}>G {newFood.fat_g}g</span>
                      <span style={{color:'#888780',marginLeft:'auto'}}>{newFood.quantity_g}g</span>
                    </div>
                  )}

                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>addFood(meal.id)} disabled={!newFood.food_name.trim()}
                      style={{...s.btn,flex:1,justifyContent:'center',fontSize:12,opacity:!newFood.food_name.trim()?0.5:1}}>
                      <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi
                    </button>
                    <button onClick={()=>{setAddingFoodToMeal(null);setNewFood({food_name:'',quantity_g:100,kcal:0,protein_g:0,carbs_g:0,fat_g:0});setFoodSearch('');setFoodResults([])}} style={s.btnGray}>Annulla</button>
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
