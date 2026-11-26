import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import PlanPdfButton from '../components/PlanPdfButton'
import { loadSWR, hasCache } from '../lib/offline'
import { Skeleton, LoadError, StaleNotice } from '../components/LoadStates'
import { useRefreshOnReturn } from '../lib/useRefreshOnReturn'
import { ClientNotesCard } from '../components/CoachNotes'
import { sortFoods } from '../lib/mealPlan'
import { normAlts, scaleChoices, foodKcal } from '../lib/alternatives'
import { describeOptions } from '../lib/altMeals'
import { equivalents, weekWindow } from '../lib/foodEquivalents'

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
  const today = (new Date().getDay() + 6) % 7                // 0 = lunedì … 6 = domenica
  const [selectedDay, setSelectedDay] = useState(today)      // si apre sul giorno di oggi
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

        {/* Note generali del coach: richiudibili, si aprono da sole se sono nuove o cambiate */}
        <ClientNotesCard planId={plan?.id} text={plan?.notes} />

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
            <div key={i} style={selectedDay===i ? s.dayTabActive : s.dayTab} onClick={() => { setSelectedDay(i); setOpenMeals({}) }} aria-current={i===today ? 'date' : undefined}>
              {i===today && <span aria-hidden="true" style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:selectedDay===i?'white':'#D4570A',marginRight:6,verticalAlign:1}}/>}{day}
            </div>
          ))}
        </div>

        {dayMeals.length > 0 && (() => {
          const all = dayMeals.flatMap(m => m.plan_meal_foods || [])
          const k = Math.round(all.reduce((a, f) => a + (Number(f.kcal) || 0), 0)), p = Math.round(all.reduce((a, f) => a + (Number(f.protein_g) || 0), 0)), c = Math.round(all.reduce((a, f) => a + (Number(f.carbs_g) || 0), 0)), g = Math.round(all.reduce((a, f) => a + (Number(f.fat_g) || 0), 0))
          return k > 0 ? <div data-testid="totale-giorno" style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'baseline',margin:'-4px 2px 12px',fontSize:12,color:'#AAA'}}><span>Totale {DAYS[selectedDay]}:</span><span style={{color:'#F4894A',fontWeight:600}}>{k.toLocaleString('it-IT')} kcal</span><span>P {p}g · C {c}g · G {g}g</span></div> : null
        })()}

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
            const foods = sortFoods(meal.plan_meal_foods)           // nell'ordine scelto dal coach
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
                      <div key={fi} style={{borderBottom:'0.5px solid #1A1A1A'}}>
                        <div style={{...s.foodRow, borderBottom:'none', paddingBottom:4}}>
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
                        <FoodAlternatives food={food} mealType={meal.meal_type} day={meal.day_of_week}/>
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
                    <AltMealOptions options={meal.alt_meals} mealKcal={mealKcal}/>
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

