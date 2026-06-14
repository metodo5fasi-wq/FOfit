import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }
const DAY_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'18px', marginBottom:14 },
  cardTitle: { fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:7, marginBottom:14 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'10px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  textarea: { width:'100%', padding:'12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  mealCard: { border:'0.5px solid #E0DDD6', borderRadius:10, overflow:'hidden', marginBottom:10 },
  mealHeader: { background:'#FEF0E7', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 },
  foodRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'0.5px solid #F5F3EF' },
  tag: { fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500 },
  step: { display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 },
  stepNum: { width:28, height:28, borderRadius:'50%', background:'#D4570A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'white', flexShrink:0 },
  dayBtn: { width:34, height:34, borderRadius:8, border:'0.5px solid #E0DDD6', background:'white', color:'#888780', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex',alignItems:'center',justifyContent:'center' },
  dayBtnActive: { width:34, height:34, borderRadius:8, border:'0.5px solid #D4570A', background:'#D4570A', color:'white', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex',alignItems:'center',justifyContent:'center' },
}

export default function ImportaPiano() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsedPlan, setParsedPlan] = useState(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [weekNumber, setWeekNumber] = useState(1)
  const [planTitle, setPlanTitle] = useState('Piano alimentare')
  const [planNotes, setPlanNotes] = useState('')
  const [dayAssign, setDayAssign] = useState({}) // { 1: 0, 2: 1, ... } giorno -> indice variante
  const [expandedVariant, setExpandedVariant] = useState(0)
  const [targets, setTargets] = useState({ kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65 })

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  async function elabora() {
    if (!rawText.trim() || rawText.trim().length < 50) {
      setError('Incolla il testo del piano alimentare prima di procedere.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent: rawText })
      })
      const text = await response.text()
      if (!text || text.trim() === '') throw new Error('Risposta vuota. Riprova.')
      let result
      try { result = JSON.parse(text) } catch(e) { throw new Error('Risposta non valida. Riprova.') }
      if (!response.ok) throw new Error(result.error || 'Errore API')
      if (!result.plan?.varianti?.length) throw new Error('Nessun piano ricevuto. Riprova.')

      const plan = result.plan
      setParsedPlan(plan)
      setPlanTitle(plan.titolo || 'Piano alimentare')
      setPlanNotes(plan.note_generali || '')
      setTargets({
        kcal_target: plan.kcal_totali || 2000,
        protein_target_g: plan.proteine_g || 150,
        carbs_target_g: plan.carboidrati_g || 200,
        fat_target_g: plan.grassi_g || 65,
      })

      // Assegnazione automatica giorni
      const assign = {}
      if (plan.varianti.length === 1) {
        // Piano unico — tutti i giorni usano variante 0
        for (let d=1; d<=7; d++) assign[d] = 0
      } else if (plan.varianti.every(v => v.dayNum)) {
        // Piano giorno per giorno — ogni variante ha già il suo dayNum
        plan.varianti.forEach((v, idx) => { if (v.dayNum) assign[v.dayNum] = idx })
      } else if (plan.varianti.length === 2) {
        // 2 varianti (es. ON/OFF): più kcal -> Lun/Mer/Ven/Sab, meno -> Mar/Gio/Dom
        const onIdx = plan.varianti[0].kcal >= plan.varianti[1].kcal ? 0 : 1
        const offIdx = onIdx === 0 ? 1 : 0
        ;[1,3,5,6].forEach(d => assign[d] = onIdx)
        ;[2,4,7].forEach(d => assign[d] = offIdx)
      } else {
        for (let d=1; d<=7; d++) assign[d] = 0
      }
      setDayAssign(assign)
      setExpandedVariant(0)
      setStep(2)
    } catch(e) {
      setError('Errore: ' + e.message)
    }
    setLoading(false)
  }

  function toggleDay(day, variantIdx) {
    setDayAssign(prev => {
      const next = { ...prev }
      if (next[day] === variantIdx) delete next[day]
      else next[day] = variantIdx
      return next
    })
  }

  const macroKcal = t => (parseInt(t.protein_target_g||0)*4+parseInt(t.carbs_target_g||0)*4+parseInt(t.fat_target_g||0)*9)

  function handleKcalChange(newKcal) {
    setTargets(t => {
      const kcalNum = parseInt(newKcal) || 0
      const currentTotal = macroKcal(t)
      if (currentTotal === 0) {
        return { ...t, kcal_target:newKcal, protein_target_g:Math.round(kcalNum*0.30/4), carbs_target_g:Math.round(kcalNum*0.40/4), fat_target_g:Math.round(kcalNum*0.30/9) }
      }
      const ratio = kcalNum / currentTotal
      return { ...t, kcal_target:newKcal,
        protein_target_g: Math.round((parseInt(t.protein_target_g)||0)*ratio),
        carbs_target_g: Math.round((parseInt(t.carbs_target_g)||0)*ratio),
        fat_target_g: Math.round((parseInt(t.fat_target_g)||0)*ratio) }
    })
  }
  function handleMacroChange(field, value) {
    setTargets(t => { const u = {...t, [field]:value}; u.kcal_target = macroKcal(u); return u })
  }

  async function savePlan() {
    if (!selectedClient) { setError('Seleziona un cliente'); return }
    setSaving(true)
    setError('')

    try {
      const { data: planData, error: planErr } = await supabase.from('meal_plans').insert({
        client_id: selectedClient,
        created_by: profile.id,
        title: planTitle,
        week_number: parseInt(weekNumber),
        kcal_target: parseInt(targets.kcal_target) || 2000,
        protein_target_g: parseInt(targets.protein_target_g) || 150,
        carbs_target_g: parseInt(targets.carbs_target_g) || 200,
        fat_target_g: parseInt(targets.fat_target_g) || 65,
        notes: planNotes,
        is_active: true,
      }).select().single()

      if (planErr) throw planErr

      for (let day = 1; day <= 7; day++) {
        const vIdx = dayAssign[day]
        if (vIdx === undefined) continue
        const variante = parsedPlan.varianti[vIdx]
        if (!variante) continue

        for (let idx = 0; idx < (variante.pasti || []).length; idx++) {
          const pasto = variante.pasti[idx]
          const { data: mealData, error: mealErr } = await supabase.from('plan_meals').insert({
            plan_id: planData.id,
            day_of_week: day,
            meal_type: pasto.tipo || 'altro',
            meal_order: idx,
            coach_note: '',
            alternatives: pasto.alternative || [],
            day_label: variante.nome,
            day_kcal_target: variante.kcal,
            day_protein_target_g: variante.proteine_g,
            day_carbs_target_g: variante.carboidrati_g,
            day_fat_target_g: variante.grassi_g,
          }).select().single()

          if (mealErr) throw mealErr

          if (pasto.alimenti?.length > 0) {
            const foods = pasto.alimenti.map((a, i) => ({
              plan_meal_id: mealData.id,
              food_name: a.nome || 'Alimento',
              brand: a.marca || '',
              quantity_g: a.quantita_g || 100,
              kcal: a.kcal || 0,
              protein_g: a.proteine_g || 0,
              carbs_g: a.carboidrati_g || 0,
              fat_g: a.grassi_g || 0,
              sort_order: i,
              options: (a.opzioni || []).map(o => ({
                food_name: o.nome || 'Alimento',
                quantity_g: o.quantita_g || 100,
                kcal: o.kcal || 0,
                protein_g: o.proteine_g || 0,
                carbs_g: o.carboidrati_g || 0,
                fat_g: o.grassi_g || 0,
              })),
            }))
            const { error: foodErr } = await supabase.from('plan_meal_foods').insert(foods)
            if (foodErr) throw foodErr
          }
        }
      }

      // Integratori
      if (parsedPlan.integratori?.length > 0) {
        const supps = parsedPlan.integratori.map((sup, i) => ({
          plan_id: planData.id,
          timing_label: sup.momento || '',
          name: sup.nome || '',
          dosage: sup.dosaggio || '',
          link: sup.link || '',
          notes: sup.note || '',
          order_index: i,
        }))
        await supabase.from('plan_supplements').insert(supps)
      }

      setStep(3)
    } catch(e) {
      setError('Errore salvataggio: ' + e.message)
    }
    setSaving(false)
  }

  function reset() {
    setStep(1); setParsedPlan(null); setRawText(''); setError('')
    setSelectedClient(''); setWeekNumber(1); setPlanTitle('Piano alimentare'); setPlanNotes('')
    setDayAssign({}); setExpandedVariant(0)
    setTargets({ kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65 })
  }

  const unassignedDays = [1,2,3,4,5,6,7].filter(d => dayAssign[d] === undefined)

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Importa piano alimentare</div>
          <div style={{fontSize:12,color:'#888780'}}>Incolla il testo del Word — l'AI lo struttura automaticamente</div>
        </div>
        {step===2 && <button style={s.btnGray} onClick={reset}>← Ricomincia</button>}
      </div>

      <div style={s.page}>

        {/* STEP INDICATOR */}
        <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:20}}>
          {[{n:1,label:'Incolla testo'},{n:2,label:'Anteprima'},{n:3,label:'Pubblicato'}].map((st,i)=>(
            <React.Fragment key={st.n}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:step>=st.n?'#D4570A':'#E0DDD6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'white'}}>
                  {step>st.n?<i className="ti ti-check" style={{fontSize:13}}/>:st.n}
                </div>
                <span style={{fontSize:12,fontWeight:step===st.n?500:400,color:step>=st.n?'#111':'#888780'}}>{st.label}</span>
              </div>
              {i<2&&<div style={{flex:1,height:1,background:step>st.n?'#D4570A':'#E0DDD6',margin:'0 12px',maxWidth:60}}/>}
            </React.Fragment>
          ))}
        </div>

        {/* STEP 1 */}
        {step===1 && (
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-clipboard-text" style={{fontSize:16,color:'#D4570A'}}/> Incolla il piano alimentare</div>

            <div style={{marginBottom:20}}>
              {[
                'Apri il file Word/PDF del nutrizionista',
                'Seleziona tutto il testo (Ctrl+A)',
                'Copia (Ctrl+C)',
                'Incolla qui sotto (Ctrl+V) e clicca "Elabora con AI"'
              ].map((t,i)=>(
                <div key={i} style={s.step}>
                  <div style={s.stepNum}>{i+1}</div>
                  <div style={{fontSize:13,color:'#111',paddingTop:4,lineHeight:1.5}}>{t}</div>
                </div>
              ))}
            </div>

            <div style={{background:'#FEF0E7',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#7a3508',lineHeight:1.6}}>
              <i className="ti ti-bulb" style={{fontSize:13,marginRight:5}}/>
              Il sistema rileva automaticamente varianti ON/OFF, alternative tra alimenti ("/"), modulo integratori e note generali — se presenti nel testo. Per piani con più fasi (es. Week1/Week2/Week4), incolla una fase alla volta: quando il cliente avanza, reimporta la fase successiva.
            </div>

            <div style={{marginBottom:14}}>
              <label style={s.label}>Testo del piano alimentare *</label>
              <textarea
                style={{...s.textarea, height:280}}
                placeholder="Incolla qui il testo copiato dal documento del nutrizionista..."
                value={rawText}
                onChange={e=>setRawText(e.target.value)}
              />
              <div style={{fontSize:11,color:'#888780',marginTop:4,textAlign:'right'}}>{rawText.length} caratteri</div>
            </div>

            {error && <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#9B1C1C',marginBottom:12}}>{error}</div>}

            <button style={{...s.btn, width:'100%', justifyContent:'center'}} onClick={elabora} disabled={loading||rawText.trim().length<50}>
              {loading ? (
                <><div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> L'AI sta elaborando il piano...</>
              ) : (
                <><i className="ti ti-sparkles" style={{fontSize:15}}/> Elabora con AI</>
              )}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step===2 && parsedPlan && (
          <>
            <div style={{background:'#EAF3DE',border:'0.5px solid #3B6D11',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
              <i className="ti ti-sparkles" style={{fontSize:20,color:'#3B6D11',flexShrink:0}}/>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:'#3B6D11'}}>Piano elaborato con successo!</div>
                <div style={{fontSize:12,color:'#3B6D11',opacity:0.8}}>
                  {parsedPlan.varianti.length} variante{parsedPlan.varianti.length!==1?'i':''} rilevata{parsedPlan.varianti.length!==1?'e':''}
                  {parsedPlan.integratori?.length>0 && ` · ${parsedPlan.integratori.length} integratori`}
                  {planNotes && ` · note generali presenti`}
                </div>
              </div>
            </div>

            {/* CONFIGURAZIONE GENERALE */}
            <div style={s.card}>
              <div style={s.cardTitle}><i className="ti ti-settings" style={{fontSize:16,color:'#D4570A'}}/> Configurazione</div>
              <div style={s.grid2}>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Assegna a cliente *</label>
                  <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                    <option value="">Seleziona cliente...</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Numero settimana</label>
                  <input style={s.input} type="number" value={weekNumber} onChange={e=>setWeekNumber(e.target.value)} min={1}/>
                </div>
                <div style={{marginBottom:12, gridColumn:'1 / -1'}}>
                  <label style={s.label}>Titolo piano</label>
                  <input style={s.input} value={planTitle} onChange={e=>setPlanTitle(e.target.value)}/>
                </div>
              </div>

              {/* TARGET CON SYNC BIDIREZIONALE */}
              <div style={{marginBottom:12}}>
                <label style={s.label}>Calorie target medie (kcal/giorno)</label>
                <input style={s.input} type="number" value={targets.kcal_target} onChange={e=>handleKcalChange(e.target.value)}/>
                <div style={{fontSize:11,color:'#888780',marginTop:5}}>
                  <i className="ti ti-refresh" style={{fontSize:12,marginRight:4}}/>Modificando le kcal, i macro si riproporzionano automaticamente
                </div>
              </div>
              <div style={s.grid2}>
                <div style={{marginBottom:12}}><label style={s.label}>Proteine (g)</label><input style={s.input} type="number" value={targets.protein_target_g} onChange={e=>handleMacroChange('protein_target_g',e.target.value)}/></div>
                <div style={{marginBottom:12}}><label style={s.label}>Carboidrati (g)</label><input style={s.input} type="number" value={targets.carbs_target_g} onChange={e=>handleMacroChange('carbs_target_g',e.target.value)}/></div>
                <div style={{marginBottom:12}}><label style={s.label}>Grassi (g)</label><input style={s.input} type="number" value={targets.fat_target_g} onChange={e=>handleMacroChange('fat_target_g',e.target.value)}/></div>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Totale da macro</label>
                  <div style={{padding:'9px 12px',background:'#EAF3DE',borderRadius:8,fontSize:13,color:'#3B6D11',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                    <i className="ti ti-check" style={{fontSize:14}}/>{macroKcal(targets)} kcal
                  </div>
                </div>
              </div>

              <div>
                <label style={s.label}>Note generali per il cliente</label>
                <textarea style={{...s.textarea,height:80}} value={planNotes} onChange={e=>setPlanNotes(e.target.value)} placeholder="Note generali, regole, indicazioni..."/>
              </div>
            </div>

            {/* VARIANTI E ASSEGNAZIONE GIORNI */}
            <div style={s.card}>
              <div style={s.cardTitle}><i className="ti ti-calendar-event" style={{fontSize:16,color:'#D4570A'}}/> Varianti e giorni della settimana</div>
              <div style={{fontSize:12,color:'#888780',marginBottom:14,lineHeight:1.6}}>
                Per ogni variante, scegli a quali giorni della settimana si applica. Clicca sull'intestazione per vedere i pasti.
              </div>

              {unassignedDays.length > 0 && (
                <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#9B1C1C',marginBottom:14}}>
                  <i className="ti ti-alert-triangle" style={{fontSize:13,marginRight:5}}/>
                  Giorni senza variante assegnata: {unassignedDays.map(d=>DAY_NAMES[d-1]).join(', ')} — quel giorno non avrà pasti nell'app.
                </div>
              )}

              {parsedPlan.varianti.map((variante, vi) => {
                const isExpanded = expandedVariant === vi
                const assignedDays = [1,2,3,4,5,6,7].filter(d => dayAssign[d] === vi)
                return (
                  <div key={vi} style={{...s.mealCard, marginBottom:14}}>
                    <div onClick={()=>setExpandedVariant(isExpanded?-1:vi)} style={{...s.mealHeader, cursor:'pointer'}}>
                      <i className="ti ti-clipboard-list" style={{fontSize:16,color:'#D4570A'}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#D4570A'}}>{variante.nome}</div>
                        <div style={{fontSize:11,color:'#888780',marginTop:2}}>{variante.kcal} kcal · P{variante.proteine_g}g C{variante.carboidrati_g}g G{variante.grassi_g}g · {variante.pasti?.length||0} pasti</div>
                      </div>
                      <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{fontSize:15,color:'#888780'}}/>
                    </div>

                    {/* DAY PICKER */}
                    <div style={{padding:'12px 14px',display:'flex',gap:6,flexWrap:'wrap',borderBottom:isExpanded?'0.5px solid #E0DDD6':'none'}}>
                      {DAY_NAMES.map((dn, i) => {
                        const day = i+1
                        const active = dayAssign[day] === vi
                        return (
                          <button key={day} onClick={()=>toggleDay(day, vi)} style={active?s.dayBtnActive:s.dayBtn}>{dn}</button>
                        )
                      })}
                      {assignedDays.length>0 && <span style={{fontSize:11,color:'#3B6D11',alignSelf:'center',marginLeft:6}}><i className="ti ti-check" style={{fontSize:12}}/> {assignedDays.length} giorni</span>}
                    </div>

                    {/* PASTI PREVIEW */}
                    {isExpanded && (
                      <div style={{padding:'10px 14px'}}>
                        {variante.pasti?.map((pasto,pi)=>{
                          const mealKcal = (pasto.alimenti||[]).reduce((s,a)=>s+(a.kcal||0),0)
                          return (
                          <div key={pi} style={{marginBottom:10,border:'0.5px solid #F5F3EF',borderRadius:8,overflow:'hidden'}}>
                            <div style={{background:'#F5F3EF',padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
                              <i className={`ti ${MEAL_ICONS[pasto.tipo]||'ti-circle'}`} style={{fontSize:14,color:'#D4570A'}}/>
                              <div style={{flex:1,fontSize:12,fontWeight:600,color:'#111',textTransform:'capitalize'}}>{pasto.nome}</div>
                              <span style={{fontSize:11,color:'#D4570A',fontWeight:500}}>{Math.round(mealKcal)} kcal</span>
                            </div>
                            {pasto.alimenti?.map((al,ai)=>(
                              <div key={ai} style={{padding:'7px 12px',borderTop:'0.5px solid #F5F3EF'}}>
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <div style={{width:5,height:5,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                                  <div style={{flex:1,fontSize:12,color:'#111'}}>{al.nome} <span style={{color:'#888780'}}>{al.quantita_g}g</span></div>
                                  <div style={{display:'flex',gap:3}}>
                                    <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A'}}>P{al.proteine_g}</span>
                                    <span style={{...s.tag,background:'#FEF0E7',color:'#F4894A'}}>C{al.carboidrati_g}</span>
                                    <span style={{...s.tag,background:'#F5F3EF',color:'#888780'}}>G{al.grassi_g}</span>
                                  </div>
                                </div>
                                {al.opzioni?.length>0 && (
                                  <div style={{marginLeft:13,marginTop:4,display:'flex',flexWrap:'wrap',gap:5}}>
                                    {al.opzioni.map((op,oi)=>(
                                      <span key={oi} style={{fontSize:10,color:'#888780',background:'#F5F3EF',padding:'2px 7px',borderRadius:8}}>
                                        <i className="ti ti-arrows-shuffle" style={{fontSize:9,marginRight:3}}/>{op.nome} {op.quantita_g}g
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {pasto.alternative?.length>0 && (
                              <div style={{padding:'7px 12px',borderTop:'0.5px solid #F5F3EF',fontSize:11,color:'#D4570A'}}>
                                <i className="ti ti-replace" style={{fontSize:12,marginRight:4}}/>
                                {pasto.alternative.length} alternativa{pasto.alternative.length!==1?'e':''} pasto intero
                              </div>
                            )}
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* INTEGRATORI */}
            {parsedPlan.integratori?.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}><i className="ti ti-pill" style={{fontSize:16,color:'#D4570A'}}/> Piano integratori ({parsedPlan.integratori.length})</div>
                {parsedPlan.integratori.map((sup,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid #F5F3EF'}}>
                    <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A',flexShrink:0}}>{sup.momento}</span>
                    <div style={{flex:1,fontSize:12,color:'#111'}}>{sup.nome} {sup.dosaggio && <span style={{color:'#888780'}}>· {sup.dosaggio}</span>}</div>
                    {sup.link && <i className="ti ti-link" style={{fontSize:13,color:'#888780'}}/>}
                  </div>
                ))}
              </div>
            )}

            {error&&<div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#9B1C1C',marginBottom:12}}>{error}</div>}

            <div style={{display:'flex',gap:10}}>
              <button style={s.btn} onClick={savePlan} disabled={saving||!selectedClient}>
                <i className="ti ti-rocket" style={{fontSize:15}}/> {saving?'Pubblicazione...':'Pubblica il piano'}
              </button>
              <button style={s.btnGray} onClick={reset}>Annulla</button>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step===3 && (
          <div style={{...s.card,textAlign:'center',padding:'50px 30px'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#EAF3DE',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <i className="ti ti-circle-check" style={{fontSize:36,color:'#3B6D11'}}/>
            </div>
            <div style={{fontSize:18,fontWeight:500,color:'#111',marginBottom:8}}>Piano pubblicato!</div>
            <div style={{fontSize:13,color:'#888780',marginBottom:6}}>Il piano è ora visibile al cliente nell'app FOfit.</div>
            <div style={{fontSize:12,color:'#888780',marginBottom:28}}>
              {targets.kcal_target} kcal/giorno · {clients.find(c=>c.id===selectedClient)?.full_name}
            </div>
            <button style={s.btn} onClick={reset}>
              <i className="ti ti-plus" style={{fontSize:15}}/> Importa un altro piano
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
