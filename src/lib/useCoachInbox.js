// Dati della dashboard del coach: legge ciò che i clienti hanno inviato e ricorda cosa è già stato letto.
// Stato "letto": messaggi, report e anamnesi usano i loro campi già esistenti; check-in, chiamate, foto e misure
// si ricordano nella tabella coach_inbox_seen (se non c'è ancora, si usa questo dispositivo e si avvisa).
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { buildInbox, buildAgenda, buildAttention, buildWeek, dayKey, DAY } from './coachInbox.js'

const LS_KEY = 'fofit_coach_seen_keys'
const readLocal = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')) } catch { return new Set() } }
const writeLocal = set => { try { localStorage.setItem(LS_KEY, JSON.stringify([...set].slice(-2000))) } catch {} }
const safe = p => Promise.resolve(p).then(r => r, e => ({ data: null, error: e }))   // mai eccezioni: un errore su una sezione non blocca le altre

export function useCoachInbox({ clients, clientStats, coachId, onChanged }) {
  const [raw, setRaw] = useState(null)
  const [seen, setSeen] = useState(readLocal)
  const [loading, setLoading] = useState(true)
  const [problems, setProblems] = useState([])
  const [seenTableOk, setSeenTableOk] = useState(true)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const now = new Date(), since30 = new Date(now - 30 * DAY).toISOString(), since90 = new Date(now - 90 * DAY).toISOString(), today = dayKey(now)
    const [checkins, messages, reports, anam, bookings, photos, measures, wplans, seenRes] = await Promise.all([
      safe(supabase.from('weekly_checkins').select('*').gte('created_at', since30).order('created_at', { ascending: false }).limit(300)),
      safe(supabase.from('coach_messages').select('*').eq('sender_role', 'client').eq('is_read', false).order('created_at', { ascending: false }).limit(300)),
      safe(supabase.from('workout_reports').select('id,client_id,submitted_at,read_by_coach').not('submitted_at', 'is', null).eq('read_by_coach', false).order('submitted_at', { ascending: false }).limit(100)),
      safe(supabase.from('anamnesi').select('id,client_id,completed_at,submitted_at,read_by_coach').not('completed_at', 'is', null).eq('read_by_coach', false).order('completed_at', { ascending: false }).limit(100)),
      safe(supabase.from('call_bookings').select('*').eq('status', 'confirmed').gte('booking_date', today).order('booking_date', { ascending: true }).order('time_slot', { ascending: true }).limit(300)),
      safe(supabase.from('progress_photos').select('*').gte('created_at', since30).order('created_at', { ascending: false }).limit(300)),
      safe(supabase.from('progress_entries').select('*').gte('created_at', since30).order('created_at', { ascending: false }).limit(300)),
      safe(supabase.from('workout_plans').select('client_id').eq('is_active', true).limit(1000)),
      safe(supabase.from('coach_inbox_seen').select('item_key').eq('coach_id', coachId).gte('seen_at', since90).limit(5000)),
    ])
    if (!alive.current) return
    const bad = []
    const take = (res, label) => { if (res.error) { bad.push(label); return [] } return res.data || [] }
    setRaw({
      checkins: take(checkins, 'check-in'), messages: take(messages, 'messaggi'), reports: take(reports, 'report'), anamnesi: take(anam, 'anamnesi'),
      bookings: take(bookings, 'chiamate'), photos: take(photos, 'foto'), measures: take(measures, 'misure'),
      workoutPlanClients: wplans.error ? null : new Set((wplans.data || []).map(r => r.client_id)),
    })
    setSeenTableOk(!seenRes.error)
    setSeen(new Set([...readLocal(), ...(seenRes.error ? [] : (seenRes.data || []).map(r => r.item_key))]))
    setProblems(bad); setLoading(false)
  }, [coachId])

  useEffect(() => { load() }, [load])
  useEffect(() => { const h = () => load(); window.addEventListener('focus', h); return () => window.removeEventListener('focus', h) }, [load])

  const clientsById = useMemo(() => Object.fromEntries((clients || []).map(c => [c.id, c])), [clients])
  const derived = useMemo(() => {
    if (!raw) return { items: [], agenda: { today: [], tomorrow: [], week: [], later: [] }, attention: [], week: null }
    const now = new Date(), lastCheckinAt = {}
    raw.checkins.forEach(r => { const at = r.created_at || (r.week_date && `${r.week_date}T12:00:00`); if (at && (!lastCheckinAt[r.client_id] || new Date(at) > new Date(lastCheckinAt[r.client_id]))) lastCheckinAt[r.client_id] = at })
    return {
      items: buildInbox({ ...raw, seenKeys: seen, clientsById, now }),
      agenda: buildAgenda({ bookings: raw.bookings, clientsById, now }),
      attention: buildAttention({ clients: clients || [], stats: clientStats || {}, lastCheckinAt, workoutPlanClients: raw.workoutPlanClients, now }),
      week: buildWeek({ clients: clients || [], stats: clientStats || {}, checkins: raw.checkins, now }),
    }
  }, [raw, seen, clientsById, clients, clientStats])

  const unseen = useMemo(() => derived.items.filter(i => !i.seen), [derived.items])
  const counts = useMemo(() => { const c = { all: unseen.length, checkin: 0, message: 0, report: 0, anamnesi: 0, booking: 0, media: 0 }; unseen.forEach(i => { c[i.type === 'photo' || i.type === 'measure' ? 'media' : i.type]++ }); return c }, [unseen])

  const markSeen = useCallback(async input => {
    const list = (Array.isArray(input) ? input : [input]).filter(Boolean)
    if (!list.length) return
    const native = list.filter(i => i.native), viaKeys = list.filter(i => !i.native)
    if (viaKeys.length) { const local = readLocal(); viaKeys.forEach(i => local.add(i.key)); writeLocal(local); setSeen(prev => new Set([...prev, ...viaKeys.map(i => i.key)])) }
    const ids = type => native.filter(i => i.type === type).map(i => i.id)
    if (native.length) setRaw(prev => prev && ({ ...prev,
      messages: prev.messages.filter(r => !ids('message').includes(r.id)), reports: prev.reports.filter(r => !ids('report').includes(r.id)), anamnesi: prev.anamnesi.filter(r => !ids('anamnesi').includes(r.id)) }))
    const jobs = []
    if (ids('message').length) jobs.push(safe(supabase.from('coach_messages').update({ is_read: true }).in('id', ids('message'))))
    if (ids('report').length) jobs.push(safe(supabase.from('workout_reports').update({ read_by_coach: true }).in('id', ids('report'))))
    if (ids('anamnesi').length) jobs.push(safe(supabase.from('anamnesi').update({ read_by_coach: true }).in('id', ids('anamnesi'))))
    if (viaKeys.length) jobs.push(safe(supabase.from('coach_inbox_seen').upsert(viaKeys.map(i => ({ coach_id: coachId, item_key: i.key })), { onConflict: 'coach_id,item_key' })).then(r => { if (r.error && alive.current) setSeenTableOk(false); return { ...r, soft: true } }))
    const res = await Promise.all(jobs)
    if (res.some(r => r && r.error && !r.soft)) { setProblems(p => [...new Set([...p, 'segna come letto'])]); load() }   // un aggiornamento non è andato a buon fine: ricarico lo stato vero
    if (native.length) onChanged && onChanged()
  }, [coachId, load, onChanged])

  return { loading, problems, seenTableOk, items: derived.items, unseen, unseenCount: unseen.length, counts, agenda: derived.agenda, attention: derived.attention, week: derived.week, markSeen, reload: load }
}
