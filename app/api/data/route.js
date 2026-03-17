import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
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
    project_name: task.project_name || project?.name || null,
    project_color: task.project_color || project?.color || '#3b82f6',
    project_type: task.project_type || project?.type || 'personal',
    category: task.category || project?.type || 'personal',
    energy_required: task.energy_required || 'medium',
    parent_id: task.parent_id || null,
    blocked_reason: task.blocked_reason || null,
    actual_minutes: task.actual_minutes || null,
    estimated_minutes: task.estimated_minutes || null,
    context: task.context || null,
    completed_by: task.completed_by || null,
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

function getFinanceFromDB(db) {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY id').all()
  const transactions = db.prepare(`
    SELECT tr.*, p.name as project_name, a.name as account_name
    FROM transactions tr
    LEFT JOIN projects p ON tr.project_id = p.id
    LEFT JOIN accounts a ON tr.account_id = a.id
    ORDER BY tr.date DESC
  `).all()
  const netWorthHistory = db.prepare('SELECT * FROM net_worth_snapshots ORDER BY date ASC').all()
  const budgets = db.prepare('SELECT * FROM budgets WHERE active = 1').all()

  // Calculate summary from accounts
  const byName = {}
  for (const a of accounts) byName[a.name] = a.balance
  const liquid = (byName['Checking'] || 0) + (byName['Savings'] || 0) + (byName['Cash'] || 0)
  const invested = (byName['Investments'] || 0) + (byName['Gold'] || 0)

  // Receivables from pending income transactions
  const receivables = transactions
    .filter(t => t.type === 'income' && t.status === 'pending')
    .reduce((s, t) => s + t.amount, 0)

  const netWorth = liquid + invested + receivables

  // Monthly income/expenses (current month)
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'completed' && t.date >= monthStart)
    .reduce((s, t) => s + t.amount, 0)
  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && t.status === 'completed' && t.date >= monthStart)
    .reduce((s, t) => s + t.amount, 0)

  // Freelance projects with payment data
  const freelanceProjects = db.prepare(`
    SELECT p.*,
      COALESCE(SUM(CASE WHEN tr.type = 'income' AND tr.status = 'completed' THEN tr.amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN tr.type = 'income' AND tr.status = 'pending' THEN tr.amount ELSE 0 END), 0) as total_pending
    FROM projects p
    LEFT JOIN transactions tr ON p.id = tr.project_id
    WHERE p.type = 'freelance'
    GROUP BY p.id
    ORDER BY CASE p.status WHEN 'active' THEN 0 ELSE 1 END, p.updated_at DESC
  `).all()

  // Load live holdings data
  let holdings = []
  try {
    holdings = db.prepare('SELECT * FROM holdings').all()
  } catch {}

  // Use live prices for investments if available
  const hndqHolding = holdings.find(h => h.name === 'HNDQ')
  const goldHolding = holdings.find(h => h.name === 'Gold')
  const liveInvested = (hndqHolding?.current_value || byName['Investments'] || 0) 
                     + (goldHolding?.current_value || byName['Gold'] || 0)
  const liveNetWorth = liquid + liveInvested + receivables

  // Build legacy assets shape for backward compat
  const assets = {
    checking: byName['Checking'] || 0,
    savings: byName['Savings'] || 0,
    cash: byName['Cash'] || 0,
    investments: hndqHolding?.current_value || byName['Investments'] || 0,
    gold: { grams: 20, value: goldHolding?.current_value || byName['Gold'] || 0 },
    receivables,
    netWorth: liveNetWorth
  }

  return {
    accounts,
    holdings: holdings.map(h => ({
      ...h,
      gain: h.current_value && h.cost_basis ? Math.round((h.current_value - h.cost_basis) * 100) / 100 : 0,
      gainPct: h.current_value && h.cost_basis > 0 ? Math.round(((h.current_value - h.cost_basis) / h.cost_basis) * 10000) / 100 : 0
    })),
    transactions: transactions.map(tr => ({
      ...formatTransaction(tr),
      project_name: tr.project_name,
      account_name: tr.account_name,
      tags: tr.tags,
      recurring: tr.recurring,
    })),
    netWorthHistory: netWorthHistory.map(s => ({ ...s, breakdown: s.breakdown ? JSON.parse(s.breakdown) : null })),
    budgets,
    freelanceProjects: freelanceProjects.map(p => ({
      ...formatProject(p),
      total_paid: p.total_paid,
      total_pending: p.total_pending,
    })),
    summary: { netWorth: liveNetWorth, liquid, invested: liveInvested, receivables, monthlyIncome, monthlyExpenses },
    assets // legacy compat
  }
}

function getTasksByCategory(db, category) {
  return db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.category = ? AND t.status NOT IN ('done', 'skipped') AND t.parent_id IS NULL
    ORDER BY 
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END,
      CASE WHEN t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      t.due_date ASC
  `).all(category)
}

function getSubtasks(db, parentIds) {
  if (!parentIds.length) return []
  const placeholders = parentIds.map(() => '?').join(',')
  return db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.parent_id IN (${placeholders}) AND t.status NOT IN ('done', 'skipped')
    ORDER BY t.sort_order, t.id
  `).all(...parentIds)
}

function nestSubtasks(tasks, subtasks, projects) {
  const subtasksByParent = {}
  for (const st of subtasks) {
    if (!subtasksByParent[st.parent_id]) subtasksByParent[st.parent_id] = []
    subtasksByParent[st.parent_id].push(formatTask(st))
  }
  return tasks.map(t => {
    const formatted = formatTask(t, projects?.find(p => p.id === t.project_id))
    formatted.subtasks = subtasksByParent[t.id] || []
    return formatted
  })
}

