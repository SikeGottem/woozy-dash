#!/usr/bin/env node
// Task system migration — idempotent, safe to run multiple times
import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'

const dbPath = process.env.WOOZY_DB_PATH || join(homedir(), '.openclaw', 'workspace', 'woozy.db')
const db = new Database(dbPath)

function columnExists(table, column) {
  const cols = db.pragma(`table_info(${table})`)
  return cols.some(c => c.name === column)
}

function tableExists(name) {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name)
}

console.log('> Task system migration starting...')

// 1. ALTER tasks table — add new columns
const newCols = [
  ['category', "TEXT"],
  ['energy_required', "TEXT DEFAULT 'medium'"],
  ['parent_id', "INTEGER REFERENCES tasks(id)"],
  ['blocked_reason', "TEXT"],
  ['actual_minutes', "INTEGER"],
  ['context', "TEXT"],
  ['completed_by', "TEXT"],
]

for (const [col, def] of newCols) {
  if (!columnExists('tasks', col)) {
    db.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`)
    console.log(`  + tasks.${col}`)
  } else {
    console.log(`  ✓ tasks.${col} exists`)
  }
}

// 2. Create task_logs table
if (!tableExists('task_logs')) {
  db.exec(`
    CREATE TABLE task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      minutes INTEGER,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_task_logs_task ON task_logs(task_id);
    CREATE INDEX idx_task_logs_date ON task_logs(created_at);
  `)
  console.log('  + task_logs table created')
} else {
  console.log('  ✓ task_logs exists')
}

// 3. Populate category from project type
const categoryMap = { uni: 'uni', freelance: 'work', product: 'work', personal: 'personal' }

const tasksWithProjects = db.prepare(`
  SELECT t.id, t.title, t.category, p.type as project_type
  FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
`).all()

const updateCategory = db.prepare(`UPDATE tasks SET category = ? WHERE id = ?`)
const updateEnergy = db.prepare(`UPDATE tasks SET energy_required = ? WHERE id = ?`)

db.transaction(() => {
  for (const t of tasksWithProjects) {
    // Category
    if (!t.category) {
      let cat = 'personal'
      if (t.project_type) {
        cat = categoryMap[t.project_type] || 'personal'
      } else {
        const title = (t.title || '').toLowerCase()
        if (title.match(/comm|code|fada|quiz|lecture|tutorial|moodle|assignment/)) cat = 'uni'
        else if (title.match(/headland|bristlecone|s17|client|invoice/)) cat = 'work'
      }
      updateCategory.run(cat, t.id)
    }

    // Energy
    const title = (t.title || '').toLowerCase()
    let energy = 'medium'
    if (title.match(/quiz|submit|download|set up|get /)) energy = 'low'
    else if (title.match(/audit|analysis|strategy|develop|assessment|design|presentation|persona|positioning/)) energy = 'high'
    updateEnergy.run(energy, t.id)
  }
})()

console.log('  ✓ category + energy_required populated')

// 4. Break down big tasks into subtasks
function createSubtask(parentId, title, minutes, priority, extraFields = {}) {
  const existing = db.prepare(`SELECT id FROM tasks WHERE parent_id = ? AND title = ?`).get(parentId, title)
  if (existing) return
  db.prepare(`
    INSERT INTO tasks (title, project_id, status, priority, estimated_minutes, parent_id, category, energy_required, section, sort_order)
    SELECT ?, project_id, 'todo', ?, ?, ?, category, ?, section, sort_order + 1
    FROM tasks WHERE id = ?
  `).run(title, priority, minutes, parentId, extraFields.energy || 'medium', parentId)
}

// Find "Competitive audit — 5-10 childcare centres" (id 6, 120min)
const auditTask = db.prepare(`SELECT id FROM tasks WHERE title LIKE '%Competitive audit%'`).get()
if (auditTask) {
  createSubtask(auditTask.id, 'Research 5 childcare centres', 40, 'medium', { energy: 'medium' })
  createSubtask(auditTask.id, 'Compare positioning & pricing', 40, 'medium', { energy: 'high' })
  createSubtask(auditTask.id, 'Write audit summary', 40, 'medium', { energy: 'high' })
  console.log('  ✓ Competitive audit subtasks created')
}

// "Present brand strategy deck" (id 8, 90min) 
const deckTask = db.prepare(`SELECT id FROM tasks WHERE title LIKE '%Present brand strategy%'`).get()
if (deckTask) {
  createSubtask(deckTask.id, 'Draft strategy deck slides', 45, 'medium', { energy: 'high' })
  createSubtask(deckTask.id, 'Rehearse presentation', 20, 'medium', { energy: 'medium' })
  createSubtask(deckTask.id, 'Send deck to Beau for review', 10, 'low', { energy: 'low' })
  console.log('  ✓ Brand strategy subtasks created')
}

// 5. Seed task_logs for existing done tasks
const doneTasks = db.prepare(`SELECT id, completed_at, created_at FROM tasks WHERE status = 'done'`).all()
const existingLogs = db.prepare(`SELECT task_id FROM task_logs WHERE action = 'completed'`).all()
const loggedIds = new Set(existingLogs.map(l => l.task_id))

const insertLog = db.prepare(`INSERT INTO task_logs (task_id, action, to_status, created_at) VALUES (?, ?, ?, ?)`)
db.transaction(() => {
  for (const t of doneTasks) {
    if (!loggedIds.has(t.id)) {
      insertLog.run(t.id, 'completed', 'done', t.completed_at || t.created_at)
    }
  }
})()

console.log('  ✓ task_logs seeded for completed tasks')
console.log('> Migration complete.')
db.close()
