import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')

export async function GET() {
  let db
  try {
    db = new Database(dbPath, { readonly: true })

    const accounts = db.prepare('SELECT * FROM accounts ORDER BY id').all()
    const holdings = db.prepare('SELECT * FROM holdings').all()
    const transactions = db.prepare(`
      SELECT tr.*, p.name as project_name, a.name as account_name
      FROM transactions tr
      LEFT JOIN projects p ON tr.project_id = p.id
      LEFT JOIN accounts a ON tr.account_id = a.id
      ORDER BY tr.date DESC
    `).all()
    const netWorthHistory = db.prepare('SELECT * FROM net_worth_snapshots ORDER BY date ASC').all()
    const priceHistory = db.prepare('SELECT * FROM price_history ORDER BY holding_id, date ASC').all()
    
    let goals = []
    try { goals = db.prepare('SELECT * FROM financial_goals ORDER BY id').all() } catch {}

    const freelanceProjects = db.prepare(`
      SELECT p.*,
        COALESCE(SUM(CASE WHEN tr.type = 'income' AND tr.status = 'completed' THEN tr.amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN tr.type = 'income' AND tr.status = 'pending' THEN tr.amount ELSE 0 END), 0) as total_pending
      FROM projects p
      LEFT JOIN transactions tr ON p.id = tr.project_id
      WHERE p.type = 'freelance'
      GROUP BY p.id
      ORDER BY CASE p.status WHEN 'active' THEN 0 ELSE 1 END, p.updated_at DESC
    `).all()

    // Calculate summaries
    const byName = {}
    for (const a of accounts) byName[a.name] = a.balance
    const liquid = (byName['Checking'] || 0) + (byName['Savings'] || 0) + (byName['Cash'] || 0)
    const receivables = transactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((s, t) => s + t.amount, 0)

    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthlyIncome = transactions
      .filter(t => t.type === 'income' && t.status === 'completed' && t.date?.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0)
    const monthlyExpenses = transactions
      .filter(t => t.type === 'expense' && t.status === 'completed' && t.date?.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0)

    const holdingsEnriched = holdings.map(h => ({
      ...h,
      gain: h.current_value && h.cost_basis ? Math.round((h.current_value - h.cost_basis) * 100) / 100 : 0,
      gainPct: h.current_value && h.cost_basis > 0 ? Math.round(((h.current_value - h.cost_basis) / h.cost_basis) * 10000) / 100 : 0
    }))

    const totalInvestmentValue = holdingsEnriched.reduce((s, h) => s + (h.current_value || 0), 0)
    const netWorth = liquid + totalInvestmentValue + receivables

    // Price history by holding
    const priceHistoryByHolding = {}
    for (const row of priceHistory) {
      if (!priceHistoryByHolding[row.holding_id]) priceHistoryByHolding[row.holding_id] = []
      priceHistoryByHolding[row.holding_id].push(row)
    }

    return NextResponse.json({
      accounts,
      holdings: holdingsEnriched,
      transactions: transactions.map(tr => ({
        ...tr,
        project_name: tr.project_name,
        account_name: tr.account_name,
      })),
      netWorthHistory: netWorthHistory.map(s => ({ ...s, breakdown: s.breakdown ? JSON.parse(s.breakdown) : null })),
      priceHistory: priceHistoryByHolding,
      goals,
      freelanceProjects: freelanceProjects.map(p => ({
        id: p.id, name: p.name, client_name: p.client_name, status: p.status,
        total_value: p.total_value, total_paid: p.total_paid, total_pending: p.total_pending,
      })),
      summary: {
        netWorth, liquid, invested: totalInvestmentValue, receivables,
        monthlyIncome, monthlyExpenses,
        monthName: now.toLocaleString('en-AU', { month: 'long' }),
        year: now.getFullYear(),
      },
      updated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Finance API error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  } finally {
    if (db) db.close()
  }
}