function getTaskCounts(db, category = null) {
  if (category) {
    return db.prepare(
      'SELECT status, COUNT(*) as count FROM tasks WHERE category = ? GROUP BY status'
    ).all(category).reduce((acc, r) => { acc[r.status] = r.count; return acc }, {})
  }
  return db.prepare(
    'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
  ).all().reduce((acc, r) => { acc[r.status] = r.count; return acc }, {})
}

function getUniData(db) {
  // Get uni projects
  const uniProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type = 'uni' 
    ORDER BY updated_at DESC
  `).all()

  const uniTasks = getTasksByCategory(db, 'uni')
  const subtasks = getSubtasks(db, uniTasks.map(t => t.id))

  // Get deadlines for uni projects
  const uniDeadlines = db.prepare(`
    SELECT d.*, p.name as project_name, p.color as project_color
    FROM deadlines d
    JOIN projects p ON d.project_id = p.id
    WHERE p.type = 'uni'
    ORDER BY d.due_date ASC
  `).all()

  const formattedTasks = nestSubtasks(uniTasks, subtasks, uniProjects)

  const formattedProjects = uniProjects.map(project => {
    const projectTasks = formattedTasks.filter(task => task.project_id === project.id)
    return { ...formatProject(project), tasks: projectTasks }
  })

  return {
    mode: 'uni',
    tasks: formattedTasks,
    deadlines: uniDeadlines.map(deadline => formatDeadline(deadline, uniProjects.find(p => p.id === deadline.project_id))),
    projects: formattedProjects,
    taskCounts: getTaskCounts(db, 'uni')
  }
}

function getWorkData(db) {
  const workProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type IN ('freelance', 'product') 
    ORDER BY updated_at DESC
  `).all()

  const workTasks = getTasksByCategory(db, 'work')
  const subtasks = getSubtasks(db, workTasks.map(t => t.id))

  // Get income transactions for freelance projects
  const income = db.prepare(`
    SELECT tr.*, p.name as project_name
    FROM transactions tr
    JOIN projects p ON tr.project_id = p.id
    WHERE tr.type = 'income' AND p.type = 'freelance'
    ORDER BY tr.date DESC
  `).all()

  const formattedTasks = nestSubtasks(workTasks, subtasks, workProjects)

  const pinnedProject = workProjects.find(project => {
    const projectTaskCount = formattedTasks.filter(task => task.project_id === project.id).length
    return project.status === 'active' && projectTaskCount > 0
  }) || workProjects[0]

  const clients = workProjects.map(project => ({
    ...formatProject(project),
    tasks: formattedTasks.filter(task => task.project_id === project.id)
  }))

  return {
    mode: 'work',
    tasks: formattedTasks,
    projects: clients,
    pinnedProject: pinnedProject ? {
      ...formatProject(pinnedProject),
      tasks: formattedTasks.filter(task => task.project_id === pinnedProject.id)
    } : null,
    clients,
    income: income.map(tr => formatTransaction(tr, workProjects.find(p => p.id === tr.project_id))),
    taskCounts: getTaskCounts(db, 'work')
  }
}

function getPersonalData(db) {
  const personalProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type = 'personal' 
    ORDER BY updated_at DESC
  `).all()

  const personalTasks = getTasksByCategory(db, 'personal')
  const subtasks = getSubtasks(db, personalTasks.map(t => t.id))

  const formattedTasks = nestSubtasks(personalTasks, subtasks, personalProjects)

  const today = new Date().toISOString().split('T')[0]
  const dailyLog = db.prepare(`SELECT * FROM daily_logs WHERE date = ?`).get(today)
  const habits = db.prepare(`
    SELECT h.*, hl.completed, hl.notes as today_notes
    FROM habits h
    LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.date = ?
    WHERE h.active = 1
    ORDER BY h.name
  `).all(today)

  return {
    mode: 'personal',
    tasks: formattedTasks,
    dailyLog: formatDailyLog(dailyLog),
    habits: habits.map(habit => formatHabit(habit, { completed: habit.completed, notes: habit.today_notes })),
    taskCounts: getTaskCounts(db, 'personal')
  }
}

function getFinanceData(db) {
  const financeDB = getFinanceFromDB(db)
  return {
    mode: 'finance',
    ...financeDB
  }
}

function getAllData(db) {
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
  const tasks = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color, p.type as project_type
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.status NOT IN ('done', 'skipped') AND t.parent_id IS NULL
    ORDER BY 
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END,
      CASE WHEN t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      t.due_date ASC
  `).all()
  const subtasks = getSubtasks(db, tasks.map(t => t.id))

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

  const formattedTasks = nestSubtasks(tasks, subtasks, projects)

  const pinnedProject = projects.find(p => p.type === 'freelance' && p.status === 'active') || projects[0]
  const pinnedTasks = pinnedProject ? formattedTasks.filter(t => t.project_id === pinnedProject.id) : []

  return {
    tasks: formattedTasks,
    projects: projects.map(formatProject),
    deadlines: deadlines.map(deadline => formatDeadline(deadline, projects.find(p => p.id === deadline.project_id))),
    income: income.map(tr => formatTransaction(tr, projects.find(p => p.id === tr.project_id))),
    expenses: expenses.map(tr => formatTransaction(tr, projects.find(p => p.id === tr.project_id))),
    pinnedProject: pinnedProject ? { ...formatProject(pinnedProject), tasks: pinnedTasks } : null,
    dailyLog: formatDailyLog(dailyLog),
    habits: habits.map(habit => formatHabit(habit, { completed: habit.completed, notes: habit.today_notes })),
    ...getFinanceFromDB(db),
    taskCounts: getTaskCounts(db),
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