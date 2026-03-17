import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.env.HOME, '.openclaw/workspace/woozy.db')

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const holdingId = searchParams.get('holdingId')
  
  const db = new Database(DB_PATH, { readonly: true })
  try {
    let rows
    if (holdingId) {
      rows = db.prepare('SELECT * FROM price_history WHERE holding_id = ? ORDER BY date ASC').all(parseInt(holdingId))
    } else {
      rows = db.prepare('SELECT * FROM price_history ORDER BY holding_id, date ASC').all()
    }
    return Response.json({ history: rows })
  } finally {
    db.close()
  }
}
