import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { searchFoods } from '../data/foodDatabase.js'

const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']

// Componenti helper per il form AI
function AISection({title, color, children}) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
        {title}
      </div>
      {children}
    </div>
  )
}

function AIField({label, id, placeholder, type='text', options=[], style={}}) {
  const base = {width:'100%',padding:'8px 10px',border:'0.5px solid #222',borderRadius:8,fontSize:12,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
  return (
    <div>
      {label && <div style={{fontSize:9,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{label}</div>}
      {type==='select' ? (
        <select id={id} style={base}>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input id={id} type={type} placeholder={placeholder} style={{...base,...style}}/>
      )}
    </div>
  )
}
const MEAL_TYPES = ['Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Spuntino sera']
const MEAL_ICONS = {'Colazione':'☀️','Spuntino mattina':'🍎','Pranzo':'🍽️','Spuntino pomeriggio':'🥜','Cena':'🌙','Spuntino sera':'🫐'}

function macroKcal(p,c,g) { return Math.round((parseFloat(p)||0)*4+(parseFloat(c)||0)*4+(parseFloat(g)||0)*9) }

// ── Calcola TDEE da profilo ──────────────────────────────────
function calcolaTDEE(anamnesi) {
  const peso = parseFloat(anamnesi?.peso_attuale) || 0
  const altezza = parseFloat(anamnesi?.altezza) || 0
  const eta = anamnesi?.data_nascita
    ? Math.floor((new Date() - new Date(anamnesi.data_nascita)) / (365.25*24*60*60*1000))
    : 30
  const sesso = anamnesi?.sesso || 'M'
  if (!peso || !altezza) return null

  // Harris-Benedict
  const bmr = sesso === 'F'
    ? 447.6 + (9.25*peso) + (3.1*altezza) - (4.33*eta)
    : 88.4 + (13.4*peso) + (4.8*altezza) - (5.68*eta)

  // Fattore attività
  const attivita = anamnesi?.si_allena === 'Sì' ? 1.55 : 1.375
  const tdee = Math.round(bmr * attivita)

  // Obiettivo
  const obiettivo = anamnesi?.obiettivo || ''
  let kcal = tdee
  if (obiettivo.toLowerCase().includes('dimagr') || obiettivo.toLowerCase().includes('pancia')) kcal = Math.round(tdee * 0.80)
  else if (obiettivo.toLowerCase().includes('massa') || obiettivo.toLowerCase().includes('bulk')) kcal = Math.round(tdee * 1.10)

  // Macro standard
  const prot = Math.round(peso * 2.0)
  const fat = Math.round(kcal * 0.25 / 9)
  const carbs = Math.round((kcal - prot*4 - fat*9) / 4)

  return { kcal, prot, fat, carbs, tdee, bmr: Math.round(bmr) }
}

export default function CreaPiano() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client')
  const { toast } = useToast()

  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(clientId || '')
  const [clientAnamnesi, setClientAnamnesi] = useState(null)
  const [planName, setPlanName] = useState('Piano alimentare')
  const [kcalTarget, setKcalTarget] = useState('')
  const [protTarget, setProtTarget] = useState('')
  const [carbsTarget, setCarbsTarget] = useState('')
  const [fatTarget, setFatTarget] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [saving, setSaving] = useState(false)
  const [days, setDays] = useState(() => { const d={}; for(let i=0;i<7;i++) d[i]=[]; return d })

  // Feature states
  const [foodSearch, setFoodSearch] = useState('')
  const [foodResults, setFoodResults] = useState([])
  const [addingTo, setAddingTo] = useState(null)
  const [newQty, setNewQty] = useState('100')
  const searchTimer = useRef(null)

  // Template pasti
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fofit_meal_templates_v2') || '[]') } catch { return [] }
  })
  const [showTemplates, setShowTemplates] = useState(null) // {dayIdx, mealIdx} o 'pick'
  const [savingTemplate, setSavingTemplate] = useState(null) // {dayIdx, mealIdx}
  const [templateName, setTemplateName] = useState('')

  // AI generazione piano
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiStatus, setAiStatus] = useState('')

  // Copia da altri piani
  const [showCopyPlan, setShowCopyPlan] = useState(false)
  const [otherPlans, setOtherPlans] = useState([])

  // Note per pasto
  const [mealNotes, setMealNotes] = useState({}) // `${dayIdx}-${mealIdx}` => nota

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  useEffect(() => {
    if (!selectedClient) return
    // Carica anamnesi per calcolo TDEE
    supabase.from('anamnesi').select('*').eq('client_id', selectedClient).single()
      .then(({data}) => {
        if (data) {
          setClientAnamnesi(data)
          // Auto-calcola target
          const calc = calcolaTDEE(data)
          if (calc) {
            setKcalTarget(String(calc.kcal))
            setProtTarget(String(calc.prot))
            setCarbsTarget(String(calc.carbs))
            setFatTarget(String(calc.fat))
          }
        }
      })
  }, [selectedClient])

  // Ricerca alimenti con debounce
  function searchFood(q) {
    setFoodSearch(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setFoodResults([]); return }
    searchTimer.current = setTimeout(() => {
      setFoodResults(searchFoods(q).slice(0, 12))
    }, 200)
  }

  function addMeal(dayIdx) {
    setDays(prev => { const d={...prev}; d[dayIdx]=[...d[dayIdx],{meal_type:MEAL_TYPES[0],foods:[]}]; return d })
  }

  function removeMeal(dayIdx, mealIdx) {
    setDays(prev => { const d={...prev}; d[dayIdx]=d[dayIdx].filter((_,i)=>i!==mealIdx); return d })
  }

  function setMealType(dayIdx, mealIdx, type) {
    setDays(prev => { const d={...prev}; d[dayIdx][mealIdx]={...d[dayIdx][mealIdx],meal_type:type}; return d })
  }

  function addFood(food) {
    if (!addingTo) return
    const {dayIdx, mealIdx} = addingTo
    const qty = parseFloat(newQty) || 100
    const item = {
      food_name: food.name,
      quantity_g: qty,
      kcal: Math.round(food.kcal100*qty/100),
      protein_g: Math.round(food.p*qty/100*10)/10,
      carbs_g: Math.round(food.c*qty/100*10)/10,
      fat_g: Math.round(food.g*qty/100*10)/10,
      _k100:food.kcal100, _p100:food.p, _c100:food.c, _g100:food.g,
    }
    setDays(prev => { const d={...prev}; d[dayIdx][mealIdx].foods=[...d[dayIdx][mealIdx].foods,item]; return d })
    setFoodSearch(''); setFoodResults([]); setNewQty('100')
  }

  function removeFood(dayIdx, mealIdx, foodIdx) {
    setDays(prev => { const d={...prev}; d[dayIdx][mealIdx].foods=d[dayIdx][mealIdx].foods.filter((_,i)=>i!==foodIdx); return d })
  }

  function updateFoodQty(dayIdx, mealIdx, foodIdx, qty) {
    setDays(prev => {
      const d={...prev}; const f=d[dayIdx][mealIdx].foods[foodIdx]; const q=parseFloat(qty)||0
      d[dayIdx][mealIdx].foods[foodIdx]={...f,quantity_g:q,kcal:Math.round((f._k100||0)*q/100),protein_g:Math.round((f._p100||0)*q/100*10)/10,carbs_g:Math.round((f._c100||0)*q/100*10)/10,fat_g:Math.round((f._g100||0)*q/100*10)/10}
      return d
    })
  }

  // ── TEMPLATE ─────────────────────────────────────────────
  function saveTemplate(dayIdx, mealIdx) {
    if (!templateName.trim()) return
    const meal = days[dayIdx][mealIdx]
    const t = { id:Date.now(), name:templateName, meal_type:meal.meal_type, foods:meal.foods }
    const updated = [...templates, t]
    setTemplates(updated)
    localStorage.setItem('fofit_meal_templates_v2', JSON.stringify(updated))
    setSavingTemplate(null); setTemplateName('')
    toast('Template salvato!', 'success')
  }

  function loadTemplate(t, dayIdx, mealIdx) {
    setDays(prev => {
      const d={...prev}
      d[dayIdx][mealIdx]={...d[dayIdx][mealIdx], meal_type:t.meal_type, foods:JSON.parse(JSON.stringify(t.foods))}
      return d
    })
    setShowTemplates(null)
    toast(`Template "${t.name}" caricato!`, 'success')
  }

  function deleteTemplate(id) {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    localStorage.setItem('fofit_meal_templates_v2', JSON.stringify(updated))
  }

  // ── COPIA GIORNO ────────────────────────────────────────
  function copyDay(fromIdx, toIdx) {
    setDays(prev => { const d={...prev}; d[toIdx]=JSON.parse(JSON.stringify(d[fromIdx])); return d })
    toast(`Lunedì copiato su ${DAY_NAMES[toIdx]}`, 'success')
  }

  // ── COPIA DA ALTRO PIANO ────────────────────────────────
  async function loadOtherPlans() {
    const {data} = await supabase.from('meal_plans').select('id,name,client_id,profiles!meal_plans_client_id_fkey(full_name)').eq('is_active',true).neq('client_id',selectedClient).limit(20)
    setOtherPlans(data||[])
    setShowCopyPlan(true)
  }

  async function importPlan(planId) {
    const {data:meals} = await supabase.from('plan_meals').select('*,plan_meal_foods(*)').eq('plan_id',planId)
    if (!meals?.length) return
    const newDays = {}
    for (let i=0;i<7;i++) newDays[i]=[]
    meals.forEach(m => {
      const dayIdx = m.day_of_week ?? 0
      newDays[dayIdx] = [...(newDays[dayIdx]||[]), {
        meal_type: m.meal_type,
        foods: (m.plan_meal_foods||[]).map(f => ({
          food_name:f.food_name, quantity_g:parseFloat(f.quantity_g)||0,
          kcal:parseFloat(f.kcal)||0, protein_g:parseFloat(f.protein_g)||0,
          carbs_g:parseFloat(f.carbs_g)||0, fat_g:parseFloat(f.fat_g)||0,
          _k100:f.kcal/(f.quantity_g/100)||0, _p100:f.protein_g/(f.quantity_g/100)||0,
          _c100:f.carbs_g/(f.quantity_g/100)||0, _g100:f.fat_g/(f.quantity_g/100)||0,
        }))
      }]
    })
    setDays(newDays)
    setShowCopyPlan(false)
    toast('Piano importato come base!', 'success')
  }

  // ── AI GENERA PIANO ─────────────────────────────────────
  async function generateWithAI() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiProgress(0)
    setAiStatus('Analisi indicazioni...')

    // Progresso fluido — sale fino a 90% poi aspetta la risposta
    const msgs = ['Calcolo fabbisogno...','Struttura pasti...','Selezione alimenti...','Bilanciamento macro...','Verifica nutrienti...','Rifinitura piano...']
    let pct = 5
    let msgIdx = 0
    setAiProgress(5)
    setAiStatus(msgs[0])
    const timer = setInterval(() => {
      pct = Math.min(pct + (pct < 60 ? 4 : pct < 80 ? 2 : 0.5), 90)
      setAiProgress(Math.round(pct))
      msgIdx = Math.min(Math.floor(pct / 15), msgs.length - 1)
      setAiStatus(msgs[msgIdx])
    }, 400)

    try {
      const res = await fetch('/api/generate-plan', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          prompt: aiPrompt,
          kcalTarget, protTarget, carbsTarget, fatTarget,
        })
      })

      clearInterval(timer)
      setAiProgress(96)
      setAiStatus('Costruzione piano...')

      const data = await res.json()
      console.log('[AI Piano] risposta:', JSON.stringify(data).slice(0, 500))
      if (!res.ok || data.error) throw new Error(data.error || 'Errore generazione')
      const parsed = { days: data.days }

      if (parsed.days) {
        setAiProgress(100)
        setAiStatus('Piano pronto!')
        const newDays = {}
        for (let i=0;i<7;i++) newDays[i]=[]
        Object.entries(parsed.days).forEach(([dayIdx, meals]) => {
          newDays[parseInt(dayIdx)] = meals.map(m => ({
            meal_type: m.meal_type,
            foods: (m.foods||[]).map(f => {
              const qty = f.qty || 100
              return {
                food_name: f.name,
                quantity_g: qty,
                kcal: Math.round((f.kcal100||0)*qty/100),
                protein_g: Math.round((f.p100||0)*qty/100*10)/10,
                carbs_g: Math.round((f.c100||0)*qty/100*10)/10,
                fat_g: Math.round((f.g100||0)*qty/100*10)/10,
                _k100:f.kcal100||0, _p100:f.p100||0, _c100:f.c100||0, _g100:f.g100||0,
              }
            })
          }))
        })
        await new Promise(r => setTimeout(r, 400))
        setDays(newDays)
        setShowAI(false)
        toast('Piano generato! 🎉 Rivedi e personalizza.', 'success')
      }
    } catch(e) {
      clearInterval(timer)
      console.error('[AI Piano]', e)
      setAiProgress(0)
      setAiStatus('')
      toast('Errore: ' + (e.message || 'Riprova'), 'error')
    } finally {
      setAiLoading(false)
      setAiProgress(0)
      setAiStatus('')
    }
  }

  // ── TOTALI ───────────────────────────────────────────────
  function dayTotals(dayIdx) {
    return (days[dayIdx]||[]).reduce((acc,m) => {
      m.foods.forEach(f => {
        acc.kcal += parseFloat(f.kcal)||0
        acc.prot += parseFloat(f.protein_g)||0
        acc.carbs += parseFloat(f.carbs_g)||0
        acc.fat += parseFloat(f.fat_g)||0
      })
      return acc
    }, {kcal:0,prot:0,carbs:0,fat:0})
  }

  function mealTotals(meal) {
    return meal.foods.reduce((acc,f) => ({
      kcal: acc.kcal + (parseFloat(f.kcal)||0),
      prot: acc.prot + (parseFloat(f.protein_g)||0),
      carbs: acc.carbs + (parseFloat(f.carbs_g)||0),
      fat: acc.fat + (parseFloat(f.fat_g)||0),
    }), {kcal:0,prot:0,carbs:0,fat:0})
  }

  // ── SALVA ────────────────────────────────────────────────
  async function savePlan() {
    if (!selectedClient) { toast('Seleziona un cliente','error'); return }
    const hasMeals = Object.values(days).some(d=>d.length>0)
    if (!hasMeals) { toast('Aggiungi almeno un pasto','error'); return }
    setSaving(true)
    try {
      await supabase.from('meal_plans').update({is_active:false}).eq('client_id',selectedClient)
      const {data:plan,error:planErr} = await supabase.from('meal_plans').insert({
        client_id:selectedClient, name:planName, is_active:true,
        kcal_target:parseInt(kcalTarget)||null, protein_target_g:parseInt(protTarget)||null,
        carbs_target_g:parseInt(carbsTarget)||null, fat_target_g:parseInt(fatTarget)||null,
      }).select().single()
      if (planErr) throw planErr

      for (const [dayIdx, meals] of Object.entries(days)) {
        for (const [mealIdx, meal] of meals.entries()) {
          if (!meal.foods.length) continue
          const {data:mealData,error:mealErr} = await supabase.from('plan_meals').insert({
            plan_id:plan.id, meal_type:meal.meal_type, day_of_week:parseInt(dayIdx),
            day_label:DAY_NAMES[parseInt(dayIdx)], sort_order:mealIdx,
            notes: mealNotes[`${dayIdx}-${mealIdx}`] || null,
          }).select().single()
          if (mealErr) throw mealErr
          const {error:foodErr} = await supabase.from('plan_meal_foods').insert(
            meal.foods.map((f,fi) => ({
              plan_meal_id:mealData.id, food_name:f.food_name, quantity_g:f.quantity_g,
              kcal:f.kcal, protein_g:f.protein_g, carbs_g:f.carbs_g, fat_g:f.fat_g, sort_order:fi,
            }))
          )
          if (foodErr) throw foodErr
        }
      }
      toast('Piano creato! 🎉','success')
      setTimeout(()=>navigate(`/modifica-piano/${plan.id}`),800)
    } catch(e) { toast('Errore: '+e.message,'error') }
    setSaving(false)
  }

  const s = {
    page:{minHeight:'100dvh',background:'#080808',color:'#F0F0F0',fontFamily:'inherit',overflowY:'auto'},
    topbar:{background:'#080808',borderBottom:'0.5px solid #111',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50},
    card:{background:'#0D0D0D',borderRadius:14,padding:'14px 16px',marginBottom:10,border:'0.5px solid #1C1C1C'},
    label:{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6},
    input:{width:'100%',padding:'9px 12px',border:'0.5px solid #222',borderRadius:8,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    select:{width:'100%',padding:'9px 12px',border:'0.5px solid #222',borderRadius:8,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    btn:{padding:'9px 16px',background:'#D4570A',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6},
    btnGray:{padding:'7px 12px',background:'#161616',color:'#888',border:'0.5px solid #222',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5},
    btnDanger:{padding:'5px 8px',background:'none',color:'#E24B4A',border:'0.5px solid rgba(226,75,74,0.3)',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'},
    grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10},
  }

  const tot = dayTotals(selectedDay)
  const tdeeInfo = clientAnamnesi ? calcolaTDEE(clientAnamnesi) : null

  return (
    <div style={s.page}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <button onClick={()=>navigate('/admin')} style={{width:34,height:34,borderRadius:9,border:'0.5px solid #222',background:'#161616',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#F0F0F0',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0'}}>Crea Piano Alimentare</div>
          {selectedClient && clients.find(c=>c.id===selectedClient) && (
            <div style={{fontSize:11,color:'#888'}}>{clients.find(c=>c.id===selectedClient)?.full_name}</div>
          )}
        </div>
        <button onClick={()=>setShowAI(true)} style={{...s.btnGray,background:'rgba(155,89,182,0.12)',color:'#C39BE0',border:'0.5px solid rgba(155,89,182,0.3)'}}>
          <i className="ti ti-sparkles" style={{fontSize:13}}/>AI
        </button>
        <button onClick={savePlan} disabled={saving} style={s.btn}>
          <i className="ti ti-device-floppy" style={{fontSize:13}}/>
          {saving?'Salvo...':'Salva'}
        </button>
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'14px 16px'}}>

        {/* INFO PIANO */}
        <div style={s.card}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={s.label}>Cliente</label>
              <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                <option value="">— Seleziona cliente —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={s.label}>Nome piano</label>
              <input style={s.input} value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="es. Piano ipocalorico fase 1"/>
            </div>
          </div>

          {/* TARGET MACRO con auto-calcolo */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em'}}>Target giornaliero</div>
            {tdeeInfo && (
              <button onClick={()=>{
                setKcalTarget(String(tdeeInfo.kcal))
                setProtTarget(String(tdeeInfo.prot))
                setCarbsTarget(String(tdeeInfo.carbs))
                setFatTarget(String(tdeeInfo.fat))
              }} style={{...s.btnGray,fontSize:10,padding:'4px 9px'}}>
                <i className="ti ti-calculator" style={{fontSize:11}}/>
                Calcola da profilo ({tdeeInfo.kcal} kcal)
              </button>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[
              {label:'Kcal',val:kcalTarget,set:v=>{setKcalTarget(v)},c:'#D4570A'},
              {label:'Proteine g',val:protTarget,set:v=>{setProtTarget(v);setKcalTarget(String(macroKcal(v,carbsTarget,fatTarget)||''))},c:'#4A90D4'},
              {label:'Carboidrati g',val:carbsTarget,set:v=>{setCarbsTarget(v);setKcalTarget(String(macroKcal(protTarget,v,fatTarget)||''))},c:'#E8A020'},
              {label:'Grassi g',val:fatTarget,set:v=>{setFatTarget(v);setKcalTarget(String(macroKcal(protTarget,carbsTarget,v)||''))},c:'#3B8C5A'},
            ].map(f=>(
              <div key={f.label}>
                <label style={{...s.label,color:f.c}}>{f.label}</label>
                <input style={{...s.input,borderColor:`${f.c}44`,textAlign:'center',fontWeight:700,color:f.c}} type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder="—"/>
              </div>
            ))}
          </div>
          {tdeeInfo && (
            <div style={{fontSize:10,color:'#555',marginTop:8,display:'flex',gap:12}}>
              <span>BMR: {tdeeInfo.bmr} kcal</span>
              <span>TDEE: {tdeeInfo.tdee} kcal</span>
            </div>
          )}

          {/* Azioni globali */}
          <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
            <button onClick={loadOtherPlans} style={s.btnGray}>
              <i className="ti ti-copy" style={{fontSize:12}}/>Copia da altro cliente
            </button>
          </div>
        </div>

        {/* GIORNI */}
        <div style={{display:'flex',gap:5,marginBottom:10,overflowX:'auto',paddingBottom:4}}>
          {DAY_NAMES.map((d,i)=>{
            const t=dayTotals(i); const hasMeals=days[i].length>0
            return (
              <button key={i} onClick={()=>setSelectedDay(i)} style={{
                flexShrink:0,padding:'8px 11px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                background:selectedDay===i?'#D4570A':hasMeals?'#161616':'#0D0D0D',
                color:selectedDay===i?'white':hasMeals?'#F0F0F0':'#555',
                border:selectedDay===i?'none':'0.5px solid #222',fontWeight:selectedDay===i?700:400,
              }}>
                <div style={{fontSize:11,fontWeight:700}}>{d.slice(0,3)}</div>
                {hasMeals&&<div style={{fontSize:9,marginTop:1,color:selectedDay===i?'rgba(255,255,255,.7)':'#D4570A'}}>{Math.round(t.kcal)}</div>}
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
              ].map(m=>{
                const pct=m.t>0?Math.min(Math.round(m.v/m.t*100),120):0
                const col=pct>110?'#E24B4A':pct>=90?'#3B8C5A':m.c
                return (
                  <div key={m.l} style={{flex:1,textAlign:'center'}}>
                    <div style={{fontSize:9,color:m.c,fontWeight:700,marginBottom:2}}>{m.l}</div>
                    <div style={{fontSize:14,fontWeight:800,color:col}}>{m.v}</div>
                    <div style={{height:3,background:'#1A1A1A',borderRadius:3,margin:'3px 0',overflow:'hidden'}}>
                      <div style={{height:3,background:col,width:`${Math.min(pct,100)}%`,borderRadius:3}}/>
                    </div>
                    <div style={{fontSize:9,color:'#555'}}>{m.t>0?`${pct}%`:''}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* COPIA GIORNO */}
        {days[selectedDay].length > 0 && (
          <div style={{marginBottom:10,display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:10,color:'#555'}}>Copia {DAY_NAMES[selectedDay]} su:</span>
            {DAY_NAMES.map((d,i)=>i!==selectedDay&&(
              <button key={i} onClick={()=>copyDay(selectedDay,i)} style={s.btnGray}>{d.slice(0,3)}</button>
            ))}
          </div>
        )}

        {/* PASTI */}
        {days[selectedDay].map((meal,mealIdx)=>{
          const mt = mealTotals(meal)
          const dayKcal = tot.kcal
          const mealPct = dayKcal > 0 ? Math.round(mt.kcal/dayKcal*100) : 0
          const noteKey = `${selectedDay}-${mealIdx}`
          return (
            <div key={mealIdx} style={s.card}>
              {/* Header pasto */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontSize:18}}>{MEAL_ICONS[meal.meal_type]||'🍽️'}</span>
                <select style={{...s.select,flex:1,fontWeight:700}} value={meal.meal_type} onChange={e=>setMealType(selectedDay,mealIdx,e.target.value)}>
                  {MEAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                {mt.kcal > 0 && (
                  <div style={{background:'rgba(212,87,10,0.1)',borderRadius:8,padding:'3px 8px',fontSize:11,fontWeight:700,color:'#F4894A',flexShrink:0,whiteSpace:'nowrap'}}>
                    {Math.round(mt.kcal)} kcal {mealPct>0&&`(${mealPct}%)`}
                  </div>
                )}
                <button onClick={()=>removeMeal(selectedDay,mealIdx)} style={{...s.btnDanger,flexShrink:0}}>
                  <i className="ti ti-trash" style={{fontSize:13}}/>
                </button>
              </div>

              {/* Alimenti */}
              {meal.foods.map((food,foodIdx)=>(
                <div key={foodIdx} style={{display:'flex',alignItems:'center',gap:6,background:'#161616',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{food.food_name}</div>
                    <div style={{fontSize:10,color:'#888',marginTop:1}}>
                      {food.kcal} kcal · P {food.protein_g}g · C {food.carbs_g}g · G {food.fat_g}g
                    </div>
                  </div>
                  <input type="number" value={food.quantity_g}
                    onChange={e=>updateFoodQty(selectedDay,mealIdx,foodIdx,e.target.value)}
                    style={{width:58,padding:'5px 6px',border:'0.5px solid #222',borderRadius:6,fontSize:12,textAlign:'center',color:'#F0F0F0',background:'#0D0D0D',outline:'none',fontFamily:'inherit'}}/>
                  <span style={{fontSize:10,color:'#555',flexShrink:0}}>g</span>
                  <button onClick={()=>removeFood(selectedDay,mealIdx,foodIdx)} style={s.btnDanger}>✕</button>
                </div>
              ))}

              {/* Totale pasto con ripartizione */}
              {meal.foods.length > 0 && (
                <div style={{display:'flex',gap:10,fontSize:10,color:'#888',marginTop:4,marginBottom:8,padding:'6px 8px',background:'#111',borderRadius:7}}>
                  <span style={{fontWeight:700,color:'#D4570A'}}>{Math.round(mt.kcal)} kcal</span>
                  <span>P {Math.round(mt.prot*10)/10}g</span>
                  <span>C {Math.round(mt.carbs*10)/10}g</span>
                  <span>G {Math.round(mt.fat*10)/10}g</span>
                  {mealPct > 0 && <span style={{marginLeft:'auto',color:'#555'}}>{mealPct}% del totale</span>}
                </div>
              )}

              {/* Note pasto */}
              <div style={{marginBottom:8}}>
                <input
                  value={mealNotes[noteKey]||''}
                  onChange={e=>setMealNotes(p=>({...p,[noteKey]:e.target.value}))}
                  placeholder="Note per il cliente (facoltativo)..."
                  style={{...s.input,fontSize:11,padding:'7px 10px',color:'#888'}}
                />
              </div>

              {/* Ricerca alimento */}
              {(
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <button onClick={()=>{setAddingTo({dayIdx:selectedDay,mealIdx});setFoodSearch('');setFoodResults([])}}
                    style={{...s.btn,fontSize:12,padding:'7px 12px'}}>
                    <i className="ti ti-plus" style={{fontSize:12}}/>Aggiungi alimento
                  </button>
                  <button onClick={()=>setShowTemplates({dayIdx:selectedDay,mealIdx})} style={s.btnGray}>
                    <i className="ti ti-bookmark" style={{fontSize:11}}/>Template
                  </button>
                  {meal.foods.length > 0 && (
                    <button onClick={()=>setSavingTemplate({dayIdx:selectedDay,mealIdx})} style={s.btnGray}>
                      <i className="ti ti-bookmark-plus" style={{fontSize:11}}/>Salva come template
                    </button>
                  )}
                </div>
              )}

              {/* Salva template modal */}
              {savingTemplate?.dayIdx===selectedDay && savingTemplate?.mealIdx===mealIdx && (
                <div style={{marginTop:8,padding:'10px',background:'#111',borderRadius:8,border:'0.5px solid #222'}}>
                  <div style={{fontSize:11,color:'#888',marginBottom:6}}>Nome del template</div>
                  <div style={{display:'flex',gap:6}}>
                    <input style={{...s.input,flex:1,fontSize:12}} value={templateName}
                      onChange={e=>setTemplateName(e.target.value)} placeholder="es. Colazione proteica standard"
                      onKeyDown={e=>e.key==='Enter'&&saveTemplate(selectedDay,mealIdx)}/>
                    <button onClick={()=>saveTemplate(selectedDay,mealIdx)} style={s.btn}>Salva</button>
                    <button onClick={()=>{setSavingTemplate(null);setTemplateName('')}} style={s.btnGray}>✕</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* AGGIUNGI PASTO */}
        <button onClick={()=>addMeal(selectedDay)}
          style={{...s.btn,width:'100%',justifyContent:'center',padding:'13px',marginBottom:20}}>
          <i className="ti ti-plus" style={{fontSize:16}}/>Aggiungi pasto — {DAY_NAMES[selectedDay]}
        </button>
      </div>

      {/* MODAL RICERCA ALIMENTI — fixed in basso, scrollabile */}
      {addingTo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget){setAddingTo(null);setFoodSearch('');setFoodResults([])}}}>
          <div style={{background:'#0D0D0D',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:600,height:'85dvh',display:'flex',flexDirection:'column',border:'0.5px solid #1C1C1C'}}>
            {/* Header fisso */}
            <div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>Aggiungi alimento</div>
                <button onClick={()=>{setAddingTo(null);setFoodSearch('');setFoodResults([])}} style={{width:30,height:30,borderRadius:8,background:'#161616',border:'0.5px solid #222',cursor:'pointer',color:'#888',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
              </div>
              <div style={{display:'flex',gap:8}}>
                <input
                  style={{...s.input,flex:1}}
                  value={foodSearch}
                  onChange={e=>searchFood(e.target.value)}
                  placeholder="Cerca tra 1.054 alimenti..."
                  autoFocus
                />
                <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                  <input
                    type="number"
                    value={newQty}
                    onChange={e=>setNewQty(e.target.value)}
                    style={{...s.input,width:65,textAlign:'center'}}
                    placeholder="g"
                  />
                  <span style={{fontSize:11,color:'#555'}}>g</span>
                </div>
              </div>
            </div>
            {/* Lista risultati scrollabile */}
            <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
              {foodSearch.length < 2 && (
                <div style={{padding:'30px 16px',textAlign:'center',color:'#444',fontSize:13}}>
                  <i className="ti ti-search" style={{fontSize:28,display:'block',marginBottom:10,color:'#333'}}/>
                  Digita almeno 2 lettere per cercare
                </div>
              )}
              {foodSearch.length >= 2 && foodResults.length === 0 && (
                <div style={{padding:'30px 16px',textAlign:'center',color:'#444',fontSize:13}}>
                  Nessun risultato per "{foodSearch}"
                </div>
              )}
              {foodResults.map((f,i)=>(
                <div key={i} onClick={()=>{addFood(f)}}
                  style={{padding:'12px 16px',cursor:'pointer',borderBottom:'0.5px solid #111',display:'flex',justifyContent:'space-between',alignItems:'center',active:{background:'#161616'}}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0',marginBottom:2}}>{f.name}</div>
                    <div style={{fontSize:10,color:'#555'}}>{f.cat}{f.brand&&f.brand!=='—'?` · ${f.brand}`:''}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,marginLeft:12}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#D4570A'}}>{Math.round(f.kcal100*(parseFloat(newQty)||100)/100)} kcal</div>
                    <div style={{fontSize:10,color:'#555'}}>P{Math.round(f.p*(parseFloat(newQty)||100)/100)}g C{Math.round(f.c*(parseFloat(newQty)||100)/100)}g G{Math.round(f.g*(parseFloat(newQty)||100)/100)}g</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div style={{padding:'12px 16px',borderTop:'0.5px solid #1A1A1A',flexShrink:0,display:'flex',gap:8}}>
              <button onClick={()=>{if(addingTo){setShowTemplates({dayIdx:addingTo.dayIdx,mealIdx:addingTo.mealIdx});setAddingTo(null)}}} style={{...s.btnGray,flex:1,justifyContent:'center'}}>
                <i className="ti ti-bookmark" style={{fontSize:12}}/>Usa template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TEMPLATE */}
      {showTemplates && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{background:'#0D0D0D',borderRadius:'16px 16px 0 0',padding:'20px',width:'100%',maxWidth:560,maxHeight:'70dvh',overflowY:'auto',border:'0.5px solid #1C1C1C'}}>
            <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',marginBottom:14}}>I tuoi template</div>
            {templates.length === 0 ? (
              <div style={{fontSize:12,color:'#555',textAlign:'center',padding:'20px 0'}}>Nessun template salvato. Crea un pasto e salvalo come template!</div>
            ) : (
              templates.map(t=>(
                <div key={t.id} style={{background:'#161616',borderRadius:10,padding:'12px',marginBottom:8,border:'0.5px solid #222'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>{t.name}</div>
                      <div style={{fontSize:10,color:'#888'}}>{t.meal_type} · {t.foods.length} alimenti</div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>loadTemplate(t,showTemplates.dayIdx,showTemplates.mealIdx)} style={s.btn}>Usa</button>
                      <button onClick={()=>deleteTemplate(t.id)} style={s.btnDanger}>✕</button>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:'#555'}}>
                    {t.foods.slice(0,3).map(f=>f.food_name).join(', ')}{t.foods.length>3?'...':''}
                  </div>
                </div>
              ))
            )}
            <button onClick={()=>setShowTemplates(null)} style={{...s.btnGray,width:'100%',justifyContent:'center',marginTop:8}}>Chiudi</button>
          </div>
        </div>
      )}

      {/* MODAL COPIA PIANO */}
      {showCopyPlan && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{background:'#0D0D0D',borderRadius:'16px 16px 0 0',padding:'20px',width:'100%',maxWidth:560,maxHeight:'70dvh',overflowY:'auto',border:'0.5px solid #1C1C1C'}}>
            <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>Importa piano da altro cliente</div>
            <div style={{fontSize:11,color:'#888',marginBottom:14}}>Il piano verrà usato come base — potrai modificarlo liberamente</div>
            {otherPlans.length === 0 ? (
              <div style={{fontSize:12,color:'#555',textAlign:'center',padding:'20px 0'}}>Nessun piano attivo disponibile</div>
            ) : (
              otherPlans.map(p=>(
                <div key={p.id} style={{background:'#161616',borderRadius:10,padding:'12px',marginBottom:8,border:'0.5px solid #222',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0'}}>{p.name}</div>
                    <div style={{fontSize:10,color:'#888'}}>{p.profiles?.full_name}</div>
                  </div>
                  <button onClick={()=>importPlan(p.id)} style={s.btn}>Importa</button>
                </div>
              ))
            )}
            <button onClick={()=>setShowCopyPlan(false)} style={{...s.btnGray,width:'100%',justifyContent:'center',marginTop:8}}>Chiudi</button>
          </div>
        </div>
      )}

      {/* MODAL AI — form strutturato */}
      {showAI && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{background:'#0D0D0D',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:600,maxHeight:'92dvh',display:'flex',flexDirection:'column',border:'0.5px solid rgba(155,89,182,0.3)'}}>

            {/* Header fisso */}
            <div style={{padding:'18px 20px 14px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <i className="ti ti-sparkles" style={{fontSize:17,color:'#C39BE0'}}/>
                  <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0'}}>Genera Piano con AI</div>
                </div>
                {!aiLoading && (
                  <button onClick={()=>setShowAI(false)} style={{width:30,height:30,borderRadius:8,background:'#161616',border:'0.5px solid #222',cursor:'pointer',color:'#888',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                )}
              </div>
              <div style={{fontSize:11,color:'#666',marginTop:4}}>Compila i campi per un piano personalizzato e professionale</div>
            </div>

            {/* Form scrollabile */}
            {!aiLoading ? (
              <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>

                {/* SOGGETTO */}
                <AISection title="👤 Soggetto" color="#4A90D4">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <AIField label="Età" placeholder="es. 35" id="eta"/>
                    <AIField label="Sesso" type="select" options={['—','Uomo','Donna']} id="sesso"/>
                    <AIField label="Peso attuale (kg)" placeholder="es. 82" id="peso"/>
                    <AIField label="Altezza (cm)" placeholder="es. 175" id="altezza"/>
                    <AIField label="Tipo di lavoro" type="select" options={['—','Sedentario (ufficio)','Leggero (in piedi)','Moderato (fisico medio)','Pesante (fisico intenso)']} id="lavoro"/>
                    <AIField label="Attività fisica" type="select" options={['—','Nessuna','1-2 volte/settimana','3-4 volte/settimana','5+ volte/settimana','Atleta']} id="attivita"/>
                  </div>
                </AISection>

                {/* OBIETTIVO */}
                <AISection title="🎯 Obiettivo" color="#D4570A">
                  <AIField label="Obiettivo principale" type="select" options={['—','Dimagrimento / Perdita peso','Dimagrimento lento e costante','Ricomposizione corporea','Aumento massa muscolare','Mantenimento peso','Miglioramento prestazioni','Dieta terapeutica']} id="obiettivo"/>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
                    <AIField label="Variazione calorica" type="select" options={['—','Deficit lieve -200 kcal','Deficit moderato -400 kcal','Deficit aggressivo -600 kcal','Mantenimento','Surplus lieve +200 kcal','Surplus moderato +400 kcal']} id="variazione"/>
                    <AIField label="Peso obiettivo (kg)" placeholder="es. 75" id="pesoObiettivo"/>
                  </div>
                  <div style={{marginTop:8}}>
                    <AIField label="Note obiettivo" placeholder="es. vuole perdere principalmente a livello addominale, ha un evento importante tra 3 mesi..." id="noteObiettivo"/>
                  </div>
                </AISection>

                {/* PASTI */}
                <AISection title="🍽️ Struttura pasti" color="#3B8C5A">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <AIField label="Numero pasti/giorno" type="select" options={['—','3 pasti','4 pasti','5 pasti','6 pasti']} id="numPasti"/>
                    <AIField label="Stile cucina" type="select" options={['—','Italiana classica','Mediterranea','Internazionale','Vegana','Vegetariana','Low carb','Paleo','Dieta zona']} id="stileCucina"/>
                  </div>
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Pasti da includere</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {['Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Spuntino sera'].map(p=>(
                        <label key={p} style={{display:'flex',alignItems:'center',gap:5,background:'#161616',border:'0.5px solid #222',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontSize:12,color:'#CCC'}}>
                          <input type="checkbox" defaultChecked={['Colazione','Pranzo','Spuntino pomeriggio','Cena'].includes(p)}
                            onChange={e=>{
                              const el = document.getElementById('pasti_selezionati')
                              const current = el.value ? el.value.split(',') : []
                              if(e.target.checked) el.value = [...new Set([...current,p])].join(',')
                              else el.value = current.filter(x=>x!==p).join(',')
                            }}/>{p}
                        </label>
                      ))}
                    </div>
                    <input type="hidden" id="pasti_selezionati" defaultValue="Colazione,Pranzo,Spuntino pomeriggio,Cena"/>
                  </div>
                  <div style={{marginTop:8}}>
                    <AIField label="Preferenze pasti sfizosi" placeholder="es. vuole colazioni sfiziose, qualche dessert sano, niente pollo e riso ogni giorno..." id="preferenzePasti"/>
                  </div>
                  <div style={{marginTop:8}}>
                    <AIField label="Tempo per cucinare" type="select" options={['—','Minimo (max 15 min)','Medio (30 min)','Elevato (anche ricette elaborate)']} id="tempoCottura"/>
                  </div>
                </AISection>

                {/* INTOLLERANZE */}
                <AISection title="⚠️ Intolleranze, allergie e patologie" color="#E24B4A">
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                    {['Lattosio','Glutine/Celiachia','Nichel','Istamina','Fruttosio','Uova','Arachidi','Frutta a guscio','Pesce','Crostacei','Soia','Sesamo'].map(i=>(
                      <label key={i} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(226,75,74,0.08)',border:'0.5px solid rgba(226,75,74,0.2)',borderRadius:7,padding:'4px 9px',cursor:'pointer',fontSize:11,color:'#CCC'}}>
                        <input type="checkbox" onChange={e=>{
                          const el = document.getElementById('intolleranze')
                          const cur = el.value ? el.value.split(',').filter(Boolean) : []
                          el.value = e.target.checked ? [...cur,i].join(',') : cur.filter(x=>x!==i).join(',')
                        }}/>{i}
                      </label>
                    ))}
                  </div>
                  <input type="hidden" id="intolleranze" defaultValue=""/>
                  <AIField label="Patologie / condizioni particolari" placeholder="es. diabete tipo 2, ipertensione, ipotiroidismo, PCOS, gastrite, colite, colesterolo alto..." id="patologie"/>
                  <div style={{marginTop:8}}>
                    <AIField label="Farmaci che influenzano la dieta" placeholder="es. metformina, levotiroxina, cortisonici..." id="farmaci"/>
                  </div>
                </AISection>

                {/* PREFERENZE ALIMENTARI */}
                <AISection title="🥩 Preferenze alimentari" color="#E8A020">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Non mangia</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {['Carne rossa','Maiale','Pollo','Pesce','Frutti di mare','Uova','Latticini','Legumi','Verdure cotte','Frutta'].map(a=>(
                          <label key={a} style={{display:'flex',alignItems:'center',gap:3,background:'#161616',border:'0.5px solid #222',borderRadius:6,padding:'3px 7px',cursor:'pointer',fontSize:10,color:'#CCC'}}>
                            <input type="checkbox" onChange={e=>{
                              const el = document.getElementById('nonMangia')
                              const cur = el.value ? el.value.split(',').filter(Boolean) : []
                              el.value = e.target.checked ? [...cur,a].join(',') : cur.filter(x=>x!==a).join(',')
                            }}/>{a}
                          </label>
                        ))}
                      </div>
                      <input type="hidden" id="nonMangia" defaultValue=""/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Ama particolarmente</div>
                      <AIField id="amaMangiare" placeholder="es. pasta, pollo, verdure grigliate, frutta, yogurt..."/>
                    </div>
                  </div>
                  <div style={{marginTop:8}}>
                    <AIField label="Altre note alimentari" placeholder="es. non fa colazione, mangia fuori a pranzo, ha poco tempo la mattina..." id="altreNote"/>
                  </div>
                </AISection>

                {/* NOTE EXTRA */}
                <AISection title="📝 Note aggiuntive per il coach" color="#9B59B6">
                  <AIField id="noteExtra" placeholder="Qualsiasi altra indicazione importante: integratori da includere, timing dei pasti rispetto all'allenamento, gestione dei pasti fuori casa, giorni di sgarro..." style={{minHeight:60}}/>
                </AISection>

              </div>
            ) : (
              /* LOADING */
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32}}>
                <i className="ti ti-sparkles" style={{fontSize:36,color:'#C39BE0',marginBottom:16}}/>
                <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>{aiStatus}</div>
                <div style={{fontSize:11,color:'#666',marginBottom:20}}>Creazione settimana alimentare personalizzata...</div>
                <div style={{width:'100%',maxWidth:320}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{fontSize:11,color:'#888'}}>Giorno {Math.ceil(aiProgress/14)} di 7</div>
                    <div style={{fontSize:11,fontWeight:800,color:'#C39BE0'}}>{aiProgress}%</div>
                  </div>
                  <div style={{height:8,background:'#1A1A1A',borderRadius:8,overflow:'hidden'}}>
                    <div style={{height:8,borderRadius:8,background:'linear-gradient(90deg,#7C3AED,#C39BE0)',width:`${aiProgress}%`,transition:'width 0.4s ease'}}/>
                  </div>
                </div>
              </div>
            )}

            {/* Footer con bottone */}
            {!aiLoading && (
              <div style={{padding:'14px 20px',borderTop:'0.5px solid #1A1A1A',flexShrink:0}}>
                {kcalTarget && (
                  <div style={{fontSize:10,color:'#555',marginBottom:10,textAlign:'center'}}>
                    Target impostato: {kcalTarget} kcal · P{protTarget}g · C{carbsTarget}g · G{fatTarget}g
                  </div>
                )}
                <button onClick={()=>{
                  // Costruisci prompt da tutti i campi
                  const get = id => document.getElementById(id)?.value || ''
                  const parts = []
                  if(get('eta')) parts.push(`Età: ${get('eta')} anni`)
                  if(get('sesso')!=='—') parts.push(`Sesso: ${get('sesso')}`)
                  if(get('peso')) parts.push(`Peso: ${get('peso')} kg`)
                  if(get('altezza')) parts.push(`Altezza: ${get('altezza')} cm`)
                  if(get('lavoro')!=='—') parts.push(`Lavoro: ${get('lavoro')}`)
                  if(get('attivita')!=='—') parts.push(`Attività fisica: ${get('attivita')}`)
                  if(get('obiettivo')!=='—') parts.push(`Obiettivo: ${get('obiettivo')}`)
                  if(get('variazione')!=='—') parts.push(`Variazione calorica: ${get('variazione')}`)
                  if(get('pesoObiettivo')) parts.push(`Peso obiettivo: ${get('pesoObiettivo')} kg`)
                  if(get('noteObiettivo')) parts.push(`Note obiettivo: ${get('noteObiettivo')}`)
                  if(get('numPasti')!=='—') parts.push(`Numero pasti: ${get('numPasti')}`)
                  if(get('stileCucina')!=='—') parts.push(`Stile cucina: ${get('stileCucina')}`)
                  const pastiSel = get('pasti_selezionati')
                  if(pastiSel) parts.push(`Pasti da includere: ${pastiSel}`)
                  if(get('preferenzePasti')) parts.push(`Preferenze pasti: ${get('preferenzePasti')}`)
                  if(get('tempoCottura')!=='—') parts.push(`Tempo cottura: ${get('tempoCottura')}`)
                  const intoll = get('intolleranze')
                  if(intoll) parts.push(`Intolleranze/allergie: ${intoll}`)
                  if(get('patologie')) parts.push(`Patologie: ${get('patologie')}`)
                  if(get('farmaci')) parts.push(`Farmaci: ${get('farmaci')}`)
                  const nonMang = get('nonMangia')
                  if(nonMang) parts.push(`Non mangia: ${nonMang}`)
                  if(get('amaMangiare')) parts.push(`Ama: ${get('amaMangiare')}`)
                  if(get('altreNote')) parts.push(`Note alimentari: ${get('altreNote')}`)
                  if(get('noteExtra')) parts.push(`Note extra: ${get('noteExtra')}`)
                  if(parts.length === 0) { toast('Compila almeno un campo','error'); return }
                  setAiPrompt(parts.join('. '))
                  setTimeout(generateWithAI, 100)
                }} style={{...s.btn,width:'100%',justifyContent:'center',padding:'13px',background:'rgba(155,89,182,0.85)',fontSize:14}}>
                  <i className="ti ti-sparkles" style={{fontSize:15}}/>
                  Genera settimana alimentare completa
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
