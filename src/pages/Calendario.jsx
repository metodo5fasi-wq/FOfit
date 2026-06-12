import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Toast } from '../components/Animations'

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'var(--bg-input)', color:'var(--text-muted)', border:'0.5px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
}

// Configurazione slot: giorno della settimana (0=Dom...6=Sab) -> { start, end }
const AVAILABILITY = {
  1: { start: '09:00', end: '12:00' }, // Lunedì
  2: { start: '15:00', end: '18:30' }, // Martedì
  3: { start: '09:00', end: '12:00' }, // Mercoledì
  4: { start: '15:00', end: '18:30' }, // Giovedì
  5: { start: '09:00', end: '12:00' }, // Venerdì
}

const SLOT_MINUTES = 30
const MAX_BOOKINGS_PER_MONTH = 2

const DAY_NAMES = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

function generateSlots(dayOfWeek) {
  const avail = AVAILABILITY[dayOfWeek]
  if (!avail) return []
  const slots = []
  let [h, m] = avail.start.split(':').map(Number)
  const [endH, endM] = avail.end.split(':').map(Number)
  while (h < endH || (h === endH && m < endM)) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
    m += SLOT_MINUTES
    if (m >= 60) { m -= 60; h += 1 }
  }
  return slots
}

// Genera le prossime N date disponibili (escludendo oggi se è già passato l'orario)
function getUpcomingDates(weeksAhead = 3) {
  const dates = []
  const now = new Date()
  for (let i = 0; i < weeksAhead * 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const dow = d.getDay()
    if (AVAILABILITY[dow]) {
      dates.push(d)
    }
  }
  return dates
}

function formatDateKey(d) {
  return d.toISOString().split('T')[0]
}

