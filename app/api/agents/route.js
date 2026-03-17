import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = '/Users/ethanwu/.openclaw/agents/main/sessions'
const SESSIONS_JSON = path.join(SESSIONS_DIR, 'sessions.json')
const FIVE_MIN = 5 * 60 * 1000
const TWO_HOURS = 2 * 60 * 60 * 1000

function getSessionsMap() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_JSON, 'utf-8'))
  } catch { return {} }
}

function classifyKey(key) {
  if (key === 'agent:main:main') return 'main'
  if (key.includes(':subagent:')) return 'subagent'
  if (key.includes(':cron:') && key.includes(':run:')) return 'cron-run'
  if (key.includes(':cron:')) return 'cron'
  if (key.includes(':openai:')) return 'subagent' // openai sessions are also sub-agents
  return 'subagent'
}

function getCronParentKey(key) {
  // agent:main:cron:{id}:run:{runId} → agent:main:cron:{id}
  const m = key.match(/^(agent:main:cron:[^:]+)/)
  return m ? m[1] : key
}

function calculateCost(usage) {
  if (!usage) return 0
  if (usage.inputTokens || usage.outputTokens || usage.cacheReadTokens) {
    const input = (usage.inputTokens || 0) * 3 / 1e6
    const output = (usage.outputTokens || 0) * 15 / 1e6
    const cache = (usage.cacheReadTokens || usage.cacheRead || 0) * 0.3 / 1e6
    return input + output + cache
  }
  return (usage.totalTokens || 0) * 8 / 1e6
}

function cleanTaskName(text) {
  if (!text) return ''
  let c = text
    // Strip timestamp headers
    .replace(/\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+GMT[^\]]*\]/g, '')
    // Strip JSON blocks
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/Conversation info[\s\S]*?```\n*/g, '')
    // Strip queued message headers
    .replace(/\[Queued.*?\]\n*---\n*/g, '')
    .replace(/Queued #\d+\n*/g, '')
    // Strip system/meta lines
    .replace(/^System:.*$/gm, '')
    .replace(/Current time:.*$/gm, '')
    .replace(/Read HEARTBEAT\.md.*$/gm, '')
    .replace(/\[cron:[^\]]*\]/g, '')
    // Strip spawn prefixes
    .replace(/^(?:Use sessions_spawn to[^:]*:\s*)/i, '')
    .replace(/^(?:Spawn a \w+ agent[^:]*:\s*)/i, '')
    .replace(/^(?:Task:?\s*)/i, '')
    .replace(/^(?:IMPORTANT[^:]*:\s*)/i, '')
    .replace(/^(?:Context:?\s*)/i, '')
    // Strip markdown formatting
    .replace(/^#{1,3}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^[\s\n]*/, '')
    .trim()

  // Take first meaningful line
  const firstLine = c.split('\n').find(l => l.trim().length > 3) || c.slice(0, 60)
  let name = firstLine.trim()

  // Strip paths and technical details after the main task
  name = name.replace(/\s+at\s+[~/].*$/, '')
    .replace(/\s+in\s+[~/].*$/, '')
    .replace(/\s+from\s+[~/].*$/, '')

  // Truncate
  if (name.length > 40) {
    name = name.slice(0, 40).replace(/\s\S*$/, '...')
  }
  name = name.replace(/[—\-:,.]$/, '').trim()

  // Safety: reject metadata-looking names
  if (name.startsWith('{') || name.startsWith('[') || name.startsWith('json') || name.length < 3) {
    return ''
  }
  return name
}

function cleanCronLabel(label) {
  if (!label) return ''
  // "Cron: 🌇 Arvo Review" → { icon: "🌇", name: "Arvo Review" }
  let name = label.replace(/^Cron:\s*/, '')
  const emojiMatch = name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u)
  const icon = emojiMatch ? emojiMatch[1] : ''
  name = emojiMatch ? name.slice(emojiMatch[0].length) : name
  return name.trim()
}

function extractCurrentThought(lines) {
  // Parse last 20 lines to find current activity
  const recentLines = lines.slice(-20)
  let latestToolCall = null
  let latestThinking = null
  let latestAssistantText = null
  let latestTimestamp = 0

  for (const line of recentLines) {
    try {
      const entry = JSON.parse(line)
      if (entry.type !== 'message' || !entry.message) continue
      
      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0
      const msg = entry.message
      
      // Skip if too old
      if (ts < latestTimestamp) continue
      
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'toolCall' && ts >= latestTimestamp) {
            latestTimestamp = ts
            const toolName = part.name
            const args = part.arguments || {}
            
            // Format tool calls as human-readable actions
            if (toolName === 'read' || toolName === 'Read') {
              latestToolCall = `reading ${args.file_path || args.path || ''}`
            } else if (toolName === 'edit' || toolName === 'Edit') {
              latestToolCall = `editing ${args.file_path || args.path || ''}`
            } else if (toolName === 'write' || toolName === 'Write') {
              latestToolCall = `writing ${args.file_path || args.path || ''}`
            } else if (toolName === 'exec') {
              const cmd = args.command || ''
              latestToolCall = `running \`${cmd.slice(0, 40)}${cmd.length > 40 ? '...' : ''}\``
            } else if (toolName === 'web_search') {
              latestToolCall = `searching: ${args.query || ''}`
            } else if (toolName === 'web_fetch') {
              latestToolCall = `fetching ${args.url || ''}`
            } else if (toolName === 'sessions_spawn') {
              latestToolCall = `spawning sub-agent`
            } else {
              latestToolCall = toolName
            }
          } else if (part.type === 'thinking' && ts >= latestTimestamp && part.text) {
            latestThinking = part.text.slice(0, 80)
          } else if (part.type === 'text' && ts >= latestTimestamp && part.text && msg.role === 'assistant') {
            latestAssistantText = part.text.slice(0, 80)
          }
        }
      } else if (typeof msg.content === 'string' && msg.role === 'assistant' && ts >= latestTimestamp) {
        latestAssistantText = msg.content.slice(0, 80)
      }
    } catch {}
  }
  
  // Priority order: tool call > thinking > assistant text > fallback
  if (latestToolCall) return latestToolCall
  if (latestThinking) return latestThinking + (latestThinking.length === 80 ? '...' : '')
  if (latestAssistantText) return latestAssistantText + (latestAssistantText.length === 80 ? '...' : '')
  return 'Working...'
}

