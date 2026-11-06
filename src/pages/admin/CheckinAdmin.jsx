import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PhotoCompare from '../../components/PhotoCompare'
import PhotoLightbox from '../../components/PhotoLightbox'
import { flashEl } from './shared'

// ── DASHBOARD COACH ──────────────────────────────────────────


// ── COMPONENTE MESSAGGI ADMIN (CHAT) ──────────────────────────────

// ── COMPONENTE CHECK-IN ADMIN ──────────────────────────────
function ScoreBar({v, max=5, inv=false}) {
  const pct = Math.min(100, Math.round((v/max)*100))
  const col = inv ? (v<=2?'#3B6D11':v<=3?'#E8A020':'#E24B4A') : (v>=4?'#3B6D11':v>=3?'#E8A020':'#E24B4A')
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{flex:1,height:5,background:'#141414',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:5,width:`${pct}%`,background:col,borderRadius:3}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:col,minWidth:16,textAlign:'right'}}>{v}</span>
    </div>
  )
}

export default function CheckinAdmin({ focus, clearFocus }) {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [clientProfile, setClientProfile] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [photos, setPhotos] = useState([])
  const [sessions, setSessions] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [expandedCheckin, setExpandedCheckin] = useState(null)
  // arrivo dalla dashboard: si sceglie il cliente e, a dati caricati, si apre il check-in (o si porta in vista foto / misure)
  const fromInbox = focus && ['checkin', 'photo', 'measure'].includes(focus.type)
  useEffect(() => { if (fromInbox && focus.clientId && selectedClient !== focus.clientId) { setSelectedClient(focus.clientId); setExpandedCheckin(null); setExpandedSession(null) } }, [focus])
  useEffect(() => {
    if (!fromInbox || selectedClient !== focus.clientId || clientProfile?.id !== focus.clientId || loading) return      // aspetta i dati di QUEL cliente
    if (focus.type === 'checkin') { setExpandedCheckin(focus.id); flashEl(`[data-checkin-id="${focus.id}"]`) }
    else if (focus.type === 'photo') {
      const day = focus.extra?.date
      const mine = photos.filter(p => p.photo_date === day || String(p.created_at || '').slice(0, 10) === day)
      const target = mine[0] || (!day ? null : photos[0])
      if (target) setLightbox(target)                                  // le foto appena inviate si aprono subito (si scorre con le frecce)
      flashEl('[data-focus="photos"]')
    } else flashEl(focus.id ? `[data-measure-id="${focus.id}"]` : '[data-focus="measures"]')
    clearFocus?.()
  }, [focus, selectedClient, clientProfile, loading])

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,goal').eq('role','client').order('full_name')
      .then(({data}) => setClients(data||[]))
  }, [])

  useEffect(() => {
    if (!selectedClient) return
    setLoading(true)
    const from = new Date(Date.now() - 90*86400000).toISOString().split('T')[0]
    Promise.all([
      supabase.from('profiles').select('*').eq('id',selectedClient).single(),
      supabase.from('weekly_checkins').select('*').eq('client_id',selectedClient).order('week_date',{ascending:false}).limit(12),
      supabase.from('progress_photos').select('*').eq('client_id',selectedClient).order('photo_date',{ascending:false}).limit(24),
      supabase.from('workout_sessions').select('*').eq('client_id',selectedClient).order('session_date',{ascending:false}).limit(20),
      supabase.from('progress_entries').select('*').eq('client_id',selectedClient).order('entry_date',{ascending:false}).limit(16),
      supabase.from('workout_logs').select('*').eq('client_id',selectedClient).gte('log_date',from).order('log_date',{ascending:false}),
    ]).then(([profR, chkR, photoR, sessR, measR, logsR]) => {
      setClientProfile(profR.data)
      setCheckins(chkR.data||[])
      setPhotos(photoR.data||[])
      setSessions(sessR.data||[])
      setMeasurements(measR.data||[])
      setLogs(logsR.data||[])
      setLoading(false)
    })
  }, [selectedClient])

  function scoreColor(v, inv=false) {
    if (!v) return '#888780'
    if (inv) return v<=2?'#3B6D11':v<=3?'#E8A020':'#E24B4A'
    return v>=4?'#3B6D11':v>=3?'#E8A020':'#E24B4A'
  }

  const latest = measurements[0]
  const prev = measurements[1]
  const weightDiff = latest?.weight_kg && prev?.weight_kg
    ? Math.round((latest.weight_kg - prev.weight_kg)*10)/10 : null

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>

      {/* SELEZIONE CLIENTE */}
      <div style={{padding:'12px 16px',borderBottom:'0.5px solid #1A1A1A',background:'#0D0D0D',flexShrink:0}}>
        <select value={selectedClient} onChange={e=>{setSelectedClient(e.target.value);setExpandedCheckin(null);setExpandedSession(null)}}
          style={{width:'100%',padding:'10px 12px',border:'0.5px solid #1C1C1C',borderRadius:10,fontSize:13,color:'#F0F0F0',background:'#161616',outline:'none',fontFamily:'inherit',fontWeight:selectedClient?600:400}}>
          <option value="">👤 Seleziona cliente...</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {/* STATO VUOTO */}
      {!selectedClient && (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#CCC',gap:10}}>
          <i className="ti ti-activity" style={{fontSize:48,opacity:0.2}}/>
          <div style={{fontSize:13}}>Seleziona un cliente per vedere il suo riepilogo completo</div>
        </div>
      )}

      {selectedClient && loading && (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#CCC',fontSize:13}}>
          Caricamento...
        </div>
      )}

      {selectedClient && !loading && (
        <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'14px'}}>

          {/* HEADER CLIENTE */}
          <div style={{background:'linear-gradient(135deg,#1a0a00,#2d1200)',borderRadius:12,padding:'14px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:'#D4570A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:800,color:'white',flexShrink:0}}>
              {clientProfile?.full_name?.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:800,color:'white'}}>{clientProfile?.full_name}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>
                {checkins.length} check-in · {sessions.length} sessioni · {photos.length} foto
              </div>
            </div>
            {latest?.weight_kg && (
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:900,color:'#F4894A'}}>{latest.weight_kg}kg</div>
                {weightDiff!==null && <div style={{fontSize:11,color:weightDiff<0?'#6FCF97':'#E24B4A',fontWeight:600}}>{weightDiff>0?'+':''}{weightDiff}kg</div>}
              </div>
            )}
          </div>

          {/* KPI RAPIDI */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            {[
              {l:'Peso',v:latest?.weight_kg?`${latest.weight_kg}kg`:'—',c:latest?.weight_kg?'#F0F0F0':'#C0BDB8'},
              {l:'Check-in',v:checkins.length,c:'#4A90D4'},
              {l:'Sessioni',v:sessions.length,c:'#D4570A'},
              {l:'Foto',v:photos.length,c:'#9B59B6'},
            ].map(st=>(
              <div key={st.l} style={{background:'#0D0D0D',borderRadius:10,border:'0.5px solid #1C1C1C',padding:'10px 6px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,color:st.c,lineHeight:1}}>{st.v}</div>
                <div style={{fontSize:9,color:'#AAA',textTransform:'uppercase',marginTop:2}}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* GRAFICO PESO */}
          {measurements.length > 1 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>⚖️ Andamento peso</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:3,height:60}}>
                {measurements.slice(0,12).reverse().map((m,i,arr)=>{
                  const vals = arr.map(x=>x.weight_kg)
                  const min = Math.min(...vals), max = Math.max(...vals)
                  const range = max-min || 1
                  const pct = Math.round((m.weight_kg-min)/range*80)+10
                  const isLast = i===arr.length-1
                  return (
                    <div key={m.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                      <div style={{width:'100%',background:isLast?'#D4570A':'#2A2A2A',borderRadius:'3px 3px 0 0',height:`${pct}%`,minHeight:4,transition:'height 0.3s'}}/>
                      <div style={{fontSize:7,color:isLast?'#F4894A':'#B0ADA8',fontWeight:isLast?700:400}}>{m.weight_kg}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#AAA',marginTop:4}}>
                <span>{new Date(measurements.slice(0,12).reverse()[0]?.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                <span>{new Date(measurements[0]?.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
              </div>
            </div>
          )}

          {/* MISURAZIONI */}
          {measurements.length > 0 && (
            <div data-focus="measures" style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>📏 Misurazioni</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:520}}>
                  <thead><tr>{['Data','Peso','Vita','Fianchi','Petto','Braccio','Coscia','% grasso'].map(h=><th key={h} style={{textAlign:h==='Data'?'left':'right',fontSize:10,color:'#AAA',textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 8px',fontWeight:700}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {measurements.slice(0,8).map((m,i)=>{
                      const prevM = measurements[i+1]
                      const d = m.weight_kg!=null && prevM?.weight_kg!=null ? Math.round((m.weight_kg-prevM.weight_kg)*10)/10 : null
                      const v = (x,u) => x!=null && x!=='' ? String(x).replace('.',',')+u : '—'
                      return (
                        <tr key={m.id} data-measure-id={m.id} style={{borderTop:'0.5px solid #1C1C1C'}}>
                          <td style={{padding:'7px 8px',color:'#F0F0F0',whiteSpace:'nowrap'}}>{new Date(m.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</td>
                          <td style={{padding:'7px 8px',textAlign:'right',color:'#F0F0F0',fontWeight:700,whiteSpace:'nowrap'}}>{v(m.weight_kg,' kg')}{d!=null&&d!==0&&<span style={{marginLeft:5,fontSize:10,color:d<0?'#6FCF97':'#F07070'}}>{d>0?'+':''}{String(d).replace('.',',')}</span>}</td>
                          {[m.waist_cm,m.hips_cm,m.chest_cm,m.arm_cm,m.thigh_cm].map((x,k)=><td key={k} style={{padding:'7px 8px',textAlign:'right',color:'#DDD'}}>{v(x,'')}</td>)}
                          <td style={{padding:'7px 8px',textAlign:'right',color:'#DDD'}}>{v(m.body_fat_pct,'%')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONFRONTO PRIMA / DOPO */}
          <PhotoCompare photos={photos} />

          {/* FOTO */}
          {photos.length > 0 && (
            <div data-focus="photos" style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>📷 Foto progressi</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {photos.map(p=>(
                  <div key={p.id} onClick={()=>setLightbox(p)}
                    style={{position:'relative',cursor:'pointer',borderRadius:9,overflow:'hidden',aspectRatio:'3/4',background:'#141414'}}>
                    <img loading="lazy" src={p.photo_url} alt={p.label} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.7))',padding:'10px 5px 4px'}}>
                      <div style={{fontSize:8,color:'white',fontWeight:600,textTransform:'uppercase'}}>{p.label}</div>
                      {p.photo_date&&<div style={{fontSize:7,color:'rgba(255,255,255,0.6)'}}>{new Date(p.photo_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</div>}
                    </div>
                    <div style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.4)',borderRadius:5,padding:'2px 4px'}}>
                      <i className="ti ti-zoom-in" style={{fontSize:9,color:'white'}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHECK-IN SETTIMANALI */}
          {checkins.length > 0 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>✅ Check-in settimanali</div>
              {checkins.map(ck=>{
                const isExp = expandedCheckin===ck.id
                const dateLabel = new Date(ck.week_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
                return (
                  <div key={ck.id} data-checkin-id={ck.id} style={{borderRadius:10,border:'0.5px solid #1C1C1C',marginBottom:8,overflow:'hidden'}}>
                    {/* HEADER */}
                    <div onClick={()=>setExpandedCheckin(isExp?null:ck.id)}
                      style={{padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:'#0D0D0D'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0'}}>Settimana {dateLabel}</div>
                        <div style={{fontSize:10,color:'#CCC',marginTop:2,display:'flex',gap:10}}>
                          {ck.energy_level!=null&&<span>⚡{ck.energy_level}/5</span>}
                          {ck.sleep_quality!=null&&<span>😴{ck.sleep_quality}/5</span>}
                          {ck.stress_level!=null&&<span>🧠{ck.stress_level}/5</span>}
                          {ck.motivation_level!=null&&<span>🔥{ck.motivation_level}/5</span>}
                          {ck.weight_kg&&<span style={{color:'#F4894A',fontWeight:600}}>⚖️{ck.weight_kg}kg</span>}
                        </div>
                      </div>
                      <i className={`ti ti-chevron-${isExp?'up':'down'}`} style={{fontSize:13,color:'#CCC',flexShrink:0}}/>
                    </div>

                    {/* DETTAGLIO */}
                    {isExp && (
                      <div style={{padding:'12px',borderTop:'0.5px solid #1C1C1C',background:'#161616'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:ck.notes?10:0}}>
                          {[
                            {l:'⚡ Energia',v:ck.energy_level,max:5},
                            {l:'😴 Sonno',v:ck.sleep_quality,max:5},
                            {l:'🧠 Stress',v:ck.stress_level,max:5,inv:true},
                            {l:'🔥 Motivazione',v:ck.motivation_level,max:5},
                          ].filter(x=>x.v!=null).map(item=>(
                            <div key={item.l}>
                              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                                <span style={{color:'#CCC'}}>{item.l}</span>
                                <span style={{fontWeight:700,color:scoreColor(item.v,item.inv)}}>{item.v}/{item.max}</span>
                              </div>
                              <ScoreBar v={item.v} max={item.max} inv={item.inv}/>
                            </div>
                          ))}
                        </div>
                        {ck.weight_kg && (
                          <div style={{background:'rgba(212,87,10,0.1)',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:ck.notes?8:0}}>
                            <span style={{color:'#CCC'}}>Peso dichiarato: </span>
                            <span style={{fontWeight:700,color:'#F4894A'}}>{ck.weight_kg}kg</span>
                          </div>
                        )}
                        {ck.notes && (
                          <div style={{background:'#161616',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#CCC',lineHeight:1.6,fontStyle:'italic'}}>
                            "{ck.notes}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ALLENAMENTI */}
          {sessions.length > 0 && (
            <div style={{background:'#0D0D0D',borderRadius:12,border:'0.5px solid #1C1C1C',padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>🏋️ Allenamenti recenti</div>
              {sessions.map(sess=>{
                const isExp = expandedSession===sess.id
                const pct = sess.sets_total>0?Math.round(sess.sets_completed/sess.sets_total*100):0
                const sessLogs = logs.filter(l=>l.log_date===sess.session_date)
                const byEx = {}
                sessLogs.forEach(l=>{ if(!byEx[l.exercise_name]) byEx[l.exercise_name]=[]; byEx[l.exercise_name].push(l) })
                const dateLabel = new Date(sess.session_date+'T12:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})

                return (
                  <div key={sess.id} style={{borderRadius:10,border:'0.5px solid #1C1C1C',marginBottom:8,overflow:'hidden'}}>
                    {/* HEADER */}
                    <div onClick={()=>setExpandedSession(isExp?null:sess.id)}
                      style={{padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:'#0D0D0D'}}>
                      <div style={{width:36,height:36,borderRadius:9,background:'rgba(212,87,10,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <i className="ti ti-barbell" style={{fontSize:16,color:'#D4570A'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sess.day_label||'Allenamento'}</div>
                        <div style={{fontSize:10,color:'#CCC',marginTop:1,display:'flex',gap:8,alignItems:'center'}}>
                          <span>{dateLabel}</span>
                          {sess.total_volume_kg&&<span style={{color:'#F4894A',fontWeight:600}}>{Math.round(sess.total_volume_kg)}kg vol.</span>}
                          {sess.feeling && <span>{['','😓','😐','🙂','😊','🔥'][sess.feeling]}</span>}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:8,fontWeight:600,
                          background:pct>=80?'rgba(59,140,90,0.16)':pct>=50?'rgba(212,87,10,0.14)':'rgba(226,75,74,0.16)',
                          color:pct>=80?'#6FCF97':pct>=50?'#F4894A':'#E24B4A'}}>
                          {pct}%
                        </span>
                        <i className={`ti ti-chevron-${isExp?'up':'down'}`} style={{fontSize:13,color:'#CCC'}}/>
                      </div>
                    </div>

                    {/* DETTAGLIO ESERCIZI */}
                    {isExp && (
                      <div style={{borderTop:'0.5px solid #1C1C1C',background:'#161616'}}>
                        {Object.keys(byEx).length > 0 ? (
                          <div style={{padding:'10px 12px'}}>
                            {Object.entries(byEx).map(([name,ls])=>{
                              const maxKg = Math.max(...ls.map(l=>parseFloat(l.weight_kg)||0))
                              const maxReps = Math.max(...ls.map(l=>parseInt(l.reps_done)||0))
                              return (
                                <div key={name} style={{padding:'7px 0',borderBottom:'0.5px solid #1C1C1C',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{name}</div>
                                    <div style={{fontSize:10,color:'#CCC',marginTop:1}}>{ls.length} serie{maxReps>0?` · ${maxReps} reps`:''}</div>
                                  </div>
                                  {maxKg>0 && <span style={{fontSize:13,fontWeight:700,color:'#F4894A'}}>{maxKg}kg</span>}
                                </div>
                              )
                            })}
                            {sess.notes && (
                              <div style={{marginTop:8,fontSize:11,color:'#CCC',fontStyle:'italic',padding:'6px 8px',background:'#161616',borderRadius:7}}>"{sess.notes}"</div>
                            )}
                          </div>
                        ) : (
                          <div style={{padding:'12px',fontSize:11,color:'#CCC',textAlign:'center'}}>Nessun dettaglio esercizi registrato</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* NESSUN DATO */}
          {checkins.length===0 && sessions.length===0 && photos.length===0 && (
            <div style={{textAlign:'center',padding:'40px 0',color:'#CCC',fontSize:13}}>
              <i className="ti ti-mood-empty" style={{fontSize:36,display:'block',marginBottom:8,opacity:0.3}}/>
              Nessun dato ancora per questo cliente
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX */}
      <PhotoLightbox photos={photos} index={lightbox ? photos.findIndex(x=>x.id===lightbox.id) : null} onChange={(n)=>setLightbox(photos[n])} onClose={()=>setLightbox(null)}/>
    </div>
  )
}
