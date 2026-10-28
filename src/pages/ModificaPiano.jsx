import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { searchFoods } from '../data/foodDatabase.js'

const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }
const MEAL_TYPES = ['colazione','spuntino','pranzo','pre-workout','merenda','cena']
const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', marginBottom:12, overflow:'hidden' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'rgba(212,87,10,0.1)', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#161616', color:'#AAA', border:'0.5px solid #1C1C1C', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  btnDanger: { background:'rgba(226,75,74,0.1)', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  input: { padding:'7px 10px', border:'0.5px solid #1C1C1C', borderRadius:7, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  label: { fontSize:10, color:'#AAA', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.07em' },
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
  const toast = useToast()
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [clientName, setClientName] = useState('')
  const [meals, setMeals] = useState([]) // tutti i pasti flat
  const [selectedDay, setSelectedDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fixingMacros, setFixingMacros] = useState(false)

  async function fixMacros() {
    setFixingMacros(true)
    try {
      // Ricalcola tutti gli alimenti del piano dal database locale
      const allFoods = meals.flatMap(m => m.plan_meal_foods)
      let fixed = 0
      const updates = []

      for (const food of allFoods) {
        const results = searchFoods(food.food_name)
        if (!results?.length) continue
        const match = results[0]
        const qty = parseFloat(food.quantity_g) || 100
        const newKcal = Math.round(match.kcal100 * qty / 100)
        const newProt = Math.round(match.p * qty / 100 * 10) / 10
        const newCarbs = Math.round(match.c * qty / 100 * 10) / 10
        const newFat = Math.round(match.g * qty / 100 * 10) / 10

        updates.push({ id: food.id, kcal: newKcal, protein_g: newProt, carbs_g: newCarbs, fat_g: newFat })
        fixed++
      }

      if (!updates.length) {
        toast('Nessun alimento trovato nel database', 'info')
        setFixingMacros(false)
        return
      }

      // Salva su Supabase
      await Promise.all(updates.map(u => {
        const { id, ...data } = u
        return supabase.from('plan_meal_foods').update(data).eq('id', id)
      }))

      // Aggiorna stato locale immediatamente
      setMeals(prev => prev.map(m => ({
        ...m,
        plan_meal_foods: m.plan_meal_foods.map(f => {
          const u = updates.find(x => x.id === f.id)
          return u ? { ...f, ...u,
            _origKcal: u.kcal, _origProt: u.protein_g, _origCarbs: u.carbs_g, _origFat: u.fat_g
          } : f
        })
      })))

      toast(`✓ Ricalcolati ${fixed} alimenti`, 'success')
    } catch(e) {
      console.error(e)
      toast('Errore nel ricalcolo: ' + e.message, 'error')
    }
    setFixingMacros(false)
  }
  const [savedMsg, setSavedMsg] = useState('')
  const [dirty, setDirty] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // Avvisa se si esce con modifiche non salvate
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = 'Hai modifiche non salvate. Uscire senza salvare?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

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
      plan_meal_foods: (m.plan_meal_foods || []).map(f => {
        const qty  = parseFloat(f.quantity_g)  || 0
        const prot = parseFloat(f.protein_g)   || 0
        const carbs= parseFloat(f.carbs_g)     || 0
        const fat  = parseFloat(f.fat_g)       || 0
        const kcalFromDB = parseFloat(f.kcal)  || 0
        // Se i macro sono presenti, ricalcola le kcal per coerenza
        const macroKcal = Math.round(prot*4 + carbs*4 + fat*9)
        const kcal = (prot>0||carbs>0||fat>0) ? macroKcal : kcalFromDB
        return {
          ...f,
          quantity_g: qty, kcal, protein_g: prot, carbs_g: carbs, fat_g: fat,
          _origQty: qty, _origKcal: kcal, _origProt: prot, _origCarbs: carbs, _origFat: fat,
        }
      })
    }))
    setMeals(enriched)
    setLoading(false)
  }

  const dayMeals = meals.filter(m => m.day_of_week === selectedDay)

  // Totali giornalieri
  const dayTotals = dayMeals.reduce((acc, m) => {
    ;(m.plan_meal_foods || []).forEach(f => {
      acc.kcal    += parseFloat(f.kcal)       || 0
      acc.protein += parseFloat(f.protein_g)  || 0
      acc.carbs   += parseFloat(f.carbs_g)    || 0
      acc.fat     += parseFloat(f.fat_g)      || 0
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
        // Prima cerca nel database locale (778+ alimenti italiani verificati)
        const localResults = searchFoods(query).map(f => ({
          name: f.name,
          brand: f.brand || '',
          category: f.cat || '',
          kcal_100: f.kcal100,
          protein_100: f.p,
          carbs_100: f.c,
          fat_100: f.g,
        }))

        if (localResults.length >= 3) {
          setFoodResults(localResults)
          setSearchingFood(false)
          return
        }

        // Poi prova API come fallback
        try {
          const r = await fetch(`/api/search-food?q=${encodeURIComponent(query)}&limit=10`)
          const data = await r.json()
          const apiResults = data.foods || []
          const combined = [...localResults]
          apiResults.forEach(a => {
            if (!combined.find(l => l.name?.toLowerCase() === (a.name||'').toLowerCase()))
              combined.push(a)
          })
          setFoodResults(combined.slice(0, 12))
        } catch {
          setFoodResults(localResults)
        }
      } catch(e) { setFoodResults([]) }
      setSearchingFood(false)
    }, 250)
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
    toast('Operazione completata', 'success')
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
      // IDs degli alimenti esistenti che vogliamo tenere (non _isNew)
      const keepFoodIds = new Set()

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
            keepFoodIds.add(food.id)
          }
        }
      }

      // 1. Elimina pasti rimossi PRIMA di qualsiasi altra operazione
      const { data: dbMeals } = await supabase.from('plan_meals').select('id').eq('plan_id', planId)
      const currentMealIds = new Set(meals.map(m => m.id))
      const deleteMealPromises = (dbMeals || [])
        .filter(dbMeal => !currentMealIds.has(dbMeal.id))
        .map(async dbMeal => {
          await supabase.from('plan_meal_foods').delete().eq('plan_meal_id', dbMeal.id)
          await supabase.from('plan_meals').delete().eq('id', dbMeal.id)
        })
      await Promise.all(deleteMealPromises)

      // 2. Elimina SOLO gli alimenti che l'utente ha rimosso (non i nuovi)
      // Usa keepFoodIds calcolato PRIMA dell'insert per non cancellare i nuovi
      const deleteFoodPromises = []
      for (const meal of meals) {
        if (meal.id?.toString().startsWith('new')) continue
        const { data: dbFoods } = await supabase
          .from('plan_meal_foods').select('id').eq('plan_meal_id', meal.id)
        for (const dbFood of dbFoods || []) {
          if (!keepFoodIds.has(dbFood.id)) {
            deleteFoodPromises.push(
              supabase.from('plan_meal_foods').delete().eq('id', dbFood.id)
            )
          }
        }
      }
      await Promise.all(deleteFoodPromises)

      // 3. UPDATE alimenti esistenti
      const batchSize = 20
      for (let i = 0; i < toUpdate.length; i += batchSize) {
        const batch = toUpdate.slice(i, i + batchSize)
        await Promise.all(batch.map(f => {
          const { id, ...data } = f
          return supabase.from('plan_meal_foods').update(data).eq('id', id)
        }))
      }

      // 4. INSERT nuovi alimenti — DOPO le eliminazioni, così non li cancella
      if (toInsert.length > 0) {
        const { error } = await supabase.from('plan_meal_foods').insert(toInsert)
        if (error) throw new Error('Insert fallito: ' + error.message)
      }

      // 4. Il target kcal/macro resta quello impostato dal coach — NON viene sovrascritto dagli alimenti
      // Le barre live mostrano il confronto tra alimenti inseriti e target

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
      setSavedMsg('✓ Salvato!')
      setTimeout(() => setSavedMsg(''), 3000)
      toast('Piano salvato con successo!', 'success')
      // Ricarica da Supabase per avere gli ID reali degli alimenti inseriti
      await loadPlan()
    } catch(e) {
      console.error('saveAll:', e)
      toast('Errore nel salvataggio: ' + (e.message || 'Riprova'), 'error')
      setSavedMsg('')
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600}}>Modifica piano</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#AAA',fontSize:13}}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'#161616'}}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <button onClick={async ()=>{
  if (dirty) {
    await saveAll()
  }
  navigate(-1)
}} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #1C1C1C',background:'#161616',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><i className="ti ti-arrow-left" style={{fontSize:16}}/></button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{plan?.title || 'Piano alimentare'}</div>
          <div style={{fontSize:11,color:'#AAA'}}>{clientName}{plan && ` · target: ${plan.kcal_target} kcal`}</div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
          <button onClick={fixMacros} disabled={fixingMacros} title="Ricalcola tutti i macro dal database"
            style={{...s.btnGray,padding:'5px 9px',fontSize:11,display:'flex',alignItems:'center',gap:4}}>
            {fixingMacros
              ? <><i className="ti ti-loader-2" style={{fontSize:12}}/>Ricalcolo...</>
              : <><i className="ti ti-refresh" style={{fontSize:12}}/>Ricalcola</>}
          </button>
          <button onClick={saveAll} disabled={saving}
            style={{...s.btn,minWidth:80,display:'flex',alignItems:'center',gap:4,
              background:savedMsg?'#3B6D11':saving?'#888':dirty?'#D4570A':'#888780',
            }}>
            {saving
              ? <><i className="ti ti-loader-2" style={{fontSize:12}}/>Salvo...</>
              : savedMsg
              ? <><i className="ti ti-check" style={{fontSize:12}}/>{savedMsg}</>
              : <><i className="ti ti-device-floppy" style={{fontSize:12}}/>{dirty?'Salva':'Salvato'}</>}
          </button>
        </div>
      </div>

      {/* MACRO UNIFICATO: target + live nella stessa sezione */}
      <div style={{background:'#0D0D0D',padding:'10px 14px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
          <span style={{fontSize:9,fontWeight:700,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.07em'}}>Inserito / Target</span>
          {plan && (
            <button onClick={async ()=>{
              await supabase.from('meal_plans').update({
                kcal_target: plan.kcal_target,
                protein_target_g: plan.protein_target_g,
                carbs_target_g: plan.carbs_target_g,
                fat_target_g: plan.fat_target_g,
              }).eq('id', planId)
              setSavedMsg('✓ Salvato')
              setTimeout(()=>setSavedMsg(''),2000)
            }} style={{padding:'3px 9px',background:savedMsg?'#3B6D11':'#D4570A',color:'white',border:'none',borderRadius:6,fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'background 0.2s'}}>
              {savedMsg||'Salva target'}
            </button>
          )}
        </div>
        <div style={{display:'flex',gap:8}}>
          {[
            {l:'Kcal',k:'kcal_target',   v:Math.round(dayTotals.kcal),           t:plan?.kcal_target,      u:'', c:'#D4570A'},
            {l:'P',  k:'protein_target_g',v:Math.round(dayTotals.protein*10)/10,  t:plan?.protein_target_g, u:'g',c:'#4A90D4'},
            {l:'C',  k:'carbs_target_g', v:Math.round(dayTotals.carbs*10)/10,     t:plan?.carbs_target_g,   u:'g',c:'#E8A020'},
            {l:'G',  k:'fat_target_g',   v:Math.round(dayTotals.fat*10)/10,       t:plan?.fat_target_g,     u:'g',c:'#3B8C5A'},
          ].map(item => {
            const pct = item.t > 0 ? Math.min(Math.round(item.v/item.t*100),120) : 0
            const ok   = pct >= 90 && pct <= 110
            const over = pct > 110
            const barColor = over?'#E24B4A':ok?'#3B6D11':item.c
            return (
              <div key={item.l} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                {/* Label */}
                <div style={{fontSize:9,fontWeight:700,color:item.c}}>{item.l}</div>
                {/* Valore inserito */}
                <div title="Inserito nel piano" style={{fontSize:14,fontWeight:800,color:barColor,lineHeight:1}}>{item.v}<span style={{fontSize:9,fontWeight:400}}>{item.u}</span></div>
                {/* Barra */}
                <div style={{width:'100%',height:5,background:'#141414',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:5,borderRadius:3,background:barColor,width:`${Math.min(pct,100)}%`,transition:'width 0.3s'}}/>
                </div>
                {/* Target editabile */}
                <input type="number"
                  value={plan?.[item.k]||''}
                  placeholder="target kcal"
                  onChange={e=>{
                    if (!plan) return
                    const val = parseInt(e.target.value)||0
                    if (item.k==='kcal_target') {
                      const cur = (plan.protein_target_g||0)*4+(plan.carbs_target_g||0)*4+(plan.fat_target_g||0)*9
                      if (cur>0&&val>0) {
                        const r=val/cur
                        setPlan(p=>({...p,kcal_target:val,protein_target_g:Math.round((p.protein_target_g||0)*r),carbs_target_g:Math.round((p.carbs_target_g||0)*r),fat_target_g:Math.round((p.fat_target_g||0)*r)}))
                      } else setPlan(p=>({...p,kcal_target:val}))
                    } else {
                      const np={...plan,[item.k]:val}
                      const nk=Math.round((np.protein_target_g||0)*4+(np.carbs_target_g||0)*4+(np.fat_target_g||0)*9)
                      setPlan(p=>({...p,[item.k]:val,kcal_target:nk}))
                    }
                    setDirty(true)
                  }}
                  style={{width:'100%',padding:'3px 2px',border:`1px solid ${item.c}55`,borderRadius:5,fontSize:11,fontWeight:600,color:'#CCC',background:'#111111',textAlign:'center',fontFamily:'inherit',outline:'none'}}
                />
                {/* % */}
                <div style={{fontSize:8,color:barColor,fontWeight:700}}>{item.t>0?`${pct}%`:''}</div>
              </div>
            )
          })}
        </div>
        {/* Avviso discrepanza */}
        {plan && (() => {
          const mk = Math.round((plan.protein_target_g||0)*4+(plan.carbs_target_g||0)*4+(plan.fat_target_g||0)*9)
          const diff = Math.abs(mk-(plan.kcal_target||0))
          return diff>20&&mk>0?(
            <div style={{marginTop:6,background:'rgba(232,160,32,0.08)',borderRadius:6,padding:'5px 9px',fontSize:10,color:'#E8A020',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>⚠️ Macro = {mk} kcal (diff {diff})</span>
              <button onClick={()=>{setPlan(p=>({...p,kcal_target:mk}));setDirty(true)}} style={{fontSize:9,background:'#E8A020',color:'white',border:'none',borderRadius:4,padding:'2px 7px',cursor:'pointer',fontFamily:'inherit'}}>Allinea</button>
            </div>
          ):null
        })()}
      </div>

      <div style={{background:'#0D0D0D',padding:'6px 14px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
        {/* AZIONI GIORNO */}
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>setShowCopyDay(!showCopyDay)} style={{fontSize:10,background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit',color:'#AAA'}}>
            📋 Copia giorno su...
          </button>
          <button onClick={()=>setShowMacroTarget(!showMacroTarget)} style={{fontSize:10,background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit',color:'#AAA'}}>
            🎯 Target per pasto
          </button>
        </div>
        {showCopyDay && (
          <div style={{marginTop:6,display:'flex',gap:6,flexWrap:'wrap'}}>
            {DAY_NAMES.filter((_,i)=>i+1!==selectedDay).map((dn,i)=>(
              <button key={dn} onClick={()=>copyDayTo(i+1<selectedDay?i+1:i+2)} style={{fontSize:11,fontWeight:600,background:'#0D0D0D',border:'0.5px solid #D4570A',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit',color:'#D4570A'}}>{dn}</button>
            ))}
          </div>
        )}
        {showMacroTarget && (
          <div style={{marginTop:6,background:'rgba(74,144,212,0.1)',borderRadius:8,padding:'8px'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#4A90D4',marginBottom:6,textTransform:'uppercase'}}>Target kcal per pasto (%)</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {dayMeals.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:10,color:'#4A90D4',textTransform:'capitalize'}}>{m.meal_type}</span>
                  <input type="number" min="0" max="100" value={mealTargets[m.id]||''} onChange={e=>setMealTargets(p=>({...p,[m.id]:e.target.value}))}
                    style={{width:44,padding:'3px 5px',border:'0.5px solid #BCD8F5',borderRadius:5,fontSize:11,fontFamily:'inherit',textAlign:'center'}}/>
                  <span style={{fontSize:9,color:'#4A90D4'}}>%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LAYOUT PRINCIPALE */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* SIDEBAR GIORNI (PC) o TABS (Mobile) */}
        {isMobile ? (
          <div style={{background:'#0D0D0D',borderBottom:'0.5px solid #1A1A1A',display:'flex',overflowX:'auto',flexShrink:0,padding:'8px 12px',gap:6}}>
            {DAY_NAMES.map((dn,i) => {
              const dayN = i+1
              const dayM = meals.filter(m=>m.day_of_week===dayN)
              const hasFood = dayM.some(m=>m.plan_meal_foods?.length>0)
              return (
                <button key={dayN} onClick={()=>setSelectedDay(dayN)} style={{
                  flexShrink:0,padding:'5px 12px',borderRadius:16,fontSize:11,fontWeight:600,
                  cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                  background:selectedDay===dayN?'#D4570A':'white',
                  color:selectedDay===dayN?'white':hasFood?'#111':'#888780',
                  borderColor:selectedDay===dayN?'#D4570A':hasFood?'#E0DDD6':'#F0EDE8',
                }}>{dn.slice(0,3)}</button>
              )
            })}
          </div>
        ) : (
          <div style={{width:160,flexShrink:0,background:'#0D0D0D',borderRight:'0.5px solid #1A1A1A',overflowY:'auto'}}>
            <div style={{padding:'10px 12px',borderBottom:'0.5px solid #F0EDE8',fontSize:10,fontWeight:700,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.08em'}}>Giorni</div>
            {DAY_NAMES.map((dn,i) => {
              const dayN = i+1
              const dayM = meals.filter(m=>m.day_of_week===dayN)
              const dayKcal = dayM.reduce((s,m)=>(m.plan_meal_foods||[]).reduce((ss,f)=>ss+(parseFloat(f.kcal)||0),s),0)
              const hasFood = dayM.some(m=>m.plan_meal_foods?.length>0)
              const pct = plan?.kcal_target ? Math.min(100,Math.round(dayKcal/plan.kcal_target*100)) : 0
              return (
                <div key={dayN} onClick={()=>setSelectedDay(dayN)} style={{
                  padding:'10px 12px',cursor:'pointer',
                  background:selectedDay===dayN?'#FEF0E7':'transparent',
                  borderLeft:selectedDay===dayN?'3px solid #D4570A':'3px solid transparent',
                  transition:'all 0.1s',
                }}>
                  <div style={{fontSize:12,fontWeight:selectedDay===dayN?700:500,color:selectedDay===dayN?'#D4570A':'#111'}}>{dn}</div>
                  {hasFood && (
                    <>
                      <div style={{fontSize:10,color:'#AAA',marginTop:1}}>{Math.round(dayKcal)} kcal</div>
                      <div style={{height:3,background:'#141414',borderRadius:2,marginTop:3,overflow:'hidden'}}>
                        <div style={{height:3,background:selectedDay===dayN?'#D4570A':'#E0DDD6',width:`${pct}%`,borderRadius:2}}/>
                      </div>
                    </>
                  )}
                  {!hasFood && <div style={{fontSize:10,color:'#D0CFC9',marginTop:1}}>Vuoto</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* CONTENUTO GIORNO */}
        <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'12px'}}>
          {/* PASTI */}
          {dayMeals.map((meal) => {
            const mealKcal = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.kcal)||0),0))
            const mealProt = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.protein_g)||0),0)*10)/10
            const mealCarbs = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.carbs_g)||0),0)*10)/10
            const mealFat = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.fat_g)||0),0)*10)/10
            return (
              <div key={meal.id} style={s.card}>
                {/* HEADER PASTO */}
                <div style={{background:'rgba(212,87,10,0.1)',borderBottom:'0.5px solid #F4C9A8'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px'}}>
                    <i className={`ti ${MEAL_ICONS[meal.meal_type]||'ti-circle'}`} style={{fontSize:14,color:'#D4570A'}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#D4570A',textTransform:'capitalize'}}>{meal.meal_type}</div>
                      <div style={{fontSize:10,color:'#7a3508'}}>{mealKcal} kcal · P{mealProt}g C{mealCarbs}g G{mealFat}g
                        {mealTargets[meal.id] && plan?.kcal_target && (
                          <span style={{color:Math.abs(mealKcal - Math.round(plan.kcal_target*parseInt(mealTargets[meal.id]||0)/100)) < 50 ? '#3B6D11':'#E24B4A',fontWeight:700}}>
                            {' '}· target {Math.round(plan.kcal_target*parseInt(mealTargets[meal.id]||0)/100)} kcal
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>setShowSaveTemplate(showSaveTemplate===meal.id?null:meal.id)} title="Salva template" style={{...s.btnGray,padding:'3px 6px',fontSize:10}}><i className="ti ti-bookmark" style={{fontSize:11}}/></button>
                      <button onClick={()=>{setShowTemplates(showTemplates===meal.id?null:meal.id);loadTemplates()}} title="Carica template" style={{...s.btnGray,padding:'3px 6px',fontSize:10}}><i className="ti ti-bookmark-filled" style={{fontSize:11}}/></button>
                      <button onClick={()=>removeMeal(meal.id)} style={{...s.btnDanger,padding:'3px 6px',fontSize:10}}><i className="ti ti-trash" style={{fontSize:11}}/></button>
                    </div>
                  </div>
                  {showSaveTemplate===meal.id && (
                    <div style={{padding:'6px 12px 8px',borderTop:'0.5px solid #F4C9A8',display:'flex',gap:6}}>
                      <input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="Nome template..." style={{flex:1,padding:'4px 8px',border:'0.5px solid #F4C9A8',borderRadius:6,fontSize:11,fontFamily:'inherit'}}/>
                      <button onClick={()=>saveTemplate(meal.id)} style={{...s.btn,padding:'4px 10px',fontSize:11}}>Salva</button>
                    </div>
                  )}
                  {showTemplates===meal.id && (
                    <div style={{padding:'6px 12px 8px',borderTop:'0.5px solid #F4C9A8'}}>
                      {savedTemplates.length===0 ? <div style={{fontSize:11,color:'#AAA'}}>Nessun template salvato</div> :
                        savedTemplates.map(t=>(
                          <div key={t.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0'}}>
                            <div style={{flex:1,fontSize:11,fontWeight:600,color:'#F0F0F0'}}>{t.name} <span style={{color:'#AAA',fontWeight:400}}>· {t.foods?.reduce((s,f)=>s+(f.kcal||0),0)} kcal</span></div>
                            <button onClick={()=>applyTemplate(meal.id,t)} style={{...s.btn,padding:'3px 8px',fontSize:10}}>Usa</button>
                            <button onClick={()=>deleteTemplate(t.id)} style={{...s.btnDanger,padding:'3px 5px',fontSize:10}}><i className="ti ti-trash" style={{fontSize:10}}/></button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* ALIMENTI */}
                {(meal.plan_meal_foods||[]).map((food) => (
                  <div key={food.id}
                    draggable onDragStart={()=>handleFoodDragStart(meal.id,food.id)}
                    onDragOver={e=>handleFoodDragOver(e,food.id)} onDrop={()=>handleFoodDrop(meal.id,food.id)}
                    onDragEnd={handleFoodDragEnd}
                    style={{padding:'7px 12px',borderBottom:'0.5px solid #F5F3EF',
                      opacity:dragFoodId===food.id?0.4:1,
                      background:dragOverFoodId===food.id?'#FEF0E7':'transparent'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                      <i className="ti ti-grip-vertical" style={{fontSize:13,color:'#999',cursor:'grab',flexShrink:0}}/>
                      <span style={{flex:1,fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{food.food_name}</span>
                      <button onClick={()=>removeFood(meal.id,food.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#999',padding:'0 2px'}}><i className="ti ti-x" style={{fontSize:12}}/></button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginLeft:19}}>
                      {[{k:'quantity_g',l:'g',bold:true},{k:'kcal',l:'kcal'},{k:'protein_g',l:'P'},{k:'carbs_g',l:'C'},{k:'fat_g',l:'G'}].map(f=>(
                        <div key={f.k}>
                          <div style={{fontSize:8,color:'#AAA',textAlign:'center',marginBottom:1}}>{f.l}</div>
                          <input style={{...s.input,padding:'4px 3px',fontSize:11,textAlign:'center',fontWeight:f.bold?700:400,background:f.bold?'rgba(212,87,10,0.12)':'#161616',borderColor:f.bold?'rgba(212,87,10,0.3)':'#222'}}
                            type="number" value={food[f.k]||0}
                            onChange={e=>{
                              const val = parseFloat(e.target.value)||0
                              setMeals(prev=>prev.map(m=>{
                                if (m.id!==meal.id) return m
                                return {...m, plan_meal_foods: m.plan_meal_foods.map(fd=>{
                                  if (fd.id!==food.id) return fd
                                  if (f.k==='quantity_g') return {...fd, ...recalc(fd, val)}
                                  const updated = {...fd, [f.k]: val}
                                  // Se cambio un macro → ricalcola kcal automaticamente
                                  if (f.k==='protein_g'||f.k==='carbs_g'||f.k==='fat_g') {
                                    updated.kcal = Math.round(
                                      (parseFloat(updated.protein_g)||0)*4 +
                                      (parseFloat(updated.carbs_g)||0)*4 +
                                      (parseFloat(updated.fat_g)||0)*9
                                    )
                                  }
                                  // Se cambio kcal → riproporziona macro se abbiamo valori per 100g
                                  if (f.k==='kcal' && fd._origKcal>0 && fd._origQty>0) {
                                    const newQty = (val / fd._origKcal) * fd._origQty
                                    return {...fd, ...recalc(fd, newQty), kcal: val}
                                  }
                                  return updated
                                })}
                              }))
                              setDirty(true)
                            }}/>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* AGGIUNGI ALIMENTO */}
                {addingFoodToMeal===meal.id ? (
                  <div style={{padding:'10px 12px',background:'#161616',borderTop:'0.5px solid #1A1A1A'}}>
                    <div style={{position:'relative',marginBottom:7}}>
                      <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#AAA',pointerEvents:'none',zIndex:1}}/>
                      <input
                        style={{...s.input,paddingLeft:26,paddingRight:28,fontSize:12}}
                        placeholder="Cerca o scrivi nome alimento..."
                        value={newFood.food_name}
                        onChange={e=>{
                          const val = e.target.value
                          setNewFood(p=>({...p,food_name:val,_k100:null}))
                          if (!val || val.length < 2) { setFoodResults([]); return }
                          searchFood(val)
                        }}
                        onBlur={()=>setTimeout(()=>setFoodResults([]),150)}
                      />
                      {newFood.food_name && (
                        <button onClick={()=>{setNewFood(p=>({...p,food_name:'',kcal:0,protein_g:0,carbs_g:0,fat_g:0,_k100:null}));setFoodResults([])}}
                          style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#AAA',fontSize:14,padding:'0 2px',zIndex:1}}>✕</button>
                      )}
                      {searchingFood && !newFood.food_name && <i className="ti ti-loader-2" style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'#AAA'}}/>}
                      {foodResults.length>0 && (
                        <div style={{position:'absolute',top:'calc(100% + 2px)',left:0,right:0,background:'#0D0D0D',border:'0.5px solid #1C1C1C',borderRadius:9,boxShadow:'0 4px 20px rgba(0,0,0,0.14)',zIndex:200,maxHeight:220,overflowY:'auto'}}>
                          {foodResults.map((food,i)=>(
                            <div key={i}
                              onMouseDown={e=>{e.preventDefault();selectFoodFromSearch(food)}}
                              style={{padding:'8px 12px',borderBottom:'0.5px solid #F5F3EF',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                              onMouseEnter={e=>e.currentTarget.style.background='#FEF0E7'}
                              onMouseLeave={e=>e.currentTarget.style.background='white'}>
                              <div>
                                <div style={{fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{food.name||food.food_name}</div>
                                {food.brand&&<div style={{fontSize:10,color:'#AAA'}}>{food.brand}</div>}
                              </div>
                              <div style={{fontSize:10,color:'#D4570A',fontWeight:600,textAlign:'right',flexShrink:0}}>
                                <div>{Math.round(food.kcal_100??food.kcal??0)} kcal/100g</div>
                                <div style={{color:'#AAA'}}>P{food.protein_100??food.protein_g??0}g</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginBottom:7}}>
                      <div>
                        <div style={{fontSize:8,color:'#AAA',textAlign:'center',marginBottom:1}}>Grammi</div>
                        <input style={{...s.input,padding:'4px 3px',fontSize:11,textAlign:'center',fontWeight:700,color:'#D4570A',background:'rgba(212,87,10,0.1)',borderColor:'#F4C9A8'}} type="number" value={newFood.quantity_g} onChange={e=>updateNewFoodQty(e.target.value)}/>
                      </div>
                      {[{k:'kcal',l:'Kcal'},{k:'protein_g',l:'Prot'},{k:'carbs_g',l:'Carbo'},{k:'fat_g',l:'Grassi'}].map(f=>(
                        <div key={f.k}>
                          <div style={{fontSize:8,color:'#AAA',textAlign:'center',marginBottom:1}}>{f.l}</div>
                          <input style={{...s.input,padding:'4px 3px',fontSize:11,textAlign:'center',background:newFood._k100!=null?'#EAF3DE':'#F5F3EF'}} type="number" value={newFood[f.k]} onChange={e=>setNewFood(p=>({...p,[f.k]:e.target.value}))}/>
                        </div>
                      ))}
                    </div>
                    {newFood.kcal>0 && (
                      <div style={{background:'#0D0D0D',borderRadius:6,padding:'5px 8px',marginBottom:6,display:'flex',gap:8,fontSize:10}}>
                        <span style={{fontWeight:700,color:'#D4570A'}}>{Math.round(newFood.kcal)} kcal</span>
                        <span style={{color:'#4A90D4'}}>P {newFood.protein_g}g</span>
                        <span style={{color:'#E8A020'}}>C {newFood.carbs_g}g</span>
                        <span style={{color:'#3B8C5A'}}>G {newFood.fat_g}g</span>
                      </div>
                    )}
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>addFood(meal.id)} disabled={!newFood.food_name.trim()} style={{...s.btn,flex:1,justifyContent:'center',fontSize:12,opacity:!newFood.food_name.trim()?0.5:1}}>
                        <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi
                      </button>
                      <button onClick={()=>{setAddingFoodToMeal(null);setNewFood({food_name:'',quantity_g:100,kcal:0,protein_g:0,carbs_g:0,fat_g:0});setFoodSearch('');setFoodResults([])}} style={s.btnGray}>Annulla</button>
                    </div>
                  </div>
                ) : (
                  <div style={{padding:'8px 12px',display:'flex',gap:6}}>
                    <button onClick={()=>setAddingFoodToMeal(meal.id)} style={{...s.btnGray,flex:1,justifyContent:'center',display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                      <i className="ti ti-plus" style={{fontSize:12}}/>Aggiungi alimento
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* AGGIUNGI PASTO */}
          {showAddMeal ? (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'12px',marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:'#F0F0F0',marginBottom:8}}>Aggiungi pasto</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                {MEAL_TYPES.map(t=>(
                  <button key={t} onClick={()=>setNewMealType(t)} style={{
                    padding:'5px 12px',borderRadius:14,fontSize:11,fontWeight:600,cursor:'pointer',
                    border:'0.5px solid',fontFamily:'inherit',textTransform:'capitalize',
                    background:newMealType===t?'#D4570A':'white',
                    color:newMealType===t?'white':'#888780',
                    borderColor:newMealType===t?'#D4570A':'#E0DDD6',
                  }}>{t}</button>
                ))}
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={addMeal} style={{...s.btn,flex:1,justifyContent:'center',fontSize:12}}>Aggiungi</button>
                <button onClick={()=>setShowAddMeal(false)} style={s.btnGray}>Annulla</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setShowAddMeal(true)} style={{...s.btnGray,width:'100%',justifyContent:'center',display:'flex',alignItems:'center',gap:6,padding:'10px',marginBottom:10,fontSize:12}}>
              <i className="ti ti-plus" style={{fontSize:14}}/>Aggiungi pasto
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
