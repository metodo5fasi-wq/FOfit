import React, { useEffect, useState } from 'react'
import { localDateStr } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { dbSave } from '../../lib/db'
import { AVAILABILITY, generateSlots } from '../../lib/callAvailability.js'
import { flashEl, initials, s } from './shared'

// ─────────────────────────────────────────────────────────
// TAB PROGRESSI
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// TAB CALENDARIO — gestione prenotazioni chiamate
// ─────────────────────────────────────────────────────────
const DAY_NAMES_ADMIN = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

export default function CalendarioAdmin({ focus, clearFocus }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { fetchBookings() }, [])
  // arrivo dalla dashboard: si apre il giorno della chiamata e la si evidenzia
  useEffect(() => {
    if (focus?.type !== 'booking' || loading) return
    if (focus.extra?.date) { setSelectedDate(focus.extra.date); flashEl(`[data-booking-id="${focus.id}"]`) }
    clearFocus?.()
  }, [focus, loading])

  async function fetchBookings() {
    setLoading(true)
    const todayStr = localDateStr()
    const { data } = await supabase.from('call_bookings')
      .select('*, profiles(full_name)')
      .gte('booking_date', todayStr)
      .order('booking_date', {ascending:true}).order('time_slot', {ascending:true})
    setBookings(data || [])
    setLoading(false)
  }

  async function cancelBooking(id) {
    if (!confirm('Eliminare questa prenotazione?')) return
    await dbSave(supabase.from('call_bookings').delete().eq('id', id), 'la prenotazione', 'eliminare', { done: 'Prenotazione annullata' })
    fetchBookings()
  }

  async function toggleBlock(date, slot) {
    const existing = bookings.find(b => b.booking_date===date && b.time_slot===slot && b.status==='blocked')
    if (existing) {
      await dbSave(supabase.from('call_bookings').delete().eq('id', existing.id), 'la prenotazione', 'eliminare', { done: 'Slot sbloccato' })
    } else {
      await dbSave(supabase.from('call_bookings').insert({ client_id:null, booking_date:date, time_slot:slot, status:'blocked' }), 'la prenotazione', 'salvare', { done: 'Slot bloccato' })
    }
    fetchBookings()
  }

  // Prossime 3 settimane di giorni disponibili
  const upcomingDates = []
  const now = new Date()
  for (let i=0;i<21;i++) {
    const d = new Date(now)
    d.setDate(now.getDate()+i)
    if (AVAILABILITY[d.getDay()] !== undefined) upcomingDates.push(d)
  }

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed')

  return (
    <>
      {/* PRENOTAZIONI CONFERMATE */}
      <div style={s.card}>
        <div style={s.cardTitle}><i className="ti ti-calendar-event" style={{fontSize:16,color:'#D4570A'}}/> Prenotazioni ({confirmedBookings.length})</div>
        {loading ? (
          <div style={{textAlign:'center',padding:'20px 0',color:'#CCC',fontSize:13}}>Caricamento...</div>
        ) : confirmedBookings.length === 0 ? (
          <div style={{textAlign:'center',padding:'30px 0',fontSize:13,color:'#CCC'}}>Nessuna chiamata prenotata.</div>
        ) : (
          <table style={s.table}>
            <thead><tr><th style={s.th}>Cliente</th><th style={s.th}>Data</th><th style={s.th}>Ora</th><th style={s.th}>Azioni</th></tr></thead>
            <tbody>{confirmedBookings.map(b=>(
              <tr key={b.id} data-booking-id={b.id}>
                <td style={s.td}><div style={{display:'flex',alignItems:'center'}}><div style={{...s.avatar,width:24,height:24,fontSize:10,marginRight:6}}>{initials(b.profiles?.full_name||'')}</div><span style={{fontSize:12}}>{b.profiles?.full_name||'—'}</span></div></td>
                <td style={s.td}>{new Date(b.booking_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}</td>
                <td style={s.td}><span style={{fontWeight:600}}>{b.time_slot}</span></td>
                <td aria-label="Annulla la prenotazione" style={s.td}><button aria-label="Annulla la prenotazione" style={{...s.btnGray,color:'#E24B4A'}} onClick={()=>cancelBooking(b.id)}><i className="ti ti-trash" style={{fontSize:13}}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* GESTIONE DISPONIBILITÀ */}
      <div style={s.card}>
        <div style={s.cardTitle}><i className="ti ti-calendar-cog" style={{fontSize:16,color:'#D4570A'}}/> Gestisci disponibilità</div>
        <div style={{fontSize:12,color:'#CCC',marginBottom:14}}>
          Clicca su uno slot per segnarlo come "occupato" — non sarà visibile ai clienti come disponibile. Utile per simulare un'agenda piena o bloccare orari per impegni personali.
        </div>

        {upcomingDates.map(date => {
          const dateKey = date.toISOString().split('T')[0]
          const slots = generateSlots(date.getDay())
          const isSelected = selectedDate === dateKey
          return (
            <div key={dateKey} style={{marginBottom:8}}>
              <button
                onClick={()=>setSelectedDate(isSelected?null:dateKey)}
                style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:8,border:'0.5px solid #1C1C1C',background:isSelected?'#D4570A':'#161616',color:isSelected?'white':'#F0F0F0',fontFamily:'inherit',fontSize:13,fontWeight:500,cursor:'pointer'}}>
                <span>{DAY_NAMES_ADMIN[date.getDay()]} {date.getDate()}/{date.getMonth()+1}</span>
                <span style={{fontSize:11}}>{isSelected?'▲':'▼'}</span>
              </button>
              {isSelected && slots.length === 0 && (<div style={{marginTop:8,fontSize:12,color:'#AAA',textAlign:'center',padding:'10px 0'}}>Nessuna disponibilità in questo giorno</div>)}
              {isSelected && slots.length > 0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginTop:8}}>
                  {slots.map(slot => {
                    const booked = bookings.find(b=>b.booking_date===dateKey && b.time_slot===slot && b.status==='confirmed')
                    const blocked = bookings.find(b=>b.booking_date===dateKey && b.time_slot===slot && b.status==='blocked')
                    return (
                      <button
                        key={slot}
                        disabled={!!booked}
                        onClick={()=>toggleBlock(dateKey, slot)}
                        style={{
                          padding:'8px',borderRadius:7,border:'0.5px solid',fontSize:12,fontWeight:600,fontFamily:'inherit',
                          cursor:booked?'not-allowed':'pointer',
                          background: booked?'rgba(212,87,10,0.15)':blocked?'rgba(226,75,74,0.12)':'rgba(59,140,90,0.12)',
                          color: booked?'#F4894A':blocked?'#888780':'#6FCF97',
                          borderColor: booked?'#D4570A':blocked?'#2A2A2A':'#3B6D11',
                        }}>
                        {slot}{booked?' 📞':blocked?' 🚫':''}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <div style={{display:'flex',gap:16,marginTop:14,fontSize:11,color:'#CCC'}}>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'rgba(59,109,17,0.1)',marginRight:4,verticalAlign:'middle'}}/>Libero</div>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'#161616',marginRight:4,verticalAlign:'middle'}}/>Bloccato (clicca per liberare)</div>
          <div><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:'rgba(212,87,10,0.1)',marginRight:4,verticalAlign:'middle'}}/>Prenotato</div>
        </div>
      </div>
    </>
  )
}
