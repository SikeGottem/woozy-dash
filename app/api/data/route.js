import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')

function getDatabase() {
  return new Database(dbPath, { readonly: true })
}

function calculateUrgency(dueDate) {
  if (!dueDate) return 'later'
  
  const now = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 7) return 'this_week'
  return 'later'
}

function formatTask(task, project = null) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    urgency: calculateUrgency(task.due_date),
    project_id: task.project_id,
    project_name: project?.name || null,
    project_color: project?.color || '#3b82f6',
    project_type: project?.type || 'personal',
    category: project?.type || 'personal',
    section: task.section || 'this_week',
    sort_order: task.sort_order,
    completed_at: task.completed_at,
    created_at: task.created_at
  }
}

function formatProject(project) {
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    color: project.color,
    icon: project.icon,
    status: project.status,
    client_name: project.client_name,
    total_value: project.total_value,
    paid: project.paid,
    notes: project.notes,
    created_at: project.created_at,
    updated_at: project.updated_at
  }
}

function formatDeadline(deadline, project = null) {
  return {
    id: deadline.id,
    title: deadline.title,
    project_id: deadline.project_id,
    project_name: project?.name || null,
    project_color: project?.color || '#3b82f6',
    due_date: deadline.due_date,
    weight: deadline.weight,
    status: deadline.status,
    grade: deadline.grade,
    notes: deadline.notes,
    urgency: calculateUrgency(deadline.due_date),
    created_at: deadline.created_at
  }
}

function formatTransaction(transaction, project = null) {
  return {
    id: transaction.id,
    project_id: transaction.project_id,
    project_name: project?.name || null,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date,
    category: transaction.category,
    status: transaction.status,
    invoice_ref: transaction.invoice_ref,
    created_at: transaction.created_at
  }
}

function formatDailyLog(log) {
  if (!log) return null
  
  return {
    date: log.date,
    energy_level: log.energy_level,
    main_focus: log.main_focus,
    deep_work_hours: log.deep_work_hours,
    screen_time_hours: log.screen_time_hours,
    gym: Boolean(log.gym),
    mood: log.mood,
    wins: log.wins,
    notes: log.notes
  }
}

function formatHabit(habit, todayLog = null) {
  return {
    id: habit.id,
    name: habit.name,
    icon: habit.icon,
    color: habit.color,
    target_frequency: habit.target_frequency,
    active: Boolean(habit.active),
    today_completed: todayLog ? Boolean(todayLog.completed) : false,
    today_notes: todayLog?.notes || null
  }
}

function parseAssets() {
  try {
    const assetsPath = join(process.env.HOME, 'Desktop', 'WOOZY', 'LIFE', 'Finances', 'assets.md')
    const md = readFileSync(assetsPath, 'utf-8')
    
    const checking = md.match(/Checking account:\*\*\s*\$([\d,]+)/)
    const savings = md.match(/Savings account:\*\*\s*\$([\d,]+)/)
    const cash = md.match(/Physical cash:\*\*\s*\$([\d,]+)/)
    const investments = md.match(/Brokerage\/investments:\*\*\s*\$([\d,]+)/)
    const goldMatch = md.match(/Gold \(physical\):\*\*\s*(\d+)g.*~\$([\d,]+)/)
    const receivables = md.match(/Receivables[^|]*\|\s*\$([\d,]+)/)
    const netWorth = md.match(/Total Net Worth\*\*\s*\|\s*\*\*\$([\d,]+)/)
    
    return {
      checking: checking ? parseInt(checking[1].replace(/,/g, '')) : 0,
      savings: savings ? parseInt(savings[1].replace(/,/g, '')) : 0,
      cash: cash ? parseInt(cash[1].replace(/,/g, '')) : 0,
      investments: investments ? parseInt(investments[1].replace(/,/g, '')) : 0,
      gold: goldMatch ? { 
        grams: parseInt(goldMatch[1]), 
        value: parseInt(goldMatch[2].replace(/,/g, '')) 
      } : { grams: 0, value: 0 },
      receivables: receivables ? parseInt(receivables[1].replace(/,/g, '')) : 0,
      netWorth: netWorth ? parseInt(netWorth[1].replace(/,/g, '')) : 0
    }
  } catch (error) {
    console.error('Error parsing assets:', error)
    return {
      checking: 0,
      savings: 0,
      cash: 0,
      investments: 0,
      gold: { grams: 0, value: 0 },
      receivables: 0,
      netWorth: 0
    }
  }
}

