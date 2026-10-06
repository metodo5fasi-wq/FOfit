
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, full_name, goal, phone, height_cm, notes } = req.body
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password e nome sono obbligatori' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Service key mancante — aggiungila su Vercel' })
  }

  try {
    // Crea utente con Admin API (non fa login automatico)
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // conferma email automaticamente
        user_metadata: { full_name, role: 'client' }
      })
    })

    const userData = await createRes.json()
    if (!createRes.ok) {
      return res.status(400).json({ 
        error: userData.message || userData.error_description || userData.error || JSON.stringify(userData)
      })
    }

    const userId = userData.id
    if (!userId) return res.status(500).json({ error: 'ID utente non ricevuto' })

    // Aggiorna il profilo con tutti i dati
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        full_name,
        role: 'client',
        goal: goal || 'dimagrimento',
        phone: phone || null,
        height_cm: height_cm ? parseFloat(height_cm) : null,
        notes: notes || null,
      })
    })

    if (!profileRes.ok) {
      const profileErr = await profileRes.text()
      console.error('Profile update error:', profileErr)
    }

    return res.status(200).json({ success: true, userId })

  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
