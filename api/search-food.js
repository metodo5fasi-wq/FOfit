export const config = { api: { bodyParser: false } }

async function getFatSecretToken() {
  const clientId = process.env.FATSECRET_CLIENT_ID
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic'
  })
  
  const data = await res.json()
  return data.access_token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { q } = req.query
  if (!q || q.length < 2) return res.status(400).json({ foods: [] })

  try {
    const token = await getFatSecretToken()
    
    const searchRes = await fetch(
      `https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(q)}&format=json&max_results=20&language=it&region=IT`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    const data = await searchRes.json()
    const items = data?.foods?.food || []
    const list = Array.isArray(items) ? items : [items]
    
    const foods = list.map(f => {
      const desc = f.food_description || ''
      // Parse valori da description: "Per 100g - Calories: 352kcal | Fat: 2.00g | Carbs: 71.00g | Protein: 12.00g"
      const kcal = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] || 0)
      const fat = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] || 0)
      const carbs = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] || 0)
      const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] || 0)
      
      return {
        name: f.food_name,
        brand: f.brand_name || '—',
        kcal100: Math.round(kcal),
        p: Math.round(protein * 10) / 10,
        c: Math.round(carbs * 10) / 10,
        g: Math.round(fat * 10) / 10,
      }
    }).filter(f => f.kcal100 > 0)

    return res.status(200).json({ foods })
  } catch(e) {
    return res.status(500).json({ foods: [], error: e.message })
  }
}