function getUniData(db) {
  // Get uni projects
  const uniProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type = 'uni' 
    ORDER BY updated_at DESC
  `).all()

  // Get tasks for uni projects + tasks without projects that seem uni-related
  const uniTasks = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE (p.type = 'uni' OR (t.project_id IS NULL AND (
      t.title LIKE '%COMM%' OR t.title LIKE '%CODE%' OR t.title LIKE '%FADA%' OR
      t.title LIKE '%assignment%' OR t.title LIKE '%quiz%' OR t.title LIKE '%lecture%' OR
      t.title LIKE '%tutorial%' OR t.title LIKE '%moodle%'
    )))
    AND t.status != 'done'
    ORDER BY 
      CASE t.status WHEN 'in_progress' THEN 0 ELSE 1 END,
      CASE WHEN t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 0 ELSE 1 END,
      CASE t.priority 
        WHEN 'critical' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.due_date ASC
  `).all()

  // Get deadlines for uni projects
  const uniDeadlines = db.prepare(`
    SELECT d.*, p.name as project_name, p.color as project_color
    FROM deadlines d
    JOIN projects p ON d.project_id = p.id
    WHERE p.type = 'uni'
    ORDER BY d.due_date ASC
  `).all()

  // Add tasks to projects
  const formattedProjects = uniProjects.map(project => {
    const projectTasks = uniTasks.filter(task => task.project_id === project.id)
    return {
      ...formatProject(project),
      tasks: projectTasks.map(task => formatTask(task, project))
    }
  })

  return {
    mode: 'uni',
    tasks: uniTasks.map(task => formatTask(task, uniProjects.find(p => p.id === task.project_id))),
    deadlines: uniDeadlines.map(deadline => formatDeadline(deadline, uniProjects.find(p => p.id === deadline.project_id))),
    projects: formattedProjects
  }
}

function getWorkData(db) {
  // Get freelance projects
  const workProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type = 'freelance' 
    ORDER BY updated_at DESC
  `).all()

  // Get tasks for freelance projects
  const workTasks = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.type = 'freelance' AND t.status != 'done'
    ORDER BY 
      CASE t.status WHEN 'in_progress' THEN 0 ELSE 1 END,
      CASE WHEN t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 0 ELSE 1 END,
      CASE t.priority 
        WHEN 'critical' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.due_date ASC
  `).all()

  // Get income transactions for freelance projects
  const income = db.prepare(`
    SELECT tr.*, p.name as project_name
    FROM transactions tr
    JOIN projects p ON tr.project_id = p.id
    WHERE tr.type = 'income' AND p.type = 'freelance'
    ORDER BY tr.date DESC
  `).all()

  // Find pinned project (most active freelance project)
  const pinnedProject = workProjects.find(project => {
    const projectTaskCount = workTasks.filter(task => task.project_id === project.id).length
    return project.status === 'active' && projectTaskCount > 0
  }) || workProjects[0]

  // Format projects as client cards
  const clients = workProjects.map(project => ({
    ...formatProject(project),
    tasks: workTasks.filter(task => task.project_id === project.id).map(task => formatTask(task, project))
  }))

  return {
    mode: 'work',
    tasks: workTasks.map(task => formatTask(task, workProjects.find(p => p.id === task.project_id))),
    projects: clients,
    pinnedProject: pinnedProject ? {
      ...formatProject(pinnedProject),
      tasks: workTasks.filter(task => task.project_id === pinnedProject.id).map(task => formatTask(task, pinnedProject))
    } : null,
    clients,
    income: income.map(tr => formatTransaction(tr, workProjects.find(p => p.id === tr.project_id)))
  }
}

function getPersonalData(db) {
  // Get personal projects + tasks without projects
  const personalProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type = 'personal' 
    ORDER BY updated_at DESC
  `).all()

  // Get tasks for personal projects + unassigned tasks
  const personalTasks = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE (p.type = 'personal' OR t.project_id IS NULL)
    AND t.status != 'done'
    AND NOT (t.title LIKE '%COMM%' OR t.title LIKE '%CODE%' OR t.title LIKE '%FADA%')
    ORDER BY 
      CASE t.status WHEN 'in_progress' THEN 0 ELSE 1 END,
      CASE WHEN t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 0 ELSE 1 END,
      CASE t.priority 
        WHEN 'critical' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.due_date ASC
  `).all()

  // Get today's daily log
  const today = new Date().toISOString().split('T')[0]
  const dailyLog = db.prepare(`
    SELECT * FROM daily_logs WHERE date = ?
  `).get(today)

  // Get all habits with today's completion status
  const habits = db.prepare(`
    SELECT h.*, hl.completed, hl.notes as today_notes
    FROM habits h
    LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.date = ?
    WHERE h.active = 1
    ORDER BY h.name
  `).all(today)

  return {
    mode: 'personal',
    tasks: personalTasks.map(task => formatTask(task, personalProjects.find(p => p.id === task.project_id))),
    dailyLog: formatDailyLog(dailyLog),
    habits: habits.map(habit => formatHabit(habit, { completed: habit.completed, notes: habit.today_notes }))
  }
}

