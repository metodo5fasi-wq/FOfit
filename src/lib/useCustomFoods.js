// Elenco dei «miei alimenti»: si legge una volta, si tiene in memoria e si aggiorna quando il coach ne aggiunge/modifica/elimina.
// Se la tabella non esiste ancora (script SQL non eseguito) o non c'è rete: elenco vuoto, l'app funziona come prima.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fromRow } from './customFoods'

let cache = null, inflight = null
const listeners = new Set()
const notifyAll = () => listeners.forEach(fn => fn(cache || []))

export async function refreshCustomFoods() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await supabase.from('custom_foods').select('*').order('name').limit(2000)
      cache = error ? (cache || []) : (data || []).map(fromRow)
    } catch { cache = cache || [] }
    inflight = null; notifyAll(); return cache
  })()
  return inflight
}
export const getCustomFoods = () => cache || []
export function resetCustomFoodsForTests() { cache = null; inflight = null; listeners.clear() }

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
