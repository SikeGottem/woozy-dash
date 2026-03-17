import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

function getGatewayConfig() {
  // Read token from .env.local to avoid stale shell env vars
  try {
    const envPath = join(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const tokenMatch = envContent.match(/OPENCLAW_GATEWAY_TOKEN=(.+)/)
    const urlMatch = envContent.match(/OPENCLAW_GATEWAY_URL=(.+)/)
    return {
      url: urlMatch?.[1]?.trim() || 'http://127.0.0.1:18789/v1/chat/completions',
      token: tokenMatch?.[1]?.trim() || process.env.OPENCLAW_GATEWAY_TOKEN || ''
    }
  } catch {
    return {
      url: process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1/chat/completions',
      token: process.env.OPENCLAW_GATEWAY_TOKEN || ''
    }
  }
}

export async function POST(request) {
  try {
    const { message, sessionKey, agentId } = await request.json()
    
    // Default to main session if no sessionKey provided
    const targetSessionKey = sessionKey || 'agent:main:main'
    const targetAgentId = agentId || 'main'
    
    // Send only the latest message — the gateway session has full history
    const { url: GATEWAY_URL, token: GATEWAY_TOKEN } = getGatewayConfig()
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
