import React, { useEffect, useState } from 'react'
import { askConfirm } from '../../lib/confirm'
import { thumbUrl, onThumbError } from '../../lib/imageResize'
import { supabase } from '../../lib/supabase'
import { dbSave } from '../../lib/db'
import GraficoPeso from '../../components/GraficoPeso'
import ProgressioneEsercizi from '../../components/ProgressioneEsercizi'
import PhotoLightbox from '../../components/PhotoLightbox'
import Anamnesi from '../Anamnesi'
import { goalLabel, initials, s } from './shared'

export default function ClientDetailModal({ client, plans, onClose, onSaved, onNewPlan, onOpenCheckin }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: client.full_name || '',
    goal: client.goal || 'dimagrimento',
    height_cm: client.height_cm || '',
    phone: client.phone || '',
    notes: client.notes || '',
    coach_notes: client.coach_notes || '',
  })
  const [measurements, setMeasurements] = useState([])
  const [photos, setPhotos] = useState([])
  const [diaryWeek, setDiaryWeek] = useState([])
  const [workoutSessions, setWorkoutSessions] = useState([])
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [allSessionsCount, setAllSessionsCount] = useState(0)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [lastCheckin, setLastCheckin] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [adherenceWeek, setAdherenceWeek] = useState(null)
  const [activeWorkoutPlan, setActiveWorkoutPlan] = useState(null)
  const [activeMealPlan, setActiveMealPlan] = useState(null)
  const [anamnesi, setAnamnesi] = useState(null)
  const [showAnamnesi, setShowAnamnesi] = useState(false)
  const [photoView, setPhotoView] = useState(null)      // foto aperta a schermo intero (indice)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { loadData() }, [client.id])

  async function loadData() {
    setLoadingData(true)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
      const [measRes, photoRes, diaryRes, sessionsRes, sessionsCountRes, logsRes, checkinRes, msgRes, adherenceRes, mealPlanRes, workoutPlanRes] = await Promise.all([
        supabase.from('progress_entries').select('*').eq('client_id', client.id).order('entry_date',{ascending:false}).limit(3),
        supabase.from('progress_photos').select('*').eq('client_id', client.id).order('photo_date',{ascending:false}).limit(6),
        supabase.from('diary_entries').select('entry_date, kcal').eq('client_id', client.id).gte('entry_date', sevenDaysAgo),
        supabase.from('workout_sessions').select('*').eq('client_id', client.id).order('session_date',{ascending:false}).limit(5),
        supabase.from('workout_sessions').select('id', {count:'exact', head:true}).eq('client_id', client.id),
        supabase.from('workout_logs').select('*').eq('client_id', client.id).gte('log_date', sevenDaysAgo).order('log_date',{ascending:false}),
        supabase.from('weekly_checkins').select('*').eq('client_id', client.id).order('week_date',{ascending:false}).limit(1),
        supabase.from('coach_messages').select('id',{count:'exact',head:true}).eq('client_id', client.id).eq('sender_role','client').eq('is_read',false),
        supabase.from('meal_adherence').select('followed').eq('client_id', client.id).gte('adherence_date', sevenDaysAgo),
        supabase.from('meal_plans').select('*').eq('client_id', client.id).eq('is_active', true).limit(1),
        supabase.from('workout_plans').select('*').eq('client_id', client.id).eq('is_active', true).limit(1),
      ])
      setAllSessionsCount(sessionsCountRes.count || 0)
      setMeasurements(measRes.data || [])
      setPhotos(photoRes.data || [])
      setWorkoutSessions(sessionsRes.data || [])
      setWorkoutLogs(logsRes.data || [])
      setLastCheckin(checkinRes.data?.[0] || null)
      setUnreadCount(msgRes.count || 0)
      const adh = adherenceRes.data || []
      setAdherenceWeek(adh.length > 0 ? { followed: adh.filter(a=>a.followed).length, total: adh.length } : null)
      setActiveMealPlan(mealPlanRes.data?.[0] || null)
      if (mealPlanRes.data?.[0]) {
        const mp = mealPlanRes.data[0]
        setPlanEdit({ title: mp.title, kcal_target: mp.kcal_target, protein_target_g: mp.protein_target_g, carbs_target_g: mp.carbs_target_g, fat_target_g: mp.fat_target_g, notes: mp.notes||'' })
      }
      setActiveWorkoutPlan(workoutPlanRes.data?.[0] || null)
      // Anamnesi
      const { data: amnData } = await supabase.from('anamnesi').select('*').eq('client_id', client.id).maybeSingle()
      setAnamnesi(amnData || null)
      const byDay = {}
      ;(diaryRes.data||[]).forEach(d => { byDay[d.entry_date] = (byDay[d.entry_date]||0) + (d.kcal||0) })
      const days = []
      for (let i=6;i>=0;i--) {
        const d = new Date(Date.now() - i*24*60*60*1000).toISOString().split('T')[0]
        days.push({ date:d, kcal: Math.round(byDay[d]||0) })
      }
      setDiaryWeek(days)
    } catch(e) {
      console.error('loadData error:', e)
    }
    setLoadingData(false)
  }

  async function loadAllSessions() {
    const { data } = await supabase.from('workout_sessions')
      .select('*').eq('client_id', client.id).order('session_date',{ascending:false})
    setWorkoutSessions(data || [])
    setShowAllSessions(true)
  }

  async function save() {
    setSaving(true)
    const r = await dbSave(supabase.from('profiles').update({
      full_name: form.full_name,
      goal: form.goal,
      height_cm: form.height_cm ? parseInt(form.height_cm) : null,
      phone: form.phone,
      notes: form.notes,
      coach_notes: form.coach_notes,
    }).eq('id', client.id), 'i dati del cliente', 'salvare', { done: 'Dati cliente salvati' })
    setSaving(false)
    if (r.ok) {
      setEditing(false)
      onSaved()
    }
  }

  const [editingPlan, setEditingPlan] = useState(false)
  const [planEdit, setPlanEdit] = useState({ title:'', kcal_target:'', protein_target_g:'', carbs_target_g:'', fat_target_g:'', notes:'' })

  async function savePlanEdit() {
    if (!activeMealPlan) return
    await dbSave(supabase.from('meal_plans').update({
      title: planEdit.title,
      kcal_target: parseInt(planEdit.kcal_target),
      protein_target_g: parseInt(planEdit.protein_target_g),
      carbs_target_g: parseInt(planEdit.carbs_target_g),
      fat_target_g: parseInt(planEdit.fat_target_g),
      notes: planEdit.notes,
    }).eq('id', activeMealPlan.id), 'il piano alimentare', 'salvare', { done: 'Piano aggiornato' })
    setEditingPlan(false)
    onSaved()
  }

  async function deactivatePlan(planId) {
    if (!(await askConfirm('Disattivare questo piano? Il cliente non lo vedrà più nell\'app.', { confirmLabel: 'Disattiva', danger: true }))) return
    const r = await dbSave(supabase.from('meal_plans').update({ is_active: false }).eq('id', planId), 'il piano alimentare', 'disattivare', { done: 'Piano disattivato' })
    if (!r.ok) return
    setEditingPlan(false)
    onSaved()
  }

  return (
    <div style={s.modal} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modalCard}>

        {/* HEADER */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:600,color:'white',flexShrink:0}}>{initials(client.full_name)}</div>
          <div style={{flex:1}}>
            {editing ? (
              <input style={{...s.input,fontSize:15,fontWeight:600,padding:'6px 10px'}} value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/>
            ) : (
              <div style={{fontSize:16,fontWeight:600,color:'#F0F0F0'}}>{client.full_name}</div>
            )}
            <div style={{fontSize:12,color:'#CCC',marginTop:2}}>Iscritto il {new Date(client.created_at).toLocaleDateString('it-IT')}</div>
          </div>
          <button onClick={()=>setEditing(!editing)} style={{...s.btnSm, background: editing?'#161616':'rgba(212,87,10,0.12)', color: editing?'#AAA':'#F4894A', borderColor: editing?'#333':'#D4570A'}}>
            <i className={`ti ${editing?'ti-x':'ti-pencil'}`} style={{fontSize:13,marginRight:4}}/>{editing?'Annulla':'Modifica'}
          </button>
          <button onClick={()=>setShowAnamnesi(true)} style={{...s.btnSm, background: anamnesi?.completed_at?'rgba(59,140,90,0.12)':'#161616', color: anamnesi?.completed_at?'#6FCF97':'#AAA', borderColor: anamnesi?.completed_at?'#3B6D11':'#333', display:'flex', alignItems:'center', gap:4}}>
            <i className="ti ti-clipboard-heart" style={{fontSize:13}}/>
            {anamnesi?.completed_at ? 'Anamnesi ✓' : anamnesi ? 'Anamnesi (incompleta)' : 'Anamnesi'}
          </button>
        </div>

        {/* INFO PROFILO — vista o editing */}
        {editing ? (
          <div style={{background:'#161616',borderRadius:10,padding:14,marginBottom:16}}>
            <div style={s.grid2}>
              <div style={s.formGroup}><label style={s.label}>Obiettivo</label>
                <select style={s.select} value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))}>
                  <option value="dimagrimento">Dimagrimento</option><option value="massa">Massa muscolare</option><option value="ricomposizione">Ricomposizione corporea</option><option value="mantenimento">Mantenimento</option><option value="forza">Forza</option><option value="resistenza">Resistenza</option>
                </select>
              </div>
              <div style={s.formGroup}><label style={s.label}>Altezza (cm)</label><input inputMode="decimal" style={s.input} type="number" value={form.height_cm} onChange={e=>setForm(f=>({...f,height_cm:e.target.value}))}/></div>
            </div>
            <div style={s.formGroup}><label style={s.label}>Telefono</label><input style={s.input} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
            <div style={s.formGroup}><label style={s.label}>Note (visibili al cliente non sono — uso interno)</label><textarea style={{...s.input,height:50,resize:'vertical'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            <div style={s.formGroup}>
              <label style={s.label}><i className="ti ti-lock" style={{fontSize:11,marginRight:3}}/>Note private del coach</label>
              <textarea style={{...s.input,height:60,resize:'vertical',borderColor:'#D4570A'}} placeholder="Es. intolleranza al lattosio, preferisce pasti veloci, infortunio al ginocchio..." value={form.coach_notes} onChange={e=>setForm(f=>({...f,coach_notes:e.target.value}))}/>
            </div>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving?'Salvataggio...':'Salva modifiche'}</button>
          </div>
        ) : (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:14}}>
              {[
                {l:'Obiettivo',v:goalLabel[client.goal]||'—'},
                {l:'Altezza',v:client.height_cm?`${client.height_cm} cm`:'—'},
                {l:'Telefono',v:client.phone||'—'},
                {l:'Abbonamento',v:client.subscription_type||(client.subscription_end?'—':'Non impostato')},
                {l:'Scadenza',v:client.subscription_end?new Date(client.subscription_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}):'—'},
                {l:'Stato',v:!client.subscription_end?'—':Math.ceil((new Date(client.subscription_end)-new Date())/(1000*60*60*24)) < 0 ? '⚠️ Scaduto' : Math.ceil((new Date(client.subscription_end)-new Date())/(1000*60*60*24)) <=7 ? `⚠️ Scade in ${Math.ceil((new Date(client.subscription_end)-new Date())/(1000*60*60*24))}gg` : `✓ Attivo`},
              ].map(r=>(
                <div key={r.l} style={{background:'#161616',borderRadius:8,padding:'8px 12px'}}>
                  <div style={{fontSize:10,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.06em'}}>{r.l}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#F0F0F0',marginTop:2}}>{r.v}</div>
                </div>
              ))}
            </div>
            {client.notes&&(
              <div style={{marginBottom:10,background:'#161616',borderLeft:'3px solid #888780',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#CCC'}}>
                <div style={{fontSize:10,color:'#CCC',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>Note</div>
                {client.notes}
              </div>
            )}
            {client.coach_notes&&(
              <div style={{marginBottom:14,background:'rgba(212,87,10,0.1)',borderLeft:'3px solid #D4570A',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#F4894A'}}>
                <div style={{fontSize:10,color:'#D4570A',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:4}}><i className="ti ti-lock" style={{fontSize:10}}/>Note private coach</div>
                {client.coach_notes}
              </div>
            )}
          </>
        )}

        {/* ── SEZIONE ALIMENTAZIONE ── */}
        <div style={{fontSize:12,fontWeight:700,color:'#F4894A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,display:'flex',alignItems:'center',gap:6,borderBottom:'1px solid rgba(212,87,10,0.3)',paddingBottom:8}}>
          <i className="ti ti-clipboard-list" style={{fontSize:14}}/>Alimentazione
        </div>

        {/* PIANO ATTIVO */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Piano alimentare</div>
          {activeMealPlan ? (
            <div>
              <div style={{background:'rgba(212,87,10,0.1)',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'#F4894A'}}>{activeMealPlan.title}</div>
                  <div style={{fontSize:11,color:'#F4894A',marginTop:2}}>{activeMealPlan.kcal_target} kcal · P{activeMealPlan.protein_target_g}g C{activeMealPlan.carbs_target_g}g G{activeMealPlan.fat_target_g}g</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{...s.badge,background:'#3B6D11',color:'white'}}>Attivo</span>
                  <a href={`/modifica-piano/${activeMealPlan.id}`} style={{...s.btnSm,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
                    <i className="ti ti-tools-kitchen-2" style={{fontSize:12}}/>Modifica pasti
                  </a>
                  <button onClick={()=>setEditingPlan(!editingPlan)} style={{...s.btnSm,background:editingPlan?'#D4570A':'#161616',color:editingPlan?'white':'#888780'}}>
                    {editingPlan?'Chiudi':'✏️ Target'}
                  </button>
                </div>
              </div>
              {editingPlan && (
                <div style={{background:'#161616',borderRadius:10,padding:'14px',border:'0.5px solid #1C1C1C'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                    <div><label style={s.label}>Kcal target</label><input inputMode="decimal" style={s.input} type="number" value={planEdit.kcal_target} onChange={e=>setPlanEdit(p=>({...p,kcal_target:e.target.value}))}/></div>
                    <div><label style={s.label}>Proteine (g)</label><input inputMode="decimal" style={s.input} type="number" value={planEdit.protein_target_g} onChange={e=>setPlanEdit(p=>({...p,protein_target_g:e.target.value}))}/></div>
                    <div><label style={s.label}>Carboidrati (g)</label><input inputMode="decimal" style={s.input} type="number" value={planEdit.carbs_target_g} onChange={e=>setPlanEdit(p=>({...p,carbs_target_g:e.target.value}))}/></div>
                    <div><label style={s.label}>Grassi (g)</label><input inputMode="decimal" style={s.input} type="number" value={planEdit.fat_target_g} onChange={e=>setPlanEdit(p=>({...p,fat_target_g:e.target.value}))}/></div>
                  </div>
                  <div style={{marginBottom:10}}><label style={s.label}>Titolo</label><input style={s.input} value={planEdit.title} onChange={e=>setPlanEdit(p=>({...p,title:e.target.value}))}/></div>
                  <div style={{marginBottom:10}}><label style={s.label}>Note</label><textarea style={{...s.input,resize:'none',height:60}} value={planEdit.notes||''} onChange={e=>setPlanEdit(p=>({...p,notes:e.target.value}))}/></div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={savePlanEdit} style={{...s.btn,flex:1,justifyContent:'center',fontSize:12}}>Salva modifiche</button>
                    <button onClick={()=>deactivatePlan(activeMealPlan.id)} style={{...s.btnGray,fontSize:12}}>Disattiva piano</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{background:'#161616',borderRadius:10,padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'#CCC'}}>Nessun piano attivo</span>
              <button style={s.btnSm} onClick={onNewPlan}>+ Crea piano</button>
            </div>
          )}
        </div>

        {/* DIARIO ULTIMI 7 GIORNI */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Diario — ultimi 7 giorni</div>
          {loadingData ? (
            <div style={{fontSize:12,color:'#CCC'}}>Caricamento...</div>
          ) : (
            <div style={{display:'flex',gap:4}}>
              {diaryWeek.map(d => {
                const target = activeMealPlan?.kcal_target || 2200
                const pct = Math.min(100, Math.round(d.kcal/target*100))
                const dayLabel = new Date(d.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'}).slice(0,1).toUpperCase()
                return (
                  <div key={d.date} style={{flex:1,textAlign:'center'}}>
                    <div style={{height:50,background:'#161616',borderRadius:6,display:'flex',alignItems:'flex-end',overflow:'hidden'}}>
                      <div style={{width:'100%',height:`${Math.max(pct,d.kcal>0?8:0)}%`,background:d.kcal===0?'transparent':pct>=90?'#3B6D11':'#D4570A',borderRadius:6,transition:'height 0.3s'}}/>
                    </div>
                    <div style={{fontSize:9,color:'#CCC',marginTop:3}}>{dayLabel}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* GRAFICO PESO */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Andamento peso</div>
          <div style={{background:'#161616',borderRadius:10,padding:'12px'}}>
            <GraficoPeso clientId={client.id} targetWeight={anamnesi?.peso_desiderato}/>
          </div>
        </div>

        {/* INDICATORI RAPIDI */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
          {/* Messaggi non letti */}
          <div style={{background: unreadCount>0?'rgba(212,87,10,0.14)':'#161616',borderRadius:9,padding:'10px 12px',textAlign:'center',border: unreadCount>0?'0.5px solid #D4570A':'0.5px solid #2A2A2A'}}>
            <div style={{fontSize:18,fontWeight:800,color:unreadCount>0?'#F4894A':'#888780'}}>{unreadCount}</div>
            <div style={{fontSize:9,color:unreadCount>0?'#F4894A':'#888780',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>Msg non letti</div>
          </div>
          {/* Aderenza piano */}
          <div style={{background:'#161616',borderRadius:9,padding:'10px 12px',textAlign:'center',border:'0.5px solid #1C1C1C'}}>
            <div style={{fontSize:18,fontWeight:800,color: adherenceWeek ? (adherenceWeek.followed/adherenceWeek.total>=0.7?'#6FCF97':'#F4894A') : '#888780'}}>
              {adherenceWeek ? `${Math.round(adherenceWeek.followed/adherenceWeek.total*100)}%` : '—'}
            </div>
            <div style={{fontSize:9,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>Aderenza pasti</div>
          </div>
          {/* Allenamenti settimana */}
          <div style={{background:'#161616',borderRadius:9,padding:'10px 12px',textAlign:'center',border:'0.5px solid #1C1C1C'}}>
            <div style={{fontSize:18,fontWeight:800,color:'#F4894A'}}>{workoutSessions.filter(s=>{const d=new Date(s.session_date);return(new Date()-d)<7*24*60*60*1000}).length}</div>
            <div style={{fontSize:9,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>Allenamenti/7gg</div>
          </div>
        </div>

        {/* ULTIMO CHECK-IN */}
        {lastCheckin && (
          <div style={{background:'#161616',borderRadius:9,padding:'12px',marginBottom:14}}>
            <div style={{fontSize:10,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>
              Check-in — settimana del {new Date(lastCheckin.week_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}
            </div>
            <div style={{display:'flex',gap:16}}>
              {[{l:'⚡ Energia',v:lastCheckin.energy},{l:'😴 Sonno',v:lastCheckin.sleep},{l:'🧘 Stress',v:lastCheckin.stress}].map(item=>(
                <div key={item.l} style={{flex:1,textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:800,color:item.v>=4?'#6FCF97':item.v<=2?'#F4894A':'#F0F0F0'}}>{item.v}<span style={{fontSize:10,color:'#CCC'}}>/5</span></div>
                  <div style={{fontSize:9,color:'#CCC',marginTop:2}}>{item.l}</div>
                </div>
              ))}
            </div>
            {lastCheckin.notes && <div style={{fontSize:11,color:'#CCC',marginTop:8,fontStyle:'italic'}}>"{lastCheckin.notes}"</div>}
          </div>
        )}

        {/* ── SEZIONE ALLENAMENTO ── */}
        <div style={{fontSize:12,fontWeight:700,color:'#F4894A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(212,87,10,0.3)',paddingBottom:8}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><i className="ti ti-barbell" style={{fontSize:14}}/>Allenamento</span>
          {activeWorkoutPlan && (
            <a href={`/modifica-allenamento/${activeWorkoutPlan.id}`} style={{...s.btnSm,textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:11}}>
              <i className="ti ti-pencil" style={{fontSize:11}}/>Modifica scheda
            </a>
          )}
          {!activeWorkoutPlan && (
            <a href="/importa-allenamento" onClick={e=>{e.preventDefault();window.history.pushState({},"","/importa-allenamento");window.dispatchEvent(new PopStateEvent("popstate"))}} style={{...s.btnSm,textDecoration:'none',fontSize:11}}>+ Importa scheda</a>
          )}
        </div>

        {/* PROGRESSIONE PESI */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Progressione esercizi</div>
          <div style={{background:'#161616',borderRadius:10,padding:'12px'}}>
            <ProgressioneEsercizi clientId={client.id}/>
          </div>
        </div>

        {/* NOTE ALLENAMENTO */}
        {workoutSessions.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                <i className="ti ti-barbell" style={{fontSize:12,marginRight:4}}/>Allenamenti recenti
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {activeWorkoutPlan && (
                  <a href={`/modifica-allenamento/${activeWorkoutPlan.id}`} style={{...s.btnSm,textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:11}}>
                    <i className="ti ti-pencil" style={{fontSize:11}}/>Modifica scheda
                  </a>
                )}
                {!showAllSessions && allSessionsCount > workoutSessions.length && (
                  <button onClick={loadAllSessions} style={{background:'none',border:'none',color:'#F4894A',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    Vedi tutto ({allSessionsCount}) →
                  </button>
                )}
              </div>
            </div>
            <div style={{maxHeight: 'none', overflowY: 'visible'}}>
              {workoutSessions.map(sess => {
                const pct = sess.sets_total > 0 ? Math.round(sess.sets_completed/sess.sets_total*100) : 0
                // Trova i log di quella sessione
                const sessLogs = workoutLogs.filter(l => l.log_date === sess.session_date)
                const byEx = {}
                sessLogs.forEach(l => { if (!byEx[l.exercise_name]) byEx[l.exercise_name] = []; byEx[l.exercise_name].push(l) })
                return (
                  <div key={sess.id} style={{background:'#161616',borderRadius:8,padding:'10px 12px',marginBottom:6,fontSize:12,color:'#CCC',lineHeight:1.5}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#CCC',marginBottom:6,fontWeight:600}}>
                      <span>{sess.day_label} · {new Date(sess.session_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
                      <span style={{color: pct>=100?'#6FCF97':'#F4894A'}}>{sess.sets_completed}/{sess.sets_total} ({pct}%)</span>
                    </div>
                    {Object.entries(byEx).map(([exName, logs]) => {
                      const maxW = Math.max(...logs.map(l=>l.weight_kg||0))
                      return (
                        <div key={exName} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 0',borderBottom:'0.5px solid #1A1A1A'}}>
                          <span style={{color:'#F0F0F0',fontWeight:500}}>{exName}</span>
                          <span style={{color:'#F4894A',fontWeight:700}}>{logs.length} serie {maxW>0?`· max ${maxW}kg`:''}</span>
                        </div>
                      )
                    })}
                    {sess.notes && <div style={{fontSize:11,color:'#CCC',marginTop:6,fontStyle:'italic'}}>{sess.notes}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FOTO RECENTI */}
        {photos.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,color:'#CCC',textTransform:'uppercase',letterSpacing:'0.07em'}}>Foto recenti ({photos.length}) — tocca per ingrandire</div>
              {onOpenCheckin && <button type="button" onClick={()=>onOpenCheckin(client)} style={{background:'none',border:'none',color:'#F4894A',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',padding:0}}>Tutte le foto →</button>}
            </div>
            <div style={{display:'flex',gap:6,overflowX:'auto'}}>
              {photos.map((p,i) => (
                <button key={p.id} type="button" onClick={()=>setPhotoView(i)} aria-label={`Apri foto ${p.label||''} del ${p.photo_date||''}`.trim()}
                  style={{padding:0,border:'0.5px solid #2A2A2A',background:'none',borderRadius:8,cursor:'zoom-in',flexShrink:0,overflow:'hidden'}}>
                  <img src={thumbUrl(p.photo_url)} data-full={p.photo_url} onError={onThumbError} loading="lazy" decoding="async" alt={p.label} style={{width:60,height:80,objectFit:'cover',display:'block'}}/>
                </button>
              ))}
            </div>
            <PhotoLightbox photos={photos} index={photoView} onChange={setPhotoView} onClose={()=>setPhotoView(null)}/>
          </div>
        )}

        <button style={s.cancelBtn} onClick={onClose}>Chiudi</button>

        {/* MODALE ANAMNESI */}
        {showAnamnesi && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{width:'100%',maxWidth:640,maxHeight:'90vh',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <Anamnesi clientId={client.id} onClose={()=>setShowAnamnesi(false)}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
