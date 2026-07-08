import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'18px', marginBottom:14 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'10px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  textarea: { width:'100%', padding:'12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 },
  section: { background:'#F5F3EF', borderRadius:10, padding:'14px', marginBottom:12 },
  sectionTitle: { fontSize:12, fontWeight:700, color:'#111', marginBottom:10, display:'flex', alignItems:'center', gap:6, cursor:'pointer', userSelect:'none' },
  dayCard: { border:'0.5px solid #E0DDD6', borderRadius:10, overflow:'hidden', marginBottom:10 },
  dayHeader: { background:'#FEF0E7', padding:'10px 14px', fontWeight:600, fontSize:13, color:'#D4570A', display:'flex', justifyContent:'space-between', alignItems:'center' },
  exRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'0.5px solid #F5F3EF' },
  tag: { fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:500, background:'#F5F3EF', color:'#888780' },
  macroTag: { fontSize:10, padding:'3px 7px', borderRadius:7, fontWeight:600 },
}

const GOALS = [
  { value:'dimagrimento', label:'🔥 Dimagrimento' },
  { value:'massa', label:'💪 Massa muscolare' },
  { value:'mantenimento', label:'⚖️ Mantenimento' },
  { value:'forza', label:'🏋️ Forza' },
  { value:'resistenza', label:'🏃 Resistenza' },
]
const DIET_TYPES = [
  { value:'lineare',  label:'📊 Lineare',      sub:'Stesso schema ogni giorno' },
  { value:'on_off',   label:'⚡ ON/OFF',        sub:'Macro diversi nei giorni di allenamento' },
  { value:'onde',     label:'🌊 Ad onde',       sub:'3 livelli: alto / medio / basso' },
  { value:'ciclico',  label:'🔄 Ciclico',       sub:'Alternanza deficit / surplus' },
  { value:'reverse',  label:'📈 Reverse diet',  sub:'Aumento progressivo delle calorie' },
  { value:'refeed',   label:'🔋 Refeed',        sub:'Piano base + giorno di ricarica' },
]
const LIFESTYLE = [
  { value:'semplice', label:'🏠 Cucina semplice — pochi ingredienti' },
  { value:'standard', label:'🍽️ Standard — cucina normale' },
  { value:'elaborato', label:'👨‍🍳 Elaborato — ama cucinare' },
  { value:'poco_tempo', label:'⚡ Poco tempo — pasti veloci' },
]

function macroKcal(p, c, f) { return (p||0)*4 + (c||0)*4 + (f||0)*9 }

function MacroRow({ label, color='#D4570A', prefix, gen, setGen, macroKcal }) {
  const k = (field) => `${field}${prefix?'_'+prefix:''}`
  const kcal = macroKcal(gen[k('protein')], gen[k('carbs')], gen[k('fat')])
  return (
    <div style={{background:'#F5F3EF',borderRadius:10,padding:'12px',marginBottom:8}}>
      <div style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>{label}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
        <div>
          <label style={{fontSize:10,color:'#888780',display:'block',marginBottom:3}}>Kcal</label>
          <input style={{width:'100%',padding:'7px 8px',border:'0.5px solid #E0DDD6',borderRadius:7,fontSize:13,fontWeight:700,color,background:'white',outline:'none',fontFamily:'inherit',textAlign:'center',boxSizing:'border-box'}}
            type="number" value={gen[k('kcal')]||''} onChange={e=>{
              const val = parseInt(e.target.value)||0
              const ratio = gen[k('kcal')]>0 ? val/gen[k('kcal')] : 1
              setGen(p=>({...p,
                [k('kcal')]:val,
                [k('protein')]:Math.round((p[k('protein')]||0)*ratio),
                [k('carbs')]:Math.round((p[k('carbs')]||0)*ratio),
                [k('fat')]:Math.round((p[k('fat')]||0)*ratio),
              }))
            }}/>
          <div style={{fontSize:9,color:Math.abs(kcal-(gen[k('kcal')]||0))<50?'#3B6D11':'#D4570A',marginTop:2,textAlign:'center'}}>
            Macro={kcal}
          </div>
        </div>
        {[{f:'protein',l:'P (g)',c:'#3B8C5A'},{f:'carbs',l:'C (g)',c:'#F4894A'},{f:'fat',l:'G (g)',c:'#888780'}].map(m=>(
          <div key={m.f}>
            <label style={{fontSize:10,color:m.c,display:'block',marginBottom:3}}>{m.l}</label>
            <input style={{width:'100%',padding:'7px 8px',border:'0.5px solid #E0DDD6',borderRadius:7,fontSize:13,color:'#111',background:'white',outline:'none',fontFamily:'inherit',textAlign:'center',boxSizing:'border-box'}}
              type="number" value={gen[k(m.f)]||''} onChange={e=>setGen(p=>({...p,[k(m.f)]:parseInt(e.target.value)||0}))}/>
          </div>
        ))}
      </div>
    </div>
  )
}

