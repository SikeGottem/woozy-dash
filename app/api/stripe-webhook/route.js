import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')

function getDb() {
  return new Database(dbPath)
}

// Match a payment to a project by client name, description, or metadata
function matchProject(db, event) {
  const obj = event.data.object
  const metadata = obj.metadata || {}
  
  // Direct project_id in metadata
  if (metadata.project_id) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(metadata.project_id))
    if (project) return project
  }
  
  // Match by customer name or email
  const customerName = obj.customer_name || obj.customer_email || ''
  if (customerName) {
    const project = db.prepare(
      "SELECT * FROM projects WHERE client_name LIKE ? AND status IN ('active','on_hold') ORDER BY updated_at DESC LIMIT 1"
    ).get(`%${customerName}%`)
    if (project) return project
  }
  
  // Match by description keywords
  const desc = obj.description || obj.lines?.data?.[0]?.description || ''
  if (desc) {
    const projects = db.prepare("SELECT * FROM projects WHERE status IN ('active','on_hold')").all()
    for (const p of projects) {
      if (desc.toLowerCase().includes(p.name.toLowerCase()) || 
          (p.client_name && desc.toLowerCase().includes(p.client_name.toLowerCase()))) {
        return p
      }
    }
  }
  
  return null
}

// Determine category from context
function guessCategory(description, metadata) {
  const desc = (description || '').toLowerCase()
  if (metadata?.category) return metadata.category
  if (desc.includes('deposit')) return 'deposit'
  if (desc.includes('final')) return 'final'
  if (desc.includes('milestone')) return 'milestone'
  if (desc.includes('subscription') || desc.includes('recurring')) return 'subscription'
  return null
}

// Get default checking account
function getDefaultAccount(db) {
  return db.prepare("SELECT * FROM accounts WHERE name = 'Checking' LIMIT 1").get()
}

function handleCompletedPayment(db, event) {
  const obj = event.data.object
  const isInvoice = event.type.startsWith('invoice.')
  
  // Amount in cents → dollars
  const amount = (isInvoice ? obj.amount_paid : obj.amount) / 100
  if (!amount || amount <= 0) return null
  
  const description = obj.description || obj.lines?.data?.[0]?.description || `Stripe payment ${obj.id}`
  const metadata = obj.metadata || {}
  const date = new Date((obj.status_transitions?.paid_at || obj.created) * 1000).toISOString().split('T')[0]
  
  const project = matchProject(db, event)
  const category = guessCategory(description, metadata)
  const account = getDefaultAccount(db)
  
  // Check for existing pending transaction to mark as completed
  if (project) {
    const pending = db.prepare(
      "SELECT * FROM transactions WHERE project_id = ? AND type = 'income' AND status = 'pending' AND ABS(amount - ?) < 0.01 ORDER BY date ASC LIMIT 1"
    ).get(project.id, amount)
    
    if (pending) {
      db.prepare("UPDATE transactions SET status = 'completed', date = ?, invoice_ref = ? WHERE id = ?")
        .run(date, obj.id, pending.id)
      console.log(`[stripe] Updated pending tx #${pending.id} → completed`)
      
      // Update project paid amount
      db.prepare("UPDATE projects SET paid = COALESCE(paid, 0) + ?, updated_at = datetime('now') WHERE id = ?")
        .run(amount, project.id)
      
      // Update account balance
      if (account) {
        db.prepare("UPDATE accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?")
          .run(amount, account.id)
      }
      
      return pending.id
    }
  }
  
  // Insert new completed transaction
  const result = db.prepare(
    `INSERT INTO transactions (project_id, type, amount, description, date, category, status, invoice_ref, account_id)
     VALUES (?, 'income', ?, ?, ?, ?, 'completed', ?, ?)`
  ).run(
    project?.id || null, amount, description, date,
    category, obj.id, account?.id || null
  )
  
  console.log(`[stripe] Inserted completed tx #${result.lastInsertRowid}: ${description} — $${amount}`)
  
  // Update project paid amount
  if (project) {
    db.prepare("UPDATE projects SET paid = COALESCE(paid, 0) + ?, updated_at = datetime('now') WHERE id = ?")
      .run(amount, project.id)
  }
  
  // Update account balance
  if (account) {
    db.prepare("UPDATE accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?")
      .run(amount, account.id)
  }
  
  return result.lastInsertRowid
}

function handleInvoiceCreated(db, event) {
  const obj = event.data.object
  const amount = (obj.amount_due || obj.total) / 100
  if (!amount || amount <= 0) return null
  
  const description = obj.description || obj.lines?.data?.[0]?.description || `Invoice ${obj.number || obj.id}`
  const metadata = obj.metadata || {}
  const date = new Date(obj.created * 1000).toISOString().split('T')[0]
  const project = matchProject(db, event)
  const category = guessCategory(description, metadata)
  const account = getDefaultAccount(db)
  
  const result = db.prepare(
    `INSERT INTO transactions (project_id, type, amount, description, date, category, status, invoice_ref, account_id)
     VALUES (?, 'income', ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(project?.id || null, amount, description, date, category, obj.id, account?.id || null)
  
  console.log(`[stripe] Inserted pending tx #${result.lastInsertRowid}: ${description} — $${amount}`)
  return result.lastInsertRowid
}

function handleInvoiceOverdue(db, event) {
  const obj = event.data.object
  const updated = db.prepare(
    "UPDATE transactions SET status = 'overdue' WHERE invoice_ref = ? AND status = 'pending'"
  ).run(obj.id)
  
  console.log(`[stripe] Marked ${updated.changes} transactions overdue for invoice ${obj.id}`)
  return null
}

export async function POST(request) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  
  if (!webhookSecret || webhookSecret === 'whsec_placeholder') {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  
  // Get raw body for signature verification
  const rawBody = await request.text()
  
  let event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error(`[stripe] Signature verification failed: ${err.message}`)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  console.log(`[stripe] Received event: ${event.type} (${event.id})`)
  
  let db
  try {
    db = getDb()
    
    // Idempotency check
    const existing = db.prepare('SELECT id FROM stripe_events WHERE stripe_event_id = ?').get(event.id)
    if (existing) {
      console.log(`[stripe] Duplicate event ${event.id}, skipping`)
      return NextResponse.json({ received: true, duplicate: true })
    }
    
    let transactionId = null
    
    switch (event.type) {
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        transactionId = handleCompletedPayment(db, event)
        break
      case 'payment_intent.succeeded':
        transactionId = handleCompletedPayment(db, event)
        break
      case 'invoice.created':
        transactionId = handleInvoiceCreated(db, event)
        break
      case 'invoice.overdue':
        handleInvoiceOverdue(db, event)
        break
      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`)
    }
    
    // Log event for audit trail
    db.prepare(
      'INSERT INTO stripe_events (stripe_event_id, event_type, transaction_id, raw_data) VALUES (?, ?, ?, ?)'
    ).run(event.id, event.type, transactionId, rawBody)
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe] Processing error:', error)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  } finally {
    if (db) db.close()
  }
}
