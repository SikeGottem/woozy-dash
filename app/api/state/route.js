import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

const STATE_FILE = path.join(os.homedir(), 'Desktop', 'WOOZY', 'woozy-dashboard-state.json')

// Ensure directory exists
function ensureDir() {
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Read current state
function readState() {
  ensureDir()
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return {
        focusMode: false,
        energy: 3,
        contextMode: 'personal',
        currentTask: 'Dashboard design',
        lastUpdated: Date.now()
      }
    }
    const data = fs.readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading state:', error)
    return {
      focusMode: false,
      energy: 3,
      contextMode: 'personal',
      currentTask: 'Dashboard design',
      lastUpdated: Date.now()
    }
  }
}

// Write state
function writeState(newState) {
  ensureDir()
  try {
    const state = { ...newState, lastUpdated: Date.now() }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
    return state
  } catch (error) {
    console.error('Error writing state:', error)
    throw error
  }
}

export async function GET() {
  try {
    const state = readState()
    return NextResponse.json({ state })
  } catch (error) {
    console.error('State GET error:', error)
    return NextResponse.json({ error: 'Failed to read state' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const updates = await request.json()
    const currentState = readState()
    const newState = { ...currentState, ...updates }
    const savedState = writeState(newState)
    
    return NextResponse.json({ state: savedState })
  } catch (error) {
    console.error('State POST error:', error)
    return NextResponse.json({ error: 'Failed to save state' }, { status: 500 })
  }
}