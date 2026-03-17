import { NextResponse } from 'next/server'

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1/chat/completions'
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN

export async function POST(request) {
  try {
    const { message, sessionKey, agentId } = await request.json()
    
    // Default to main session if no sessionKey provided
    const targetSessionKey = sessionKey || 'agent:main:main'
    const targetAgentId = agentId || 'main'
    
    // Send only the latest message — the gateway session has full history
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'x-openclaw-agent-id': targetAgentId,
        'x-openclaw-session-key': targetSessionKey,
      },
      body: JSON.stringify({
        model: `openclaw:${targetAgentId}`,
        messages: [{ role: 'user', content: message }],
        stream: false,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ 
        error: `Gateway error (${res.status}): ${text}`,
        sessionKey: targetSessionKey 
      }, { status: res.status })
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || 'No response'
    
    return NextResponse.json({ 
      reply, 
      sessionKey: targetSessionKey,
      agentId: targetAgentId 
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
