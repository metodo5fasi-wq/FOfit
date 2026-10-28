import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { searchExercises, EXERCISE_DB as EXERCISE_DATABASE } from '../data/exerciseDatabase.js'

const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica']
const MUSCLE_GROUPS = ['Tutti','Petto','Schiena','Spalle','Bicipiti','Tricipiti','Gambe','Femorali','Glutei','Polpacci','Addominali','Cardio','Corpo libero']

export default function CreaAllenamento() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client')
  const { toast } = useToast()

  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(clientId || '')
  const [planName, setPlanName] = useState('Scheda allenamento')
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(0)

  // { 0: [{exercise_name, muscle_group, sets, reps, rest_seconds, video_url, notes}], ... }
  const [days, setDays] = useState(() => {
    const d = {}
    for (let i=0;i<7;i++) d[i] = []
    return d
  })

  // Ricerca esercizi
  const [exSearch, setExSearch] = useState('')
  const [exFilter, setExFilter] = useState('Tutti')
  const [showExPicker, setShowExPicker] = useState(false)
  const [customExName, setCustomExName] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  function filteredExercises() {
    const db = EXERCISE_DATABASE || []
    let list = exFilter==='Tutti' ? db : db.filter(e=>e.cat===exFilter)
    if (exSearch.trim()) list = list.filter(e=>e.name.toLowerCase().includes(exSearch.toLowerCase()))
    return list.slice(0, 30)
  }

  function addExercise(ex) {
    setDays(prev => {
      const d = {...prev}
      d[selectedDay] = [...d[selectedDay], {
        exercise_name: ex.name,
        muscle_group: ex.cat,
        sets: 3,
        reps: '10',
        rest_seconds: 90,
        video_url: ex.youtube || '',
        notes: '',
        sort_order: d[selectedDay].length,
      }]
      return d
    })
    setShowExPicker(false)
    setExSearch('')
  }

  function addCustomExercise() {
    if (!customExName.trim()) return
    setDays(prev => {
      const d = {...prev}
      d[selectedDay] = [...d[selectedDay], {
        exercise_name: customExName.trim(),
        muscle_group: exFilter !== 'Tutti' ? exFilter : 'Altro',
        sets: 3, reps: '10', rest_seconds: 90, video_url: '', notes: '',
        sort_order: d[selectedDay].length,
      }]
      return d
    })
    setCustomExName('')
    setShowExPicker(false)
  }

  function removeExercise(dayIdx, exIdx) {
    setDays(prev => {
      const d = {...prev}
      d[dayIdx] = d[dayIdx].filter((_,i) => i !== exIdx)
      return d
    })
  }

  function updateExercise(dayIdx, exIdx, field, val) {
    setDays(prev => {
      const d = {...prev}
      d[dayIdx][exIdx] = {...d[dayIdx][exIdx], [field]: val}
      return d
    })
  }

  function copyDay(fromIdx, toIdx) {
    setDays(prev => {
      const d = {...prev}
      d[toIdx] = JSON.parse(JSON.stringify(d[fromIdx]))
      return d
    })
    toast('Giorno copiato ✓', 'success')
  }

  async function savePlan() {
    if (!selectedClient) { toast('Seleziona un cliente', 'error'); return }
    const hasEx = Object.values(days).some(d => d.length > 0)
    if (!hasEx) { toast('Aggiungi almeno un esercizio', 'error'); return }
    setSaving(true)
    try {
      await supabase.from('workout_plans').update({is_active:false}).eq('client_id', selectedClient)

      const { data: plan, error: planErr } = await supabase.from('workout_plans').insert({
        client_id: selectedClient,
        name: planName,
        is_active: true,
      }).select().single()
      if (planErr) throw planErr

      for (const [dayIdx, exercises] of Object.entries(days)) {
        if (!exercises.length) continue
        const dayName = DAY_NAMES[parseInt(dayIdx)]
        for (const [i, ex] of exercises.entries()) {
          const { error: exErr } = await supabase.from('workout_exercises').insert({
            plan_id: plan.id,
            exercise_name: ex.exercise_name,
            muscle_group: ex.muscle_group,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            video_url: ex.video_url || null,
            notes: ex.notes || null,
            day_label: dayName,
            day_of_week: parseInt(dayIdx),
            sort_order: i,
          })
          if (exErr) throw exErr
        }
      }

      toast('Scheda creata con successo! 🎉', 'success')
      setTimeout(() => navigate(`/modifica-allenamento/${plan.id}`), 1000)
    } catch(e) {
      console.error(e)
      toast('Errore: ' + e.message, 'error')
    }
    setSaving(false)
  }

  const s = {
    page: {minHeight:'100dvh',background:'var(--bg)',color:'var(--text)',fontFamily:'inherit'},
    topbar: {background:'var(--bg-card)',borderBottom:'0.5px solid var(--border)',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50},
    card: {background:'var(--bg-card)',borderRadius:12,padding:'14px 16px',marginBottom:10,border:'0.5px solid var(--border)'},
    label: {fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6},
    input: {width:'100%',padding:'9px 12px',border:'0.5px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    select: {width:'100%',padding:'9px 12px',border:'0.5px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',boxSizing:'border-box'},
    btn: {padding:'10px 18px',background:'#D4570A',color:'white',border:'none',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
    btnGray: {padding:'8px 14px',background:'var(--bg-input)',color:'var(--text-muted)',border:'0.5px solid var(--border)',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'},
    btnDanger: {padding:'5px 10px',background:'none',color:'#E24B4A',border:'0.5px solid #E24B4A',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'},
  }

  return (
    <div style={s.page}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <button onClick={()=>navigate('/admin')} style={{width:32,height:32,borderRadius:8,border:'0.5px solid var(--border)',background:'var(--bg-input)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text)',flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>Crea Scheda Allenamento</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Costruisci la scheda giorno per giorno</div>
        </div>
        <button onClick={savePlan} disabled={saving} style={{...s.btn,display:'flex',alignItems:'center',gap:6}}>
          <i className="ti ti-device-floppy" style={{fontSize:14}}/>
          {saving ? 'Salvo...' : 'Salva scheda'}
        </button>
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'16px'}}>

        {/* INFO SCHEDA */}
        <div style={s.card}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={s.label}>Cliente</label>
              <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                <option value="">— Seleziona cliente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={s.label}>Nome scheda</label>
              <input style={s.input} value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="es. Scheda A - Ipertrofia"/>
            </div>
          </div>
        </div>

        {/* GIORNI */}
        <div style={{display:'flex',gap:6,marginBottom:12,overflowX:'auto',paddingBottom:4}}>
          {DAY_NAMES.map((d,i) => {
            const hasEx = days[i].length > 0
            return (
              <button key={i} onClick={()=>{setSelectedDay(i);setShowExPicker(false)}} style={{
                flexShrink:0,padding:'8px 12px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                background: selectedDay===i ? '#D4570A' : hasEx ? 'var(--bg-input)' : 'var(--bg-card)',
                color: selectedDay===i ? 'white' : hasEx ? 'var(--text)' : 'var(--text-muted)',
                border: selectedDay===i ? 'none' : '0.5px solid var(--border)',
                fontWeight: selectedDay===i ? 700 : 400,
              }}>
                <div style={{fontSize:12,fontWeight:700}}>{d.slice(0,3)}</div>
                {hasEx && <div style={{fontSize:10,marginTop:2,color:selectedDay===i?'rgba(255,255,255,0.8)':'#D4570A'}}>{days[i].length} es.</div>}
              </button>
            )
          })}
        </div>

        {/* COPIA GIORNO */}
        {days[selectedDay].length > 0 && (
          <div style={{marginBottom:12,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>Copia {DAY_NAMES[selectedDay]} su:</span>
            {DAY_NAMES.map((d,i) => i!==selectedDay && (
              <button key={i} onClick={()=>copyDay(selectedDay,i)} style={s.btnGray}>{d.slice(0,3)}</button>
            ))}
          </div>
        )}

        {/* ESERCIZI DEL GIORNO */}
        {days[selectedDay].map((ex, exIdx) => (
          <div key={exIdx} style={s.card}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{ex.exercise_name}</div>
                <div style={{fontSize:11,color:'#D4570A',marginTop:2}}>{ex.muscle_group}</div>
              </div>
              {ex.video_url && (
                <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                  style={{width:30,height:30,borderRadius:7,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <i className="ti ti-brand-youtube" style={{fontSize:15,color:'#D4570A'}}/>
                </a>
              )}
              <button onClick={()=>removeExercise(selectedDay,exIdx)} style={s.btnDanger}>
                <i className="ti ti-trash" style={{fontSize:13}}/>
              </button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
              <div>
                <label style={s.label}>Serie</label>
                <input type="number" style={s.input} value={ex.sets}
                  onChange={e=>updateExercise(selectedDay,exIdx,'sets',parseInt(e.target.value)||1)}/>
              </div>
              <div>
                <label style={s.label}>Reps</label>
                <input style={s.input} value={ex.reps}
                  onChange={e=>updateExercise(selectedDay,exIdx,'reps',e.target.value)}
                  placeholder="es. 10 o 8-12"/>
              </div>
              <div>
                <label style={s.label}>Recupero (s)</label>
                <input type="number" style={s.input} value={ex.rest_seconds}
                  onChange={e=>updateExercise(selectedDay,exIdx,'rest_seconds',parseInt(e.target.value)||60)}/>
              </div>
            </div>

            <div>
              <label style={s.label}>Link YouTube</label>
              <input style={s.input} value={ex.video_url}
                onChange={e=>updateExercise(selectedDay,exIdx,'video_url',e.target.value)}
                placeholder="https://youtube.com/..."/>
            </div>

            <div style={{marginTop:8}}>
              <label style={s.label}>Note per il cliente</label>
              <input style={s.input} value={ex.notes}
                onChange={e=>updateExercise(selectedDay,exIdx,'notes',e.target.value)}
                placeholder="es. Schiena dritta, scendi lentamente..."/>
            </div>
          </div>
        ))}

        {/* AGGIUNGI ESERCIZIO */}
        {!showExPicker ? (
          <button onClick={()=>setShowExPicker(true)}
            style={{...s.btn,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'13px',marginBottom:20}}>
            <i className="ti ti-plus" style={{fontSize:16}}/>Aggiungi esercizio — {DAY_NAMES[selectedDay]}
          </button>
        ) : (
          <div style={{...s.card,marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:12}}>
              Aggiungi esercizio — {DAY_NAMES[selectedDay]}
            </div>

            {/* Filtro gruppo muscolare */}
            <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:10}}>
              {MUSCLE_GROUPS.map(g => (
                <button key={g} onClick={()=>setExFilter(g)} style={{
                  flexShrink:0,padding:'5px 10px',borderRadius:16,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:exFilter===g?700:400,
                  background:exFilter===g?'#D4570A':'var(--bg-input)',
                  color:exFilter===g?'white':'var(--text-muted)',
                  border:exFilter===g?'none':'0.5px solid var(--border)',
                }}>{g}</button>
              ))}
            </div>

            {/* Ricerca */}
            <input style={{...s.input,marginBottom:8}} value={exSearch}
              onChange={e=>setExSearch(e.target.value)}
              placeholder="Cerca esercizio..." autoFocus/>

            {/* Lista esercizi */}
            <div style={{maxHeight:240,overflowY:'auto',borderRadius:8,border:'0.5px solid var(--border)',marginBottom:10}}>
              {filteredExercises().map((ex,i) => (
                <div key={i} onClick={()=>addExercise(ex)}
                  style={{padding:'10px 12px',cursor:'pointer',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',
                    background:'var(--bg-input)'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{ex.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{ex.cat}</div>
                  </div>
                  {ex.youtube && <i className="ti ti-brand-youtube" style={{fontSize:14,color:'#D4570A',flexShrink:0}}/>}
                </div>
              ))}
              {filteredExercises().length === 0 && (
                <div style={{padding:'16px',textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>
                  Nessun esercizio trovato
                </div>
              )}
            </div>

            {/* Esercizio personalizzato */}
            <div style={{display:'flex',gap:8,marginBottom:8}}>
              <input style={{...s.input,flex:1}} value={customExName}
                onChange={e=>setCustomExName(e.target.value)}
                placeholder="Oppure scrivi nome esercizio personalizzato..."
                onKeyDown={e=>e.key==='Enter'&&addCustomExercise()}/>
              <button onClick={addCustomExercise} style={s.btn}>Aggiungi</button>
            </div>

            <button onClick={()=>{setShowExPicker(false);setExSearch('');setCustomExName('')}} style={s.btnGray}>
              Annulla
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
