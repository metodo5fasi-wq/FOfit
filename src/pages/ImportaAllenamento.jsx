import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

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
  step: { display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 },
  stepNum: { width:28, height:28, borderRadius:'50%', background:'#D4570A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'white', flexShrink:0 },
  dayCard: { border:'0.5px solid #E0DDD6', borderRadius:10, overflow:'hidden', marginBottom:10 },
  dayHeader: { background:'#FEF0E7', padding:'10px 14px', fontWeight:600, fontSize:13, color:'#D4570A' },
  exRow: { display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'0.5px solid #F5F3EF' },
  tag: { fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500, background:'#F5F3EF', color:'#888780' },
}

const EXAMPLE = `Giorno A - Petto e Tricipiti
Panca piana | Petto | https://youtube.com/watch?v=... | Scendi controllato fino al petto, spingi senza bloccare i gomiti | 4x8-10 | 90sec
Croci con manubri | Petto | https://youtube.com/watch?v=... | Movimento ad arco, gomiti leggermente flessi | 3x12 | 60sec
French press | Tricipiti | https://youtube.com/watch?v=... | Gomiti fermi, scendi dietro la testa | 3x10-12 | 60sec

Giorno B - Schiena e Bicipiti
Trazioni | Schiena | https://youtube.com/watch?v=... | Presa prona, scapole addotte | 4x6-8 | 90sec
Curl bilanciere | Bicipiti | https://youtube.com/watch?v=... | Gomiti fermi lungo i fianchi | 3x10 | 60sec`

