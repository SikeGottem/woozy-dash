import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'daily-rhythm.json')

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  } catch (error) {
    // Directory already exists
  }
}

// Get today's date in YYYY-MM-DD format
function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

// Read current data
async function readData() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    // File doesn't exist or is invalid, return default structure
    return {
      date: getTodayString(),
      morningReport: {
        postedAt: null,
        weather: null,
        events: [],
        tasks: [],
        overdue: [],
        research: null
      },
      arvoReview: {
        postedAt: null,
        taskResults: null
      },
      eveningCheckin: {
        postedAt: null,
        responses: null
      },
      gym: {
        nudgeSent: false,
        completed: null
      }
    }
  }
}

// Write data
async function writeData(data) {
  await ensureDataDir()
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

// GET: Return today's rhythm state
export async function GET() {
  try {
    const data = await readData()
    const today = getTodayString()
    
    // If data is from a previous day, reset it
    if (data.date !== today) {
      const newData = {
        date: today,
        morningReport: {
          postedAt: null,
          weather: null,
          events: [],
          tasks: [],
          overdue: [],
          research: null
        },
        arvoReview: {
          postedAt: null,
          taskResults: null
        },
        eveningCheckin: {
          postedAt: null,
          responses: null
        },
        gym: {
          nudgeSent: false,
          completed: null
        }
      }
      await writeData(newData)
      return NextResponse.json(newData)
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to read daily rhythm data:', error)
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 })
  }
}

// POST: Update rhythm data
export async function POST(request) {
  try {
    const body = await request.json()
    const { type, data: updateData } = body
    
    if (!type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 })
    }
    
    const currentData = await readData()
    const today = getTodayString()
    
    // Ensure we're working with today's data
    if (currentData.date !== today) {
      currentData.date = today
    }
    
    const timestamp = new Date().toISOString()
    
    switch (type) {
      case 'morning-report':
        currentData.morningReport = {
          postedAt: timestamp,
          weather: updateData.weather || null,
          events: updateData.events || [],
          tasks: updateData.tasks || [],
          overdue: updateData.overdue || [],
          research: updateData.research || null
        }
        break
        
      case 'arvo-review':
        currentData.arvoReview = {
          postedAt: timestamp,
          taskResults: updateData.taskResults || null
        }
        break
        
      case 'evening-checkin':
        currentData.eveningCheckin = {
          postedAt: timestamp,
          responses: updateData.responses || null
        }
        break
        
      case 'gym-nudge':
        if (updateData.action === 'sent') {
          currentData.gym.nudgeSent = true
        } else if (updateData.action === 'completed') {
          currentData.gym.completed = updateData.result || null
        }
        break
        
      case 'task-update':
        // Update task completion status
        if (currentData.morningReport.tasks && updateData.taskIndex !== undefined) {
          const taskIndex = updateData.taskIndex
          if (currentData.morningReport.tasks[taskIndex]) {
            currentData.morningReport.tasks[taskIndex].status = updateData.status
          }
        }
        break
        
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    
    await writeData(currentData)
    return NextResponse.json(currentData)
    
  } catch (error) {
    console.error('Failed to update daily rhythm data:', error)
    return NextResponse.json({ error: 'Failed to update data' }, { status: 500 })
  }
}