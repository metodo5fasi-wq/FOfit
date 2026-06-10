export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { q } = req.query
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query troppo corta' })

  try {
    // Cerca su Open Food Facts con filtro italiano
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&lc=it&cc=it&fields=product_name,brands,nutriments,serving_size,quantity`
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'FOfit-App/1.0' }
    })
    
    const data = await response.json()
    
    const foods = (data.products || [])
      .filter(p => p.product_name && p.nutriments)
      .map(p => ({
        name: p.product_name || 'Prodotto sconosciuto',
        brand: p.brands ? p.brands.split(',')[0].trim() : '—',
        kcal100: Math.round(p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'] || 0),
        p: Math.round((p.nutriments['proteins_100g'] || 0) * 10) / 10,
        c: Math.round((p.nutriments['carbohydrates_100g'] || 0) * 10) / 10,
        g: Math.round((p.nutriments['fat_100g'] || 0) * 10) / 10,
      }))
      .filter(f => f.kcal100 > 0)
      .slice(0, 15)

    return res.status(200).json({ foods })
  } catch(e) {
    return res.status(500).json({ error: e.message, foods: [] })
  }
}
