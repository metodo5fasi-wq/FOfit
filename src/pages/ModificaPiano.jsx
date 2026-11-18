import React, { useState, useEffect, useRef } from 'react'
import { askConfirm } from '../lib/confirm'
import { dbMust, notify, done } from '../lib/db'
import { uuid } from '../lib/offline'
import { NotesEditor, PLACEHOLDER_PIANO } from '../components/CoachNotes'
import { normalizeNotes, hasNotes } from '../lib/coachNotes'
import { DAY_NAMES as DAYS, num, enrichMeals, validateMeals, problemsMessage, suspiciousFoods, suspiciousMessage, planSave, hasWork, planPatch, copyDay, moveMeal, moveFood, writeDraft, readDraft, clearDraft, draftIsUseful, draftIsStale } from '../lib/mealPlan'
import { startHandleDrag } from '../lib/dragHandle'
import { authFetch } from '../lib/authFetch'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlanPdfButton from '../components/PlanPdfButton'
import AlternativePicker from '../components/AlternativePicker'
import { planPropagation } from '../lib/alternatives'
import { useToast } from '../components/Toast'
import * as MT from '../lib/mealTemplates'
import { searchFoods } from '../data/foodDatabase.js'

const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }
const MEAL_TYPES = ['colazione','spuntino','pranzo','pre-workout','merenda','cena']
const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']

