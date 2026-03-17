import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function POST(request) {
  try {
    const { text } = await request.json()
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text provided' }, { status: 400 })
    }

    // Create timestamp
    const now = new Date()
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 16)
    
    // Format the capture entry
    const entry = `\n${timestamp} - ${text.trim()}`
    
    // Path to INBOX.md
    const inboxPath = path.join(os.homedir(), 'Desktop', 'WOOZY', 'INBOX.md')
    
    // Ensure directory exists
    const dir = path.dirname(inboxPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // Append to INBOX.md
    fs.appendFileSync(inboxPath, entry, 'utf8')
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Capture error:', error)
    return NextResponse.json({ error: 'Failed to capture text' }, { status: 500 })
  }
}