function parseSession(filePath, maxMessages = 100) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const messages = []
    const toolsUsed = new Set()
    let model = null
    let totalTokens = 0
    let inputTokens = 0
    let outputTokens = 0
    let cacheReadTokens = 0
    let firstTimestamp = null
    let lastTimestamp = null
    let firstUserMessage = ''
    let lastAssistantMessage = ''
    let secondLastAssistantMessage = ''
    let currentThought = null

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.type === 'model_change') model = entry.modelId || entry.model
        if (entry.type !== 'message') continue
        const msg = entry.message
        if (!msg) continue

        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : null
        if (ts) {
          if (!firstTimestamp) firstTimestamp = ts
          lastTimestamp = ts
        }

        if (msg.role === 'assistant' && msg.usage) {
          totalTokens += msg.usage.totalTokens || 0
          inputTokens += msg.usage.inputTokens || msg.usage.input || 0
          outputTokens += msg.usage.outputTokens || msg.usage.output || 0
          cacheReadTokens += msg.usage.cacheReadTokens || msg.usage.cacheRead || 0
        }

        // Extract content
        let textContent = ''
        const entryToolCalls = []
        const thinkingBlocks = []

        if (typeof msg.content === 'string') {
          textContent = msg.content
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') textContent += (textContent ? '\n' : '') + part.text
            if (part.type === 'toolCall') {
              toolsUsed.add(part.name)
              entryToolCalls.push({ name: part.name, args: part.arguments ? JSON.stringify(part.arguments).slice(0, 200) : '' })
            }
            if (part.type === 'thinking') {
              thinkingBlocks.push(part.text || '')
            }
          }
        }

        // Track first user message for naming
        if (msg.role === 'user' && !firstUserMessage && textContent.length > 5) {
          firstUserMessage = textContent
        }

        // Track last assistant messages for summary
        if (msg.role === 'assistant' && textContent && textContent !== 'HEARTBEAT_OK' && textContent !== 'NO_REPLY') {
          secondLastAssistantMessage = lastAssistantMessage
          lastAssistantMessage = textContent
        }

        // Build message entry
        if (messages.length < maxMessages && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')) {
          const m = { role: msg.role, ts, content: textContent.slice(0, 2000) }
          if (entryToolCalls.length) m.toolCalls = entryToolCalls
          if (thinkingBlocks.length) m.thinking = thinkingBlocks.map(t => t.slice(0, 1000))
          messages.push(m)
        }
      } catch {}
    }

    // Summary: use last assistant message, or second-last if last was boring
    let summary = lastAssistantMessage
    if (!summary || summary === 'HEARTBEAT_OK' || summary === 'NO_REPLY') {
      summary = secondLastAssistantMessage
    }
    summary = summary ? summary.replace(/```[\s\S]*?```/g, '').replace(/\n/g, ' ').trim().slice(0, 60) : ''

    const usage = { totalTokens, inputTokens, outputTokens, cacheReadTokens }
    const cost = calculateCost(inputTokens || outputTokens ? usage : { totalTokens })
    
    // Extract current thought from recent activity
    currentThought = extractCurrentThought(lines)

    return {
      messages,
      model,
      totalTokens,
      usage,
      cost,
      toolsUsed: [...toolsUsed],
      firstUserMessage,
      summary,
      currentThought,
      startTime: firstTimestamp,
      endTime: lastTimestamp,
      duration: firstTimestamp && lastTimestamp ? Math.round((lastTimestamp - firstTimestamp) / 1000) : 0,
    }
  } catch { return null }
}

