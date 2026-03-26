import Database from 'better-sqlite3'
import path from 'path'
import crypto from 'crypto'

const DB_PATH = path.join(process.cwd(), 'woozy.db')

let _db = null

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    initSchema(_db)
  }
  return _db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      type TEXT DEFAULT 'project',
      system_prompt TEXT,
      memory_path TEXT NOT NULL,
      project_path TEXT,
      avatar_emoji TEXT DEFAULT '🤖',
      created_at INTEGER NOT NULL,
      total_runs INTEGER DEFAULT 0,
      successful_runs INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      avg_duration INTEGER DEFAULT 0,
      last_run_at INTEGER,
      last_run_summary TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS employee_runs (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      task TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'running',
      tokens_used INTEGER,
      cost REAL,
      duration INTEGER,
      summary TEXT,
      learnings TEXT,
      session_key TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS promotion_candidates (
      category TEXT PRIMARY KEY,
      run_count INTEGER DEFAULT 0,
      last_run_at INTEGER,
      promoted INTEGER DEFAULT 0
    );
  `)

  // Migration: add type and project_path columns if missing
  try {
    db.prepare("SELECT type FROM employees LIMIT 1").get()
  } catch {
    db.exec("ALTER TABLE employees ADD COLUMN type TEXT DEFAULT 'project'")
  }
  try {
    db.prepare("SELECT project_path FROM employees LIMIT 1").get()
  } catch {
    db.exec("ALTER TABLE employees ADD COLUMN project_path TEXT")
  }
}

function uid() {
  return crypto.randomUUID()
}

// ── Employee CRUD ──

export function listEmployees() {
  const db = getDb()
  return db.prepare('SELECT * FROM employees WHERE status != ? ORDER BY total_runs DESC').all('retired')
}

export function getEmployee(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id)
}

export function createEmployee({ name, specialty, type, system_prompt, memory_path, project_path, avatar_emoji }) {
  const db = getDb()
  const id = uid()
  const now = Date.now()
  db.prepare(`
    INSERT INTO employees (id, name, specialty, type, system_prompt, memory_path, project_path, avatar_emoji, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, specialty, type || 'project', system_prompt || '', memory_path, project_path || null, avatar_emoji || '🤖', now)
  return { id, name, specialty, type: type || 'project', system_prompt, memory_path, project_path, avatar_emoji, created_at: now, status: 'active' }
}

export function updateEmployee(id, fields) {
  const db = getDb()
  const allowed = ['name', 'specialty', 'type', 'system_prompt', 'avatar_emoji', 'status', 'project_path']
  const sets = []
  const vals = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`)
      vals.push(v)
    }
  }
  if (sets.length === 0) return null
  vals.push(id)
  db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getEmployee(id)
}

export function retireEmployee(id) {
  const db = getDb()
  db.prepare('UPDATE employees SET status = ? WHERE id = ?').run('retired', id)
  return { success: true }
}

// ── Run Logging ──

export function logRun({ employee_id, task, summary, learnings, tokens_used, cost, duration, session_key }) {
  const db = getDb()
  const id = uid()
  const now = Date.now()
  const status = 'completed'

  db.prepare(`
    INSERT INTO employee_runs (id, employee_id, task, started_at, completed_at, status, tokens_used, cost, duration, summary, learnings, session_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, employee_id, task, now - (duration || 0) * 1000, now, status, tokens_used || 0, cost || 0, duration || 0, summary || '', learnings || '', session_key || '')

  // Update employee stats
  const emp = getEmployee(employee_id)
  if (emp) {
    const newTotal = (emp.total_runs || 0) + 1
    const newSuccess = (emp.successful_runs || 0) + 1
    const newTokens = (emp.total_tokens || 0) + (tokens_used || 0)
    const newCost = (emp.total_cost || 0) + (cost || 0)
    const totalDuration = (emp.avg_duration || 0) * (emp.total_runs || 0) + (duration || 0)
    const newAvg = Math.round(totalDuration / newTotal)

    db.prepare(`
      UPDATE employees SET
        total_runs = ?, successful_runs = ?, total_tokens = ?, total_cost = ?,
        avg_duration = ?, last_run_at = ?, last_run_summary = ?
      WHERE id = ?
    `).run(newTotal, newSuccess, newTokens, newCost, newAvg, now, summary || '', employee_id)
  }

  return { id, employee_id, task, status }
}

export function getEmployeeRuns(employee_id, limit = 20) {
  const db = getDb()
  return db.prepare('SELECT * FROM employee_runs WHERE employee_id = ? ORDER BY started_at DESC LIMIT ?').all(employee_id, limit)
}

// ── Promotion Candidates ──

export function checkPromotion(category) {
  const db = getDb()
  const now = Date.now()
  const existing = db.prepare('SELECT * FROM promotion_candidates WHERE category = ?').get(category)

  if (existing) {
    if (existing.promoted) return { category, run_count: existing.run_count, promoted: true, ready: false }
    const newCount = existing.run_count + 1
    db.prepare('UPDATE promotion_candidates SET run_count = ?, last_run_at = ? WHERE category = ?').run(newCount, now, category)
    return { category, run_count: newCount, promoted: false, ready: newCount >= 3 }
  }

  db.prepare('INSERT INTO promotion_candidates (category, run_count, last_run_at) VALUES (?, 1, ?)').run(category, now)
  return { category, run_count: 1, promoted: false, ready: false }
}

export function promoteCandidate(category) {
  const db = getDb()
  db.prepare('UPDATE promotion_candidates SET promoted = 1 WHERE category = ?').run(category)
  return { success: true }
}

export function getPromotionCandidates() {
  const db = getDb()
  return db.prepare('SELECT * FROM promotion_candidates WHERE promoted = 0 AND run_count >= 3').all()
}
