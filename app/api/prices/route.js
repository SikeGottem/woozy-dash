import { fetchPrices } from '../../lib/prices.js'
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.env.HOME, '.openclaw/workspace/woozy.db')

function updateHoldings(prices) {
  const db = new Database(DB_PATH)
  const now = new Date().toISOString()
  
  const holdings = db.prepare('SELECT * FROM holdings').all()
  const updated = []
  
  for (const h of holdings) {
    let price = h.current_price
    
    // Dynamic price resolution
    if (h.type === 'etf' && prices.prices?.[h.name]) {
      price = prices.prices[h.name]
    } else if (h.type === 'commodity' && h.name === 'Gold' && prices.goldPerGram) {
      price = prices.goldPerGram
    }
    
    const value = Math.round(h.quantity * price * 100) / 100
    
    db.prepare(`
      UPDATE holdings SET current_price = ?, current_value = ?, price_updated_at = ?, updated_at = ?
      WHERE id = ?
    `).run(price, value, now, now, h.id)
    
    const today = new Date().toISOString().split('T')[0]
    db.prepare(`
      INSERT OR REPLACE INTO price_history (holding_id, price, value, date)
      VALUES (?, ?, ?, ?)
    `).run(h.id, price, value, today)
    
    updated.push({
      ...h,
      current_price: price,
      current_value: value,
      price_updated_at: now,
      gain: Math.round((value - h.cost_basis) * 100) / 100,
      gainPct: h.cost_basis > 0 ? Math.round(((value - h.cost_basis) / h.cost_basis) * 10000) / 100 : 0
    })
  }
  
  db.close()
  return updated
}

export async function GET() {
  try {
    const prices = await fetchPrices(false)
    const holdings = updateHoldings(prices)
    const totalValue = holdings.reduce((s, h) => s + h.current_value, 0)
    
    return Response.json({
      holdings,
      lastUpdated: new Date(prices.fetchedAt).toISOString(),
      fromCache: prices.fromCache,
      errors: prices.errors,
      totalInvestmentValue: Math.round(totalValue * 100) / 100
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const prices = await fetchPrices(true)
    const holdings = updateHoldings(prices)
    const totalValue = holdings.reduce((s, h) => s + h.current_value, 0)
    
    return Response.json({
      holdings,
      lastUpdated: new Date(prices.fetchedAt).toISOString(),
      fromCache: false,
      errors: prices.errors,
      totalInvestmentValue: Math.round(totalValue * 100) / 100
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
