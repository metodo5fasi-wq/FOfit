import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const ORANGE = '#D4570A'
const DARK = '#111'
const GRAY = '#888780'
const BG = '#F5F3EF'
const CARD = '#FFFFFF'

export default function ShareView() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'FOfit'
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`/api/share?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setData(d)
          document.title = `FOfit · ${d.profile?.full_name || 'Progressi'}`
        }
        setLoading(false)
      })
      .catch(() => { setError('Errore di rete'); setLoading(false) })
  }, [token])

  if (loading) return (
    <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:BG,fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40,height:40,border:`3px solid ${ORANGE}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <div style={{fontSize:14,color:GRAY}}>Caricamento...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:BG,fontFamily:'system-ui',padding:24}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🔗</div>
        <div style={{fontSize:16,fontWeight:700,color:DARK,marginBottom:8}}>Link non disponibile</div>
        <div style={{fontSize:13,color:GRAY}}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100dvh',background:BG,fontFamily:'system-ui',WebkitFontSmoothing:'antialiased'}}>
      {/* HEADER */}
      <div style={{background:DARK,padding:'calc(env(safe-area-inset-top) + 14px) 20px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
        {window.self === window.top ? (
          <button onClick={()=>{
            if (window.history.length > 1) window.history.back()
            else window.location.href = '/'
          }} style={{background:'rgba(255,255,255,0.12)',border:'none',borderRadius:9,padding:'8px 14px',display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontFamily:'inherit'}}>
            <i className="ti ti-arrow-left" style={{fontSize:15,color:'white'}}/>
            <span style={{fontSize:12,fontWeight:600,color:'white'}}>Chiudi</span>
          </button>
        ) : <div/>}
        <div style={{fontSize:17,fontWeight:800,color:'white',letterSpacing:-0.5}}>
          FO<span style={{color:ORANGE}}>fit</span>
        </div>
      </div>

      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>

        {/* PROFILO */}
        <div style={{background:CARD,borderRadius:14,padding:'16px 18px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,${ORANGE},#F4894A)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:700,color:'white',flexShrink:0}}>
              {data.profile?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()||'FO'}
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:DARK}}>{data.profile?.full_name || 'Cliente FOfit'}</div>
              <div style={{fontSize:12,color:GRAY,marginTop:2}}>
                {data.type === 'session' && `📅 ${new Date(data.session?.session_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}`}
                {data.type === 'period' && `📆 ${new Date(data.period?.start+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})} – ${new Date(data.period?.end+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}`}
                {data.type === 'progress' && `📏 ${new Date(data.entry?.entry_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}`}
                {data.type === 'progress_period' && `📆 ${new Date(data.period?.start+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})} – ${new Date(data.period?.end+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}`}
              </div>
            </div>
          </div>
        </div>

        {/* SESSIONE SINGOLA */}
        {data.type === 'session' && <SessionView session={data.session} logs={data.logs}/>}

        {/* RIEPILOGO PERIODO ALLENAMENTO */}
        {data.type === 'period' && <PeriodView sessions={data.sessions} logs={data.logs} period={data.period}/>}

        {/* MISURAZIONE SINGOLA */}
        {data.type === 'progress' && <ProgressView entry={data.entry} photos={data.photos}/>}

        {/* RIEPILOGO PERIODO PROGRESSI */}
        {data.type === 'progress_period' && <ProgressPeriodView entries={data.entries} photos={data.photos} period={data.period}/>}

        {/* FOOTER */}
        <div style={{textAlign:'center',marginTop:24,padding:'16px 0',borderTop:`1px solid #E0DDD6`}}>
          <div style={{fontSize:12,color:GRAY,marginBottom:6}}>Allenati con il metodo FOfit</div>
          <div style={{fontSize:13,fontWeight:700,color:ORANGE}}>fofit.fit</div>
        </div>
      </div>
    </div>
  )
}

