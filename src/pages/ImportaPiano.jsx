import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:9, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  tag: { display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:12, fontSize:11, fontWeight:600 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:9, padding:'11px 20px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:9, padding:'11px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
}

export default function ImportaPiano() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
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
  const [rawText, setRawText] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  async function elabora() {
    setError('')
    if (rawText.trim().length < 20) { setError('Incolla il testo del piano alimentare.'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent: rawText })
      })

      // Leggi prima come testo per gestire errori non-JSON di Vercel
      const text = await r.text()
      let data
      try {
        data = JSON.parse(text)
      } catch(e) {
        // Vercel ha restituito un errore non-JSON (es. timeout, crash)
        if (text.includes('FUNCTION_INVOCATION_TIMEOUT') || text.includes('timeout')) {
          throw new Error('Elaborazione troppo lunga. Prova con un piano più corto o dividi in più parti.')
        }
        throw new Error('Errore server. Riprova tra qualche secondo.')
      }

      if (!r.ok) throw new Error(data.error || 'Errore elaborazione')
      if (!data.plan) throw new Error('Piano non riconosciuto. Riprova.')

      const plan = data.plan
      setParsedPlan(plan)
      setPlanTitle(plan.titolo || 'Piano alimentare')
      setPlanNotes(plan.note_generali || '')
      setTargets({
        kcal_target: plan.kcal_totali || 2000,
        protein_target_g: plan.proteine_g || 150,
        carbs_target_g: plan.carboidrati_g || 200,
        fat_target_g: plan.grassi_g || 65,
      })
      setStep(2)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  async function savePlan() {
    if (!selectedClient) { setError('Seleziona un cliente'); return }
    setSaving(true)
    setError('')
    try {
      await supabase.from('meal_plans').update({ is_active:false }).eq('client_id', selectedClient)

      const { data: planData, error: planErr } = await supabase.from('meal_plans').insert({
        client_id: selectedClient, created_by: profile.id, title: planTitle,
        week_number: 1,
        kcal_target: Math.round(parseInt(targets.kcal_target)||2000),
        protein_target_g: Math.round(parseInt(targets.protein_target_g)||150),
        carbs_target_g: Math.round(parseInt(targets.carbs_target_g)||200),
        fat_target_g: Math.round(parseInt(targets.fat_target_g)||65),
        notes: planNotes,
        diet_type: parsedPlan.diet_type || 'lineare',
        is_active: true,
        weekly_macro_targets: weeklyTargets.length > 0 ? weeklyTargets : null,
        plan_start_date: weeklyTargets.length > 0 ? planStartDate : null,
      }).select().single()
      if (planErr) throw planErr

      const varianti = parsedPlan.varianti || []
      for (let dayIdx = 0; dayIdx < varianti.length; dayIdx++) {
        const variante = varianti[dayIdx]
        const pasti = variante.pasti || []
        for (let mealIdx = 0; mealIdx < pasti.length; mealIdx++) {
          const pasto = pasti[mealIdx]
          const { data: mealData, error: mealErr } = await supabase.from('plan_meals').insert({
            plan_id: planData.id,
            day_of_week: dayIdx + 1,
            meal_type: pasto.tipo || 'altro',
            meal_name: pasto.nome,
            scheduled_time: pasto.orario || null,
            meal_order: mealIdx,
            day_label: variante.nome,
            day_kcal_target: Math.round(variante.kcal) || null,
            day_protein_target_g: Math.round(variante.proteine_g) || null,
            day_carbs_target_g: Math.round(variante.carboidrati_g) || null,
            day_fat_target_g: Math.round(variante.grassi_g) || null,
          }).select().single()
          if (mealErr) throw mealErr

          if (pasto.alimenti?.length > 0) {
            const foods = pasto.alimenti.map((a, i) => ({
              plan_meal_id: mealData.id,
              food_name: a.nome || 'Alimento',
              quantity_g: Math.round(parseFloat(a.quantita_g) || 100),
              kcal: Math.round(parseFloat(a.kcal) || 0),
              protein_g: parseFloat(a.proteine_g) || 0,
              carbs_g: parseFloat(a.carboidrati_g) || 0,
              fat_g: parseFloat(a.grassi_g) || 0,
              sort_order: i,
              options: (a.opzioni||[]).map(o => ({
                food_name: o.nome || 'Alternativa',
                quantity_g: Math.round(parseFloat(o.quantita_g) || 100),
                kcal: Math.round(parseFloat(o.kcal) || 0),
                protein_g: parseFloat(o.proteine_g) || 0,
                carbs_g: parseFloat(o.carboidrati_g) || 0,
                fat_g: parseFloat(o.grassi_g) || 0,
              })),
            }))
            const { error: foodErr } = await supabase.from('plan_meal_foods').insert(foods)
            if (foodErr) throw foodErr
          }
        }
      }

      navigate('/admin')
    } catch(e) {
      setError('Errore salvataggio: ' + e.message)
    }
    setSaving(false)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',background:'#F5F3EF'}}>
      {/* TOPBAR */}
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'0 16px',height:56,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button onClick={()=>step===2?setStep(1):navigate('/admin')} style={{width:34,height:34,borderRadius:9,border:'0.5px solid #E0DDD6',background:'#F5F3EF',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#111'}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'#111'}}>Importa piano alimentare</div>
          <div style={{fontSize:11,color:'#888780'}}>Passo {step} di 2</div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{height:3,background:'#E0DDD6',flexShrink:0}}>
        <div style={{height:3,background:'#D4570A',width:step===1?'50%':'100%',transition:'width 0.3s'}}/>
      </div>

      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'16px'}}>

        {/* ERRORE */}
        {error && (
          <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#E24B4A'}}>
            ⚠️ {error}
          </div>
        )}

        {/* ── STEP 1 — INCOLLA TESTO ── */}
        {step === 1 && <>
          <div style={s.card}>
            <div style={{fontSize:16,fontWeight:700,color:'#111',marginBottom:4}}>📋 Piano del nutrizionista</div>
            <div style={{fontSize:12,color:'#888780',marginBottom:14,lineHeight:1.6}}>
              Copia e incolla il piano alimentare del nutrizionista. Può essere in qualsiasi formato — testo, tabella, PDF copiato. L'AI lo struttura automaticamente.
            </div>
            <label style={s.label}>Testo del piano</label>
            <textarea
              value={rawText}
              onChange={e=>setRawText(e.target.value)}
              placeholder="Incolla qui il piano alimentare completo..."
              style={{...s.input, minHeight:320, resize:'vertical', lineHeight:1.6, fontSize:12}}
            />
            <div style={{fontSize:11,color:'#888780',marginTop:6}}>{rawText.length} caratteri</div>
          </div>

          <button onClick={elabora} disabled={loading||rawText.trim().length<20} style={{...s.btn,width:'100%',justifyContent:'center',padding:'14px',fontSize:14,opacity:rawText.trim().length<20?0.5:1}}>
            {loading ? <>
              <i className="ti ti-loader-2" style={{fontSize:15}}/>
              Elaborazione in corso... (~30 secondi)
            </> : <>
              <i className="ti ti-wand" style={{fontSize:15}}/>
              Elabora piano
            </>}
          </button>
        </>}

        {/* ── STEP 2 — ANTEPRIMA E ASSEGNA ── */}
        {step === 2 && parsedPlan && <>
          {/* CONFERMA ELABORAZIONE */}
          <div style={{background:'#EAF3DE',border:'0.5px solid #3B6D11',borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:'#3B6D11',marginBottom:4}}>
              ✓ Piano elaborato — {parsedPlan.varianti?.length} giorni · {parsedPlan.varianti?.reduce((s,v)=>s+(v.pasti?.length||0),0)} pasti totali
            </div>
            <div style={{display:'flex',gap:12,fontSize:12,color:'#3B6D11'}}>
              <span>{Math.round(parsedPlan.kcal_totali||0)} kcal</span>
              <span>P {Math.round(parsedPlan.proteine_g||0)}g</span>
              <span>C {Math.round(parsedPlan.carboidrati_g||0)}g</span>
              <span>G {Math.round(parsedPlan.grassi_g||0)}g</span>
            </div>
          </div>

          {/* ASSEGNA CLIENTE */}
          <div style={s.card}>
            <label style={s.label}>Assegna a cliente</label>
            <select value={selectedClient} onChange={e=>setSelectedClient(e.target.value)} style={{...s.input,marginBottom:12}}>
              <option value="">Seleziona cliente...</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <label style={s.label}>Titolo piano</label>
            <input style={{...s.input,marginBottom:12}} value={planTitle} onChange={e=>setPlanTitle(e.target.value)}/>
            <label style={s.label}>Note per il cliente</label>
            <textarea style={{...s.input,minHeight:70,resize:'vertical'}} value={planNotes} onChange={e=>setPlanNotes(e.target.value)}/>
          </div>

          {/* MACRO TARGET */}
          <div style={s.card}>
            <label style={s.label}>Target macro giornalieri</label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                {k:'kcal_target',l:'Kcal'},
                {k:'protein_target_g',l:'Proteine (g)'},
                {k:'carbs_target_g',l:'Carbo (g)'},
                {k:'fat_target_g',l:'Grassi (g)'},
              ].map(({k,l})=>(
                <div key={k}>
                  <label style={s.label}>{l}</label>
                  <input style={s.input} type="number" value={targets[k]||''} onChange={e=>setTargets(p=>({...p,[k]:parseInt(e.target.value)||0}))}/>
                </div>
              ))}
            </div>
          </div>

          {/* ANTEPRIMA GIORNI */}
          {parsedPlan.varianti?.map((v, vi) => (
            <div key={vi} style={s.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:'#111'}}>{v.nome}</div>
                <div style={{display:'flex',gap:6}}>
                  {v.kcal && <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A'}}>{Math.round(v.kcal)} kcal</span>}
                  {v.proteine_g && <span style={{...s.tag,background:'#EBF3FD',color:'#4A90D4'}}>P{Math.round(v.proteine_g)}g</span>}
                </div>
              </div>
              {(v.pasti||[]).map((p2, pi) => (
                <div key={pi} style={{padding:'8px 0',borderBottom:'0.5px solid #F0EDE8'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#D4570A',marginBottom:4}}>{p2.nome}</div>
                  {(p2.alimenti||[]).map((a, ai) => (
                    <div key={ai} style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888780',padding:'2px 0'}}>
                      <span>{a.nome} <span style={{color:'#BBB8B0'}}>{a.quantita_g}g</span></span>
                      <div style={{display:'flex',gap:6}}>
                        <span>{a.kcal} kcal</span>
                        {a.proteine_g>0&&<span style={{color:'#4A90D4'}}>P{a.proteine_g}g</span>}
                        {a.opzioni?.length>0&&<span style={{...s.tag,background:'#F5F3EF',color:'#888780',padding:'1px 6px'}}>+{a.opzioni.length} alt.</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          {/* BOTTONE SALVA */}
          <button onClick={savePlan} disabled={!selectedClient||saving} style={{...s.btn,width:'100%',justifyContent:'center',padding:'14px',fontSize:14,opacity:!selectedClient?0.5:1,marginBottom:20}}>
            {saving ? <>
              <i className="ti ti-loader-2" style={{fontSize:15}}/>
              Salvataggio...
            </> : <>
              <i className="ti ti-check" style={{fontSize:15}}/>
              Salva piano per {clients.find(c=>c.id===selectedClient)?.full_name||'il cliente'}
            </>}
          </button>
        </>}
      </div>
    </div>
  )
}