export default function Calendario() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([]) // tutte le prenotazioni (mese corrente + future)
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [toast, setToast] = useState({ visible:false, message:'', emoji:'' })
  const [selectedDate, setSelectedDate] = useState(null)

  const upcomingDates = getUpcomingDates(3)

  useEffect(() => { if (profile) fetchData() }, [profile])

  async function fetchData() {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('call_bookings')
      .select('*, profiles(full_name)')
      .gte('booking_date', todayStr)
      .order('booking_date', { ascending: true })
    setBookings(data || [])
    setMyBookings((data || []).filter(b => b.client_id === profile.id && b.status === 'confirmed'))
    setLoading(false)
  }

  function showToast(message, emoji) {
    setToast({ visible:true, message, emoji })
    setTimeout(() => setToast({ visible:false, message:'', emoji:'' }), 2500)
  }

  // Conta prenotazioni del cliente nel mese di una data
  function bookingsInMonth(date) {
    const monthKey = date.toISOString().slice(0,7) // YYYY-MM
    return myBookings.filter(b => b.booking_date.slice(0,7) === monthKey).length
  }

  function isSlotTaken(dateKey, slot) {
    // Sia "confirmed" che "blocked" rendono lo slot non disponibile
    return bookings.some(b => b.booking_date === dateKey && b.time_slot === slot && (b.status === 'confirmed' || b.status === 'blocked'))
  }

  function isSlotPast(date, slot) {
    const [h, m] = slot.split(':').map(Number)
    const slotDate = new Date(date)
    slotDate.setHours(h, m, 0, 0)
    return slotDate < new Date()
  }

  async function bookSlot(date, slot) {
    const dateKey = formatDateKey(date)
    if (bookingsInMonth(date) >= MAX_BOOKINGS_PER_MONTH) {
      showToast(`Hai già prenotato ${MAX_BOOKINGS_PER_MONTH} chiamate questo mese`, '⚠️')
      return
    }
    setBooking(true)
    const { error } = await supabase.from('call_bookings').insert({
      client_id: profile.id,
      booking_date: dateKey,
      time_slot: slot,
      status: 'confirmed',
    })
    if (error) {
      showToast('Errore: ' + error.message, '❌')
    } else {
      showToast('Chiamata prenotata!', '📅')
      // Notifica push all'admin (best-effort, non blocca se fallisce)
      notifyAdmin(date, slot)
      fetchData()
      setSelectedDate(null)
    }
    setBooking(false)
  }

  async function cancelBooking(id) {
    if (!confirm('Vuoi annullare questa prenotazione?')) return
    await supabase.from('call_bookings').delete().eq('id', id)
    showToast('Prenotazione annullata', '🗑️')
    fetchData()
  }

  async function notifyAdmin(date, slot) {
    try {
      // Trova l'admin
      const { data: admins } = await supabase.from('profiles').select('id').eq('role','admin').limit(1)
      if (!admins?.[0]) return
      const dateLabel = date.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })
      await fetch('/api/push-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: admins[0].id,
          title: '📅 Nuova prenotazione chiamata',
          body: `${profile.full_name} ha prenotato per ${dateLabel} alle ${slot}`,
          url: '/admin'
        })
      })
    } catch(e) { /* silenzioso */ }
  }

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Prenota una chiamata</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>Max {MAX_BOOKINGS_PER_MONTH} al mese · 30 minuti</div>
        </div>
      </div>

      <div style={s.page}>

        {/* PROSSIME CHIAMATE PRENOTATE */}
        {myBookings.length > 0 && (
          <div style={s.card}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
              <i className="ti ti-phone" style={{fontSize:13,color:'#D4570A'}}/>
              Le tue chiamate prenotate
            </div>
            {myBookings.map(b => (
              <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>
                    {new Date(b.booking_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}
                  </div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Ore {b.time_slot}</div>
                </div>
                <button onClick={()=>cancelBooking(b.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontSize:18}}>
                  <i className="ti ti-trash"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* INFO */}
        <div style={{...s.card, background:'var(--bg-input)', border:'none'}}>
          <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6}}>
            <i className="ti ti-info-circle" style={{fontSize:13,color:'#D4570A',marginRight:6}}/>
            Disponibilità: <strong style={{color:'var(--text)'}}>Lun, Mer, Ven 9:00-12:00</strong> e <strong style={{color:'var(--text)'}}>Mar, Gio 15:00-18:30</strong>.
            Dopo la prenotazione ci sentiremo su WhatsApp per i dettagli della chiamata.
          </div>
        </div>

        {/* CALENDARIO GIORNI */}
        {loading ? (
          <div style={{textAlign:'center',padding:'30px 0',color:'var(--text-muted)',fontSize:13}}>Caricamento...</div>
        ) : (
          <div style={s.card}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Giorni disponibili</div>

            {upcomingDates.map(date => {
              const dateKey = formatDateKey(date)
              const slots = generateSlots(date.getDay())
              const availableSlots = slots.filter(slot => !isSlotTaken(dateKey, slot) && !isSlotPast(date, slot))
              const isSelected = selectedDate === dateKey
              const monthFull = bookingsInMonth(date) >= MAX_BOOKINGS_PER_MONTH

              if (availableSlots.length === 0) return null

              return (
                <div key={dateKey} style={{marginBottom:10}}>
                  <button
                    onClick={()=>setSelectedDate(isSelected ? null : dateKey)}
                    style={{
                      width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'12px 14px', borderRadius:10, border:'0.5px solid var(--border)',
                      background: isSelected ? '#D4570A' : 'var(--bg-input)',
                      color: isSelected ? 'white' : 'var(--text)',
                      fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer'
                    }}>
                    <span>{DAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth()+1}</span>
                    <span style={{fontSize:11,opacity:0.8}}>{availableSlots.length} slot {isSelected ? '▲' : '▼'}</span>
                  </button>

                  {isSelected && (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:8}}>
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={()=>bookSlot(date, slot)}
                          disabled={booking || monthFull}
                          style={{
                            padding:'10px',borderRadius:8,border:'0.5px solid #D4570A',
                            background: monthFull ? 'var(--bg-input)' : '#FEF0E7',
                            color: monthFull ? 'var(--text-muted)' : '#D4570A',
                            fontFamily:'inherit',fontSize:13,fontWeight:600,
                            cursor: monthFull ? 'not-allowed' : 'pointer'
                          }}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                  {isSelected && monthFull && (
                    <div style={{fontSize:11,color:'#E24B4A',marginTop:8,textAlign:'center'}}>
                      Hai già raggiunto il limite di {MAX_BOOKINGS_PER_MONTH} chiamate per questo mese
                    </div>
                  )}
                </div>
              )
            })}

            {upcomingDates.every(date => {
              const dateKey = formatDateKey(date)
              const slots = generateSlots(date.getDay())
              return slots.filter(slot => !isSlotTaken(dateKey, slot) && !isSlotPast(date, slot)).length === 0
            }) && (
              <div style={{textAlign:'center',padding:'20px 0',fontSize:13,color:'var(--text-muted)'}}>
                Nessuno slot disponibile nelle prossime settimane.
              </div>
            )}
          </div>
        )}
      </div>

      <Toast visible={toast.visible} message={toast.message} emoji={toast.emoji}/>
    </>
  )
}
