'use client'
import { useState, useEffect, useRef } from 'react'

const TASK_TEMPLATES = [
  { id: 'research', name: 'RESEARCH', description: 'Spawn a research sub-agent' },
  { id: 'draft', name: 'DRAFT', description: 'Spawn a writing/drafting agent' },
  { id: 'build', name: 'BUILD', description: 'Spawn a coding sub-agent' },
  { id: 'review', name: 'REVIEW', description: 'Spawn a review/audit agent' },
]

function AgentSpawnModal({ isOpen, template, onClose, onSpawn }) {
  const [task, setTask] = useState('')
  const [model, setModel] = useState('sonnet')
  const [spawning, setSpawning] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) { setTask(''); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter' && !spawning) handleSpawn()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, spawning])

  const handleSpawn = async () => {
    if (!task.trim() || spawning) return
    setSpawning(true)
    try {
      const message = `Spawn a ${template?.id} agent with task: ${task.trim()}`
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      if (response.ok) {
        setTimeout(() => { onSpawn(); onClose() }, 1000)
      }
    } catch (error) {
      console.error('Spawn error:', error)
    }
    setSpawning(false)
  }

  if (!isOpen) return null

  return (
    <div className="agent-spawn-overlay" onClick={onClose}>
      <div className="agent-spawn-modal" onClick={e => e.stopPropagation()}>
        <div className="agent-spawn-header">SPAWN: {template?.name}</div>
        <div className="agent-spawn-input-group">
          <label className="agent-spawn-label">TASK</label>
          <input ref={inputRef} className="agent-spawn-input" value={task} onChange={e => setTask(e.target.value)} placeholder={`${template?.name.toLowerCase()}_task_description`} disabled={spawning} />
        </div>
        <div className="agent-spawn-input-group">
          <label className="agent-spawn-label">MODEL</label>
          <select className="agent-spawn-select" value={model} onChange={e => setModel(e.target.value)} disabled={spawning}>
            <option value="sonnet">Claude Sonnet</option>
            <option value="opus">Claude Opus</option>
            <option value="haiku">Claude Haiku</option>
          </select>
        </div>
        <div className="agent-spawn-actions">
          <button className="agent-spawn-btn agent-spawn-btn-secondary" onClick={onClose} disabled={spawning}>CANCEL</button>
          <button className="agent-spawn-btn agent-spawn-btn-primary" onClick={handleSpawn} disabled={!task.trim() || spawning}>{spawning ? 'REQUEST SENT...' : 'SPAWN'}</button>
        </div>
      </div>
    </div>
  )
}

