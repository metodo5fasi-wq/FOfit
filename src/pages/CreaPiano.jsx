import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { searchFoods } from '../data/foodDatabase.js'

const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
const MEAL_TYPES = ['Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Spuntino sera']
const MEAL_ICONS = {Colazione:'☀️','Spuntino mattina':'🍎',Pranzo:'🍽️','Spuntino pomeriggio':'🥜',Cena:'🌙','Spuntino sera':'🫐'}
const PREP_ICONS = {'a crudo':'🥗','vapore':'♨️','griglia':'🔥','forno':'🫙','padella':'🍳','bollitura':'🫕','microonde':'📡','friggitrice aria':'💨','no cottura':'❄️'}

const DIET_TYPES = [
  {id:'lineare', label:'Lineare', desc:'Stesso apporto calorico ogni giorno', calc:(kcal)=>Array(7).fill(kcal)},
  {id:'onde', label:'A onde', desc:'Alternanza alto-basso (3-3-1)', calc:(kcal)=>{const hi=Math.round(kcal*1.1),lo=Math.round(kcal*0.9);return [hi,lo,hi,lo,hi,lo,Math.round(kcal)]}},
  {id:'ciclica', label:'Ciclica 5+2', desc:'5 giorni normali + 2 giorni bassi', calc:(kcal)=>[kcal,kcal,kcal,kcal,kcal,Math.round(kcal*0.75),Math.round(kcal*0.75)]},
  {id:'carb_cycling', label:'Carb cycling', desc:'Alto/medio/basso carb in rotazione', calc:(kcal)=>[Math.round(kcal*1.15),Math.round(kcal*0.9),Math.round(kcal*1.1),Math.round(kcal*0.85),Math.round(kcal*1.2),Math.round(kcal*0.9),Math.round(kcal*0.8)]},
  {id:'refeed', label:'Refeed settimanale', desc:'6 giorni deficit + 1 giorno al TDEE', calc:(kcal,tdee)=>[...Array(6).fill(kcal),tdee||Math.round(kcal*1.2)]},
  {id:'intermittente', label:'Digiuno 16:8', desc:'Finestra alimentare 8h, pasti concentrati', calc:(kcal)=>Array(7).fill(kcal)},
  {id:'52', label:'Digiuno 5:2', desc:'5 giorni normali + 2 giorni 500 kcal', calc:(kcal)=>[kcal,kcal,500,kcal,kcal,kcal,500]},
  {id:'reverse', label:'Reverse diet', desc:'Aumento calorico progressivo +50 kcal/giorno', calc:(kcal)=>Array(7).fill(0).map((_,i)=>kcal+i*50)},
]

function macroKcal(p,c,g){return Math.round((parseFloat(p)||0)*4+(parseFloat(c)||0)*4+(parseFloat(g)||0)*9)}

function calcolaTDEE(a){
  const peso=parseFloat(a?.peso_attuale)||0,alt=parseFloat(a?.altezza)||0
  const eta=a?.data_nascita?Math.floor((new Date()-new Date(a.data_nascita))/(365.25*24*60*60*1000)):30
  const sesso=a?.sesso||'M'
  if(!peso||!alt) return null
  const bmr=sesso==='F'?447.6+9.25*peso+3.1*alt-4.33*eta:88.4+13.4*peso+4.8*alt-5.68*eta
  const attFactor=a?.si_allena?1.55:1.375
  const tdee=Math.round(bmr*attFactor)
  const ob=(a?.obiettivo||'').toLowerCase()
  const kcal=ob.includes('dimagr')||ob.includes('ricompos')?Math.round(tdee*0.82):ob.includes('massa')||ob.includes('aument')?Math.round(tdee*1.10):tdee
  const prot=Math.round(peso*2),fat=Math.round(kcal*0.25/9),carbs=Math.round((kcal-prot*4-fat*9)/4)
  return{kcal,prot,fat,carbs,tdee,bmr:Math.round(bmr)}
}

