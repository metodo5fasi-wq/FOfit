import React, { useState, useEffect, useRef } from 'react'
import { askConfirm } from '../lib/confirm'
import { done } from '../lib/toast'
import { localDateStr, addDaysStr } from '../lib/dates'
import { dbSave } from '../lib/db'
import { loadSWR, hasCache, cachePruneDated } from '../lib/offline'
import { StaleNotice, Skeleton } from '../components/LoadStates'
import { useRefreshOnReturn } from '../lib/useRefreshOnReturn'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { searchFoods } from '../lib/foodDatabase'
import { Toast } from '../components/Animations'

const MEAL_SLOTS = ['Colazione','Spuntino','Pranzo','Pre-workout','Cena','Merenda']
const MEAL_ICONS = { Colazione:'ti-sun', Spuntino:'ti-apple', Pranzo:'ti-tools-kitchen-2', 'Pre-workout':'ti-bolt', Cena:'ti-moon', Merenda:'ti-coffee' }

const s = {
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px 18px' },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', padding:'14px 16px', marginBottom:10, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #1C1C1C', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
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
  const [stale, setStale] = useState(false)
  const [water, setWater] = useState(0)          // bicchieri (250 ml) del giorno selezionato; si salvano sul telefono
  const [waterGoal, setWaterGoal] = useState(() => parseInt(localStorage.getItem('fofit_water_goal')) || 8)
  const [editingWaterGoal, setEditingWaterGoal] = useState(false)
  const [waterGoalInput, setWaterGoalInput] = useState(waterGoal)
  const [activeTab, setActiveTab] = useState('pasti')
  const [selectedDate, setSelectedDate] = useState(localDateStr())
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
    done('Obiettivo acqua salvato')
  }
  const searchTimeout = useRef(null)
  const today = localDateStr()
  const isToday = selectedDate === today

  // Acqua: salvata sul telefono per giorno (prima si azzerava a ogni ricarica). Si tengono 45 giorni.
  const waterKey = profile ? `fofit_water_${profile.id}_${selectedDate}` : null
  useEffect(() => {
    if (!waterKey) return
    try { setWater(parseInt(localStorage.getItem(waterKey)) || 0) } catch { setWater(0) }
  }, [waterKey])
  useEffect(() => {
    if (!profile) return
    try {
      const limit = addDaysStr(localDateStr(), -45), pre = `fofit_water_${profile.id}_`
      Object.keys(localStorage).filter(k => k.startsWith(pre) && k.slice(pre.length) < limit).forEach(k => localStorage.removeItem(k))
    } catch {}
  }, [profile?.id])
  function setWaterSaved(n) {
    setWater(n)
    try { if (n > 0) localStorage.setItem(waterKey, String(n)); else localStorage.removeItem(waterKey) } catch {}
    done(n > 0 ? `💧 ${n}/${waterGoal} bicchieri` : 'Acqua azzerata')
  }

  useEffect(() => { if (profile) fetchPlan() }, [profile])
  // un'unica lettura (prima partivano due richieste uguali all'apertura): al primo ingresso e a ogni cambio di giorno
  useEffect(() => { if (profile) fetchDiary({ instant: true }) }, [profile, selectedDate])
  useRefreshOnReturn(() => { if (profile) fetchDiary() })

  async function fetchPlan() {
    const { data } = await supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()
    if (data) setPlan(data)
  }

  function applyDiary(data) {
    const byMeal = {}
    MEAL_SLOTS.forEach(m => byMeal[m] = [])
    ;(data || []).forEach(e => {
      const meal = MEAL_SLOTS.find(m => m.toLowerCase() === e.meal_type?.toLowerCase()) || 'Colazione'
      byMeal[meal] = [...(byMeal[meal] || []), e]
    })
    setDiary(byMeal)
    setLoading(false)
  }

  // Aprendo il diario (o cambiando giorno) i pasti già letti compaiono SUBITO; dopo aver aggiunto o tolto un alimento si rilegge dal database.
  async function fetchDiary({ instant = false } = {}) {
    const key = 'diary_' + selectedDate
    if (instant && !hasCache(profile.id, key)) setLoading(true)
    const r = await loadSWR(profile.id, key, () => supabase.from('diary_entries').select('*')
      .eq('client_id', profile.id).eq('entry_date', selectedDate).order('created_at'), { onData: applyDiary, cacheFirst: instant })
    setLoading(false)
    setStale(!!r.error || !!r.fromCache)
    cachePruneDated(profile.id, 'diary_', 14)
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
    await dbSave(supabase.from('diary_entries').insert({
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
    }), 'il diario', 'salvare', { quiet: true })
    setSelectedFood(null)
    setQty(100)
    if (window.innerWidth < 768) setActiveTab('pasti')
    showToast(`${selectedFood.name} aggiunto!`, '✅')
    fetchDiary()
  }

  async function removeFood(id) {
    await dbSave(supabase.from('diary_entries').delete().eq('id', id), 'il diario', 'eliminare', { done: 'Alimento rimosso' })
    fetchDiary()
  }

  async function clearAll() {
    if (!(await askConfirm('Vuoi azzerare tutto il diario di oggi?', { confirmLabel: 'Azzera', danger: true }))) return
    const r = await dbSave(supabase.from('diary_entries').delete()
      .eq('client_id', profile.id).eq('entry_date', selectedDate), 'il diario', 'eliminare', { done: 'Giorno svuotato' })
    if (!r.ok) return                                   // il diario è ancora lì: non si svuota la schermata
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
          <button aria-label="Giorno precedente" onClick={()=>{
            setSelectedDate(addDaysStr(selectedDate, -1))
          }} style={{background:'none',border:'none',cursor:'pointer',color:'#AAA',padding:4,display:'flex',alignItems:'center'}}>
            <i className="ti ti-chevron-left" style={{fontSize:18}}/>
          </button>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0'}}>
              {isToday ? 'Oggi' : new Date(selectedDate+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}
            </div>
            {!isToday && (
              <button onClick={()=>setSelectedDate(today)}
                style={{fontSize:10,color:'#F4894A',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:500,padding:0}}>
                Torna a oggi
              </button>
            )}
          </div>
          <button aria-label="Giorno successivo" onClick={()=>{
            const next = addDaysStr(selectedDate, 1)
            if (next <= today) setSelectedDate(next)
          }} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center',
            color: selectedDate >= today ? '#444' : '#AAA'}}>
            <i className="ti ti-chevron-right" style={{fontSize:18}}/>
          </button>
        </div>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {totKcal > 0 && isToday && (
            <button onClick={clearAll} style={{background:'rgba(226,75,74,0.1)',color:'#E24B4A',border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
              <i className="ti ti-trash" style={{fontSize:13}}/>Azzera
            </button>
          )}
          <span style={{background:'rgba(212,87,10,0.1)',color:'#F4894A',fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:500}}>
            {isToday ? `${remaining} kcal rimanenti` : `${totKcal} kcal`}
          </span>
        </div>
      </div>

      <div style={s.page}>

        {/* RIEPILOGO CALORIE */}
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
            <span style={{fontSize:24,fontWeight:700,color:'#F0F0F0'}}>{totKcal.toLocaleString('it-IT')}<span style={{fontSize:13,color:'#AAA',fontWeight:400}}> kcal</span></span>
            <span style={{fontSize:13,color:pct>100?'#E24B4A':'#F4894A',fontWeight:600}}>{pct}% del target</span>
          </div>
          <div style={{height:8,background:'#161616',borderRadius:4,marginBottom:12,overflow:'hidden'}}>
            <div style={{height:8,borderRadius:4,background:pct>100?'#E24B4A':'linear-gradient(90deg,#D4570A,#F4894A)',width:`${pct}%`,transition:'width 0.4s'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[{l:'Proteine',v:totP,t:target.p,c:'#D4570A'},{l:'Carboidrati',v:totC,t:target.c,c:'#F4894A'},{l:'Grassi',v:totG,t:target.g,c:'#FAC775'}].map(m=>(
              <div key={m.l}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                  <span style={{color:'#AAA'}}>{m.l}</span>
                  <span style={{fontWeight:600,color:'#F0F0F0'}}>{m.v}g</span>
                </div>
                <div style={{height:4,background:'#161616',borderRadius:2}}>
                  <div style={{height:4,borderRadius:2,background:m.c,width:`${Math.min(100,Math.round(m.v/m.t*100))}%`,transition:'width 0.4s'}}/>
                </div>
                <div style={{fontSize:10,color:'#AAA',marginTop:2}}>di {m.t}g</div>
              </div>
            ))}
          </div>
        </div>

        {/* TAB MOBILE */}
        {window.innerWidth < 768 && isToday && (
          <div style={{display:'flex',gap:0,marginBottom:12,background:'#0D0D0D',borderRadius:12,padding:4,border:'0.5px solid #1C1C1C'}}>
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
            {stale && <StaleNotice text="Diario salvato sul telefono: non riesco ad aggiornarlo." onRetry={() => fetchDiary()} />}
            {MEAL_SLOTS.map(meal => {
              const foods = diary[meal] || []
              const mealKcal = Math.round(foods.reduce((s,e) => s+(e.kcal||0), 0))
              return (
                <div key={meal} style={s.card}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:foods.length?10:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:7,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <i className={`ti ${MEAL_ICONS[meal]||'ti-circle'}`} style={{fontSize:14,color:'#D4570A'}}/>
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0'}}>{meal}</div>
                    </div>
                    {mealKcal > 0 && <span style={{fontSize:11,color:'#F4894A',fontWeight:600}}>{mealKcal} kcal</span>}
                  </div>
                  {foods.length === 0 ? (
                    loading ? <Skeleton rows={1} height={14} style={{ padding: '6px 0 0' }} /> : <div style={{fontSize:11,color:'#E0DDD6',paddingTop:4}}>Nessun alimento</div>
                  ) : foods.map(f => (
                    <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid #1A1A1A'}}>
                      <div style={{width:5,height:5,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.food_name}</div>
                        <div style={{fontSize:10,color:'#AAA'}}>{f.quantity_g}g · P{f.protein_g} C{f.carbs_g} G{f.fat_g}</div>
                      </div>
                      <div style={{fontSize:11,color:'#F4894A',fontWeight:600,flexShrink:0}}>{f.kcal}</div>
                      <button onClick={()=>removeFood(f.id)} aria-label="Rimuovi alimento" style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontSize:14,padding:0,flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* CERCA E AGGIUNGI — solo per oggi */}
          <div style={{position: window.innerWidth < 768 ? 'static' : 'sticky', top:0, display: (window.innerWidth < 768 && activeTab !== 'cerca') || !isToday ? 'none' : 'block'}}>
            <div style={s.card}>
              <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
                <i className="ti ti-search" style={{fontSize:14,color:'#D4570A'}}/>
                Aggiungi alimento
              </div>

              {/* Seleziona pasto */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'#AAA',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Aggiungi a</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {MEAL_SLOTS.map(m=>(
                    <button key={m} onClick={()=>setSelectedMeal(m)}
                      style={{padding:'4px 9px',borderRadius:12,fontSize:11,fontWeight:500,cursor:'pointer',border:'0.5px solid',
                        background:selectedMeal===m?'#D4570A':'#0D0D0D',
                        color:selectedMeal===m?'white':'#888780',
                        borderColor:selectedMeal===m?'#D4570A':'#2A2A2A'}}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#161616',border:'0.5px solid #1C1C1C',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
                <i className="ti ti-search" style={{fontSize:13,color:'#AAA'}}/>
                <input style={{border:'none',background:'transparent',outline:'none',fontSize:13,color:'#F0F0F0',width:'100%',fontFamily:'inherit'}}
                  placeholder="Cerca alimento..." value={search} onChange={e=>handleSearch(e.target.value)}/>
              </div>

              {results.length > 0 && (
                <div style={{maxHeight:200,overflowY:'auto',marginBottom:8}}>
                  {results.map((f,i)=>(
                    <div key={i} onClick={()=>selectFood(f)}
                      style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:2,background:'#161616'}}>
                      <div>
                        <div style={{fontSize:12,color:'#F0F0F0',fontWeight:500}}>{f.name}</div>
                        <div style={{fontSize:10,color:'#AAA'}}>{f.brand} · P{f.p} C{f.c} G{f.g}/100g</div>
                      </div>
                      <div style={{fontSize:11,color:'#F4894A',fontWeight:600}}>{f.kcal100}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedFood && (
                <div style={{background:'rgba(212,87,10,0.1)',borderRadius:8,padding:'12px',marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#F4894A',marginBottom:8}}>{selectedFood.name}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <input inputMode="decimal" type="number" value={qty} onChange={e=>setQty(parseFloat(e.target.value)||100)} min={1}
                      style={{...s.input,width:75,textAlign:'center'}}/>
                    <span style={{fontSize:12,color:'#AAA'}}>g</span>
                    <span style={{fontSize:13,color:'#F4894A',fontWeight:700,marginLeft:'auto'}}>
                      {Math.round(selectedFood.kcal100*qty/100)} kcal
                    </span>
                  </div>
                  <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
                    <span style={{...s.tag,background:'#0D0D0D',color:'#F4894A'}}>P {Math.round(selectedFood.p*qty/100)}g</span>
                    <span style={{...s.tag,background:'#0D0D0D',color:'#F4894A'}}>C {Math.round(selectedFood.c*qty/100)}g</span>
                    <span style={{...s.tag,background:'#0D0D0D',color:'#AAA'}}>G {Math.round(selectedFood.g*qty/100)}g</span>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button style={s.btn} onClick={addFood}>
                      <i className="ti ti-plus" style={{fontSize:13}}/>Aggiungi
                    </button>
                    <button onClick={()=>setSelectedFood(null)}
                      style={{padding:'8px 12px',background:'#0D0D0D',border:'0.5px solid #1C1C1C',borderRadius:8,fontSize:12,cursor:'pointer',color:'#AAA',fontFamily:'inherit'}}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid #1A1A1A'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:11,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.06em'}}>Idratazione</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{fontSize:11,color:'#F4894A',fontWeight:600}}>{water * 250}ml / {waterGoal * 250}ml</div>
                    <button aria-label="Modifica l'obiettivo dell'acqua" onClick={()=>{ setWaterGoalInput(waterGoal); setEditingWaterGoal(!editingWaterGoal) }}
                      style={{background:'none',border:'none',cursor:'pointer',color:'#AAA',padding:0}}>
                      <i className="ti ti-settings" style={{fontSize:13}}/>
                    </button>
                  </div>
                </div>

                {editingWaterGoal && (
                  <div style={{marginBottom:10,background:'#161616',borderRadius:10,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:'#AAA',marginBottom:8}}>Quanti bicchieri vuoi bere al giorno?</div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button className="tap" onClick={()=>setWaterGoalInput(Math.max(1, waterGoalInput-1))}
                        style={{width:32,height:32,borderRadius:8,background:'#0D0D0D',border:'0.5px solid #1C1C1C',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>−</button>
                      <div style={{flex:1,textAlign:'center'}}>
                        <div style={{fontSize:22,fontWeight:700,color:'#F0F0F0'}}>{waterGoalInput}</div>
                        <div style={{fontSize:10,color:'#AAA'}}>{waterGoalInput * 250}ml totali</div>
                      </div>
                      <button className="tap" onClick={()=>setWaterGoalInput(Math.min(20, waterGoalInput+1))}
                        style={{width:32,height:32,borderRadius:8,background:'#0D0D0D',border:'0.5px solid #1C1C1C',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>+</button>
                    </div>
                    <button onClick={saveWaterGoal}
                      style={{width:'100%',marginTop:10,background:'#D4570A',color:'white',border:'none',borderRadius:8,padding:'8px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                      Salva obiettivo
                    </button>
                  </div>
                )}

                <div style={{display:'flex',gap:3,marginBottom:5}}>
                  {Array.from({length:waterGoal}).map((_,i)=>(
                    <div key={i} role="button" aria-label={`Bicchiere ${i+1}`} aria-pressed={i < water} data-testid={`glass-${i}`} onClick={()=>setWaterSaved(i < water ? i : i+1)}
                      style={{flex:1,height:8,borderRadius:2,cursor:'pointer',
                        background:i<water?'#D4570A':'#161616',
                        transition:'background 0.15s'}}/>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:10,color:'#AAA'}}>{water}/{waterGoal} bicchieri</div>
                  {water > 0 && (
                    <button onClick={()=>setWaterSaved(0)} style={{fontSize:10,color:'#AAA',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>reset</button>
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