function AgentDetail({ agentId, onClose }) {
  const [data, setData] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [dmMode, setDmMode] = useState(false)
  const chatInputRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    fetch(`/api/agents?detail=${agentId}`).then(r => r.json()).then(d => setData(d.agent)).catch(() => {})
  }, [agentId])

  useEffect(() => {
    if (data && data.transcript && data.transcript.messages) {
      setChatMessages(data.transcript.messages.map(m => ({
        id: Date.now() + Math.random(),
        role: m.role, content: m.content,
        timestamp: m.ts || Date.now(), fromTranscript: true
      })))
    }
  }, [data])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const sendMessage = async () => {
    if (!chatInput.trim() || sending) return
    const userMessage = { id: Date.now(), role: 'user', content: chatInput.trim(), timestamp: Date.now(), fromTranscript: false }
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setSending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, sessionKey: `agent:main:${agentId}`, agentId })
      })
      const result = await response.json()
      if (response.ok) {
        setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: result.reply, timestamp: Date.now(), fromTranscript: false }])
      } else {
        setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'system', content: `Error: ${result.error}`, timestamp: Date.now(), fromTranscript: false }])
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'system', content: `Connection error: ${error.message}`, timestamp: Date.now(), fromTranscript: false }])
    } finally {
      setSending(false)
    }
  }

  if (!data) return <div className="agent-detail-loading">Loading session data...</div>

  const t = data.transcript
  const estimatedCost = t && t.totalTokens ? (t.totalTokens * 0.000003).toFixed(4) : null
  const isActive = data.latestSession && (Date.now() - data.latestSession.mtime < 3600000)

  return (
    <div className="agent-monitor">
      <div className="agent-monitor-header">
        <button className="agent-monitor-back" onClick={onClose}>← BACK</button>
        <div className="agent-monitor-title">{data.name}</div>
        <div className="agent-monitor-controls">
          <button className={`agent-mode-toggle ${dmMode ? 'mode-dm' : 'mode-monitor'}`} onClick={() => setDmMode(!dmMode)}>{dmMode ? 'DM' : 'MONITOR'}</button>
          <div className={`agent-monitor-status ${isActive ? 'status-running' : 'status-idle'}`}>{isActive ? 'ONLINE' : 'OFFLINE'}</div>
        </div>
      </div>

      {!dmMode && (
        <>
          <div className="agent-monitor-stats">
            <div className="agent-stat"><div className="agent-stat-value">{data.sessionCount}</div><div className="agent-stat-label">SESSIONS</div></div>
            <div className="agent-stat"><div className="agent-stat-value">{t && t.totalTokens ? t.totalTokens.toLocaleString() : '0'}</div><div className="agent-stat-label">TOKENS</div></div>
            <div className="agent-stat"><div className="agent-stat-value">{estimatedCost ? `$${estimatedCost}` : '$0.00'}</div><div className="agent-stat-label">EST COST</div></div>
            <div className="agent-stat"><div className="agent-stat-value">{data.latestSession ? new Date(data.latestSession.mtime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '--'}</div><div className="agent-stat-label">LAST SEEN</div></div>
          </div>
          <div className="agent-monitor-meta">
            <div className="agent-meta-grid">
              <div className="agent-meta-item"><span className="agent-meta-key">ID</span><span className="agent-meta-val">{data.id}</span></div>
              <div className="agent-meta-item"><span className="agent-meta-key">MODEL</span><span className="agent-meta-val">{data.model}</span></div>
              {data.workspace && <div className="agent-meta-item"><span className="agent-meta-key">WORKSPACE</span><span className="agent-meta-val agent-meta-path">{data.workspace.replace('/Users/ethanwu/', '~/')}</span></div>}
            </div>
          </div>
          {t && t.toolsUsed.length > 0 && (
            <div className="agent-monitor-section">
              <div className="agent-section-title">TOOLS USED</div>
              <div className="agent-tools-used">{t.toolsUsed.map((tool, i) => <span key={i} className="agent-tool-badge">{tool}</span>)}</div>
            </div>
          )}
          {t && t.messages.length > 0 && (
            <div className="agent-monitor-section">
              <div className="agent-section-title">SESSION TRANSCRIPT</div>
              <div className="agent-transcript">
                {t.messages.map((m, i) => (
                  <div key={i} className={`agent-transcript-msg ${m.role}`}>
                    <div className="agent-msg-header">
                      <span className="agent-msg-role">{m.role.toUpperCase()}</span>
                      <span className="agent-msg-time">{new Date(m.ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="agent-msg-body">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {dmMode && (
        <div className="agent-dm-container">
          <div className="agent-dm-header">
            <div className="agent-dm-title">Direct Message with {data.name}</div>
            <div className={`agent-dm-status ${isActive ? 'dm-online' : 'dm-offline'}`}>{isActive ? '● Online' : '○ Offline'}</div>
          </div>
          <div className="agent-dm-messages">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`dm-message ${msg.role}`}>
                <div className="dm-message-content">{msg.content}</div>
                <div className="dm-message-meta">
                  <span className="dm-message-time">{new Date(msg.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.fromTranscript && <span className="dm-message-source">transcript</span>}
                </div>
              </div>
            ))}
            {sending && (
              <div className="dm-message assistant">
                <div className="dm-message-content dm-typing">{data.name} is thinking<span className="dm-typing-dots">...</span></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="agent-dm-input">
            <div className="dm-input-container">
              <input ref={chatInputRef} type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !sending) sendMessage() }} placeholder={`Message ${data.name}...`} disabled={sending} className="dm-input" />
              <button onClick={sendMessage} disabled={!chatInput.trim() || sending} className="dm-send-btn">{sending ? '...' : '→'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentPipelineView({ agents, onAgentClick }) {
  const running = agents.filter(a => a.status === 'running' || a.status === 'active')
  const recent = agents.filter(a => a.status !== 'running' && a.status !== 'active' && a.lastActive && Date.now() - a.lastActive < 3600000).slice(0, 3)

  const formatElapsed = (lastActive) => {
    if (!lastActive) return '--'
    const diff = Date.now() - lastActive
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  if (running.length === 0 && recent.length === 0) {
    return <div className="pipeline-empty">No active agents. Use task spawn buttons or chat to create one.</div>
  }

  return (
    <div className="agent-pipeline">
      {running.map(agent => (
        <div key={agent.id} className="agent-pipeline-card card-running" onClick={() => onAgentClick(agent.id)}>
          <div className="agent-card-header">
            <div className="agent-card-name">{agent.name}</div>
            <div className="agent-card-status status-running">RUNNING</div>
          </div>
          <div className="agent-card-task">{agent.taskDescription?.substring(0, 100) || agent.lastMessage?.substring(0, 100) || 'Working...'}</div>
          <div className="agent-card-meta">
            <span className="agent-card-time">{formatElapsed(agent.lastActive)}</span>
            <span className="agent-card-model">{agent.model}</span>
          </div>
          <div className="agent-card-pulse"></div>
        </div>
      ))}
      {recent.length > 0 && (
        <div className="agent-recent-row">
          <span style={{color:'#666',fontSize:'0.75rem',fontFamily:'JetBrains Mono, monospace'}}>RECENT:</span>
          {recent.map(agent => (
            <span key={agent.id} className="agent-recent-tag" onClick={() => onAgentClick(agent.id)}>
              {agent.name?.substring(0, 30)} · {formatElapsed(agent.lastActive)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentHistoryLog({ agents }) {
  const recentActivity = agents.filter(a => a.lastActive).sort((a, b) => b.lastActive - a.lastActive).slice(0, 8)

  const formatActivity = (agent) => {
    const time = new Date(agent.lastActive).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    const task = agent.lastMessage?.substring(0, 60) || 'Task completed'
    return `${agent.name}: ${task} — ${time}`
  }

  return (
    <div className="agent-history">
      <div className="agent-section-title">RECENT ACTIVITY</div>
      <div className="agent-history-list">
        {recentActivity.map((agent, i) => (
          <div key={agent.id} className="agent-history-item">
            <span className="agent-history-text">{formatActivity(agent)}</span>
          </div>
        ))}
        {recentActivity.length === 0 && <div className="agent-history-empty">No recent agent activity</div>}
      </div>
    </div>
  )
}

export default function AgentsModule() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [spawnModal, setSpawnModal] = useState({ open: false, template: null })

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents')
        const data = await res.json()
        setAgents(data.agents || [])
      } catch (err) {
        console.error('Failed to fetch agents:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
    const interval = setInterval(fetchAgents, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleSpawnAgent = () => {
    fetch('/api/agents').then(r => r.json()).then(data => setAgents(data.agents || [])).catch(() => {})
  }

  if (loading) {
    return <div className="card full"><div className="section-header">Agent Command Center</div><div className="empty-state">Initializing agent systems...</div></div>
  }

  if (selectedAgent) {
    return <div className="card full"><AgentDetail agentId={selectedAgent} onClose={() => setSelectedAgent(null)} /></div>
  }

  const runningCount = agents.filter(a => a.status === 'active').length

  return (
    <div className="card full">
      <div className="agent-command-header">
        <div className="agent-command-title">AGENT COMMAND CENTER</div>
        <div className="agent-command-stats">
          <div className="agent-stat-item">
            <span className="agent-stat-num" style={{ color: runningCount > 0 ? '#22c55e' : '#666' }}>{runningCount}</span>
            <span className="agent-stat-txt">RUNNING</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-num">{agents.length}</span>
            <span className="agent-stat-txt">TOTAL</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-num">{agents.length}</span>
            <span className="agent-stat-txt">SESSIONS</span>
          </div>
        </div>
      </div>

      <div className="agent-templates">
        <div className="agent-templates-label">QUICK SPAWN</div>
        <div className="agent-template-buttons">
          {TASK_TEMPLATES.map(template => (
            <button key={template.id} className="agent-template-btn" onClick={() => setSpawnModal({ open: true, template })}>{template.name}</button>
          ))}
        </div>
      </div>

      <AgentPipelineView agents={agents} onAgentClick={setSelectedAgent} />
      <AgentHistoryLog agents={agents} />

      <AgentSpawnModal
        isOpen={spawnModal.open}
        template={spawnModal.template}
        onClose={() => setSpawnModal({ open: false, template: null })}
        onSpawn={handleSpawnAgent}
      />
    </div>
  )
}
