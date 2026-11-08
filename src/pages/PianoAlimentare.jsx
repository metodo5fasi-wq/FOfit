import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import PlanPdfButton from '../components/PlanPdfButton'
import { loadSWR, hasCache } from '../lib/offline'
import { Skeleton, LoadError, StaleNotice } from '../components/LoadStates'
import { useRefreshOnReturn } from '../lib/useRefreshOnReturn'

const DAYS = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }

const s = {
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'#0D0D0D', borderRadius:10, border:'0.5px solid #1C1C1C', padding:'14px 16px', marginBottom:14 },
  badge: { background:'rgba(212,87,10,0.1)', color:'#F4894A', fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  dayTab: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #1C1C1C', background:'#0D0D0D', color:'#AAA', flexShrink:0 },
  dayTabActive: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #D4570A', background:'#D4570A', color:'white', flexShrink:0 },
  mealBlock: { border:'0.5px solid #1C1C1C', borderRadius:10, overflow:'hidden', marginBottom:10 },
  mealHeader: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:'#0D0D0D' },
  mealHeaderOpen: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:'rgba(212,87,10,0.1)' },
  mealIcon: { width:32, height:32, borderRadius:8, background:'rgba(212,87,10,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  mealBody: { borderTop:'0.5px solid #1A1A1A', padding:'0 14px' },
  foodRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'0.5px solid #1A1A1A' },
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
  const [loadError, setLoadError] = useState(false)
  const [stale, setStale] = useState(false)           // si vedono i dati salvati sul telefono perché non si riesce ad aggiornarli

  useEffect(() => {
    if (profile) fetchPlan()
  }, [profile])
  // tornando all'app dopo un po', un piano aggiornato dal coach compare da solo
  useRefreshOnReturn(() => { if (profile) fetchPlan({ instant: false, quiet: true }) })

  function applyView(v) {
    if (!v?.plan) { setNoPlan(true); setPlan(null); setMeals({}) }
    else {
      setNoPlan(false); setPlan(v.plan)
      const byDay = {}
      for (let d = 1; d <= 7; d++) byDay[d] = (v.meals || []).filter(m => m.day_of_week === d)
      setMeals(byDay)
    }
    setLoading(false)
  }

  // Prima visita: scheletro, poi i dati. Dalle visite successive il piano compare SUBITO (ultima copia salvata) e si aggiorna da solo.
  // Se la lettura fallisce e non c'è nessuna copia lo si dice ("Non riesco a caricare"), invece di mostrare "Nessun piano attivo".
  async function fetchPlan({ instant = true, quiet = false } = {}) {
    if (!quiet && !hasCache(profile.id, 'piano_view')) setLoading(true)
    setLoadError(false)
    const r = await loadSWR(profile.id, 'piano_view', async () => {
      const { data: planData, error } = await supabase.from('meal_plans').select('*')
        .eq('client_id', profile.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) return { data: null, error }
      if (!planData) return { data: { plan: null, meals: [] }, error: null }
      const { data: mealsData, error: e2 } = await supabase.from('plan_meals').select('*, plan_meal_foods(*)').eq('plan_id', planData.id).order('meal_order')
      if (e2) return { data: null, error: e2 }
      return { data: { plan: planData, meals: mealsData || [] }, error: null }
    }, { onData: applyView, cacheFirst: instant })
    if (r.error && !r.data) { setLoadError(true); setLoading(false) }
    setStale(!!r.error || !!r.fromCache)
  }

  function toggleMeal(key) {
    setOpenMeals(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const dayMeals = meals[selectedDay + 1] || []

  if (loading) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'#F0F0F0'}}>Piano alimentare</div></div>
      <div style={s.page}><Skeleton rows={4} height={72} style={{padding:0}} /></div>
    </>
  )

  if (loadError) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'#F0F0F0'}}>Piano alimentare</div></div>
      <LoadError text="Non riesco a caricare il piano." onRetry={() => fetchPlan({ instant: false })} />
    </>
  )

  if (noplan) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'#F0F0F0'}}>Piano alimentare</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center',maxWidth:300}}>
          <i className="ti ti-clipboard-x" style={{fontSize:48,color:'#E0DDD6',display:'block',marginBottom:16}}/>
          <div style={{fontSize:15,fontWeight:500,color:'#F0F0F0',marginBottom:8}}>Nessun piano attivo</div>
          <div style={{fontSize:13,color:'#AAA',lineHeight:1.6}}>Il tuo coach non ha ancora assegnato un piano alimentare. Contattalo per maggiori informazioni.</div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#F0F0F0'}}>Piano alimentare</div>
          <div style={{fontSize:12,color:'#AAA'}}>{plan?.title} — Settimana {plan?.week_number}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <PlanPdfButton planId={plan?.id}/>
          <span style={s.badge}>{plan?.kcal_target?.toLocaleString('it-IT')} kcal/giorno</span>
        </div>
      </div>

      {stale && <StaleNotice onRetry={() => fetchPlan({ instant: false, quiet: true })} />}
      <div style={s.page}>

        {/* Nota coach */}
        {plan?.notes && (
          <div style={{background:'rgba(212,87,10,0.1)',borderLeft:'3px solid #D4570A',borderRadius:8,padding:'11px 14px',marginBottom:14,fontSize:13,color:'#F4894A',lineHeight:1.5}}>
            <div style={{fontSize:11,fontWeight:500,color:'#F4894A',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>
              <i className="ti ti-message-circle" style={{fontSize:12,verticalAlign:-1,marginRight:4}}/>Note del coach
            </div>
            {plan.notes}
          </div>
        )}

        {/* Riepilogo macro */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          {[
            { label:'Calorie', val:plan?.kcal_target?.toLocaleString('it-IT'), unit:'kcal' },
            { label:'Proteine', val:plan?.protein_target_g, unit:'g' },
            { label:'Carboidrati', val:plan?.carbs_target_g, unit:'g' },
            { label:'Grassi', val:plan?.fat_target_g, unit:'g' },
          ].map(m => (
            <div key={m.label} style={s.card}>
              <div style={{fontSize:10,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{m.label}</div>
              <div style={{fontSize:20,fontWeight:500,color:'#F0F0F0'}}>{m.val}<span style={{fontSize:12,color:'#AAA'}}>{m.unit}</span></div>
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
          <div style={{...s.card, textAlign:'center', padding:'30px 0'}}>
            <i className="ti ti-calendar-off" style={{fontSize:36,color:'#E0DDD6',display:'block',marginBottom:10}}/>
            <div style={{fontSize:13,color:'#AAA'}}>Nessun pasto per questo giorno.</div>
          </div>
        ) : (
          dayMeals.map((meal, mi) => {
            const key = `${selectedDay}-${mi}`
            const isOpen = openMeals[key]
            const foods = meal.plan_meal_foods || []
            const mealKcal = Math.round(foods.reduce((s, f) => s + (f.kcal || 0), 0))
            const mealP = Math.round(foods.reduce((s, f) => s + (f.protein_g || 0), 0))
            const mealC = Math.round(foods.reduce((s, f) => s + (f.carbs_g || 0), 0))
            const mealG = Math.round(foods.reduce((s, f) => s + (f.fat_g || 0), 0))

            return (
              <div key={mi} style={s.mealBlock}>
                <div style={isOpen ? s.mealHeaderOpen : s.mealHeader} onClick={() => toggleMeal(key)}>
                  <div style={s.mealIcon}>
                    <i className={`ti ${MEAL_ICONS[meal.meal_type]||'ti-circle'}`} style={{fontSize:16,color:'#D4570A'}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:'#F0F0F0',textTransform:'capitalize'}}>{meal.meal_type}</div>
                    {meal.coach_note && <div style={{fontSize:11,color:'#AAA'}}>{meal.coach_note}</div>}
                  </div>
                  {mealKcal > 0 && <span style={{...s.badge,fontSize:11}}>{mealKcal} kcal</span>}
                  <i className={`ti ti-chevron-down`} style={{fontSize:15,color:'#AAA',transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
                </div>

                {isOpen && (
                  <div style={s.mealBody}>
                    {foods.map((food, fi) => (
                      <div key={fi} style={s.foodRow}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:'#F0F0F0'}}>{food.food_name}</div>
                          {food.brand && <div style={{fontSize:11,color:'#AAA'}}>{food.brand}</div>}
                        </div>
                        <div style={{fontSize:12,color:'#AAA',marginRight:8}}>{food.quantity_g}g</div>
                        <div style={{display:'flex',gap:4}}>
                          <span style={{...s.tag,background:'rgba(212,87,10,0.1)',color:'#F4894A'}}>P {food.protein_g}g</span>
                          <span style={{...s.tag,background:'rgba(212,87,10,0.1)',color:'#F4894A'}}>C {food.carbs_g}g</span>
                          <span style={{...s.tag,background:'#161616',color:'#AAA'}}>G {food.fat_g}g</span>
                        </div>
                      </div>
                    ))}
                    {foods.length > 0 && (
                      <div style={{display:'flex',gap:16,padding:'10px 0',borderTop:'0.5px solid #1A1A1A'}}>
                        <span style={{fontSize:11,color:'#AAA'}}>Totale pasto:</span>
                        <span style={{fontSize:11,color:'#F4894A',fontWeight:500}}>{mealKcal} kcal</span>
                        <span style={{fontSize:11,color:'#AAA'}}>P {mealP}g · C {mealC}g · G {mealG}g</span>
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
      </div>
    </>
  )
}

function AlternativeSection({ alternatives }) {
  const [openAlt, setOpenAlt] = React.useState(null)
  if (!alternatives || alternatives.length === 0) return null
  return (
    <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px dashed #2A2A2A'}}>
      <div style={{fontSize:11,color:'#AAA',fontWeight:500,marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
        <i className="ti ti-refresh" style={{fontSize:12,color:'#F4894A'}}/>
        Alternative disponibili
      </div>
      {alternatives.map((alt, ai) => (
        <div key={ai} style={{marginBottom:6}}>
          <button onClick={()=>setOpenAlt(openAlt===ai?null:ai)} style={{
            width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'8px 10px',borderRadius:8,border:'0.5px solid rgba(212,87,10,0.35)',
            background:openAlt===ai?'rgba(212,87,10,0.14)':'rgba(212,87,10,0.10)',cursor:'pointer',fontFamily:'inherit'
          }}>
            <span style={{fontSize:12,fontWeight:500,color:'#F4894A'}}>{alt.nome || `Alternativa ${ai+1}`}</span>
            <i className={`ti ti-chevron-${openAlt===ai?'up':'down'}`} style={{fontSize:12,color:'#F4894A'}}/>
          </button>
          {openAlt === ai && (
            <div style={{padding:'8px 10px',background:'rgba(212,87,10,0.10)',borderRadius:'0 0 8px 8px',border:'0.5px solid rgba(212,87,10,0.35)',borderTop:'none'}}>
              {(alt.alimenti || []).map((a, fi) => (
                <div key={fi} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.5px solid rgba(212,87,10,0.08)'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#F4894A',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:'#F0F0F0'}}>{a.nome}</div>
                    {a.marca&&<div style={{fontSize:10,color:'#AAA'}}>{a.marca}</div>}
                  </div>
                  <div style={{fontSize:11,color:'#AAA'}}>{a.quantita_g}g</div>
                  <div style={{display:'flex',gap:3}}>
                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:6,background:'rgba(212,87,10,0.1)',color:'#F4894A',fontWeight:500}}>P{a.proteine_g}g</span>
                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:6,background:'rgba(212,87,10,0.1)',color:'#F4894A',fontWeight:500}}>C{a.carboidrati_g}g</span>
                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:6,background:'#161616',color:'#AAA',fontWeight:500}}>G{a.grassi_g}g</span>
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