function SessionView({ session, logs }) {
  if (!session) return null
  const byExercise = {}
  logs.forEach(l => {
    if (!byExercise[l.exercise_name]) byExercise[l.exercise_name] = []
    byExercise[l.exercise_name].push(l)
  })
  const exercises = Object.entries(byExercise)
  const totalSets = logs.length
  const totalVolume = logs.reduce((s,l) => s + ((l.weight_kg||0) * (l.reps_done||0)), 0)
  const pct = session.sets_total > 0 ? Math.round(session.sets_completed/session.sets_total*100) : 0

  return (
    <>
      {/* STATS SESSIONE */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
        {[
          {label:'Serie', val:totalSets},
          {label:'Volume', val:totalVolume > 0 ? `${Math.round(totalVolume)}kg` : '—'},
          {label:'Completato', val:`${pct}%`},
        ].map(st=>(
          <div key={st.label} style={{background:CARD,borderRadius:12,padding:'14px 10px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:20,fontWeight:800,color:ORANGE}}>{st.val}</div>
            <div style={{fontSize:10,color:GRAY,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* NOTE SESSIONE */}
      {session.notes && (
        <div style={{background:'#FEF0E7',borderRadius:12,padding:'12px 16px',marginBottom:14,borderLeft:`3px solid ${ORANGE}`}}>
          <div style={{fontSize:10,color:ORANGE,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Note sessione</div>
          <div style={{fontSize:13,color:'#7a3508',lineHeight:1.6}}>{session.notes}</div>
        </div>
      )}

      {/* ESERCIZI */}
      <div style={{background:CARD,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${BG}`,fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em'}}>
          {session.day_label}
        </div>
        {exercises.map(([name, sets], i) => {
          const maxWeight = Math.max(...sets.map(s=>s.weight_kg||0))
          const totalVol = sets.reduce((s,l)=>s+((l.weight_kg||0)*(l.reps_done||0)),0)
          return (
            <div key={i} style={{padding:'12px 16px',borderBottom:i<exercises.length-1?`1px solid ${BG}`:'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:600,color:DARK}}>{name}</div>
                {maxWeight > 0 && <div style={{fontSize:12,color:ORANGE,fontWeight:700}}>{maxWeight}kg</div>}
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {sets.map((s,si)=>(
                  <div key={si} style={{background:BG,borderRadius:8,padding:'4px 10px',fontSize:11,color:GRAY}}>
                    {si+1}ª {s.weight_kg?`${s.weight_kg}kg`:'BW'}{s.reps_done?` × ${s.reps_done}reps`:''}
                  </div>
                ))}
              </div>
              {totalVol > 0 && <div style={{fontSize:11,color:GRAY,marginTop:6}}>Volume: {Math.round(totalVol)}kg totali</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function PeriodView({ sessions, logs, period }) {
  const totalSessions = sessions.length
  const totalSets = logs.length
  const totalVolume = logs.reduce((s,l)=>s+((l.weight_kg||0)*(l.reps_done||0)),0)
  const avgCompletion = sessions.length > 0 ? Math.round(sessions.reduce((s,sess)=>s+(sess.sets_total>0?sess.sets_completed/sess.sets_total*100:0),0)/sessions.length) : 0

  // Record per esercizio nel periodo
  const recordByEx = {}
  logs.forEach(l => {
    if (l.weight_kg && (!recordByEx[l.exercise_name] || l.weight_kg > recordByEx[l.exercise_name])) {
      recordByEx[l.exercise_name] = l.weight_kg
    }
  })
  const records = Object.entries(recordByEx).sort((a,b)=>b[1]-a[1]).slice(0,5)

  return (
    <>
      {/* STATS PERIODO */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        {[
          {label:'Allenamenti', val:totalSessions, icon:'🏋️'},
          {label:'Serie totali', val:totalSets, icon:'🔄'},
          {label:'Volume totale', val:totalVolume>0?`${Math.round(totalVolume/1000*10)/10}t`:'—', icon:'💪'},
          {label:'% medio completamento', val:`${avgCompletion}%`, icon:'✅'},
        ].map(st=>(
          <div key={st.label} style={{background:CARD,borderRadius:12,padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:22,marginBottom:4}}>{st.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:ORANGE}}>{st.val}</div>
            <div style={{fontSize:10,color:GRAY,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* RECORD DEL PERIODO */}
      {records.length > 0 && (
        <div style={{background:CARD,borderRadius:14,padding:'14px 16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>🏆 Pesi massimi del periodo</div>
          {records.map(([name, weight], i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:i<records.length-1?`1px solid ${BG}`:'none'}}>
              <div style={{fontSize:13,color:DARK}}>{name}</div>
              <div style={{fontSize:14,fontWeight:700,color:ORANGE}}>{weight}kg</div>
            </div>
          ))}
        </div>
      )}

      {/* LISTA SESSIONI */}
      <div style={{background:CARD,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${BG}`,fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em'}}>
          Sessioni del periodo
        </div>
        {sessions.length === 0 ? (
          <div style={{padding:'24px',textAlign:'center',fontSize:13,color:GRAY}}>Nessuna sessione trovata</div>
        ) : sessions.map((sess, i) => {
          const pct = sess.sets_total > 0 ? Math.round(sess.sets_completed/sess.sets_total*100) : 0
          return (
            <div key={i} style={{padding:'12px 16px',borderBottom:i<sessions.length-1?`1px solid ${BG}`:'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:sess.notes?6:0}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:DARK}}>{sess.day_label}</div>
                  <div style={{fontSize:11,color:GRAY,marginTop:2}}>{new Date(sess.session_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:14,fontWeight:700,color:pct>=100?'#3B6D11':ORANGE}}>{pct}%</div>
                  <div style={{fontSize:10,color:GRAY}}>{sess.sets_completed}/{sess.sets_total} serie</div>
                </div>
              </div>
              {sess.notes && <div style={{fontSize:12,color:GRAY,fontStyle:'italic',lineHeight:1.5}}>{sess.notes}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

const MISURE_LABELS = [
  { key:'weight_kg', label:'Peso', unit:'kg' },
  { key:'waist_cm', label:'Vita', unit:'cm' },
  { key:'hips_cm', label:'Fianchi', unit:'cm' },
  { key:'chest_cm', label:'Petto', unit:'cm' },
  { key:'arm_cm', label:'Braccio', unit:'cm' },
  { key:'thigh_cm', label:'Coscia', unit:'cm' },
  { key:'body_fat_pct', label:'Massa grassa', unit:'%' },
]

function ProgressView({ entry, photos }) {
  if (!entry) return null
  const filledMeasures = MISURE_LABELS.filter(m => entry[m.key])

  return (
    <>
      {/* MISURE */}
      {filledMeasures.length > 0 && (
        <div style={{background:CARD,borderRadius:14,padding:'16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>📏 Misurazioni</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {filledMeasures.map(m => (
              <div key={m.key} style={{background:BG,borderRadius:10,padding:'12px 8px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,color:ORANGE}}>{entry[m.key]}<span style={{fontSize:11,color:GRAY}}>{m.unit}</span></div>
                <div style={{fontSize:10,color:GRAY,marginTop:4}}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTE */}
      {entry.notes && (
        <div style={{background:'#FEF0E7',borderRadius:12,padding:'12px 16px',marginBottom:14,borderLeft:`3px solid ${ORANGE}`}}>
          <div style={{fontSize:10,color:ORANGE,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Note</div>
          <div style={{fontSize:13,color:'#7a3508',lineHeight:1.6}}>{entry.notes}</div>
        </div>
      )}

      {/* FOTO */}
      {photos.length > 0 && (
        <div style={{background:CARD,borderRadius:14,padding:'16px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>📸 Foto progressi</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {photos.map((p,i) => (
              <div key={i} style={{position:'relative'}}>
                <img src={p.photo_url} alt={p.label} style={{width:'100%',maxHeight:520,objectFit:'contain',borderRadius:12,display:'block',background:BG}}/>
                <div style={{position:'absolute',bottom:10,left:10,background:'rgba(0,0,0,0.65)',color:'white',fontSize:12,padding:'4px 10px',borderRadius:8,fontWeight:600}}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filledMeasures.length === 0 && photos.length === 0 && (
        <div style={{background:CARD,borderRadius:14,padding:'30px',textAlign:'center',color:GRAY,fontSize:13}}>Nessun dato disponibile per questa data.</div>
      )}
    </>
  )
}

function ProgressPeriodView({ entries, photos, period }) {
  const first = entries[0]
  const last = entries[entries.length-1]

  const weightDiff = first?.weight_kg && last?.weight_kg ? (last.weight_kg - first.weight_kg).toFixed(1) : null
  const waistDiff = first?.waist_cm && last?.waist_cm ? (last.waist_cm - first.waist_cm).toFixed(1) : null

  return (
    <>
      {/* RIEPILOGO VARIAZIONE */}
      {(weightDiff !== null || waistDiff !== null) && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {weightDiff !== null && (
            <div style={{background:CARD,borderRadius:12,padding:'14px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:22,fontWeight:800,color:parseFloat(weightDiff)<=0?'#3B6D11':ORANGE}}>{parseFloat(weightDiff)>0?'+':''}{weightDiff}kg</div>
              <div style={{fontSize:10,color:GRAY,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>Variazione peso</div>
            </div>
          )}
          {waistDiff !== null && (
            <div style={{background:CARD,borderRadius:12,padding:'14px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:22,fontWeight:800,color:parseFloat(waistDiff)<=0?'#3B6D11':ORANGE}}>{parseFloat(waistDiff)>0?'+':''}{waistDiff}cm</div>
              <div style={{fontSize:10,color:GRAY,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>Variazione vita</div>
            </div>
          )}
        </div>
      )}

      {/* GRAFICO PESO */}
      {entries.filter(e=>e.weight_kg).length > 1 && (
        <div style={{background:CARD,borderRadius:14,padding:'16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>📉 Andamento peso</div>
          <WeightChart entries={entries.filter(e=>e.weight_kg)}/>
        </div>
      )}

      {/* FOTO DEL PERIODO */}
      {photos.length > 0 && (
        <div style={{background:CARD,borderRadius:14,padding:'16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>📸 Foto del periodo</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {photos.map((p,i)=>(
              <div key={i} style={{position:'relative'}}>
                <img src={p.photo_url} alt={p.label} style={{width:'100%',maxHeight:480,objectFit:'contain',borderRadius:12,display:'block',background:BG}}/>
                <div style={{position:'absolute',bottom:10,left:10,background:'rgba(0,0,0,0.65)',color:'white',fontSize:11,padding:'4px 9px',borderRadius:8,fontWeight:600}}>
                  {p.label} · {new Date(p.photo_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA MISURAZIONI */}
      <div style={{background:CARD,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${BG}`,fontSize:12,fontWeight:700,color:DARK,textTransform:'uppercase',letterSpacing:'0.06em'}}>Misurazioni del periodo</div>
        {entries.length === 0 ? (
          <div style={{padding:'24px',textAlign:'center',fontSize:13,color:GRAY}}>Nessuna misurazione trovata</div>
        ) : entries.map((e,i) => (
          <div key={i} style={{padding:'12px 16px',borderBottom:i<entries.length-1?`1px solid ${BG}`:'none'}}>
            <div style={{fontSize:12,color:GRAY,marginBottom:5}}>{new Date(e.entry_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {MISURE_LABELS.filter(m=>e[m.key]).map(m=>(
                <span key={m.key} style={{fontSize:11,color:DARK,background:BG,padding:'3px 9px',borderRadius:10}}>{m.label}: <strong>{e[m.key]}{m.unit}</strong></span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function WeightChart({ entries }) {
  const weights = entries.map(e => e.weight_kg)
  const min = Math.min(...weights) - 1
  const max = Math.max(...weights) + 1
  const W = 320, H = 90
  const pts = entries.map((e, i) => {
    const x = entries.length>1 ? (i / (entries.length - 1)) * (W - 20) + 10 : W/2
    const y = H - ((e.weight_kg - min) / (max - min)) * (H - 30) - 20
    return `${x},${y}`
  }).join(' ')
  return (
    <div style={{overflowX:'auto'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:W,display:'block'}}>
        <polyline points={pts} fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {entries.map((e, i) => {
          const x = entries.length>1 ? (i / (entries.length - 1)) * (W - 20) + 10 : W/2
          const y = H - ((e.weight_kg - min) / (max - min)) * (H - 30) - 20
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3.5} fill={ORANGE}/>
              <text x={x} y={y-10} textAnchor="middle" fontSize={10} fontWeight="700" fill={DARK}>{e.weight_kg}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
