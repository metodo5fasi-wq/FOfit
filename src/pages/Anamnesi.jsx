import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  page: { flex:1, overflowY:'auto', padding:'0 0 8px', WebkitOverflowScrolling:'touch' },
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  section: { padding:'20px 20px 0' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  fieldLabel: { fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8, marginTop:14, display:'block' },
  input: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  textarea: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.6, boxSizing:'border-box', minHeight:80 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:9, padding:'11px 20px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'var(--bg-input)', color:'var(--text-muted)', border:'0.5px solid var(--border)', borderRadius:9, padding:'11px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  chip: (active) => ({ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', background:active?'#D4570A':'var(--bg-card)', color:active?'white':'var(--text-muted)', borderColor:active?'#D4570A':'var(--border)', transition:'all 0.15s' }),
  chipCheck: (active) => ({ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', background:active?'#EAF3DE':'var(--bg-card)', color:active?'#3B6D11':'var(--text-muted)', borderColor:active?'#3B6D11':'var(--border)', transition:'all 0.15s' }),
  scale: (active) => ({ width:36, height:36, borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border:'0.5px solid', fontFamily:'inherit', background:active?'#D4570A':'var(--bg-card)', color:active?'white':'var(--text-muted)', borderColor:active?'#D4570A':'var(--border)' }),
  sectionTitle: { fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:4 },
  sectionSub: { fontSize:13, color:'var(--text-muted)', marginBottom:18, lineHeight:1.5 },
}

const SECTIONS = [
  { n:1,  icon:'👤', title:'Dati anagrafici',           sub:'Informazioni base e vita quotidiana' },
  { n:2,  icon:'🎯', title:'Obiettivo e aspettative',    sub:'Dove vuoi arrivare e perché adesso' },
  { n:3,  icon:'🏥', title:'Salute generale',             sub:'Diagnosi, patologie, allergie e familiarità' },
  { n:4,  icon:'💊', title:'Farmaci e stimolanti',        sub:'Farmaci, integratori, caffeina, fumo, alcol' },
  { n:5,  icon:'😴', title:'Sonno e recupero',            sub:'Qualità del riposo e ritmo circadiano' },
  { n:6,  icon:'⚡', title:'Stress ed energia',           sub:'Livelli di stress e concentrazione' },
  { n:7,  icon:'🫃', title:'Digestione e intestino',      sub:'Gonfiore, transito e abitudini' },
  { n:8,  icon:'⚖️', title:'Storia peso e tentativi',     sub:'Percorso passato e schema ricorrente' },
  { n:9,  icon:'🥗', title:'Alimentazione e preferenze', sub:'Cosa mangi, cosa ami, come gestisci la vita reale' },
  { n:10, icon:'🏋️', title:'Allenamento',                sub:'Abitudini, esercizi preferiti e limitazioni' },
  { n:11, icon:'📋', title:'Vincoli e sostenibilità',    sub:'Tempo, organizzazione e autonomia alimentare' },
  { n:12, icon:'✅', title:'Check finale',               sub:'Note aggiuntive e consenso' },
]

function Chips({ options, value, onChange, multi=false }) {
  const arr = multi ? (value||[]) : null
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        const active = multi ? arr?.includes(v) : value===v
        return (
          <button key={v} onClick={()=>{
            if (multi) { onChange(arr?.includes(v) ? arr.filter(x=>x!==v) : [...(arr||[]),v]) }
            else { onChange(v===value?null:v) }
          }} style={multi?s.chipCheck(active):s.chip(active)}>{l}</button>
        )
      })}
    </div>
  )
}

function Scale({ value, onChange, max=10 }) {
  return (
    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
      {Array.from({length:max+1},(_,i)=>(
        <button key={i} onClick={()=>onChange(i)} style={s.scale(value===i)}>{i}</button>
      ))}
    </div>
  )
}