function getFinanceData(db) {
  // Get all income transactions
  const allIncome = db.prepare(`
    SELECT tr.*, p.name as project_name
    FROM transactions tr
    LEFT JOIN projects p ON tr.project_id = p.id
    WHERE tr.type = 'income'
    ORDER BY tr.date DESC
  `).all()

  // Get all expense transactions
  const allExpenses = db.prepare(`
    SELECT tr.*, p.name as project_name
    FROM transactions tr
    LEFT JOIN projects p ON tr.project_id = p.id
    WHERE tr.type = 'expense'
    ORDER BY tr.date DESC
  `).all()

  // Get all projects with financial data
  const projectsWithFinances = db.prepare(`
    SELECT p.*, 
           COALESCE(SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END), 0) as total_income,
           COALESCE(SUM(CASE WHEN tr.type = 'expense' THEN tr.amount ELSE 0 END), 0) as total_expenses
    FROM projects p
    LEFT JOIN transactions tr ON p.id = tr.project_id
    GROUP BY p.id
    ORDER BY total_income DESC
  `).all()

  // Calculate totals
  const totalIncome = allIncome.reduce((sum, tr) => sum + tr.amount, 0)
  const totalExpenses = allExpenses.reduce((sum, tr) => sum + tr.amount, 0)
  const totalPending = [...allIncome, ...allExpenses].filter(tr => tr.status === 'pending').reduce((sum, tr) => sum + tr.amount, 0)
  const net = totalIncome - totalExpenses

  // Parse assets from markdown file
  const assets = parseAssets()

  return {
    mode: 'finance',
    income: allIncome.map(tr => formatTransaction(tr, projectsWithFinances.find(p => p.id === tr.project_id))),
    expenses: allExpenses.map(tr => formatTransaction(tr, projectsWithFinances.find(p => p.id === tr.project_id))),
    projects: projectsWithFinances.map(project => ({
      ...formatProject(project),
      total_income: project.total_income,
      total_expenses: project.total_expenses,
      net: project.total_income - project.total_expenses
    })),
    totals: {
      totalIncome,
      totalExpenses,
      totalPending,
      net
    },
    assets
  }
}

function getAllData(db) {
  // Get all data for backward compatibility
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
  const tasks = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.status != 'done'
    ORDER BY 
      CASE t.status WHEN 'in_progress' THEN 0 ELSE 1 END,
      CASE WHEN t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 0 ELSE 1 END,
      CASE t.priority 
        WHEN 'critical' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.due_date ASC
  `).all()

  const deadlines = db.prepare(`
    SELECT d.*, p.name as project_name, p.color as project_color
    FROM deadlines d
    LEFT JOIN projects p ON d.project_id = p.id
    ORDER BY d.due_date ASC
  `).all()

  const income = db.prepare(`
    SELECT tr.*, p.name as project_name
    FROM transactions tr
    LEFT JOIN projects p ON tr.project_id = p.id
    WHERE tr.type = 'income'
    ORDER BY tr.date DESC
  `).all()

  const expenses = db.prepare(`
    SELECT tr.*, p.name as project_name
    FROM transactions tr
    LEFT JOIN projects p ON tr.project_id = p.id
    WHERE tr.type = 'expense'
    ORDER BY tr.date DESC
  `).all()

  const today = new Date().toISOString().split('T')[0]
  const dailyLog = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(today)

  const habits = db.prepare(`
    SELECT h.*, hl.completed, hl.notes as today_notes
    FROM habits h
    LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.date = ?
    WHERE h.active = 1
    ORDER BY h.name
  `).all(today)

  // Find pinned project
  const pinnedProject = projects.find(p => p.type === 'freelance' && p.status === 'active') || projects[0]

  return {
    tasks: tasks.map(task => formatTask(task, projects.find(p => p.id === task.project_id))),
    projects: projects.map(formatProject),
    deadlines: deadlines.map(deadline => formatDeadline(deadline, projects.find(p => p.id === deadline.project_id))),
    income: income.map(tr => formatTransaction(tr, projects.find(p => p.id === tr.project_id))),
    expenses: expenses.map(tr => formatTransaction(tr, projects.find(p => p.id === tr.project_id))),
    pinnedProject: pinnedProject ? formatProject(pinnedProject) : null,
    dailyLog: formatDailyLog(dailyLog),
    habits: habits.map(habit => formatHabit(habit, { completed: habit.completed, notes: habit.today_notes })),
    assets: parseAssets(),
    updated: new Date().toISOString()
  }
}

export async function GET(request) {
  let db
  try {
    db = getDatabase()
    
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    let data
    switch (mode) {
      case 'uni':
        data = getUniData(db)
        break
      case 'work':
        data = getWorkData(db)
        break
      case 'personal':
        data = getPersonalData(db)
        break
      case 'finance':
        data = getFinanceData(db)
        break
      default:
        data = getAllData(db)
        break
    }

    return NextResponse.json({
      ...data,
      updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  } finally {
    if (db) {
      db.close()
    }
  }
}