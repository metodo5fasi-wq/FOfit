import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { localDateStr } from './dates'
import { summarize } from './installments'
import { useRefreshOnReturn } from './useRefreshOnReturn'

// Le rate del cliente loggato e il loro riepilogo (avviso / blocco).
// Se le rate non si riescono a leggere (rete assente, nessuna rata) NON si blocca nessuno; l'ultima copia letta resta salvata, così un blocco non sparisce spegnendo la rete.
const key = id => `fofit_rate_${id}`
const readCache = id => { try { const v = JSON.parse(localStorage.getItem(key(id)) || 'null'); return Array.isArray(v) ? v : null } catch { return null } }
export function useInstallments(profile) {
  const id = profile?.id, isClient = !!id && profile?.role !== 'admin'
  const [rows, setRows] = useState(() => (isClient ? readCache(id) : null))
  const [today, setToday] = useState(localDateStr())
  const load = useCallback(async () => {
    if (!isClient) return
    setToday(localDateStr())
    try {
      const { data, error } = await supabase.from('subscription_installments').select('*').eq('client_id', id)
      if (error || !Array.isArray(data)) return
      setRows(data); try { localStorage.setItem(key(id), JSON.stringify(data)) } catch {}
    } catch {}
  }, [id, isClient])
  useEffect(() => { load() }, [load])
  useRefreshOnReturn(load, 30000)
  const summary = useMemo(() => (rows ? summarize(rows, today) : null), [rows, today])
  return { rows, summary, today, reload: load }
}