export default function Anamnesi({ clientId: propClientId, onClose, hideTopbar=false }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id
  const isAdmin = !!propClientId

  const [current, setCurrent] = useState(1)
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    try {
      const { data: d, error } = await supabase.from('anamnesi').select('*').eq('client_id', clientId).maybeSingle()
      if (error) throw error
      if (d) { setData(d); setCurrent(d.current_section || 1) }
    } catch(e) { console.error('Anamnesi load error:', e) }
  }

  function set(field, val) { setData(p => ({...p, [field]:val})) }
  function setArr(field, val) { setData(p => ({...p, [field]:val})) }

  async function saveSection(goTo) {
    if (!clientId) { setSaveError('Sessione scaduta — ricarica la pagina'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = { ...data, client_id: clientId, current_section: goTo || current, updated_at: new Date().toISOString() }
      if (goTo === 13) payload.completed_at = new Date().toISOString()
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      const { error } = await supabase.from('anamnesi').upsert(payload, { onConflict: 'client_id' })
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      if (goTo) setCurrent(Math.min(goTo, 12))
    } catch(e) {
      setSaveError('Errore salvataggio: ' + e.message)
      console.error('Anamnesi save error:', e)
    }
    setSaving(false)
  }

  function next() { saveSection(Math.min(current+1, 12)) }
  function prev() { saveSection(Math.max(current-1, 1)) }

  async function submitToCoach() {
    if (!clientId) { setSaveError('Sessione scaduta — ricarica la pagina'); return }
    setSubmitting(true)
    setSaveError('')
    try {
      await saveSection(13)
      const { error } = await supabase.from('anamnesi')
        .update({ submitted_at: new Date().toISOString(), read_by_coach: false })
        .eq('client_id', clientId)
      if (error) throw error
      setSaved(true)
      setData(p => ({...p, submitted_at: new Date().toISOString()}))
    } catch(e) { setSaveError('Errore invio: ' + e.message) }
    setSubmitting(false)
  }

  const sec = SECTIONS[Math.min(current, 12) - 1] || SECTIONS[11]
  const pct = Math.round(((current-1)/12)*100)

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',background:'var(--bg)'}}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{isAdmin?'Anamnesi cliente':'La tua anamnesi'}</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>Sezione {current} di 12</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {saved && <span style={{fontSize:11,color:'#3B6D11',fontWeight:600}}>✓ Salvato</span>}
          {saving && <span style={{fontSize:11,color:'var(--text-muted)'}}>Salvataggio...</span>}
          {isAdmin && <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:20,padding:4}}>✕</button>}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{height:3,background:'var(--border)',flexShrink:0}}>
        <div style={{height:3,background:'#D4570A',width:`${pct}%`,transition:'width 0.3s'}}/>
      </div>

      {/* ERRORE */}
      {saveError && (
        <div style={{background:'#FEE2E2',borderBottom:'0.5px solid #E24B4A',padding:'8px 16px',fontSize:12,color:'#E24B4A',flexShrink:0}}>
          ⚠️ {saveError}
        </div>
      )}

      {/* NAV SEZIONI */}
      <div style={{padding:'10px 16px',display:'flex',gap:6,overflowX:'auto',flexShrink:0,borderBottom:'0.5px solid var(--border)'}}>
        {SECTIONS.map(s2=>(
          <button key={s2.n} onClick={()=>saveSection(s2.n)} style={{
            flexShrink:0,padding:'5px 10px',borderRadius:16,fontSize:11,fontWeight:600,cursor:'pointer',border:'0.5px solid',fontFamily:'inherit',
            background:current===s2.n?'#D4570A':'var(--bg-card)',
            color:current===s2.n?'white':(data.current_section>=s2.n||data.completed_at)?'#3B6D11':'var(--text-muted)',
            borderColor:current===s2.n?'#D4570A':(data.current_section>=s2.n||data.completed_at)?'#3B6D11':'var(--border)',
          }}>{s2.icon}</button>
        ))}
      </div>

      {/* CONTENUTO */}
      <div style={s.page}>
        <div style={s.section}>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:24,marginBottom:6}}>{sec.icon}</div>
            <div style={s.sectionTitle}>{sec.title}</div>
            <div style={s.sectionSub}>{sec.sub}</div>
          </div>

          {/* ─── SEZIONE 1 — Dati anagrafici + vita quotidiana ─── */}
          {current===1 && <>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Data di nascita</label><input style={s.input} type="date" value={data.data_nascita||''} onChange={e=>set('data_nascita',e.target.value)}/></div>
                <div><label style={s.label}>Città</label><input style={s.input} value={data.citta||''} onChange={e=>set('citta',e.target.value)} placeholder="es. Milano"/></div>
              </div>
              <div style={{height:10}}/>
              <div style={s.grid2}>
                <div><label style={s.label}>Telefono</label><input style={s.input} value={data.telefono||''} onChange={e=>set('telefono',e.target.value)}/></div>
                <div><label style={s.label}>Lavoro / Mansione</label><input style={s.input} value={data.lavoro||''} onChange={e=>set('lavoro',e.target.value)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Orari tipici di lavoro</label>
              <Chips multi options={['8–17','9–18','Turni','Trasferte','Altro']} value={data.orari_lavoro} onChange={v=>setArr('orari_lavoro',v)}/>
              {data.orari_lavoro?.includes('Altro') && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Specifica..." value={data.orari_lavoro_altro||''} onChange={e=>set('orari_lavoro_altro',e.target.value)}/></div>}
            </div>
            <div style={s.card}>
              <label style={s.label}>Quanto cambiano gli orari da un giorno all'altro?</label>
              <Chips options={['Sempre uguali','Cambiano un po\'','Molto variabili','Imprevedibili']} value={data.variabilita_orari} onChange={v=>set('variabilita_orari',v)}/>
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Chi fa la spesa?</label><Chips options={['Io','Partner','Dividiamo','Altro']} value={data.chi_fa_spesa} onChange={v=>set('chi_fa_spesa',v)}/></div>
                <div><label style={s.label}>Chi cucina?</label><Chips options={['Io','Partner','Dividiamo','Nessuno','Altro']} value={data.chi_cucina} onChange={v=>set('chi_cucina',v)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Tempo realisticamente disponibile per la preparazione dei pasti</label>
              <Chips options={['Quasi nessuno','10–15 min','20–30 min','30–60 min','Anche di più']} value={data.tempo_preparazione_pasti} onChange={v=>set('tempo_preparazione_pasti',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Dove consumi normalmente i pasti?</label>
              <div style={{marginBottom:8}}><span style={{fontSize:12,color:'var(--text-muted)'}}>Colazione</span><div style={{marginTop:4}}><Chips options={['Casa','Bar','Salto','Ufficio','Vario']} value={data.dove_colazione} onChange={v=>set('dove_colazione',v)}/></div></div>
              <div style={{marginBottom:8}}><span style={{fontSize:12,color:'var(--text-muted)'}}>Pranzo</span><div style={{marginTop:4}}><Chips options={['Casa','Ristorante/mensa','Portato da casa','Bar','Vario']} value={data.dove_pranzo} onChange={v=>set('dove_pranzo',v)}/></div></div>
              <div><span style={{fontSize:12,color:'var(--text-muted)'}}>Cena</span><div style={{marginTop:4}}><Chips options={['Casa','Fuori','Vario']} value={data.dove_cena} onChange={v=>set('dove_cena',v)}/></div></div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Mangi principalmente...</label>
              <Chips options={['Da solo','Con partner','Con famiglia','Con colleghi','Varia']} value={data.con_chi_mangia} onChange={v=>set('con_chi_mangia',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Puoi portare pasti preparati al lavoro?</label>
              <Chips options={['Sì, sempre','A volte','No','Non mi serve']} value={data.porta_pasti_lavoro} onChange={v=>set('porta_pasti_lavoro',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Con quale frequenza hai giornate con trasferte, viaggi o imprevisti?</label>
              <Chips options={['Raramente','1–2 volte/mese','1 volta/settimana','Spesso','Quasi sempre']} value={data.freq_imprevedibili} onChange={v=>set('freq_imprevedibili',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Racconta una giornata in cui tutto va storto: poco tempo, stress, imprevisti. Cosa succede alla tua alimentazione?</label>
              <textarea style={{...s.textarea,minHeight:110}} placeholder="Descrivi cosa succede normalmente..." value={data.giornata_storta||''} onChange={e=>set('giornata_storta',e.target.value)}/>
            </div>
          </>}

          {/* ─── SEZIONE 2 — Obiettivo e aspettative ─── */}
          {current===2 && <>
            <div style={s.card}>
              <label style={s.label}>Obiettivo principale</label>
              <Chips options={['Dimagrire','Ridurre pancia/addome','Ricomposizione corporea','Energia & lucidità','Sonno/recupero','Performance in palestra','Altro']} value={data.obiettivo} onChange={v=>set('obiettivo',v)}/>
            </div>
            <div style={s.card}>
              <div style={s.grid3}>
                <div><label style={s.label}>Peso attuale (kg)</label><input style={s.input} type="number" step="0.1" value={data.peso_attuale||''} onChange={e=>set('peso_attuale',e.target.value)}/></div>
                <div><label style={s.label}>Peso desiderato (kg)</label><input style={s.input} type="number" step="0.1" value={data.peso_desiderato||''} onChange={e=>set('peso_desiderato',e.target.value)}/></div>
                <div><label style={s.label}>Altezza (cm)</label><input style={s.input} type="number" value={data.altezza||''} onChange={e=>set('altezza',e.target.value)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Hai una data, un evento o un momento legato al tuo obiettivo?</label>
              <Chips options={['No','Sì']} value={data.ha_data_evento===true?'Sì':data.ha_data_evento===false?'No':null} onChange={v=>set('ha_data_evento',v==='Sì')}/>
              {data.ha_data_evento && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Quale evento? Quando?" value={data.data_evento_dettaglio||''} onChange={e=>set('data_evento_dettaglio',e.target.value)}/></div>}
            </div>
            <div style={s.card}>
              <label style={s.label}>Che aspettative hai sui tempi per raggiungere il tuo obiettivo?</label>
              <textarea style={s.textarea} placeholder="Racconta liberamente cosa ti aspetti e in quanto tempo..." value={data.aspettative_tempi||''} onChange={e=>set('aspettative_tempi',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Quanto è importante per te (0–10)?</label>
              <Scale value={data.importanza_obiettivo} onChange={v=>set('importanza_obiettivo',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Perché vuoi cambiare ADESSO?</label>
              <textarea style={{...s.textarea,minHeight:100}} placeholder="Racconta la tua motivazione..." value={data.motivazione||''} onChange={e=>set('motivazione',e.target.value)}/>
            </div>
          </>}

          {/* ─── SEZIONE 3 — Salute, allergie, intolleranze ─── */}
          {current===3 && <>
            <div style={s.card}>
              <label style={s.label}>Diagnosi attive</label>
              <textarea style={s.textarea} placeholder="Elenca eventuali diagnosi mediche attive..." value={data.diagnosi_attive||''} onChange={e=>set('diagnosi_attive',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Allergie alimentari diagnosticate</label>
              <textarea style={s.textarea} placeholder="es. arachidi, crostacei, uova... specifica quali e come sono state diagnosticate" value={data.allergie_alimentari||''} onChange={e=>set('allergie_alimentari',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Intolleranze diagnosticate</label>
              <textarea style={s.textarea} placeholder="es. lattosio, glutine, fruttosio... specifica quali e se diagnosticate o solo sospettate" value={data.intolleranze_diagnosticate||''} onChange={e=>set('intolleranze_diagnosticate',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Reazioni avverse a cibi che vuoi segnalare</label>
              <textarea style={s.textarea} placeholder="Cibi che ti creano problemi anche senza diagnosi formale..." value={data.reazioni_avverse_cibi||''} onChange={e=>set('reazioni_avverse_cibi',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Hai indicazioni alimentari prescritte da un medico o professionista?</label>
              <Chips options={['No','Sì']} value={data.indicazioni_mediche===true?'Sì':data.indicazioni_mediche===false?'No':null} onChange={v=>set('indicazioni_mediche',v==='Sì')}/>
              {data.indicazioni_mediche && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Specifica cosa ti è stato prescritto o consigliato..." value={data.indicazioni_mediche_dettaglio||''} onChange={e=>set('indicazioni_mediche_dettaglio',e.target.value)}/></div>}
            </div>
            <div style={s.card}>
              <label style={s.label}>Gravidanza o allattamento (se pertinente)</label>
              <Chips options={['Non pertinente','No','Gravidanza','Allattamento']} value={data.gravidanza_allattamento} onChange={v=>set('gravidanza_allattamento',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Seleziona ciò che ti riguarda (anche passato)</label>
              <Chips multi options={['Ipertensione','Colesterolo/trigliceridi alti','Glicemia alta/diabete','Russamento/apnee','Reflusso/gastrite','Gonfiore addominale','Stipsi/diarrea','Problemi renali','Problemi epatici','Dolori articolari cronici','Mal di testa ricorrenti','Ansia/stress cronico','Altro']} value={data.condizioni_salute} onChange={v=>setArr('condizioni_salute',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Interventi chirurgici / ricoveri importanti</label>
              <textarea style={s.textarea} placeholder="Quali e quando..." value={data.interventi_chirurgici||''} onChange={e=>set('interventi_chirurgici',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Familiarità in famiglia</label>
              <Chips multi options={['Diabete','Ipertensione','Cardiopatie','Obesità','Disturbi tiroidei','Altro']} value={data.familiarita} onChange={v=>setArr('familiarita',v)}/>
              {data.familiarita?.includes('Altro') && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Specifica..." value={data.familiarita_altro||''} onChange={e=>set('familiarita_altro',e.target.value)}/></div>}
            </div>
          </>}

          {/* ─── SEZIONE 4 — Farmaci e stimolanti ─── */}
          {current===4 && <>
            <div style={s.card}>
              <label style={s.label}>Farmaci attuali (nome + dose + da quanto)</label>
              <textarea style={s.textarea} placeholder="es. Metformina 500mg da 2 anni..." value={data.farmaci||''} onChange={e=>set('farmaci',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Integratori attuali (nome + dose + frequenza)</label>
              <textarea style={s.textarea} placeholder="es. Vitamina D 2000UI ogni giorno..." value={data.integratori||''} onChange={e=>set('integratori',e.target.value)}/>
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Caffeina al giorno</label>
                  <Chips options={['0/die','1/die','2/die','3+/die']} value={data.caffeina} onChange={v=>set('caffeina',v)}/>
                </div>
                <div>
                  <label style={s.label}>Energy drink / Pre-workout</label>
                  <Chips options={['No','Sì']} value={data.energy_drink===true?'Sì':data.energy_drink===false?'No':null} onChange={v=>set('energy_drink',v==='Sì')}/>
                </div>
              </div>
              <div style={{height:10}}/>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Fumo</label>
                  <Chips options={['No','Sì']} value={data.fumo===true?'Sì':data.fumo===false?'No':null} onChange={v=>set('fumo',v==='Sì')}/>
                  {data.fumo && <div style={{marginTop:8}}><input style={s.input} type="number" placeholder="Sigarette/die" value={data.sigarette_die||''} onChange={e=>set('sigarette_die',parseInt(e.target.value))}/></div>}
                </div>
                <div>
                  <label style={s.label}>Alcol</label>
                  <Chips options={['No','1–2/sett','3–5/sett','Quasi ogni giorno']} value={data.alcol} onChange={v=>set('alcol',v)}/>
                </div>
              </div>
            </div>
          </>}

          {/* ─── SEZIONE 5 — Sonno e recupero ─── */}
          {current===5 && <>
            <div style={s.card}>
              <div style={s.grid3}>
                <div><label style={s.label}>Ore di sonno medie</label><Chips options={['<6','6–7','7–8','>8']} value={data.ore_sonno} onChange={v=>set('ore_sonno',v)}/></div>
                <div><label style={s.label}>Orario letto</label><input style={s.input} type="time" value={data.orario_letto||''} onChange={e=>set('orario_letto',e.target.value)}/></div>
                <div><label style={s.label}>Orario sveglia</label><input style={s.input} type="time" value={data.orario_sveglia||''} onChange={e=>set('orario_sveglia',e.target.value)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Qualità del sonno (0–10)</label>
              <Scale value={data.qualita_sonno} onChange={v=>set('qualita_sonno',v)}/>
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Ti svegli durante la notte?</label>
                  <Chips options={['No','1 volta','2–3 volte','4+ volte']} value={data.risvegli_notte} onChange={v=>set('risvegli_notte',v)}/>
                </div>
                <div>
                  <label style={s.label}>Schermi prima di dormire</label>
                  <Chips options={['No','<30 min','30–60 min','>60 min']} value={data.schermi_prima_letto} onChange={v=>set('schermi_prima_letto',v)}/>
                </div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Cosa ti rovina di più il sonno?</label>
              <textarea style={s.textarea} value={data.cosa_rovina_sonno||''} onChange={e=>set('cosa_rovina_sonno',e.target.value)} placeholder="Pensieri, rumori, temperature, figli..."/>
            </div>
          </>}

          {/* ─── SEZIONE 6 — Stress ed energia ─── */}
          {current===6 && <>
            <div style={s.card}>
              <label style={s.label}>Stress medio (0–10)</label>
              <Scale value={data.stress_medio} onChange={v=>set('stress_medio',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Dove senti più spesso il "crollo" di energia?</label>
              <Chips options={['Mattina','Dopo pranzo','Pomeriggio','Sera','Variabile']} value={data.crollo_energia} onChange={v=>set('crollo_energia',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Sintomi frequenti</label>
              <Chips multi options={['Stanchezza appena sveglio','Nervosismo/irritabilità','Difficoltà di concentrazione','Fame nervosa/serale','Voglia di zuccheri nel pomeriggio','Difficoltà a "staccare" la sera','Altro']} value={data.sintomi_frequenti} onChange={v=>setArr('sintomi_frequenti',v)}/>
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Fonte di stress principale</label><textarea style={s.textarea} value={data.fonte_stress_1||''} onChange={e=>set('fonte_stress_1',e.target.value)} placeholder="Lavoro, famiglia, finanze..."/></div>
                <div><label style={s.label}>Seconda fonte di stress</label><textarea style={s.textarea} value={data.fonte_stress_2||''} onChange={e=>set('fonte_stress_2',e.target.value)}/></div>
              </div>
            </div>
          </>}

          {/* ─── SEZIONE 7 — Digestione e intestino ─── */}
          {current===7 && <>
            <div style={s.card}>
              <div style={s.grid3}>
                <div><label style={s.label}>Gonfiore</label><Chips options={['Mai','A volte','Spesso']} value={data.gonfiore} onChange={v=>set('gonfiore',v)}/></div>
                <div><label style={s.label}>Reflusso/bruciore</label><Chips options={['Mai','A volte','Spesso']} value={data.reflusso} onChange={v=>set('reflusso',v)}/></div>
                <div><label style={s.label}>Evacuazione</label><Chips options={['Quotidiana','3–5/sett','1–2/sett','Variabile']} value={data.evacuazione} onChange={v=>set('evacuazione',v)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Cibi che ti gonfiano di più</label>
              <textarea style={s.textarea} value={data.cibi_gonfiano||''} onChange={e=>set('cibi_gonfiano',e.target.value)} placeholder="es. legumi, latte, pane..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Antibiotici negli ultimi 12 mesi?</label>
              <Chips options={['No','Sì']} value={data.antibiotici_12mesi===true?'Sì':data.antibiotici_12mesi===false?'No':null} onChange={v=>set('antibiotici_12mesi',v==='Sì')}/>
              {data.antibiotici_12mesi && <div style={{marginTop:8}}><input style={s.input} type="number" placeholder="Quante volte?" value={data.antibiotici_quante||''} onChange={e=>set('antibiotici_quante',parseInt(e.target.value))}/></div>}
            </div>
          </>}

          {/* ─── SEZIONE 8 — Storia peso, tentativi e schema ricorrente ─── */}
          {current===8 && <>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Peso minimo (5 anni)</label><input style={s.input} type="number" step="0.1" value={data.peso_minimo||''} onChange={e=>set('peso_minimo',e.target.value)}/></div>
                <div><label style={s.label}>Peso massimo (5 anni)</label><input style={s.input} type="number" step="0.1" value={data.peso_massimo||''} onChange={e=>set('peso_massimo',e.target.value)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Da quanto tempo hai iniziato a prendere peso?</label>
              <Chips options={['<1 anno','1–2 anni','3–5 anni','>5 anni']} value={data.tempo_sovrappeso} onChange={v=>set('tempo_sovrappeso',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Dove accumuli più facilmente?</label>
              <Chips options={['Addome','Fianchi','Petto','Generale','Altro']} value={data.accumulo_grasso} onChange={v=>set('accumulo_grasso',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Tentativi fatti in passato</label>
              <Chips multi options={['Diete "fai da te"','Digiuno/intermittente','Low carb','App/calorie','Coach/nutrizionista','Allenamento senza piano','Altro']} value={data.tentativi_dieta} onChange={v=>setArr('tentativi_dieta',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Perché non hanno funzionato / cosa ti ha bloccato?</label>
              <textarea style={{...s.textarea,minHeight:100}} value={data.perche_non_funzionato||''} onChange={e=>set('perche_non_funzionato',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Quando uscivi dal piano o mangiavi diversamente, cosa succedeva di solito dopo?</label>
              <Chips multi options={['Tornavo normalmente alle mie abitudini','Mangiavo meno al pasto successivo','Saltavo uno o più pasti','Aumentavo cardio/allenamento per compensare','Pensavo di aver rovinato tutto e continuavo a mangiare','Aspettavo il lunedì per ricominciare','Mi sentivo in colpa ma non compensavo','Altro']} value={data.dopo_uscita_piano} onChange={v=>setArr('dopo_uscita_piano',v)}/>
              {data.dopo_uscita_piano?.includes('Altro') && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Specifica..." value={data.dopo_uscita_piano_altro||''} onChange={e=>set('dopo_uscita_piano_altro',e.target.value)}/></div>}
            </div>
            <div style={s.card}>
              <label style={s.label}>Qual è il momento in cui perdi più facilmente la direzione?</label>
              <Chips multi options={['Weekend','Cena fuori','Aperitivo','Vacanze','Stress','Stanchezza','Fame serale','Mancanza di organizzazione','Eventi sociali','Quando non vedo risultati','Quando salto un allenamento','Altro']} value={data.momento_perdi_direzione} onChange={v=>setArr('momento_perdi_direzione',v)}/>
            </div>
          </>}

          {/* ─── SEZIONE 9 — Alimentazione, preferenze e vita reale ─── */}
          {current===9 && <>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Quanti pasti preferiresti?</label><Chips options={['2','3','4','5+','Indifferente']} value={data.pasti_preferiti?.toString()} onChange={v=>set('pasti_preferiti',v)}/></div>
                <div><label style={s.label}>Quando hai più fame?</label><Chips options={['Mattina','Pranzo','Pomeriggio','Sera','Notte']} value={data.quando_fame} onChange={v=>set('quando_fame',v)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Giorno tipo — cosa mangi di solito?</label>
              <textarea style={{...s.textarea,minHeight:120}} placeholder="Colazione, pranzo, cena, spuntini (includi bevande)..." value={data.giorno_tipo||''} onChange={e=>set('giorno_tipo',e.target.value)}/>
            </div>
            <div style={s.card}>
              <div style={s.grid3}>
                <div><label style={s.label}>Acqua al giorno</label><Chips options={['<1L','1–2L','2–3L','>3L']} value={data.acqua} onChange={v=>set('acqua',v)}/></div>
                <div><label style={s.label}>Mangi fuori/delivery</label><Chips options={['0–1/sett','2–3/sett','4+/sett']} value={data.mangia_fuori} onChange={v=>set('mangia_fuori',v)}/></div>
                <div><label style={s.label}>Weekend vs feriali</label><Chips options={['Uguale','Peggiora','Migliora','Dipende']} value={data.weekend_vs_feriali} onChange={v=>set('weekend_vs_feriali',v)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Come vivi normalmente un pasto fuori?</label>
              <Chips options={['Lo gestisco senza problemi','Cerco qualcosa di equilibrato','Mi mette in difficoltà','Prima/dopo mangio meno','Lo considero uno sgarro','Tendo a perdere il controllo','Altro']} value={data.gestione_pasto_fuori} onChange={v=>set('gestione_pasto_fuori',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Cosa succede alla tua alimentazione durante il weekend?</label>
              <textarea style={s.textarea} value={data.alimentazione_weekend||''} onChange={e=>set('alimentazione_weekend',e.target.value)} placeholder="Descrivi liberamente..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Come gestisci normalmente vacanze e viaggi?</label>
              <textarea style={s.textarea} value={data.alimentazione_vacanze||''} onChange={e=>set('alimentazione_vacanze',e.target.value)} placeholder="Descrivi liberamente..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Proteine che mangi volentieri</label>
              <Chips multi options={['Pollo','Tacchino','Manzo','Uova','Pesce','Tonno','Salmone','Yogurt greco','Fiocchi di latte','Legumi','Tofu','Proteine in polvere','Altro']} value={data.proteine_gradite} onChange={v=>setArr('proteine_gradite',v)}/>
              <div style={{marginTop:10}}><label style={s.label}>Proteine che NON vuoi inserire</label><textarea style={s.textarea} value={data.proteine_non_vuole||''} onChange={e=>set('proteine_non_vuole',e.target.value)} placeholder="es. pesce, tofu..."/></div>
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Con i carboidrati ti senti meglio</label><Chips options={['Carbo alti','Moderati','Più bassi','Non so']} value={data.rapporto_carbo} onChange={v=>set('rapporto_carbo',v)}/></div>
                <div><label style={s.label}>Carbo che ami di più</label><Chips multi options={['Pasta','Pane','Riso','Patate','Pizza','Dolci','Altro']} value={data.carboidrati_preferiti} onChange={v=>setArr('carboidrati_preferiti',v)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Verdure — come va?</label>
              <Chips options={['Le mangio volentieri','Solo alcune','Faccio fatica']} value={data.verdure} onChange={v=>set('verdure',v)}/>
              <div style={{...s.grid2,marginTop:10}}>
                <div><label style={s.label}>Verdure ok</label><textarea style={s.textarea} value={data.verdure_ok||''} onChange={e=>set('verdure_ok',e.target.value)} placeholder="es. zucchine, insalata..."/></div>
                <div><label style={s.label}>Verdure no</label><textarea style={s.textarea} value={data.verdure_no||''} onChange={e=>set('verdure_no',e.target.value)} placeholder="es. broccoli, cavoli..."/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>I tuoi 5 piatti preferiti</label>
              <textarea style={s.textarea} value={data.piatti_preferiti||''} onChange={e=>set('piatti_preferiti',e.target.value)} placeholder="1) … 2) … 3) … 4) … 5) …"/>
              <div style={{marginTop:10}}><label style={s.label}>I 3 cibi più "critici" (ti fanno perdere controllo)</label><textarea style={s.textarea} value={data.cibi_critici||''} onChange={e=>set('cibi_critici',e.target.value)}/></div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Ci sono alimenti che eviti anche se ti piacciono perché pensi facciano ingrassare?</label>
              <textarea style={s.textarea} value={data.alimenti_evitati_per_paura||''} onChange={e=>set('alimenti_evitati_per_paura',e.target.value)} placeholder="es. pasta la sera, formaggi, frutta..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Ci sono regole alimentari che senti di dover rispettare per forza?</label>
              <textarea style={s.textarea} value={data.regole_alimentari||''} onChange={e=>set('regole_alimentari',e.target.value)} placeholder="es. niente carbo la sera, compensare dopo una cena fuori, non mangiare dopo le 20..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Cosa significa per te "sgarrare"?</label>
              <textarea style={s.textarea} value={data.significato_sgarro||''} onChange={e=>set('significato_sgarro',e.target.value)} placeholder="Descrivi con parole tue..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Quanto riesci a riconoscere quando hai realmente fame? (0–10)</label>
              <Scale value={data.riconosce_fame} onChange={v=>set('riconosce_fame',v)}/>
              <div style={{marginTop:14}}><label style={s.label}>Quanto riesci a riconoscere quando sei sazio/a? (0–10)</label><Scale value={data.riconosce_sazieta} onChange={v=>set('riconosce_sazieta',v)}/></div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Ti capita di continuare a mangiare anche quando sei sazio/a?</label>
              <Chips options={['Mai','Raramente','A volte','Spesso']} value={data.mangia_oltre_sazieta} onChange={v=>set('mangia_oltre_sazieta',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Quando mangi senza fame, cosa stai cercando più spesso?</label>
              <Chips multi options={['Stress','Noia','Rabbia','Stanchezza','Sera','Socialità','Conforto','Abitudine','Altro']} value={data.mangia_senza_fame} onChange={v=>setArr('mangia_senza_fame',v)}/>
              {data.mangia_senza_fame?.length > 0 && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Vuoi aggiungere qualcosa?" value={data.mangia_senza_fame_note||''} onChange={e=>set('mangia_senza_fame_note',e.target.value)}/></div>}
              <div style={{marginTop:10}}><label style={s.label}>Quanto sei disposto a monitorare?</label><Chips options={['Niente tracking','Porzioni "a mano"','Tracking parziale','Tracking completo']} value={data.livello_tracking} onChange={v=>set('livello_tracking',v)}/></div>
            </div>
          </>}

          {/* ─── SEZIONE 10 — Allenamento ─── */}
          {current===10 && <>
            <div style={s.card}>
              <label style={s.label}>Ti alleni attualmente?</label>
              <Chips options={['No','Sì']} value={data.si_allena===true?'Sì':data.si_allena===false?'No':null} onChange={v=>set('si_allena',v==='Sì')}/>
              {data.si_allena && <>
                <div style={{...s.grid2,marginTop:12}}>
                  <div><label style={s.label}>Frequenza settimanale</label><Chips options={['1','2','3','4','5+']} value={data.frequenza_allenamento?.toString()} onChange={v=>set('frequenza_allenamento',parseInt(v))}/></div>
                  <div><label style={s.label}>Orario allenamento</label><Chips options={['Mattina','Pranzo','Pomeriggio','Sera']} value={data.orario_allenamento} onChange={v=>set('orario_allenamento',v)}/></div>
                </div>
                <div style={{...s.grid3,marginTop:12}}>
                  <div><label style={s.label}>Tipologia</label><Chips multi options={['Pesi','Cardio','Functional','Sport','Misto']} value={data.tipo_allenamento} onChange={v=>setArr('tipo_allenamento',v)}/></div>
                  <div><label style={s.label}>Durata media</label><Chips options={["<45'","45–60'","60–90'",">90'"]} value={data.durata_seduta} onChange={v=>set('durata_seduta',v)}/></div>
                  <div><label style={s.label}>Passi/die</label><Chips options={['<5k','5–8k','8–10k','>10k','Non so']} value={data.passi_die} onChange={v=>set('passi_die',v)}/></div>
                </div>
              </>}
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Energia in allenamento (0–10)</label><Scale value={data.energia_allenamento} onChange={v=>set('energia_allenamento',v)}/></div>
                <div>
                  <label style={s.label}>Recupero tra sedute</label>
                  <Chips options={['Buono','Medio','Scarso']} value={data.recupero} onChange={v=>set('recupero',v)}/>
                  <div style={{marginTop:8}}><label style={s.label}>DOMS dopo allenamento</label><Chips options={['Rari','Normali','Molto frequenti','Invalidanti']} value={data.doms} onChange={v=>set('doms',v)}/></div>
                </div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Feeling con gli esercizi base</label>
              {['Squat','Leg press','Affondi','Stacchi','Panca piana','Trazioni/Lat machine','Rematore','Military press','Cardio steady','HIIT'].map(ex=>{
                const feeling = data.esercizi_feeling?.[ex]
                return (
                  <div key={ex} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid var(--border)'}}>
                    <span style={{flex:1,fontSize:12,color:'var(--text)',fontWeight:500}}>{ex}</span>
                    {['👍','😐','👎'].map(emoji=>(
                      <button key={emoji} onClick={()=>set('esercizi_feeling',{...(data.esercizi_feeling||{}),[ex]:feeling===emoji?null:emoji})} style={{width:34,height:28,borderRadius:7,border:'0.5px solid',cursor:'pointer',fontSize:14,background:feeling===emoji?'#FEF0E7':'var(--bg-card)',borderColor:feeling===emoji?'#D4570A':'var(--border)'}}>{emoji}</button>
                    ))}
                  </div>
                )
              })}
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>3 esercizi che ODI</label><textarea style={s.textarea} value={data.esercizi_odia||''} onChange={e=>set('esercizi_odia',e.target.value)}/></div>
                <div><label style={s.label}>3 esercizi che AMI</label><textarea style={s.textarea} value={data.esercizi_ama||''} onChange={e=>set('esercizi_ama',e.target.value)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Dolori / limitazioni attuali</label>
              <textarea style={s.textarea} value={data.dolori_limitazioni||''} onChange={e=>set('dolori_limitazioni',e.target.value)} placeholder="es. dolore al ginocchio sinistro, spalla destra..."/>
              <div style={{marginTop:10}}><label style={s.label}>Movimenti che danno fastidio</label><textarea style={s.textarea} value={data.movimenti_fastidio||''} onChange={e=>set('movimenti_fastidio',e.target.value)} placeholder="es. squat profondo, spinte sopra la testa..."/></div>
            </div>
          </>}

          {/* ─── SEZIONE 11 — Vincoli, sostenibilità e autonomia ─── */}
          {current===11 && <>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Tempo disponibile a settimana</label><Chips options={['1h','2h','3h','4h','5h+']} value={data.tempo_settimana} onChange={v=>set('tempo_settimana',v)}/></div>
                <div><label style={s.label}>Giorni migliori</label><Chips multi options={['Lun','Mar','Mer','Gio','Ven','Sab','Dom']} value={data.giorni_migliori} onChange={v=>setArr('giorni_migliori',v)}/></div>
              </div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Cibi che non vuoi togliere MAI</label>
              <textarea style={s.textarea} value={data.cibi_non_togliere||''} onChange={e=>set('cibi_non_togliere',e.target.value)} placeholder="es. caffè, cioccolato, pizza del weekend..."/>
              <div style={{marginTop:10}}><label style={s.label}>Cosa non vuoi assolutamente fare</label><textarea style={s.textarea} value={data.cosa_non_fare||''} onChange={e=>set('cosa_non_fare',e.target.value)} placeholder="es. digiunare, eliminare i carbo, pesare ogni alimento..."/></div>
            </div>
            <div style={s.card}>
              <label style={s.label}>Sei disposto a...</label>
              <Chips multi options={['Preparare i pasti','Portarmi il pranzo','Cucinare 2–3x settimana','Pianificare la spesa']} value={data.abitudini_pratiche} onChange={v=>setArr('abitudini_pratiche',v)}/>
            </div>

            {/* RAPPORTO CON CONTROLLO E FLESSIBILITÀ */}
            <div style={s.card}>
              <label style={s.label}>Quanto ti senti tranquillo/a nel scegliere cosa mangiare senza un piano preciso? (0–10)</label>
              <Scale value={data.autonomia_senza_piano} onChange={v=>set('autonomia_senza_piano',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Se non hai quantità o indicazioni precise, cosa provi?</label>
              <Chips options={['Mi gestisco tranquillamente','Ho qualche dubbio ma riesco a scegliere','Ho paura di sbagliare','Tendo a perdere la direzione','Dipende dalla situazione']} value={data.senza_indicazioni_provo} onChange={v=>set('senza_indicazioni_provo',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Quale tipo di guida pensi ti aiuterebbe di più all'inizio?</label>
              <Chips options={['Indicazioni molto precise','Struttura con diverse alternative','Principi e porzioni di riferimento','Molta libertà con obiettivi generali','Non lo so, preferisco che valuti il coach']} value={data.preferenza_guida} onChange={v=>set('preferenza_guida',v)}/>
            </div>

            {/* AUTONOMIA INIZIALE */}
            <div style={s.card}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:12}}>Quanto ti senti capace oggi di… (0–10)</div>
              {[
                ['autonomia_costruire_pasto','Costruire autonomamente un pasto completo'],
                ['autonomia_ristorante','Scegliere cosa mangiare al ristorante senza ansia'],
                ['autonomia_giornata_imprevista','Gestire una giornata imprevista'],
                ['autonomia_dopo_abbondante','Tornare alla normalità dopo un pasto più abbondante senza compensare'],
                ['autonomia_cambio_routine','Adattare l\'alimentazione quando cambia la tua routine'],
                ['autonomia_senza_piano_scritto','Mantenere buone abitudini senza un piano scritto'],
              ].map(([field,label])=>(
                <div key={field} style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:6}}>{label}</label>
                  <Scale value={data[field]} onChange={v=>set(field,v)}/>
                </div>
              ))}
            </div>

            {/* PRIMA COMPETENZA */}
            <div style={s.card}>
              <label style={s.label}>Se alla fine del percorso potessi imparare UNA cosa che oggi non gestisci bene, quale vorresti che fosse?</label>
              <textarea style={s.textarea} value={data.prima_competenza||''} onChange={e=>set('prima_competenza',e.target.value)} placeholder="Descrivi liberamente..."/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Quale situazione vorresti riuscire a vivere con molta più serenità rispetto a oggi?</label>
              <textarea style={s.textarea} value={data.situazione_piu_serena||''} onChange={e=>set('situazione_piu_serena',e.target.value)} placeholder="Descrivi liberamente..."/>
            </div>
          </>}

          {/* ─── SEZIONE 12 — Check finale ─── */}
          {current===12 && <>
            <div style={s.card}>
              <label style={s.label}>C'è qualcosa di importante che non ti è stato chiesto?</label>
              <textarea style={{...s.textarea,minHeight:120}} value={data.note_finali||''} onChange={e=>set('note_finali',e.target.value)}/>
            </div>
            <div style={s.card}>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {k:'consenso_dati',l:'Confermo che le informazioni fornite sono complete e veritiere'},
                  {k:'consenso_trattamento',l:'Autorizzo il trattamento dei dati ai fini del percorso'},
                ].map(item=>(
                  <label key={item.k} style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
                    <input type="checkbox" checked={data[item.k]||false} onChange={e=>set(item.k,e.target.checked)} style={{marginTop:2,width:16,height:16,accentColor:'#D4570A'}}/>
                    <span style={{fontSize:13,color:'var(--text)',lineHeight:1.5}}>{item.l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={s.card}>
              <div style={s.grid2}>
                <div><label style={s.label}>Data</label><input style={s.input} type="date" value={data.data_firma||''} onChange={e=>set('data_firma',e.target.value)}/></div>
              </div>
            </div>
          </>}
        </div>
      </div>

      {/* NAV AVANTI/INDIETRO */}
      <div style={{padding:'12px 20px',paddingBottom:'calc(env(safe-area-inset-bottom) + 12px)',background:'var(--bg-card)',borderTop:'0.5px solid var(--border)',display:'flex',gap:10,flexShrink:0}}>
        {current > 1 && <button onClick={prev} style={s.btnGray}>← Indietro</button>}
        {current < 12
          ? <button onClick={next} style={{...s.btn,flex:1,justifyContent:'center'}}>
              {saving?'Salvataggio...':'Avanti →'}
            </button>
          : data.submitted_at
            ? <div style={{flex:1,background:'#EAF3DE',borderRadius:10,padding:'12px',textAlign:'center',fontSize:13,fontWeight:700,color:'#3B6D11'}}>
                ✓ Anamnesi inviata al coach — grazie!
              </div>
            : <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={()=>saveSection(13)} disabled={!data.consenso_dati||!data.consenso_trattamento||saving} style={{...s.btnGray,justifyContent:'center',opacity:(!data.consenso_dati||!data.consenso_trattamento)?0.5:1}}>
                  {saving?'Salvataggio...':'💾 Salva bozza'}
                </button>
                <button onClick={submitToCoach} disabled={!data.consenso_dati||!data.consenso_trattamento||submitting||saving} style={{...s.btn,flex:1,justifyContent:'center',opacity:(!data.consenso_dati||!data.consenso_trattamento)?0.5:1}}>
                  <i className="ti ti-send" style={{fontSize:15}}/>
                  {submitting?'Invio...':'Invia al coach'}
                </button>
              </div>
        }
      </div>
    </div>
  )
}
