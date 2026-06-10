import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

import { searchFoods } from '../lib/foodDatabase'
const LOCAL_DB = [
  { name:'Fiocchi d\'avena', brand:'Quaker', kcal100:375, p:13, c:62, g:7 },
  { name:'Yogurt greco 0%', brand:'Fage', kcal100:57, p:10, c:4, g:0 },
  { name:'Petto di pollo', brand:'—', kcal100:108, p:22, c:0, g:2 },
  { name:'Riso basmati', brand:'Scotti', kcal100:354, p:7, c:78, g:1 },
  { name:'Pasta di semola', brand:'Barilla', kcal100:352, p:12, c:71, g:2 },
  { name:'Pane integrale', brand:'Mulino Bianco', kcal100:242, p:9, c:43, g:4 },
  { name:'Tonno al naturale', brand:'Rio Mare', kcal100:103, p:24, c:0, g:1 },
  { name:'Salmone fresco', brand:'—', kcal100:208, p:20, c:0, g:14 },
  { name:'Uova intere', brand:'—', kcal100:155, p:13, c:1, g:11 },
  { name:'Albume d\'uovo', brand:'—', kcal100:52, p:11, c:1, g:0 },
  { name:'Latte parz. scremato', brand:'Granarolo', kcal100:46, p:3, c:5, g:2 },
  { name:'Banana', brand:'—', kcal100:89, p:1, c:23, g:0 },
  { name:'Mela', brand:'—', kcal100:52, p:0, c:14, g:0 },
  { name:'Patate dolci', brand:'—', kcal100:86, p:2, c:20, g:0 },
  { name:'Olio EVO', brand:'Monini', kcal100:899, p:0, c:0, g:100 },
  { name:'Whey protein', brand:'Myprotein', kcal100:396, p:74, c:9, g:7 },
  { name:'Bresaola', brand:'Negroni', kcal100:151, p:32, c:0, g:2 },
  { name:'Mandorle', brand:'Noberasco', kcal100:579, p:21, c:9, g:50 },
  { name:'Ricotta light', brand:'Galbani', kcal100:105, p:9, c:4, g:6 },
  { name:'Spinaci', brand:'—', kcal100:23, p:3, c:4, g:0 },
  { name:'Broccoli', brand:'—', kcal100:34, p:3, c:7, g:0 },
  { name:'Zucchine', brand:'—', kcal100:17, p:1, c:3, g:0 },
  { name:'Verdure miste', brand:'—', kcal100:25, p:2, c:5, g:0 },
  { name:'Burro di arachidi', brand:'Whole Earth', kcal100:598, p:25, c:15, g:51 },
  { name:'Miele', brand:'Mielizia', kcal100:304, p:0, c:82, g:0 },
]

