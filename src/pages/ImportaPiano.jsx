import React, { useState, useEffect, useRef, useMemo } from 'react'
import { askConfirm } from '../lib/confirm'
import { done } from '../lib/toast'
import { localDateStr } from '../lib/dates'
import { dbMust } from '../lib/db'
import { authFetch } from '../lib/authFetch'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { DAY_LABEL, parseNum, extractMacros, splitByDay, missingDays, foodsSum, makeVariante, checkDays, planKcalTarget } from '../lib/planImport'

const s = {
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#AAA', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #1C1C1C', borderRadius:9, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  tag: { display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:12, fontSize:11, fontWeight:600 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:9, padding:'11px 20px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'#161616', color:'#AAA', border:'0.5px solid #1C1C1C', borderRadius:9, padding:'11px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
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
  const [planStartDate, setPlanStartDate] = useState(localDateStr())
  const [weeklyTargets, setWeeklyTargets] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [planTitle, setPlanTitle] = useState('')
  const [planNotes, setPlanNotes] = useState('')
  const [targets, setTargets] = useState({ kcal_target:2000, protein_target_g:150, carbs_target_g:200, fat_target_g:65 })
  const [rawText, setRawText] = useState('')
  const blocksRef = useRef([])                 // testo di ogni giorno, per poterlo rileggere
  const [gaps, setGaps] = useState([])           // giorni che non si trovano nel testo
  const [rereading, setRereading] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const checks = useMemo(() => checkDays(parsedPlan?.varianti || [], { target: parseInt(targets.kcal_target) || null }), [parsedPlan, targets.kcal_target])

  // Legge UN giorno con l'AI (con un secondo tentativo per l'avvio a freddo del servizio)
  async function readDay(db) {
    const call = async () => {
      const r = await authFetch('/api/parse-day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayText: db.body, macros: db.macros }) })
      const txt = await r.text(); let parsed = null; try { parsed = JSON.parse(txt) } catch (e) {}
      return parsed?.pasti?.length ? parsed : null
    }
    try {
      let res = await call()
      if (!res) { await new Promise(r => setTimeout(r, 800)); res = await call() }
      return res || { pasti: [] }
    } catch (e) { return { pasti: [] } }
  }

  async function reparse(dayNum) {
    const db = blocksRef.current.find(b => b.dayNum === dayNum); if (!db) return
    setRereading(dayNum)
    const v = makeVariante(db, await readDay(db))
    setParsedPlan(pl => ({ ...pl, varianti: (pl.varianti || []).filter(x => x.dayNum !== dayNum).concat(v).sort((a, b) => a.dayNum - b.dayNum) }))
    setRereading(null)
  }

  async function elabora() {
    setError('')
    if (rawText.trim().length < 20) { setError('Incolla il testo del piano alimentare.'); return }
    setLoading(true)
    setProgress({ current: 0, total: 0, label: 'Analisi struttura...' })

    try {
      // Dividi in giorni lato frontend
      const dayBlocks = splitByDay(rawText)

      if (dayBlocks.length === 0) {
        // Nessun giorno trovato — piano giornaliero singolo, usa parse-day
        setProgress({ current: 0, total: 1, label: 'Elaborazione piano...' })
        const r = await authFetch('/api/parse-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayText: rawText, macros: null })
        })
        const txt = await r.text()
        let dayData = { pasti: [] }
        try { dayData = JSON.parse(txt) } catch(e) {}

        if (!dayData.pasti?.length) throw new Error('Piano non riconosciuto. Controlla il formato.')

        // Totali: dal documento se ci sono, altrimenti la somma degli alimenti (mai un valore inventato)
        const doc = extractMacros(rawText), sum = foodsSum(dayData.pasti)
        const kcal = sum.kcal > 0 ? sum.kcal : (doc?.kcal ?? null)
        const prot = doc?.proteine_g ?? (sum.proteine_g || null), carb = doc?.carboidrati_g ?? (sum.carboidrati_g || null), fat = doc?.grassi_g ?? (sum.grassi_g || null)

        const plan = {
          titolo: 'Piano alimentare',
          kcal_totali: kcal, proteine_g: prot, carboidrati_g: carb, grassi_g: fat,
          diet_type: 'lineare', note_generali: '',
          varianti: [{ nome: 'Piano giornaliero', dayNum: 1, kcal, kcalDoc: doc?.kcal ?? null, missingKcal: sum.missing, foods: sum.foods, truncated: !!dayData.truncated, failed: false, docHasKcal: /kcal/i.test(rawText), proteine_g: prot, carboidrati_g: carb, grassi_g: fat, pasti: dayData.pasti }],
          integratori: [],
        }
        blocksRef.current = []; setGaps([])
        setParsedPlan(plan)
        setPlanTitle(plan.titolo)
        setPlanNotes('')
        setTargets(t0 => ({ kcal_target: kcal || t0.kcal_target, protein_target_g: prot || t0.protein_target_g, carbs_target_g: carb || t0.carbs_target_g, fat_target_g: fat || t0.fat_target_g }))
        setProgress({ current: 1, total: 1, label: 'Completato!' })
        setStep(2)
        return
      }

      // Piano con giorni — si legge UN GIORNO ALLA VOLTA. Un giorno non letto resta visibile (da rileggere), non sparisce e non sposta gli altri.
      blocksRef.current = dayBlocks; setGaps(missingDays(dayBlocks))
      setProgress({ current: 0, total: dayBlocks.length, label: `0 / ${dayBlocks.length} giorni` })
      const varianti = []
      for (let i = 0; i < dayBlocks.length; i++) {
        const db = dayBlocks[i]
        setProgress({ current: i, total: dayBlocks.length, label: `${db.dayName.charAt(0) + db.dayName.slice(1).toLowerCase()}...` })
        varianti.push(makeVariante(db, await readDay(db)))
        setProgress({ current: i + 1, total: dayBlocks.length, label: `${i + 1} / ${dayBlocks.length} giorni` })
        if (i < dayBlocks.length - 1) await new Promise(res => setTimeout(res, 300))      // piccola pausa tra le chiamate
      }
      if (varianti.every(v => v.failed)) throw new Error('Nessun giorno elaborato. Controlla il formato del piano.')

      const avg = key => { const a = varianti.filter(v => !v.failed && v[key] != null).map(v => v[key]); return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null }
      const plan = {
        titolo: 'Piano alimentare',
        kcal_totali: planKcalTarget(varianti), proteine_g: avg('proteine_g'), carboidrati_g: avg('carboidrati_g'), grassi_g: avg('grassi_g'),
        diet_type: 'lineare', note_generali: '', varianti, integratori: [],
      }

      setParsedPlan(plan)
      setPlanTitle(plan.titolo)
      setPlanNotes('')
      setTargets(t0 => ({ kcal_target: plan.kcal_totali || t0.kcal_target, protein_target_g: plan.proteine_g || t0.protein_target_g, carbs_target_g: plan.carboidrati_g || t0.carbs_target_g, fat_target_g: plan.grassi_g || t0.fat_target_g }))
      setProgress({ current: dayBlocks.length, total: dayBlocks.length, label: 'Completato!' })
      setStep(2)
            done('Piano letto: controlla i giorni')

    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  async function savePlan() {
    if (!selectedClient) { setError('Seleziona un cliente'); return }
    const flagged = checks.filter(c => c.status !== 'ok')
    if ((flagged.length || gaps.length) && !(await askConfirm(`${flagged.length ? `${flagged.length} ${flagged.length === 1 ? 'giorno ha' : 'giorni hanno'} dei controlli da rivedere` : ''}${flagged.length && gaps.length ? ' e ' : ''}${gaps.length ? `${gaps.length} ${gaps.length === 1 ? 'giorno non è stato trovato' : 'giorni non sono stati trovati'} nel testo` : ''}.\n\nSalvare comunque il piano?`, { confirmLabel: 'Salva comunque' }))) return
    setSaving(true)
    setError('')
    try {
      await dbMust(supabase.from('meal_plans').update({ is_active:false }).eq('client_id', selectedClient), 'il piano alimentare', 'salvare')

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
            day_of_week: variante.dayNum || dayIdx + 1,      // il giorno vero del documento (se un giorno manca, gli altri non scalano)
            meal_type: pasto.tipo || 'altro',
            meal_name: pasto.nome,
            scheduled_time: pasto.orario || null,
            meal_order: mealIdx,
            day_label: variante.nome,
            day_kcal_target: Math.round(variante.kcal ?? variante.kcalDoc) || null,
            day_protein_target_g: Math.round(variante.proteine_g || 0) || null,
            day_carbs_target_g: Math.round(variante.carboidrati_g || 0) || null,
            day_fat_target_g: Math.round(variante.grassi_g || 0) || null,
          }).select().single()
          if (mealErr) throw mealErr

          if (pasto.alimenti?.length > 0) {
            const foods = pasto.alimenti.map((a, i) => ({
              plan_meal_id: mealData.id,
              food_name: a.nome || 'Alimento',
              quantity_g: Math.round(parseFloat(a.quantita_g) || 100),
              kcal: Math.round(parseNum(a.kcal) || 0),
              protein_g: parseNum(a.proteine_g) || 0,
              carbs_g: parseNum(a.carboidrati_g) || 0,
              fat_g: parseNum(a.grassi_g) || 0,
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

      done('Piano importato e assegnato')

      navigate('/admin')
    } catch(e) {
      setError('Errore salvataggio: ' + e.message)
    }
    setSaving(false)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',background:'#161616'}}>
      {/* TOPBAR */}
      <div style={{background:'#0D0D0D',borderBottom:'0.5px solid #1A1A1A',padding:'0 16px',height:56,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button className="tap" aria-label="Indietro" onClick={()=>step===2?setStep(1):navigate('/admin')} style={{width:34,height:34,borderRadius:9,border:'0.5px solid #1C1C1C',background:'#161616',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#F0F0F0'}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0'}}>Importa piano alimentare</div>
          <div style={{fontSize:11,color:'#AAA'}}>Passo {step} di 2</div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{height:3,background:'#2A2A2A',flexShrink:0}}>
        <div style={{height:3,background:'#D4570A',width:step===1?'50%':'100%',transition:'width 0.3s'}}/>
      </div>

      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'16px'}}>

        {/* ERRORE */}
        {error && (
          <div style={{background:'rgba(226,75,74,0.1)',border:'0.5px solid #E24B4A',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#E24B4A'}}>
            ⚠️ {error}
          </div>
        )}

        {/* ── STEP 1 — INCOLLA TESTO ── */}
        {step === 1 && <>
          <div style={s.card}>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>📋 Piano del nutrizionista</div>
            <div style={{fontSize:12,color:'#AAA',marginBottom:14,lineHeight:1.6}}>
              Copia e incolla il piano alimentare del nutrizionista. Può essere in qualsiasi formato — testo, tabella, PDF copiato. L'AI lo struttura automaticamente.
            </div>
            <label style={s.label}>Testo del piano</label>
            <textarea
              value={rawText}
              onChange={e=>setRawText(e.target.value)}
              placeholder="Incolla qui il piano alimentare completo..."
              style={{...s.input, minHeight:320, resize:'vertical', lineHeight:1.6, fontSize:12}}
            />
            <div style={{fontSize:11,color:'#AAA',marginTop:6}}>{rawText.length} caratteri</div>
          </div>

          {/* PROGRESS BAR ELABORAZIONE */}
          {loading && progress.total > 0 && (
            <div style={{marginBottom:10,background:'#0D0D0D',borderRadius:10,padding:'12px',border:'0.5px solid #1C1C1C'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#AAA',marginBottom:6}}>
                <span>📅 {progress.label}</span>
                <span style={{fontWeight:600,color:'#F4894A'}}>{progress.current}/{progress.total}</span>
              </div>
              <div style={{height:6,background:'#2A2A2A',borderRadius:4}}>
                <div style={{height:6,background:'#D4570A',borderRadius:4,width:`${progress.total>0?Math.round(progress.current/progress.total*100):0}%`,transition:'width 0.4s'}}/>
              </div>
            </div>
          )}

          <button onClick={elabora} disabled={loading||rawText.trim().length<20} style={{...s.btn,width:'100%',justifyContent:'center',padding:'14px',fontSize:14,opacity:rawText.trim().length<20?0.5:1}}>
            {loading ? <>
              <i className="ti ti-loader-2" style={{fontSize:15}}/>
              {progress.total > 1 ? `Elaboro ${progress.label}` : 'Elaborazione...'}
            </> : <>
              <i className="ti ti-wand" style={{fontSize:15}}/>
              Elabora piano
            </>}
          </button>
        </>}

        {/* ── STEP 2 — ANTEPRIMA E ASSEGNA ── */}
        {step === 2 && parsedPlan && <>
          {/* CONFERMA ELABORAZIONE */}
          {(() => {
            const bad = checks.filter(c => c.status !== 'ok'), allOk = bad.length === 0 && gaps.length === 0, col = allOk ? '#6FCF97' : '#E8C050'
            return (
              <div data-testid="import-summary" style={{background:allOk?'rgba(59,140,90,0.1)':'rgba(232,160,32,0.08)',border:`0.5px solid ${allOk?'#3B6D11':'rgba(232,160,32,0.45)'}`,borderRadius:12,padding:'14px',marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:col,marginBottom:4}}>
                  {allOk ? '✓' : '⚠'} Piano elaborato — {parsedPlan.varianti?.length} giorni · {parsedPlan.varianti?.reduce((s,v)=>s+(v.pasti?.length||0),0)} pasti totali{!allOk && bad.length > 0 ? ` · ${bad.length} da controllare` : ''}
                </div>
                <div style={{display:'flex',gap:12,fontSize:12,color:col}}>
                  <span>{parsedPlan.kcal_totali ? `${Math.round(parsedPlan.kcal_totali)} kcal (media)` : 'kcal n/d'}</span>
                  <span>P {Math.round(parsedPlan.proteine_g||0)}g</span>
                  <span>C {Math.round(parsedPlan.carboidrati_g||0)}g</span>
                  <span>G {Math.round(parsedPlan.grassi_g||0)}g</span>
                </div>
                {gaps.length > 0 && <div role="alert" style={{marginTop:8,fontSize:12,color:'#E8C050',lineHeight:1.5}}>Giorni non trovati nel testo: <b>{gaps.map(n => DAY_LABEL[n]).join(', ')}</b>. Controlla che nel documento il nome del giorno sia su una riga a parte.</div>}
              </div>
            )
          })()}

          {/* CONTROLLO KCAL GIORNO PER GIORNO */}
          <div style={s.card} data-testid="import-checks">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10,gap:8,flexWrap:'wrap'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>Controllo kcal giorno per giorno</div>
              <div style={{fontSize:11,color:'#AAA'}}>La somma è quella degli alimenti (ciò che vedrà il cliente). Obiettivo: {parseInt(targets.kcal_target) || '—'} kcal</div>
            </div>
            {checks.map(c => (
              <div key={c.dayNum} data-testid={`check-${c.dayNum}`} data-status={c.status} style={{padding:'9px 0',borderTop:'0.5px solid #1C1C1C'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <span aria-label={c.status==='ok'?'a posto':c.status==='error'?'errore':'da controllare'} style={{width:9,height:9,borderRadius:'50%',background:c.status==='ok'?'#3B8C5A':c.status==='error'?'#E24B4A':'#E8A020',flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:700,color:'#F0F0F0',minWidth:84}}>{c.name}</span>
                  <span style={{fontSize:12,color:'#CCC'}}>{c.meals} pasti · {c.foods ?? 0} alimenti</span>
                  <span style={{fontSize:13,fontWeight:800,color:'#F4894A',marginLeft:'auto'}}>{c.sum != null ? `${c.sum} kcal` : 'kcal n/d'}</span>
                  {c.doc != null && <span style={{fontSize:11,color:'#AAA'}}>documento: {c.doc}</span>}
                  {c.status !== 'ok' && blocksRef.current.some(b => b.dayNum === c.dayNum) && (
                    <button type="button" onClick={() => reparse(c.dayNum)} disabled={rereading !== null} style={{...s.btnGray,padding:'5px 11px',fontSize:11,color:'#F4894A'}}>{rereading === c.dayNum ? 'Rileggo…' : 'Rileggi'}</button>
                  )}
                </div>
                {c.flags.map(f => <div key={f.code} style={{fontSize:11,color:f.level==='error'?'#F07070':'#E8C050',margin:'4px 0 0 19px',lineHeight:1.45}}>{f.text}</div>)}
              </div>
            ))}
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
                  <input inputMode="numeric" style={s.input} type="number" value={targets[k]||''} onChange={e=>setTargets(p=>({...p,[k]:parseInt(e.target.value)||0}))}/>
                </div>
              ))}
            </div>
          </div>

          {/* ANTEPRIMA GIORNI */}
          {parsedPlan.varianti?.map((v, vi) => (
            <div key={vi} style={s.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0'}}>{v.nome}</div>
                <div style={{display:'flex',gap:6}}>
                  <span style={{...s.tag,background:'rgba(212,87,10,0.1)',color:'#F4894A'}}>{v.kcal != null ? `${Math.round(v.kcal)} kcal` : 'kcal n/d'}</span>
                  {v.kcalDoc != null && v.kcal != null && Math.abs(v.kcal - v.kcalDoc) > v.kcalDoc * 0.05 && <span style={{...s.tag,background:'rgba(232,160,32,0.12)',color:'#E8C050'}}>documento {Math.round(v.kcalDoc)}</span>}
                  {v.proteine_g && <span style={{...s.tag,background:'rgba(74,144,212,0.1)',color:'#4A90D4'}}>P{Math.round(v.proteine_g)}g</span>}
                </div>
              </div>
              {(v.pasti||[]).map((p2, pi) => (
                <div key={pi} style={{padding:'8px 0',borderBottom:'0.5px solid #1C1C1C'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#F4894A',marginBottom:4}}>{p2.nome}</div>
                  {(p2.alimenti||[]).map((a, ai) => (
                    <div key={ai} style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#AAA',padding:'2px 0'}}>
                      <span>{a.nome} <span style={{color:'#BBB8B0'}}>{a.quantita_g}g</span></span>
                      <div style={{display:'flex',gap:6}}>
                        <span>{a.kcal != null && a.kcal !== '' ? a.kcal : '—'} kcal</span>
                        {a.proteine_g>0&&<span style={{color:'#4A90D4'}}>P{a.proteine_g}g</span>}
                        {a.opzioni?.length>0&&<span style={{...s.tag,background:'#161616',color:'#AAA',padding:'1px 6px'}}>+{a.opzioni.length} alt.</span>}
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
