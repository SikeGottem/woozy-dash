const Database = require('better-sqlite3')
import fs from 'fs'
import path from 'path'

const DB_PATH = '/Users/ethanwu/.openclaw/workspace/woozy.db'
const TASKS_MD_PATH = '/Users/ethanwu/Desktop/WOOZY/TASKS.md'

function computeUrgency(dueDate) {
  if (!dueDate) return 'later'
  const now = new Date()
  const due = new Date(dueDate + 'T00:00:00')
  const diffMs = due - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 7) return 'this_week'
  return 'later'
}

function getProjectColor(projectId) {
  const colors = {
    1: '#3b82f6', // Headland
    2: '#10b981', // Bristlecone
    3: '#8b5cf6', // Personal
    4: '#f59e0b'  // Other
  }
  return colors[projectId] || '#666'
}

function getProjectName(projectId) {
  const names = {
    1: 'Headland',
    2: 'Bristlecone', 
    3: 'Personal',
    4: 'Other'
  }
  return names[projectId] || null
}

function getTodayTasksFromDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('Database not found, falling back to TASKS.md')
      return null
    }
    
    const db = new Database(DB_PATH)
    
    const query = `
      SELECT * FROM tasks 
      WHERE status != 'done' 
      AND (due_date IS NULL OR due_date <= date('now', '+3 days'))
      ORDER BY 
        CASE 
          WHEN is_focus = 1 THEN 0 
          WHEN due_date < date('now') THEN 1 
          ELSE 2 
        END,
        due_date ASC,
        CASE 
          WHEN priority = 'critical' THEN 0
          WHEN priority = 'high' THEN 1
          WHEN priority = 'medium' THEN 2
          WHEN priority = 'low' THEN 3
          ELSE 2
        END ASC
      LIMIT 8
    `
    
    const tasks = db.prepare(query).all()
    
    db.close()
    
    return tasks.map(task => ({
      ...task,
      urgency: computeUrgency(task.due_date),
      project_name: getProjectName(task.project_id),
      project_color: getProjectColor(task.project_id),
      is_blocked: false // TODO: implement dependency checking
    }))
    
  } catch (error) {
    console.error('Database error:', error)
    return null
  }
}

function getTodayTasksFromMarkdown() {
  try {
    if (!fs.existsSync(TASKS_MD_PATH)) {
      return []
    }
    
    const content = fs.readFileSync(TASKS_MD_PATH, 'utf8')
    const lines = content.split('\n')
    
    let inThisWeekSection = false
    const tasks = []
    let id = 1
    
    for (const line of lines) {
      if (line.includes('🔥 This Week')) {
        inThisWeekSection = true
        continue
      }
      
      if (inThisWeekSection && line.startsWith('#')) {
        // New section, stop parsing
        break
      }
      
      if (inThisWeekSection && line.match(/^- \[ \]/)) {
        // Parse task line
        const taskText = line.replace(/^- \[ \]\s*/, '').trim()
        
        if (taskText) {
          const task = {
            id: id++,
            title: taskText,
            status: 'todo',
            priority: 'medium',
            urgency: 'this_week',
            project_name: null,
            project_color: null,
            due_date: null,
            is_focus: false,
            is_blocked: false
          }
          
          // Extract priority from text
          if (taskText.includes('🔴')) {
            task.priority = 'high'
            task.urgency = 'today'
          }
          
          tasks.push(task)
        }
      }
    }
    
    return tasks.slice(0, 8)
    
  } catch (error) {
    console.error('Error reading TASKS.md:', error)
    return []
  }
}

export async function GET() {
  try {
    // Try database first, fallback to TASKS.md
    let tasks = getTodayTasksFromDb()
    
    if (!tasks || tasks.length === 0) {
      tasks = getTodayTasksFromMarkdown()
    }
    
    // Find focus task
    const focusTask = tasks.find(t => t.is_focus) || tasks[0] || null
    const remainingTasks = tasks.filter(t => t.id !== focusTask?.id).slice(0, 4)
    
    return Response.json({
      focusTask,
      tasks: remainingTasks,
      total: tasks.length
    })
    
  } catch (error) {
    console.error('Today tasks API error:', error)
    return Response.json({
      focusTask: null,
      tasks: [],
      total: 0
    })
  }
}

export async function POST(request) {
  try {
    const { action, taskId, status, title } = await request.json()
    
    if (action === 'complete' && taskId) {
      // Mark task as done in database
      try {
        const db = new Database(DB_PATH)
        const updateStmt = db.prepare(`
          UPDATE tasks 
          SET status = 'done', completed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `)
        updateStmt.run(taskId)
        db.close()
        
        return Response.json({ success: true })
      } catch (error) {
        console.error('Database update error:', error)
        return Response.json({ error: 'Failed to update task' }, { status: 500 })
      }
    }
    
    if (action === 'set_focus' && taskId) {
      // Set task as focus
      try {
        const db = new Database(DB_PATH)
        // Clear all focus flags first
        db.prepare('UPDATE tasks SET is_focus = 0').run()
        // Set new focus task
        db.prepare('UPDATE tasks SET is_focus = 1 WHERE id = ?').run(taskId)
        db.close()
        
        return Response.json({ success: true })
      } catch (error) {
        console.error('Database update error:', error)
        return Response.json({ error: 'Failed to set focus' }, { status: 500 })
      }
    }
    
    if (action === 'add' && title) {
      // Quick add new task
      try {
        const db = new Database(DB_PATH)
        const insertStmt = db.prepare(`
          INSERT INTO tasks (title, status, priority, section, created_at, updated_at)
          VALUES (?, 'todo', 'medium', 'this_week', datetime('now'), datetime('now'))
        `)
        const result = insertStmt.run(title)
        db.close()
        
        // Also write to TASKS.md
        try {
          const content = fs.readFileSync(TASKS_MD_PATH, 'utf8')
          const lines = content.split('\n')
          let insertIndex = -1
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('🔥 This Week')) {
              // Find first empty line after the header
              for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() === '' || lines[j].startsWith('#')) {
                  insertIndex = j
                  break
                }
              }
              break
            }
          }
          
          if (insertIndex > -1) {
            lines.splice(insertIndex, 0, `- [ ] ${title}`)
            fs.writeFileSync(TASKS_MD_PATH, lines.join('\n'))
          }
        } catch (mdError) {
          console.error('Error updating TASKS.md:', mdError)
        }
        
        return Response.json({ 
          success: true, 
          id: result.lastInsertRowid,
          task: {
            id: result.lastInsertRowid,
            title,
            status: 'todo',
            priority: 'medium',
            urgency: 'this_week',
            project_name: null,
            project_color: null,
            due_date: null,
            is_focus: false,
            is_blocked: false
          }
        })
      } catch (error) {
        console.error('Database insert error:', error)
        return Response.json({ error: 'Failed to add task' }, { status: 500 })
      }
    }
    
    return Response.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('Today tasks API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}