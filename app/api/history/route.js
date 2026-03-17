import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const AGENTS_DIR = '/Users/ethanwu/.openclaw/agents/main/sessions'

function getRecentTranscripts(maxFiles = 10) {
  try {
    const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.jsonl'))
    if (files.length === 0) return []
    const sorted = files.map(f => ({
      name: f,
      mtime: fs.statSync(path.join(AGENTS_DIR, f)).mtimeMs
    })).sort((a, b) => b.mtime - a.mtime)
    return sorted.slice(0, maxFiles).map(f => path.join(AGENTS_DIR, f.name))
  } catch { return [] }
}

function extractMessages(lines) {
  const messages = []
  for (const line of lines) {
    try {
      const entry = JSON.parse(line)
      if (entry.type !== 'message') continue
      const msg = entry.message
      if (!msg || !msg.role) continue
      if (msg.role !== 'user' && msg.role !== 'assistant') continue

      let content = ''
      if (typeof msg.content === 'string') content = msg.content
      else if (Array.isArray(msg.content)) {
        content = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
      }

      // Skip heartbeats, empty, NO_REPLY
      if (!content || content === 'HEARTBEAT_OK' || content === 'NO_REPLY') continue
      if (content.includes('Read HEARTBEAT.md if it exists')) continue

      // For user messages, strip the metadata envelope to get actual message
      let cleanContent = content
      let channel = 'dashboard'
      if (msg.role === 'user') {
        // Detect telegram messages by metadata block
        if (content.includes('conversation_label') && content.includes('telegram')) {
          channel = 'telegram'
        }
        // Strip conversation metadata blocks
        cleanContent = content
          .replace(/Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?```\n*/g, '')
          .replace(/\[Queued messages while agent was busy\]\n*---\n*/g, '')
          .replace(/Queued #\d+\n*/g, '')
          .replace(/^System:.*$/gm, '')
          .replace(/Current time:.*$/gm, '')
          .trim()
        // If after stripping there's nothing useful, skip
        if (!cleanContent || cleanContent.length < 2) continue
      }

      // Skip tool-heavy assistant messages (keep only text responses)
      if (msg.role === 'assistant' && !content) continue

      messages.push({
        role: msg.role,
        content: cleanContent.slice(0, 800),
        ts: new Date(entry.timestamp).getTime(),
        channel
      })
    } catch {}
  }
  return messages
}

export async function GET(request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '30')
  const after = parseInt(url.searchParams.get('after') || '0')

  const transcriptPaths = getRecentTranscripts()
  if (transcriptPaths.length === 0) return NextResponse.json({ messages: [], total: 0 })

  // Read all recent transcripts and merge messages by timestamp
  let messages = []
  for (const tp of transcriptPaths) {
    try {
      const content = fs.readFileSync(tp, 'utf-8')
      const allLines = content.split('\n').filter(Boolean)
      messages.push(...extractMessages(allLines))
    } catch {}
  }
  // Dedupe by role+ts and sort chronologically
  const seen = new Set()
  messages = messages.filter(m => {
    const key = `${m.role}:${m.ts}:${m.content?.slice(0, 50)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.ts - b.ts)

  let filtered = after > 0 ? messages.filter(m => m.ts && m.ts > after) : messages
  const result = filtered.slice(-limit)

  return NextResponse.json({ messages: result, total: messages.length })
}
