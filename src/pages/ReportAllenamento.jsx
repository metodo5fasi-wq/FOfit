import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  page: { flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'0 0 20px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  textarea: { width:'100%', padding:'9px 12px', border:'0.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', resize:'vertical', minHeight:80, boxSizing:'border-box', lineHeight:1.6 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:9, padding:'11px 20px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'var(--bg-input)', color:'var(--text-muted)', border:'0.5px solid var(--border)', borderRadius:9, padding:'11px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  chip: (active) => ({ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', background:active?'#D4570A':'var(--bg-card)', color:active?'white':'var(--text-muted)', borderColor:active?'#D4570A':'var(--border)', transition:'all 0.15s' }),
  scale: (active, color='#D4570A') => ({ width:38, height:38, borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', background:active?color:'var(--bg-card)', color:active?'white':'var(--text-muted)', borderColor:active?color:'var(--border)' }),
  sectionTitle: { fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:4 },
  sectionSub: { fontSize:13, color:'var(--text-muted)', marginBottom:14, lineHeight:1.5 },
  exCard: { background:'var(--bg-input)', borderRadius:10, padding:'12px', marginBottom:10 },
}

function Scale({ value, onChange, max=10, colorFn }) {
  return (
    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
      {Array.from({length:max},(_,i)=>i+1).map(i=>{
        const color = colorFn ? colorFn(i) : '#D4570A'
        return <button key={i} onClick={()=>onChange(i)} style={s.scale(value===i,color)}>{i}</button>
      })}
    </div>
  )
}

function Chips({ options, value, onChange, multi=false }) {
  const arr = multi ? (value||[]) : null
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {options.map(o=>{
        const v = typeof o==='string'?o:o.value
        const l = typeof o==='string'?o:o.label
        const active = multi ? arr?.includes(v) : value===v
        return <button key={v} onClick={()=>multi?onChange(arr?.includes(v)?arr.filter(x=>x!==v):[...(arr||[]),v]):onChange(v===value?null:v)} style={s.chip(active)}>{l}</button>
      })}
    </div>
  )
}