const MEAL_SLOTS = ['Colazione','Spuntino','Pranzo','Pre-workout','Cena']
const TARGET = { kcal:2200, p:180, c:240, g:70 }

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'14px 16px', marginBottom:12 },
  badge: { background:'#FEF0E7', color:'#D4570A', fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  two: { display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:12 },
  input: { width:'100%', padding:'8px 11px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
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
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (profile) { fetchDiary(); fetchPlan() } }, [profile])

  async function fetchPlan() {
    const { data } = await supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()
    if (data) setPlan(data)
  }

  async function fetchDiary() {
    setLoading(true)
    const { data } = await supabase.from('diary_entries').select('*')
      .eq('client_id', profile.id).eq('entry_date', today).order('created_at')
    const byMeal = {}
    MEAL_SLOTS.forEach(m => byMeal[m] = [])
    ;(data || []).forEach(e => {
      const meal = MEAL_SLOTS.find(m => m.toLowerCase() === e.meal_type?.toLowerCase()) || 'Colazione'
      byMeal[meal] = [...(byMeal[meal] || []), e]
    })
    setDiary(byMeal)
    setLoading(false)
  }

  const searchTimeout = useRef(null)
  const [searching, setSearching] = useState(false)

 function handleSearch(val) {
  setSearch(val)
  if (val.length < 2) { setResults([]); return }
  clearTimeout(searchTimeout.current)
  searchTimeout.current = setTimeout(() => {
    setResults(searchFoods(val))
  }, 150)
}

    // Risultati locali immediati
    const q = val.toLowerCase()
    const local = LOCAL_DB.filter(f => f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q))
    setResults(local)

    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search-food?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        if (data.foods?.length > 0) {
          const combined = [...local]
          data.foods.forEach(f => {
            if (!combined.find(c => c.name.toLowerCase() === f.name.toLowerCase() && c.brand === f.brand)) {
              combined.push(f)
            }
          })
          setResults(combined.slice(0, 25))
        }
      } catch(e) {}
      setSearching(false)
    }, 500)
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
    const entry = {
      client_id: profile.id,
      entry_date: today,
      meal_type: selectedMeal.toLowerCase(),
      food_name: selectedFood.name,
      brand: selectedFood.brand,
      quantity_g: qty,
      kcal: Math.round(selectedFood.kcal100 * ratio),
      protein_g: Math.round(selectedFood.p * ratio),
      carbs_g: Math.round(selectedFood.c * ratio),
      fat_g: Math.round(selectedFood.g * ratio),
    }
    await supabase.from('diary_entries').insert(entry)
    setSelectedFood(null)
    setQty(100)
    fetchDiary()
  }

  async function removeFood(id) {
    await supabase.from('diary_entries').delete().eq('id', id)
    fetchDiary()
  }

  const allEntries = Object.values(diary).flat()
  const totKcal = Math.round(allEntries.reduce((s, e) => s + (e.kcal || 0), 0))
  const totP = Math.round(allEntries.reduce((s, e) => s + (e.protein_g || 0), 0))
  const totC = Math.round(allEntries.reduce((s, e) => s + (e.carbs_g || 0), 0))
  const totG = Math.round(allEntries.reduce((s, e) => s + (e.fat_g || 0), 0))
  const target = { kcal: plan?.kcal_target || TARGET.kcal, p: plan?.protein_target_g || TARGET.p, c: plan?.carbs_target_g || TARGET.c, g: plan?.fat_target_g || TARGET.g }
  const pct = Math.min(100, Math.round(totKcal / target.kcal * 100))
  const remaining = Math.max(0, target.kcal - totKcal)

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Diario giornaliero</div>
          <div style={{fontSize:12,color:'#888780'}}>{new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</div>
        </div>
        <span style={s.badge}>{remaining} kcal rimanenti</span>
      </div>

      <div style={s.page}>

        {/* BARRA CALORIE */}
        <div style={{...s.card, marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
            <span style={{fontSize:22,fontWeight:500,color:'#111'}}>{totKcal.toLocaleString('it-IT')}<span style={{fontSize:13,color:'#888780',fontWeight:400}}> / {target.kcal.toLocaleString('it-IT')} kcal</span></span>
            <span style={{fontSize:13,color:'#D4570A',fontWeight:500}}>{pct}%</span>
          </div>
          <div style={{height:8,background:'#F5F3EF',borderRadius:4,marginBottom:12}}>
            <div style={{height:8,borderRadius:4,background:pct>100?'#E24B4A':'#D4570A',width:`${pct}%`,transition:'width 0.3s'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[{l:'Proteine',v:totP,t:target.p,c:'#D4570A'},{l:'Carboidrati',v:totC,t:target.c,c:'#F4894A'},{l:'Grassi',v:totG,t:target.g,c:'#FAC775'}].map(m=>(
              <div key={m.l}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'#888780'}}>{m.l}</span>
                  <span style={{fontWeight:500,color:'#111'}}>{m.v}g</span>
                </div>
                <div style={{height:4,background:'#F5F3EF',borderRadius:2}}>
                  <div style={{height:4,borderRadius:2,background:m.c,width:`${Math.min(100,Math.round(m.v/m.t*100))}%`}}/>
                </div>
                <div style={{fontSize:10,color:'#888780',marginTop:2}}>di {m.t}g</div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.two}>
          {/* PASTI */}
          <div>
            {MEAL_SLOTS.map(meal => {
              const foods = diary[meal] || []
              const mealKcal = Math.round(foods.reduce((s,e) => s+(e.kcal||0), 0))
              return (
                <div key={meal} style={s.card}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{fontSize:13,fontWeight:500,color:'#111'}}>{meal}</div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {mealKcal>0 && <span style={{fontSize:11,color:'#D4570A',fontWeight:500}}>{mealKcal} kcal</span>}
                      <button style={{...s.btn,padding:'4px 10px',fontSize:11}} onClick={()=>setSelectedMeal(meal)}>+ aggiungi</button>
                    </div>
                  </div>
                  {foods.length===0 ? (
                    <div style={{fontSize:12,color:'#E0DDD6',padding:'4px 0'}}>Nessun alimento registrato</div>
                  ) : foods.map(f=>(
                    <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid #F5F3EF'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,color:'#111'}}>{f.food_name} <span style={{fontSize:11,color:'#888780'}}>{f.brand!=='—'?f.brand:''}</span></div>
                        <div style={{fontSize:11,color:'#888780'}}>{f.quantity_g}g · P{f.protein_g}g C{f.carbs_g}g G{f.fat_g}g</div>
                      </div>
                      <div style={{fontSize:12,color:'#D4570A',fontWeight:500}}>{f.kcal} kcal</div>
                      <button onClick={()=>removeFood(f.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontSize:14,padding:0}}>✕</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* CERCA E AGGIUNGI */}
          <div style={{position:'sticky',top:0}}>
            <div style={s.card}>
              <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
                <i className="ti ti-search" style={{fontSize:15,color:'#D4570A'}}/>
                Cerca alimento
              </div>

              {/* Seleziona pasto */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#888780',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Aggiungi a</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {MEAL_SLOTS.map(m=>(
                    <button key={m} onClick={()=>setSelectedMeal(m)}
                      style={{padding:'4px 10px',borderRadius:12,fontSize:11,fontWeight:500,cursor:'pointer',border:'0.5px solid',
                        background:selectedMeal===m?'#D4570A':'white',
                        color:selectedMeal===m?'white':'#888780',
                        borderColor:selectedMeal===m?'#D4570A':'#E0DDD6'}}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input */}
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#F5F3EF',border:'0.5px solid #E0DDD6',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
                <i className="ti ti-search" style={{fontSize:14,color:'#888780'}}/>
                <input style={{border:'none',background:'transparent',outline:'none',fontSize:13,color:'#111',width:'100%',fontFamily:'inherit'}}
                  placeholder="Cerca tra milioni di prodotti..." value={search} onChange={e=>handleSearch(e.target.value)}/>
                {searching && <div style={{width:14,height:14,border:'2px solid #E0DDD6',borderTopColor:'#D4570A',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}/>}
              </div>

              {/* Risultati ricerca */}
              {results.length > 0 && (
                <div style={{maxHeight:180,overflowY:'auto',marginBottom:8}}>
                  {results.map((f,i)=>(
                    <div key={i} onClick={()=>selectFood(f)}
                      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:3,background:'#F5F3EF'}}>
                      <div>
                        <div style={{fontSize:13,color:'#111',fontWeight:500}}>{f.name}</div>
                        <div style={{fontSize:11,color:'#888780'}}>{f.brand} · P{f.p}g C{f.c}g G{f.g}g /100g</div>
                      </div>
                      <div style={{fontSize:12,color:'#D4570A',fontWeight:500}}>{f.kcal100} kcal</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Alimento selezionato */}
              {selectedFood && (
                <div style={{background:'#FEF0E7',borderRadius:8,padding:'12px',marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:'#D4570A',marginBottom:8}}>{selectedFood.name} ({selectedFood.brand})</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <input type="number" value={qty} onChange={e=>setQty(parseFloat(e.target.value)||100)} min={1}
                      style={{...s.input,width:80,textAlign:'center'}}/>
                    <span style={{fontSize:13,color:'#888780'}}>grammi</span>
                    <span style={{fontSize:13,color:'#D4570A',fontWeight:500,marginLeft:'auto'}}>
                      {Math.round(selectedFood.kcal100*qty/100)} kcal
                    </span>
                  </div>
                  <div style={{display:'flex',gap:4,marginBottom:10,flexWrap:'wrap'}}>
                    <span style={{...s.tag,background:'white',color:'#D4570A'}}>P {Math.round(selectedFood.p*qty/100)}g</span>
                    <span style={{...s.tag,background:'white',color:'#F4894A'}}>C {Math.round(selectedFood.c*qty/100)}g</span>
                    <span style={{...s.tag,background:'white',color:'#888780'}}>G {Math.round(selectedFood.g*qty/100)}g</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={{...s.btn,flex:1,justifyContent:'center',display:'flex',alignItems:'center',gap:5}} onClick={addFood}>
                      <i className="ti ti-plus" style={{fontSize:13}}/> Aggiungi
                    </button>
                    <button onClick={()=>setSelectedFood(null)}
                      style={{padding:'7px 12px',background:'white',border:'0.5px solid #E0DDD6',borderRadius:7,fontSize:12,cursor:'pointer',color:'#888780',fontFamily:'inherit'}}>
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {/* Idratazione */}
              <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid #F5F3EF'}}>
                <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Idratazione</div>
                <div style={{display:'flex',gap:4}}>
                  {[250,250,250,250,250,250,250,250].map((_,i)=>(
                    <div key={i} style={{flex:1,height:7,borderRadius:2,background:i<4?'#D4570A':'#F5F3EF'}}/>
                  ))}
                </div>
                <div style={{fontSize:11,color:'#888780',marginTop:4}}>1.0L di 2L</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
