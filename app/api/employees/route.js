import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  retireEmployee,
  logRun,
  getEmployeeRuns,
  checkPromotion,
  promoteCandidate,
  getPromotionCandidates
} from '../../lib/employees-db.js'

const EMPLOYEES_DIR = path.join(process.env.HOME || '/tmp', '.openclaw/workspace/employees')

function readMemory(memoryPath) {
  try {
    return fs.readFileSync(memoryPath, 'utf-8')
  } catch {
    return ''
  }
}

function writeMemory(memoryPath, content) {
  try {
    fs.mkdirSync(path.dirname(memoryPath), { recursive: true })
    fs.writeFileSync(memoryPath, content, 'utf-8')
    return true
  } catch {
    return false
  }
}

function appendToSection(memoryPath, section, content) {
  try {
    let file = readMemory(memoryPath)
    if (!file) return false

    const sectionRegex = new RegExp(`(## ${section}[\\s\\S]*?)(?=\\n## |$)`)
    const match = file.match(sectionRegex)

    if (match) {
      const sectionContent = match[1]
      const insertion = sectionContent.trimEnd() + '\n- ' + content + '\n'
      file = file.replace(sectionRegex, insertion)
    } else {
      file = file.trimEnd() + `\n\n## ${section}\n- ${content}\n`
    }

    fs.writeFileSync(memoryPath, file, 'utf-8')
    return true
  } catch {
    return false
  }
}

function getMemoryStats(memoryPath) {
  try {
    const content = fs.readFileSync(memoryPath, 'utf-8')
    const lines = content.split('\n').length
    const bytes = Buffer.byteLength(content, 'utf-8')
    return { lines, bytes }
  } catch {
    return { lines: 0, bytes: 0 }
  }
}

function getProjectFiles(projectPath) {
  if (!projectPath) return { files: [], count: 0 }
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        const stat = fs.statSync(path.join(projectPath, entry.name))
        files.push({
          name: entry.name,
          ext,
          size: stat.size,
          modified: stat.mtimeMs
        })
      } else if (entry.isDirectory()) {
        // Count files in subdirectories (1 level)
        try {
          const subEntries = fs.readdirSync(path.join(projectPath, entry.name))
          files.push({
            name: entry.name + '/',
            ext: 'dir',
            size: 0,
            modified: 0,
            fileCount: subEntries.length
          })
        } catch {}
      }
    }
    return { files, count: files.length }
  } catch {
    return { files: [], count: 0 }
  }
}

