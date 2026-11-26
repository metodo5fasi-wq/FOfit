// Elenco dei «miei alimenti»: si legge una volta, si tiene in memoria e si aggiorna quando il coach ne aggiunge/modifica/elimina.
// Se la tabella non esiste ancora (script SQL non eseguito) o non c'è rete: elenco vuoto, l'app funziona come prima.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fromRow } from './customFoods'

let cache = null, inflight = null, status = { loaded: false, error: null }     // error: null | 'sql' (tabella non creata) | 'rete'
const listeners = new Set()
const notifyAll = () => listeners.forEach(fn => fn((cache || []).slice()))
export const customFoodsStatus = () => status
const isMissing = e => /custom_foods|relation|schema cache|does not exist|42P01|PGRST205/i.test(String(e?.message || '') + ' ' + String(e?.code || ''))

export async function refreshCustomFoods() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await supabase.from('custom_foods').select('*').order('name').limit(2000)
      cache = error ? (cache || []) : (data || []).map(fromRow)
      status = { loaded: true, error: error ? (isMissing(error) ? 'sql' : 'rete') : null }
    } catch { cache = cache || []; status = { loaded: true, error: 'rete' } }
    inflight = null; notifyAll(); return cache
  })()
  return inflight
}
export const getCustomFoods = () => cache || []
export function resetCustomFoodsForTests() { cache = null; inflight = null; status = { loaded: false, error: null }; listeners.clear() }

// Hook: { foods, refresh }. La prima volta carica da rete.
export function useCustomFoods() {
  const [foods, setFoods] = useState(cache || [])
  useEffect(() => {
    listeners.add(setFoods)
    if (cache == null) refreshCustomFoods(); else setFoods(cache)
    return () => { listeners.delete(setFoods) }
  }, [])
  return { foods, refresh: refreshCustomFoods }
}
