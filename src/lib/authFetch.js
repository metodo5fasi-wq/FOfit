import { supabase } from './supabase'

// Come fetch(), ma aggiunge il token di accesso: i servizi (/api/...) verificano chi chiama.
export async function authFetch(url, options = {}) {
  let token = null
  try { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || null } catch {}
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(url, { ...options, headers })
}
