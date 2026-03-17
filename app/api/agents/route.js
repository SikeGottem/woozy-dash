import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = '/Users/ethanwu/.openclaw/openclaw.json'

function getConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
}

function getSessionFiles(agentId) {
  const dirs = [
    `/Users/ethanwu/.openclaw/agents/${agentId}/sessions`,
    '/Users/ethanwu/.openclaw/workspace',
  ]
  const files = []
  for (const dir of dirs) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.jsonl')) continue
        const full = path.join(dir, f)
        const stat = fs.statSync(full)
        files.push({ path: full, mtime: stat.mtimeMs, size: stat.size, name: f })
      }
    } catch {}
  }
  return files.sort((a, b) => b.mtime - a.mtime)
}

function parseTranscript(filePath, maxMessages = 5) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const messages = []
    const toolCalls = []
    let model = null
    let totalTokens = 0

    // Read all lines for metadata, last N for messages
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.type === 'model_change') model = entry.model
        if (entry.type === 'message' && entry.message) {
          const msg = entry.message
          if (msg.role === 'assistant' && msg.usage) {
            totalTokens += msg.usage.totalTokens || 0
          }
          if (msg.role === 'user' || msg.role === 'assistant') {
            let content = ''
            if (typeof msg.content === 'string') content = msg.content
            else if (Array.isArray(msg.content)) {
              // Extract text and tool calls
              const texts = msg.content.filter(c => c.type === 'text').map(c => c.text)
              const tools = msg.content.filter(c => c.type === 'toolCall')
              content = texts.join('\n')
              for (const t of tools) {
                toolCalls.push({ name: t.name, ts: entry.timestamp })
              }
            }
            if (content && content !== 'HEARTBEAT_OK' && content !== 'NO_REPLY' && !content.includes('Read HEARTBEAT.md')) {
              // Clean user messages
              let clean = content
              if (msg.role === 'user') {
                clean = content
                  .replace(/Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?```\n*/g, '')
                  .replace(/\[Queued messages.*?\]\n*---\n*/g, '')
                  .replace(/Queued #\d+\n*/g, '')
                  .replace(/^System:.*$/gm, '')
                  .replace(/Current time:.*$/gm, '')
                  .trim()
              }
              if (clean.length > 0) {
                messages.push({
                  role: msg.role,
                  content: clean.slice(0, 300),
                  ts: entry.timestamp,
                })
              }
            }
          }
        }
      } catch {}
    }

    // Unique tool names used
    const toolsUsed = [...new Set(toolCalls.map(t => t.name))]

    return {
      messages: messages.slice(-maxMessages),
      totalMessages: messages.length,
      toolsUsed: toolsUsed.slice(-15),
      recentTools: toolCalls.slice(-10).map(t => t.name),
      model,
      totalTokens,
    }
  } catch { return null }
}

export async function GET(request) {
  const url = new URL(request.url)
  const detailId = url.searchParams.get('detail')

  const config = getConfig()
  const agents = config.agents.list

  // If detail requested, return full info for one agent
  if (detailId) {
    // First try session file directly (detailId is the jsonl filename without extension)
    const sessionsDir = '/Users/ethanwu/.openclaw/agents/main/sessions'
    const sessionFile = path.join(sessionsDir, detailId + '.jsonl')
    
    if (fs.existsSync(sessionFile)) {
      const stat = fs.statSync(sessionFile)
      const transcript = parseTranscript(sessionFile, 30)
      
      // Extract session key and name from transcript
      let sessionKey = null
      let name = detailId.slice(0, 8)
      try {
        const firstLines = fs.readFileSync(sessionFile, 'utf-8').split('\n').slice(0, 5)
        for (const line of firstLines) {
          try {
            const entry = JSON.parse(line)
            if (entry.type === 'session_start') sessionKey = entry.sessionKey || entry.key
          } catch {}
        }
      } catch {}

      return NextResponse.json({
        agent: {
          id: detailId,
          name: name,
          model: transcript?.model || 'default',
          sessionKey,
          sessionCount: 1,
          latestSession: { file: detailId + '.jsonl', mtime: stat.mtimeMs, size: stat.size },
          transcript,
        }
      })
    }

    // Fallback to config-based lookup
    const agent = agents.find(a => a.id === detailId)
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const sessions = getSessionFiles(detailId)
    const latestSession = sessions[0]
    let transcript = null
    if (latestSession) {
      transcript = parseTranscript(latestSession.path, 15)
    }

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name || agent.id,
        model: agent.model || 'default',
        workspace: agent.workspace || null,
        tools: agent.tools || null,
        sessionCount: sessions.length,
        latestSession: latestSession ? {
          file: latestSession.name,
          mtime: latestSession.mtime,
          size: latestSession.size,
        } : null,
        transcript,
      }
    })
  }

  // Scan live sessions from the sessions directory (includes sub-agents)
  const sessionsDir = '/Users/ethanwu/.openclaw/agents/main/sessions'
  const liveAgents = []
  
  try {
    const sessionFiles = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const full = path.join(sessionsDir, f)
        const stat = fs.statSync(full)
        return { name: f, path: full, mtime: stat.mtimeMs, size: stat.size }
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 30) // Last 30 sessions

    for (const sf of sessionFiles) {
      try {
        const content = fs.readFileSync(sf.path, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)
        
        // Extract session info from first few lines and last few lines
        let sessionKey = null
        let label = null
        let model = null
        let lastMessage = 'No activity'
        let taskDescription = ''
        let totalTokens = 0
        const fiveMinAgo = Date.now() - 5 * 60 * 1000
        const hourAgo = Date.now() - 60 * 60 * 1000

        // Read first lines for session metadata
        for (const line of lines.slice(0, 5)) {
          try {
            const entry = JSON.parse(line)
            if (entry.type === 'session_start') {
              sessionKey = entry.sessionKey || entry.key
              label = entry.label
            }
            if (entry.type === 'model_change') model = entry.model
            // First user message is often the task
            if (entry.type === 'message' && entry.message?.role === 'user' && !taskDescription) {
              let text = typeof entry.message.content === 'string' ? entry.message.content : 
                Array.isArray(entry.message.content) ? entry.message.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : ''
              // Clean metadata
              text = text.replace(/Conversation info[\s\S]*?```\n*/g, '').replace(/Current time:.*$/gm, '').trim()
              if (text.length > 5) taskDescription = text.slice(0, 200)
            }
          } catch {}
        }

        // Read last lines for latest activity
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
          try {
            const entry = JSON.parse(lines[i])
            if (entry.type === 'message' && entry.message?.role === 'assistant') {
              if (entry.message.usage) totalTokens += entry.message.usage.totalTokens || 0
              let text = typeof entry.message.content === 'string' ? entry.message.content :
                Array.isArray(entry.message.content) ? entry.message.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : ''
              if (text && text !== 'HEARTBEAT_OK' && text !== 'NO_REPLY' && !text.includes('Read HEARTBEAT.md')) {
                if (lastMessage === 'No activity') lastMessage = text.slice(0, 150)
              }
            }
          } catch {}
        }

        // Skip the main session transcript (that's "you", not a sub-agent)
        if (sessionKey === 'agent:main:main') continue
        // Skip heartbeat-only sessions
        if (lastMessage === 'No activity' && !taskDescription) continue

        // Determine status
        let status = 'complete'
        if (sf.mtime > fiveMinAgo) status = 'running'
        else if (sf.mtime > hourAgo) status = 'complete'
        else status = 'idle'

        // Check for lock file (indicates actively running)
        const lockFile = sf.path + '.lock'
        if (fs.existsSync(lockFile)) status = 'running'

        // Derive a friendly name and clean task description
        let name = label || ''
        let cleanTask = taskDescription || ''
        
        // Clean task description — strip ALL metadata aggressively
        cleanTask = cleanTask
          .replace(/Conversation info[\s\S]*?```\n*/g, '')
          .replace(/```json[\s\S]*?```/g, '')
          .replace(/json\s*\{[^}]*\}\s*```?\n*/g, '')
          .replace(/\[Queued.*?\]\n*---\n*/g, '')
          .replace(/Queued #\d+\n*/g, '')
          .replace(/^System:.*$/gm, '')
          .replace(/Current time:.*$/gm, '')
          .replace(/Read HEARTBEAT\.md.*$/gm, '')
          .replace(/\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+GMT[^\]]*\]/g, '')
          .replace(/\[cron:[^\]]*\]/g, '')
          .replace(/^#{1,3}\s*/gm, '')
          .replace(/\*\*/g, '')
          .replace(/^[\s\n]*/, '')
          .trim()

        if (!name || name.includes('subagent:') || name.includes('agent:main:') || name.includes('cron:') || name.includes('openai:')) {
          if (cleanTask) {
            // Strip common prefixes aggressively
            let cleaned = cleanTask
              .replace(/^(?:Task:?\s*)/i, '')
              .replace(/^(?:Use sessions_spawn to[^:]*:\s*)/i, '')
              .replace(/^(?:Spawn a \w+ agent[^:]*:\s*)/i, '')
              .replace(/^(?:IMPORTANT[^:]*:\s*)/i, '')
              .replace(/^(?:Context:?\s*)/i, '')
              .replace(/^[\s\n]+/, '')
            const titleMatch = cleaned.match(/^(.{5,80}?)(?:\n|$)/)
            let extracted = titleMatch ? titleMatch[1].trim() : cleaned.slice(0, 60)
            // Strip any remaining metadata fragments
            extracted = extracted.replace(/^json\s*\{.*/, '').replace(/^```.*/, '').replace(/^\[.*?\]\s*/, '').trim()
            name = extracted || 'Agent'
            // Clean up trailing punctuation/fragments
            name = name.replace(/[—\-:,.]$/, '').trim()
            // Truncate at sensible boundary
            if (name.length > 50) name = name.slice(0, 50).replace(/\s\S*$/, '...')
          } else {
            name = 'Agent ' + (sessionKey || sf.name).split(':').pop().slice(0, 8)
          }
        }
        if (name.includes('Cron:')) name = name.replace('Cron: ', '')
        // Final safety — if name still looks like metadata, use generic
        if (name.startsWith('json') || name.startsWith('{') || name.startsWith('[cron') || name.startsWith('[Tue') || name.startsWith('[Mon')) {
          name = 'Agent ' + sf.name.slice(0, 8)
        }
        
        // Clean lastMessage too — strip metadata
        if (lastMessage && lastMessage !== 'No activity') {
          lastMessage = lastMessage
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/json\s*\{[^}]*\}/g, '')
            .replace(/Conversation info[\s\S]*$/g, '')
            .replace(/\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}[^\]]*\]/g, '')
            .replace(/\[cron:[^\]]*\]/g, '')
            .replace(/^\[.*?\]\s*/, '')
            .replace(/^#{1,3}\s*/g, '')
            .replace(/\*\*/g, '')
            .replace(/^[\s\n]*/, '')
            .trim()
          if (lastMessage.length < 5) lastMessage = cleanTask.slice(0, 100) || 'Working...'
        }

        liveAgents.push({
          id: sf.name.replace('.jsonl', ''),
          sessionKey,
          name,
          status,
          lastActive: sf.mtime,
          lastMessage,
          taskDescription: cleanTask.replace(/^(?:Task:?\s*)/i, '').replace(/^(?:Use sessions_spawn[^:]*:\s*)/i, '').replace(/^(?:Spawn a \w+ agent[^:]*:\s*)/i, '').slice(0, 200),
          model: model || 'default',
          totalTokens,
          file: sf.name,
        })
      } catch {}
    }
  } catch {}

  return NextResponse.json({ agents: liveAgents, updated: new Date().toISOString() })
}

export async function POST(request) {
  try {
    const { template, task, model = 'sonnet' } = await request.json()

    if (!template || !task) {
      return NextResponse.json({ error: 'Template and task are required' }, { status: 400 })
    }

    // Create the spawn command based on template
    const templateMessages = {
      research: `Use sessions_spawn to run this research task: ${task}`,
      draft: `Use sessions_spawn to run this drafting task: ${task}`,
      build: `Use sessions_spawn to run this coding task: ${task}`,
      review: `Use sessions_spawn to run this review task: ${task}`,
    }

    const message = templateMessages[template] || `Use sessions_spawn to run this task: ${task}`

    // Call OpenClaw Gateway to spawn the agent
    const response = await fetch('http://127.0.0.1:18789/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer REDACTED',
        'x-openclaw-session-key': 'agent:main:main'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gateway error:', response.status, errorText)
      return NextResponse.json(
        { error: `Failed to spawn agent: ${response.status}` }, 
        { status: 500 }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      template,
      task,
      model,
      response: result.choices?.[0]?.message?.content || 'Agent spawn request sent',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Spawn error:', error)
    return NextResponse.json(
      { error: `Spawn failed: ${error.message}` }, 
      { status: 500 }
    )
  }
}
