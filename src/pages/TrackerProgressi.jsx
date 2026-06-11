import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const MISURE = [
  { key:'weight_kg', label:'Peso', unit:'kg', color:'#D4570A' },
  { key:'waist_cm', label:'Vita', unit:'cm', color:'#F4894A' },
  { key:'hips_cm', label:'Fianchi', unit:'cm', color:'#F4894A' },
  { key:'chest_cm', label:'Petto', unit:'cm', color:'#FAC775' },
  { key:'arm_cm', label:'Braccio', unit:'cm', color:'#FAC775' },
  { key:'thigh_cm', label:'Coscia', unit:'cm', color:'#888780' },
  { key:'body_fat_pct', label:'Massa grassa', unit:'%', color:'#888780' },
]

const PHOTO_LABELS = ['Fronte', 'Fianco', 'Schiena']

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'var(--bg-input)', color:'var(--text-muted)', border:'0.5px solid var(--border)', borderRadius:8, padding:'10px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid var(--border)', borderRadius:8, fontSize:13, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  label: { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 },
  statCard: { background:'var(--bg-card)', borderRadius:10, border:'0.5px solid var(--border)', padding:'14px', textAlign:'center' },
  row: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid var(--border)' },
}

function PesoChart({ entries }) {
  if (entries.length < 2) return null
  const weights = entries.map(e => e.weight_kg)
  const min = Math.min(...weights) - 1
  const max = Math.max(...weights) + 1
  const W = 300, H = 80
  const pts = entries.map((e, i) => {
    const x = (i / (entries.length - 1)) * (W - 20) + 10
    const y = H - ((e.weight_kg - min) / (max - min)) * (H - 20) - 10
    return `${x},${y}`
  }).join(' ')
  return (
    <div style={{overflowX:'auto'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', maxWidth:W, display:'block'}}>
        <polyline points={pts} fill="none" stroke="#D4570A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {entries.map((e, i) => {
          const x = (i / (entries.length - 1)) * (W - 20) + 10
          const y = H - ((e.weight_kg - min) / (max - min)) * (H - 20) - 10
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#D4570A"/>
              <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#888780">{e.weight_kg}</text>
            </g>
          )
        })}
      </svg>
      <div style={{display:'flex', justifyContent:'space-between', marginTop:4}}>
        {entries.map((e, i) => (
          <div key={i} style={{fontSize:9, color:'var(--text-muted)', textAlign:'center'}}>
            {new Date(e.entry_date + 'T12:00:00').toLocaleDateString('it-IT', {day:'numeric', month:'short'})}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TrackerProgressi() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('misure')
  const [entries, setEntries] = useState([])
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState('Fronte')
  const [photoNotes, setPhotoNotes] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    weight_kg:'', waist_cm:'', hips_cm:'', chest_cm:'', arm_cm:'', thigh_cm:'', body_fat_pct:'', notes:''
  })

  useEffect(() => { if (profile) { fetchEntries(); fetchPhotos() } }, [profile])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase.from('progress_entries').select('*')
      .eq('client_id', profile.id).order('entry_date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function fetchPhotos() {
    const { data } = await supabase.from('progress_photos').select('*')
      .eq('client_id', profile.id).order('photo_date', { ascending: false })
    setPhotos(data || [])
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

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
      const fileName = `${profile.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const publicUrl = `https://hdgiwrwcxfbojqfeyrxn.supabase.co/storage/v1/object/public/progress-photos/${fileName}`
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        client_id: profile.id,
        photo_date: new Date().toISOString().split('T')[0],
        photo_url: publicUrl,
        label: selectedLabel,
        notes: photoNotes || null,
      })
      if (dbErr) throw dbErr
      setPhotoNotes('')
      await fetchPhotos()
    } catch(err) {
      alert('Errore: ' + err.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deletePhoto(id, photoUrl) {
    const path = photoUrl.split('/progress-photos/')[1]
    if (path) await supabase.storage.from('progress-photos').remove([path])
    await supabase.from('progress_photos').delete().eq('id', id)
    fetchPhotos()
  }

  const latest = entries[0]
  const prev = entries[1]
  function diff(key) {
    if (!latest?.[key] || !prev?.[key]) return null
    return (latest[key] - prev[key]).toFixed(1)
  }
  function diffColor(key) {
    const d = parseFloat(diff(key))
    if (['weight_kg','waist_cm','hips_cm','body_fat_pct'].includes(key)) {
      return d < 0 ? '#3B6D11' : d > 0 ? '#E24B4A' : '#888780'
    }
    return d > 0 ? '#3B6D11' : d < 0 ? '#E24B4A' : '#888780'
  }

  const photosByDate = {}
  photos.forEach(p => {
    if (!photosByDate[p.photo_date]) photosByDate[p.photo_date] = []
    photosByDate[p.photo_date].push(p)
  })

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15, fontWeight:600, color:'var(--text)'}}>Tracker progressi</div>
          <div style={{fontSize:12, color:'var(--text-muted)'}}>{entries.length} misurazioni · {photos.length} foto</div>
        </div>
        {activeTab === 'misure' && (
          <button style={s.btn} onClick={() => setShowForm(!showForm)}>
            <i className="ti ti-plus" style={{fontSize:14}}/> Misurazione
          </button>
        )}
        {activeTab === 'foto' && (
          <button style={s.btn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            <i className="ti ti-photo" style={{fontSize:14}}/>
            {uploading ? 'Caricando...' : 'Aggiungi foto'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/heic, image/heif, image/webp"
          style={{display:'none'}}
          onChange={uploadPhoto}
        />
      </div>

      <div style={s.page}>

        {/* TAB */}
        <div style={{display:'flex', marginBottom:14, background:'var(--bg-card)', borderRadius:12, padding:4, border:'0.5px solid var(--border)'}}>
          {[{id:'misure', label:'📏 Misurazioni'}, {id:'foto', label:'📸 Foto progressi'}].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex:1, padding:'9px', borderRadius:9, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'all 0.15s',
              background: activeTab === tab.id ? '#D4570A' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* MISURAZIONI */}
        {activeTab === 'misure' && (
          <>
            {showForm && (
              <div style={{...s.card, border:'0.5px solid #D4570A', marginBottom:16}}>
                <div style={{fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:14, display:'flex', alignItems:'center', gap:8}}>
                  <i className="ti ti-ruler" style={{fontSize:15, color:'#D4570A'}}/>
                  Nuova misurazione
                </div>
                <div style={{marginBottom:12}}>
                  <label style={s.label}>Data</label>
                  <input type="date" style={s.input} value={form.entry_date} onChange={e => setForm({...form, entry_date:e.target.value})}/>
                </div>
                <div style={s.grid2}>
                  {MISURE.map(m => (
                    <div key={m.key} style={{marginBottom:10}}>
                      <label style={s.label}>{m.label} ({m.unit})</label>
                      <input type="number" step="0.1" style={s.input} placeholder="—"
                        value={form[m.key]} onChange={e => setForm({...form, [m.key]:e.target.value})}/>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:14}}>
                  <label style={s.label}>Note</label>
                  <input style={s.input} placeholder="Es. mattina a digiuno..." value={form.notes} onChange={e => setForm({...form, notes:e.target.value})}/>
                </div>
                <div style={{display:'flex', gap:10}}>
                  <button style={s.btn} onClick={saveEntry} disabled={saving}>
                    <i className="ti ti-check" style={{fontSize:14}}/>
                    {saving ? 'Salvataggio...' : 'Salva'}
                  </button>
                  <button style={s.btnGray} onClick={() => setShowForm(false)}>Annulla</button>
                </div>
              </div>
            )}

            {latest && (
              <div style={s.card}>
                <div style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, display:'flex', alignItems:'center', gap:6}}>
                  <i className="ti ti-chart-line" style={{fontSize:13, color:'#D4570A'}}/>
                  Ultima — {new Date(latest.entry_date + 'T12:00:00').toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'})}
                </div>
                <div style={s.grid3}>
                  {MISURE.filter(m => latest[m.key]).map(m => {
                    const d = diff(m.key)
                    return (
                      <div key={m.key} style={s.statCard}>
                        <div style={{fontSize:10, color:'var(--text-muted)', marginBottom:4}}>{m.label}</div>
                        <div style={{fontSize:18, fontWeight:700, color:'var(--text)'}}>{latest[m.key]}<span style={{fontSize:11, color:'var(--text-muted)'}}>{m.unit}</span></div>
                        {d !== null && (
                          <div style={{fontSize:11, color:diffColor(m.key), marginTop:3, fontWeight:600}}>
                            {parseFloat(d) > 0 ? '+' : ''}{d}{m.unit}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {entries.filter(e => e.weight_kg).length > 1 && (
              <div style={s.card}>
                <div style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, display:'flex', alignItems:'center', gap:6}}>
                  <i className="ti ti-trending-down" style={{fontSize:13, color:'#D4570A'}}/>
                  Andamento peso
                </div>
                <PesoChart entries={entries.filter(e => e.weight_kg).slice(0, 10).reverse()}/>
              </div>
            )}

            <div style={s.card}>
              <div style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>Storico</div>
              {loading ? (
                <div style={{textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13}}>Caricamento...</div>
              ) : entries.length === 0 ? (
                <div style={{textAlign:'center', padding:'30px 0'}}>
                  <i className="ti ti-ruler" style={{fontSize:40, color:'#E0DDD6', display:'block', marginBottom:12}}/>
                  <div style={{fontSize:13, color:'var(--text-muted)'}}>Nessuna misurazione ancora.</div>
                </div>
              ) : entries.map((e, i) => (
                <div key={e.id} style={s.row}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4}}>
                      {new Date(e.entry_date + 'T12:00:00').toLocaleDateString('it-IT', {weekday:'short', day:'numeric', month:'short', year:'numeric'})}
                      {i === 0 && <span style={{marginLeft:8, fontSize:10, background:'#FEF0E7', color:'#D4570A', padding:'2px 8px', borderRadius:10, fontWeight:600}}>Ultima</span>}
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      {MISURE.filter(m => e[m.key]).map(m => (
                        <span key={m.key} style={{fontSize:11, color:'var(--text-muted)', background:'var(--bg-input)', padding:'2px 8px', borderRadius:10}}>
                          {m.label}: <strong style={{color:'var(--text)'}}>{e[m.key]}{m.unit}</strong>
                        </span>
                      ))}
                    </div>
                    {e.notes && <div style={{fontSize:11, color:'var(--text-muted)', marginTop:4, fontStyle:'italic'}}>{e.notes}</div>}
                  </div>
                  <button onClick={() => deleteEntry(e.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#E0DDD6', fontSize:16, padding:'0 0 0 12px', flexShrink:0}}>
                    <i className="ti ti-trash"/>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FOTO */}
        {activeTab === 'foto' && (
          <>
            <div style={s.card}>
              <div style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>Tipo di foto</div>
              <div style={{display:'flex', gap:8, marginBottom:12}}>
                {PHOTO_LABELS.map(l => (
                  <button key={l} onClick={() => setSelectedLabel(l)} style={{
                    flex:1, padding:'8px', borderRadius:9, border:'0.5px solid', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                    background: selectedLabel === l ? '#D4570A' : 'var(--bg-card)',
                    color: selectedLabel === l ? 'white' : 'var(--text-muted)',
                    borderColor: selectedLabel === l ? '#D4570A' : 'var(--border)',
                  }}>{l}</button>
                ))}
              </div>
              <input style={s.input} placeholder="Note opzionali (es. dopo 4 settimane...)"
                value={photoNotes} onChange={e => setPhotoNotes(e.target.value)}/>
              <button
                style={{...s.btn, width:'100%', justifyContent:'center', marginTop:10}}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <i className="ti ti-photo" style={{fontSize:15}}/>
                {uploading ? 'Caricamento in corso...' : `Scegli dalla galleria — ${selectedLabel}`}
              </button>
            </div>

            {photos.length === 0 && (
              <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
                <i className="ti ti-camera" style={{fontSize:48, color:'#E0DDD6', display:'block', marginBottom:16}}/>
                <div style={{fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:8}}>Nessuna foto ancora</div>
                <div style={{fontSize:13, color:'var(--text-muted)', lineHeight:1.6}}>Scegli una foto dalla galleria per iniziare.</div>
              </div>
            )}

            {Object.entries(photosByDate).map(([date, dayPhotos]) => (
              <div key={date} style={s.card}>
                <div style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}
                </div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                  {dayPhotos.map(photo => (
                    <div key={photo.id} style={{position:'relative'}}>
                      <img
                        src={photo.photo_url}
                        alt={photo.label}
                        onClick={() => setLightbox(photo)}
                        style={{width:'100%', aspectRatio:'3/4', objectFit:'cover', borderRadius:10, cursor:'pointer', display:'block'}}
                      />
                      <div style={{position:'absolute', bottom:6, left:6, background:'rgba(0,0,0,0.6)', color:'white', fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:600}}>
                        {photo.label}
                      </div>
                      <button
                        onClick={() => deletePhoto(photo.id, photo.photo_url)}
                        style={{position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white'}}
                      >
                        <i className="ti ti-x" style={{fontSize:12}}/>
                      </button>
                      {photo.notes && (
                        <div style={{fontSize:10, color:'var(--text-muted)', marginTop:4, textAlign:'center'}}>{photo.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20}}>
          <img src={lightbox.photo_url} alt={lightbox.label}
            style={{maxWidth:'100%', maxHeight:'80vh', objectFit:'contain', borderRadius:12}}/>
          <div style={{color:'white', marginTop:12, fontSize:13, fontWeight:600}}>{lightbox.label}</div>
          {lightbox.notes && <div style={{color:'rgba(255,255,255,0.6)', fontSize:12, marginTop:4}}>{lightbox.notes}</div>}
          <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:4}}>
            {new Date(lightbox.photo_date + 'T12:00:00').toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'})}
          </div>
          <button onClick={() => setLightbox(null)} style={{marginTop:16, background:'rgba(255,255,255,0.1)', border:'none', color:'white', padding:'10px 24px', borderRadius:20, fontSize:13, cursor:'pointer', fontFamily:'inherit'}}>
            Chiudi
          </button>
        </div>
      )}
    </>
  )
}