// «Vedi alternative» sotto ogni alimento. Se il coach ha scelto le alternative per quell'alimento si vedono quelle (a pari calorie, ricalcolate sulla quantità del piano);
// altrimenti sono proposte in automatico: alimenti adatti a quel pasto, stesse calorie, quantità tonde (il database alimenti si scarica solo alla prima apertura)
function FoodAlternatives({ food, mealType, day }) {
  const [open, setOpen] = React.useState(false)
  const [db, setDb] = React.useState(null), [failed, setFailed] = React.useState(false)
  const coach = React.useMemo(() => scaleChoices(food.alternatives, foodKcal(food)), [food])
  const byCoach = normAlts(food.alternatives).length > 0
  function toggle() {
    const next = !open; setOpen(next)
    if (next && !byCoach && !db && !failed) import('../data/foodDatabase.js').then(m => setDb(m.FOOD_DB || m.default || []), () => setFailed(true))
  }
  const res = React.useMemo(() => (open && !byCoach && db ? equivalents(food, db, { mealType, day }) : null), [open, byCoach, db, food, mealType, day])
  const MSG = { misto: 'Questo alimento è un piatto o un mix: non propongo equivalenze automatiche. Chiedi al tuo coach.', piccolo: 'La quantità è piccola: non serve un cambio preciso.', dati: 'Mancano i dati per calcolare le alternative.', pasto: 'Per questo pasto non propongo alternative automatiche. Chiedi al tuo coach.' }
  // le alternative scelte a mano dal coach (quantità fissata da lui) si vedono sempre; le altre ruotano nella settimana
  const coachShown = byCoach ? [...coach.filter(a => a.mode), ...weekWindow(coach.filter(a => !a.mode), day, mealType)] : []
  const list = byCoach ? coachShown.map(a => ({ grams: a.grams, name: a.name, brand: a.brand, kcal: a.kcal, dKcal: a.dKcal })) : (res?.ok ? res.items : [])
  const kcal0 = byCoach ? foodKcal(food) : res?.kcal
  return (
    <div style={{padding:'0 0 8px 16px'}}>
      <button onClick={toggle} aria-expanded={open} data-testid="vedi-alternative" style={{background:'none',border:'none',padding:'6px 4px',minHeight:32,cursor:'pointer',fontFamily:'inherit',fontSize:12,color:'#F4894A',display:'inline-flex',alignItems:'center',gap:5}}>
        <i className="ti ti-refresh" style={{fontSize:13}}/>{open ? 'Nascondi alternative' : 'Vedi alternative'}
      </button>
      {open && (
        <div data-testid="alternative-alimento" data-fonte={byCoach ? 'coach' : 'auto'} style={{background:'rgba(212,87,10,0.06)',border:'0.5px solid rgba(212,87,10,0.25)',borderRadius:8,padding:'8px 10px',marginTop:2}}>
          {!byCoach && failed && <div style={{fontSize:12,color:'#F07070'}}>Non riesco a caricare le alternative. Riprova tra poco.</div>}
          {!byCoach && !failed && !res && <div style={{fontSize:12,color:'#AAA'}}>Cerco le alternative…</div>}
          {res && !res.ok && <div style={{fontSize:12,color:'#AAA'}}>{MSG[res.reason] || MSG.misto}</div>}
          {(byCoach || res?.ok) && list.length === 0 && <div style={{fontSize:12,color:'#AAA'}}>Nessuna alternativa adatta trovata. Chiedi al tuo coach.</div>}
          {list.length > 0 && (
            <>
              <div style={{fontSize:11,color:'#CCC',marginBottom:6}}>{res?.equalGrams ? 'Si possono scambiare con la stessa quantità:' : `${byCoach ? 'Alternative scelte dal tuo coach' : 'Alternative'} · stesse calorie (≈ ${kcal0} kcal) · i macro possono cambiare:`}</div>
              {list.map((a, i) => (
                <div key={i} style={{display:'flex',alignItems:'baseline',gap:8,padding:'5px 0',borderTop:i?'0.5px solid rgba(212,87,10,0.12)':'none',fontSize:12}}>
                  <span style={{minWidth:46,fontWeight:600,color:'#F0F0F0'}}>{a.grams} g</span>
                  <span style={{flex:1,color:'#F0F0F0',wordBreak:'break-word'}}>{a.name}{a.brand ? <span style={{color:'#888'}}> · {a.brand}</span> : null}</span>
                  <span style={{color:'#AAA',whiteSpace:'nowrap'}}>{a.kcal} kcal <span style={{color:Math.abs(a.dKcal) <= 15 ? '#6FCF97' : '#E8C050'}}>({a.dKcal > 0 ? '+' : a.dKcal < 0 ? '−' : '±'}{Math.abs(a.dKcal)})</span></span>
                </div>
              ))}
              <div style={{fontSize:10,color:'#888',marginTop:6,lineHeight:1.4}}>{byCoach ? (coach.length > coachShown.length ? 'Quantità arrotondate per avere le stesse calorie. Il tuo coach ne ha scelte altre: cambiano nei vari giorni.' : 'Quantità arrotondate per avere le stesse calorie.') : 'Quantità arrotondate, calcolate in automatico: indicative. Per sostituzioni fisse nel piano chiedi al tuo coach.'}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Pasti alternativi scelti dal coach (Opzione B…): il cliente ne sceglie uno AL POSTO del pasto. Non entrano nei totali del giorno.
function AltMealOptions({ options, mealKcal }) {
  const [openId, setOpenId] = React.useState(null)
  const list = React.useMemo(() => describeOptions(options, mealKcal), [options, mealKcal])
  if (!list.length) return null
  return (
    <div data-testid="pasti-alternativi" style={{marginTop:8,paddingTop:8,borderTop:'0.5px dashed #2A2A2A'}}>
      <div style={{fontSize:11,color:'#AAA',fontWeight:500,marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
        <i className="ti ti-repeat" style={{fontSize:12,color:'#F4894A'}}/>
        Puoi scegliere anche questo, al posto del pasto
      </div>
      {list.map(o => (
        <div key={o.id} style={{marginBottom:6}}>
          <button onClick={()=>setOpenId(openId===o.id?null:o.id)} aria-expanded={openId===o.id} data-testid="opzione-pasto" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'8px 10px',borderRadius:8,border:'0.5px solid rgba(212,87,10,0.35)',background:openId===o.id?'rgba(212,87,10,0.14)':'rgba(212,87,10,0.10)',cursor:'pointer',fontFamily:'inherit'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#F4894A',textAlign:'left'}}>{o.name}</span>
            <span style={{fontSize:11,color:'#CCC',whiteSpace:'nowrap'}}>{o.totals.kcal} kcal <i className={`ti ti-chevron-${openId===o.id?'up':'down'}`} style={{fontSize:12,color:'#F4894A'}}/></span>
          </button>
          {openId === o.id && (
            <div style={{padding:'8px 10px',background:'rgba(212,87,10,0.10)',borderRadius:'0 0 8px 8px',border:'0.5px solid rgba(212,87,10,0.35)',borderTop:'none'}}>
              {o.foods.map((f, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.5px solid rgba(212,87,10,0.08)'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#F4894A',flexShrink:0}}/>
                  <div style={{flex:1,fontSize:12,color:'#F0F0F0'}}>{f.food_name}</div>
                  <div style={{fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{f.quantity_g} g</div>
                  <div style={{fontSize:10,color:'#AAA',minWidth:52,textAlign:'right'}}>{f.kcal} kcal</div>
                </div>
              ))}
              <div style={{fontSize:11,color:'#AAA',marginTop:6}}>Totale {o.totals.kcal} kcal · P {o.totals.p}g · C {o.totals.c}g · G {o.totals.g}g{o.dKcal != null && <span style={{color:Math.abs(o.dKcal) <= 50 ? '#6FCF97' : '#E8C050'}}> ({o.dKcal > 0 ? '+' : o.dKcal < 0 ? '−' : '±'}{Math.abs(o.dKcal)} kcal rispetto al pasto)</span>}</div>
              {o.note && <div style={{fontSize:11,color:'#E8A06A',marginTop:6,lineHeight:1.5}}>{o.note}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
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
