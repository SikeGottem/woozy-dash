import fs from 'fs'
import path from 'path'

function getTodaysEvents() {
  const today = new Date().toISOString().split('T')[0]
  
  // Try to read from daily rhythm data first
  try {
    const rhythmFile = path.join(process.cwd(), 'data', 'daily-rhythm.json')
    if (fs.existsSync(rhythmFile)) {
      const rhythmData = JSON.parse(fs.readFileSync(rhythmFile, 'utf8'))
      if (rhythmData.date === today && rhythmData.morningReport?.events) {
        return rhythmData.morningReport.events
      }
    }
  } catch (error) {
    console.error('Error reading rhythm data:', error)
  }
  
  // Fallback: try to read from events cache
  try {
    const eventsFile = path.join(process.cwd(), 'data', 'events-cache.json')
    if (fs.existsSync(eventsFile)) {
      const eventsData = JSON.parse(fs.readFileSync(eventsFile, 'utf8'))
      if (eventsData.date === today) {
        return eventsData.events || []
      }
    }
  } catch (error) {
    console.error('Error reading events cache:', error)
  }
  
  // Default: return sample events based on day of week
  const dayOfWeek = new Date().getDay()
  const sampleEvents = {
    0: [], // Sunday
    1: [ // Monday
      { time: '10:00', title: 'COMM1100 Lecture', type: 'uni', location: 'CLB 5' },
      { time: '15:00', title: '💪 Gym', type: 'personal', recurring: true }
    ],
    2: [ // Tuesday
      { time: '14:00', title: 'FADA1010 Workshop', type: 'uni', location: 'Art & Design' },
      { time: '16:00', title: 'Bristlecone call', type: 'work' }
    ],
    3: [ // Wednesday
      { time: '09:00', title: 'CODE1110 Lecture', type: 'uni', location: 'CSE' },
      { time: '15:00', title: '💪 Gym', type: 'personal', recurring: true }
    ],
    4: [ // Thursday
      { time: '10:00', title: 'COMM1100 Tutorial', type: 'uni', location: 'ASB' },
      { time: '15:00', title: '💪 Gym', type: 'personal', recurring: true }
    ],
    5: [ // Friday
      { time: '11:00', title: 'FADA1010 Lecture', type: 'uni', location: 'Red Centre' },
      { time: '15:00', title: '💪 Gym', type: 'personal', recurring: true }
    ],
    6: [ // Saturday
      { time: '10:00', title: '💪 Gym', type: 'personal', recurring: true },
      { time: '14:00', title: 'Family time', type: 'personal' }
    ]
  }
  
  return sampleEvents[dayOfWeek] || []
}

function setTodaysEvents(events) {
  const today = new Date().toISOString().split('T')[0]
  const eventsFile = path.join(process.cwd(), 'data', 'events-cache.json')
  
  try {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    const eventsData = {
      date: today,
      events,
      updatedAt: new Date().toISOString()
    }
    
    fs.writeFileSync(eventsFile, JSON.stringify(eventsData, null, 2))
  } catch (error) {
    console.error('Error writing events cache:', error)
  }
}

export async function GET() {
  try {
    const events = getTodaysEvents()
    return Response.json({ events })
  } catch (error) {
    console.error('Events API error:', error)
    return Response.json({ events: [] })
  }
}

export async function POST(request) {
  try {
    const { events } = await request.json()
    setTodaysEvents(events)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Events API error:', error)
    return Response.json({ error: 'Failed to update events' }, { status: 500 })
  }
}