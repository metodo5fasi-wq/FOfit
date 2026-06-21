import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const DAYS = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:10, border:'0.5px solid var(--border)', padding:'14px 16px', marginBottom:14 },
  badge: { background:'#FEF0E7', color:'#D4570A', fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  dayTab: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-muted)', flexShrink:0 },
  dayTabActive: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #D4570A', background:'#D4570A', color:'white', flexShrink:0 },
  mealBlock: { border:'0.5px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:10 },
  mealHeader: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:'var(--bg-card)' },
  mealHeaderOpen: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:'#FEF0E7' },
  mealIcon: { width:32, height:32, borderRadius:8, background:'#FEF0E7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  mealBody: { borderTop:'0.5px solid var(--border)', padding:'0 14px' },
  foodRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'0.5px solid var(--border)' },
  tag: { fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:500 },
}

export default function PianoAlimentare() {
  const { profile } = useAuth()
  const [plan, setPlan] = useState(null)
  const [meals, setMeals] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(0)
  const [openMeals, setOpenMeals] = useState({})
  const [noplan, setNoPlan] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState({}) // { foodId: optionIndex } 0=principale, 1+=opzioni[idx-1]
  const [supplements, setSupplements] = useState([])
  const [showSupplements, setShowSupplements] = useState(false)
  const [adherence, setAdherence] = useState({})
  const todayDate = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (profile) fetchPlan()
  }, [profile])

  async function fetchPlan() {
    setLoading(true)
    // Prendi il piano attivo del cliente
    const { data: planData } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('client_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!planData) { setNoPlan(true); setLoading(false); return }
    setPlan(planData)

    // Prendi tutti i pasti del piano con gli alimenti
    const { data: mealsData } = await supabase
      .from('plan_meals')
      .select('*, plan_meal_foods(*)')
      .eq('plan_id', planData.id)
      .order('meal_order')

    // Organizza per giorno
    const byDay = {}
    for (let d = 1; d <= 7; d++) {
      byDay[d] = (mealsData || []).filter(m => m.day_of_week === d)
    }
    setMeals(byDay)

    // Piano integratori
    const { data: suppData } = await supabase.from('plan_supplements')
      .select('*').eq('plan_id', planData.id).order('order_index', {ascending:true})
    setSupplements(suppData || [])

    // Aderenza pasti di oggi
    const { data: adherenceData } = await supabase.from('meal_adherence')
      .select('*').eq('client_id', profile.id).eq('adherence_date', new Date().toISOString().split('T')[0])
    const adherenceMap = {}
    adherenceData?.forEach(a => { adherenceMap[a.plan_meal_id] = a.followed })
    setAdherence(adherenceMap)

    setLoading(false)
  }

  async function toggleAdherence(mealId) {
    const current = adherence[mealId] || false
    const next = !current
    setAdherence(prev => ({...prev, [mealId]: next}))
    const existing = await supabase.from('meal_adherence')
      .select('id').eq('client_id', profile.id).eq('plan_meal_id', mealId).eq('adherence_date', todayDate).single()
    if (existing.data) {
      await supabase.from('meal_adherence').update({ followed: next }).eq('id', existing.data.id)
    } else {
      await supabase.from('meal_adherence').insert({ client_id: profile.id, plan_meal_id: mealId, adherence_date: todayDate, followed: next })
    }
  }

  function toggleMeal(key) {
    setOpenMeals(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const dayMeals = meals[selectedDay + 1] || []
  const dayKcal = dayMeals.reduce((s, m) => s + (m.plan_meal_foods || []).reduce((ss, f) => ss + getDisplayedFood(f, selectedOptions).kcal, 0), 0)
  const dayTarget = dayMeals[0]?.day_kcal_target || null
  const dayLabel = dayMeals[0]?.day_label || null

  function getDisplayedFood(food, selOpts) {
    const sel = selOpts[food.id]
    if (sel && food.options?.[sel-1]) {
      const o = food.options[sel-1]
      return { food_name:o.food_name, brand:'', quantity_g:o.quantity_g, kcal:o.kcal, protein_g:o.protein_g, carbs_g:o.carbs_g, fat_g:o.fat_g }
    }
    return food
  }

  if (loading) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'var(--text)'}}>Piano alimentare</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center',color:'var(--text-muted)'}}>
          <i className="ti ti-loader" style={{fontSize:32,display:'block',marginBottom:8,color:'#D4570A'}}/>
          Caricamento piano...
        </div>
      </div>
    </>
  )

  if (noplan) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'var(--text)'}}>Piano alimentare</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center',maxWidth:300}}>
          <i className="ti ti-clipboard-x" style={{fontSize:48,color:'#E0DDD6',display:'block',marginBottom:16}}/>
          <div style={{fontSize:15,fontWeight:500,color:'var(--text)',marginBottom:8}}>Nessun piano attivo</div>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>Il tuo coach non ha ancora assegnato un piano alimentare. Contattalo per maggiori informazioni.</div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'var(--text)'}}>Piano alimentare</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>{plan?.title} — Settimana {plan?.week_number}</div>
        </div>
        <span style={s.badge}>
          {dayTarget && dayTarget !== plan?.kcal_target ? `${dayTarget.toLocaleString('it-IT')} kcal/giorno` : `${plan?.kcal_target?.toLocaleString('it-IT')} kcal/giorno`}
        </span>
      </div>

      <div style={s.page}>

        {/* Nota coach */}
        {plan?.notes && (
          <div style={{background:'#FEF0E7',borderLeft:'3px solid #D4570A',borderRadius:8,padding:'11px 14px',marginBottom:14,fontSize:13,color:'#7a3508',lineHeight:1.5}}>
            <div style={{fontSize:11,fontWeight:500,color:'#D4570A',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>
              <i className="ti ti-message-circle" style={{fontSize:12,verticalAlign:-1,marginRight:4}}/>Note del coach
            </div>
            {plan.notes}
          </div>
        )}

        {/* Etichetta tipo giorno (es. ON WEEK2+3) */}
        {dayLabel && (
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:600,color:'#D4570A',background:'#FEF0E7',padding:'4px 10px',borderRadius:8}}>
              <i className="ti ti-calendar-event" style={{fontSize:12,marginRight:4}}/>{dayLabel}
            </span>
          </div>
        )}

        {/* Riepilogo macro */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          {[
            { label:'Calorie', val:(dayTarget||plan?.kcal_target)?.toLocaleString('it-IT'), unit:'kcal' },
            { label:'Proteine', val:dayMeals[0]?.day_protein_target_g||plan?.protein_target_g, unit:'g' },
            { label:'Carboidrati', val:dayMeals[0]?.day_carbs_target_g||plan?.carbs_target_g, unit:'g' },
            { label:'Grassi', val:dayMeals[0]?.day_fat_target_g||plan?.fat_target_g, unit:'g' },
          ].map(m => (
            <div key={m.label} style={s.card}>
              <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{m.label}</div>
              <div style={{fontSize:20,fontWeight:500,color:'var(--text)'}}>{m.val}<span style={{fontSize:12,color:'var(--text-muted)'}}>{m.unit}</span></div>
            </div>
          ))}
        </div>

        {/* Tabs giorni */}
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
          {DAYS.map((day, i) => (
            <div key={i} style={selectedDay===i ? s.dayTabActive : s.dayTab} onClick={() => { setSelectedDay(i); setOpenMeals({}) }}>
              {day}
            </div>
          ))}
        </div>

        {/* Pasti del giorno */}
        {dayMeals.length === 0 ? (
          <div>
            {/* Piano senza pasti strutturati — mostra i target macro */}
            <div style={{...s.card, background:'linear-gradient(135deg,#FEF0E7,#FAC9A8)', border:'0.5px solid #F4894A'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#D4570A',marginBottom:14,display:'flex',alignItems:'center',gap:6}}>
                <i className="ti ti-target" style={{fontSize:15}}/>
                Target giornalieri
                {plan?.diet_type && plan.diet_type !== 'lineare' && (
                  <span style={{fontSize:11,background:'#D4570A',color:'white',padding:'2px 8px',borderRadius:8,fontWeight:600,marginLeft:4}}>
                    {{'on_off':'ON/OFF','onde':'Ad onde','reverse':'Reverse diet','ciclico':'Deficit/Surplus ciclico','refeed':'Refeed'}[plan.diet_type] || plan.diet_type}
                  </span>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                {[
                  {l:'Calorie',v:`${plan?.kcal_target?.toLocaleString('it-IT')}`,u:'kcal',icon:'ti-flame'},
                  {l:'Proteine',v:plan?.protein_target_g,u:'g',icon:'ti-meat'},
                  {l:'Carboidrati',v:plan?.carbs_target_g,u:'g',icon:'ti-bread'},
                  {l:'Grassi',v:plan?.fat_target_g,u:'g',icon:'ti-droplet'},
                ].map(m=>(
                  <div key={m.l} style={{background:'rgba(255,255,255,0.6)',borderRadius:10,padding:'12px',textAlign:'center'}}>
                    <i className={`ti ${m.icon}`} style={{fontSize:16,color:'#D4570A',display:'block',marginBottom:4}}/>
                    <div style={{fontSize:20,fontWeight:800,color:'#D4570A'}}>{m.v}<span style={{fontSize:12,fontWeight:500}}>{m.u}</span></div>
                    <div style={{fontSize:10,color:'#7a3508',marginTop:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>{m.l}</div>
                  </div>
                ))}
              </div>
              {plan?.notes && (
                <div style={{marginTop:12,background:'rgba(255,255,255,0.5)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#7a3508',lineHeight:1.6}}>
                  <i className="ti ti-notes" style={{fontSize:13,marginRight:5}}/>{plan.notes}
                </div>
              )}
            </div>
            <div style={{...s.card, textAlign:'center', padding:'20px'}}>
              <i className="ti ti-calendar-off" style={{fontSize:32,color:'#E0DDD6',display:'block',marginBottom:8}}/>
              <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>
                Il tuo coach ha impostato i target nutrizionali.<br/>
                Il piano pasti dettagliato sarà disponibile a breve.
              </div>
            </div>
          </div>
        ) : (
          dayMeals.map((meal, mi) => {
            const key = `${selectedDay}-${mi}`
            const isOpen = openMeals[key]
            const foods = meal.plan_meal_foods || []
            const displayedFoods = foods.map(f => getDisplayedFood(f, selectedOptions))
            const mealKcal = Math.round(displayedFoods.reduce((s, f) => s + (f.kcal || 0), 0))
            const mealP = Math.round(displayedFoods.reduce((s, f) => s + (f.protein_g || 0), 0))
            const mealC = Math.round(displayedFoods.reduce((s, f) => s + (f.carbs_g || 0), 0))
            const mealG = Math.round(displayedFoods.reduce((s, f) => s + (f.fat_g || 0), 0))

            return (
              <div key={mi} style={s.mealBlock}>
                <div style={isOpen ? s.mealHeaderOpen : s.mealHeader} onClick={() => toggleMeal(key)}>
                  <div style={s.mealIcon}>
                    <i className={`ti ${MEAL_ICONS[meal.meal_type]||'ti-circle'}`} style={{fontSize:16,color:'#D4570A'}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--text)',textTransform:'capitalize'}}>{meal.meal_type}</div>
                    {meal.coach_note && <div style={{fontSize:11,color:'var(--text-muted)'}}>{meal.coach_note}</div>}
                  </div>
                  {mealKcal > 0 && <span style={{...s.badge,fontSize:11}}>{mealKcal} kcal</span>}
                  <button onClick={e=>{e.stopPropagation(); toggleAdherence(meal.id)}} style={{
                    padding:'5px 10px', borderRadius:8, border:'0.5px solid',
                    background: adherence[meal.id] ? '#EAF3DE' : 'var(--bg-input)',
                    color: adherence[meal.id] ? '#3B6D11' : 'var(--text-muted)',
                    borderColor: adherence[meal.id] ? '#3B6D11' : 'var(--border)',
                    fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                    display:'flex', alignItems:'center', gap:3, flexShrink:0,
                  }}>
                    <i className={`ti ${adherence[meal.id]?'ti-check':'ti-circle'}`} style={{fontSize:12}}/>
                    {adherence[meal.id]?'Seguito':'Segui'}
                  </button>
                  <i className="ti ti-chevron-down" style={{fontSize:15,color:'var(--text-muted)',transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
                </div>

                {isOpen && (
                  <div style={s.mealBody}>
                    {foods.map((food, fi) => {
                      const displayed = displayedFoods[fi]
                      const sel = selectedOptions[food.id] || 0
                      return (
                      <div key={fi} style={{...s.foodRow, flexDirection:'column', alignItems:'stretch', gap:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:6,height:6,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:'var(--text)'}}>{displayed.food_name}</div>
                            {displayed.brand && <div style={{fontSize:11,color:'var(--text-muted)'}}>{displayed.brand}</div>}
                          </div>
                          <div style={{fontSize:12,color:'var(--text-muted)',marginRight:8}}>{displayed.quantity_g}g</div>
                          <div style={{display:'flex',gap:4}}>
                            <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A'}}>P {displayed.protein_g}g</span>
                            <span style={{...s.tag,background:'#FEF0E7',color:'#F4894A'}}>C {displayed.carbs_g}g</span>
                            <span style={{...s.tag,background:'var(--bg-input)',color:'var(--text-muted)'}}>G {displayed.fat_g}g</span>
                          </div>
                        </div>
                        {food.options?.length > 0 && (
                          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginLeft:16}}>
                            <button onClick={()=>setSelectedOptions(p=>({...p,[food.id]:0}))} style={{
                              fontSize:10,padding:'3px 9px',borderRadius:10,fontWeight:500,cursor:'pointer',fontFamily:'inherit',border:'0.5px solid',
                              background:sel===0?'#D4570A':'var(--bg-input)', color:sel===0?'white':'var(--text-muted)', borderColor:sel===0?'#D4570A':'var(--border)'
                            }}>{food.food_name}</button>
                            {food.options.map((op,oi)=>(
                              <button key={oi} onClick={()=>setSelectedOptions(p=>({...p,[food.id]:oi+1}))} style={{
                                fontSize:10,padding:'3px 9px',borderRadius:10,fontWeight:500,cursor:'pointer',fontFamily:'inherit',border:'0.5px solid',
                                background:sel===oi+1?'#D4570A':'var(--bg-input)', color:sel===oi+1?'white':'var(--text-muted)', borderColor:sel===oi+1?'#D4570A':'var(--border)'
                              }}>{op.food_name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )})}
                    {foods.length > 0 && (
                      <div style={{display:'flex',gap:16,padding:'10px 0',borderTop:'0.5px solid var(--border)'}}>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>Totale pasto:</span>
                        <span style={{fontSize:11,color:'#D4570A',fontWeight:500}}>{mealKcal} kcal</span>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>P {mealP}g · C {mealC}g · G {mealG}g</span>
                      </div>
                    )}

                    {/* ALTERNATIVE */}
                    {(meal.alternatives?.length > 0) && (
                      <AlternativeSection alternatives={meal.alternatives}/>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* INTEGRATORI */}
        {supplements.length > 0 && (
          <div style={s.mealBlock}>
            <div style={showSupplements ? s.mealHeaderOpen : s.mealHeader} onClick={()=>setShowSupplements(v=>!v)}>
              <div style={s.mealIcon}>
                <i className="ti ti-pill" style={{fontSize:16,color:'#D4570A'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>Piano integratori</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{supplements.length} prodotti</div>
              </div>
              <i className="ti ti-chevron-down" style={{fontSize:15,color:'var(--text-muted)',transform:showSupplements?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>
            {showSupplements && (
              <div style={s.mealBody}>
                {supplements.map((sup,si)=>(
                  <div key={si} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                    <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A',flexShrink:0,marginTop:2}}>{sup.timing_label||'—'}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:'var(--text)',fontWeight:500}}>{sup.name}{sup.dosage && <span style={{color:'var(--text-muted)',fontWeight:400}}> · {sup.dosage}</span>}</div>
                      {sup.notes && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{sup.notes}</div>}
                      {sup.link && (
                        <a href={sup.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'#D4570A',display:'inline-flex',alignItems:'center',gap:3,marginTop:4,textDecoration:'none'}}>
                          <i className="ti ti-external-link" style={{fontSize:12}}/>Vedi prodotto
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function AlternativeSection({ alternatives }) {
  const [openAlt, setOpenAlt] = React.useState(null)
  if (!alternatives || alternatives.length === 0) return null
  return (
    <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px dashed #E0DDD6'}}>
      <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:500,marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
        <i className="ti ti-refresh" style={{fontSize:12,color:'#F4894A'}}/>
        Alternative disponibili
      </div>
      {alternatives.map((alt, ai) => (
        <div key={ai} style={{marginBottom:6}}>
          <button onClick={()=>setOpenAlt(openAlt===ai?null:ai)} style={{
            width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'8px 10px',borderRadius:8,border:'0.5px solid #F4C9A8',
            background:openAlt===ai?'#FEF0E7':'#FEF8F4',cursor:'pointer',fontFamily:'inherit'
          }}>
            <span style={{fontSize:12,fontWeight:500,color:'#D4570A'}}>{alt.nome || `Alternativa ${ai+1}`}</span>
            <i className={`ti ti-chevron-${openAlt===ai?'up':'down'}`} style={{fontSize:12,color:'#F4894A'}}/>
          </button>
          {openAlt === ai && (
            <div style={{padding:'8px 10px',background:'#FEF8F4',borderRadius:'0 0 8px 8px',border:'0.5px solid #F4C9A8',borderTop:'none'}}>
              {(alt.alimenti || []).map((a, fi) => (
                <div key={fi} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.5px solid rgba(212,87,10,0.08)'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#F4894A',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:'var(--text)'}}>{a.nome}</div>
                    {a.marca&&<div style={{fontSize:10,color:'var(--text-muted)'}}>{a.marca}</div>}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.quantita_g}g</div>
                  <div style={{display:'flex',gap:3}}>
                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:6,background:'#FEF0E7',color:'#D4570A',fontWeight:500}}>P{a.proteine_g}g</span>
                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:6,background:'#FEF0E7',color:'#F4894A',fontWeight:500}}>C{a.carboidrati_g}g</span>
                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:6,background:'var(--bg-input)',color:'var(--text-muted)',fontWeight:500}}>G{a.grassi_g}g</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