export async function GET(request) {
  const url = new URL(request.url)
  const detailId = url.searchParams.get('detail')

  // Load sessions map for key→id and id→key lookups
  const sessionsMap = getSessionsMap()
  const idToKey = {}
  const idToLabel = {}
  for (const [key, val] of Object.entries(sessionsMap)) {
    if (val.sessionId) {
      idToKey[val.sessionId] = key
      if (val.label) idToLabel[val.sessionId] = val.label
    }
  }

  // Detail view - return full transcript for one session
  if (detailId) {
    const sessionFile = path.join(SESSIONS_DIR, detailId + '.jsonl')
    if (!fs.existsSync(sessionFile)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    const parsed = parseSession(sessionFile, 500)
    const sessionKey = idToKey[detailId] || ''
    const type = classifyKey(sessionKey)
    const label = idToLabel[detailId] || ''
    let name = label ? cleanCronLabel(label) : cleanTaskName(parsed?.firstUserMessage || '')
    if (!name) name = 'Agent ' + detailId.slice(0, 8)

    return NextResponse.json({
      agent: {
        id: detailId,
        sessionKey,
        type,
        name,
        model: parsed?.model || 'unknown',
        transcript: parsed?.messages || [],
        totalTokens: parsed?.totalTokens || 0,
        usage: parsed?.usage || {},
        cost: parsed?.cost || 0,
        toolsUsed: parsed?.toolsUsed || [],
        currentThought: parsed?.currentThought || null,
        startTime: parsed?.startTime,
        endTime: parsed?.endTime,
        duration: parsed?.duration || 0,
        summary: parsed?.summary || '',
      }
    })
  }

  // List view — scan session files
  const now = Date.now()
  const todayStart = new Date().setHours(0, 0, 0, 0)
  let sessionFiles
  try {
    sessionFiles = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const full = path.join(SESSIONS_DIR, f)
        const stat = fs.statSync(full)
        return { name: f, path: full, mtime: stat.mtimeMs, size: stat.size, id: f.replace('.jsonl', '') }
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 100) // Process last 100 sessions max
  } catch { sessionFiles = [] }

  const agents = []
  const cronGroups = {} // cronParentKey → { name, runs: [], latestRun }
  let totalTokensAll = 0
  let totalCostAll = 0
  let runningCount = 0
  let completedToday = 0

  for (const sf of sessionFiles) {
    const sessionKey = idToKey[sf.id] || ''

    // Skip main session
    if (sessionKey === 'agent:main:main') continue
    // Skip if we can't identify and it's old
    if (!sessionKey && sf.mtime < now - TWO_HOURS) continue

    const type = sessionKey ? classifyKey(sessionKey) : 'subagent'
    if (type === 'main') continue

    // Quick parse - only first/last lines for list view
    const parsed = parseSession(sf.path, 5)
    if (!parsed) continue

    const label = idToLabel[sf.id] || ''
    let name = ''
    if (label) {
      name = cleanCronLabel(label)
    } else {
      name = cleanTaskName(parsed.firstUserMessage)
    }
    if (!name) name = 'Agent ' + sf.id.slice(0, 8)

    // Status
    let status = 'complete'
    if (sf.mtime > now - FIVE_MIN) {
      status = 'running'
      // Also check for .kill file
      if (fs.existsSync(sf.path.replace('.jsonl', '.kill'))) status = 'killed'
    }

    // Check for lock file
    if (fs.existsSync(sf.path + '.lock')) status = 'running'

    if (status === 'running') runningCount++
    if (sf.mtime > todayStart) completedToday++

    totalTokensAll += parsed.totalTokens
    totalCostAll += parsed.cost

    const agent = {
      id: sf.id,
      sessionKey,
      type,
      name,
      status,
      model: parsed.model || 'unknown',
      lastActive: sf.mtime,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      duration: parsed.duration,
      totalTokens: parsed.totalTokens,
      cost: parsed.cost,
      toolsUsed: parsed.toolsUsed,
      summary: parsed.summary,
      currentThought: status === 'running' ? parsed.currentThought : null,
    }

    // Group cron runs
    if (type === 'cron-run') {
      const parentKey = getCronParentKey(sessionKey)
      const parentData = sessionsMap[parentKey]
      const cronName = parentData?.label ? cleanCronLabel(parentData.label) : name
      if (!cronGroups[parentKey]) {
        cronGroups[parentKey] = { name: cronName, runs: [], latestRun: null }
      }
      cronGroups[parentKey].runs.push(agent)
      if (!cronGroups[parentKey].latestRun || sf.mtime > cronGroups[parentKey].latestRun.lastActive) {
        cronGroups[parentKey].latestRun = agent
      }
      continue // Don't add individual cron runs to agents list
    }

    agents.push(agent)
  }

  // Add grouped cron runs as single entries
  for (const [parentKey, group] of Object.entries(cronGroups)) {
    const todayRuns = group.runs.filter(r => r.lastActive > todayStart)
    const latest = group.latestRun
    if (latest) {
      agents.push({
        ...latest,
        name: group.name,
        type: 'cron',
        cronName: group.name,
        runCount: todayRuns.length,
        totalRunCount: group.runs.length,
      })
    }
  }

  // Sort by lastActive
  agents.sort((a, b) => b.lastActive - a.lastActive)

  // Build timeline (last 10 entries sorted newest first)
  const timeline = agents.slice(0, 10).map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    status: a.status,
    startTime: a.startTime,
    endTime: a.endTime,
    duration: a.duration,
    summary: a.summary,
    tokens: a.totalTokens,
    cost: a.cost,
    runCount: a.runCount,
  }))

  const stats = {
    running: runningCount,
    completedToday,
    totalTokens: totalTokensAll,
    estimatedCost: Math.round(totalCostAll * 100) / 100,
  }

  return NextResponse.json({ agents, stats, timeline, updated: new Date().toISOString() })
}