function readProjectContext(projectPath, maxBytes = 8000) {
  // Read key markdown files from project path, up to maxBytes total
  if (!projectPath) return ''
  try {
    const entries = fs.readdirSync(projectPath)
      .filter(f => f.endsWith('.md'))
      .sort()
    
    let context = ''
    let bytesUsed = 0
    
    for (const file of entries) {
      try {
        const content = fs.readFileSync(path.join(projectPath, file), 'utf-8')
        const snippet = content.slice(0, 1500) // First 1500 chars of each file
        const entry = `\n--- ${file} ---\n${snippet}\n`
        if (bytesUsed + entry.length > maxBytes) break
        context += entry
        bytesUsed += entry.length
      } catch {}
    }
    
    return context
  } catch {
    return ''
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  if (id) {
    const employee = getEmployee(id)
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const runs = getEmployeeRuns(id, 20)
    const memoryStats = getMemoryStats(employee.memory_path)
    const memoryPreview = readMemory(employee.memory_path).slice(0, 500)
    const projectFiles = getProjectFiles(employee.project_path)

    return NextResponse.json({
      employee,
      runs,
      memoryStats,
      memoryPreview,
      projectFiles
    })
  }

  // List all employees with project file counts
  const employees = listEmployees()
  const promotionCandidates = getPromotionCandidates()

  // Add file counts to project agents
  const enriched = employees.map(emp => {
    if (emp.type === 'project' && emp.project_path) {
      const { count } = getProjectFiles(emp.project_path)
      return { ...emp, project_file_count: count }
    }
    return { ...emp, project_file_count: 0 }
  })

  const todayStart = new Date().setHours(0, 0, 0, 0)
  let runsToday = 0
  let costToday = 0
  for (const emp of employees) {
    if (emp.last_run_at && emp.last_run_at > todayStart) runsToday++
    costToday += emp.total_cost || 0
  }

  return NextResponse.json({
    employees: enriched,
    promotionCandidates,
    stats: {
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      projects: employees.filter(e => e.type === 'project').length,
      utilities: employees.filter(e => e.type === 'utility').length,
      runsToday,
      totalCost: Math.round(costToday * 100) / 100
    }
  })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create': {
        const { name, specialty, type, system_prompt, avatar_emoji, project_path } = body
        if (!name || !specialty) {
          return NextResponse.json({ error: 'Name and specialty required' }, { status: 400 })
        }
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const memory_path = path.join(EMPLOYEES_DIR, `${slug}.md`)

        const starterMemory = `# ${name} ${avatar_emoji || '🤖'}\n\n## Identity\n${specialty}\n\n## Knowledge\n_(accumulates over time)_\n\n## Preferences\n_(learned from runs)_\n\n## Mistakes\n_(logged to avoid repeating)_\n\n## Shortcuts\n_(efficient approaches discovered)_\n`
        writeMemory(memory_path, starterMemory)

        const employee = createEmployee({
          name, specialty, type: type || 'utility',
          system_prompt, avatar_emoji, memory_path, project_path
        })
        return NextResponse.json({ success: true, employee })
      }

      case 'update': {
        const { id, ...fields } = body
        delete fields.action
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
        const updated = updateEmployee(id, fields)
        return NextResponse.json({ success: true, employee: updated })
      }

      case 'retire': {
        const { id } = body
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
        retireEmployee(id)
        return NextResponse.json({ success: true })
      }

      case 'log-run': {
        const { id, task, summary, learnings, tokens, cost, duration, session_key } = body
        if (!id || !task) return NextResponse.json({ error: 'ID and task required' }, { status: 400 })
        const run = logRun({
          employee_id: id, task, summary, learnings,
          tokens_used: tokens, cost, duration, session_key
        })
        return NextResponse.json({ success: true, run })
      }

      case 'check-promotion': {
        const { category } = body
        if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 })
        const result = checkPromotion(category)
        return NextResponse.json(result)
      }

      case 'promote': {
        const { category, name, specialty, system_prompt } = body
        if (!category || !name) return NextResponse.json({ error: 'Category and name required' }, { status: 400 })

        promoteCandidate(category)
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const memory_path = path.join(EMPLOYEES_DIR, `${slug}.md`)
        const starterMemory = `# ${name}\n\n## Identity\n${specialty || category} utility agent — auto-promoted after 3+ runs.\n\n## Knowledge\n_(accumulates over time)_\n\n## Preferences\n_(learned from runs)_\n\n## Mistakes\n_(logged to avoid repeating)_\n\n## Shortcuts\n_(efficient approaches discovered)_\n`
        writeMemory(memory_path, starterMemory)

        const employee = createEmployee({
          name, specialty: specialty || category, type: 'utility',
          system_prompt, avatar_emoji: '🎓', memory_path
        })
        return NextResponse.json({ success: true, employee })
      }

      case 'get-memory': {
        const { id } = body
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
        const emp = getEmployee(id)
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        const content = readMemory(emp.memory_path)
        const stats = getMemoryStats(emp.memory_path)
        return NextResponse.json({ content, stats })
      }

      case 'update-memory': {
        const { id, content } = body
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
        const emp = getEmployee(id)
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        const success = writeMemory(emp.memory_path, content)
        return NextResponse.json({ success })
      }

      case 'append-memory': {
        const { id, section, content } = body
        if (!id || !section || !content) {
          return NextResponse.json({ error: 'ID, section, and content required' }, { status: 400 })
        }
        const emp = getEmployee(id)
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        const success = appendToSection(emp.memory_path, section, content)
        return NextResponse.json({ success })
      }

      case 'get-project-context': {
        // Returns full deploy context: system prompt + memory + project files
        const { id } = body
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
        const emp = getEmployee(id)
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

        const memory = readMemory(emp.memory_path)
        const projectContext = readProjectContext(emp.project_path)
        const projectFiles = getProjectFiles(emp.project_path)

        return NextResponse.json({
          system_prompt: emp.system_prompt || '',
          memory,
          projectContext,
          projectFiles,
          memoryStats: getMemoryStats(emp.memory_path)
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: `Failed: ${error.message}` }, { status: 500 })
  }
}
