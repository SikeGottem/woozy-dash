import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { join } from 'path'
import fs from 'fs'

const dbPath = process.env.WOOZY_DB_PATH || join(process.env.HOME, '.openclaw', 'workspace', 'woozy.db')
const VAULT = join(process.env.HOME, 'Desktop', 'WOOZY')

function readVaultFile(filename) {
  try {
    return fs.readFileSync(join(VAULT, filename), 'utf-8')
  } catch { return null }
}

export async function POST() {
  let db
  try {
    db = new Database(dbPath, { readonly: true })

    // Get all incomplete tasks with project info
    const tasks = db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status != 'done'
      ORDER BY t.due_date ASC NULLS LAST
    `).all()

    // Get projects
    const projects = db.prepare(`SELECT * FROM projects WHERE status = 'active'`).all()

    db.close()
    db = null

    // Read vault files
    const tasksMd = readVaultFile('TASKS.md')
    const inboxMd = readVaultFile('INBOX.md')

    // Fetch calendar data from our own data endpoint
    let calendarData = null
    try {
      const dataRes = await fetch('http://localhost:3001/api/data', { headers: { 'Cache-Control': 'no-cache' } })
      if (dataRes.ok) {
        const d = await dataRes.json()
        calendarData = d.calendar || d.events || null
      }
    } catch {}

    // Build prompt
    const taskList = tasks.map(t => {
      let s = `- [${t.priority || 'medium'}] "${t.title}"`
      if (t.project_name) s += ` (Project: ${t.project_name})`
      if (t.due_date) s += ` [Due: ${t.due_date}]`
      if (t.section) s += ` [Section: ${t.section}]`
      s += ` [ID: ${t.id}]`
      return s
    }).join('\n')

    const prompt = `You are a task audit AI. Analyze the following task system and return structured JSON suggestions.

## Current Tasks in Dashboard (${tasks.length} incomplete)
${taskList}

## Active Projects (use these IDs for project_id in missing tasks)
${projects.map(p => `- ID:${p.id} "${p.name}" (${p.status}): ${p.notes || 'no notes'}`).join('\n') || 'None'}

${tasksMd ? `## TASKS.md (Vault)\n${tasksMd.slice(0, 4000)}` : ''}

${inboxMd ? `## INBOX.md (Vault)\n${inboxMd.slice(0, 2000)}` : ''}

${calendarData ? `## Calendar Events\n${JSON.stringify(calendarData).slice(0, 2000)}` : ''}

Today is ${new Date().toISOString().split('T')[0]}.

Analyze and return ONLY valid JSON with this exact structure:
{
  "redundant": [
    { "taskIds": [1, 2], "taskTitles": ["task A", "task B"], "reason": "why they overlap", "suggestion": "merge into X" }
  ],
  "automatable": [
    { "taskId": 1, "taskTitle": "task name", "reason": "why AI can help", "agentInstructions": "specific instructions for the agent", "template": "research" }
  ],
  "missing": [
    { "title": "suggested task title", "reason": "why it should exist", "priority": "high", "due_date": "2026-03-25", "project_id": 1, "section": "this_week" }
  ],
  "priority_adjustments": [
    { "taskId": 1, "taskTitle": "task name", "currentPriority": "medium", "suggestedPriority": "high", "reason": "why" }
  ]
}

Be specific and actionable. Only suggest things that genuinely add value. If a section has no suggestions, use an empty array. For missing tasks, use the actual project ID from the Active Projects list above (or null if no project matches). For automatable tasks, write detailed agent instructions that could be directly used to spawn a sub-agent. Template options: research, draft, build, review.`

    // Call OpenClaw gateway
    let gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1/chat/completions'
    let gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
    try {
      const envContent = fs.readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
      const tm = envContent.match(/OPENCLAW_GATEWAY_TOKEN=(.+)/); if (tm) gatewayToken = tm[1].trim()
      const um = envContent.match(/OPENCLAW_GATEWAY_URL=(.+)/); if (um) gatewayUrl = um[1].trim()
    } catch {}

    const aiRes = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: 'sonnet',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
      })
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return NextResponse.json({ error: `AI request failed: ${aiRes.status}` }, { status: 502 })
    }

    const aiResult = await aiRes.json()
    const content = aiResult.choices?.[0]?.message?.content || ''

    // Parse JSON from response (handle markdown code blocks)
    let parsed
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      parsed = JSON.parse(jsonMatch[1].trim())
    } catch {
      // Try to find JSON object directly
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')
      if (start >= 0 && end > start) {
        parsed = JSON.parse(content.slice(start, end + 1))
      } else {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: content.slice(0, 500) }, { status: 500 })
      }
    }

    return NextResponse.json({
      redundant: parsed.redundant || [],
      automatable: parsed.automatable || [],
      missing: parsed.missing || [],
      priority_adjustments: parsed.priority_adjustments || [],
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Audit API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (db) db.close()
  }
}
