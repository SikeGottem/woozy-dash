import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')

export async function POST(request) {
  let db
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'complete') {
      const { task, taskId } = body
      db = new Database(dbPath)
      const now = new Date().toISOString()

      let result
      if (taskId) {
        result = db.prepare(
          `UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?`
        ).run(now, now, taskId)
      } else if (task) {
        result = db.prepare(
          `UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE title = ? AND status != 'done'`
        ).run(now, now, task)
      }

      if (!result || result.changes === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, changes: result.changes })
    }

    if (action === 'add') {
      const { title, section, project_id, due_date, due_time, priority, category, parent_id } = body
      if (!title?.trim()) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 })
      }
      db = new Database(dbPath)
      const now = new Date().toISOString()

      // If parent_id provided, inherit project/category from parent
      let effectiveProjectId = project_id || null
      let effectiveCategory = category || 'personal'
      if (parent_id) {
        const parent = db.prepare('SELECT project_id, category FROM tasks WHERE id = ?').get(parent_id)
        if (parent) {
          if (!project_id) effectiveProjectId = parent.project_id
          if (!category) effectiveCategory = parent.category
        }
      }

      const result = db.prepare(
        `INSERT INTO tasks (title, status, priority, section, category, project_id, due_date, due_time, parent_id, created_at, updated_at) VALUES (?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        title.trim(),
        priority || 'medium',
        section || 'this_week',
        effectiveCategory,
        effectiveProjectId,
        due_date || null,
        due_time || null,
        parent_id || null,
        now, now
      )

      const inserted = db.prepare(`
        SELECT t.*, p.name as project_name, p.color as project_color, p.icon as project_icon
        FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?
      `).get(result.lastInsertRowid)

      return NextResponse.json({ success: true, id: result.lastInsertRowid, task: inserted })
    }

    if (action === 'update_due_date') {
      const { taskId, due_date } = body
      if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
      db = new Database(dbPath)
      const now = new Date().toISOString()
      db.prepare('UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?').run(due_date || null, now, taskId)
      return NextResponse.json({ success: true })
    }

    if (action === 'add_dependency') {
      const { taskId, dependencyTaskId } = body
      if (!taskId || !dependencyTaskId) return NextResponse.json({ error: 'taskId and dependencyTaskId required' }, { status: 400 })
      if (taskId === dependencyTaskId) return NextResponse.json({ error: 'Cannot depend on self' }, { status: 400 })
      db = new Database(dbPath)
      try {
        db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, dependency_task_id) VALUES (?, ?)').run(taskId, dependencyTaskId)
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'move_section') {
      const { taskId, targetSection } = body
      if (!taskId || !targetSection) return NextResponse.json({ error: 'taskId and targetSection required' }, { status: 400 })
      const validSections = ['today', 'this_week', 'later']
      if (!validSections.includes(targetSection)) return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
      db = new Database(dbPath)
      const now = new Date().toISOString()
      let dueDate = null
      if (targetSection === 'today') {
        dueDate = now.split('T')[0]
      } else if (targetSection === 'this_week') {
        const d = new Date(); d.setDate(d.getDate() + 3)
        dueDate = d.toISOString().split('T')[0]
      }
      // Update section and due_date
      db.prepare('UPDATE tasks SET section = ?, due_date = ?, updated_at = ? WHERE id = ?').run(targetSection, dueDate, now, taskId)
      return NextResponse.json({ success: true, section: targetSection, due_date: dueDate })
    }

    if (action === 'set_focus') {
      const { taskId } = body
      if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
      db = new Database(dbPath)
      const now = new Date().toISOString()
      db.prepare('UPDATE tasks SET is_focus = 0, updated_at = ? WHERE is_focus = 1').run(now)
      db.prepare('UPDATE tasks SET is_focus = 1, updated_at = ? WHERE id = ?').run(now, taskId)
      return NextResponse.json({ success: true })
    }

    if (action === 'clear_focus') {
      db = new Database(dbPath)
      const now = new Date().toISOString()
      db.prepare('UPDATE tasks SET is_focus = 0, updated_at = ? WHERE is_focus = 1').run(now)
      return NextResponse.json({ success: true })
    }

    if (action === 'update_priority') {
      const { taskId, priority } = body
      if (!taskId || !priority) return NextResponse.json({ error: 'taskId and priority required' }, { status: 400 })
      db = new Database(dbPath)
      const now = new Date().toISOString()
      db.prepare('UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?').run(priority, now, taskId)
      return NextResponse.json({ success: true })
    }

    if (action === 'remove_dependency') {
      const { taskId, dependencyTaskId } = body
      if (!taskId || !dependencyTaskId) return NextResponse.json({ error: 'taskId and dependencyTaskId required' }, { status: 400 })
      db = new Database(dbPath)
      db.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND dependency_task_id = ?').run(taskId, dependencyTaskId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Task API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (db) db.close()
  }
}
