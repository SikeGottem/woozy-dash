import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { action, task, section } = await request.json()
    
    if (action === 'complete') {
      // Send a message to Woozy via the chat API to mark the task as done
      const message = `Mark this task as done: "${task}" from section "${section}"`
      
      const chatResponse = await fetch(`${process.env.OPENCLAW_API_BASE || 'http://localhost:18789'}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENCLAW_API_KEY || ''}`
        },
        body: JSON.stringify({ 
          message,
          sessionKey: 'agent:main:main'
        })
      })
      
      if (!chatResponse.ok) {
        throw new Error('Failed to communicate with Woozy')
      }
      
      return NextResponse.json({ success: true, message: 'Task completion request sent to Woozy' })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Task API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}