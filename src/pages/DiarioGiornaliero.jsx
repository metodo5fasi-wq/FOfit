import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { searchFoods } from '../lib/foodDatabase'
import { Toast } from '../components/Animations'

const MEAL_SLOTS = ['Colazione','Spuntino','Pranzo','Pre-workout','Cena','Merenda']
const MEAL_ICONS = { Colazione:'ti-sun', Spuntino:'ti-apple', Pranzo:'ti-tools-kitchen-2', 'Pre-workout':'ti-bolt', Cena:'ti-moon', Merenda:'ti-coffee' }

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px 18px' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'14px 16px', marginBottom:10, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 },
  tag: { fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:500 },
}

export default function DiarioGiornaliero() {
  const { profile } = useAuth()
  const [diary, setDiary] = useState({})
  const [plan, setPlan] = useState(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  const [qty, setQty] = useState(100)
  const [selectedMeal, setSelectedMeal] = useState('Colazione')
  const [loading, setLoading] = useState(true)
  const [water, setWater] = useState(0)
  const [waterGoal, setWaterGoal] = useState(() => parseInt(localStorage.getItem('fofit_water_goal')) || 8)
  const [editingWaterGoal, setEditingWaterGoal] = useState(false)
  const [waterGoalInput, setWaterGoalInput] = useState(waterGoal)
  const [activeTab, setActiveTab] = useState('pasti')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [toast, setToast] = useState({ visible: false, message: '', emoji: '' })

  function showToast(message, emoji) {
    setToast({ visible: true, message, emoji })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000)
  }

  function saveWaterGoal() {
    const val = Math.max(1, Math.min(20, parseInt(waterGoalInput) || 8))
    setWaterGoal(val)
    localStorage.setItem('fofit_water_goal', val)
    setEditingWaterGoal(false)
  }
  const searchTimeout = useRef(null)
  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today

  useEffect(() => { if (profile) { fetchDiary(); fetchPlan() } }, [profile])
  useEffect(() => { if (profile) fetchDiary() }, [selectedDate])

  async function fetchPlan() {
    const { data } = await supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()
    if (data) setPlan(data)
  }

  async function fetchDiary() {
    setLoading(true)
    const { data } = await supabase.from('diary_entries').select('*')
      .eq('client_id', profile.id).eq('entry_date', selectedDate).order('created_at')
    const byMeal = {}
    MEAL_SLOTS.forEach(m => byMeal[m] = [])
    ;(data || []).forEach(e => {
      const meal = MEAL_SLOTS.find(m => m.toLowerCase() === e.meal_type?.toLowerCase()) || 'Colazione'
      byMeal[meal] = [...(byMeal[meal] || []), e]
    })
    setDiary(byMeal)
    setLoading(false)
  }

  function handleSearch(val) {
    setSearch(val)
    if (val.length < 2) { setResults([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setResults(searchFoods(val))
    }, 150)
  }

  function selectFood(food) {
    setSelectedFood(food)
    setResults([])
    setSearch('')
    setQty(100)
  }

  async function addFood() {
    if (!selectedFood) return
    const ratio = qty / 100
    await supabase.from('diary_entries').insert({
      client_id: profile.id,
      entry_date: selectedDate,
      meal_type: selectedMeal.toLowerCase(),
      food_name: selectedFood.name,
      brand: selectedFood.brand,
      quantity_g: qty,
      kcal: Math.round(selectedFood.kcal100 * ratio),
      protein_g: Math.round(selectedFood.p * ratio),
      carbs_g: Math.round(selectedFood.c * ratio),
      fat_g: Math.round(selectedFood.g * ratio),
    })
    setSelectedFood(null)
    setQty(100)
    if (window.innerWidth < 768) setActiveTab('pasti')
    showToast(`${selectedFood.name} aggiunto!`, '✅')
    fetchDiary()
  }

  async function removeFood(id) {
    await supabase.from('diary_entries').delete().eq('id', id)
    fetchDiary()
  }

  async function clearAll() {
    if (!window.confirm('Vuoi azzerare tutto il diario di oggi?')) return
    await supabase.from('diary_entries').delete()
      .eq('client_id', profile.id).eq('entry_date', selectedDate)
    setDiary(Object.fromEntries(MEAL_SLOTS.map(m => [m, []])))
  }

  const allEntries = Object.values(diary).flat()
  const totKcal = Math.round(allEntries.reduce((s, e) => s + (e.kcal || 0), 0))
  const totP = Math.round(allEntries.reduce((s, e) => s + (e.protein_g || 0), 0))
  const totC = Math.round(allEntries.reduce((s, e) => s + (e.carbs_g || 0), 0))
  const totG = Math.round(allEntries.reduce((s, e) => s + (e.fat_g || 0), 0))
  const target = {
    kcal: plan?.kcal_target || 2200,
    p: plan?.protein_target_g || 150,
    c: plan?.carbs_target_g || 220,
    g: plan?.fat_target_g || 70
  }
  const pct = Math.min(100, Math.round(totKcal / target.kcal * 100))
  const remaining = Math.max(0, target.kcal - totKcal)

  return (
    <>
      <Toast message={toast.message} emoji={toast.emoji} visible={toast.visible}/>
      <div style={s.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {/* Navigazione date */}
          <button onClick={()=>{
            const d = new Date(selectedDate)
            d.setDate(d.getDate()-1)
            setSelectedDate(d.toISOString().split('T')[0])
          }} style={{background:'none',border:'none',cursor:'pointer',color:'#888780',padding:4,display:'flex',alignItems:'center'}}>
            <i className="ti ti-chevron-left" style={{fontSize:18}}/>
          </button>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:14,fontWeight:600,color:'#111'}}>
              {isToday ? 'Oggi' : new Date(selectedDate+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}
            </div>
            {!isToday && (
              <button onClick={()=>setSelectedDate(today)}
                style={{fontSize:10,color:'#D4570A',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:500,padding:0}}>
                Torna a oggi
              </button>
            )}
          </div>
          <button onClick={()=>{
            const d = new Date(selectedDate)
            d.setDate(d.getDate()+1)
            const next = d.toISOString().split('T')[0]
            if (next <= today) setSelectedDate(next)
          }} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center',
            color: selectedDate >= today ? '#E0DDD6' : '#888780'}}>
            <i className="ti ti-chevron-right" style={{fontSize:18}}/>
          </button>
        </div>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {totKcal > 0 && isToday && (
            <button onClick={clearAll} style={{background:'#FEE2E2',color:'#E24B4A',border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
              <i className="ti ti-trash" style={{fontSize:13}}/>Azzera
            </button>
          )}
          <span style={{background:'#FEF0E7',color:'#D4570A',fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:500}}>
            {isToday ? `${remaining} kcal rimanenti` : `${totKcal} kcal`}
          </span>
        </div>
      </div>

      <div style={s.page}>

        {/* RIEPILOGO CALORIE */}
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
            <span style={{fontSize:24,fontWeight:700,color:'#111'}}>{totKcal.toLocaleString('it-IT')}<span style={{fontSize:13,color:'#888780',fontWeight:400}}> kcal</span></span>
            <span style={{fontSize:13,color:pct>100?'#E24B4A':'#D4570A',fontWeight:600}}>{pct}% del target</span>
          </div>
          <div style={{height:8,background:'#F5F3EF',borderRadius:4,marginBottom:12,overflow:'hidden'}}>
            <div style={{height:8,borderRadius:4,background:pct>100?'#E24B4A':'linear-gradient(90deg,#D4570A,#F4894A)',width:`${pct}%`,transition:'width 0.4s'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[{l:'Proteine',v:totP,t:target.p,c:'#D4570A'},{l:'Carboidrati',v:totC,t:target.c,c:'#F4894A'},{l:'Grassi',v:totG,t:target.g,c:'#FAC775'}].map(m=>(
              <div key={m.l}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                  <span style={{color:'#888780'}}>{m.l}</span>
                  <span style={{fontWeight:600,color:'#111'}}>{m.v}g</span>
                </div>
                <div style={{height:4,background:'#F5F3EF',borderRadius:2}}>
                  <div style={{height:4,borderRadius:2,background:m.c,width:`${Math.min(100,Math.round(m.v/m.t*100))}%`,transition:'width 0.4s'}}/>
                </div>
                <div style={{fontSize:10,color:'#888780',marginTop:2}}>di {m.t}g</div>
              </div>
            ))}
          </div>
        </div>

        {/* TAB MOBILE */}
        {window.innerWidth < 768 && isToday && (
          <div style={{display:'flex',gap:0,marginBottom:12,background:'white',borderRadius:12,padding:4,border:'0.5px solid #E0DDD6'}}>
            {[{id:'pasti',label:'🍽 Pasti'},{id:'cerca',label:'🔍 Aggiungi'}].map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                style={{flex:1,padding:'9px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'inherit',
                  fontSize:13,fontWeight:600,transition:'all 0.15s',
                  background:activeTab===tab.id?'#D4570A':'transparent',
                  color:activeTab===tab.id?'white':'#888780'}}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div style={{display: window.innerWidth < 768 ? 'block' : 'grid', gridTemplateColumns:'1.2fr 1fr', gap:12}}>

          {/* PASTI */}
          <div style={{display: window.innerWidth < 768 && activeTab !== 'pasti' ? 'none' : 'block'}}>
            {MEAL_SLOTS.map(meal => {
              const foods = diary[meal] || []
              const mealKcal = Math.round(foods.reduce((s,e) => s+(e.kcal||0), 0))
              return (
                <div key={meal} style={s.card}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:foods.length?10:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:7,background:'#FEF0E7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <i className={`ti ${MEAL_ICONS[meal]||'ti-circle'}`} style={{fontSize:14,color:'#D4570A'}}/>
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{meal}</div>
                    </div>
                    {mealKcal > 0 && <span style={{fontSize:11,color:'#D4570A',fontWeight:600}}>{mealKcal} kcal</span>}
                  </div>
                  {foods.length === 0 ? (
                    <div style={{fontSize:11,color:'#E0DDD6',paddingTop:4}}>Nessun alimento</div>
                  ) : foods.map(f => (
                    <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid #F5F3EF'}}>
                      <div style={{width:5,height:5,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.food_name}</div>
                        <div style={{fontSize:10,color:'#888780'}}>{f.quantity_g}g · P{f.protein_g} C{f.carbs_g} G{f.fat_g}</div>
                      </div>
                      <div style={{fontSize:11,color:'#D4570A',fontWeight:600,flexShrink:0}}>{f.kcal}</div>
                      <button onClick={()=>removeFood(f.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontSize:14,padding:0,flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* CERCA E AGGIUNGI — solo per oggi */}
          <div style={{position: window.innerWidth < 768 ? 'static' : 'sticky', top:0, display: (window.innerWidth < 768 && activeTab !== 'cerca') || !isToday ? 'none' : 'block'}}>
            <div style={s.card}>
              <div style={{fontSize:13,fontWeight:600,color:'#111',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
                <i className="ti ti-search" style={{fontSize:14,color:'#D4570A'}}/>
                Aggiungi alimento
              </div>

              {/* Seleziona pasto */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'#888780',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Aggiungi a</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {MEAL_SLOTS.map(m=>(
                    <button key={m} onClick={()=>setSelectedMeal(m)}
                      style={{padding:'4px 9px',borderRadius:12,fontSize:11,fontWeight:500,cursor:'pointer',border:'0.5px solid',
                        background:selectedMeal===m?'#D4570A':'white',
                        color:selectedMeal===m?'white':'#888780',
                        borderColor:selectedMeal===m?'#D4570A':'#E0DDD6'}}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#F5F3EF',border:'0.5px solid #E0DDD6',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
                <i className="ti ti-search" style={{fontSize:13,color:'#888780'}}/>
                <input style={{border:'none',background:'transparent',outline:'none',fontSize:13,color:'#111',width:'100%',fontFamily:'inherit'}}
                  placeholder="Cerca alimento..." value={search} onChange={e=>handleSearch(e.target.value)}/>
              </div>

              {results.length > 0 && (
                <div style={{maxHeight:200,overflowY:'auto',marginBottom:8}}>
                  {results.map((f,i)=>(
                    <div key={i} onClick={()=>selectFood(f)}
                      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:2,background:'#F5F3EF'}}>
                      <div>
                        <div style={{fontSize:12,color:'#111',fontWeight:500}}>{f.name}</div>
                        <div style={{fontSize:10,color:'#888780'}}>{f.brand} · P{f.p} C{f.c} G{f.g}/100g</div>
                      </div>
                      <div style={{fontSize:11,color:'#D4570A',fontWeight:600}}>{f.kcal100}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedFood && (
                <div style={{background:'#FEF0E7',borderRadius:8,padding:'12px',marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#D4570A',marginBottom:8}}>{selectedFood.name}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <input type="number" value={qty} onChange={e=>setQty(parseFloat(e.target.value)||100)} min={1}
                      style={{...s.input,width:75,textAlign:'center'}}/>
                    <span style={{fontSize:12,color:'#888780'}}>g</span>
                    <span style={{fontSize:13,color:'#D4570A',fontWeight:700,marginLeft:'auto'}}>
                      {Math.round(selectedFood.kcal100*qty/100)} kcal
                    </span>
                  </div>
                  <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
                    <span style={{...s.tag,background:'white',color:'#D4570A'}}>P {Math.round(selectedFood.p*qty/100)}g</span>
                    <span style={{...s.tag,background:'white',color:'#F4894A'}}>C {Math.round(selectedFood.c*qty/100)}g</span>
                    <span style={{...s.tag,background:'white',color:'#888780'}}>G {Math.round(selectedFood.g*qty/100)}g</span>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button style={s.btn} onClick={addFood}>
                      <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi
                    </button>
                    <button onClick={()=>setSelectedFood(null)}
                      style={{padding:'8px 12px',background:'white',border:'0.5px solid #E0DDD6',borderRadius:8,fontSize:12,cursor:'pointer',color:'#888780',fontFamily:'inherit'}}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid #F5F3EF'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.06em'}}>Idratazione</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{fontSize:11,color:'#D4570A',fontWeight:600}}>{water * 250}ml / {waterGoal * 250}ml</div>
                    <button onClick={()=>{ setWaterGoalInput(waterGoal); setEditingWaterGoal(!editingWaterGoal) }}
                      style={{background:'none',border:'none',cursor:'pointer',color:'#888780',padding:0}}>
                      <i className="ti ti-settings" style={{fontSize:13}}/>
                    </button>
                  </div>
                </div>

                {editingWaterGoal && (
                  <div style={{marginBottom:10,background:'#F5F3EF',borderRadius:10,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:'#888780',marginBottom:8}}>Quanti bicchieri vuoi bere al giorno?</div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button onClick={()=>setWaterGoalInput(Math.max(1, waterGoalInput-1))}
                        style={{width:32,height:32,borderRadius:8,background:'white',border:'0.5px solid #E0DDD6',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>−</button>
                      <div style={{flex:1,textAlign:'center'}}>
                        <div style={{fontSize:22,fontWeight:700,color:'#111'}}>{waterGoalInput}</div>
                        <div style={{fontSize:10,color:'#888780'}}>{waterGoalInput * 250}ml totali</div>
                      </div>
                      <button onClick={()=>setWaterGoalInput(Math.min(20, waterGoalInput+1))}
                        style={{width:32,height:32,borderRadius:8,background:'white',border:'0.5px solid #E0DDD6',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>+</button>
                    </div>
                    <button onClick={saveWaterGoal}
                      style={{width:'100%',marginTop:10,background:'#D4570A',color:'white',border:'none',borderRadius:8,padding:'8px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                      Salva obiettivo
                    </button>
                  </div>
                )}

                <div style={{display:'flex',gap:3,marginBottom:5}}>
                  {Array.from({length:waterGoal}).map((_,i)=>(
                    <div key={i} onClick={()=>setWater(i < water ? i : i+1)}
                      style={{flex:1,height:8,borderRadius:2,cursor:'pointer',
                        background:i<water?'#D4570A':'#F5F3EF',
                        transition:'background 0.15s'}}/>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:10,color:'#888780'}}>{water}/{waterGoal} bicchieri</div>
                  {water > 0 && (
                    <button onClick={()=>setWater(0)} style={{fontSize:10,color:'#888780',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>reset</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`* { box-sizing: border-box; }`}</style>
    </>
  )
}