// Helper components
function Sec({title,color,children}){
  return <div style={{marginBottom:14}}>
    <div style={{fontSize:11,fontWeight:700,color,marginBottom:8}}>{title}</div>
    {children}
  </div>
}
function Fld({label,id,placeholder,type='text',options=[],rows}){
  const base={width:'100%',padding:'8px 10px',border:'0.5px solid #222',borderRadius:8,fontSize:12,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
  return <div style={{marginBottom:8}}>
    {label&&<div style={{fontSize:9,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{label}</div>}
    {type==='select'?<select id={id} style={base}>{options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select>
    :rows?<textarea id={id} placeholder={placeholder} rows={rows} style={{...base,resize:'vertical',lineHeight:1.5}}/>
    :<input id={id} type={type} placeholder={placeholder} style={base}/>}
  </div>
}

export default function CreaPiano(){
  const navigate=useNavigate()
  const [searchParams]=useSearchParams()
  const clientId=searchParams.get('client')
  const {toast}=useToast()

  const [clients,setClients]=useState([])
  const [selectedClient,setSelectedClient]=useState(clientId||'')
  const [clientAnamnesi,setClientAnamnesi]=useState(null)
  const [planName,setPlanName]=useState('Piano alimentare')
  const [kcalTarget,setKcalTarget]=useState('')
  const [protTarget,setProtTarget]=useState('')
  const [carbsTarget,setCarbsTarget]=useState('')
  const [fatTarget,setFatTarget]=useState('')
  const [selectedDiet,setSelectedDiet]=useState('lineare')
  const [dayCalories,setDayCalories]=useState(Array(7).fill(0))
  const [selectedDay,setSelectedDay]=useState(0)
  const [saving,setSaving]=useState(false)
  const [days,setDays]=useState(()=>{const d={};for(let i=0;i<7;i++)d[i]=[];return d})

  // Selection mode
  const [selectMode,setSelectMode]=useState(false)
  const [selectedMeals,setSelectedMeals]=useState(new Set()) // "dayIdx-mealIdx"

  // Food search
  const [addingTo,setAddingTo]=useState(null)
  const [foodSearch,setFoodSearch]=useState('')
  const [foodResults,setFoodResults]=useState([])
  const [newQty,setNewQty]=useState('100')
  const searchTimer=useRef(null)

  // Templates
  const [templates,setTemplates]=useState(()=>{try{return JSON.parse(localStorage.getItem('fofit_meal_tpl')||'[]')}catch{return[]}})
  const [showTemplates,setShowTemplates]=useState(null)
  const [savingTpl,setSavingTpl]=useState(null)
  const [tplName,setTplName]=useState('')

  // Other plans
  const [showCopyPlan,setShowCopyPlan]=useState(false)
  const [otherPlans,setOtherPlans]=useState([])

  // AI
  const [showAI,setShowAI]=useState(false)
  const [aiLoading,setAiLoading]=useState(false)
  const [aiProgress,setAiProgress]=useState(0)
  const [aiStatus,setAiStatus]=useState('')
  const [aiFeedback,setAiFeedback]=useState('')
  const [showFeedback,setShowFeedback]=useState(false)
  const [regenDay,setRegenDay]=useState(null)

  // Preview
  const [showPreview,setShowPreview]=useState(false)

  // Meal notes
  const [mealNotes,setMealNotes]=useState({})

  useEffect(()=>{
    supabase.from('profiles').select('id,full_name').eq('role','client').order('full_name').then(({data})=>setClients(data||[]))
  },[])

  useEffect(()=>{
    if(!selectedClient) return
    supabase.from('anamnesi').select('*').eq('client_id',selectedClient).single().then(({data})=>{
      if(data){
        setClientAnamnesi(data)
        const calc=calcolaTDEE(data)
        if(calc){
          setKcalTarget(String(calc.kcal))
          setProtTarget(String(calc.prot))
          setCarbsTarget(String(calc.carbs))
          setFatTarget(String(calc.fat))
        }
      }
    })
  },[selectedClient])

  // Ricalcola calorie per giorno quando cambia dieta o target
  useEffect(()=>{
    if(!kcalTarget) return
    const dt=DIET_TYPES.find(d=>d.id===selectedDiet)
    if(dt){
      const tdee=clientAnamnesi?calcolaTDEE(clientAnamnesi)?.tdee:null
      setDayCalories(dt.calc(parseInt(kcalTarget)||2000,tdee))
    }
  },[selectedDiet,kcalTarget,clientAnamnesi])

  // Food search debounce
  function searchFood(q){
    setFoodSearch(q)
    clearTimeout(searchTimer.current)
    if(q.length<2){setFoodResults([]);return}
    searchTimer.current=setTimeout(()=>setFoodResults(searchFoods(q).slice(0,14)),200)
  }

  function addMeal(di){setDays(p=>{const d={...p};d[di]=[...d[di],{meal_type:'Colazione',foods:[],note_pasto:''}];return d})}

  function removeMeal(di,mi){setDays(p=>{const d={...p};d[di]=d[di].filter((_,i)=>i!==mi);return d})}

  function setMealType(di,mi,t){setDays(p=>{const d={...p};d[di][mi]={...d[di][mi],meal_type:t};return d})}

  function addFood(food){
    if(!addingTo) return
    const{dayIdx:di,mealIdx:mi}=addingTo
    const qty=parseFloat(newQty)||100
    const item={food_name:food.name,quantity_g:qty,kcal:Math.round(food.kcal100*qty/100),protein_g:Math.round(food.p*qty/100*10)/10,carbs_g:Math.round(food.c*qty/100*10)/10,fat_g:Math.round(food.g*qty/100*10)/10,_k100:food.kcal100,_p100:food.p,_c100:food.c,_g100:food.g,prep:''}
    setDays(p=>{const d={...p};d[di][mi].foods=[...d[di][mi].foods,item];return d})
    setFoodSearch('');setFoodResults([]);setNewQty('100')
  }

  function removeFood(di,mi,fi){setDays(p=>{const d={...p};d[di][mi].foods=d[di][mi].foods.filter((_,i)=>i!==fi);return d})}

  function updateFoodQty(di,mi,fi,qty){
    setDays(p=>{const d={...p};const f=d[di][mi].foods[fi];const q=parseFloat(qty)||0
      d[di][mi].foods[fi]={...f,quantity_g:q,kcal:Math.round((f._k100||0)*q/100),protein_g:Math.round((f._p100||0)*q/100*10)/10,carbs_g:Math.round((f._c100||0)*q/100*10)/10,fat_g:Math.round((f._g100||0)*q/100*10)/10}
      return d})
  }

  function updatePrep(di,mi,fi,prep){setDays(p=>{const d={...p};d[di][mi].foods[fi]={...d[di][mi].foods[fi],prep};return d})}

  // Selection mode
  function toggleMealSelect(di,mi){
    const k=`${di}-${mi}`
    setSelectedMeals(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})
  }

  function deleteSelected(){
    setDays(p=>{
      const d={...p}
      selectedMeals.forEach(k=>{
        const[di,mi]=k.split('-').map(Number)
        if(d[di]) d[di]=d[di].filter((_,i)=>i!==mi)
      })
      return d
    })
    setSelectedMeals(new Set())
    setSelectMode(false)
    toast(`${selectedMeals.size} pasti eliminati`,'success')
  }

  // Templates
  function saveTpl(di,mi){
    if(!tplName.trim()) return
    const meal=days[di][mi]
    const t={id:Date.now(),name:tplName,meal_type:meal.meal_type,foods:meal.foods}
    const updated=[...templates,t]
    setTemplates(updated)
    localStorage.setItem('fofit_meal_tpl',JSON.stringify(updated))
    setSavingTpl(null);setTplName('')
    toast('Template salvato!','success')
  }

  function loadTpl(t,di,mi){
    setDays(p=>{const d={...p};d[di][mi]={...d[di][mi],meal_type:t.meal_type,foods:JSON.parse(JSON.stringify(t.foods))};return d})
    setShowTemplates(null)
    toast(`"${t.name}" caricato!`,'success')
  }

  function copyDay(from,to){
    setDays(p=>{const d={...p};d[to]=JSON.parse(JSON.stringify(d[from]));return d})
    toast(`${DAY_NAMES[from]} copiato su ${DAY_NAMES[to]}`,'success')
  }

  // Copy from other plan
  async function loadOtherPlans(){
    const{data}=await supabase.from('meal_plans').select('id,name,client_id,profiles!meal_plans_client_id_fkey(full_name)').eq('is_active',true).neq('client_id',selectedClient).limit(20)
    setOtherPlans(data||[]);setShowCopyPlan(true)
  }

  async function importPlan(planId){
    const{data:meals}=await supabase.from('plan_meals').select('*,plan_meal_foods(*)').eq('plan_id',planId)
    if(!meals?.length) return
    const nd={};for(let i=0;i<7;i++)nd[i]=[]
    meals.forEach(m=>{
      const di=m.day_of_week??0
      nd[di]=[...(nd[di]||[]),{meal_type:m.meal_type,note_pasto:m.notes||'',foods:(m.plan_meal_foods||[]).map(f=>({food_name:f.food_name,quantity_g:parseFloat(f.quantity_g)||0,kcal:parseFloat(f.kcal)||0,protein_g:parseFloat(f.protein_g)||0,carbs_g:parseFloat(f.carbs_g)||0,fat_g:parseFloat(f.fat_g)||0,_k100:(f.kcal/(f.quantity_g/100))||0,_p100:(f.protein_g/(f.quantity_g/100))||0,_c100:(f.carbs_g/(f.quantity_g/100))||0,_g100:(f.fat_g/(f.quantity_g/100))||0,prep:''}))}]
    })
    setDays(nd);setShowCopyPlan(false)
    toast('Piano importato!','success')
  }

  // Rigenera singolo giorno
  async function regenSingleDay(di){
    const formData=buildFormDataFromDOM()
    setRegenDay(di)
    try{
      const res=await fetch('/api/generate-plan',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({formData,kcalTarget,protTarget,carbsTarget,fatTarget,dietType:selectedDiet,dayCalories})})
      const data=await res.json()
      if(!res.ok||data.error) throw new Error(data.error)
      if(data.days?.[String(di)]){
        setDays(p=>{const d={...p};d[di]=parseDayMeals(data.days[String(di)]);return d})
        toast(`${DAY_NAMES[di]} rigenerato!`,'success')
      }
    }catch(e){toast('Errore: '+e.message,'error')}
    setRegenDay(null)
  }

  function parseDayMeals(meals){
    return meals.map(m=>({
      meal_type:m.meal_type,
      note_pasto:m.note_pasto||'',
      foods:(m.foods||[]).map(f=>{
        const qty=f.qty||100
        return{food_name:f.name,quantity_g:qty,kcal:Math.round((f.kcal100||0)*qty/100),protein_g:Math.round((f.p100||0)*qty/100*10)/10,carbs_g:Math.round((f.c100||0)*qty/100*10)/10,fat_g:Math.round((f.g100||0)*qty/100*10)/10,_k100:f.kcal100||0,_p100:f.p100||0,_c100:f.c100||0,_g100:f.g100||0,prep:f.prep||''}
      })
    }))
  }

  function buildFormDataFromDOM(){
    const get=id=>document.getElementById(id)?.value||''
    return{
      eta:get('ai_eta'),sesso:get('ai_sesso'),peso:get('ai_peso'),altezza:get('ai_altezza'),
      lavoro:get('ai_lavoro'),attivita:get('ai_attivita'),obiettivo:get('ai_obiettivo'),
      obiettivoEstetico:get('ai_ob_estetico'),variazione:get('ai_variazione'),pesoObiettivo:get('ai_peso_ob'),
      noteObiettivo:get('ai_note_ob'),numPasti:get('ai_num_pasti'),stileCucina:get('ai_stile'),
      pastiSelezionati:get('ai_pasti_sel'),preferenzePasti:get('ai_pref_pasti'),
      tempoCottura:get('ai_tempo'),metodiCottura:get('ai_metodi'),attrezzatura:get('ai_attrez'),
      livelloCulinario:get('ai_livello'),budget:get('ai_budget'),mealPrep:get('ai_meal_prep'),
      orariPasti:get('ai_orari'),stilVita:get('ai_stil_vita'),
      intolleranze:get('ai_intolleranze'),patologie:get('ai_patologie'),farmaci:get('ai_farmaci'),
      nonMangia:get('ai_non_mangia'),amaMangiare:get('ai_ama'),
      integratoriUsati:get('ai_integr'),altreNote:get('ai_altre_note'),noteExtra:get('ai_note_extra'),
    }
  }

  // AI genera piano completo
  async function generateWithAI(){
    const formData=buildFormDataFromDOM()
    const hasData=Object.values(formData).some(v=>v&&v!=='—')
    if(!hasData){toast('Compila almeno un campo','error');return}

    setAiLoading(true);setAiProgress(5);setAiStatus('Analisi cliente...')
    setAiFeedback('');setShowFeedback(false)

    const msgs=['Analisi cliente...','Lunedì...','Martedì...','Mercoledì...','Giovedì...','Venerdì...','Sabato...','Domenica...','Feedback AI...']
    let cur=5
    const timer=setInterval(()=>{
      cur=Math.min(cur+1.5,88)
      const dayIdx=Math.floor((cur-5)/12)
      setAiProgress(Math.round(cur))
      setAiStatus(msgs[Math.min(dayIdx,msgs.length-1)])
    },400)

    try{
      const res=await fetch('/api/generate-plan',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({formData,kcalTarget,protTarget,carbsTarget,fatTarget,dietType:selectedDiet,dayCalories})})
      clearInterval(timer)
      setAiProgress(95);setAiStatus('Costruzione piano...')
      const data=await res.json()
      if(!res.ok||data.error) throw new Error(data.error)

      const newDays={}
      for(let i=0;i<7;i++) newDays[i]=[]
      Object.entries(data.days).forEach(([di,meals])=>{newDays[parseInt(di)]=parseDayMeals(meals)})
      setDays(newDays)
      if(data.feedback){setAiFeedback(data.feedback);setShowFeedback(true)}
      setAiProgress(100);setAiStatus('Piano pronto! ✅')
      await new Promise(r=>setTimeout(r,500))
      setShowAI(false)
      toast('Piano generato! 🎉','success')
    }catch(e){
      clearInterval(timer)
      toast('Errore: '+e.message,'error')
    }finally{
      setAiLoading(false);setAiProgress(0);setAiStatus('')
    }
  }

  // Totali
  function dayTotals(di){
    return(days[di]||[]).reduce((acc,m)=>{
      m.foods.forEach(f=>{acc.kcal+=parseFloat(f.kcal)||0;acc.prot+=parseFloat(f.protein_g)||0;acc.carbs+=parseFloat(f.carbs_g)||0;acc.fat+=parseFloat(f.fat_g)||0})
      return acc
    },{kcal:0,prot:0,carbs:0,fat:0})
  }

  function mealTot(meal){
    return meal.foods.reduce((acc,f)=>({kcal:acc.kcal+(parseFloat(f.kcal)||0),prot:acc.prot+(parseFloat(f.protein_g)||0),carbs:acc.carbs+(parseFloat(f.carbs_g)||0),fat:acc.fat+(parseFloat(f.fat_g)||0)}),{kcal:0,prot:0,carbs:0,fat:0})
  }

  // Aggiusta automaticamente le kcal per un giorno
  function adjustDay(di){
    const target=dayCalories[di]||parseInt(kcalTarget)||0
    if(!target) return
    const tot=dayTotals(di)
    if(!tot.kcal) return
    const ratio=target/tot.kcal
    setDays(p=>{
      const d={...p}
      d[di]=d[di].map(m=>({...m,foods:m.foods.map(f=>{
        const q=Math.round(f.quantity_g*ratio)
        return{...f,quantity_g:q,kcal:Math.round((f._k100||0)*q/100),protein_g:Math.round((f._p100||0)*q/100*10)/10,carbs_g:Math.round((f._c100||0)*q/100*10)/10,fat_g:Math.round((f._g100||0)*q/100*10)/10}
      })}))
      return d
    })
    toast(`${DAY_NAMES[di]} aggiustato a ${target} kcal`,'success')
  }

  // Salva piano
  async function savePlan(){
    if(!selectedClient){toast('Seleziona un cliente','error');return}
    const hasMeals=Object.values(days).some(d=>d.length>0)
    if(!hasMeals){toast('Aggiungi almeno un pasto','error');return}
    setSaving(true)
    try{
      await supabase.from('meal_plans').update({is_active:false}).eq('client_id',selectedClient)
      const{data:plan,error:planErr}=await supabase.from('meal_plans').insert({
        client_id:selectedClient,name:planName,is_active:true,
        kcal_target:parseInt(kcalTarget)||null,protein_target_g:parseInt(protTarget)||null,
        carbs_target_g:parseInt(carbsTarget)||null,fat_target_g:parseInt(fatTarget)||null,
      }).select().single()
      if(planErr) throw planErr

      for(const[di,meals] of Object.entries(days)){
        for(const[mi,meal] of meals.entries()){
          if(!meal.foods.length) continue
          const{data:md,error:me}=await supabase.from('plan_meals').insert({
            plan_id:plan.id,meal_type:meal.meal_type,day_of_week:parseInt(di),
            day_label:DAY_NAMES[parseInt(di)],sort_order:mi,
            notes:mealNotes[`${di}-${mi}`]||meal.note_pasto||null,
          }).select().single()
          if(me) throw me
          await supabase.from('plan_meal_foods').insert(meal.foods.map((f,fi)=>({
            plan_meal_id:md.id,food_name:f.food_name,quantity_g:f.quantity_g,
            kcal:f.kcal,protein_g:f.protein_g,carbs_g:f.carbs_g,fat_g:f.fat_g,sort_order:fi,
          })))
        }
      }
      toast('Piano salvato! 🎉','success')
      setTimeout(()=>navigate(`/modifica-piano/${plan.id}`),800)
    }catch(e){toast('Errore: '+e.message,'error')}
    setSaving(false)
  }

  const s={
    page:{minHeight:'100dvh',background:'#080808',color:'#F0F0F0',fontFamily:'inherit',overflowY:'auto'},
    topbar:{background:'#080808',borderBottom:'0.5px solid #111',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,position:'sticky',top:0,zIndex:50},
    card:{background:'#0D0D0D',borderRadius:14,padding:'14px 16px',marginBottom:10,border:'0.5px solid #1C1C1C'},
    label:{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6},
    input:{width:'100%',padding:'9px 12px',border:'0.5px solid #222',borderRadius:8,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    select:{width:'100%',padding:'9px 12px',border:'0.5px solid #222',borderRadius:8,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    btn:{padding:'9px 16px',background:'#D4570A',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6},
    btnGray:{padding:'7px 12px',background:'#161616',color:'#CCC',border:'0.5px solid #222',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5},
    btnDanger:{padding:'5px 8px',background:'none',color:'#E24B4A',border:'0.5px solid rgba(226,75,74,0.3)',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'},
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'},
    modalBox:{background:'#0D0D0D',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:600,maxHeight:'92dvh',display:'flex',flexDirection:'column',border:'0.5px solid #1C1C1C'},
  }

  const tot=dayTotals(selectedDay)
  const dayTarget=dayCalories[selectedDay]||parseInt(kcalTarget)||0
  const tdeeInfo=clientAnamnesi?calcolaTDEE(clientAnamnesi):null
  const currentDiet=DIET_TYPES.find(d=>d.id===selectedDiet)

  return(
    <div style={s.page}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <button onClick={()=>navigate('/admin')} style={{width:34,height:34,borderRadius:9,border:'0.5px solid #222',background:'#161616',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#F0F0F0',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>Crea Piano Alimentare</div>
          {selectedClient&&<div style={{fontSize:10,color:'#555'}}>{clients.find(c=>c.id===selectedClient)?.full_name}</div>}
        </div>
        <button onClick={()=>setShowAI(true)} style={{...s.btnGray,background:'rgba(155,89,182,0.12)',color:'#C39BE0',border:'0.5px solid rgba(155,89,182,0.3)'}}>
          <i className="ti ti-sparkles" style={{fontSize:13}}/>AI
        </button>
        <button onClick={()=>setShowPreview(true)} style={{...s.btnGray,color:'#4A90D4',border:'0.5px solid rgba(74,144,212,0.3)',background:'rgba(74,144,212,0.1)'}}>
          <i className="ti ti-eye" style={{fontSize:13}}/>Preview
        </button>
        <button onClick={savePlan} disabled={saving} style={s.btn}>
          <i className="ti ti-device-floppy" style={{fontSize:13}}/>
          {saving?'Salvo...':'Salva'}
        </button>
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'14px 16px'}}>

        {/* FEEDBACK AI */}
        {showFeedback&&aiFeedback&&(
          <div style={{...s.card,background:'rgba(155,89,182,0.08)',border:'0.5px solid rgba(155,89,182,0.25)',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#C39BE0',marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-sparkles" style={{fontSize:12}}/>Feedback AI sul piano
                </div>
                <div style={{fontSize:12,color:'#DDD',lineHeight:1.6}}>{aiFeedback}</div>
              </div>
              <button onClick={()=>setShowFeedback(false)} style={{...s.btnGray,padding:'3px 7px',flexShrink:0}}>✕</button>
            </div>
          </div>
        )}

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

          {/* TARGET */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em'}}>Target base</div>
            {tdeeInfo&&(
              <button onClick={()=>{setKcalTarget(String(tdeeInfo.kcal));setProtTarget(String(tdeeInfo.prot));setCarbsTarget(String(tdeeInfo.carbs));setFatTarget(String(tdeeInfo.fat))}}
                style={{...s.btnGray,fontSize:10,padding:'4px 9px'}}>
                <i className="ti ti-calculator" style={{fontSize:11}}/>Da profilo ({tdeeInfo.kcal} kcal)
              </button>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
            {[{l:'Kcal',v:kcalTarget,s:v=>{setKcalTarget(v)},c:'#D4570A'},
              {l:'P (g)',v:protTarget,s:v=>{setProtTarget(v);setKcalTarget(String(macroKcal(v,carbsTarget,fatTarget)||''))},c:'#4A90D4'},
              {l:'C (g)',v:carbsTarget,s:v=>{setCarbsTarget(v);setKcalTarget(String(macroKcal(protTarget,v,fatTarget)||''))},c:'#E8A020'},
              {l:'G (g)',v:fatTarget,s:v=>{setFatTarget(v);setKcalTarget(String(macroKcal(protTarget,carbsTarget,v)||''))},c:'#3B8C5A'}
            ].map(f=>(
              <div key={f.l}>
                <label style={{...s.label,color:f.c}}>{f.l}</label>
                <input style={{...s.input,borderColor:`${f.c}44`,textAlign:'center',fontWeight:700,color:f.c}} type="number" value={f.v} onChange={e=>f.s(e.target.value)} placeholder="—"/>
              </div>
            ))}
          </div>

          {/* TIPO DIETA */}
          <div style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Tipo di dieta</div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
            {DIET_TYPES.map(dt=>(
              <button key={dt.id} onClick={()=>setSelectedDiet(dt.id)} style={{
                padding:'5px 10px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:selectedDiet===dt.id?700:400,
                background:selectedDiet===dt.id?'rgba(212,87,10,0.15)':'#161616',
                color:selectedDiet===dt.id?'#F4894A':'#888',
                border:selectedDiet===dt.id?'0.5px solid rgba(212,87,10,0.4)':'0.5px solid #222',
              }}>{dt.label}</button>
            ))}
          </div>
          {currentDiet&&<div style={{fontSize:11,color:'#555',marginBottom:10}}>{currentDiet.desc}</div>}

          {/* CALORIE PER GIORNO */}
          {kcalTarget&&(
            <div style={{background:'#111',borderRadius:10,padding:'10px 12px'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Calorie per giorno</div>
              <div style={{display:'flex',gap:4}}>
                {dayCalories.map((kcal,i)=>(
                  <div key={i} style={{flex:1,textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#555',marginBottom:2}}>{DAY_NAMES[i].slice(0,3)}</div>
                    <input type="number" value={kcal} onChange={e=>{const n=[...dayCalories];n[i]=parseInt(e.target.value)||0;setDayCalories(n)}}
                      style={{width:'100%',padding:'3px 2px',border:'0.5px solid #222',borderRadius:5,fontSize:10,textAlign:'center',color:i===selectedDay?'#F4894A':'#CCC',background:i===selectedDay?'rgba(212,87,10,0.1)':'#161616',outline:'none',fontFamily:'inherit'}}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AZIONI */}
          <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
            <button onClick={loadOtherPlans} style={s.btnGray}><i className="ti ti-copy" style={{fontSize:12}}/>Copia da altro cliente</button>
            {!selectMode?(
              <button onClick={()=>setSelectMode(true)} style={{...s.btnGray,color:'#E24B4A',border:'0.5px solid rgba(226,75,74,0.3)'}}>
                <i className="ti ti-trash" style={{fontSize:12}}/>Seleziona ed elimina
              </button>
            ):(
              <>
                <button onClick={deleteSelected} disabled={!selectedMeals.size} style={{...s.btn,background:'#E24B4A',opacity:selectedMeals.size?1:0.4}}>
                  <i className="ti ti-trash" style={{fontSize:12}}/>Elimina ({selectedMeals.size})
                </button>
                <button onClick={()=>{setSelectMode(false);setSelectedMeals(new Set())}} style={s.btnGray}>Annulla</button>
              </>
            )}
          </div>
        </div>

        {/* GIORNI */}
        <div style={{display:'flex',gap:5,marginBottom:10,overflowX:'auto',paddingBottom:4}}>
          {DAY_NAMES.map((d,i)=>{
            const t=dayTotals(i);const has=days[i].length>0
            const target=dayCalories[i]||parseInt(kcalTarget)||0
            const diff=target?Math.round(t.kcal-target):0
            const ok=Math.abs(diff)<=100
            return(
              <button key={i} onClick={()=>setSelectedDay(i)} style={{
                flexShrink:0,padding:'7px 10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                background:selectedDay===i?'#D4570A':has?'#161616':'#0D0D0D',
                color:selectedDay===i?'white':has?'#F0F0F0':'#555',
                border:selectedDay===i?'none':has&&!ok?'0.5px solid rgba(226,75,74,0.4)':'0.5px solid #222',
                fontWeight:selectedDay===i?700:400,
              }}>
                <div style={{fontSize:11,fontWeight:700}}>{d.slice(0,3)}</div>
                {has&&<div style={{fontSize:9,marginTop:1,color:selectedDay===i?'rgba(255,255,255,.7)':ok?'#3B8C5A':'#E24B4A'}}>{Math.round(t.kcal)}</div>}
                {has&&target>0&&<div style={{fontSize:8,color:selectedDay===i?'rgba(255,255,255,.5)':ok?'#555':'#E24B4A'}}>{diff>0?'+':''}{diff}</div>}
              </button>
            )
          })}
        </div>

        {/* BARRE MACRO + AGGIUSTA */}
        {days[selectedDay].length>0&&(
          <div style={{...s.card,padding:'10px 14px',marginBottom:10}}>
            <div style={{display:'flex',gap:8,marginBottom:8}}>
              {[{l:'Kcal',v:Math.round(tot.kcal),t:dayTarget,c:'#D4570A'},
                {l:'P',v:Math.round(tot.prot*10)/10,t:parseInt(protTarget)||0,c:'#4A90D4'},
                {l:'C',v:Math.round(tot.carbs*10)/10,t:parseInt(carbsTarget)||0,c:'#E8A020'},
                {l:'G',v:Math.round(tot.fat*10)/10,t:parseInt(fatTarget)||0,c:'#3B8C5A'}
              ].map(m=>{
                const pct=m.t>0?Math.min(Math.round(m.v/m.t*100),130):0
                const col=pct>115?'#E24B4A':pct>=90?'#3B8C5A':m.c
                return(
                  <div key={m.l} style={{flex:1,textAlign:'center'}}>
                    <div style={{fontSize:9,color:m.c,fontWeight:700,marginBottom:2}}>{m.l}</div>
                    <div style={{fontSize:15,fontWeight:800,color:col}}>{m.v}</div>
                    <div style={{height:3,background:'#1A1A1A',borderRadius:3,margin:'3px 0',overflow:'hidden'}}>
                      <div style={{height:3,background:col,width:`${Math.min(pct,100)}%`,borderRadius:3}}/>
                    </div>
                    <div style={{fontSize:9,color:'#555'}}>{m.t>0?`${pct}%`:''}</div>
                  </div>
                )
              })}
            </div>
            {dayTarget>0&&Math.abs(tot.kcal-dayTarget)>100&&(
              <button onClick={()=>adjustDay(selectedDay)} style={{...s.btnGray,width:'100%',justifyContent:'center',fontSize:11,color:'#E8A020',borderColor:'rgba(232,160,32,0.3)'}}>
                <i className="ti ti-adjustments" style={{fontSize:12}}/>Aggiusta automaticamente a {dayTarget} kcal
              </button>
            )}
          </div>
        )}

        {/* COPIA + RIGENERA GIORNO */}
        {days[selectedDay].length>0&&(
          <div style={{marginBottom:10,display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:10,color:'#555'}}>Copia su:</span>
            {DAY_NAMES.map((d,i)=>i!==selectedDay&&(
              <button key={i} onClick={()=>copyDay(selectedDay,i)} style={s.btnGray}>{d.slice(0,3)}</button>
            ))}
            <button onClick={()=>regenSingleDay(selectedDay)} disabled={regenDay!==null} style={{...s.btnGray,color:'#4A90D4',border:'0.5px solid rgba(74,144,212,0.3)',marginLeft:'auto'}}>
              <i className={`ti ti-refresh${regenDay===selectedDay?' ti-spin':''}`} style={{fontSize:12}}/>
              {regenDay===selectedDay?'Rigenero...':'Rigenera giorno'}
            </button>
          </div>
        )}

        {/* PASTI */}
        {days[selectedDay].map((meal,mi)=>{
          const mt=mealTot(meal)
          const pct=tot.kcal>0?Math.round(mt.kcal/tot.kcal*100):0
          const nk=`${selectedDay}-${mi}`
          const isSelected=selectedMeals.has(nk)
          return(
            <div key={mi} style={{...s.card,border:isSelected?'0.5px solid rgba(226,75,74,0.5)':selectMode?'0.5px solid #333':'0.5px solid #1C1C1C',position:'relative'}}>
              {/* Checkbox selezione */}
              {selectMode&&(
                <div onClick={()=>toggleMealSelect(selectedDay,mi)} style={{position:'absolute',top:12,right:12,width:22,height:22,borderRadius:6,border:`1.5px solid ${isSelected?'#E24B4A':'#333'}`,background:isSelected?'rgba(226,75,74,0.2)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {isSelected&&<i className="ti ti-check" style={{fontSize:13,color:'#E24B4A'}}/>}
                </div>
              )}

              {/* Header pasto */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontSize:18}}>{MEAL_ICONS[meal.meal_type]||'🍽️'}</span>
                <select style={{...s.select,flex:1,fontWeight:700}} value={meal.meal_type} onChange={e=>setMealType(selectedDay,mi,e.target.value)}>
                  {MEAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                {mt.kcal>0&&(
                  <div style={{background:'rgba(212,87,10,0.1)',borderRadius:8,padding:'3px 8px',fontSize:11,fontWeight:700,color:'#F4894A',flexShrink:0,whiteSpace:'nowrap'}}>
                    {Math.round(mt.kcal)} kcal {pct>0&&`(${pct}%)`}
                  </div>
                )}
                {!selectMode&&(
                  <button onClick={()=>removeMeal(selectedDay,mi)} style={{...s.btnDanger,flexShrink:0}}>
                    <i className="ti ti-trash" style={{fontSize:13}}/>
                  </button>
                )}
              </div>

              {/* Note preparazione pasto */}
              {meal.note_pasto&&(
                <div style={{background:'rgba(155,89,182,0.08)',borderRadius:8,padding:'7px 10px',marginBottom:8,fontSize:11,color:'#C39BE0',borderLeft:'2px solid rgba(155,89,182,0.4)'}}>
                  <i className="ti ti-chef-hat" style={{fontSize:11,marginRight:5}}/>
                  {meal.note_pasto}
                </div>
              )}

              {/* Alimenti */}
              {meal.foods.map((food,fi)=>(
                <div key={fi} style={{background:'#161616',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{food.food_name}</div>
                      <div style={{fontSize:10,color:'#888',marginTop:1}}>{food.kcal} kcal · P{food.protein_g}g · C{food.carbs_g}g · G{food.fat_g}g</div>
                    </div>
                    <input type="number" value={food.quantity_g} onChange={e=>updateFoodQty(selectedDay,mi,fi,e.target.value)}
                      style={{width:56,padding:'4px 6px',border:'0.5px solid #222',borderRadius:6,fontSize:12,textAlign:'center',color:'#F0F0F0',background:'#0D0D0D',outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:10,color:'#555',flexShrink:0}}>g</span>
                    <button onClick={()=>removeFood(selectedDay,mi,fi)} style={s.btnDanger}>✕</button>
                  </div>
                  {/* Metodo preparazione */}
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{fontSize:13}}>{PREP_ICONS[food.prep]||'🍽️'}</span>
                    <input value={food.prep||''} onChange={e=>updatePrep(selectedDay,mi,fi,e.target.value)}
                      placeholder="metodo preparazione (es. griglia, vapore...)"
                      style={{flex:1,padding:'3px 8px',border:'0.5px solid #1A1A1A',borderRadius:6,fontSize:10,color:'#888',background:'transparent',outline:'none',fontFamily:'inherit'}}/>
                  </div>
                </div>
              ))}

              {/* Totale pasto */}
              {meal.foods.length>0&&(
                <div style={{display:'flex',gap:10,fontSize:10,color:'#888',margin:'4px 0 8px',padding:'5px 8px',background:'#111',borderRadius:7}}>
                  <span style={{fontWeight:700,color:'#D4570A'}}>{Math.round(mt.kcal)} kcal</span>
                  <span>P {Math.round(mt.prot*10)/10}g</span>
                  <span>C {Math.round(mt.carbs*10)/10}g</span>
                  <span>G {Math.round(mt.fat*10)/10}g</span>
                  {pct>0&&<span style={{marginLeft:'auto',color:'#444'}}>{pct}% del giorno</span>}
                </div>
              )}

              {/* Note coach per il cliente */}
              <input value={mealNotes[nk]||''} onChange={e=>setMealNotes(p=>({...p,[nk]:e.target.value}))}
                placeholder="Note per il cliente..." style={{...s.input,fontSize:11,padding:'6px 10px',color:'#888',marginBottom:8}}/>

              {/* Azioni pasto */}
              {!selectMode&&(
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  <button onClick={()=>{setAddingTo({dayIdx:selectedDay,mealIdx:mi});setFoodSearch('');setFoodResults([])}} style={{...s.btn,fontSize:11,padding:'6px 11px'}}>
                    <i className="ti ti-plus" style={{fontSize:11}}/>Aggiungi alimento
                  </button>
                  <button onClick={()=>setShowTemplates({di:selectedDay,mi})} style={s.btnGray}>
                    <i className="ti ti-bookmark" style={{fontSize:11}}/>Template
                  </button>
                  {meal.foods.length>0&&(
                    <button onClick={()=>setSavingTpl({di:selectedDay,mi})} style={s.btnGray}>
                      <i className="ti ti-bookmark-plus" style={{fontSize:11}}/>Salva template
                    </button>
                  )}
                </div>
              )}

              {/* Salva template inline */}
              {savingTpl?.di===selectedDay&&savingTpl?.mi===mi&&(
                <div style={{marginTop:8,padding:'10px',background:'#111',borderRadius:8,border:'0.5px solid #222'}}>
                  <div style={{display:'flex',gap:6}}>
                    <input style={{...s.input,flex:1,fontSize:12}} value={tplName} onChange={e=>setTplName(e.target.value)}
                      placeholder="Nome template..." onKeyDown={e=>e.key==='Enter'&&saveTpl(selectedDay,mi)}/>
                    <button onClick={()=>saveTpl(selectedDay,mi)} style={s.btn}>Salva</button>
                    <button onClick={()=>{setSavingTpl(null);setTplName('')}} style={s.btnGray}>✕</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* AGGIUNGI PASTO */}
        <button onClick={()=>addMeal(selectedDay)} style={{...s.btn,width:'100%',justifyContent:'center',padding:'12px',marginBottom:24}}>
          <i className="ti ti-plus" style={{fontSize:15}}/>Aggiungi pasto — {DAY_NAMES[selectedDay]}
        </button>
      </div>

      {/* MODAL RICERCA ALIMENTI */}
      {addingTo&&(
        <div style={s.modal} onClick={e=>{if(e.target===e.currentTarget){setAddingTo(null);setFoodSearch('');setFoodResults([])}}}>
          <div style={{...s.modalBox}}>
            <div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>Aggiungi alimento</div>
                <button onClick={()=>{setAddingTo(null);setFoodSearch('');setFoodResults([])}} style={{...s.btnGray,padding:'3px 8px'}}>✕</button>
              </div>
              <div style={{display:'flex',gap:8}}>
                <input style={{...s.input,flex:1}} value={foodSearch} onChange={e=>searchFood(e.target.value)} placeholder="Cerca tra 1.054 alimenti..." autoFocus/>
                <input type="number" value={newQty} onChange={e=>setNewQty(e.target.value)} style={{...s.input,width:65,textAlign:'center'}} placeholder="g"/>
              </div>
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {foodSearch.length<2&&<div style={{padding:'30px 16px',textAlign:'center',color:'#444',fontSize:12}}>Digita almeno 2 lettere</div>}
              {foodSearch.length>=2&&foodResults.length===0&&<div style={{padding:'30px 16px',textAlign:'center',color:'#444',fontSize:12}}>Nessun risultato</div>}
              {foodResults.map((f,i)=>(
                <div key={i} onClick={()=>addFood(f)} style={{padding:'11px 16px',cursor:'pointer',borderBottom:'0.5px solid #111',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0'}}>{f.name}</div>
                    <div style={{fontSize:10,color:'#555'}}>{f.cat}{f.brand&&f.brand!=='—'?` · ${f.brand}`:''}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,marginLeft:12}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#D4570A'}}>{Math.round(f.kcal100*(parseFloat(newQty)||100)/100)} kcal</div>
                    <div style={{fontSize:9,color:'#555'}}>P{Math.round(f.p*(parseFloat(newQty)||100)/100)}g C{Math.round(f.c*(parseFloat(newQty)||100)/100)}g G{Math.round(f.g*(parseFloat(newQty)||100)/100)}g</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL TEMPLATE */}
      {showTemplates&&(
        <div style={s.modal}>
          <div style={{...s.modalBox}}>
            <div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>I tuoi template pasti</div>
              <button onClick={()=>setShowTemplates(null)} style={{...s.btnGray,padding:'3px 8px'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
              {templates.length===0?(
                <div style={{textAlign:'center',color:'#444',fontSize:12,padding:'20px 0'}}>Nessun template. Crea un pasto e salvalo!</div>
              ):templates.map(t=>(
                <div key={t.id} style={{background:'#161616',borderRadius:10,padding:'12px',marginBottom:8,border:'0.5px solid #222'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>{t.name}</div>
                      <div style={{fontSize:10,color:'#888'}}>{t.meal_type} · {t.foods.length} alimenti</div>
                    </div>
                    <div style={{display:'flex',gap:5}}>
                      <button onClick={()=>loadTpl(t,showTemplates.di,showTemplates.mi)} style={s.btn}>Usa</button>
                      <button onClick={()=>{const u=templates.filter(x=>x.id!==t.id);setTemplates(u);localStorage.setItem('fofit_meal_tpl',JSON.stringify(u))}} style={s.btnDanger}>✕</button>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:'#555'}}>{t.foods.slice(0,3).map(f=>f.food_name).join(', ')}{t.foods.length>3?'...':''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL COPIA PIANO */}
      {showCopyPlan&&(
        <div style={s.modal}>
          <div style={{...s.modalBox}}>
            <div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>Importa piano da altro cliente</div>
              <button onClick={()=>setShowCopyPlan(false)} style={{...s.btnGray,padding:'3px 8px'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
              {otherPlans.length===0?<div style={{textAlign:'center',color:'#444',fontSize:12,padding:'20px 0'}}>Nessun piano disponibile</div>:
                otherPlans.map(p=>(
                  <div key={p.id} style={{background:'#161616',borderRadius:10,padding:'12px',marginBottom:8,border:'0.5px solid #222',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0'}}>{p.name}</div>
                      <div style={{fontSize:10,color:'#888'}}>{p.profiles?.full_name}</div>
                    </div>
                    <button onClick={()=>importPlan(p.id)} style={s.btn}>Importa</button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW */}
      {showPreview&&(
        <div style={s.modal}>
          <div style={{...s.modalBox}}>
            <div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0'}}>Preview piano — riepilogo 7 giorni</div>
              <button onClick={()=>setShowPreview(false)} style={{...s.btnGray,padding:'3px 8px'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
              {DAY_NAMES.map((d,i)=>{
                const t=dayTotals(i);const target=dayCalories[i]||parseInt(kcalTarget)||0
                const diff=target?Math.round(t.kcal-target):0;const ok=Math.abs(diff)<=100
                return(
                  <div key={i} style={{background:'#161616',borderRadius:10,padding:'12px',marginBottom:8,border:`0.5px solid ${ok||!target?'#222':'rgba(226,75,74,0.3)'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:days[i].length?8:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>{d}</div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <span style={{fontSize:12,fontWeight:700,color:ok?'#3B8C5A':'#E24B4A'}}>{Math.round(t.kcal)} kcal</span>
                        {target>0&&<span style={{fontSize:10,color:ok?'#3B8C5A':'#E24B4A'}}>{diff>0?'+':''}{diff}</span>}
                        {!ok&&target>0&&(
                          <button onClick={()=>{adjustDay(i);toast(`${d} aggiustato`,'success')}} style={{...s.btnGray,fontSize:9,padding:'2px 7px',color:'#E8A020'}}>Aggiusta</button>
                        )}
                      </div>
                    </div>
                    {days[i].length>0&&(
                      <div style={{display:'flex',gap:12,fontSize:10,color:'#555'}}>
                        <span>P {Math.round(t.prot)}g</span>
                        <span>C {Math.round(t.carbs)}g</span>
                        <span>G {Math.round(t.fat)}g</span>
                        <span style={{marginLeft:'auto'}}>{days[i].length} pasti · {days[i].reduce((s,m)=>s+m.foods.length,0)} alimenti</span>
                      </div>
                    )}
                    {days[i].length===0&&<div style={{fontSize:11,color:'#444'}}>Nessun pasto inserito</div>}
                  </div>
                )
              })}
            </div>
            <div style={{padding:'12px 16px',borderTop:'0.5px solid #1A1A1A',flexShrink:0}}>
              <button onClick={savePlan} disabled={saving} style={{...s.btn,width:'100%',justifyContent:'center',padding:'12px'}}>
                <i className="ti ti-device-floppy" style={{fontSize:14}}/>{saving?'Salvo...':'Salva piano nel profilo cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AI */}
      {showAI&&(
        <div style={s.modal}>
          <div style={{...s.modalBox}}>
            <div style={{padding:'16px 20px 12px',borderBottom:'0.5px solid #1A1A1A',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <i className="ti ti-sparkles" style={{fontSize:16,color:'#C39BE0'}}/>
                  <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0'}}>Genera Piano con AI</div>
                </div>
                {!aiLoading&&<button onClick={()=>setShowAI(false)} style={{...s.btnGray,padding:'3px 8px'}}>✕</button>}
              </div>
              <div style={{fontSize:11,color:'#555',marginTop:3}}>Compila il profilo cliente per un piano personalizzato e professionale</div>
            </div>

            {!aiLoading?(
              <div style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>

                <Sec title="👤 Anagrafica e stile di vita" color="#4A90D4">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <Fld label="Età" id="ai_eta" placeholder={clientAnamnesi?.data_nascita?String(Math.floor((new Date()-new Date(clientAnamnesi.data_nascita))/(365.25*24*60*60*1000))):'es. 35'}/>
                    <Fld label="Sesso" id="ai_sesso" type="select" options={['—','Uomo','Donna']}/>
                    <Fld label="Peso (kg)" id="ai_peso" placeholder={clientAnamnesi?.peso_attuale||'es. 80'}/>
                    <Fld label="Altezza (cm)" id="ai_altezza" placeholder={clientAnamnesi?.altezza||'es. 175'}/>
                    <Fld label="Tipo di lavoro" id="ai_lavoro" type="select" options={['—','Sedentario (ufficio full time)','Ufficio part time','Smart working','Lavoro misto','Lavoro fisico leggero','Lavoro fisico intenso','Insegnante/formatore']}/>
                    <Fld label="Attività fisica" id="ai_attivita" type="select" options={['—','Nessuna','1-2 volte/settimana','3-4 volte/settimana','5+ volte/settimana','Atleta agonista']}/>
                    <Fld label="Stile di vita" id="ai_stil_vita" type="select" options={['—','Vita casalinga','Viaggia spesso per lavoro','Mangia spesso fuori','Portapranzo al lavoro','Vita molto dinamica']}/>
                    <Fld label="Orari pasti" id="ai_orari" placeholder="es. colazione 7:30, pranzo 13, cena 20"/>
                  </div>
                </Sec>

                <Sec title="🎯 Obiettivo e tipo di piano" color="#D4570A">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <Fld label="Obiettivo principale" id="ai_obiettivo" type="select" options={['—','Dimagrimento progressivo','Dimagrimento rapido','Ricomposizione corporea','Aumento massa muscolare','Mantenimento peso','Miglioramento prestazioni sportive','Dieta terapeutica/medica','Recupero post-infortunio']}/>
                    <Fld label="Obiettivo estetico" id="ai_ob_estetico" type="select" options={['—','Riduzione addome','Dimagrire cosce/glutei','Tonificazione generale','Sgonfiamento','Definizione muscolare']}/>
                    <Fld label="Variazione calorica" id="ai_variazione" type="select" options={['—','Deficit lieve -150 kcal','Deficit moderato -300 kcal','Deficit aggressivo -500 kcal','Mantenimento esatto','Surplus lieve +150 kcal','Surplus moderato +300 kcal','Surplus aggressivo +500 kcal']}/>
                    <Fld label="Peso obiettivo (kg)" id="ai_peso_ob" placeholder="es. 72"/>
                  </div>
                  <Fld label="Note obiettivo" id="ai_note_ob" placeholder="es. evento importante tra 3 mesi, ha difficoltà a seguire diete rigide..."/>
                </Sec>

                <Sec title="🍽️ Struttura e preferenze pasti" color="#3B8C5A">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <Fld label="Numero pasti/giorno" id="ai_num_pasti" type="select" options={['—','3 pasti','4 pasti','5 pasti','6 pasti']}/>
                    <Fld label="Stile cucina" id="ai_stile" type="select" options={['—','Italiana classica','Mediterranea','Internazionale varia','Vegana','Vegetariana','Low carb / Chetogenica','Paleo','Dieta zona']}/>
                    <Fld label="Budget settimanale" id="ai_budget" type="select" options={['—','Economico (spesa minima)','Medio','Ampio (ingredienti premium)']}/>
                    <Fld label="Meal prep" id="ai_meal_prep" type="select" options={['—','Cucina tutto domenica','Cucina 2-3 volte/settimana','Cucina ogni giorno','Solo pasti freddi/veloci']}/>
                    <Fld label="Tempo cottura" id="ai_tempo" type="select" options={['—','Minimo (max 10 min)','Breve (15-20 min)','Medio (30 min)','Nessun limite']}/>
                    <Fld label="Livello culinario" id="ai_livello" type="select" options={['—','Non sa cucinare','Base (pochi piatti semplici)','Intermedio','Esperto / Appassionato']}/>
                  </div>
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Pasti da includere</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {MEAL_TYPES.map(p=>(
                        <label key={p} style={{display:'flex',alignItems:'center',gap:5,background:'#161616',border:'0.5px solid #222',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontSize:11,color:'#CCC'}}>
                          <input type="checkbox" defaultChecked={['Colazione','Pranzo','Spuntino pomeriggio','Cena'].includes(p)}
                            onChange={e=>{const el=document.getElementById('ai_pasti_sel');const cur=el.value?el.value.split(',').filter(Boolean):[];el.value=e.target.checked?[...new Set([...cur,p])].join(','):cur.filter(x=>x!==p).join(',')}}/>
                          {p}
                        </label>
                      ))}
                    </div>
                    <input type="hidden" id="ai_pasti_sel" defaultValue="Colazione,Pranzo,Spuntino pomeriggio,Cena"/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <Fld label="Metodi cottura preferiti" id="ai_metodi" type="select" options={['—','Qualsiasi','Solo semplici (padella/forno)','Vapore e griglia','No frittura','Solo freddo/crudo']}/>
                    <Fld label="Attrezzatura" id="ai_attrez" type="select" options={['—','Cucina completa','Solo piano cottura','Microonde + piano cottura','Friggitrice ad aria','Solo fornellino (fuori casa)']}/>
                  </div>
                  <Fld label="Preferenze gustose / pasti sfizosi" id="ai_pref_pasti" placeholder="es. vuole colazioni varie e sfiziose, qualche dessert sano, non solo pollo e riso, ricette creative..."/>
                </Sec>

                <Sec title="⚠️ Salute, intolleranze e allergie" color="#E24B4A">
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                    {['Lattosio','Glutine (Celiachia)','Nichel','Istamina','Fruttosio','Uova','Arachidi','Frutta a guscio','Pesce','Crostacei','Soia','Sesamo','Sulfiti','Senape'].map(i=>(
                      <label key={i} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(226,75,74,0.06)',border:'0.5px solid rgba(226,75,74,0.15)',borderRadius:7,padding:'4px 8px',cursor:'pointer',fontSize:10,color:'#CCC'}}>
                        <input type="checkbox" defaultChecked={clientAnamnesi?.intolleranze_diagnosticate?.toLowerCase().includes(i.split(' ')[0].toLowerCase())||clientAnamnesi?.allergie_alimentari?.toLowerCase().includes(i.split(' ')[0].toLowerCase())}
                          onChange={e=>{const el=document.getElementById('ai_intolleranze');const cur=el.value?el.value.split(',').filter(Boolean):[];el.value=e.target.checked?[...cur,i].join(','):cur.filter(x=>x!==i).join(',')}}/>
                        {i}
                      </label>
                    ))}
                  </div>
                  <input type="hidden" id="ai_intolleranze" defaultValue={clientAnamnesi?.intolleranze_diagnosticate||''}/>
                  <Fld label="Patologie e condizioni" id="ai_patologie" placeholder={clientAnamnesi?.patologie_note||"es. diabete tipo 2, ipertensione, PCOS, ipotiroidismo, gastrite, colite, colesterolo alto, gotta..."}/>
                  <Fld label="Farmaci che influenzano la dieta" id="ai_farmaci" placeholder={clientAnamnesi?.farmaci||"es. Metformina, Levotiroxina, Cortisone, diuretici, anticoagulanti..."}/>
                </Sec>

                <Sec title="🥩 Preferenze alimentari" color="#E8A020">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div>
                      <div style={{fontSize:9,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Non mangia / evita</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {['Carne rossa','Maiale','Pollo','Pesce','Frutti di mare','Uova','Formaggi','Latte','Legumi','Verdure cotte','Frutta secca','Cibi piccanti'].map(a=>(
                          <label key={a} style={{display:'flex',alignItems:'center',gap:3,background:'#161616',border:'0.5px solid #222',borderRadius:6,padding:'3px 7px',cursor:'pointer',fontSize:10,color:'#CCC'}}>
                            <input type="checkbox" onChange={e=>{const el=document.getElementById('ai_non_mangia');const cur=el.value?el.value.split(',').filter(Boolean):[];el.value=e.target.checked?[...cur,a].join(','):cur.filter(x=>x!==a).join(',')}}/>
                            {a}
                          </label>
                        ))}
                      </div>
                      <input type="hidden" id="ai_non_mangia" defaultValue=""/>
                    </div>
                    <div>
                      <Fld label="Ama particolarmente" id="ai_ama" placeholder="es. pasta, pollo, yogurt, verdure grigliate, frutta, uova..."/>
                      <Fld label="Integratori già usati" id="ai_integr" placeholder="es. whey, creatina, vitamina D, omega 3, magnesio..."/>
                    </div>
                  </div>
                  <Fld label="Altre note alimentari" id="ai_altre_note" placeholder="es. non fa colazione, mangia fuori a pranzo 3 volte/settimana, ha poco tempo la mattina, digita da casa..."/>
                </Sec>

                <Sec title="📝 Note extra del coach" color="#9B59B6">
                  <Fld id="ai_note_extra" rows={3} placeholder="Qualsiasi altra indicazione: timing pasti rispetto allenamento, gestione pasti fuori casa, obiettivi specifici settimanali, note sulla compliance del cliente, note da sessione precedente..."/>
                </Sec>

              </div>
            ):(
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32}}>
                <i className="ti ti-sparkles" style={{fontSize:36,color:'#C39BE0',marginBottom:16}}/>
                <div style={{fontSize:14,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>{aiStatus}</div>
                <div style={{fontSize:11,color:'#555',marginBottom:24}}>Piano alimentare personalizzato in corso...</div>
                <div style={{width:'100%',maxWidth:320}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{fontSize:11,color:'#888'}}>{aiStatus}</div>
                    <div style={{fontSize:12,fontWeight:800,color:'#C39BE0'}}>{aiProgress}%</div>
                  </div>
                  <div style={{height:8,background:'#1A1A1A',borderRadius:8,overflow:'hidden'}}>
                    <div style={{height:8,borderRadius:8,background:'linear-gradient(90deg,#7C3AED,#C39BE0)',width:`${aiProgress}%`,transition:'width 0.4s ease'}}/>
                  </div>
                  <div style={{fontSize:10,color:'#444',marginTop:8,textAlign:'center'}}>Generando 7 giorni uno alla volta per massima qualità...</div>
                </div>
              </div>
            )}

            {!aiLoading&&(
              <div style={{padding:'12px 20px',borderTop:'0.5px solid #1A1A1A',flexShrink:0}}>
                {kcalTarget&&(
                  <div style={{fontSize:10,color:'#555',marginBottom:8,textAlign:'center'}}>
                    Target: {kcalTarget} kcal · {currentDiet?.label} · P{protTarget}g C{carbsTarget}g G{fatTarget}g
                  </div>
                )}
                <button onClick={generateWithAI} style={{...s.btn,width:'100%',justifyContent:'center',padding:'13px',background:'rgba(155,89,182,0.85)',fontSize:14}}>
                  <i className="ti ti-sparkles" style={{fontSize:15}}/>
                  Genera settimana completa
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
