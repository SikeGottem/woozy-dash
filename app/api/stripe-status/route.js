import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')

export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const hasKey = secretKey && secretKey !== 'sk_test_placeholder'
  
  let connected = false
  if (hasKey) {
    try {
      const stripe = new Stripe(secretKey)
      await stripe.balance.retrieve()
      connected = true
    } catch { /* invalid key */ }
  }
  
  let lastWebhook = null
  let syncCount = 0
  
  try {
    const db = new Database(dbPath, { readonly: true })
    const last = db.prepare('SELECT processed_at FROM stripe_events ORDER BY id DESC LIMIT 1').get()
    lastWebhook = last?.processed_at || null
    const count = db.prepare('SELECT COUNT(*) as n FROM stripe_events WHERE transaction_id IS NOT NULL').get()
    syncCount = count?.n || 0
    db.close()
  } catch { /* table may not exist yet */ }
  
  return NextResponse.json({
    configured: hasKey,
    connected,
    lastWebhook,
    syncCount,
  })
}
