import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const MEAL_ICONS = { colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2', 'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle' }

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'18px', marginBottom:14 },
  cardTitle: { fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:7, marginBottom:14 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'10px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  textarea: { width:'100%', padding:'12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.6 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  mealCard: { border:'0.5px solid #E0DDD6', borderRadius:10, overflow:'hidden', marginBottom:10 },
  mealHeader: { background:'#FEF0E7', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 },
  foodRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'0.5px solid #F5F3EF' },
  tag: { fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500 },
  step: { display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 },
  stepNum: { width:28, height:28, borderRadius:'50%', background:'#D4570A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'white', flexShrink:0 },
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
      if (!result.plan) throw new Error('Nessun piano ricevuto. Riprova.')

      setParsedPlan(result.plan)
      setPlanTitle(result.plan.titolo || 'Piano alimentare')
      setPlanNotes(result.plan.note_generali || '')
      setStep(2)
    } catch(e) {
      setError('Errore: ' + e.message)
    }
    setLoading(false)
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
        kcal_target: parsedPlan.kcal_totali || 2000,
        protein_target_g: parsedPlan.proteine_g || 150,
        carbs_target_g: parsedPlan.carboidrati_g || 200,
        fat_target_g: parsedPlan.grassi_g || 65,
        notes: planNotes,
        is_active: true,
      }).select().single()

      if (planErr) throw planErr

      for (const giorno of parsedPlan.giorni || []) {
        for (let idx = 0; idx < (giorno.pasti || []).length; idx++) {
          const pasto = giorno.pasti[idx]
          const { data: mealData, error: mealErr } = await supabase.from('plan_meals').insert({
            plan_id: planData.id,
            day_of_week: giorno.giorno_numero,
            meal_type: pasto.tipo || 'altro',
            meal_order: idx,
            coach_note: giorno.nota_giorno || '',
            alternatives: pasto.alternative || [],
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
            }))
            const { error: foodErr } = await supabase.from('plan_meal_foods').insert(foods)
            if (foodErr) throw foodErr
          }
        }
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
  }

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
                'Apri il file Word della dottoressa',
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

            <div style={{marginBottom:14}}>
              <label style={s.label}>Testo del piano alimentare *</label>
              <textarea
                style={{...s.textarea, height:280}}
                placeholder="Incolla qui il testo copiato dal Word della dottoressa...

Esempio:
LUNEDÌ
Colazione: fiocchi d'avena 80g, latte 200ml, banana
Pranzo: petto di pollo 200g, riso 80g, verdure
Cena: salmone 180g, patate dolci 200g..."
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
                <div style={{fontSize:12,color:'#3B6D11',opacity:0.8}}>{parsedPlan.giorni?.length||0} giorni · {parsedPlan.kcal_totali||0} kcal/giorno</div>
              </div>
            </div>

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
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Titolo piano</label>
                  <input style={s.input} value={planTitle} onChange={e=>setPlanTitle(e.target.value)}/>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Kcal/giorno rilevate</label>
                  <div style={{padding:'9px 12px',background:'#FEF0E7',borderRadius:8,fontSize:13,color:'#D4570A',fontWeight:500}}>
                    {parsedPlan.kcal_totali||0} kcal · P{parsedPlan.proteine_g||0}g C{parsedPlan.carboidrati_g||0}g G{parsedPlan.grassi_g||0}g
                  </div>
                </div>
              </div>
              <div>
                <label style={s.label}>Note del coach</label>
                <textarea style={{...s.textarea,height:60}} value={planNotes} onChange={e=>setPlanNotes(e.target.value)} placeholder="Note generali per il cliente..."/>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}><i className="ti ti-eye" style={{fontSize:16,color:'#D4570A'}}/> Anteprima — {parsedPlan.giorni?.[0]?.giorno||'Giorno 1'}</div>
              <div style={{fontSize:12,color:'#888780',marginBottom:14}}>Tutti i {parsedPlan.giorni?.length} giorni sono stati importati.</div>
              {parsedPlan.giorni?.[0]?.pasti?.map((pasto,pi)=>(
                <div key={pi} style={s.mealCard}>
                  <div style={s.mealHeader}>
                    <i className={`ti ${MEAL_ICONS[pasto.tipo]||'ti-circle'}`} style={{fontSize:16,color:'#D4570A'}}/>
                    <div style={{flex:1,fontSize:13,fontWeight:500,color:'#D4570A',textTransform:'capitalize'}}>{pasto.nome}</div>
                    {pasto.orario&&<span style={{fontSize:11,color:'#F4894A',background:'rgba(244,137,74,0.15)',padding:'2px 8px',borderRadius:10}}>{pasto.orario}</span>}
                    <span style={{fontSize:12,color:'#D4570A',fontWeight:500}}>{pasto.kcal||0} kcal</span>
                  </div>
                  {pasto.alimenti?.map((al,ai)=>(
                    <div key={ai} style={s.foodRow}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <span style={{fontSize:13,color:'#111'}}>{al.nome}</span>
                        {al.marca&&<span style={{fontSize:11,color:'#888780',marginLeft:6}}>{al.marca}</span>}
                      </div>
                      <div style={{fontSize:12,color:'#888780',marginRight:8}}>{al.quantita_g}g</div>
                      <div style={{display:'flex',gap:4}}>
                        <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A'}}>P{al.proteine_g}g</span>
                        <span style={{...s.tag,background:'#FEF0E7',color:'#F4894A'}}>C{al.carboidrati_g}g</span>
                        <span style={{...s.tag,background:'#F5F3EF',color:'#888780'}}>G{al.grassi_g}g</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

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
              {parsedPlan?.giorni?.length||0} giorni · {parsedPlan?.kcal_totali||0} kcal/giorno · {clients.find(c=>c.id===selectedClient)?.full_name}
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
