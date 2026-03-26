import { NextResponse } from 'next/server'

const PROJECTS = [
  { id: 1, name: 'Headland Montessori', aliases: ['headland', 'hm', 'montessori'] },
  { id: 2, name: 'Bristlecone', aliases: ['bristlecone', 'bc'] },
  { id: 3, name: 'S17 Skincare', aliases: ['s17', 's17 skincare'] },
  { id: 5, name: 'CODE1110', aliases: ['code1110', 'code 1110'] },
  { id: 7, name: 'COMM0999', aliases: ['comm0999', 'comm 0999'] },
  { id: 4, name: 'COMM1100', aliases: ['comm1100', 'comm 1100'] },
  { id: 6, name: 'FADA1010', aliases: ['fada1010', 'fada 1010'] },
  { id: 9, name: 'Limage', aliases: ['limage'] },
  { id: 8, name: 'Roster AI', aliases: ['roster', 'roster ai'] },
  { id: 10, name: 'DT Tutoring', aliases: ['dt tutoring', 'tutoring'] },
]

const UNI_PROJECTS = [5, 7, 4, 6] // CODE1110, COMM0999, COMM1100, FADA1010

export async function POST(request) {
  try {
    const { input } = await request.json()
    if (!input?.trim()) return NextResponse.json({ error: 'Input required' }, { status: 400 })

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN

    if (gatewayUrl && gatewayToken) {
      try {
        const result = await parseWithAI(input, gatewayUrl, gatewayToken)
        return NextResponse.json(result)
      } catch (e) {
        console.error('AI parse failed, falling back:', e.message)
      }
    }

    const result = parseWithRegex(input)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function parseWithAI(input, gatewayUrl, token) {
  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })
  const todayStr = today.toISOString().split('T')[0]

  const projects = PROJECTS.map(p => `${p.id}: ${p.name}`).join(', ')

  const res = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Parse this task input into structured data. Today is ${dayOfWeek} ${todayStr}.

Projects: ${projects}
University projects: CODE1110, COMM0999, COMM1100, FADA1010

Input: "${input}"

Return ONLY valid JSON (no markdown):
{
  "title": "cleaned up title (proper capitalization, remove date/project references)",
  "project_id": number or null,
  "due_date": "YYYY-MM-DD" or null,
  "due_time": "HH:MM" or null,
  "priority": "critical"|"high"|"medium"|"low",
  "category": "client"|"university"|"personal"|"admin",
  "section": "this_week"|"upcoming"|"someday"
}

Rules:
- If a university course code is mentioned, set project_id to that course and category to "university"
- "headland"/"hm" → Headland Montessori (client), "s17" → S17 Skincare (client), "bristlecone"/"bc" → Bristlecone (client)
- "tomorrow" = next day, "friday" = this coming friday, "next week" = next monday
- If deadline is within 7 days → section "this_week", else "upcoming"
- Tasks with deadlines today/tomorrow → priority "high"
- Client work defaults to "high" priority`
      }]
    })
  })

  if (!res.ok) throw new Error(`AI API returned ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in AI response')
  return JSON.parse(jsonMatch[0])
}

function parseWithRegex(input) {
  const lower = input.toLowerCase()
  const today = new Date()
  let title = input.trim()
  let project_id = null
  let due_date = null
  let due_time = null
  let priority = 'medium'
  let category = 'personal'
  let section = 'this_week'

  // Match project
  for (const p of PROJECTS) {
    for (const alias of p.aliases) {
      const re = new RegExp(`\\b${alias.replace(/\s+/g, '\\s*')}\\b`, 'i')
      if (re.test(lower)) {
        project_id = p.id
        category = UNI_PROJECTS.includes(p.id) ? 'university' : 'client'
        title = title.replace(re, '').trim()
        break
      }
    }
    if (project_id) break
  }

  // Match dates
  const datePatterns = [
    { re: /\b(?:by |due )?tomorrow(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i, fn: (m) => {
      const d = new Date(today); d.setDate(d.getDate() + 1)
      due_date = d.toISOString().split('T')[0]
      if (m[1]) { let h = parseInt(m[1]); if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12; due_time = `${String(h).padStart(2,'0')}:${m[2] || '00'}` }
    }},
    { re: /\b(?:by |due )?today(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i, fn: (m) => {
      due_date = today.toISOString().split('T')[0]
      if (m[1]) { let h = parseInt(m[1]); if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12; due_time = `${String(h).padStart(2,'0')}:${m[2] || '00'}` }
    }},
    { re: /\b(?:by |due |on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, fn: (m) => {
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
      const target = days.indexOf(m[1].toLowerCase())
      const d = new Date(today); let diff = target - d.getDay(); if (diff <= 0) diff += 7
      d.setDate(d.getDate() + diff)
      due_date = d.toISOString().split('T')[0]
    }},
    { re: /\b(?:by |due )?next week\b/i, fn: () => {
      const d = new Date(today); d.setDate(d.getDate() + (8 - d.getDay())); // next monday
      due_date = d.toISOString().split('T')[0]
      section = 'upcoming'
    }},
    { re: /\bdue\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, fn: (m) => {
      due_date = today.toISOString().split('T')[0]
      let h = parseInt(m[1]); if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12
      due_time = `${String(h).padStart(2,'0')}:${m[2] || '00'}`
    }},
  ]

  for (const { re, fn } of datePatterns) {
    const m = title.match(re)
    if (m) { fn(m); title = title.replace(re, '').trim(); break }
  }

  // Clean up title
  title = title.replace(/\b(by|due|on)\s*$/i, '').replace(/\s{2,}/g, ' ').trim()
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1)

  // Priority heuristics
  if (due_date) {
    const diff = Math.ceil((new Date(due_date) - today) / (1000*60*60*24))
    if (diff <= 1) priority = 'high'
    if (diff > 7) section = 'upcoming'
  }
  if (category === 'client') priority = 'high'

  return { title, project_id, due_date, due_time, priority, category, section }
}