export default function ReportAllenamento({ reportId, onClose, readOnly=false, adminView=false }) {
  const { profile } = useAuth()
  const clientId = profile?.id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [report, setReport] = useState(null)
  const [exercises, setExercises] = useState([])
  const [progressi, setProgressi] = useState([])
  const [adherence, setAdherence] = useState(null)
  const [diaryStats, setDiaryStats] = useState(null)

  const [data, setData] = useState({
    period_start: '', period_end: '',
    peso_inizio: '', peso_fine: '',
    benessere_generale: null, energia_allenamento: null,
    qualita_sonno: null, stress_periodo: null,
    difficolta_alimentazione: '', pasti_saltati: '', fame_saziet: null, note_alimentazione: '',
    doms: null, zona_affaticata: '', dolori_nuovi: '', qualita_recupero: null,
    esercizi_amati: '', esercizi_difficili: '', cosa_cambieresti: '', obiettivo_prossimo: '',
    note_coach: '',
  })

  useEffect(() => { if (clientId || reportId) load() }, [clientId, reportId])

  async function load() {
    setLoading(true)
    try {
      // Carica report esistente o bozza
      let rep = null
      if (reportId) {
        const { data: r } = await supabase.from('workout_reports').select('*').eq('id', reportId).single()
        rep = r
      } else {
        const { data: r } = await supabase.from('workout_reports').select('*')
          .eq('client_id', clientId).is('submitted_at', null).order('created_at',{ascending:false}).limit(1)
        rep = r?.[0]
      }
      if (rep) {
        setReport(rep)
        setData({
          period_start: rep.period_start||'', period_end: rep.period_end||'',
          peso_inizio: rep.peso_inizio||'', peso_fine: rep.peso_fine||'',
          benessere_generale: rep.benessere_generale, energia_allenamento: rep.energia_allenamento,
          qualita_sonno: rep.qualita_sonno, stress_periodo: rep.stress_periodo,
          difficolta_alimentazione: rep.difficolta_alimentazione||'', pasti_saltati: rep.pasti_saltati||'',
          fame_saziet: rep.fame_saziet, note_alimentazione: rep.note_alimentazione||'',
          doms: rep.doms, zona_affaticata: rep.zona_affaticata||'', dolori_nuovi: rep.dolori_nuovi||'',
          qualita_recupero: rep.qualita_recupero,
          esercizi_amati: rep.esercizi_amati||'', esercizi_difficili: rep.esercizi_difficili||'',
          cosa_cambieresti: rep.cosa_cambieresti||'', obiettivo_prossimo: rep.obiettivo_prossimo||'',
          note_coach: rep.note_coach||'',
        })
        if (rep.progressi_esercizi) setProgressi(rep.progressi_esercizi)
      }

      if (!adminView) {
        // Carica scheda attiva — cerca sia is_active=true che l'ultima scheda disponibile
        let wpId = null
        const { data: wp } = await supabase.from('workout_plans')
          .select('id').eq('client_id', clientId).eq('is_active', true).limit(1)
        if (wp?.[0]) {
          wpId = wp[0].id
        } else {
          // Fallback: prendi l'ultima scheda anche se non attiva
          const { data: wpAny } = await supabase.from('workout_plans')
            .select('id').eq('client_id', clientId).order('created_at', {ascending:false}).limit(1)
          if (wpAny?.[0]) wpId = wpAny[0].id
        }

        if (wpId) {
          const { data: exs } = await supabase.from('workout_exercises')
            .select('exercise_name,day_label').eq('plan_id', wpId).order('order_index')
          const uniqueEx = [...new Map((exs||[]).map(e=>[e.exercise_name,e])).values()]
          setExercises(uniqueEx)

          // Progressi automatici: primo e ultimo carico nelle ultime 8 settimane
          const from = new Date(Date.now()-56*24*60*60*1000).toISOString().split('T')[0]
          const { data: logs } = await supabase.from('workout_logs').select('exercise_name,weight_kg,reps_done,log_date')
            .eq('client_id', clientId).gte('log_date', from).order('log_date')

          // Costruisci progressi sempre — anche senza log, mostra gli esercizi con campi vuoti
          if (!rep?.progressi_esercizi) {
            const byEx = {}
            ;(logs||[]).forEach(l => {
              if (!l.weight_kg) return
              if (!byEx[l.exercise_name]) byEx[l.exercise_name] = { first: l.weight_kg, last: l.weight_kg }
              else byEx[l.exercise_name].last = l.weight_kg
            })
            const prog = uniqueEx.map(ex => ({
              exercise_name: ex.exercise_name,
              day_label: ex.day_label,
              carico_inizio: byEx[ex.exercise_name]?.first || null,
              carico_fine: byEx[ex.exercise_name]?.last || null,
              note: '',
            }))
            if (prog.length) setProgressi(prog)
          }
        }

        // Aderenza automatica ultime 4 settimane
        const from4w = new Date(Date.now()-28*24*60*60*1000).toISOString().split('T')[0]
        const { data: adh } = await supabase.from('meal_adherence').select('followed').eq('client_id', clientId).gte('adherence_date', from4w)
        if (adh?.length) setAdherence({ followed: adh.filter(a=>a.followed).length, total: adh.length, pct: Math.round(adh.filter(a=>a.followed).length/adh.length*100) })

        // Statistiche diario
        const { data: diary } = await supabase.from('diary_entries').select('entry_date,kcal').eq('client_id', clientId).gte('entry_date', from4w)
        if (diary?.length) setDiaryStats({ days: diary.length, avgKcal: Math.round(diary.reduce((s,d)=>s+(d.kcal||0),0)/diary.length) })
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function set(field, val) { setData(p=>({...p,[field]:val})) }
  function setEx(idx, field, val) {
    setProgressi(p => p.map((e,i) => i===idx ? {...e,[field]:val} : e))
  }

  async function saveDraft() {
    setSaving(true)
    const payload = { ...data, client_id: clientId, progressi_esercizi: progressi,
      peso_inizio: data.peso_inizio ? parseFloat(String(data.peso_inizio).replace(',','.')) : null,
      peso_fine: data.peso_fine ? parseFloat(String(data.peso_fine).replace(',','.')) : null,
    }
    let savedId = report?.id
    try {
      if (report?.id) {
        const { error } = await supabase.from('workout_reports').update(payload).eq('id', report.id)
        if (error) throw error
      } else {
        const { data: r, error } = await supabase.from('workout_reports').insert(payload).select().single()
        if (error) throw error
        if (r) { setReport(r); savedId = r.id }
      }
    } catch(e) {
      console.error('saveDraft error:', e)
      throw e // propaga l'errore a submit
    }
    setSaving(false)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2000)
    return savedId // restituisce l'ID
  }

  async function submit() {
    setSubmitting(true)
    try {
      const id = await saveDraft() // usa l'ID restituito direttamente
      if (!id) throw new Error('ID report non trovato dopo il salvataggio')

      const { error } = await supabase.from('workout_reports')
        .update({ submitted_at: new Date().toISOString(), read_by_coach: false })
        .eq('id', id)
      if (error) throw error

      setSubmitting(false)
      // Mostra conferma prima di chiudere
      setSaved(true)
      setTimeout(() => {
        if (onClose) onClose()
        else window.location.reload()
      }, 1500)
    } catch(e) {
      setSubmitting(false)
      alert('Errore nell\'invio: ' + e.message + '\n\nI dati sono stati salvati come bozza.')
    }
  }

  if (loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',fontSize:13}}>Caricamento...</div>

  const isReadOnly = readOnly || !!report?.submitted_at

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>
      {/* TOPBAR */}
      {onClose && (
        <div style={{background:'var(--bg-card)',borderBottom:'0.5px solid var(--border)',padding:'0 16px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Report allenamento</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {saved && <span style={{fontSize:11,color:'#3B6D11',fontWeight:600}}>✓ Salvato</span>}
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:20}}>✕</button>
          </div>
        </div>
      )}

      <div style={s.page}>
        <div style={{padding:'16px 16px 0'}}>

          {/* STATO */}
          {report?.submitted_at && (
            <div style={{background:'#EAF3DE',border:'0.5px solid #3B6D11',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#3B6D11',fontWeight:600}}>
              ✓ Report inviato il {new Date(report.submitted_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
            </div>
          )}

          {/* DATI AUTOMATICI */}
          {!adminView && (adherence || diaryStats) && (
            <div style={{background:'linear-gradient(135deg,#FEF0E7,#FFF8F5)',border:'0.5px solid #F4C9A8',borderRadius:12,padding:'14px',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'#D4570A',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>📊 Dati automatici — ultime 4 settimane</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                {adherence && (
                  <div>
                    <div style={{fontSize:20,fontWeight:800,color:adherence.pct>=70?'#3B6D11':'#D4570A'}}>{adherence.pct}%</div>
                    <div style={{fontSize:10,color:'#888780'}}>Aderenza piano · {adherence.followed}/{adherence.total} pasti</div>
                  </div>
                )}
                {diaryStats && (
                  <div>
                    <div style={{fontSize:20,fontWeight:800,color:'#111'}}>{diaryStats.days}/28</div>
                    <div style={{fontSize:10,color:'#888780'}}>Giorni diario · media {diaryStats.avgKcal} kcal</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* S1 — PERIODO E BENESSERE */}
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
              <span>📅</span> Periodo e benessere
            </div>
            <div style={{...s.grid2,marginBottom:10}}>
              <div><label style={s.label}>Inizio periodo</label><input style={s.input} type="date" value={data.period_start} disabled={isReadOnly} onChange={e=>set('period_start',e.target.value)}/></div>
              <div><label style={s.label}>Fine periodo</label><input style={s.input} type="date" value={data.period_end} disabled={isReadOnly} onChange={e=>set('period_end',e.target.value)}/></div>
              <div><label style={s.label}>Peso inizio (kg)</label><input style={s.input} type="text" inputMode="decimal" value={data.peso_inizio} disabled={isReadOnly} onChange={e=>set('peso_inizio',e.target.value)} placeholder="es. 78,5"/></div>
              <div><label style={s.label}>Peso fine (kg)</label><input style={s.input} type="text" inputMode="decimal" value={data.peso_fine} disabled={isReadOnly} onChange={e=>set('peso_fine',e.target.value)} placeholder="es. 76,0"/></div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Benessere generale nel periodo (1=pessimo · 10=ottimo)</label>
              <Scale value={data.benessere_generale} onChange={v=>!isReadOnly&&set('benessere_generale',v)} colorFn={i=>i<=3?'#E24B4A':i<=6?'#E8A020':'#3B6D11'}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Energia durante gli allenamenti (1-10)</label>
              <Scale value={data.energia_allenamento} onChange={v=>!isReadOnly&&set('energia_allenamento',v)} colorFn={i=>i<=3?'#E24B4A':i<=6?'#E8A020':'#3B6D11'}/>
            </div>
            <div style={{...s.grid2}}>
              <div>
                <label style={s.label}>Qualità del sonno (1-10)</label>
                <Scale value={data.qualita_sonno} onChange={v=>!isReadOnly&&set('qualita_sonno',v)} colorFn={i=>i<=3?'#E24B4A':i<=6?'#E8A020':'#3B6D11'}/>
              </div>
              <div>
                <label style={s.label}>Stress nel periodo (1=basso · 10=alto)</label>
                <Scale value={data.stress_periodo} onChange={v=>!isReadOnly&&set('stress_periodo',v)} colorFn={i=>i<=3?'#3B6D11':i<=6?'#E8A020':'#E24B4A'}/>
              </div>
            </div>
          </div>

          {/* S2 — PROGRESSI ESERCIZI */}
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
              <span>🏋️</span> Progressi di carico
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>
              I carichi sono stati caricati automaticamente dai tuoi log. Correggili se necessario e aggiungi note per ogni esercizio.
            </div>
            {progressi.length === 0 && (
              <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:'16px 0'}}>
                Nessun esercizio trovato. Completa almeno un allenamento prima di inviare il report.
              </div>
            )}
            {progressi.map((ex, idx) => {
              const diff = ex.carico_fine && ex.carico_inizio ? (parseFloat(ex.carico_fine) - parseFloat(ex.carico_inizio)).toFixed(1) : null
              return (
                <div key={idx} style={s.exCard}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{ex.exercise_name}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{ex.day_label}</div>
                    </div>
                    {diff !== null && (
                      <span style={{fontSize:12,fontWeight:700,color:parseFloat(diff)>0?'#3B6D11':parseFloat(diff)<0?'#E24B4A':'#888780',background:parseFloat(diff)>0?'#EAF3DE':parseFloat(diff)<0?'#FEE2E2':'#F5F3EF',padding:'3px 8px',borderRadius:8}}>
                        {parseFloat(diff)>0?'+':''}{diff}kg
                      </span>
                    )}
                  </div>
                  <div style={{...s.grid2,marginBottom:8}}>
                    <div>
                      <label style={s.label}>Carico inizio (kg)</label>
                      <input style={s.input} type="text" inputMode="decimal" value={ex.carico_inizio||''} disabled={isReadOnly}
                        onChange={e=>setEx(idx,'carico_inizio',e.target.value.replace(',','.'))} placeholder="es. 60"/>
                    </div>
                    <div>
                      <label style={s.label}>Carico fine (kg)</label>
                      <input style={s.input} type="text" inputMode="decimal" value={ex.carico_fine||''} disabled={isReadOnly}
                        onChange={e=>setEx(idx,'carico_fine',e.target.value.replace(',','.'))} placeholder="es. 70"/>
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Note (tecnica, sensazioni, difficoltà...)</label>
                    <textarea style={{...s.textarea,minHeight:60}} value={ex.note||''} disabled={isReadOnly}
                      onChange={e=>setEx(idx,'note',e.target.value)}
                      placeholder="Es. tecnica migliorata, sensazione di forza aumentata, fastidio al gomito..."/>
                  </div>
                </div>
              )
            })}
          </div>

          {/* S3 — ALIMENTAZIONE */}
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
              <span>🥗</span> Alimentazione
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Fame e sazietà durante il piano</label>
              <Chips options={['Troppa fame','Fame accettabile','Ok — bilanciato','Spesso sazio','Troppo sazio']} value={data.fame_saziet} onChange={v=>!isReadOnly&&set('fame_saziet',v)}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Principali difficoltà nell'alimentazione</label>
              <textarea style={s.textarea} value={data.difficolta_alimentazione} disabled={isReadOnly} onChange={e=>set('difficolta_alimentazione',e.target.value)} placeholder="Es. difficoltà a preparare i pasti, pranzo fuori, cene sociali..."/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Pasti che salti più spesso</label>
              <input style={s.input} value={data.pasti_saltati} disabled={isReadOnly} onChange={e=>set('pasti_saltati',e.target.value)} placeholder="Es. spesso salto la colazione, lo spuntino pomeridiano..."/>
            </div>
            <div>
              <label style={s.label}>Altre note sull'alimentazione</label>
              <textarea style={s.textarea} value={data.note_alimentazione} disabled={isReadOnly} onChange={e=>set('note_alimentazione',e.target.value)} placeholder="Tutto quello che vuoi dirmi sul piano alimentare..."/>
            </div>
          </div>

          {/* S4 — RECUPERO */}
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
              <span>💤</span> Recupero e corpo
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>DOMS (dolori muscolari post allenamento)</label>
              <Chips options={['Rari','Normali','Frequenti','Invalidanti']} value={data.doms} onChange={v=>!isReadOnly&&set('doms',v)}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Qualità del recupero tra le sessioni</label>
              <Chips options={['Ottimo','Buono','Sufficiente','Scarso']} value={data.qualita_recupero} onChange={v=>!isReadOnly&&set('qualita_recupero',v)}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Zona del corpo più affaticata</label>
              <input style={s.input} value={data.zona_affaticata} disabled={isReadOnly} onChange={e=>set('zona_affaticata',e.target.value)} placeholder="Es. schiena bassa, spalle, gambe..."/>
            </div>
            <div>
              <label style={s.label}>Dolori o fastidi nuovi emersi in questo periodo</label>
              <textarea style={s.textarea} value={data.dolori_nuovi} disabled={isReadOnly} onChange={e=>set('dolori_nuovi',e.target.value)} placeholder="Es. fastidio al ginocchio destro durante gli squat, tensione alla spalla sinistra..."/>
            </div>
          </div>

          {/* S5 — FEEDBACK SCHEDA */}
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
              <span>📋</span> Feedback sulla scheda
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Esercizi che hai amato di più</label>
              <textarea style={s.textarea} value={data.esercizi_amati} disabled={isReadOnly} onChange={e=>set('esercizi_amati',e.target.value)} placeholder="Es. mi è piaciuto molto il rematore, le trazioni sono diventate più facili..."/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Esercizi che trovi difficili o non ti piacciono</label>
              <textarea style={s.textarea} value={data.esercizi_difficili} disabled={isReadOnly} onChange={e=>set('esercizi_difficili',e.target.value)} placeholder="Es. gli affondi mi mettono in difficoltà, non riesco a sentire i pettorali sulla panca..."/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Cosa cambieresti della scheda attuale</label>
              <textarea style={s.textarea} value={data.cosa_cambieresti} disabled={isReadOnly} onChange={e=>set('cosa_cambieresti',e.target.value)} placeholder="Es. vorrei più volume per le gambe, meno ripetizioni e più carichi..."/>
            </div>
            <div>
              <label style={s.label}>Il tuo obiettivo per il prossimo periodo</label>
              <textarea style={s.textarea} value={data.obiettivo_prossimo} disabled={isReadOnly} onChange={e=>set('obiettivo_prossimo',e.target.value)} placeholder="Es. continuare a migliorare i carichi, lavorare sulla tecnica dello stacco, perdere altri 2kg..."/>
            </div>
          </div>

          {/* S6 — NOTE LIBERE */}
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
              <span>💬</span> Note libere al coach
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10}}>Tutto quello che vuoi dirmi — domande, richieste, sensazioni generali.</div>
            <textarea style={{...s.textarea,minHeight:100}} value={data.note_coach} disabled={isReadOnly} onChange={e=>set('note_coach',e.target.value)} placeholder="Scrivi liberamente..."/>
          </div>

          {/* BOTTONI dentro lo scroll */}
          {!isReadOnly && (
            <div style={{display:'flex',gap:10,marginTop:8,marginBottom:40}}>
              <button onClick={saveDraft} disabled={saving} style={{...s.btnGray,padding:'13px 16px',fontSize:13,flexShrink:0}}>
                {saving ? '...' : '💾 Bozza'}
              </button>
              <button onClick={submit} disabled={submitting} style={{...s.btn,flex:1,justifyContent:'center',padding:'14px',fontSize:14}}>
                <i className="ti ti-send" style={{fontSize:15}}/>
                {submitting ? 'Invio...' : 'Invia al coach'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