const s = {
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', marginBottom:12, overflow:'hidden' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  btnSm: { background:'rgba(212,87,10,0.1)', color:'#F4894A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
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

const targetsOf = plan => ({ kcal_target: plan?.kcal_target, protein_target_g: plan?.protein_target_g, carbs_target_g: plan?.carbs_target_g, fat_target_g: plan?.fat_target_g })

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

  // Ricalcola kcal e macro di tutti gli alimenti dal database alimenti. Solo sulla pagina: si controlla e poi si preme Salva (o Scarta). Prima scriveva subito sul database, senza chiedere.
  async function fixMacros() {
    const allFoods = meals.flatMap(m => m.plan_meal_foods)
    const found = allFoods.filter(f => searchFoods(f.food_name)?.length)
    if (!found.length) { toast('Nessun alimento trovato nel database', 'info'); return }
    if (!(await askConfirm(`Ricalcolare kcal e macro di ${found.length} alimenti dal database? I valori che hai scritto a mano verranno sostituiti. Potrai controllare e poi salvare, oppure scartare.`, { title: 'Ricalcolare i macro?', confirmLabel: 'Ricalcola' }))) return
    setFixingMacros(true)
    try {
      const updates = new Map()
      for (const food of found) {
        const match = searchFoods(food.food_name)[0], qty = parseFloat(food.quantity_g) || 100
        updates.set(food.id, { kcal: Math.round(match.kcal100 * qty / 100), protein_g: Math.round(match.p * qty / 100 * 10) / 10, carbs_g: Math.round(match.c * qty / 100 * 10) / 10, fat_g: Math.round(match.g * qty / 100 * 10) / 10 })
      }
      setMeals(prev => prev.map(m => ({ ...m, plan_meal_foods: m.plan_meal_foods.map(f => {
        const u = updates.get(f.id)
        return u ? { ...f, ...u, _origKcal: u.kcal, _origProt: u.protein_g, _origCarbs: u.carbs_g, _origFat: u.fat_g } : f
      }) })))
      setDirty(true)
      toast(`Ricalcolati ${updates.size} alimenti: controlla e premi Salva`, 'success')
    } catch(e) {
      console.error(e)
      toast('Errore nel ricalcolo: ' + e.message, 'error')
    }
    setFixingMacros(false)
  }
  const [dirty, setDirty] = useState(false)
  const [notes, setNotes] = useState('')                       // note generali: il cliente le legge in cima alla sua sezione Piano alimentare
  const [notesOpen, setNotesOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)          // dopo un tentativo di salvataggio i campi da controllare restano in rosso
  const [draftOffer, setDraftOffer] = useState(null)           // bozza non salvata trovata all'apertura
  const serverRef = useRef({ meals: [], targets: {}, notes: '' })   // com'è il piano sul server (serve a capire se una bozza è ancora valida)
  const latest = useRef({})
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  const mb = isMobile ? { padding:0, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 } : { padding:'3px 6px' }   // pulsanti dell'intestazione del pasto: più grandi al tocco
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
  const [templatesRemote, setTemplatesRemote] = useState(true)      // false = la tabella dei modelli non c'è ancora: si usa il browser
  const [showTemplates, setShowTemplates] = useState(null) // mealId
  const [showSaveTemplate, setShowSaveTemplate] = useState(null) // mealId
  const [templateName, setTemplateName] = useState('')
  const [showCopyDay, setShowCopyDay] = useState(false)
  const [dragFoodId, setDragFoodId] = useState(null)
  const [dragFoodMeal, setDragFoodMeal] = useState(null)
  const [dragOverFoodId, setDragOverFoodId] = useState(null)
  const [showMacroTarget, setShowMacroTarget] = useState(false)
  const [mealTargets, setMealTargets] = useState({})

  useEffect(() => { if (planId) fetchPlan({ checkDraft: true }) }, [planId])

  // quiet: dopo un salvataggio si rilegge senza far lampeggiare la pagina
  async function fetchPlan({ quiet = false, checkDraft = false } = {}) {
    if (!quiet) setLoading(true)
    const { data: planData } = await supabase.from('meal_plans').select('*').eq('id', planId).single()
    if (!planData) { setLoading(false); return }
    setPlan(planData)
    const planNotes = planData.notes || ''
    setNotes(planNotes)
    if (checkDraft) setNotesOpen(hasNotes(planNotes) && window.innerWidth >= 900)          // sul computer, se ci sono già note si aprono; sul telefono restano chiuse (occuperebbero lo schermo)

    // cliente e pasti non dipendono l'uno dall'altro: insieme
    const [{ data: prof }, { data: mealsData }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', planData.client_id).single(),
      supabase.from('plan_meals').select('*, plan_meal_foods(*)').eq('plan_id', planId).order('day_of_week').order('meal_order'),
    ])
    setClientName(prof?.full_name || '')
    const enriched = enrichMeals(mealsData)          // alimenti nell'ordine scelto dal coach, kcal coerenti con i macro
    setMeals(enriched)
    const targets = { kcal_target: planData.kcal_target, protein_target_g: planData.protein_target_g, carbs_target_g: planData.carbs_target_g, fat_target_g: planData.fat_target_g }
    serverRef.current = { meals: enriched, targets, notes: planNotes }
    if (checkDraft) { const d = readDraft(planId); if (draftIsUseful(d, serverRef.current)) setDraftOffer(d); else if (d) clearDraft(planId) }
    setLoading(false)
  }

  latest.current = { planId, meals, plan, notes, selectedDay, dirty, draftOffer }
  // Bozza sul telefono: ogni modifica si ricorda (anche se chiudi la pagina o il telefono si spegne). Finché si sceglie cosa fare di una bozza trovata, non si sovrascrive.
  const draftState = l => ({ meals: l.meals, targets: targetsOf(l.plan), notes: l.notes, selectedDay: l.selectedDay })
  useEffect(() => {
    if (loading || !dirty || draftOffer) return
    const tm = setTimeout(() => writeDraft(planId, draftState(latest.current), serverRef.current), 500)
    return () => clearTimeout(tm)
  }, [meals, plan, notes, selectedDay, dirty, loading, draftOffer])
  useEffect(() => () => { const l = latest.current; if (l.dirty && !l.draftOffer) writeDraft(l.planId, draftState(l), serverRef.current) }, [])

  async function goBack() {
    if (dirty && !(await askConfirm('Hai modifiche non salvate. Se esci restano come bozza su questo telefono e potrai ripristinarle riaprendo il piano.', { title: 'Modifiche non salvate', confirmLabel: 'Esci', cancelLabel: 'Resta qui', danger: true }))) return
    navigate(-1)
  }
  async function discardChanges() {
    if (!(await askConfirm('Scartare tutte le modifiche non salvate? Tornerà il piano com\'è salvato.', { title: 'Scartare le modifiche?', confirmLabel: 'Scarta', danger: true }))) return
    clearDraft(planId); setDraftOffer(null); setDirty(false); setShowErrors(false); setShowAddMeal(false); setAddingFoodToMeal(null)
    await fetchPlan({ quiet: true }); done('Modifiche scartate')
  }
  function restoreDraft() {
    const d = draftOffer; if (!d) return
    setMeals(d.meals)
    setPlan(p => ({ ...p, ...(d.targets || {}) }))
    if (typeof d.notes === 'string') { setNotes(d.notes); if (hasNotes(d.notes)) setNotesOpen(true) }
    if (d.selectedDay >= 1 && d.selectedDay <= 7) setSelectedDay(d.selectedDay)
    setDirty(true); setDraftOffer(null); done('Bozza ripristinata')
  }
  function discardDraft() { clearDraft(planId); setDraftOffer(null) }

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
    if (!(await askConfirm('Rimuovere questo pasto e tutti i suoi alimenti?', { confirmLabel: 'Rimuovi', danger: true }))) return
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
          const r = await authFetch(`/api/search-food?q=${encodeURIComponent(query)}&limit=10`)
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
  async function saveTemplate(mealId) {
    const meal = meals.find(m => m.id === mealId)
    if (!meal || !templateName.trim()) return
    if (!(meal.plan_meal_foods || []).length) { notify('Il pasto è vuoto: aggiungi almeno un alimento prima di salvarlo come modello.', 'error'); return }
    const r = await MT.saveTemplate({ name: templateName, meal_type: meal.meal_type, foods: meal.plan_meal_foods }, templatesRemote)
    if (!r.ok) { notify('Non sono riuscito a salvare il modello. Riprova.', 'error'); return }
    setSavedTemplates(prev => [...prev, r.template])
    setShowSaveTemplate(null)
    setTemplateName('')
    done(r.remote ? 'Modello salvato' : 'Modello salvato solo su questo dispositivo')
  }

  async function loadTemplates() {
    const r = await MT.loadTemplates()
    setSavedTemplates(r.templates); setTemplatesRemote(r.remote)
  }

  function applyTemplate(mealId, template) {
    const newFoods = template.foods.map(f => ({
      ...f, id: uuid(),
    }))
    setMeals(prev => prev.map(m => m.id === mealId
      ? { ...m, plan_meal_foods: [...(m.plan_meal_foods||[]), ...newFoods] }
      : m
    ))
    setShowTemplates(null)
    setDirty(true)
  }

  async function deleteTemplate(id) {
    const r = await MT.deleteTemplate(id, templatesRemote)
    if (!r.ok) { notify('Non sono riuscito a eliminare il modello.', 'error'); return }
    setSavedTemplates(prev => prev.filter(t => t.id !== id))
  }

  // ── COPIA GIORNO INTERO ──────────────────────────────────
  async function copyDayTo(targetDay) {
    const existing = meals.filter(m => m.day_of_week === targetDay).length
    if (existing && !(await askConfirm(`${DAYS[targetDay - 1]} ha già ${existing} ${existing === 1 ? 'pasto' : 'pasti'}: verranno sostituiti con quelli di ${DAYS[selectedDay - 1]}. Potrai scartare tutto prima di salvare.`, { title: 'Sostituire il giorno?', confirmLabel: 'Sostituisci', danger: true }))) { return }
    setMeals(prev => copyDay(prev, selectedDay, targetDay, uuid))
    setShowCopyDay(false)
    setDirty(true)
    done(`${DAYS[selectedDay - 1]} copiato su ${DAYS[targetDay - 1]}`)
  }

  // ── DRAG ALIMENTI DENTRO PASTO ───────────────────────────
  function handleFoodDragStart(mealId, foodId) {
    setDragFoodMeal(mealId); setDragFoodId(foodId)
  }
  // Sposta un alimento di una posizione (per il telefono, dove il trascinamento non è comodo)
  function shiftFood(mealId, foodId, dir) {
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      const L = m.plan_meal_foods || [], i = L.findIndex(f => f.id === foodId), j = i + dir
      if (i < 0 || j < 0 || j >= L.length) return m
      return { ...m, plan_meal_foods: moveFood(L, foodId, L[j].id) }
    }))
    setDirty(true)
  }
  function handleFoodDragOver(e, foodId) { e.preventDefault(); setDragOverFoodId(foodId) }
  function handleFoodDrop(mealId, targetFoodId) {
    if (!dragFoodId || dragFoodId === targetFoodId || dragFoodMeal !== mealId) {
      setDragFoodId(null); setDragOverFoodId(null); return
    }
    setMeals(prev => prev.map(m => m.id !== mealId ? m : { ...m, plan_meal_foods: moveFood(m.plan_meal_foods || [], dragFoodId, targetFoodId) }))
    setDragFoodId(null); setDragOverFoodId(null); setDragFoodMeal(null)
    setDirty(true)
  }
  function handleFoodDragEnd() { setDragFoodId(null); setDragOverFoodId(null); setDragFoodMeal(null) }

  // Carica template al mount
  React.useEffect(() => { loadTemplates() }, [])

  async function addFood(mealId) {
    if (!newFood.food_name.trim()) return
    const food = {
      id: uuid(),
      plan_meal_id: mealId,
      food_name: newFood.food_name,
      quantity_g: parseFloat(newFood.quantity_g) || 100,
      kcal: parseInt(newFood.kcal) || 0,
      protein_g: parseFloat(newFood.protein_g) || 0,
      carbs_g: parseFloat(newFood.carbs_g) || 0,
      fat_g: parseFloat(newFood.fat_g) || 0,
      _origQty: parseFloat(newFood.quantity_g) || 100,
      _origKcal: parseInt(newFood.kcal) || 0,
      _origProt: parseFloat(newFood.protein_g) || 0,
      _origCarbs: parseFloat(newFood.carbs_g) || 0,
      _origFat: parseFloat(newFood.fat_g) || 0,
    }
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, plan_meal_foods: [...m.plan_meal_foods, food] } : m))
    setNewFood({ food_name:'', quantity_g:100, kcal:0, protein_g:0, carbs_g:0, fat_g:0 })
    setAddingFoodToMeal(null)
    setDirty(true)
  }

  // Aggiunge un pasto SOLO sulla pagina: finisce sul database con "Salva" (prima si scriveva subito e uno "Scarta" non lo toglieva)
  function addMeal() {
    setMeals(prev => [...prev, { id: uuid(), plan_id: planId, day_of_week: selectedDay, day_label: DAYS[selectedDay - 1], meal_type: newMealType, plan_meal_foods: [] }])
    setShowAddMeal(false)
    setDirty(true)
  }

  // Sposta un pasto su/giù dentro il giorno (prima l'ordine dei pasti non si poteva cambiare)
  function shiftMeal(id, dir) { setMeals(prev => moveMeal(prev, id, dir)); setDirty(true) }

  // ── ALTERNATIVE SCELTE ───────────────────────────────────
  function setFoodAlts(mealId, foodId, alts) {
    setMeals(prev => prev.map(m => m.id !== mealId ? m : { ...m, plan_meal_foods: m.plan_meal_foods.map(f => f.id === foodId ? { ...f, alternatives: alts } : f) }))
    setDirty(true)
  }
  const altItems = ms => ms.flatMap(m => (m.plan_meal_foods || []).map(f => ({ key: f.id, day: m.day_of_week, mealType: m.meal_type, name: f.food_name, alts: f.alternatives })))
  // Riporta le alternative sugli stessi alimenti (stesso nome, stesso tipo di pasto) degli altri giorni: i grammi si adeguano da soli, a pari calorie
  async function propagateAlts({ fromKey = null, day = null, overwrite = false }) {
    const r = planPropagation(altItems(meals), { fromKey, day, overwrite })
    if (!r.count) { notify(r.kept ? `Gli altri giorni hanno già le loro alternative (${r.kept} alimenti): non ho toccato nulla.` : 'Non ci sono altri giorni con lo stesso alimento nello stesso tipo di pasto.', 'error'); return }
    if (overwrite && !(await askConfirm(`Le alternative verranno riportate su ${r.count} ${r.count === 1 ? 'alimento' : 'alimenti'} degli altri giorni, sostituendo quelle che hanno già. Potrai scartare tutto prima di salvare.`, { title: 'Applicare a tutti i giorni?', confirmLabel: 'Applica' }))) return
    setMeals(prev => prev.map(m => ({ ...m, plan_meal_foods: m.plan_meal_foods.map(f => r.updates.has(f.id) ? { ...f, alternatives: r.updates.get(f.id) } : f) })))
    setDirty(true)
    done(`Alternative riportate su ${r.count} ${r.count === 1 ? 'alimento' : 'alimenti'}${r.kept ? ` (${r.kept} con scelte proprie lasciati com'erano)` : ''}`)
  }

  // Salva tutto. Ordine pensato per non perdere nulla: PRIMA si inserisce e si aggiorna, per ULTIMA si elimina
  // (se qualcosa va storto a metà, niente è stato cancellato e puoi riprovare: la pagina resta com'era).
  async function saveAll() {
    if (saving) return
    const problems = validateMeals(meals)
    if (problems.length) {
      setShowErrors(true); notify(problemsMessage(problems), 'error')
      setSelectedDay(problems[0].day)
      return
    }
    setSaving(true)
    try {
      // lo stato del database ORA (non quello di quando si è aperta la pagina): così si scrive solo ciò che serve
      const { data: dbMeals, error: e1 } = await supabase.from('plan_meals').select('*').eq('plan_id', planId)
      if (e1) throw new Error('Non riesco a leggere il piano: riprova')
      const ids = (dbMeals || []).map(m => m.id)
      let dbFoods = []
      if (ids.length) { const r = await supabase.from('plan_meal_foods').select('*').in('plan_meal_id', ids); if (r.error) throw new Error('Non riesco a leggere il piano: riprova'); dbFoods = r.data || [] }
      const work = planSave({ planId, meals, dbMeals: dbMeals || [], dbFoods })
      const patch = planPatch(plan, serverRef.current.targets, notes, serverRef.current.notes, normalizeNotes)

      // alimenti con quantità insolite (0 g, oltre 2000 g): si chiede conferma
      const odd = suspiciousFoods(meals, new Map(dbFoods.map(f => [f.id, f])))
      if (odd.length && !(await askConfirm(suspiciousMessage(odd), { title: 'Controlla le quantità', confirmLabel: 'Salva comunque', cancelLabel: 'Torna a controllare' }))) { setSaving(false); return }

      if (work.insertMeals.length) await dbMust(supabase.from('plan_meals').insert(work.insertMeals), 'il piano', 'salvare')
      if (work.insertFoods.length) await dbMust(supabase.from('plan_meal_foods').insert(work.insertFoods), 'il piano', 'salvare')
      for (let k = 0; k < work.updateMeals.length; k += 8)
        await Promise.all(work.updateMeals.slice(k, k + 8).map(({ id, ...p }) => dbMust(supabase.from('plan_meals').update(p).eq('id', id), 'il piano', 'salvare')))
      for (let k = 0; k < work.updateFoods.length; k += 8)
        await Promise.all(work.updateFoods.slice(k, k + 8).map(({ id, ...p }) => dbMust(supabase.from('plan_meal_foods').update(p).eq('id', id), 'il piano', 'salvare')))
      // target e note del piano (prima il tasto Salva non li scriveva: restavano solo nella pagina)
      if (Object.keys(patch).length) await dbMust(supabase.from('meal_plans').update(patch).eq('id', planId), 'il piano', 'salvare')
      // eliminazioni per ULTIME: prima gli alimenti, poi i pasti
      if (work.deleteFoodIds.length) await dbMust(supabase.from('plan_meal_foods').delete().in('id', work.deleteFoodIds), 'il piano', 'eliminare')
      if (work.deleteMealIds.length) await dbMust(supabase.from('plan_meals').delete().in('id', work.deleteMealIds), 'il piano', 'eliminare')

      clearDraft(planId); setDraftOffer(null); setShowErrors(false)          // niente avviso di bozza vecchia dopo aver salvato
      setDirty(false)
      done('Piano salvato')
      await fetchPlan({ quiet: true })
    } catch(e) {
      console.error('saveAll:', e)
      if (/alternatives/i.test(e.cause?.message || '')) { notify('Per salvare le alternative serve eseguire lo script fofit-alternative.sql su Supabase (una volta sola). Poi premi di nuovo Salva.', 'error'); setSaving(false); return }
      notify(e.message || 'Non sono riuscito a salvare il piano. Riprova.', 'error')       // la pagina resta com'era: le modifiche sono ancora lì
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:600}}>Modifica piano</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#AAA',fontSize:13}}>Caricamento...</div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',background:'#161616'}}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <button className="tap" aria-label="Indietro" onClick={goBack} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #1C1C1C',background:'#161616',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><i className="ti ti-arrow-left" style={{fontSize:16}}/></button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{plan?.title || 'Piano alimentare'}</div>
          <div style={{fontSize:11,color:'#AAA',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{clientName}{plan && ` · target: ${plan.kcal_target} kcal`}</div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
          <PlanPdfButton planId={planId} confirmMessage={dirty ? 'Ci sono modifiche non salvate: il PDF userà la versione salvata del piano. Continuare?' : null} style={{padding:'5px 9px',fontSize:11}}/>
          <button onClick={fixMacros} disabled={fixingMacros} title="Ricalcola tutti i macro dal database" aria-label="Ricalcola i macro"
            style={{...s.btnGray,padding:isMobile?'0':'5px 9px',...(isMobile?{width:38,height:38,justifyContent:'center'}:{}),fontSize:11,display:'flex',alignItems:'center',gap:4}}>
            {fixingMacros
              ? <><i className="ti ti-loader-2" style={{fontSize:12}}/>{!isMobile && 'Ricalcolo...'}</>
              : <><i className="ti ti-refresh" style={{fontSize:isMobile?16:12}}/>{!isMobile && 'Ricalcola'}</>}
          </button>
          {!saving && dirty && (
            <button aria-label="Scarta le modifiche" onClick={discardChanges} style={{...s.btnGray,padding:isMobile?'10px 12px':'8px 10px'}}>Scarta</button>
          )}
          <button onClick={saveAll} disabled={saving}
            style={{...s.btn,minWidth:80,...(isMobile?{padding:'10px 14px'}:{}),display:'flex',alignItems:'center',gap:4,
              background:saving?'#888':dirty?'#D4570A':'#888780',
            }}>
            {saving
              ? <><i className="ti ti-loader-2" style={{fontSize:12}}/>Salvo...</>
              : <><i className="ti ti-device-floppy" style={{fontSize:12}}/>{dirty?'Salva':'Salvato'}</>}
          </button>
        </div>
      </div>

      {/* Telefono: un'unica area che scorre (totali, note, giorni, pasti). Computer: nessun cambiamento (display:contents) */}
      <div data-testid="area-scorrevole" style={isMobile ? {flex:1,minHeight:0,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',display:'flex',flexDirection:'column'} : {display:'contents'}}>

      {/* MACRO UNIFICATO: target + live nella stessa sezione */}
      <div style={{background:'#0D0D0D',padding:'10px 14px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
          <span style={{fontSize:9,fontWeight:700,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.07em'}}>Inserito / Target <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>· i target si salvano con «Salva»</span></span>
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
                <input inputMode="numeric" type="number"
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
              <button onClick={()=>{setPlan(p=>({...p,kcal_target:mk}));setDirty(true)}} style={{fontSize:9,background:'#E8A020',color:'#161616',border:'none',borderRadius:4,padding:'2px 7px',cursor:'pointer',fontFamily:'inherit'}}>Allinea</button>
            </div>
          ):null
        })()}
      </div>

      {/* BOZZA NON SALVATA TROVATA ALL'APERTURA */}
      {draftOffer && (
        <div role="status" data-testid="bozza-trovata" style={{background:'rgba(244,137,74,0.12)',borderBottom:'0.5px solid rgba(244,137,74,0.4)',padding:'9px 14px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
          <i className="ti ti-alert-triangle" style={{fontSize:16,color:'#F4894A'}}/>
          <span style={{fontSize:12,color:'#F4894A',flex:1,minWidth:200,lineHeight:1.45}}>
            Hai modifiche non salvate del {new Date(draftOffer.savedAt).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{draftIsStale(draftOffer, serverRef.current) ? ' — ma il piano è stato modificato dopo: controlla bene prima di salvare' : ''}.
          </span>
          <button onClick={restoreDraft} style={{...s.btn,padding:'6px 14px',fontSize:12}}>Ripristina</button>
          <button onClick={discardDraft} style={{...s.btnGray,padding:'6px 12px'}}>Scarta</button>
        </div>
      )}

      {/* NOTE GENERALI PER IL CLIENTE */}
      <div data-testid="note-generali" style={{background:'#0D0D0D',borderBottom:'0.5px solid #1C1C1C',flexShrink:0}}>
        <button onClick={()=>setNotesOpen(o=>!o)} aria-expanded={notesOpen} aria-controls="note-generali-corpo"
          style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 14px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <i className="ti ti-notes" style={{fontSize:16,color:'#F4894A'}}/>
          <span style={{fontSize:12,fontWeight:700,color:'#F0F0F0'}}>Note generali per il cliente</span>
          <span style={{fontSize:11,color:hasNotes(notes)?'#6FCF97':'#888',flex:1}}>{hasNotes(notes) ? `${normalizeNotes(notes).length} caratteri · le vede nel suo Piano alimentare` : 'vuote · scrivi qui indicazioni e consigli'}</span>
          <i className={`ti ti-chevron-${notesOpen?'up':'down'}`} style={{fontSize:15,color:'#AAA'}}/>
        </button>
        {notesOpen && (
          <div id="note-generali-corpo" style={{padding:'0 14px 12px',maxHeight:'55vh',overflowY:'auto'}}>
            <NotesEditor idPrefix="modifica-piano" placeholder={PLACEHOLDER_PIANO} value={notes} onChange={v=>{ setNotes(v); setDirty(true) }}/>
          </div>
        )}
      </div>

      <div style={{background:'#0D0D0D',padding:'6px 14px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
        {/* AZIONI GIORNO */}
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>setShowCopyDay(!showCopyDay)} style={{fontSize:10,background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit',color:'#AAA'}}>
            📋 Copia giorno su...
          </button>
          <button data-testid="alt-riporta-giorno" onClick={()=>propagateAlts({ day: selectedDay })} style={{fontSize:10,background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit',color:'#AAA'}}>
            🔁 Alternative su tutti i giorni
          </button>
          <button onClick={()=>setShowMacroTarget(!showMacroTarget)} style={{fontSize:10,background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit',color:'#AAA'}}>
            🎯 Target per pasto
          </button>
        </div>
        {showCopyDay && (
          <div style={{marginTop:6,display:'flex',gap:6,flexWrap:'wrap'}}>
            {DAY_NAMES.filter((_,i)=>i+1!==selectedDay).map((dn,i)=>(
              <button key={dn} onClick={()=>copyDayTo(DAY_NAMES.indexOf(dn)+1)} style={{fontSize:11,fontWeight:600,background:'#0D0D0D',border:'0.5px solid #D4570A',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit',color:'#F4894A'}}>{dn}</button>
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
                  <input inputMode="decimal" type="number" min="0" max="100" value={mealTargets[m.id]||''} onChange={e=>setMealTargets(p=>({...p,[m.id]:e.target.value}))}
                    style={{width:44,padding:'3px 5px',border:'0.5px solid rgba(74,144,212,0.4)',borderRadius:5,fontSize:11,fontFamily:'inherit',textAlign:'center'}}/>
                  <span style={{fontSize:9,color:'#4A90D4'}}>%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LAYOUT PRINCIPALE */}
      <div style={isMobile ? {flexShrink:0} : {flex:1,display:'flex',overflow:'hidden'}}>

        {/* SIDEBAR GIORNI (PC) o TABS (Mobile) */}
        {isMobile ? (
          <div data-testid="barra-giorni" style={{position:'sticky',top:0,zIndex:20,background:'#0D0D0D',borderBottom:'0.5px solid #1A1A1A'}}>
          <div style={{display:'flex',overflowX:'auto',padding:'8px 12px 6px',gap:6}}>
            {DAY_NAMES.map((dn,i) => {
              const dayN = i+1
              const dayM = meals.filter(m=>m.day_of_week===dayN)
              const hasFood = dayM.some(m=>m.plan_meal_foods?.length>0)
              return (
                <button key={dayN} onClick={()=>setSelectedDay(dayN)} style={{
                  flexShrink:0,padding:'8px 14px',minHeight:36,borderRadius:18,fontSize:12,fontWeight:600,
                  cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
                  background:selectedDay===dayN?'#D4570A':'#0D0D0D',
                  color:selectedDay===dayN?'white':hasFood?'#F0F0F0':'#AAA',
                  borderColor:selectedDay===dayN?'#D4570A':hasFood?'#2A2A2A':'#1C1C1C',
                }}>{dn.slice(0,3)}</button>
              )
            })}
          </div>
          {plan && (() => {
            const items=[['Kcal',dayTotals.kcal,plan.kcal_target,'#D4570A'],['P',dayTotals.protein,plan.protein_target_g,'#4A90D4'],['C',dayTotals.carbs,plan.carbs_target_g,'#E8A020'],['G',dayTotals.fat,plan.fat_target_g,'#3B8C5A']]
            return (
              <div data-testid="totali-giorno" style={{display:'flex',justifyContent:'space-between',gap:6,padding:'0 14px 7px',fontSize:11,fontWeight:700}}>
                {items.map(([l,v,t,c])=>{ const pct=t>0?v/t*100:0, col=pct>110?'#E24B4A':pct>=90?'#6FCF97':c; return <span key={l} style={{color:col,whiteSpace:'nowrap'}}>{l} {Math.round(v)}<span style={{color:'#888',fontWeight:500}}>/{t||'–'}</span></span> })}
              </div>
            )
          })()}
          </div>
        ) : (
          <div style={{width:160,flexShrink:0,background:'#0D0D0D',borderRight:'0.5px solid #1A1A1A',overflowY:'auto'}}>
            <div style={{padding:'10px 12px',borderBottom:'0.5px solid #1C1C1C',fontSize:10,fontWeight:700,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.08em'}}>Giorni</div>
            {DAY_NAMES.map((dn,i) => {
              const dayN = i+1
              const dayM = meals.filter(m=>m.day_of_week===dayN)
              const dayKcal = dayM.reduce((s,m)=>(m.plan_meal_foods||[]).reduce((ss,f)=>ss+(parseFloat(f.kcal)||0),s),0)
              const hasFood = dayM.some(m=>m.plan_meal_foods?.length>0)
              const pct = plan?.kcal_target ? Math.min(100,Math.round(dayKcal/plan.kcal_target*100)) : 0
              return (
                <div key={dayN} onClick={()=>setSelectedDay(dayN)} style={{
                  padding:'10px 12px',cursor:'pointer',
                  background:selectedDay===dayN?'rgba(212,87,10,0.14)':'transparent',
                  borderLeft:selectedDay===dayN?'3px solid #D4570A':'3px solid transparent',
                  transition:'all 0.1s',
                }}>
                  <div style={{fontSize:12,fontWeight:selectedDay===dayN?700:500,color:selectedDay===dayN?'#F4894A':'#F0F0F0'}}>{dn}</div>
                  {hasFood && (
                    <>
                      <div style={{fontSize:10,color:'#AAA',marginTop:1}}>{Math.round(dayKcal)} kcal</div>
                      <div style={{height:3,background:'#141414',borderRadius:2,marginTop:3,overflow:'hidden'}}>
                        <div style={{height:3,background:selectedDay===dayN?'#D4570A':'#2A2A2A',width:`${pct}%`,borderRadius:2}}/>
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
        <div style={isMobile ? {padding:'12px 12px 48px'} : {flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'12px'}}>
          {/* PASTI */}
          {dayMeals.map((meal) => {
            const mealKcal = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.kcal)||0),0))
            const mealProt = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.protein_g)||0),0)*10)/10
            const mealCarbs = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.carbs_g)||0),0)*10)/10
            const mealFat = Math.round((meal.plan_meal_foods||[]).reduce((s,f)=>s+(parseFloat(f.fat_g)||0),0)*10)/10
            return (
              <div key={meal.id} style={s.card}>
                {/* HEADER PASTO */}
                <div style={{background:'rgba(212,87,10,0.1)',borderBottom:'0.5px solid rgba(212,87,10,0.35)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',flexWrap:isMobile?'wrap':'nowrap'}}>
                    <i className={`ti ${MEAL_ICONS[meal.meal_type]||'ti-circle'}`} style={{fontSize:14,color:'#D4570A'}}/>
                    <div style={{flex:1,minWidth:isMobile?120:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#F4894A',textTransform:'capitalize'}}>{meal.meal_type}</div>
                      <div style={{fontSize:10,color:'#F4894A'}}>{mealKcal} kcal · P{mealProt}g C{mealCarbs}g G{mealFat}g
                        {mealTargets[meal.id] && plan?.kcal_target && (
                          <span style={{color:Math.abs(mealKcal - Math.round(plan.kcal_target*parseInt(mealTargets[meal.id]||0)/100)) < 50 ? '#6FCF97':'#E24B4A',fontWeight:700}}>
                            {' '}· target {Math.round(plan.kcal_target*parseInt(mealTargets[meal.id]||0)/100)} kcal
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:isMobile?6:4,flexWrap:isMobile?'wrap':'nowrap'}}>
                      <button aria-label="Sposta il pasto su" disabled={dayMeals[0]?.id===meal.id} onClick={()=>shiftMeal(meal.id,'up')} style={{...s.btnGray,...mb,fontSize:10,opacity:dayMeals[0]?.id===meal.id?0.35:1}}><i className="ti ti-chevron-up" style={{fontSize:isMobile?17:11}}/></button>
                      <button aria-label="Sposta il pasto giù" disabled={dayMeals[dayMeals.length-1]?.id===meal.id} onClick={()=>shiftMeal(meal.id,'down')} style={{...s.btnGray,...mb,fontSize:10,opacity:dayMeals[dayMeals.length-1]?.id===meal.id?0.35:1}}><i className="ti ti-chevron-down" style={{fontSize:isMobile?17:11}}/></button>
                      <button onClick={()=>setShowSaveTemplate(showSaveTemplate===meal.id?null:meal.id)} title="Salva template" aria-label="Salva come modello" style={{...s.btnGray,...mb,fontSize:isMobile?12:10,...(isMobile?{width:'auto',padding:'0 10px',gap:5}:{})}}><i className="ti ti-bookmark" style={{fontSize:isMobile?17:11}}/>{isMobile && 'Salva modello'}</button>
                      <button onClick={()=>{setShowTemplates(showTemplates===meal.id?null:meal.id);loadTemplates()}} title="Carica template" aria-label="Carica un modello" style={{...s.btnGray,...mb,fontSize:isMobile?12:10,...(isMobile?{width:'auto',padding:'0 10px',gap:5}:{})}}><i className="ti ti-bookmark" style={{fontSize:isMobile?17:11}}/>{isMobile && 'Carica modello'}</button>
                      <button aria-label="Elimina il pasto" onClick={()=>removeMeal(meal.id)} style={{...s.btnDanger,...mb,fontSize:10}}><i className="ti ti-trash" style={{fontSize:isMobile?17:11}}/></button>
                    </div>
                  </div>
                  {showSaveTemplate===meal.id && (
                    <div style={{padding:'6px 12px 8px',borderTop:'0.5px solid rgba(212,87,10,0.35)',display:'flex',gap:6}}>
                      <input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="Nome template..." style={{flex:1,padding:'4px 8px',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:6,fontSize:11,fontFamily:'inherit'}}/>
                      <button onClick={()=>saveTemplate(meal.id)} style={{...s.btn,padding:'4px 10px',fontSize:11}}>Salva</button>
                    </div>
                  )}
                  {showTemplates===meal.id && (
                    <div style={{padding:'6px 12px 8px',borderTop:'0.5px solid rgba(212,87,10,0.35)'}}>
                      {savedTemplates.length===0 ? <div style={{fontSize:11,color:'#AAA'}}>Nessun template salvato</div> :
                        savedTemplates.map(t=>(
                          <div key={t.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0'}}>
                            <div style={{flex:1,fontSize:11,fontWeight:600,color:'#F0F0F0'}}>{t.name} <span style={{color:'#AAA',fontWeight:400}}>· {t.foods?.reduce((s,f)=>s+(f.kcal||0),0)} kcal</span></div>
                            <button onClick={()=>applyTemplate(meal.id,t)} style={{...s.btn,padding:'3px 8px',fontSize:10}}>Usa</button>
                            <button aria-label="Elimina il template" onClick={()=>deleteTemplate(t.id)} style={{...s.btnDanger,padding:'3px 5px',fontSize:10}}><i className="ti ti-trash" style={{fontSize:10}}/></button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* ALIMENTI */}
                {(meal.plan_meal_foods||[]).map((food) => (
                  <div key={food.id} data-drag-card
                    onDragOver={e=>handleFoodDragOver(e,food.id)} onDrop={()=>handleFoodDrop(meal.id,food.id)}
                    style={{padding:'7px 12px',borderBottom:'0.5px solid #1C1C1C',
                      opacity:dragFoodId===food.id?0.4:1,
                      background:dragOverFoodId===food.id?'rgba(212,87,10,0.14)':'transparent'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                      <span draggable data-testid={`maniglia-${food.id}`} title="Trascina per riordinare" onDragStart={e=>{startHandleDrag(e);handleFoodDragStart(meal.id,food.id)}} onDragEnd={handleFoodDragEnd}
                        style={{display:'flex',padding:'6px 7px',margin:'-6px -4px',cursor:'grab',flexShrink:0,userSelect:'none'}}><i className="ti ti-grip-vertical" style={{fontSize:13,color:'#CCC'}}/></span>
                      <span style={{flex:1,fontSize:isMobile?13:12,fontWeight:600,color:'#F0F0F0',minWidth:0,overflowWrap:'anywhere'}}>{food.food_name}</span>
                      {isMobile && (()=>{ const L=meal.plan_meal_foods||[], i=L.findIndex(x=>x.id===food.id); return (<>
                        <button aria-label="Sposta l'alimento su" disabled={i<=0} onClick={()=>shiftFood(meal.id,food.id,-1)} style={{...s.btnGray,...mb,opacity:i<=0?0.35:1}}><i className="ti ti-chevron-up" style={{fontSize:17}}/></button>
                        <button aria-label="Sposta l'alimento giù" disabled={i>=L.length-1} onClick={()=>shiftFood(meal.id,food.id,1)} style={{...s.btnGray,...mb,opacity:i>=L.length-1?0.35:1}}><i className="ti ti-chevron-down" style={{fontSize:17}}/></button>
                      </>) })()}
                      <button aria-label="Rimuovi l'alimento" onClick={()=>removeFood(meal.id,food.id)} style={isMobile?{...s.btnDanger,...mb}:{background:'none',border:'none',cursor:'pointer',color:'#CCC',padding:'0 2px'}}><i className="ti ti-x" style={{fontSize:isMobile?17:12}}/></button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginLeft:19}}>
                      {[{k:'quantity_g',l:'g',bold:true},{k:'kcal',l:'kcal'},{k:'protein_g',l:'P'},{k:'carbs_g',l:'C'},{k:'fat_g',l:'G'}].map(f=>(
                        <div key={f.k}>
                          <div style={{fontSize:8,color:'#AAA',textAlign:'center',marginBottom:1}}>{f.l}</div>
                          <input inputMode="decimal" aria-label={`${f.l} di ${food.food_name}`} style={{...s.input,padding:'4px 3px',fontSize:11,textAlign:'center',fontWeight:f.bold?700:400,background:f.bold?'rgba(212,87,10,0.12)':'#161616',borderColor:f.bold?'rgba(212,87,10,0.3)':'#222',...(showErrors && num(food[f.k])<0 ? {borderColor:'#E24B4A',background:'rgba(226,75,74,0.08)'} : null)}}
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
                    <AlternativePicker food={food} mealType={meal.meal_type}
                      onChange={alts=>setFoodAlts(meal.id,food.id,alts)}
                      onApplyAll={()=>propagateAlts({ fromKey: food.id, overwrite: true })}/>
                  </div>
                ))}

                {/* AGGIUNGI ALIMENTO */}
                {addingFoodToMeal===meal.id ? (
                  <div style={{padding:'10px 12px',background:'#161616',borderTop:'0.5px solid #1A1A1A'}}>
                    <div style={{marginBottom:7}}>
                     <div style={{position:'relative'}}>
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
                     </div>
                      {foodResults.length>0 && (
                        <div data-testid="risultati-alimenti" style={{marginTop:4,background:'#0D0D0D',border:'0.5px solid #1C1C1C',borderRadius:9,maxHeight:isMobile?'40vh':220,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
                          {foodResults.map((food,i)=>(
                            <div key={i}
                              onMouseDown={e=>{e.preventDefault();selectFoodFromSearch(food)}}
                              style={{padding:'8px 12px',borderBottom:'0.5px solid #1C1C1C',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                              onMouseEnter={e=>e.currentTarget.style.background='rgba(212,87,10,0.14)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <div>
                                <div style={{fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{food.name||food.food_name}</div>
                                {food.brand&&<div style={{fontSize:10,color:'#AAA'}}>{food.brand}</div>}
                              </div>
                              <div style={{fontSize:10,color:'#F4894A',fontWeight:600,textAlign:'right',flexShrink:0}}>
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
                        <input inputMode="decimal" style={{...s.input,padding:'4px 3px',fontSize:11,textAlign:'center',fontWeight:700,color:'#F4894A',background:'rgba(212,87,10,0.1)',borderColor:'rgba(212,87,10,0.35)'}} type="number" value={newFood.quantity_g} onChange={e=>updateNewFoodQty(e.target.value)}/>
                      </div>
                      {[{k:'kcal',l:'Kcal'},{k:'protein_g',l:'Prot'},{k:'carbs_g',l:'Carbo'},{k:'fat_g',l:'Grassi'}].map(f=>(
                        <div key={f.k}>
                          <div style={{fontSize:8,color:'#AAA',textAlign:'center',marginBottom:1}}>{f.l}</div>
                          <input inputMode="decimal" style={{...s.input,padding:'4px 3px',fontSize:11,textAlign:'center',background:newFood._k100!=null?'rgba(59,140,90,0.16)':'#161616'}} type="number" value={newFood[f.k]} onChange={e=>setNewFood(p=>({...p,[f.k]:e.target.value}))}/>
                        </div>
                      ))}
                    </div>
                    {newFood.kcal>0 && (
                      <div style={{background:'#0D0D0D',borderRadius:6,padding:'5px 8px',marginBottom:6,display:'flex',gap:8,fontSize:10}}>
                        <span style={{fontWeight:700,color:'#F4894A'}}>{Math.round(newFood.kcal)} kcal</span>
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
                    background:newMealType===t?'#D4570A':'#0D0D0D',
                    color:newMealType===t?'white':'#888780',
                    borderColor:newMealType===t?'#D4570A':'#2A2A2A',
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
    </div>
  )
}
