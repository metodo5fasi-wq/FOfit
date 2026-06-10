import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  badge: { background:'#FEF0E7', color:'#D4570A', fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'10px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 },
  statCard: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'14px', textAlign:'center' },
  row: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid #F5F3EF' },
}

const MISURE = [
  { key:'weight_kg', label:'Peso', unit:'kg', icon:'ti-scale', color:'#D4570A' },
  { key:'waist_cm', label:'Vita', unit:'cm', icon:'ti-circle', color:'#F4894A' },
  { key:'hips_cm', label:'Fianchi', unit:'cm', icon:'ti-circle', color:'#F4894A' },
  { key:'chest_cm', label:'Petto', unit:'cm', icon:'ti-circle', color:'#FAC775' },
  { key:'arm_cm', label:'Braccio', unit:'cm', icon:'ti-circle', color:'#FAC775' },
  { key:'thigh_cm', label:'Coscia', unit:'cm', icon:'ti-circle', color:'#888780' },
  { key:'body_fat_pct', label:'Massa grassa', unit:'%', icon:'ti-percentage', color:'#888780' },
]

export default function TrackerProgressi() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], weight_kg:'', waist_cm:'', hips_cm:'', chest_cm:'', arm_cm:'', thigh_cm:'', body_fat_pct:'', notes:'' })

  useEffect(() => { if (profile) fetchEntries() }, [profile])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('progress_entries')
      .select('*')
      .eq('client_id', profile.id)
      .order('entry_date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function saveEntry() {
    setSaving(true)
    const payload = { client_id: profile.id, entry_date: form.entry_date, notes: form.notes || null }
    MISURE.forEach(m => { payload[m.key] = form[m.key] ? parseFloat(form[m.key]) : null })
    const { error } = await supabase.from('progress_entries').insert(payload)
    if (!error) {
      setShowForm(false)
      setForm({ entry_date: new Date().toISOString().split('T')[0], weight_kg:'', waist_cm:'', hips_cm:'', chest_cm:'', arm_cm:'', thigh_cm:'', body_fat_pct:'', notes:'' })
      fetchEntries()
    }
    setSaving(false)
  }

  async function deleteEntry(id) {
    await supabase.from('progress_entries').delete().eq('id', id)
    fetchEntries()
  }

  // Calcola variazioni
  const latest = entries[0]
  const prev = entries[1]
  function diff(key) {
    if (!latest?.[key] || !prev?.[key]) return null
    return (latest[key] - prev[key]).toFixed(1)
  }
  function diffColor(key) {
    const d = parseFloat(diff(key))
    if (key === 'weight_kg' || key === 'waist_cm' || key === 'hips_cm' || key === 'body_fat_pct') {
      return d < 0 ? '#3B6D11' : d > 0 ? '#E24B4A' : '#888780'
    }
    return d > 0 ? '#3B6D11' : d < 0 ? '#E24B4A' : '#888780'
  }

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Tracker progressi</div>
          <div style={{fontSize:12,color:'#888780'}}>{entries.length} misurazioni registrate</div>
        </div>
        <button style={s.btn} onClick={() => setShowForm(!showForm)}>
          <i className="ti ti-plus" style={{fontSize:14}}/> Nuova misurazione
        </button>
      </div>

      <div style={s.page}>

        {/* FORM NUOVA MISURAZIONE */}
        {showForm && (
          <div style={{...s.card, border:'0.5px solid #D4570A', marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
              <i className="ti ti-ruler" style={{fontSize:15,color:'#D4570A'}}/>
              Nuova misurazione
            </div>

            <div style={{marginBottom:12}}>
              <label style={s.label}>Data</label>
              <input type="date" style={s.input} value={form.entry_date} onChange={e=>setForm({...form,entry_date:e.target.value})}/>
            </div>

            <div style={s.grid2}>
              {MISURE.map(m => (
                <div key={m.key} style={{marginBottom:10}}>
                  <label style={s.label}>{m.label} ({m.unit})</label>
                  <input type="number" step="0.1" style={s.input} placeholder="—"
                    value={form[m.key]} onChange={e=>setForm({...form,[m.key]:e.target.value})}/>
                </div>
              ))}
            </div>

            <div style={{marginBottom:14}}>
              <label style={s.label}>Note</label>
              <input style={s.input} placeholder="Es. post-allenamento, mattina a digiuno..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
            </div>

            <div style={{display:'flex',gap:10}}>
              <button style={s.btn} onClick={saveEntry} disabled={saving}>
                <i className="ti ti-check" style={{fontSize:14}}/>
                {saving ? 'Salvataggio...' : 'Salva misurazione'}
              </button>
              <button style={s.btnGray} onClick={()=>setShowForm(false)}>Annulla</button>
            </div>
          </div>
        )}

        {/* ULTIMI VALORI */}
        {latest && (
          <div style={s.card}>
            <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
              <i className="ti ti-chart-line" style={{fontSize:15,color:'#D4570A'}}/>
              Ultima misurazione — {new Date(latest.entry_date).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}
            </div>
            <div style={s.grid3}>
              {MISURE.filter(m => latest[m.key]).map(m => {
                const d = diff(m.key)
                return (
                  <div key={m.key} style={s.statCard}>
                    <div style={{fontSize:11,color:'#888780',marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:20,fontWeight:500,color:'#111'}}>{latest[m.key]}<span style={{fontSize:12,color:'#888780'}}>{m.unit}</span></div>
                    {d !== null && (
                      <div style={{fontSize:11,color:diffColor(m.key),marginTop:3,fontWeight:500}}>
                        {parseFloat(d) > 0 ? '+' : ''}{d}{m.unit}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* GRAFICO PESO SEMPLICE */}
        {entries.filter(e => e.weight_kg).length > 1 && (
          <div style={s.card}>
            <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
              <i className="ti ti-trending-down" style={{fontSize:15,color:'#D4570A'}}/>
              Andamento peso
            </div>
            <PesoChart entries={entries.filter(e=>e.weight_kg).slice(0,10).reverse()}/>
          </div>
        )}

        {/* STORICO */}
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:12}}>Storico misurazioni</div>

          {loading ? (
            <div style={{textAlign:'center',padding:'20px 0',color:'#888780',fontSize:13}}>Caricamento...</div>
          ) : entries.length === 0 ? (
            <div style={{textAlign:'center',padding:'30px 0'}}>
              <i className="ti ti-ruler" style={{fontSize:40,color:'#E0DDD6',display:'block',marginBottom:12}}/>
              <div style={{fontSize:13,color:'#888780'}}>Nessuna misurazione ancora.<br/>Clicca "Nuova misurazione" per iniziare!</div>
            </div>
          ) : entries.map((e, i) => (
            <div key={e.id} style={s.row}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:4}}>
                  {new Date(e.entry_date).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                  {i===0 && <span style={{...s.badge,marginLeft:8,fontSize:10}}>Ultima</span>}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {MISURE.filter(m=>e[m.key]).map(m=>(
                    <span key={m.key} style={{fontSize:11,color:'#888780',background:'#F5F3EF',padding:'2px 8px',borderRadius:10}}>
                      {m.label}: <strong style={{color:'#111'}}>{e[m.key]}{m.unit}</strong>
                    </span>
                  ))}
                </div>
                {e.notes && <div style={{fontSize:11,color:'#888780',marginTop:4,fontStyle:'italic'}}>{e.notes}</div>}
              </div>
              <button onClick={()=>deleteEntry(e.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontSize:16,padding:'0 0 0 12px',flexShrink:0}}>
                <i className="ti ti-trash"/>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// Mini grafico peso SVG
function PesoChart({ entries }) {
  if (entries.length < 2) return null
  const weights = entries.map(e => e.weight_kg)
  const min = Math.min(...weights) - 1
  const max = Math.max(...weights) + 1
  const w = 300, h = 80
  const points = entries.map((e, i) => {
    const x = (i / (entries.length - 1)) * (w - 20) + 10
    const y = h - ((e.weight_kg - min) / (max - min)) * (h - 20) - 10
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{overflowX:'auto'}}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',maxWidth:w,display:'block'}}>
        <polyline points={points} fill="none" stroke="#D4570A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {entries.map((e, i) => {
          const x = (i / (entries.length - 1)) * (w - 20) + 10
          const y = h - ((e.weight_kg - min) / (max - min)) * (h - 20) - 10
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#D4570A"/>
              <text x={x} y={y-8} textAnchor="middle" fontSize={9} fill="#888780">{e.weight_kg}</text>
            </g>
          )
        })}
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        {entries.map((e,i) => (
          <div key={i} style={{fontSize:9,color:'#888780',textAlign:'center'}}>
            {new Date(e.entry_date).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}
          </div>
        ))}
      </div>
    </div>
  )
}
