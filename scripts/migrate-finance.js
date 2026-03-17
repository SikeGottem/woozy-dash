import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'

const dbPath = join(homedir(), '.openclaw', 'workspace', 'woozy.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// === 1. Create accounts table ===
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'AUD',
    institution TEXT,
    notes TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

// Populate if empty
const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c
if (accountCount === 0) {
  const insert = db.prepare('INSERT INTO accounts (name, type, balance, institution) VALUES (?, ?, ?, ?)')
  insert.run('Checking', 'cash', 9100, 'CommBank')
  insert.run('Savings', 'savings', 13000, 'CommBank')
  insert.run('Cash', 'cash', 800, null)
  insert.run('Investments', 'investment', 2500, 'SelfWealth')
  insert.run('Gold', 'physical', 2960, null)
  console.log('✓ Populated accounts')
} else {
  console.log('· Accounts already populated')
}

// === 2. Create net_worth_snapshots table ===
db.exec(`
  CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total REAL NOT NULL,
    liquid REAL,
    invested REAL,
    receivables REAL,
    breakdown TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

const today = new Date().toISOString().split('T')[0]
const existing = db.prepare('SELECT id FROM net_worth_snapshots WHERE date = ?').get(today)
if (!existing) {
  db.prepare(`INSERT INTO net_worth_snapshots (date, total, liquid, invested, receivables, breakdown) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(today, 31910, 22900, 5460, 3550, JSON.stringify({
      Checking: 9100, Savings: 13000, Cash: 800, Investments: 2500, Gold: 2960
    }))
  console.log('✓ Created initial net worth snapshot')
} else {
  console.log('· Snapshot for today already exists')
}

// === 3. Add columns to transactions ===
const txCols = db.pragma('table_info(transactions)').map(c => c.name)
const addCol = (name, def) => {
  if (!txCols.includes(name)) {
    db.exec(`ALTER TABLE transactions ADD COLUMN ${name} ${def}`)
    console.log(`✓ Added transactions.${name}`)
  }
}
addCol('account_id', 'INTEGER REFERENCES accounts(id)')
addCol('tags', 'TEXT')
addCol('receipt_path', 'TEXT')
addCol('recurring', 'INTEGER DEFAULT 0')
addCol('recurring_interval', 'TEXT')

// Link existing transactions to Checking account
const checkingId = db.prepare("SELECT id FROM accounts WHERE name = 'Checking'").get()?.id
if (checkingId) {
  db.prepare('UPDATE transactions SET account_id = ? WHERE account_id IS NULL').run(checkingId)
  console.log('✓ Linked existing transactions to Checking')
}

// === 4. Create budgets table ===
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    monthly_limit REAL NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

console.log('✓ Migration complete')
db.close()
