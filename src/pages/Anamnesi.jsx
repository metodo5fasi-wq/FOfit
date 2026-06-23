import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  page: { flex:1, overflowY:'auto', padding:'0 0 40px' },
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  section: { padding:'20px 20px 0' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
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
  fieldLabel: { fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8, marginTop:14, display:'block' },
}

const SECTIONS = [
  { n:1, icon:'👤', title:'Dati anagrafici', sub:'Informazioni base e contatti' },
  { n:2, icon:'🎯', title:'Obiettivo e aspettative', sub:'Cosa vuoi raggiungere e perché' },
  { n:3, icon:'🏥', title:'Salute generale', sub:'Diagnosi, patologie e familiarità' },
  { n:4, icon:'💊', title:'Farmaci e stimolanti', sub:'Farmaci, integratori, caffeina, fumo, alcol' },
  { n:5, icon:'😴', title:'Sonno e recupero', sub:'Qualità del riposo e ritmo circadiano' },
  { n:6, icon:'⚡', title:'Stress ed energia', sub:'Livelli di stress e concentrazione' },
  { n:7, icon:'🫃', title:'Digestione e intestino', sub:'Gonfiore, transito e abitudini' },
  { n:8, icon:'⚖️', title:'Storia peso e tentativi', sub:'Percorso passato e tentativi precedenti' },
  { n:9, icon:'🥗', title:'Alimentazione e preferenze', sub:'Cosa mangi, cosa ami, cosa eviti' },
  { n:10, icon:'🏋️', title:'Allenamento', sub:'Abitudini, esercizi preferiti e limitazioni' },
  { n:11, icon:'📋', title:'Vincoli e sostenibilità', sub:'Tempo disponibile e cosa non vuoi fare' },
  { n:12, icon:'✅', title:'Check finale', sub:'Note aggiuntive e consenso' },
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
            if (multi) {
              onChange(arr?.includes(v) ? arr.filter(x=>x!==v) : [...(arr||[]),v])
            } else { onChange(v===value?null:v) }
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

export default function Anamnesi({ clientId: propClientId, onClose }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id
  const isAdmin = !!propClientId

  const [current, setCurrent] = useState(1)
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    const { data: d } = await supabase.from('anamnesi').select('*').eq('client_id', clientId).maybeSingle()
    if (d) { setData(d); setCurrent(d.current_section || 1) }
  }

  function set(field, val) { setData(p => ({...p, [field]:val})) }
  function setArr(field, val) { setData(p => ({...p, [field]:val})) }

  async function saveSection(goTo) {
    setSaving(true)
    const payload = { ...data, client_id: clientId, current_section: goTo || current, updated_at: new Date().toISOString() }
    if (goTo === 13) payload.completed_at = new Date().toISOString()
    await supabase.from('anamnesi').upsert(payload, { onConflict: 'client_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (goTo) setCurrent(goTo)
  }

  function next() { saveSection(Math.min(current+1, 12)) }
  function prev() { saveSection(Math.max(current-1, 1)) }

  const sec = SECTIONS[current-1]

  // Progress
  const pct = Math.round(((current-1)/12)*100)

  return (
    <div style={{display:'flex',flexDirection:'column',height:isAdmin?'80vh':'100%',background:'var(--bg)'}}>
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

          {/* ─── SEZIONE 1 ─── */}
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
          </>}

          {/* ─── SEZIONE 2 ─── */}
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
              <label style={s.label}>Quando vuoi vedere cambiamenti concreti?</label>
              <Chips options={['4 settimane','8 settimane','12 settimane','6 mesi','Altro']} value={data.tempo_cambiamento} onChange={v=>set('tempo_cambiamento',v)}/>
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

          {/* ─── SEZIONE 3 ─── */}
          {current===3 && <>
            <div style={s.card}>
              <label style={s.label}>Diagnosi attive</label>
              <textarea style={s.textarea} placeholder="Elenca eventuali diagnosi mediche attive..." value={data.diagnosi_attive||''} onChange={e=>set('diagnosi_attive',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Interventi chirurgici / ricoveri importanti</label>
              <textarea style={s.textarea} placeholder="Quali e quando..." value={data.interventi_chirurgici||''} onChange={e=>set('interventi_chirurgici',e.target.value)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Seleziona ciò che ti riguarda (anche passato)</label>
              <Chips multi options={['Ipertensione','Colesterolo/trigliceridi alti','Glicemia alta/diabete','Russamento/apnee','Reflusso/gastrite','Gonfiore addominale','Stipsi/diarrea','Problemi renali','Problemi epatici','Dolori articolari cronici','Mal di testa ricorrenti','Ansia/stress cronico','Altro']} value={data.condizioni_salute} onChange={v=>setArr('condizioni_salute',v)}/>
            </div>
            <div style={s.card}>
              <label style={s.label}>Familiarità in famiglia</label>
              <Chips multi options={['Diabete','Ipertensione','Cardiopatie','Obesità','Disturbi tiroidei','Altro']} value={data.familiarita} onChange={v=>setArr('familiarita',v)}/>
              {data.familiarita?.includes('Altro') && <div style={{marginTop:8}}><textarea style={s.textarea} placeholder="Specifica..." value={data.familiarita_altro||''} onChange={e=>set('familiarita_altro',e.target.value)}/></div>}
            </div>
          </>}

          {/* ─── SEZIONE 4 ─── */}
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

          {/* ─── SEZIONE 5 ─── */}
          {current===5 && <>
            <div style={s.card}>
              <div style={s.grid3}>
                <div>
                  <label style={s.label}>Ore di sonno medie</label>
                  <Chips options={['<6','6–7','7–8','>8']} value={data.ore_sonno} onChange={v=>set('ore_sonno',v)}/>
                </div>
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

          {/* ─── SEZIONE 6 ─── */}
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

          {/* ─── SEZIONE 7 ─── */}
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

          {/* ─── SEZIONE 8 ─── */}
          {current===8 && <>
            <div style={s.card}>
              <div style={s.grid3}>
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
          </>}

          {/* ─── SEZIONE 9 ─── */}
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
              <label style={s.label}>Mangi senza fame quando</label>
              <Chips multi options={['Stress','Noia','Rabbia','Stanchezza','Sera','Socialità','Altro']} value={data.mangia_senza_fame} onChange={v=>setArr('mangia_senza_fame',v)}/>
              <div style={{marginTop:10}}><label style={s.label}>Quanto sei disposto a monitorare?</label><Chips options={['Niente tracking','Porzioni "a mano"','Tracking parziale','Tracking completo']} value={data.livello_tracking} onChange={v=>set('livello_tracking',v)}/></div>
            </div>
          </>}

          {/* ─── SEZIONE 10 ─── */}
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
                  <label style={s.label}>Recupero tra sedute</label><Chips options={['Buono','Medio','Scarso']} value={data.recupero} onChange={v=>set('recupero',v)}/>
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

          {/* ─── SEZIONE 11 ─── */}
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
          </>}

          {/* ─── SEZIONE 12 ─── */}
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
          : <button onClick={()=>saveSection(13)} disabled={!data.consenso_dati||!data.consenso_trattamento} style={{...s.btn,flex:1,justifyContent:'center',opacity:(!data.consenso_dati||!data.consenso_trattamento)?0.5:1}}>
              {saving?'Salvataggio...':`✓ Completa l'anamnesi`}
            </button>
        }
      </div>
    </div>
  )
}