export default function ImportaAllenamento() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsedWorkout, setParsedWorkout] = useState(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [planTitle, setPlanTitle] = useState('Scheda allenamento')

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  async function elabora() {
    if (!rawText.trim() || rawText.trim().length < 20) {
      setError('Incolla il testo della scheda allenamento prima di procedere.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText })
      })
      const text = await response.text()
      if (!text || text.trim() === '') throw new Error('Risposta vuota. Riprova.')
      let result
      try { result = JSON.parse(text) } catch(e) { throw new Error('Risposta non valida. Riprova.') }
      if (!response.ok) throw new Error(result.error || 'Errore API')
      if (!result.workout) throw new Error('Nessuna scheda ricevuta. Riprova.')

      setParsedWorkout(result.workout)
      setStep(2)
    } catch(e) {
      setError('Errore: ' + e.message)
    }
    setLoading(false)
  }

  async function saveWorkout() {
    if (!selectedClient) { setError('Seleziona un cliente'); return }
    setSaving(true)
    setError('')
    try {
      // Disattiva schede precedenti
      await supabase.from('workout_plans').update({is_active:false}).eq('client_id', selectedClient)

      const { data: planData, error: planErr } = await supabase.from('workout_plans').insert({
        client_id: selectedClient,
        created_by: profile.id,
        title: planTitle,
        is_active: true,
      }).select().single()
      if (planErr) throw planErr

      let orderIdx = 0
      for (const day of parsedWorkout.days || []) {
        for (const ex of day.exercises || []) {
          const { error: exErr } = await supabase.from('workout_exercises').insert({
            plan_id: planData.id,
            day_label: day.day_label,
            order_index: orderIdx++,
            muscle_group: ex.muscle_group || '',
            exercise_name: ex.exercise_name,
            video_url: ex.video_url || '',
            description: ex.description || '',
            sets: ex.sets || null,
            reps: ex.reps || '',
            rest_seconds: ex.rest_seconds || 60,
          })
          if (exErr) throw exErr
        }
      }

      setStep(3)
    } catch(e) {
      setError('Errore: ' + e.message)
    }
    setSaving(false)
  }

  function reset() {
    setStep(1); setRawText(''); setParsedWorkout(null); setSelectedClient(''); setPlanTitle('Scheda allenamento'); setError('')
  }

  const totalExercises = parsedWorkout?.days?.reduce((sum,d)=>sum+(d.exercises?.length||0),0) || 0

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Importa scheda allenamento</div>
          <div style={{fontSize:12,color:'#888780'}}>Incolla il testo, l'AI la struttura automaticamente</div>
        </div>
      </div>
      <div style={s.page}>

        {/* STEP 1 — INCOLLA TESTO */}
        {step === 1 && (
          <div style={s.card}>
            <div style={s.step}>
              <div style={s.stepNum}>1</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:'#111',marginBottom:4}}>Incolla la scheda allenamento</div>
                <div style={{fontSize:12,color:'#888780',lineHeight:1.6,marginBottom:10}}>
                  Scrivi per ogni esercizio: <strong>nome | gruppo muscolare | link video | descrizione/esecuzione | serie x ripetizioni | recupero</strong> (separati da " | "), raggruppati per giorno (es. "Giorno A - Petto").
                </div>
                <textarea style={{...s.textarea, height:280}} placeholder={EXAMPLE} value={rawText} onChange={e=>setRawText(e.target.value)}/>
              </div>
            </div>
            {error && <div style={{fontSize:12,color:'#E24B4A',marginBottom:10}}>{error}</div>}
            <button style={s.btn} onClick={elabora} disabled={loading}>
              <i className="ti ti-sparkles" style={{fontSize:15}}/>
              {loading ? 'Elaborazione AI in corso...' : 'Elabora con AI'}
            </button>
          </div>
        )}

        {/* STEP 2 — ANTEPRIMA E SALVATAGGIO */}
        {step === 2 && parsedWorkout && (
          <>
            <div style={s.card}>
              <div style={s.cardTitle}><i className="ti ti-check" style={{fontSize:16,color:'#3B6D11'}}/> Scheda interpretata — {parsedWorkout.days.length} giorni, {totalExercises} esercizi</div>
              <div style={s.grid2}>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Cliente *</label>
                  <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                    <option value="">Seleziona cliente...</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Titolo scheda</label>
                  <input style={s.input} value={planTitle} onChange={e=>setPlanTitle(e.target.value)}/>
                </div>
              </div>
              <div style={{fontSize:11,color:'#888780',marginBottom:0}}>
                <i className="ti ti-info-circle" style={{fontSize:12,marginRight:4}}/>
                Salvando, questa scheda diventerà l'unica attiva per il cliente selezionato (le precedenti verranno disattivate).
              </div>
            </div>

            {parsedWorkout.days.map((day, di) => (
              <div key={di} style={s.dayCard}>
                <div style={s.dayHeader}>{day.day_label} — {day.exercises.length} esercizi</div>
                {day.exercises.map((ex, ei) => (
                  <div key={ei} style={s.exRow}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{ex.exercise_name}</div>
                      {ex.description && <div style={{fontSize:11,color:'#888780',marginTop:2}}>{ex.description}</div>}
                    </div>
                    <span style={s.tag}>{ex.muscle_group}</span>
                    <span style={s.tag}>{ex.sets}x{ex.reps}</span>
                    <span style={s.tag}>{ex.rest_seconds}s</span>
                    {ex.video_url && <i className="ti ti-brand-youtube" style={{fontSize:16,color:'#D4570A'}}/>}
                  </div>
                ))}
              </div>
            ))}

            {error && <div style={{fontSize:12,color:'#E24B4A',marginBottom:10}}>{error}</div>}
            <div style={{display:'flex',gap:10}}>
              <button style={s.btn} onClick={saveWorkout} disabled={saving}>
                <i className="ti ti-device-floppy" style={{fontSize:15}}/>
                {saving ? 'Salvataggio...' : 'Salva scheda'}
              </button>
              <button style={s.btnGray} onClick={()=>setStep(1)}>Torna indietro</button>
            </div>
          </>
        )}

        {/* STEP 3 — FATTO */}
        {step === 3 && (
          <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
            <i className="ti ti-circle-check" style={{fontSize:48,color:'#3B6D11',display:'block',marginBottom:16}}/>
            <div style={{fontSize:16,fontWeight:600,color:'#111',marginBottom:8}}>Scheda salvata!</div>
            <div style={{fontSize:13,color:'#888780',marginBottom:20}}>Il cliente la troverà nella sezione Allenamento.</div>
            <button onClick={reset} style={{...s.btn, margin:'0 auto'}}>
              <i className="ti ti-plus" style={{fontSize:15}}/> Importa un'altra scheda
            </button>
          </div>
        )}
      </div>
    </>
  )
}
