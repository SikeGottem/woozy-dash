#!/usr/bin/env node
// Initialize the woozy.db with all required tables — idempotent
import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'

const dbPath = process.env.WOOZY_DB_PATH || join(homedir(), '.openclaw', 'workspace', 'woozy.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('> Initializing database...')

// === Core tables ===

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'personal',
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT '📁',
    status TEXT DEFAULT 'active',
    client_name TEXT,
    total_value REAL,
    paid REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    section TEXT DEFAULT 'this_week',
    category TEXT DEFAULT 'personal',
    project_id INTEGER REFERENCES projects(id),
    due_date TEXT,
    due_time TEXT,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    energy_required TEXT DEFAULT 'medium',
    parent_id INTEGER REFERENCES tasks(id),
    blocked_reason TEXT,
    context TEXT,
    completed_by TEXT,
    sort_order INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    minutes INTEGER,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_logs_date ON task_logs(created_at);

  CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(task_id, dependency_task_id)
  );
  CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_deps_dep ON task_dependencies(dependency_task_id);

  CREATE TABLE IF NOT EXISTS deadlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    due_date TEXT,
    weight REAL,
    status TEXT DEFAULT 'pending',
    grade TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id),
    account_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    description TEXT,
    date TEXT,
    category TEXT,
    status TEXT DEFAULT 'completed',
    invoice_ref TEXT,
    tags TEXT,
    receipt_path TEXT,
    recurring INTEGER DEFAULT 0,
    recurring_interval TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'AUD',
    institution TEXT,
    notes TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total REAL NOT NULL,
    liquid REAL,
    invested REAL,
    receivables REAL,
    breakdown TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    monthly_limit REAL NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    energy_level INTEGER,
    main_focus TEXT,
    deep_work_hours REAL,
    screen_time_hours REAL,
    gym INTEGER DEFAULT 0,
    mood TEXT,
    wins TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '✅',
    color TEXT DEFAULT '#3b82f6',
    target_frequency TEXT DEFAULT 'daily',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL REFERENCES habits(id),
    date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(habit_id, date)
  );
`)

console.log('> All tables created.')

// Seed some default data if empty
const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c
if (projectCount === 0) {
  const insert = db.prepare('INSERT INTO projects (id, name, type, color, icon, status) VALUES (?, ?, ?, ?, ?, ?)')
  insert.run(1, 'Headland', 'freelance', '#f59e0b', '🏔️', 'active')
  insert.run(2, 'Bristlecone', 'freelance', '#10b981', '🌲', 'active')
  insert.run(3, 'S17', 'product', '#8b5cf6', '🚀', 'active')
  console.log('> Seeded default projects')
}

const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c
if (accountCount === 0) {
  const insert = db.prepare('INSERT INTO accounts (name, type, balance, institution) VALUES (?, ?, ?, ?)')
  insert.run('Checking', 'cash', 9100, 'CommBank')
  insert.run('Savings', 'savings', 13000, 'CommBank')
  insert.run('Cash', 'cash', 800, null)
  insert.run('Investments', 'investment', 2500, 'SelfWealth')
  insert.run('Gold', 'physical', 2960, null)
  console.log('> Seeded default accounts')
}

console.log('> Database initialization complete.')
db.close()