function MacroForm({ gen, setGen, macroKcal }) {
  const dt = gen.diet_type
  if (dt === 'lineare') return (
    <MacroRow label="📊 Macro giornalieri" prefix="" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
  )
  if (dt === 'on_off') return (<>
    <MacroRow label="⚡ Giorno ON — allenamento" color="#D4570A" prefix="on" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <MacroRow label="😴 Giorno OFF — riposo" color="#4A90D4" prefix="off" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
  </>)
  if (dt === 'onde') return (<>
    <MacroRow label="🔴 Giorno ALTO — massimo intake" color="#E24B4A" prefix="high" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <MacroRow label="🟡 Giorno MEDIO" color="#E8A020" prefix="mid" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <MacroRow label="🟢 Giorno BASSO" color="#3B6D11" prefix="low" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
  </>)
  if (dt === 'ciclico') return (<>
    <MacroRow label="📉 Giorni in DEFICIT" color="#4A90D4" prefix="deficit" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <MacroRow label="📈 Giorni in SURPLUS" color="#D4570A" prefix="surplus" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
  </>)
  if (dt === 'reverse') return (<>
    <MacroRow label="📊 Kcal di partenza" color="#4A90D4" prefix="start" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <div style={{background:'#F5F3EF',borderRadius:10,padding:'12px',marginBottom:8}}>
      <div style={{fontSize:11,fontWeight:700,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>📈 Progressione</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div>
          <label style={{fontSize:10,color:'#888780',display:'block',marginBottom:3}}>Incremento kcal/settimana</label>
          <input style={{width:'100%',padding:'8px',border:'0.5px solid #E0DDD6',borderRadius:7,fontSize:13,color:'#111',background:'white',outline:'none',fontFamily:'inherit',textAlign:'center',boxSizing:'border-box'}}
            type="number" value={gen.kcal_increment||50} onChange={e=>setGen(p=>({...p,kcal_increment:parseInt(e.target.value)||50}))}/>
        </div>
        <div>
          <label style={{fontSize:10,color:'#888780',display:'block',marginBottom:3}}>Kcal obiettivo finale</label>
          <input style={{width:'100%',padding:'8px',border:'0.5px solid #E0DDD6',borderRadius:7,fontSize:13,color:'#111',background:'white',outline:'none',fontFamily:'inherit',textAlign:'center',boxSizing:'border-box'}}
            type="number" value={gen.kcal_target||2200} onChange={e=>setGen(p=>({...p,kcal_target:parseInt(e.target.value)||2200}))}/>
        </div>
      </div>
    </div>
  </>)
  if (dt === 'refeed') return (<>
    <MacroRow label="📊 Giorni base (deficit)" color="#4A90D4" prefix="base" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <MacroRow label="🔋 Giorno refeed (ricarica)" color="#9B59B6" prefix="refeed" gen={gen} setGen={setGen} macroKcal={macroKcal}/>
    <div style={{background:'#F5F3EF',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
      <label style={{fontSize:10,color:'#888780',display:'block',marginBottom:6}}>GIORNI DI REFEED A SETTIMANA</label>
      <div style={{display:'flex',gap:6}}>
        {[1,2,3].map(n=>(
          <button key={n} onClick={()=>setGen(p=>({...p,refeed_days:n}))} style={{
            flex:1,padding:'7px',borderRadius:7,border:'0.5px solid',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600,
            background:gen.refeed_days===n?'#9B59B6':'white',color:gen.refeed_days===n?'white':'#888780',borderColor:gen.refeed_days===n?'#9B59B6':'#E0DDD6'
          }}>{n}</button>
        ))}
      </div>
    </div>
  </>)
  return null
}

export default function ImportaPiano() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [mode, setMode] = useState('import') // 'import' | 'generate'
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parsedPlan, setParsedPlan] = useState(null)
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split('T')[0])
  const [weeklyTargets, setWeeklyTargets] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [planTitle, setPlanTitle] = useState('')
  const [planNotes, setPlanNotes] = useState('')
  const [targets, setTargets] = useState({ kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65 })

  // Modalità importa
  const [rawText, setRawText] = useState('')

  // Modalità genera — sezioni espandibili
  const [openSections, setOpenSections] = useState({ nutrition:true, foods:true, lifestyle:false })
  const [gen, setGen] = useState({
    // Base
    kcal: 2000, protein: 150, carbs: 200, fat: 65,
    meals_per_day: 5, goal: 'dimagrimento', diet_type: 'lineare',
    foods_liked: '', foods_avoided: '', lifestyle: 'standard',
    // ON/OFF
    kcal_on: 2300, protein_on: 170, carbs_on: 250, fat_on: 65,
    kcal_off: 1800, protein_off: 160, carbs_off: 160, fat_off: 60,
    // Ad onde
    kcal_high: 2400, protein_high: 180, carbs_high: 280, fat_high: 65,
    kcal_mid: 2100, protein_mid: 160, carbs_mid: 220, fat_mid: 65,
    kcal_low: 1800, protein_low: 160, carbs_low: 160, fat_low: 60,
    // Ciclico
    kcal_deficit: 1800, protein_deficit: 160, carbs_deficit: 160, fat_deficit: 60,
    kcal_surplus: 2400, protein_surplus: 180, carbs_surplus: 280, fat_surplus: 70,
    // Reverse
    kcal_start: 1800, protein_start: 150, carbs_start: 160, fat_start: 60,
    kcal_target: 2200, kcal_increment: 50,
    // Refeed
    kcal_base: 1900, protein_base: 160, carbs_base: 180, fat_base: 60,
    kcal_refeed: 2600, protein_refeed: 160, carbs_refeed: 350, fat_refeed: 65,
    refeed_days: 1,
  })

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  function toggleSection(k) { setOpenSections(p => ({...p, [k]:!p[k]})) }

  function handleGenKcal(val) {
    const kcal = parseInt(val)||0
    setGen(p => {
      const total = macroKcal(p.protein, p.carbs, p.fat)
      if (total === 0) return {...p, kcal, protein:Math.round(kcal*0.30/4), carbs:Math.round(kcal*0.40/4), fat:Math.round(kcal*0.30/9)}
      const ratio = kcal / total
      return {...p, kcal, protein:Math.round(p.protein*ratio), carbs:Math.round(p.carbs*ratio), fat:Math.round(p.fat*ratio)}
    })
  }
  function handleGenMacro(field, val) {
    setGen(p => {
      const updated = {...p, [field]:parseInt(val)||0}
      updated.kcal = macroKcal(updated.protein, updated.carbs, updated.fat)
      return updated
    })
  }

  // ── ELABORA / GENERA ──────────────────────────────────────
  async function elabora() {
    setError('')
    if (mode === 'import' && rawText.trim().length < 20) { setError('Incolla il testo del piano alimentare.'); return }
    setLoading(true)
    try {
      const body = mode === 'generate'
        ? { mode:'generate', preferences:{
            kcal:gen.kcal, protein:gen.protein, carbs:gen.carbs, fat:gen.fat,
            meals_per_day:gen.meals_per_day, goal:gen.goal, diet_type:gen.diet_type,
            foods_liked:gen.foods_liked, foods_avoided:gen.foods_avoided, lifestyle:gen.lifestyle,
            // Parametri multi-fase
            phases: gen.diet_type==='on_off' ? [
              {label:'Giorno ON',kcal:gen.kcal_on,protein:gen.protein_on,carbs:gen.carbs_on,fat:gen.fat_on},
              {label:'Giorno OFF',kcal:gen.kcal_off,protein:gen.protein_off,carbs:gen.carbs_off,fat:gen.fat_off},
            ] : gen.diet_type==='onde' ? [
              {label:'Giorno Alto',kcal:gen.kcal_high,protein:gen.protein_high,carbs:gen.carbs_high,fat:gen.fat_high},
              {label:'Giorno Medio',kcal:gen.kcal_mid,protein:gen.protein_mid,carbs:gen.carbs_mid,fat:gen.fat_mid},
              {label:'Giorno Basso',kcal:gen.kcal_low,protein:gen.protein_low,carbs:gen.carbs_low,fat:gen.fat_low},
            ] : gen.diet_type==='ciclico' ? [
              {label:'Giorno Deficit',kcal:gen.kcal_deficit,protein:gen.protein_deficit,carbs:gen.carbs_deficit,fat:gen.fat_deficit},
              {label:'Giorno Surplus',kcal:gen.kcal_surplus,protein:gen.protein_surplus,carbs:gen.carbs_surplus,fat:gen.fat_surplus},
            ] : gen.diet_type==='reverse' ? [
              {label:'Settimana 1',kcal:gen.kcal_start,protein:gen.protein_start,carbs:gen.carbs_start,fat:gen.fat_start},
              {label:'Progressione',kcal_increment:gen.kcal_increment,kcal_target:gen.kcal_target},
            ] : gen.diet_type==='refeed' ? [
              {label:'Giorno Base',kcal:gen.kcal_base,protein:gen.protein_base,carbs:gen.carbs_base,fat:gen.fat_base},
              {label:'Giorno Refeed',kcal:gen.kcal_refeed,protein:gen.protein_refeed,carbs:gen.carbs_refeed,fat:gen.fat_refeed,days:gen.refeed_days},
            ] : null,
          }}
        : { textContent: rawText }

      const r = await fetch('/api/parse-plan', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Errore')
      if (!data.plan) throw new Error('Piano non ricevuto. Riprova.')

      setParsedPlan(data.plan)
      setPlanTitle(data.plan.titolo || 'Piano alimentare')
      setPlanNotes(data.plan.note_generali || '')
      setTargets({ kcal_target: data.plan.kcal_totali, protein_target_g: data.plan.proteine_g, carbs_target_g: data.plan.carboidrati_g, fat_target_g: data.plan.grassi_g })
      // Pre-compila progressione settimanale per diete con variazione
      if (mode === 'generate') {
        const dt = gen.diet_type
        const targets = []
        if (dt === 'reverse') {
          const weeks = parseInt(gen.progression_weeks || gen.kcal_target ? Math.ceil((gen.kcal_target - gen.kcal_start) / (gen.kcal_increment || 50)) : 8)
          const numWeeks = Math.min(Math.max(weeks, 4), 16)
          for (let i = 0; i < numWeeks; i++) {
            targets.push({
              week: i+1,
              kcal: Math.round(gen.kcal_start + i*(gen.kcal_increment||50)),
              protein: gen.protein_start || gen.protein,
              carbs: Math.round((gen.kcal_start + i*(gen.kcal_increment||50) - (gen.protein_start||gen.protein)*4 - (gen.fat_start||gen.fat)*9) / 4),
              fat: gen.fat_start || gen.fat,
              note: i===0?'Partenza':i===numWeeks-1?'Obiettivo':`+${(gen.kcal_increment||50)*(i)}kcal`
            })
          }
        } else if (dt === 'step') {
          const stepW = parseInt(gen.cfg?.step_weeks||3)
          const numCycles = Math.ceil(8/stepW)
          for (let c = 0; c < numCycles; c++) {
            for (let w = 0; w < stepW; w++) {
              targets.push({ week: c*stepW+w+1, kcal: gen.kcal+c*((gen.kcal_increment||100)), protein: gen.protein, carbs: gen.carbs, fat: gen.fat, note:'' })
            }
            targets.push({ week: c*stepW+stepW+1, kcal: Math.round(gen.kcal*0.8), protein: gen.protein, carbs: Math.round(gen.kcal*0.8*0.4/4), fat: gen.fat, note:'DELOAD' })
          }
        } else if (dt === 'on_off') {
          for (let i = 0; i < 8; i++) {
            targets.push({ week: i+1, kcal: i%2===0?gen.kcal_on:gen.kcal_off, protein: i%2===0?gen.protein_on:gen.protein_off, carbs: i%2===0?gen.carbs_on:gen.carbs_off, fat: i%2===0?gen.fat_on:gen.fat_off, note: i%2===0?'Settimana ON':'Settimana OFF' })
          }
        } else if (dt === 'onde') {
          const cycle = [{kcal:gen.kcal_high,protein:gen.protein_high,carbs:gen.carbs_high,fat:gen.fat_high,note:'ALTO'},{kcal:gen.kcal_mid,protein:gen.protein_mid,carbs:gen.carbs_mid,fat:gen.fat_mid,note:'MEDIO'},{kcal:gen.kcal_low,protein:gen.protein_low,carbs:gen.carbs_low,fat:gen.fat_low,note:'BASSO'}]
          for (let i = 0; i < 9; i++) targets.push({week:i+1,...cycle[i%3]})
        }
        if (targets.length > 0) setWeeklyTargets(targets)
      }

      setStep(2)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  // ── SALVA ──────────────────────────────────────────────────
  async function savePlan() {
    if (!selectedClient) { setError('Seleziona un cliente'); return }
    setSaving(true)
    setError('')
    try {
      await supabase.from('meal_plans').update({is_active:false}).eq('client_id', selectedClient)

      const { data: planData, error: planErr } = await supabase.from('meal_plans').insert({
        client_id: selectedClient, created_by: profile.id, title: planTitle,
        week_number: 1,
        kcal_target: Math.round(parseInt(targets.kcal_target)||2000),
        protein_target_g: Math.round(parseInt(targets.protein_target_g)||150),
        carbs_target_g: Math.round(parseInt(targets.carbs_target_g)||200),
        fat_target_g: Math.round(parseInt(targets.fat_target_g)||65),
        notes: planNotes, diet_type: parsedPlan.diet_type || 'lineare', is_active: true,
        weekly_macro_targets: weeklyTargets.length > 0 ? weeklyTargets : null,
        plan_start_date: weeklyTargets.length > 0 ? planStartDate : null,
      }).select().single()
      if (planErr) throw planErr

      // Salva i pasti — varianti mappate su giorni
      const varianti = parsedPlan.varianti || []
      for (let dayIdx = 0; dayIdx < varianti.length; dayIdx++) {
        const variante = varianti[dayIdx]
        const dayOfWeek = dayIdx + 1
        const pasti = variante.pasti || []

        for (let mealIdx = 0; mealIdx < pasti.length; mealIdx++) {
          const pasto = pasti[mealIdx]
          const { data: mealData, error: mealErr } = await supabase.from('plan_meals').insert({
            plan_id: planData.id, day_of_week: dayOfWeek, meal_type: pasto.tipo || 'altro',
            meal_name: pasto.nome, scheduled_time: pasto.orario || null, meal_order: mealIdx,
            day_label: variante.nome,
            day_kcal_target: Math.round(variante.kcal)||null,
            day_protein_target_g: Math.round(variante.proteine_g)||null,
            day_carbs_target_g: Math.round(variante.carboidrati_g)||null,
            day_fat_target_g: Math.round(variante.grassi_g)||null,
          }).select().single()
          if (mealErr) throw mealErr

          if (pasto.alimenti?.length > 0) {
            const foods = pasto.alimenti.map((a,i) => ({
              plan_meal_id: mealData.id, food_name: a.nome || 'Alimento',
              quantity_g: Math.round(parseFloat(a.quantita_g)||100),
              kcal: Math.round(parseFloat(a.kcal)||0),
              protein_g: Math.round(parseFloat(a.proteine_g)||0),
              carbs_g: Math.round(parseFloat(a.carboidrati_g)||0),
              fat_g: Math.round(parseFloat(a.grassi_g)||0),
              sort_order: i,
              options: (a.opzioni||[]).map(o=>({
                food_name:o.nome||'Alternativa',
                quantity_g:Math.round(parseFloat(o.quantita_g)||100),
                kcal:Math.round(parseFloat(o.kcal)||0),
                protein_g:Math.round(parseFloat(o.proteine_g)||0),
                carbs_g:Math.round(parseFloat(o.carboidrati_g)||0),
                fat_g:Math.round(parseFloat(o.grassi_g)||0),
              })),
            }))
            const { error: foodErr } = await supabase.from('plan_meal_foods').insert(foods)
            if (foodErr) throw foodErr
          }
        }
      }
      setStep(3)
    } catch(e) { setError('Errore: '+e.message) }
    setSaving(false)
  }

  function reset() { setStep(1); setRawText(''); setParsedPlan(null); setSelectedClient(''); setPlanTitle(''); setPlanNotes(''); setError('') }

  const totalMacroKcal = macroKcal(gen.protein, gen.carbs, gen.fat)
  const macroMatch = Math.abs(totalMacroKcal - gen.kcal) < 50

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#111'}}>Piano alimentare</div>
          <div style={{fontSize:12,color:'#888780'}}>Importa o genera un piano personalizzato</div>
        </div>
      </div>
      <div style={s.page}>

        {/* STEP 1 — SELEZIONE MODALITÀ + FORM */}
        {step === 1 && (
          <>
            {/* TOGGLE MODALITÀ */}
            <div style={{display:'flex',gap:0,background:'#F5F3EF',borderRadius:10,padding:4,marginBottom:16}}>
              {[
                {id:'import', icon:'ti-file-upload', label:'Importa piano esistente'},
                {id:'generate', icon:'ti-sparkles', label:'Genera piano personalizzato'},
              ].map(m=>(
                <button key={m.id} onClick={()=>{setMode(m.id);setError('')}} style={{
                  flex:1, padding:'9px 10px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
                  background: mode===m.id?'white':'transparent',
                  color: mode===m.id?'#D4570A':'#888780',
                  fontWeight: mode===m.id?700:400, fontSize:12,
                  boxShadow: mode===m.id?'0 1px 4px rgba(0,0,0,0.1)':'none',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.15s'
                }}>
                  <i className={`ti ${m.icon}`} style={{fontSize:14}}/>{m.label}
                </button>
              ))}
            </div>

            {/* ── MODALITÀ IMPORTA ── */}
            {mode === 'import' && (
              <div style={s.card}>
                <div style={{fontSize:14,fontWeight:600,color:'#111',marginBottom:4}}>Incolla il piano del nutrizionista</div>
                <div style={{fontSize:12,color:'#888780',lineHeight:1.6,marginBottom:14}}>
                  Copia e incolla il testo del piano alimentare — l'AI lo struttura automaticamente in giorni e pasti.
                </div>
                <textarea style={{...s.textarea,height:280}} placeholder="Incolla qui il testo del piano alimentare..." value={rawText} onChange={e=>setRawText(e.target.value)}/>
              </div>
            )}

            {/* ── MODALITÀ GENERA ── */}
            {mode === 'generate' && (
              <>
                {/* SEZIONE 1 — TARGET NUTRIZIONALI */}
                <div style={s.card}>
                  <div style={s.sectionTitle} onClick={()=>toggleSection('nutrition')}>
                    <i className="ti ti-target" style={{fontSize:15,color:'#D4570A'}}/>
                    Target nutrizionali
                    <i className={`ti ti-chevron-${openSections.nutrition?'up':'down'}`} style={{fontSize:13,color:'#888780',marginLeft:'auto'}}/>
                  </div>
                  {openSections.nutrition && (
                    <>
                      <div style={{marginBottom:12}}>
                        <label style={s.label}>Obiettivo</label>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {GOALS.map(g=>(
                            <button key={g.value} onClick={()=>setGen(p=>({...p,goal:g.value}))} style={{
                              padding:'6px 12px', borderRadius:18, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit',
                              background:gen.goal===g.value?'#D4570A':'white', color:gen.goal===g.value?'white':'#888780', borderColor:gen.goal===g.value?'#D4570A':'#E0DDD6'
                            }}>{g.label}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Tipo di dieta</label>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {DIET_TYPES.map(d=>(
                            <button key={d.value} onClick={()=>setGen(p=>({...p,diet_type:d.value}))} style={{
                              padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', textAlign:'left',
                              background:gen.diet_type===d.value?'#D4570A':'white',
                              color:gen.diet_type===d.value?'white':'#555',
                              borderColor:gen.diet_type===d.value?'#D4570A':'#E0DDD6',
                            }}>
                              <div>{d.label}</div>
                              <div style={{fontSize:10,opacity:0.75,marginTop:1,fontWeight:400}}>{d.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Pasti al giorno</label>
                        <div style={{display:'flex',gap:6}}>
                          {[3,4,5,6].map(n=>(
                            <button key={n} onClick={()=>setGen(p=>({...p,meals_per_day:n}))} style={{
                              flex:1, padding:'8px', borderRadius:8, border:'0.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600,
                              background:gen.meals_per_day===n?'#D4570A':'white', color:gen.meals_per_day===n?'white':'#888780', borderColor:gen.meals_per_day===n?'#D4570A':'#E0DDD6'
                            }}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <MacroForm gen={gen} setGen={setGen} macroKcal={macroKcal}/>
                    </>
                  )}
                </div>
                {/* SEZIONE 2 — PREFERENZE ALIMENTARI */}
                <div style={s.card}>
                  <div style={s.sectionTitle} onClick={()=>toggleSection('foods')}>
                    <i className="ti ti-apple" style={{fontSize:15,color:'#3B8C5A'}}/>
                    Preferenze alimentari
                    <i className={`ti ti-chevron-${openSections.foods?'up':'down'}`} style={{fontSize:13,color:'#888780',marginLeft:'auto'}}/>
                  </div>
                  {openSections.foods && (
                    <>
                      <div style={{marginBottom:10}}>
                        <label style={s.label}>Alimenti che ama 💚</label>
                        <textarea style={{...s.textarea,height:80}} placeholder="Es: pollo, riso, uova, avocado, mozzarella, pasta, salmone, yogurt greco, frutta..." value={gen.foods_liked} onChange={e=>setGen(p=>({...p,foods_liked:e.target.value}))}/>
                        <div style={{fontSize:11,color:'#888780',marginTop:4}}>Separati da virgola — l'AI costruirà il piano intorno a questi</div>
                      </div>
                      <div>
                        <label style={s.label}>Alimenti da evitare / intolleranze ❌</label>
                        <textarea style={{...s.textarea,height:60}} placeholder="Es: lattosio, glutine, pesce, frutta secca..." value={gen.foods_avoided} onChange={e=>setGen(p=>({...p,foods_avoided:e.target.value}))}/>
                      </div>
                    </>
                  )}
                </div>

                {/* SEZIONE 3 — STILE DI VITA */}
                <div style={s.card}>
                  <div style={s.sectionTitle} onClick={()=>toggleSection('lifestyle')}>
                    <i className="ti ti-home" style={{fontSize:15,color:'#4A90D4'}}/>
                    Stile di vita & cucina
                    <i className={`ti ti-chevron-${openSections.lifestyle?'up':'down'}`} style={{fontSize:13,color:'#888780',marginLeft:'auto'}}/>
                  </div>
                  {openSections.lifestyle && (
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {LIFESTYLE.map(l=>(
                        <button key={l.value} onClick={()=>setGen(p=>({...p,lifestyle:l.value}))} style={{
                          padding:'8px 14px', borderRadius:9, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit',
                          background:gen.lifestyle===l.value?'#4A90D4':'white', color:gen.lifestyle===l.value?'white':'#888780', borderColor:gen.lifestyle===l.value?'#4A90D4':'#E0DDD6'
                        }}>{l.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#E24B4A',marginBottom:12}}>{error}</div>}

            <button style={{...s.btn,width:'100%',justifyContent:'center',padding:'13px'}} onClick={elabora} disabled={loading}>
              <i className={`ti ${loading?'ti-loader-2':mode==='generate'?'ti-sparkles':'ti-wand'}`} style={{fontSize:16}}/>
              {loading ? (mode==='generate'?'Generazione piano in corso (~30s)...':'Elaborazione in corso...') : (mode==='generate'?'✨ Genera piano personalizzato':'Elabora con AI')}
            </button>
            {loading && mode==='generate' && (
              <div style={{textAlign:'center',fontSize:12,color:'#888780',marginTop:10,lineHeight:1.6}}>
                L'AI sta costruendo 7 giorni di piano su misura...<br/>Ci vogliono circa 30 secondi ☕
              </div>
            )}
          </>
        )}

        {/* STEP 2 — ANTEPRIMA + SALVA */}
        {step === 2 && parsedPlan && (
          <>
            <div style={{...s.card, background:'#EAF3DE', border:'0.5px solid #3B6D11', marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <i className="ti ti-circle-check" style={{fontSize:20,color:'#3B6D11'}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#3B6D11'}}>
                    {parsedPlan.generated ? '✨ Piano generato!' : '✓ Piano elaborato!'} — {parsedPlan.varianti?.length} giorni · {parsedPlan.varianti?.reduce((s,v)=>s+(v.pasti?.length||0),0)} pasti totali
                  </div>
                  <div style={{fontSize:11,color:'#3B6D11',opacity:0.8,marginTop:2}}>
                    {parsedPlan.kcal_totali} kcal · P{parsedPlan.proteine_g}g C{parsedPlan.carboidrati_g}g G{parsedPlan.grassi_g}g
                  </div>
                </div>
              </div>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Cliente *</label>
                  <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                    <option value="">Seleziona cliente...</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Titolo piano</label>
                  <input style={s.input} value={planTitle} onChange={e=>setPlanTitle(e.target.value)}/>
                </div>
              </div>
              <div style={{marginTop:8}}>
                <label style={s.label}>Note</label>
                <input style={s.input} value={planNotes} onChange={e=>setPlanNotes(e.target.value)} placeholder="Note generali sul piano..."/>
              </div>
            </div>

            {/* PROGRESSIONE SETTIMANALE — se pre-compilata */}
            {weeklyTargets.length > 0 && (
              <div style={{background:'#EAF3DE',border:'0.5px solid #3B6D11',borderRadius:12,padding:'14px',marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:'#3B6D11',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                  <i className="ti ti-calendar-stats" style={{fontSize:15}}/>
                  Progressione automatica — {weeklyTargets.length} settimane pre-compilate
                </div>
                {/* Data inizio */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <label style={{fontSize:11,color:'#3B6D11',fontWeight:600,whiteSpace:'nowrap'}}>Data inizio piano:</label>
                  <input type="date" value={planStartDate} onChange={e=>setPlanStartDate(e.target.value)}
                    style={{padding:'6px 10px',border:'0.5px solid #3B6D11',borderRadius:8,fontSize:12,background:'white',outline:'none',fontFamily:'inherit'}}/>
                </div>
                {/* Anteprima settimane */}
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {weeklyTargets.map((t,i)=>(
                    <div key={i} style={{background:'white',borderRadius:8,padding:'6px 10px',textAlign:'center',border:'0.5px solid #A7D9A0',minWidth:60}}>
                      <div style={{fontSize:9,color:'#888780',textTransform:'uppercase',marginBottom:2}}>S{t.week}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#3B6D11'}}>{t.kcal} kcal</div>
                      {t.note&&<div style={{fontSize:9,color:'#888780',marginTop:1}}>{t.note}</div>}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:'#3B6D11',marginTop:8,opacity:0.8}}>
                  ✓ Il cliente vedrà i macro aggiornati automaticamente ogni settimana
                </div>
              </div>
            )}
              <div key={vi} style={s.dayCard}>
                <div style={s.dayHeader}>
                  <span>{v.nome || `Giorno ${vi+1}`}</span>
                  <div style={{display:'flex',gap:6}}>
                    <span style={{...s.macroTag,background:'#FEF0E7',color:'#D4570A'}}>{Math.round(v.kcal)} kcal</span>
                    <span style={{...s.macroTag,background:'#EAF3DE',color:'#3B6D11'}}>P{Math.round(v.proteine_g)}g</span>
                    <span style={{...s.macroTag,background:'#FFF3E0',color:'#E8803A'}}>C{Math.round(v.carboidrati_g)}g</span>
                    <span style={{...s.macroTag,background:'#F5F3EF',color:'#888780'}}>G{Math.round(v.grassi_g)}g</span>
                  </div>
                </div>
                {(v.pasti||[]).map((p,pi)=>(
                  <div key={pi} style={{padding:'8px 14px',borderBottom:'0.5px solid #F5F3EF'}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#D4570A',marginBottom:4,textTransform:'capitalize'}}>{p.nome} {p.orario&&<span style={{color:'#888780',fontWeight:400}}>· {p.orario}</span>}</div>
                    {(p.alimenti||[]).map((a,ai)=>(
                      <div key={ai} style={s.exRow}>
                        <div style={{flex:1}}>
                          <span style={{fontSize:12,fontWeight:500,color:'#111'}}>{a.nome}</span>
                          <span style={{fontSize:11,color:'#888780',marginLeft:6}}>{a.quantita_g}g</span>
                          {a.opzioni?.length>0&&<span style={{fontSize:10,color:'#4A90D4',marginLeft:6}}>+{a.opzioni.length} alt.</span>}
                        </div>
                        <span style={{...s.tag,color:'#D4570A',background:'#FEF0E7'}}>{a.kcal} kcal</span>
                        <span style={s.tag}>P{a.proteine_g}g</span>
                        <span style={s.tag}>C{a.carboidrati_g}g</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {error && <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#E24B4A',marginBottom:12}}>{error}</div>}
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button style={{...s.btn,flex:1,justifyContent:'center'}} onClick={savePlan} disabled={saving}>
                <i className="ti ti-device-floppy" style={{fontSize:15}}/>{saving?'Salvataggio...':'Salva piano'}
              </button>
              <button style={s.btnGray} onClick={()=>setStep(1)}>← Torna</button>
            </div>
          </>
        )}

        {/* STEP 3 — SUCCESSO */}
        {step === 3 && (
          <div style={{...s.card, textAlign:'center', padding:'48px 20px'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#EAF3DE',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <i className="ti ti-circle-check" style={{fontSize:32,color:'#3B6D11'}}/>
            </div>
            <div style={{fontSize:17,fontWeight:700,color:'#111',marginBottom:8}}>Piano salvato!</div>
            <div style={{fontSize:13,color:'#888780',marginBottom:24,lineHeight:1.6}}>Il cliente troverà il piano nella sezione Piano alimentare.</div>
            <button onClick={reset} style={{...s.btn,margin:'0 auto'}}>
              <i className="ti ti-plus" style={{fontSize:15}}/> Crea un altro piano
            </button>
          </div>
        )}
      </div>
    </>
  )
}
