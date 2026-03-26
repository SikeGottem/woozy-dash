import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { join } from 'path'
import { readFileSync } from 'fs'
import { homedir } from 'os'

const dbPath = process.env.WOOZY_DB_PATH || join(homedir(), '.openclaw', 'workspace', 'woozy.db')
const TASKS_MD = join(homedir(), 'Desktop', 'WOOZY', 'TASKS.md')

// Project name → DB project mapping
const PROJECT_MAP = {
  'COMM0999': { id: 7, category: 'uni' },
  'COMM1100': { id: 4, category: 'uni' },
  'CODE1110': { id: 5, category: 'uni' },
  'FADA1010': { id: 6, category: 'uni' },
  'Headland': { id: 1, category: 'work' },
  'Bristlecone': { id: 2, category: 'work' },
  'S17': { id: 3, category: 'work' },
}

function detectProject(title) {
  for (const [key, val] of Object.entries(PROJECT_MAP)) {
    if (title.includes(key)) return val
  }
  if (title.match(/Bupa|Opal|OpenClaw|portfolio/i)) return { id: null, category: 'personal' }
  return { id: null, category: 'personal' }
}

function parseDueDate(text) {
  // Match patterns like "due Fri Mar 21", "due mid-April", "Mar 22"
  const match = text.match(/(?:due\s+)?(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i)
  if (match) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    const m = months[match[1]]
    const d = match[2].padStart(2, '0')
    return `2026-${m}-${d}`
  }
  return null
}

function parseSection(text, dueDate) {
  if (text.includes('this week') || text.includes('this_week')) return 'this_week'
  if (text.includes('today') || text.includes('NOW')) return 'today'
  if (dueDate) {
    const now = new Date()
    const due = new Date(dueDate)
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return 'today'
    if (diffDays <= 7) return 'this_week'
    return 'upcoming'
  }
  return 'upcoming'
}

function parseTasksMd(content) {
  const tasks = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    // Match task lines: - [ ] or - [x]
    const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/)
    if (!match) continue
    
    const done = match[1].toLowerCase() === 'x'
    const rawTitle = match[2].trim()
    
    // Clean title: remove bold markers, due date annotations
    let title = rawTitle
      .replace(/\*\*/g, '')
      .replace(/\s*—\s*(?:due\s+)?(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*\(.*?\))?/gi, '')
      .replace(/\s*—\s*this week/gi, '')
      .replace(/\s*←\s*NOW/g, '')
      .replace(/\s*—\s*final deliverable.*$/i, '')
      .trim()
    
    const dueDate = parseDueDate(rawTitle)
    const project = detectProject(title)
    const section = done ? 'this_week' : parseSection(rawTitle, dueDate)
    
    // Determine priority
    let priority = 'medium'
    if (rawTitle.includes('NOW') || rawTitle.includes('CRITICAL')) priority = 'high'
    if (done) priority = 'medium'
    
    tasks.push({
      title,
      status: done ? 'done' : 'todo',
      priority,
      section,
      category: project.category,
      project_id: project.id,
      due_date: dueDate,
    })
  }
  
  return tasks
}

export async function POST(request) {
  let db
  try {
    // Read TASKS.md
    let content
    try {
      content = readFileSync(TASKS_MD, 'utf-8')
    } catch (e) {
      return NextResponse.json({ error: 'Could not read TASKS.md', detail: e.message }, { status: 500 })
    }
    
    const mdTasks = parseTasksMd(content)
    db = new Database(dbPath)
    
    const existingTasks = db.prepare('SELECT id, title, status FROM tasks').all()
    const existingTitles = new Set(existingTasks.map(t => t.title.toLowerCase()))
    
    const now = new Date().toISOString()
    const insert = db.prepare(`
      INSERT INTO tasks (title, status, priority, section, category, project_id, due_date, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    let added = 0
    let skipped = 0
    const addedTasks = []
    
    db.transaction(() => {
      for (const task of mdTasks) {
        // Skip if already exists (fuzzy match on title)
        const normalised = task.title.toLowerCase().replace(/[^a-z0-9]/g, '')
        const exists = existingTasks.some(et => {
          const etNorm = et.title.toLowerCase().replace(/[^a-z0-9]/g, '')
          return etNorm === normalised || etNorm.includes(normalised) || normalised.includes(etNorm)
        })
        
        if (exists) {
          skipped++
          continue
        }
        
        insert.run(
          task.title,
          task.status,
          task.priority,
          task.section,
          task.category,
          task.project_id,
          task.due_date,
          now, now,
          task.status === 'done' ? now : null
        )
        added++
        addedTasks.push(task.title)
      }
    })()
    
    return NextResponse.json({
      success: true,
      parsed: mdTasks.length,
      added,
      skipped,
      addedTasks,
      existingCount: existingTasks.length,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (db) db.close()
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/tasks/sync',
    method: 'POST to sync TASKS.md → DB',
    description: 'Parses ~/Desktop/WOOZY/TASKS.md and adds missing tasks to the database'
  })
}
