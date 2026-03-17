import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')

export async function POST() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey || secretKey === 'sk_test_placeholder') {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })
  }
  
  let db
  try {
    const stripe = new Stripe(secretKey)
    db = new Database(dbPath)
    
    // Fetch recent paid invoices (last 100)
    const invoices = await stripe.invoices.list({ status: 'paid', limit: 100 })
    
    let synced = 0
    let skipped = 0
    
    const defaultAccount = db.prepare("SELECT * FROM accounts WHERE name = 'Checking' LIMIT 1").get()
    
    for (const inv of invoices.data) {
      // Skip if already tracked
      const exists = db.prepare(
        "SELECT id FROM stripe_events WHERE stripe_event_id = ? OR stripe_event_id LIKE ?"
      ).get(`sync_${inv.id}`, `%${inv.id}%`)
      
      const existingTx = db.prepare(
        "SELECT id FROM transactions WHERE invoice_ref = ?"
      ).get(inv.id)
      
      if (exists || existingTx) { skipped++; continue }
      
      const amount = inv.amount_paid / 100
      if (amount <= 0) continue
      
      const description = inv.description || inv.lines?.data?.[0]?.description || `Invoice ${inv.number || inv.id}`
      const date = new Date(inv.status_transitions?.paid_at * 1000 || inv.created * 1000).toISOString().split('T')[0]
      
      // Try to match project
      let projectId = null
      const metadata = inv.metadata || {}
      if (metadata.project_id) {
        projectId = Number(metadata.project_id)
      } else {
        const customerName = inv.customer_name || inv.customer_email || ''
        if (customerName) {
          const project = db.prepare(
            "SELECT id FROM projects WHERE client_name LIKE ? ORDER BY updated_at DESC LIMIT 1"
          ).get(`%${customerName}%`)
          if (project) projectId = project.id
        }
      }
      
      const result = db.prepare(
        `INSERT INTO transactions (project_id, type, amount, description, date, category, status, invoice_ref, account_id)
         VALUES (?, 'income', ?, ?, ?, NULL, 'completed', ?, ?)`
      ).run(projectId, amount, description, date, inv.id, defaultAccount?.id || null)
      
      // Update project paid
      if (projectId) {
        db.prepare("UPDATE projects SET paid = COALESCE(paid, 0) + ?, updated_at = datetime('now') WHERE id = ?")
          .run(amount, projectId)
      }
      
      // Update account balance
      if (defaultAccount) {
        db.prepare("UPDATE accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?")
          .run(amount, defaultAccount.id)
      }
      
      // Log
      db.prepare(
        'INSERT INTO stripe_events (stripe_event_id, event_type, transaction_id, raw_data) VALUES (?, ?, ?, ?)'
      ).run(`sync_${inv.id}`, 'manual_sync', result.lastInsertRowid, JSON.stringify(inv))
      
      synced++
    }
    
    console.log(`[stripe-sync] Synced ${synced}, skipped ${skipped}`)
    return NextResponse.json({ synced, skipped, total: invoices.data.length })
  } catch (error) {
    console.error('[stripe-sync] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (db) db.close()
  }
}