export async function POST(request) {
  try {
    const body = await request.json()

    // Kill action
    if (body.action === 'kill' && body.sessionId) {
      const killFile = path.join(SESSIONS_DIR, body.sessionId + '.kill')
      fs.writeFileSync(killFile, JSON.stringify({ killedAt: new Date().toISOString() }))
      return NextResponse.json({ success: true, killed: body.sessionId })
    }

    // Spawn action (keep existing)
    const { template, task, model = 'sonnet' } = body
    if (!template || !task) {
      return NextResponse.json({ error: 'Template and task required' }, { status: 400 })
    }

    const templateMessages = {
      research: `Use sessions_spawn to run this research task: ${task}`,
      draft: `Use sessions_spawn to run this drafting task: ${task}`,
      build: `Use sessions_spawn to run this coding task: ${task}`,
      review: `Use sessions_spawn to run this review task: ${task}`,
    }
    const message = templateMessages[template] || `Use sessions_spawn to run this task: ${task}`

    let gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1/chat/completions'
    let gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
    try {
      const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
      const tm = envContent.match(/OPENCLAW_GATEWAY_TOKEN=(.+)/); if (tm) gatewayToken = tm[1].trim()
      const um = envContent.match(/OPENCLAW_GATEWAY_URL=(.+)/); if (um) gatewayUrl = um[1].trim()
    } catch {}
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'x-openclaw-session-key': 'agent:main:main'
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: message }] })
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Spawn failed: ${response.status}` }, { status: 500 })
    }

    const result = await response.json()
    return NextResponse.json({
      success: true, template, task, model,
      response: result.choices?.[0]?.message?.content || 'Agent spawn request sent',
    })
  } catch (error) {
    return NextResponse.json({ error: `Failed: ${error.message}` }, { status: 500 })
  }
}
