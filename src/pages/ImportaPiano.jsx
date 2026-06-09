import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'18px', marginBottom:14 },
  cardTitle: { fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:7, marginBottom:14 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'9px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  mealCard: { border:'0.5px solid #E0DDD6', borderRadius:10, overflow:'hidden', marginBottom:10 },
  mealHeader: { background:'#FEF0E7', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 },
  mealTitle: { fontSize:13, fontWeight:500, color:'#D4570A', flex:1 },
  mealKcal: { fontSize:12, color:'#F4894A', fontWeight:500 },
  foodRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'0.5px solid #F5F3EF' },
  foodName: { flex:1, fontSize:13, color:'#111' },
  foodMacro: { fontSize:11, color:'#888780' },
  tag: { fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500 },
}

const MEAL_ICONS = {
  colazione:'ti-sun', spuntino:'ti-apple', pranzo:'ti-tools-kitchen-2',
  'pre-workout':'ti-bolt', cena:'ti-moon', merenda:'ti-apple', altro:'ti-circle'
}

export default function ImportaPiano() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [step, setStep] = useState(1) // 1=carica, 2=anteprima, 3=successo
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileText, setFileText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsedPlan, setParsedPlan] = useState(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [weekNumber, setWeekNumber] = useState(1)
  const [planTitle, setPlanTitle] = useState('Piano alimentare')
  const [planNotes, setPlanNotes] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) { setError('Carica un file Word (.docx)'); return }
    setFileName(file.name)
    setError('')
    setLoading(true)

    try {
      // Leggi il file come base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })

      // Manda all'API serverless di Vercel
      const response = await fetch('/api/parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Errore API')
      
      let plan = result.plan
      if (!plan) {
        // Prova a fare il parse se è una stringa
        if (typeof result === 'string') {
          const clean = result.replace(/```json|```/g, '').trim()
          plan = JSON.parse(clean)
        } else {
          throw new Error('Risposta vuota dal server. Riprova.')
        }
      }

      setParsedPlan(plan)
      setPlanTitle(plan.titolo || 'Piano alimentare')
      setPlanNotes(plan.note_generali || '')
      setStep(2)
    } catch(e) {
      setError('Errore nel caricamento: ' + e.message)
    }
    setLoading(false)
  }

  async function savePlan() {
    if (!selectedClient) { setError('Seleziona un cliente'); return }
    if (!parsedPlan) return
    setSaving(true)
    setError('')

    try {
      // 1. Crea il piano
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

      // 2. Per ogni giorno e pasto, crea i record
      for (const giorno of parsedPlan.giorni || []) {
        for (const pasto of giorno.pasti || []) {
          const { data: mealData, error: mealErr } = await supabase.from('plan_meals').insert({
            plan_id: planData.id,
            day_of_week: giorno.giorno_numero,
            meal_type: pasto.tipo || 'altro',
            meal_order: ['colazione','spuntino','pranzo','pre-workout','cena'].indexOf(pasto.tipo),
            coach_note: giorno.nota_giorno || '',
          }).select().single()

          if (mealErr) throw mealErr

          // 3. Alimenti del pasto
          if (pasto.alimenti?.length > 0) {
            const foods = pasto.alimenti.map((a, idx) => ({
              plan_meal_id: mealData.id,
              food_name: a.nome,
              brand: a.marca || '',
              quantity_g: a.quantita_g || 100,
              kcal: a.kcal || 0,
              protein_g: a.proteine_g || 0,
              carbs_g: a.carboidrati_g || 0,
              fat_g: a.grassi_g || 0,
              sort_order: idx,
            }))
            const { error: foodErr } = await supabase.from('plan_meal_foods').insert(foods)
            if (foodErr) throw foodErr
          }
        }
      }

      setStep(3)
    } catch(e) {
      setError('Errore nel salvataggio: ' + e.message)
    }
    setSaving(false)
  }

  function reset() {
    setStep(1); setParsedPlan(null); setFileName(''); setError('')
    setSelectedClient(''); setWeekNumber(1); setPlanTitle('Piano alimentare'); setPlanNotes('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const totalMeals = parsedPlan?.giorni?.[0]?.pasti?.length || 0
  const totalFoods = parsedPlan?.giorni?.[0]?.pasti?.reduce((s,p) => s+(p.alimenti?.length||0), 0) || 0

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Importa piano alimentare</div>
          <div style={{fontSize:12,color:'#888780'}}>Carica il Word della dottoressa — l'AI lo struttura automaticamente</div>
        </div>
        {step === 2 && <button style={s.btnGray} onClick={reset}>← Ricomincia</button>}
      </div>

      <div style={s.page}>

        {/* STEP INDICATOR */}
        <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:20}}>
          {[{n:1,label:'Carica file'},{n:2,label:'Anteprima'},{n:3,label:'Pubblicato'}].map((st,i)=>(
            <React.Fragment key={st.n}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:step>=st.n?'#D4570A':'#E0DDD6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'white'}}>
                  {step>st.n ? <i className="ti ti-check" style={{fontSize:13}}/> : st.n}
                </div>
                <span style={{fontSize:12,fontWeight:step===st.n?500:400,color:step>=st.n?'#111':'#888780'}}>{st.label}</span>
              </div>
              {i<2&&<div style={{flex:1,height:1,background:step>st.n?'#D4570A':'#E0DDD6',margin:'0 12px',maxWidth:60}}/>}
            </React.Fragment>
          ))}
        </div>

        {/* STEP 1: CARICA */}
        {step === 1 && (
          <div style={s.card}>
            <div style={s.cardTitle}><i className="ti ti-upload" style={{fontSize:16,color:'#D4570A'}}/> Carica il file Word</div>

            <div
              style={{border:'2px dashed #E0DDD6',borderRadius:10,padding:'40px 20px',textAlign:'center',cursor:'pointer',marginBottom:16,transition:'all 0.2s'}}
              onClick={()=>fileRef.current?.click()}
              onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='#D4570A'}}
              onDragLeave={e=>e.currentTarget.style.borderColor='#E0DDD6'}
              onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor='#E0DDD6';const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);fileRef.current.files=dt.files;handleFile({target:{files:[f]}})}}}>
              <input ref={fileRef} type="file" accept=".docx" style={{display:'none'}} onChange={handleFile}/>
              <i className="ti ti-file-word" style={{fontSize:48,color:loading?'#D4570A':'#E0DDD6',display:'block',marginBottom:12}}/>
              {loading ? (
                <div>
                  <div style={{fontSize:14,fontWeight:500,color:'#D4570A',marginBottom:6}}>L'AI sta leggendo il piano...</div>
                  <div style={{fontSize:12,color:'#888780'}}>Riconosce pasti, alimenti, grammature e calorie</div>
                  <div style={{display:'flex',justifyContent:'center',gap:4,marginTop:12}}>
                    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:'#D4570A',animation:'bounce 1.2s infinite',animationDelay:`${i*0.2}s`}}/>)}
                  </div>
                </div>
              ) : fileName ? (
                <div>
                  <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:4}}>{fileName}</div>
                  <div style={{fontSize:12,color:'#888780'}}>File caricato — elaborazione in corso</div>
                </div>
              ) : (
                <div>
                  <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:6}}>Trascina qui il file Word</div>
                  <div style={{fontSize:12,color:'#888780',marginBottom:14}}>oppure clicca per selezionarlo dal tuo PC</div>
                  <div style={{display:'inline-block',background:'#D4570A',color:'white',padding:'8px 20px',borderRadius:8,fontSize:13,fontWeight:500}}>Seleziona file .docx</div>
                </div>
              )}
            </div>

            {error && <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#9B1C1C',marginBottom:12}}>{error}</div>}

            <div style={{background:'#F5F3EF',borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontSize:12,fontWeight:500,color:'#111',marginBottom:6}}>Come funziona:</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {['Carica il piano Word che ti manda la dottoressa','L\'AI riconosce automaticamente pasti, alimenti e calorie','Rivedi l\'anteprima e assegna il piano al cliente','Il cliente vede il piano già formattato nell\'app'].map((t,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:'#888780'}}>
                    <div style={{width:18,height:18,borderRadius:'50%',background:'#D4570A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:500,color:'white',flexShrink:0,marginTop:1}}>{i+1}</div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ANTEPRIMA */}
        {step === 2 && parsedPlan && (
          <>
            {/* Riepilogo lettura AI */}
            <div style={{background:'#EAF3DE',border:'0.5px solid #3B6D11',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
              <i className="ti ti-sparkles" style={{fontSize:20,color:'#3B6D11',flexShrink:0}}/>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:'#3B6D11'}}>Piano letto con successo!</div>
                <div style={{fontSize:12,color:'#3B6D11',opacity:0.8}}>{parsedPlan.giorni?.length||0} giorni · {totalMeals} pasti al giorno · {totalFoods} alimenti per pasto · {parsedPlan.kcal_totali||0} kcal/giorno</div>
              </div>
            </div>

            {/* Configurazione */}
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
                  <label style={s.label}>Kcal/giorno (rilevate)</label>
                  <div style={{padding:'9px 12px',background:'#FEF0E7',borderRadius:8,fontSize:13,color:'#D4570A',fontWeight:500}}>{parsedPlan.kcal_totali||0} kcal · P{parsedPlan.proteine_g||0}g C{parsedPlan.carboidrati_g||0}g G{parsedPlan.grassi_g||0}g</div>
                </div>
              </div>
              <div>
                <label style={s.label}>Note del coach per il cliente</label>
                <textarea style={{...s.input,height:60,resize:'vertical'}} value={planNotes} onChange={e=>setPlanNotes(e.target.value)} placeholder="Aggiungi note generali per il cliente..."/>
              </div>
            </div>

            {/* Anteprima pasti — mostra il primo giorno */}
            <div style={s.card}>
              <div style={s.cardTitle}><i className="ti ti-eye" style={{fontSize:16,color:'#D4570A'}}/> Anteprima — {parsedPlan.giorni?.[0]?.giorno || 'Giorno 1'}</div>
              <div style={{fontSize:12,color:'#888780',marginBottom:14}}>Ecco come vedrà il piano il cliente nell'app. Tutti i {parsedPlan.giorni?.length} giorni sono stati importati.</div>

              {parsedPlan.giorni?.[0]?.pasti?.map((pasto, pi) => (
                <div key={pi} style={s.mealCard}>
                  <div style={s.mealHeader}>
                    <i className={`ti ${MEAL_ICONS[pasto.tipo]||'ti-circle'}`} style={{fontSize:16,color:'#D4570A'}}/>
                    <div style={s.mealTitle}>{pasto.nome}</div>
                    {pasto.orario && <span style={{fontSize:11,color:'#F4894A',background:'rgba(244,137,74,0.15)',padding:'2px 8px',borderRadius:10}}>{pasto.orario}</span>}
                    <span style={s.mealKcal}>{pasto.kcal||0} kcal</span>
                  </div>
                  {pasto.alimenti?.map((al, ai) => (
                    <div key={ai} style={s.foodRow}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'#D4570A',flexShrink:0}}/>
                      <div style={s.foodName}>
                        {al.nome}
                        {al.marca && <span style={{fontSize:11,color:'#888780',marginLeft:6}}>{al.marca}</span>}
                      </div>
                      <div style={s.foodMacro}>{al.quantita_g}g</div>
                      <div style={{display:'flex',gap:4,marginLeft:8}}>
                        <span style={{...s.tag,background:'#FEF0E7',color:'#D4570A'}}>P{al.proteine_g}g</span>
                        <span style={{...s.tag,background:'#FEF0E7',color:'#F4894A'}}>C{al.carboidrati_g}g</span>
                        <span style={{...s.tag,background:'#F5F3EF',color:'#888780'}}>G{al.grassi_g}g</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {error && <div style={{background:'#FEE2E2',border:'0.5px solid #E24B4A',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#9B1C1C',marginBottom:12}}>{error}</div>}

            <div style={{display:'flex',gap:10}}>
              <button style={s.btn} onClick={savePlan} disabled={saving||!selectedClient}>
                <i className="ti ti-rocket" style={{fontSize:15}}/> {saving?'Pubblicazione in corso...':'Pubblica il piano'}
              </button>
              <button style={s.btnGray} onClick={reset}>Annulla</button>
            </div>
          </>
        )}

        {/* STEP 3: SUCCESSO */}
        {step === 3 && (
          <div style={{...s.card,textAlign:'center',padding:'50px 30px'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#EAF3DE',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <i className="ti ti-circle-check" style={{fontSize:36,color:'#3B6D11'}}/>
            </div>
            <div style={{fontSize:18,fontWeight:500,color:'#111',marginBottom:8}}>Piano pubblicato!</div>
            <div style={{fontSize:13,color:'#888780',marginBottom:6}}>
              Il piano è ora visibile al cliente nell'app FOfit.
            </div>
            <div style={{fontSize:12,color:'#888780',marginBottom:28}}>
              {parsedPlan?.giorni?.length||0} giorni · {parsedPlan?.kcal_totali||0} kcal/giorno · {clients.find(c=>c.id===selectedClient)?.full_name}
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button style={s.btn} onClick={reset}>
                <i className="ti ti-upload" style={{fontSize:15}}/> Importa un altro piano
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </>
  )
}
