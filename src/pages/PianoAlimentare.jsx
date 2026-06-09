import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const DAYS = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'14px 16px', marginBottom:14 },
  badge: { background:'#FEF0E7', color:'#D4570A', fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  dayTab: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #E0DDD6', background:'white', color:'#888780', flexShrink:0 },
  dayTabActive: { padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid #D4570A', background:'#D4570A', color:'white', flexShrink:0 },
  mealBlock: { border:'0.5px solid #E0DDD6', borderRadius:10, overflow:'hidden', marginBottom:10 },
  mealHeader: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:'white' },
  mealHeaderOpen: { display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background:'#FEF0E7' },
  mealIcon: { width:32, height:32, borderRadius:8, background:'#FEF0E7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  mealBody: { borderTop:'0.5px solid #F5F3EF', padding:'0 14px' },
  foodRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'0.5px solid #F5F3EF' },
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
    setLoading(false)
  }

  function toggleMeal(key) {
    setOpenMeals(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const dayMeals = meals[selectedDay + 1] || []
  const dayKcal = dayMeals.reduce((s, m) => s + (m.plan_meal_foods || []).reduce((ss, f) => ss + (f.kcal || 0), 0), 0)

  if (loading) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'#111'}}>Piano alimentare</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center',color:'#888780'}}>
          <i className="ti ti-loader" style={{fontSize:32,display:'block',marginBottom:8,color:'#D4570A'}}/>
          Caricamento piano...
        </div>
      </div>
    </>
  )

  if (noplan) return (
    <>
      <div style={s.topbar}><div style={{fontSize:15,fontWeight:500,color:'#111'}}>Piano alimentare</div></div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center',maxWidth:300}}>
          <i className="ti ti-clipboard-x" style={{fontSize:48,color:'#E0DDD6',display:'block',marginBottom:16}}/>
          <div style={{fontSize:15,fontWeight:500,color:'#111',marginBottom:8}}>Nessun piano attivo</div>
          <div style={{fontSize:13,color:'#888780',lineHeight:1.6}}>Il tuo coach non ha ancora assegnato un piano alimentare. Contattalo per maggiori informazioni.</div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Piano alimentare</div>
          <div style={{fontSize:12,color:'#888780'}}>{plan?.title} — Settimana {plan?.week_number}</div>
        </div>
        <span style={s.badge}>{plan?.kcal_target?.toLocaleString('it-IT')} kcal/giorno</span>
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

        {/* Riepilogo macro */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          {[
            { label:'Calorie', val:plan?.kcal_target?.toLocaleString('it-IT'), unit:'kcal' },
            { label:'Proteine', val:plan?.protein_target_g, unit:'g' },
            { label:'Carboidrati', val:plan?.carbs_target_g, unit:'g' },
            { label:'Grassi', val:plan?.fat_target_g, unit:'g' },
          ].map(m => (
            <div key={m.label} style={s.card}>
              <div style={{fontSize:10,color:'#888780',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{m.label}</div>
              <div style={{fontSize:20,fontWeight:500,color:'#111'}}>{m.val}<span style={{fontSize:12,color:'#888780'}}>{m.unit}</span></div>
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
            <div style={{fontSize:13,color:'#888780'}}>Nessun pasto per questo giorno.</div>
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
                    <div style={{fontSize:13,fontWeight:500,color:'#111',textTransform:'capitalize'}}>{meal.meal_type}</div>
                    {meal.coach_note && <div style={{fontSize:11,color:'#888780'}}>{meal.coach_note}</div>}
                  </div>
                  {mealKcal > 0 && <span style={{...s.badge,fontSize:11}}>{mealKcal} kcal</span>}
                  <i className={`ti ti-chevron-down`} style={{fontSize:15,color:'#888780',transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
                </div>

                {isOpen && (
                  <div style={s.mealBody}>
                    {foods.map((food, fi) => (
                      <div key={fi} style={s.foodRow}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:'#111'}}>{food.food_name}</div>
                          {food.brand && <div style={{fontSize:11,color:'#888780'}}>{food.brand}</div>}
                        </div>
                        <div style={{fontSize:12,color:'#888780',marginRight:8}}>{food.quantity_g}g</div>
                        <div style={{display:'flex',gap:4}}>
                          <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A'}}>P {food.protein_g}g</span>
                          <span style={{...s.tag,background:'#FEF0E7',color:'#F4894A'}}>C {food.carbs_g}g</span>
                          <span style={{...s.tag,background:'#F5F3EF',color:'#888780'}}>G {food.fat_g}g</span>
                        </div>
                      </div>
                    ))}
                    {foods.length > 0 && (
                      <div style={{display:'flex',gap:16,padding:'10px 0',borderTop:'0.5px solid #F5F3EF'}}>
                        <span style={{fontSize:11,color:'#888780'}}>Totale pasto:</span>
                        <span style={{fontSize:11,color:'#D4570A',fontWeight:500}}>{mealKcal} kcal</span>
                        <span style={{fontSize:11,color:'#888780'}}>P {mealP}g · C {mealC}g · G {mealG}g</span>
                      </div>
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

