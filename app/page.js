'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

function MatrixRain() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789$¥€£'.split('')
    const fontSize = 14
    const columns = Math.floor(canvas.width / fontSize)
    const drops = Array(columns).fill(1).map(() => Math.random() * -100)
    const timer = setInterval(() => {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.06)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = `${fontSize}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillStyle = Math.random() > 0.98 ? 'rgba(255,255,255,0.7)' : `rgba(0,255,65,${0.08 + Math.random() * 0.1})`
        ctx.fillText(char, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      }
    }, 50)
    return () => { clearInterval(timer); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="matrix-rain" />
}

// === CHART COMPONENTS ===

function DonutChart({ segments, size = 180, stroke = 24 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const pct = seg.value / total
        const dashLen = pct * circ
        const dashOffset = -offset * circ
        offset += pct
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${circ - dashLen}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        )
      })}
    </svg>
  )
}

function BarChart({ items, maxVal }) {
  const max = maxVal || Math.max(...items.map(i => i.value), 1)
  return (
    <div className="bar-chart">
      {items.map((item, i) => (
        <div key={i} className="bar-row">
          <div className="bar-label">{item.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{
              width: `${(item.value / max) * 100}%`,
              background: item.color || 'rgba(255,255,255,0.8)',
              transition: 'width 0.8s ease'
            }} />
          </div>
          <div className="bar-value" style={{ color: item.color || '#fff' }}>{item.display}</div>
        </div>
      ))}
    </div>
  )
}

function StackedBar({ segments, height = 32 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  return (
    <div className="stacked-bar" style={{ height }}>
      {segments.map((seg, i) => (
        <div key={i} className="stacked-segment" style={{
          width: `${(seg.value / total) * 100}%`,
          background: seg.color,
        }} title={`${seg.label}: $${seg.value.toLocaleString()}`} />
      ))}
    </div>
  )
}

function MiniStat({ label, value, sub, color }) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-value" style={{ color: color || '#fff' }}>{value}</div>
      <div className="mini-stat-label">{label}</div>
      {sub && <div className="mini-stat-sub">{sub}</div>}
    </div>
  )
}

// === AGENT COMMAND CENTER ===
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
    if (isOpen) {
      setTask('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
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
      // Use chat mechanism for more reliable spawning
      const message = `Spawn a ${template?.id} agent with task: ${task.trim()}`
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      
      if (response.ok) {
        // Show success state briefly before closing
        setTimeout(() => {
          onSpawn()
          onClose()
        }, 1000)
      } else {
        console.error('Failed to send spawn request')
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
          <input
            ref={inputRef}
            className="agent-spawn-input"
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder={`${template?.name.toLowerCase()}_task_description`}
            disabled={spawning}
          />
        </div>
        <div className="agent-spawn-input-group">
          <label className="agent-spawn-label">MODEL</label>
          <select 
            className="agent-spawn-select" 
            value={model} 
            onChange={e => setModel(e.target.value)}
            disabled={spawning}
          >
            <option value="sonnet">Claude Sonnet</option>
            <option value="opus">Claude Opus</option>
            <option value="haiku">Claude Haiku</option>
          </select>
        </div>
        <div className="agent-spawn-actions">
          <button className="agent-spawn-btn agent-spawn-btn-secondary" onClick={onClose} disabled={spawning}>
            CANCEL
          </button>
          <button 
            className="agent-spawn-btn agent-spawn-btn-primary" 
            onClick={handleSpawn}
            disabled={!task.trim() || spawning}
          >
            {spawning ? 'REQUEST SENT...' : 'SPAWN'}
          </button>
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
      // Initialize chat with existing transcript messages
      setChatMessages(data.transcript.messages.map(m => ({
        id: Date.now() + Math.random(),
        role: m.role,
        content: m.content,
        timestamp: m.ts || Date.now(),
        fromTranscript: true
      })))
    }
  }, [data])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendMessage = async () => {
    if (!chatInput.trim() || sending) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
      fromTranscript: false
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionKey: `agent:main:${agentId}`,
          agentId: agentId
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        const agentMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.reply,
          timestamp: Date.now(),
          fromTranscript: false
        }
        setChatMessages(prev => [...prev, agentMessage])
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          role: 'system',
          content: `Error: ${result.error}`,
          timestamp: Date.now(),
          fromTranscript: false
        }
        setChatMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'system',
        content: `Connection error: ${error.message}`,
        timestamp: Date.now(),
        fromTranscript: false
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !sending) {
      sendMessage()
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
          <button 
            className={`agent-mode-toggle ${dmMode ? 'mode-dm' : 'mode-monitor'}`}
            onClick={() => setDmMode(!dmMode)}
          >
            {dmMode ? 'DM' : 'MONITOR'}
          </button>
          <div className={`agent-monitor-status ${isActive ? 'status-running' : 'status-idle'}`}>
            {isActive ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {!dmMode && (
        <>
          <div className="agent-monitor-stats">
            <div className="agent-stat">
              <div className="agent-stat-value">{data.sessionCount}</div>
              <div className="agent-stat-label">SESSIONS</div>
            </div>
            <div className="agent-stat">
              <div className="agent-stat-value">{t && t.totalTokens ? t.totalTokens.toLocaleString() : '0'}</div>
              <div className="agent-stat-label">TOKENS</div>
            </div>
            <div className="agent-stat">
              <div className="agent-stat-value">{estimatedCost ? `$${estimatedCost}` : '$0.00'}</div>
              <div className="agent-stat-label">EST COST</div>
            </div>
            <div className="agent-stat">
              <div className="agent-stat-value">{data.latestSession ? new Date(data.latestSession.mtime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '--'}</div>
              <div className="agent-stat-label">LAST SEEN</div>
            </div>
          </div>

          <div className="agent-monitor-meta">
            <div className="agent-meta-grid">
              <div className="agent-meta-item">
                <span className="agent-meta-key">ID</span>
                <span className="agent-meta-val">{data.id}</span>
              </div>
              <div className="agent-meta-item">
                <span className="agent-meta-key">MODEL</span>
                <span className="agent-meta-val">{data.model}</span>
              </div>
              {data.workspace && (
                <div className="agent-meta-item">
                  <span className="agent-meta-key">WORKSPACE</span>
                  <span className="agent-meta-val agent-meta-path">{data.workspace.replace('/Users/ethanwu/', '~/')}</span>
                </div>
              )}
            </div>
          </div>

          {t && t.toolsUsed.length > 0 && (
            <div className="agent-monitor-section">
              <div className="agent-section-title">TOOLS USED</div>
              <div className="agent-tools-used">
                {t.toolsUsed.map((tool, i) => (
                  <span key={i} className="agent-tool-badge">{tool}</span>
                ))}
              </div>
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
            <div className={`agent-dm-status ${isActive ? 'dm-online' : 'dm-offline'}`}>
              {isActive ? '● Online' : '○ Offline'}
            </div>
          </div>

          <div className="agent-dm-messages">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`dm-message ${msg.role}`}>
                <div className="dm-message-content">
                  {msg.content}
                </div>
                <div className="dm-message-meta">
                  <span className="dm-message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.fromTranscript && <span className="dm-message-source">transcript</span>}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="dm-message assistant">
                <div className="dm-message-content dm-typing">
                  {data.name} is thinking<span className="dm-typing-dots">...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="agent-dm-input">
            <div className="dm-input-container">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${data.name}...`}
                disabled={sending}
                className="dm-input"
              />
              <button 
                onClick={sendMessage}
                disabled={!chatInput.trim() || sending}
                className="dm-send-btn"
              >
                {sending ? '...' : '→'}
              </button>
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
    const hours = Math.floor(mins / 60)
    return `${hours}h ago`
  }

  if (running.length === 0 && recent.length === 0) {
    return <div className="pipeline-empty">No active agents. Use task spawn buttons or chat to create one.</div>
  }

  return (
    <div className="agent-pipeline">
      {running.length > 0 && running.map(agent => (
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
  const recentActivity = agents
    .filter(a => a.lastActive)
    .sort((a, b) => b.lastActive - a.lastActive)
    .slice(0, 8)

  const formatActivity = (agent) => {
    const time = new Date(agent.lastActive).toLocaleString('en-AU', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false 
    })
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
        {recentActivity.length === 0 && (
          <div className="agent-history-empty">No recent agent activity</div>
        )}
      </div>
    </div>
  )
}

function AgentsModule() {
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
    const interval = setInterval(fetchAgents, 15000) // Faster polling for active agents
    return () => clearInterval(interval)
  }, [])

  const handleSpawnAgent = () => {
    // Refresh agents after spawning
    fetch('/api/agents').then(r => r.json()).then(data => setAgents(data.agents || [])).catch(() => {})
  }

  if (loading) {
    return <div className="card full"><div className="section-header">Agent Command Center</div><div className="empty-state">Initializing agent systems...</div></div>
  }

  if (selectedAgent) {
    return (
      <div className="card full">
        <AgentDetail agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />
      </div>
    )
  }

  const runningCount = agents.filter(a => a.status === 'active').length
  const totalSessions = agents.length

  return (
    <div className="card full">
      <div className="agent-command-header">
        <div className="agent-command-title">AGENT COMMAND CENTER</div>
        <div className="agent-command-stats">
          <div className="agent-stat-item">
            <span className="agent-stat-num" style={{ color: runningCount > 0 ? '#22c55e' : '#666' }}>
              {runningCount}
            </span>
            <span className="agent-stat-txt">RUNNING</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-num">{agents.length}</span>
            <span className="agent-stat-txt">TOTAL</span>
          </div>
          <div className="agent-stat-item">
            <span className="agent-stat-num">{totalSessions}</span>
            <span className="agent-stat-txt">SESSIONS</span>
          </div>
        </div>
      </div>

      <div className="agent-templates">
        <div className="agent-templates-label">QUICK SPAWN</div>
        <div className="agent-template-buttons">
          {TASK_TEMPLATES.map(template => (
            <button 
              key={template.id}
              className="agent-template-btn"
              onClick={() => setSpawnModal({ open: true, template })}
            >
              {template.name}
            </button>
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

// === COMMAND HUD ===
function CommandToolbar({ 
  onCapture, 
  unlocked, 
  onLock, 
  focusMode, 
  setFocusMode, 
  contextMode, 
  setContextMode,
  energy,
  setEnergy,
  timer,
  setTimer,
  timerSeconds,
  setTimerSeconds,
  currentTask,
  setCurrentTask
}) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stateLoaded, setStateLoaded] = useState(false)

  // Load state from API on mount - only when not already passed as props
  useEffect(() => {
    const loadState = async () => {
      try {
        const response = await fetch('/api/state')
        const data = await response.json()
        if (data.state) {
          if (setFocusMode) setFocusMode(data.state.focusMode || false)
          if (setEnergy) setEnergy(data.state.energy || 3)
          if (setContextMode) setContextMode(data.state.contextMode || 'personal')
          if (setCurrentTask) setCurrentTask(data.state.currentTask || 'Dashboard design')
        }
      } catch (error) {
        console.error('Failed to load state:', error)
      } finally {
        setStateLoaded(true)
      }
    }
    loadState()
  }, [setFocusMode, setEnergy, setContextMode, setCurrentTask])

  // Save state to API
  const saveState = async (updates) => {
    if (!stateLoaded) return
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
    } catch (error) {
      console.error('Failed to save state:', error)
    }
  }

  // Log action to INBOX
  const logAction = async (text) => {
    try {
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
    } catch (error) {
      console.error('Failed to log action:', error)
    }
  }

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Timer logic with completion handling
  useEffect(() => {
    if (timer) {
      const interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 0) {
            setTimer(null)
            // If in focus mode, complete the focus session
            if (focusMode) {
              setFocusMode(false)
              saveState({ focusMode: false })
              logAction(`Completed focus session: ${currentTask} (25min)`)
            } else {
              logAction('Completed 25min timer session')
            }
            // Browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Pomodoro Complete!', {
                body: 'Time for a break!',
                icon: '/favicon.ico'
              })
            }
            // Play a simple beep sound
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)()
              const oscillator = audioContext.createOscillator()
              const gainNode = audioContext.createGain()
              oscillator.connect(gainNode)
              gainNode.connect(audioContext.destination)
              oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
              oscillator.start()
              oscillator.stop(audioContext.currentTime + 0.2)
            } catch (e) {
              console.log('Audio notification failed')
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [timer, focusMode, currentTask])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Enhanced focus mode toggle
  const toggleFocusMode = async () => {
    const newFocusMode = !focusMode
    setFocusMode(newFocusMode)
    await saveState({ focusMode: newFocusMode })
    
    if (newFocusMode) {
      // Auto-start 25min timer if not already running
      if (!timer) {
        setTimer(true)
        setTimerSeconds(25 * 60)
      }
      await logAction(`Focus mode started: ${currentTask}`)
    } else {
      await logAction('Focus mode ended')
    }
  }

  // Enhanced energy change
  const cycleEnergy = async () => {
    const newEnergy = energy >= 5 ? 1 : energy + 1
    setEnergy(newEnergy)
    await saveState({ energy: newEnergy })
    await logAction(`Energy level: ${newEnergy}/5`)
  }

  // Enhanced context mode change
  const cycleContextMode = async () => {
    const modes = ['uni', 'work', 'personal', 'deep']
    const currentIndex = modes.indexOf(contextMode)
    const newMode = modes[(currentIndex + 1) % modes.length]
    setContextMode(newMode)
    await saveState({ contextMode: newMode })
    await logAction(`Context mode: ${newMode.toUpperCase()}`)
  }

  // Enhanced timer toggle
  const toggleTimer = async () => {
    if (timer) {
      setTimer(null)
      setTimerSeconds(0)
      await logAction('Timer stopped')
    } else {
      setTimer(true)
      setTimerSeconds(25 * 60) // 25 minutes
      await logAction('Started 25min pomodoro timer')
    }
  }

  // Enhanced task editing
  const editCurrentTask = async () => {
    const newTask = prompt('What are you focusing on?', currentTask)
    if (newTask && newTask.trim() && newTask.trim() !== currentTask) {
      const taskText = newTask.trim()
      setCurrentTask(taskText)
      await saveState({ currentTask: taskText })
      await logAction(`Focus task: ${taskText}`)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFocusMode()
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        toggleTimer()
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        onCapture()
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        cycleEnergy()
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        cycleContextMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [timer, onCapture, contextMode, focusMode, energy, currentTask])

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatTime = (date) => {
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  return (
    <div className="command-hud">
      {/* Left Section: Context & Current Task */}
      <div className="hud-left">
        <div className="context-indicator">
          <button 
            className={`context-mode context-${contextMode}`}
            onClick={cycleContextMode}
            title="Switch context mode (M)"
          >
            <span className="context-dot" />
            <span className="context-label">{contextMode.toUpperCase()}</span>
          </button>
        </div>
        <div className="current-task" onClick={editCurrentTask}>
          <span className="task-prefix">FOCUS:</span>
          <span className="task-text" title="Click to edit">{currentTask}</span>
        </div>
      </div>

      {/* Center Section: Quick Actions */}
      <div className="hud-center">
        <button 
          className={`hud-action ${focusMode ? 'hud-action-active' : ''}`}
          onClick={toggleFocusMode}
          title="Toggle focus mode [F]"
        >
          <span className="action-key">F</span>
        </button>

        <button 
          className={`hud-action ${timer ? 'hud-action-active' : ''}`}
          onClick={toggleTimer}
          title="Start/stop timer [T]"
        >
          <span className="action-key">T</span>
          {timer && <span className="action-timer">{formatTimer(timerSeconds)}</span>}
        </button>

        <button 
          className="hud-action"
          onClick={onCapture}
          title="Quick capture [C]"
        >
          <span className="action-key">C</span>
        </button>

        <button 
          className="hud-action"
          onClick={cycleEnergy}
          title="Energy level [E]"
        >
          <span className="action-key">E</span>
          <span className="energy-bar">
            {'█'.repeat(energy)}{'░'.repeat(5 - energy)}
          </span>
        </button>
      </div>

      {/* Right Section: Status & System */}
      <div className="hud-right">
        <div className="status-cluster">
          <div className="status-item">
            <span className="status-label">TIME</span>
            <span className="status-value">{formatTime(currentTime)}</span>
          </div>
          
          <div className="status-item">
            <span className="status-label">SYS</span>
            <span className="status-value status-online">ONLINE</span>
          </div>
          
          {focusMode && (
            <div className="status-item">
              <span className="status-label">MODE</span>
              <span className="status-value status-focus">FOCUS</span>
            </div>
          )}
        </div>

        <button 
          className="hud-system"
          onClick={onLock}
          title="Lock system"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// Status bar functionality has been integrated into CommandToolbar (HUD)

// === CAPTURE MODAL ===
function CaptureModal({ isOpen, onClose }) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setInput('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && !saving) {
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, saving])

  const handleSave = async () => {
    if (!input.trim() || saving) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() })
      })
      
      if (response.ok) {
        onClose()
      } else {
        console.error('Failed to save capture')
      }
    } catch (error) {
      console.error('Capture error:', error)
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="capture-modal-overlay" onClick={onClose}>
      <div className="capture-modal" onClick={e => e.stopPropagation()}>
        <div className="capture-header">QUICK CAPTURE</div>
        <div className="capture-input-row">
          <span className="capture-prompt">{'>'}</span>
          <input
            ref={inputRef}
            className="capture-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="capture_"
            disabled={saving}
          />
        </div>
        <div className="capture-hints">
          <span>ENTER to save</span>
          <span>ESC to cancel</span>
        </div>
      </div>
    </div>
  )
}

// === TASK SPAWN MODAL ===
function TaskSpawnModal({ isOpen, task, projectContext, onClose }) {
  const [context, setContext] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setContext('')
      setStatus('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && !spawning) {
        handleSpawn()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, spawning])

  const generateFilename = (taskText) => {
    return taskText
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50) + '.md'
  }

  const determineSavePath = (taskText, projectContext) => {
    // If task is under Headland Montessori
    if (projectContext === 'Headland Montessori' || taskText.toLowerCase().includes('headland')) {
      return `~/Desktop/WOOZY/PROJECTS/Headland Montessori/`
    }
    
    // If task mentions UNI subjects
    if (taskText.match(/COMM\d+|CODE\d+|FADA\d+/i)) {
      return `~/Desktop/WOOZY/UNI/`
    }
    
    // If task mentions Bristlecone
    if (taskText.toLowerCase().includes('bristlecone')) {
      return `~/Desktop/WOOZY/LIFE/Clients/`
    }
    
    // Default to INBOX (append mode)
    return `~/Desktop/WOOZY/INBOX.md`
  }

  const handleSpawn = async () => {
    if (!task?.text || spawning) return
    
    setSpawning(true)
    setStatus('SPAWNING...')
    
    try {
      const cleanTaskText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()
      const savePath = determineSavePath(cleanTaskText, projectContext)
      const filename = savePath.endsWith('.md') ? savePath : savePath + generateFilename(cleanTaskText)
      
      const spawnMessage = `Use sessions_spawn to: ${cleanTaskText}${context.trim() ? `. Additional context: ${context.trim()}` : ''}. Save the output to ${filename}`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: spawnMessage })
      })
      
      if (response.ok) {
        setStatus('SENT')
        setTimeout(() => {
          onClose()
        }, 1000)
      } else {
        setStatus('ERROR')
        setTimeout(() => setStatus(''), 2000)
      }
    } catch (error) {
      console.error('Spawn error:', error)
      setStatus('ERROR')
      setTimeout(() => setStatus(''), 2000)
    } finally {
      setSpawning(false)
    }
  }

  if (!isOpen) return null

  const cleanTaskText = task?.text?.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim() || ''

  return (
    <div className="task-spawn-overlay" onClick={onClose}>
      <div className="task-spawn-modal" onClick={e => e.stopPropagation()}>
        <div className="task-spawn-header">SPAWN AGENT</div>
        
        <div className="task-spawn-task">
          <div className="task-spawn-label">TASK</div>
          <div className="task-spawn-task-text">{cleanTaskText}</div>
        </div>
        
        <div className="task-spawn-input-group">
          <label className="task-spawn-label">ADDITIONAL CONTEXT</label>
          <input
            ref={inputRef}
            className="task-spawn-input"
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="What should the agent focus on?"
            disabled={spawning}
          />
        </div>
        
        <div className="task-spawn-actions">
          <button 
            className="task-spawn-btn task-spawn-btn-secondary" 
            onClick={onClose} 
            disabled={spawning}
          >
            CANCEL
          </button>
          <button 
            className="task-spawn-btn task-spawn-btn-primary" 
            onClick={handleSpawn}
            disabled={spawning}
          >
            {status || 'SPAWN'}
          </button>
        </div>
        
        <div className="task-spawn-hints">
          <span>ENTER to spawn</span>
          <span>ESC to cancel</span>
        </div>
      </div>
    </div>
  )
}

// === TASKS MODULE ===
function TasksModule({ data, energy, contextMode }) {
  const [completingTask, setCompletingTask] = useState(null)
  const [spawnModal, setSpawnModal] = useState({ open: false, task: null, projectContext: null })

  // Normalize tasks — API may return `title` instead of `text`
  const normalizedTasks = (data.tasks || []).map(t => ({ ...t, text: t.text || t.title || '' }))
  // Filter and organize tasks
  const incompleteTasks = normalizedTasks.filter(t => t.status !== 'done' && !t.done)
  
  // Context-based filtering
  const contextFilteredTasks = incompleteTasks.filter(t => {
    const text = ((t.text || '') + ' ' + (t.section || '') + ' ' + (t.subsection || '') + ' ' + (t.project_name || '')).toLowerCase()
    const isUni = text.match(/comm|code|fada|uni|assignment|quiz|lecture|tutorial|moodle/) || t.category === 'uni'
    const isWork = text.match(/headland|bristlecone|s17|client|invoice|rebrand|montessori/) || t.category === 'freelance' || t.category === 'work' || (t.section || '').includes('Headland')
    if (contextMode === 'uni') return isUni
    if (contextMode === 'work') return isWork
    if (contextMode === 'personal') return !isWork // personal = everything except client work
    if (contextMode === 'deep') return true // deep = show everything
    return true
  })
  
  // Separate project tasks from day-to-day tasks
  const projectTaskSections = data.pinnedProject ? [data.pinnedProject.section] : []
  const showPinnedProject = contextMode === 'work' || contextMode === 'deep'
  const dayToDayTasks = contextFilteredTasks.filter(t => 
    !projectTaskSections.includes(t.section)
  )
  
  // Find the most urgent/important task for DO NEXT from day-to-day tasks
  const doNextTask = findDoNextTask(dayToDayTasks, energy)
  
  // Group remaining day-to-day tasks by category (excluding DO NEXT)
  const tasksByCategory = groupTasksByCategory(
    dayToDayTasks.filter(t => t !== doNextTask)
  )

  const handleTaskComplete = async (task) => {
    setCompletingTask(task.text)
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'complete',
          task: task.text,
          section: task.section 
        })
      })
      
      if (response.ok) {
        // Task completion handled - refresh would show updated state
        setTimeout(() => window.location.reload(), 500)
      }
    } catch (error) {
      console.error('Failed to complete task:', error)
    } finally {
      setCompletingTask(null)
    }
  }

  const handleSpawnTask = (task, projectContext = null) => {
    setSpawnModal({ open: true, task, projectContext })
  }

  const closeSpawnModal = () => {
    setSpawnModal({ open: false, task: null, projectContext: null })
  }

  return (
    <>
      {/* Pinned Project — shown in work/personal/deep modes */}
      {data.pinnedProject && showPinnedProject && (
        <PinnedProject 
          project={data.pinnedProject}
          allTasks={data.tasks || []}
          onTaskComplete={handleTaskComplete}
          completingTask={completingTask}
          onSpawn={handleSpawnTask}
        />
      )}

      {/* DO NEXT Hero Card */}
      {doNextTask && (
        <DoNextCard 
          task={doNextTask} 
          onComplete={() => handleTaskComplete(doNextTask)}
          completing={completingTask === doNextTask.text}
          energy={energy}
          onSpawn={handleSpawnTask}
        />
      )}

      {/* Day-to-Day Task Categories Grid */}
      <div className="task-grid">
        {Object.entries(tasksByCategory).map(([category, tasks]) => (
          <TaskCategory
            key={category}
            category={category}
            tasks={tasks}
            onTaskComplete={handleTaskComplete}
            completingTask={completingTask}
            onSpawn={handleSpawnTask}
          />
        ))}
      </div>

      {/* Spawn Modal */}
      <TaskSpawnModal
        isOpen={spawnModal.open}
        task={spawnModal.task}
        projectContext={spawnModal.projectContext}
        onClose={closeSpawnModal}
      />
    </>
  )
}

function findDoNextTask(tasks, energy = 3) {
  const validTasks = tasks.filter(t => t && t.text)
  if (!validTasks.length) return null
  // Energy-based task filtering
  if (energy <= 2) {
    // Low energy: prefer easy/quick tasks
    const easyTasks = validTasks.filter(t => {
      const text = t.text.toLowerCase()
      // Short descriptions, no complex keywords
      return text.length < 50 && 
             !text.includes('assessment') && 
             !text.includes('project') &&
             !text.includes('research') &&
             !text.includes('analysis') &&
             !text.includes('design') &&
             !text.includes('strategy')
    })
    
    // Still respect urgency even for low energy
    const overdue = easyTasks.filter(t => t.urgency === 'overdue')
    const today = easyTasks.filter(t => t.urgency === 'today')
    const urgent = easyTasks.filter(t => t.isUrgent)
    
    if (overdue[0] || today[0] || urgent[0]) {
      return overdue[0] || today[0] || urgent[0]
    }
    
    return easyTasks[0] || validTasks.filter(t => t.urgency === 'overdue')[0] || validTasks.filter(t => t.urgency === 'today')[0]
  } else if (energy >= 4) {
    // High energy: prefer hard/important tasks
    const hardTasks = validTasks.filter(t => {
      const text = t.text.toLowerCase()
      return text.includes('assessment') || 
             text.includes('project') ||
             text.includes('research') ||
             text.includes('analysis') ||
             text.includes('design') ||
             text.includes('strategy') ||
             t.category === 'work' ||
             t.isUrgent
    })
    
    const overdue = hardTasks.filter(t => t.urgency === 'overdue')
    const today = hardTasks.filter(t => t.urgency === 'today')
    const urgent = hardTasks.filter(t => t.isUrgent)
    const tomorrow = hardTasks.filter(t => t.urgency === 'tomorrow')
    
    if (overdue[0] || today[0] || urgent[0] || tomorrow[0]) {
      return overdue[0] || today[0] || urgent[0] || tomorrow[0]
    }
    
    return hardTasks[0] || validTasks.filter(t => t.urgency === 'overdue')[0] || validTasks.filter(t => t.urgency === 'today')[0]
  } else {
    // Neutral energy: standard urgency-based selection
    const overdue = validTasks.filter(t => t.urgency === 'overdue')
    const today = validTasks.filter(t => t.urgency === 'today')
    const urgent = validTasks.filter(t => t.isUrgent)
    const tomorrow = validTasks.filter(t => t.urgency === 'tomorrow')
    const thisWeek = validTasks.filter(t => t.urgency === 'this-week')
    
    return overdue[0] || today[0] || urgent[0] || tomorrow[0] || thisWeek[0] || validTasks[0]
  }
}

function groupTasksByCategory(tasks) {
  const valid = tasks.filter(t => t && t.text)
  const groups = {
    uni: valid.filter(t => t.category === 'uni'),
    work: valid.filter(t => t.category === 'work'),
    personal: valid.filter(t => t.category === 'personal')
  }
  
  // Only return non-empty categories
  return Object.fromEntries(
    Object.entries(groups).filter(([_, tasks]) => tasks.length > 0)
  )
}

function DoNextCard({ task, onComplete, completing, energy, onSpawn }) {
  const [showSpawnButton, setShowSpawnButton] = useState(false)
  const urgencyText = {
    overdue: 'OVERDUE',
    today: 'DUE TODAY',
    tomorrow: 'DUE TOMORROW',
    'this-week': 'DUE THIS WEEK',
    none: 'PRIORITY TASK'
  }

  const getEnergyLabel = (energy, task) => {
    if (energy <= 2) return '// suggested for low energy'
    if (energy >= 4) return '// deep work recommended'
    return '// standard priority task'
  }

  if (!task || !task.text) return null

  const cleanText = task.text
    .replace(/\*\*/g, '')
    .replace(/←.*/, '')
    .replace(/—.*/, '')
    .trim()

  const handleSpawnClick = (e) => {
    e.stopPropagation()
    onSpawn?.(task)
  }

  return (
    <div 
      className="do-next-hero" 
      onMouseEnter={() => setShowSpawnButton(true)}
      onMouseLeave={() => setShowSpawnButton(false)}
      onClick={!completing ? onComplete : null}
    >
      <div className="do-next-header">
        DO NEXT
        <div className="do-next-energy-hint">{getEnergyLabel(energy, task)}</div>
        <div className={`do-next-spawn-btn ${showSpawnButton ? 'spawn-visible' : ''}`} onClick={handleSpawnClick}>
          →
        </div>
      </div>
      <div className="do-next-task">{cleanText}</div>
      <div className="do-next-meta">
        <div className={`do-next-urgency task-urgency-${task.urgency}`}>
          {urgencyText[task.urgency] || 'PRIORITY TASK'}
        </div>
        <div className="do-next-category">
          {task.category.toUpperCase()} • {completing ? 'COMPLETING...' : 'CLICK TO COMPLETE'}
        </div>
      </div>
    </div>
  )
}

function TaskCategory({ category, tasks, onTaskComplete, completingTask, onSpawn }) {
  const categoryNames = {
    uni: 'University',
    work: 'Client Work', 
    personal: 'Personal'
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    // Sort by urgency first
    const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, 'this-week': 3, none: 4 }
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    }
    // Then by urgent flag
    if (a.isUrgent !== b.isUrgent) {
      return b.isUrgent - a.isUrgent
    }
    return 0
  })

  return (
    <div className={`task-category category-${category}`}>
      <div className="task-category-header">
        <div className="task-category-title">
          <div className="category-icon" />
          {categoryNames[category]}
        </div>
        <div className="task-category-count">{tasks.length}</div>
      </div>
      
      <div className="task-category-tasks">
        {sortedTasks.map((task, i) => (
          <EnhancedTask
            key={i}
            task={task}
            onComplete={() => onTaskComplete(task)}
            completing={completingTask === task.text}
            onSpawn={onSpawn}
          />
        ))}
      </div>
    </div>
  )
}

function EnhancedTask({ task, onComplete, completing, onSpawn }) {
  const [showSpawnButton, setShowSpawnButton] = useState(false)
  if (!task || !task.text) return null
  const cleanText = task.text
    .replace(/\*\*/g, '')
    .replace(/←.*/, '')
    .replace(/—.*/, '')
    .trim()

  const urgencyLabels = {
    overdue: 'OVERDUE',
    today: 'TODAY',
    tomorrow: 'TOMORROW',
    'this-week': 'THIS WEEK'
  }

  const handleSpawnClick = (e) => {
    e.stopPropagation()
    onSpawn?.(task)
  }

  return (
    <div 
      className={`enhanced-task ${task.isUrgent ? 'task-urgent' : ''}`}
      onMouseEnter={() => setShowSpawnButton(true)}
      onMouseLeave={() => setShowSpawnButton(false)}
      onClick={!completing ? onComplete : null}
    >
      <div className={`task-checkbox ${completing ? 'completing' : ''}`}>
        {completing ? '...' : ''}
      </div>
      
      <div className="enhanced-task-content">
        <div className="enhanced-task-text">{cleanText}</div>
        <div className="enhanced-task-meta">
          {task.urgency !== 'none' && (
            <div className={`enhanced-task-due task-urgency-${task.urgency}`}>
              {urgencyLabels[task.urgency]}
            </div>
          )}
          <div className="enhanced-task-tags">
            {task.isUrgent && <span className="task-tag tag-urgent">urgent</span>}
            {task.category === 'uni' && task.text.match(/COMM\d+|CODE\d+|FADA\d+/i) && (
              <span className="task-tag">{task.text.match(/COMM\d+|CODE\d+|FADA\d+/i)[0].toLowerCase()}</span>
            )}
          </div>
        </div>
      </div>
      
      <div className={`task-spawn-btn ${showSpawnButton ? 'spawn-visible' : ''}`} onClick={handleSpawnClick}>
        →
      </div>
    </div>
  )
}

function PinnedProject({ project, allTasks, onTaskComplete, completingTask, onSpawn }) {
  // Calculate progress
  const projectTasks = project.tasks || []
  const doneTasks = allTasks.filter(t => 
    (t.status === "done" || t.done) && t.section === project.section
  )
  const totalTasks = projectTasks.length + doneTasks.length
  const progress = totalTasks > 0 ? (doneTasks.length / totalTasks) * 100 : 0
  
  // Find active/urgent tasks and regular upcoming tasks
  const activeTasks = projectTasks.filter(t => 
    !(t.status === "done" || t.done) && (t.isUrgent || t.text.includes('NOW') || t.text.includes('←'))
  )
  const upcomingTasks = projectTasks.filter(t => 
    !(t.status === "done" || t.done) && !activeTasks.includes(t)
  )
  
  // Get current phase info
  const currentPhase = project.currentPhase || project.phases?.[0] || {
    name: 'In Progress'
  }

  return (
    <div className="pinned-project">
      <div className="pinned-project-header">
        <div className="pinned-project-main">
          <div className="pinned-project-label">PINNED PROJECT</div>
          <div className="pinned-project-title">{project.name}</div>
          <div className="pinned-project-subtitle">
            {project.client && `${project.client} • `}
            {currentPhase.name}
            {project.total && ` • ${project.total}`}
          </div>
        </div>
        <div className="pinned-project-status">
          <div className={`project-status-badge status-${project.status?.toLowerCase() || 'active'}`}>
            {project.status?.toUpperCase() || 'ACTIVE'}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="pinned-project-progress">
        <div className="progress-header">
          <span className="progress-label">OVERALL PROGRESS</span>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
        <div className="pinned-progress-bar">
          <div 
            className="pinned-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-stats">
          <span>{doneTasks.length} of {totalTasks} tasks complete</span>
          {project.timeline && <span>Timeline: {project.timeline}</span>}
        </div>
      </div>

      {/* Phase Timeline */}
      {project.phases && project.phases.length > 1 && (
        <div className="project-phases">
          <div className="phases-label">PROJECT PHASES</div>
          <div className="phases-timeline">
            {project.phases.slice(0, 4).map((phase, i) => (
              <div 
                key={i}
                className={`phase-item ${phase.isActive ? 'phase-active' : ''}`}
              >
                <div className="phase-dot" />
                <div className="phase-name">{phase.name}</div>
              </div>
            ))}
            {project.phases.length > 4 && (
              <div className="phase-item phase-more">
                <div className="phase-dot" />
                <div className="phase-name">+{project.phases.length - 4} more</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Tasks */}
      <div className="pinned-project-tasks">
        <div className="project-tasks-section">
          {activeTasks.length > 0 && (
            <>
              <div className="tasks-section-header">ACTIVE NOW</div>
              {activeTasks.slice(0, 2).map((task, i) => (
                <ProjectTask
                  key={`active-${i}`}
                  task={task}
                  isActive={true}
                  onComplete={() => onTaskComplete(task)}
                  completing={completingTask === task.text}
                  onSpawn={onSpawn}
                  projectContext={project.name}
                />
              ))}
            </>
          )}
          
          {upcomingTasks.length > 0 && (
            <>
              <div className="tasks-section-header">UPCOMING</div>
              {upcomingTasks.slice(0, 3).map((task, i) => (
                <ProjectTask
                  key={`upcoming-${i}`}
                  task={task}
                  isActive={false}
                  onComplete={() => onTaskComplete(task)}
                  completing={completingTask === task.text}
                  onSpawn={onSpawn}
                  projectContext={project.name}
                />
              ))}
            </>
          )}
        </div>
        
        {projectTasks.length > 5 && (
          <div className="project-tasks-more">
            +{projectTasks.length - 5} more tasks in this project
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectTask({ task, isActive, onComplete, completing, onSpawn, projectContext }) {
  if (!task || !task.text) return null
  const [showSpawnButton, setShowSpawnButton] = useState(false)
  const cleanText = task.text
    .replace(/\*\*/g, '')
    .replace(/←.*/, '')
    .replace(/—.*/, '')
    .trim()

  const handleSpawnClick = (e) => {
    e.stopPropagation()
    onSpawn?.(task, projectContext)
  }

  return (
    <div 
      className={`project-task ${isActive ? 'task-active' : ''}`}
      onMouseEnter={() => setShowSpawnButton(true)}
      onMouseLeave={() => setShowSpawnButton(false)}
      onClick={!completing ? onComplete : null}
    >
      <div className={`task-checkbox ${completing ? 'completing' : ''}`}>
        {completing ? '...' : ''}
      </div>
      <div className="enhanced-task-content">
        <div className="enhanced-task-text">{cleanText}</div>
        {isActive && <div className="task-active-indicator">PRIORITY</div>}
      </div>
      <div className={`task-spawn-btn ${showSpawnButton ? 'spawn-visible' : ''}`} onClick={handleSpawnClick}>
        →
      </div>
    </div>
  )
}

// === HELPERS ===
function fmt(n) { return '$' + n.toLocaleString('en-AU') }
function parseAmt(a) { return parseFloat((a || '0').toString().replace(/[$,]/g, '')) }

const COLORS = {
  checking: 'rgba(255,255,255,0.9)',
  savings: 'rgba(255,255,255,0.6)',
  cash: 'rgba(255,255,255,0.35)',
  investments: 'rgba(0,255,65,0.7)',
  gold: 'rgba(0,255,65,0.45)',
  receivables: 'rgba(0,255,65,0.25)',
  white: '#ffffff',
  green: '#00ff41',
  red: '#ff0040',
  dim: '#444',
}

// === CHAT MARKDOWN RENDERER ===
function ChatMessage({ message, isUser }) {
  const [expanded, setExpanded] = useState(false)
  const content = message.content || ''
  const shouldTruncate = !isUser && content.length > 300
  const displayContent = shouldTruncate && !expanded ? content.slice(0, 300) + '...' : content
  
  // Detect completion summary messages
  const completionWords = ['done', 'completed', 'finished', 'created', 'saved', 'deployed', 'uploaded', 'submitted']
  const isCompletion = !isUser && completionWords.some(word => 
    content.toLowerCase().includes(word) && content.length < 200
  )

  if (isUser) {
    return (
      <div className="chat-msg-text">
        {displayContent}
        {message.channel === 'telegram' && <span className="chat-channel">TG</span>}
      </div>
    )
  }

  if (isCompletion) {
    return (
      <div className="chat-completion-card">
        <div className="chat-completion-icon">✓</div>
        <div className="chat-completion-text">
          <MarkdownRenderer content={displayContent} />
          {shouldTruncate && (
            <button 
              className="chat-expand-btn" 
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'show less' : 'show more'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="chat-msg-text">
      <MarkdownRenderer content={displayContent} />
      {shouldTruncate && (
        <button 
          className="chat-expand-btn" 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      )}
    </div>
  )
}

function MarkdownRenderer({ content }) {
  const parseMarkdown = (text) => {
    const lines = text.split('\n')
    const elements = []
    let inCodeBlock = false
    let currentCodeBlock = []
    let currentList = []
    let listIndex = 0

    const flushCodeBlock = () => {
      if (currentCodeBlock.length > 0) {
        elements.push({
          type: 'code-block',
          content: currentCodeBlock.join('\n'),
          key: `code-${elements.length}`
        })
        currentCodeBlock = []
      }
    }

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push({
          type: 'list',
          items: currentList,
          key: `list-${elements.length}`
        })
        currentList = []
      }
    }

    lines.forEach((line, i) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock()
          inCodeBlock = false
        } else {
          flushList()
          inCodeBlock = true
        }
        return
      }

      if (inCodeBlock) {
        currentCodeBlock.push(line)
        return
      }

      // Headers
      if (line.startsWith('## ')) {
        flushList()
        elements.push({
          type: 'heading',
          level: 2,
          content: line.slice(3).trim(),
          key: `h2-${elements.length}`
        })
        return
      }

      if (line.startsWith('### ')) {
        flushList()
        elements.push({
          type: 'heading',
          level: 3,
          content: line.slice(4).trim(),
          key: `h3-${elements.length}`
        })
        return
      }

      // Lists
      if (line.match(/^[-*•] /)) {
        const content = line.replace(/^[-*•] /, '').trim()
        currentList.push(parseBoldAndInlineCode(content))
        return
      }

      // Regular paragraph
      if (line.trim()) {
        flushList()
        elements.push({
          type: 'paragraph',
          content: parseBoldAndInlineCode(line),
          key: `p-${elements.length}`
        })
      } else if (elements.length > 0) {
        // Empty line - add spacing
        elements.push({
          type: 'spacing',
          key: `space-${elements.length}`
        })
      }
    })

    // Flush any remaining blocks
    flushCodeBlock()
    flushList()

    return elements
  }

  const parseBoldAndInlineCode = (text) => {
    const parts = []
    let remaining = text
    let key = 0

    // Match **bold**, `code`, and links
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
      { regex: /`(.*?)`/g, type: 'code' },
      { regex: /https?:\/\/[^\s]+/g, type: 'link' }
    ]

    while (remaining.length > 0) {
      let earliestMatch = null
      let earliestIndex = Infinity
      let matchedPattern = null

      // Find the earliest match
      patterns.forEach(pattern => {
        pattern.regex.lastIndex = 0 // Reset regex
        const match = pattern.regex.exec(remaining)
        if (match && match.index < earliestIndex) {
          earliestMatch = match
          earliestIndex = match.index
          matchedPattern = pattern
        }
      })

      if (!earliestMatch) {
        // No more patterns, add remaining text
        if (remaining.trim()) {
          parts.push({ type: 'text', content: remaining, key: `text-${key++}` })
        }
        break
      }

      // Add text before the match
      if (earliestIndex > 0) {
        const beforeText = remaining.slice(0, earliestIndex)
        if (beforeText.trim()) {
          parts.push({ type: 'text', content: beforeText, key: `text-${key++}` })
        }
      }

      // Add the matched element
      if (matchedPattern.type === 'link') {
        parts.push({
          type: 'link',
          content: earliestMatch[0],
          href: earliestMatch[0],
          key: `link-${key++}`
        })
      } else {
        parts.push({
          type: matchedPattern.type,
          content: earliestMatch[1],
          key: `${matchedPattern.type}-${key++}`
        })
      }

      // Continue with remaining text
      remaining = remaining.slice(earliestMatch.index + earliestMatch[0].length)
    }

    return parts
  }

  const renderElement = (element) => {
    switch (element.type) {
      case 'heading':
        const HeadingTag = `h${element.level}`
        return React.createElement(
          HeadingTag,
          { key: element.key, className: `chat-heading chat-heading-${element.level}` },
          element.content
        )

      case 'code-block':
        return (
          <pre key={element.key} className="chat-code-block">
            <code>{element.content}</code>
          </pre>
        )

      case 'list':
        return (
          <ul key={element.key} className="chat-list">
            {element.items.map((item, i) => (
              <li key={`item-${i}`} className="chat-list-item">
                {renderInlineElements(item)}
              </li>
            ))}
          </ul>
        )

      case 'paragraph':
        return (
          <div key={element.key} className="chat-paragraph">
            {renderInlineElements(element.content)}
          </div>
        )

      case 'spacing':
        return <div key={element.key} className="chat-spacing" />

      default:
        return null
    }
  }

  const renderInlineElements = (elements) => {
    if (typeof elements === 'string') {
      return elements
    }

    return elements.map(element => {
      switch (element.type) {
        case 'bold':
          return <strong key={element.key}>{element.content}</strong>

        case 'code':
          return <code key={element.key} className="chat-inline-code">{element.content}</code>

        case 'link':
          return (
            <a 
              key={element.key} 
              href={element.href} 
              className="chat-link" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {element.content}
            </a>
          )

        case 'text':
        default:
          return element.content
      }
    })
  }

  const elements = parseMarkdown(content)
  
  return (
    <div className="chat-markdown">
      {elements.map(renderElement)}
    </div>
  )
}

// === CHAT ===
function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom - instant for initial load, smooth for new messages
  useEffect(() => { 
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])
  
  // When chat opens, scroll to bottom immediately
  useEffect(() => { 
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
    }
  }, [open])
  
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '\\' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Allow in other inputs (PIN etc), but not ours
        const isOurInput = document.activeElement === inputRef.current
        if (!isOurInput && (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')) return
        e.preventDefault()
        e.stopImmediatePropagation()
        setOpen(prev => !prev)
      }
    }
    // Use capture phase so we intercept before the input gets the character
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])
  
  // Merge server history with localStorage backup (localStorage preserves dashboard-sent msgs that may not be in transcript yet)
  const mergeMessages = useCallback((serverMsgs, localMsgs) => {
    const all = [...serverMsgs, ...localMsgs]
    const seen = new Set()
    return all.filter(m => {
      // Dedup by role + rounded timestamp (within 2s) + content prefix
      const tsKey = Math.round((m.ts || 0) / 2000)
      const key = `${m.role}:${tsKey}:${(m.content || '').slice(0, 40)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => (a.ts || 0) - (b.ts || 0))
  }, [])

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('woozy-chat-backup', JSON.stringify(messages.slice(-200)))
    }
  }, [messages])

  // Load: server history merged with localStorage backup
  useEffect(() => {
    const localBackup = (() => {
      try { return JSON.parse(localStorage.getItem('woozy-chat-backup') || '[]') } catch { return [] }
    })()
    fetch('/api/history?limit=100').then(r => r.json()).then(data => {
      const merged = mergeMessages(data.messages || [], localBackup)
      setMessages(merged)
    }).catch(() => {
      // Server down — use localStorage backup
      if (localBackup.length) setMessages(localBackup)
    })
  }, [])

  // Poll for new messages every 3 seconds when chat is open
  useEffect(() => {
    if (!open) return
    const poll = setInterval(() => {
      const lastTs = messages.length > 0 ? Math.max(...messages.filter(m => m.ts).map(m => m.ts)) : 0
      fetch(`/api/history?limit=10&after=${lastTs}`).then(r => r.json()).then(data => {
        if (data.messages?.length) {
          setMessages(prev => {
            const existing = new Set(prev.map(m => `${m.role}:${m.ts}`))
            const newMsgs = data.messages.filter(m => !existing.has(`${m.role}:${m.ts}`))
            return newMsgs.length ? [...prev, ...newMsgs] : prev
          })
        }
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(poll)
  }, [open, messages])

  const pendingRef = useRef(0)
  const send = async () => {
    if (!input.trim()) return
    const text = input.trim()
    const userMsg = { role: 'user', content: text, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)
    pendingRef.current++
    setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
      const data = await res.json()
      // Response will also show up via polling, but add immediately for snappiness
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Error', ts: Date.now() }])
    } catch (err) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: Date.now() }]) }
    pendingRef.current--
    if (pendingRef.current <= 0) { pendingRef.current = 0; setLoading(false) }
  }

  const clearHistory = () => { setMessages([]); localStorage.removeItem('woozy-chat'); localStorage.removeItem('woozy-chat-backup') }

  if (!open) return <button className="chat-fab" onClick={() => setOpen(true)}><span className="chat-fab-icon">⌘</span></button>
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-title">WOOZY TERMINAL</span>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button className="chat-clear" onClick={clearHistory} title="Clear local history">⌫</button>
          <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="chat-empty">Connected to main session<br/>Same memory as Telegram</div>}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`}>
            <div className="chat-msg-label">{m.role === 'user' ? '>' : ''}</div>
            <ChatMessage message={m} isUser={m.role === 'user'} />
          </div>
        ))}
        {loading && <div className="chat-msg chat-msg-bot"><div className="chat-msg-label"></div><div className="chat-msg-text chat-typing">thinking<span className="blink">_</span></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row"><span className="chat-prompt">&gt;</span><input ref={inputRef} className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="message woozy..." /></div>
    </div>
  )
}

// === PIN LOCK ===
function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => { const i = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500); return () => clearInterval(i) }, [])

  useEffect(() => {
    const handler = (e) => {
      if (error) return
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          const next = (prev + e.key).slice(0, 4)
          if (next.length === 4) {
            if (next === '2238') {
              sessionStorage.setItem('woozy-unlocked', 'true')
              setTimeout(() => onUnlock(), 200)
            } else {
              setError(true)
              setTimeout(() => { setError(false); setPin('') }, 1200)
            }
          }
          return next
        })
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [error, onUnlock])

  return (
    <div className="lock-overlay">
      <div className="lock-container">
        <svg className="lock-icon-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div className="lock-title">ENCRYPTED</div>
        <div className="lock-subtitle">Financial data requires authorization{dots}</div>
        <div className={`lock-dots-main ${error ? 'lock-error' : ''}`}>
          {[0,1,2,3].map(i => <div key={i} className={`lock-dot ${pin.length > i ? 'lock-dot-filled' : ''} ${error ? 'lock-dot-error' : ''}`} />)}
        </div>
        {error && <div className="lock-error-msg">ACCESS DENIED</div>}
      </div>
    </div>
  )
}

function DecryptReveal({ children, unlocked }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { 
    if (unlocked) { const t = setTimeout(() => setRevealed(true), 100); return () => clearTimeout(t) } 
    else { setRevealed(false) }
  }, [unlocked])
  if (!unlocked) return null
  return <div className={`decrypt ${revealed ? 'decrypted' : ''}`}>{children}</div>
}

//=== FOCUS MODE OVERLAY ===
function FocusOverlay({ isActive, currentTask, onExit, onDone }) {
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [mode, setMode] = useState('timer') // 'timer' or 'stopwatch'
  const [timerDuration, setTimerDuration] = useState(25 * 60) // seconds
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [stopwatchTime, setStopwatchTime] = useState(0)
  const [running, setRunning] = useState(false)
  const [showSetup, setShowSetup] = useState(true) // show duration picker first
  
  // Reset when focus activates
  useEffect(() => {
    if (isActive) {
      setSessionStartTime(Date.now())
      setShowSetup(true)
      setRunning(false)
      setStopwatchTime(0)
    } else {
      setSessionStartTime(null)
      setShowSetup(true)
      setRunning(false)
    }
  }, [isActive])

  // Timer/stopwatch tick
  useEffect(() => {
    if (!running || !isActive) return
    const interval = setInterval(() => {
      if (mode === 'timer') {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRunning(false)
            // Notify
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Focus session complete', { body: currentTask })
            }
            try {
              const ctx = new AudioContext()
              const osc = ctx.createOscillator()
              osc.connect(ctx.destination)
              osc.frequency.value = 800
              osc.start()
              setTimeout(() => osc.stop(), 200)
            } catch {}
            // Log completion
            const mins = Math.round(timerDuration / 60)
            fetch('/api/capture', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: `Completed focus session: ${currentTask} (${mins}min timer)` }) })
            return 0
          }
          return prev - 1
        })
      } else {
        setStopwatchTime(prev => prev + 1)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [running, isActive, mode, currentTask, timerDuration])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return
    const handler = (e) => {
      if (e.key === 'Escape') onExit()
      else if (e.key === 'Enter' && !showSetup) {
        const mins = mode === 'timer' ? Math.round((timerDuration - timeLeft) / 60) : Math.round(stopwatchTime / 60)
        fetch('/api/capture', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: `Completed focus session: ${currentTask} (${mins}min)` }) })
        onDone()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isActive, onExit, onDone, showSetup, mode, timerDuration, timeLeft, stopwatchTime, currentTask])

  const fmt = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  const presets = [
    { label: '15m', seconds: 15 * 60 },
    { label: '25m', seconds: 25 * 60 },
    { label: '45m', seconds: 45 * 60 },
    { label: '60m', seconds: 60 * 60 },
    { label: '90m', seconds: 90 * 60 },
  ]

  if (!isActive) return null

  return (
    <div className="focus-overlay">
      <div className="focus-content">
        <div className="focus-header">
          <div className="focus-mode-label">FOCUS MODE</div>
        </div>
        
        <div className="focus-task">{currentTask}</div>
        
        {showSetup ? (
          <div className="focus-setup">
            <div className="focus-mode-toggle">
              <button className={`focus-mode-btn ${mode === 'timer' ? 'active' : ''}`} onClick={() => setMode('timer')}>TIMER</button>
              <button className={`focus-mode-btn ${mode === 'stopwatch' ? 'active' : ''}`} onClick={() => setMode('stopwatch')}>STOPWATCH</button>
            </div>
            {mode === 'timer' && (
              <div className="focus-presets">
                {presets.map(p => (
                  <button key={p.label} className={`focus-preset ${timerDuration === p.seconds ? 'active' : ''}`} onClick={() => { setTimerDuration(p.seconds); setTimeLeft(p.seconds) }}>{p.label}</button>
                ))}
              </div>
            )}
            <button className="focus-btn focus-btn-start" onClick={() => { setShowSetup(false); setRunning(true) }}>
              START {mode === 'timer' ? fmt(timerDuration) : 'STOPWATCH'}
            </button>
          </div>
        ) : (
          <>
            <div className="focus-timer">{mode === 'timer' ? fmt(timeLeft) : fmt(stopwatchTime)}</div>
            <div className="focus-timer-label">{mode === 'timer' ? (timeLeft === 0 ? 'TIME UP' : 'remaining') : 'elapsed'}</div>
            
            <div className="focus-actions">
              <button className="focus-btn focus-btn-done" onClick={() => {
                const mins = mode === 'timer' ? Math.round((timerDuration - timeLeft) / 60) : Math.round(stopwatchTime / 60)
                fetch('/api/capture', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: `Completed focus session: ${currentTask} (${mins}min)` }) })
                onDone()
              }}>DONE</button>
              <button className="focus-btn focus-btn-exit" onClick={onExit}>EXIT</button>
              {running ? (
                <button className="focus-btn" onClick={() => setRunning(false)}>PAUSE</button>
              ) : timeLeft > 0 || mode === 'stopwatch' ? (
                <button className="focus-btn" onClick={() => setRunning(true)}>RESUME</button>
              ) : null}
            </div>
          </>
        )}
        
        <div className="focus-hint">ENTER to complete • ESC to exit</div>
      </div>
    </div>
  )
}

// === MAIN ===
export default function Home() {
  const [data, setData] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [booted, setBooted] = useState(false)
  const [bootLines, setBootLines] = useState([])
  const [captureOpen, setCaptureOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [contextMode, setContextMode] = useState('personal')
  const [energy, setEnergy] = useState(3)
  const [timer, setTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [currentTask, setCurrentTask] = useState('Dashboard design')
  
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData)
    // Finances always start locked — must enter PIN each session
  }, [])

  // Apply body data attributes for focus mode and context mode
  useEffect(() => {
    document.body.setAttribute('data-focus-mode', focusMode.toString())
    document.body.setAttribute('data-context-mode', contextMode)
  }, [focusMode, contextMode])

  // Focus mode handlers
  const handleFocusExit = async () => {
    setFocusMode(false)
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusMode: false })
      })
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Focus mode exited' })
      })
    } catch (error) {
      console.error('Failed to save focus exit:', error)
    }
  }

  const handleFocusDone = async () => {
    const sessionDuration = timer ? Math.ceil((25 * 60 - timerSeconds) / 60) : 25
    setFocusMode(false)
    setTimer(null)
    setTimerSeconds(0)
    
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusMode: false })
      })
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: `Completed focus session: ${currentTask} (${sessionDuration}min)` 
        })
      })
    } catch (error) {
      console.error('Failed to save focus completion:', error)
    }
  }
  
  const bootSequence = [
    { text: '> WOOZY KERNEL v2.0.4 LOADING...', delay: 0 },
    { text: '> Mounting secure filesystem ██████████ OK', delay: 300 },
    { text: '> Connecting to OpenClaw Gateway [127.0.0.1:18789]...', delay: 600 },
    { text: '> Authentication ✓ Token verified', delay: 900 },
    { text: '> Loading agent: MAIN — Woozy Command', delay: 1100 },
    { text: '> Scanning vault: ~/Desktop/WOOZY/', delay: 1400 },
    { text: `> Assets loaded — ${new Date().toLocaleDateString('en-AU')}`, delay: 1600 },
    { text: '> Financial encryption layer: ARMED', delay: 1900 },
    { text: '> Matrix rain shader: ACTIVE', delay: 2100 },
    { text: '> All systems nominal. Welcome back, Ethan.', delay: 2400 },
    { text: '', delay: 2800, done: true },
  ]

  useEffect(() => {
    if (data && !booted) {
      // Boot sequence runs every reload
      bootSequence.forEach(({ text, delay, done }) => {
        setTimeout(() => {
          if (done) { setBooted(true) }
          else setBootLines(prev => [...prev, text])
        }, delay)
      })
    }
  }, [data])

  if (!data) return <div className="loading">INITIALIZING SYSTEM...</div>

  if (!booted) return (
    <>
      <div className="boot-screen">
        <div className="boot-logo"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
        <div className="boot-title">WOOZY COMMAND</div>
        <div className="boot-lines">
          {bootLines.map((line, i) => (
            <div key={i} className={`boot-line ${i === bootLines.length - 1 ? 'boot-line-latest' : ''}`}>
              {line}
            </div>
          ))}
          <span className="boot-cursor">█</span>
        </div>
      </div>
    </>
  )

  const a = data.assets || {}
  const incomeList = data.income || []
  const expenseList = data.expenses || []
  const taskList = data.tasks || []
  const totalIncome = incomeList.filter(r => (r.status === 'paid' || r.status === 'completed')).reduce((s, r) => s + parseAmt(r.amount), 0)
  const pendingIncome = incomeList.filter(r => r.status === 'pending').reduce((s, r) => s + parseAmt(r.amount), 0)
  const totalExpenses = expenseList.reduce((s, r) => s + parseAmt(r.amount), 0)
  const thisWeekTasks = taskList.filter(t => (t.status || '') !== 'done' && ((t.section || '').includes('This Week') || (t.section || '') === 'this_week' || (t.subsection || '').includes('Due This Week')))
  const projectTasks = taskList.filter(t => (t.status || '') !== 'done' && ((t.section || '').includes('Headland') || (t.subsection || '').includes('Headland') || (t.project_name || '').includes('Headland')))
  const totalAssets = a.checking + a.savings + a.cash + a.investments + a.gold.value + a.receivables

  const assetSegments = [
    { label: 'Checking', value: a.checking, color: COLORS.checking },
    { label: 'Savings', value: a.savings, color: COLORS.savings },
    { label: 'Cash', value: a.cash, color: COLORS.cash },
    { label: 'Investments', value: a.investments, color: COLORS.investments },
    { label: 'Gold', value: a.gold.value, color: COLORS.gold },
    { label: 'Receivables', value: a.receivables, color: COLORS.receivables },
  ].filter(s => s.value > 0)

  const incomeByClient = incomeList.filter(r => (r.status === 'paid' || r.status === 'completed')).reduce((acc, r) => {
    const key = r.client || r.source || 'Other'
    acc[key] = (acc[key] || 0) + parseAmt(r.amount)
    return acc
  }, {})

  const incomeBarItems = Object.entries(incomeByClient).map(([label, value]) => ({
    label, value, display: fmt(value), color: '#fff'
  })).sort((a, b) => b.value - a.value)

  return (
    <>
      <div className="system-header">
        <div className="system-status">● SYSTEM ONLINE</div>
        <div className="system-title">WOOZY COMMAND</div>
        <div className="system-subtitle">Personal Command Center v2.0</div>
      </div>

      {/* COMMAND HUD */}
      <CommandToolbar 
        onCapture={() => setCaptureOpen(true)}
        unlocked={unlocked}
        onLock={() => { setUnlocked(false); sessionStorage.removeItem('woozy-unlocked') }}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        contextMode={contextMode}
        setContextMode={setContextMode}
        energy={energy}
        setEnergy={setEnergy}
        timer={timer}
        setTimer={setTimer}
        timerSeconds={timerSeconds}
        setTimerSeconds={setTimerSeconds}
        currentTask={currentTask}
        setCurrentTask={setCurrentTask}
      />

      {/* FOCUS MODE OVERLAY */}
      <FocusOverlay
        isActive={focusMode}
        currentTask={currentTask}
        onExit={handleFocusExit}
        onDone={handleFocusDone}
      />

      <div className="main-sections">
        {/* === SECTION 1: TODAY (always visible) === */}
        <div className="section-today">
          <div className="section-title">TODAY</div>
          
          <TasksModule data={data} energy={energy} contextMode={contextMode} />
        </div>

        {/* === SECTION 2: AGENTS (always visible) === */}
        <div className="section-agents">
          <div className="section-title">AGENTS</div>
          <div className="grid">
            <AgentsModule />
          </div>
        </div>

        {/* === SECTION 3: FINANCES (personal + work modes) === */}
        {(contextMode === 'personal' || contextMode === 'work') && <div className="section-finances">
          <div className="section-title">FINANCES {!unlocked && <span style={{fontSize:'0.7rem',color:'#666',marginLeft:'0.5rem'}}>// LOCKED</span>}</div>
          {!unlocked && <div className="card full"><PinLock onUnlock={() => { setUnlocked(true); sessionStorage.setItem('woozy-unlocked', 'true') }} /></div>}
          <div className="grid">
            {/* NET WORTH HERO + DONUT */}
            <DecryptReveal unlocked={unlocked}>
              <div className="card full">
                <div className="nw-top">
                  <div className="nw-left">
                    <div className="section-header">Net Worth</div>
                    <div className="net-worth-value">{fmt(a.netWorth)}</div>
                    <div className="nw-stats-row">
                      <MiniStat label="Liquid" value={fmt(a.checking + a.savings + a.cash)} color={COLORS.checking} />
                      <MiniStat label="Invested" value={fmt(a.investments + a.gold.value)} color={COLORS.investments} />
                      <MiniStat label="Owed to you" value={fmt(a.receivables)} color={COLORS.receivables} />
                    </div>
                  </div>
                  <div className="nw-right">
                    <DonutChart segments={assetSegments} />
                  </div>
                </div>

                <div className="section-header" style={{marginTop: '1.5rem'}}>Allocation</div>
                <StackedBar segments={assetSegments} height={28} />
                <div className="legend">
                  {assetSegments.map((s, i) => (
                    <div key={i} className="legend-item">
                      <span className="legend-dot" style={{background: s.color}} />
                      <span className="legend-label">{s.label}</span>
                      <span className="legend-value">{fmt(s.value)}</span>
                      <span className="legend-pct">{((s.value / totalAssets) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>

                {(a.etfStatus || '').includes('Waiting') && (
                  <div className="etf-status">▲ ETF DEPLOYMENT: {fmt(a.etfPlanned)} PLANNED • {a.etfStatus.toUpperCase()}</div>
                )}
              </div>
            </DecryptReveal>

            {/* INCOME + BAR CHART */}
            <DecryptReveal unlocked={unlocked}>
              <div className="card">
                <div className="section-header">Income</div>
                <div className="income-hero-row">
                  <MiniStat label="Received" value={fmt(totalIncome)} color="#fff" />
                  <MiniStat label="Pending" value={fmt(pendingIncome)} color={COLORS.dim} />
                </div>

                <div className="subsection">By Client</div>
                <BarChart items={incomeBarItems} />

                {incomeList.filter(r => r.status !== 'paid').length > 0 && (
                  <>
                    <div className="subsection" style={{marginTop: '1rem'}}>Awaiting Payment</div>
                    <ul className="data-list">
                      {incomeList.filter(r => r.status !== 'paid').map((item, i) => (
                        <li key={i} className="data-item" style={{opacity: 0.5}}>
                          <span>{item.client || item.source}</span>
                          <span>{fmt(parseAmt(item.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </DecryptReveal>

            {/* EXPENSES */}
            <DecryptReveal unlocked={unlocked}>
              <div className="card">
                <div className="section-header">Expenses</div>
                <div className="stat-display">
                  <div className="stat-value money-negative">{fmt(totalExpenses)}</div>
                  <div className="stat-label">Total Outflow</div>
                </div>
                {expenseList.length > 0 ? (
                  <ul className="data-list">
                    {expenseList.map((item, i) => (
                      <li key={i} className="data-item">
                        <span>{item.category} — {item.description}</span>
                        <span className="money-negative">{fmt(parseAmt(item.amount))}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-visual">
                    <div className="empty-icon">—</div>
                    <div>No expenses tracked yet</div>
                    <div className="empty-sub">Tell Woozy when you spend money</div>
                  </div>
                )}
              </div>
            </DecryptReveal>

            {/* INCOME vs EXPENSES VISUAL */}
            <DecryptReveal unlocked={unlocked}>
              <div className="card full">
                <div className="section-header">Income vs Expenses</div>
                <div className="vs-chart">
                  <div className="vs-bar-group">
                    <div className="vs-label">Income</div>
                    <div className="vs-track">
                      <div className="vs-fill vs-income" style={{width: `${totalIncome > 0 ? 100 : 0}%`}} />
                    </div>
                    <div className="vs-amount">{fmt(totalIncome)}</div>
                  </div>
                  <div className="vs-bar-group">
                    <div className="vs-label">Expenses</div>
                    <div className="vs-track">
                      <div className="vs-fill vs-expense" style={{width: `${totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0}%`}} />
                    </div>
                    <div className="vs-amount">{fmt(totalExpenses)}</div>
                  </div>
                  <div className="vs-bar-group">
                    <div className="vs-label">Net</div>
                    <div className="vs-track">
                      <div className="vs-fill vs-net" style={{width: `${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0}%`}} />
                    </div>
                    <div className="vs-amount" style={{color: '#22c55e'}}>{fmt(totalIncome - totalExpenses)}</div>
                  </div>
                </div>
              </div>
            </DecryptReveal>
          </div>
        </div>}

        {/* === SECTION 4: FREELANCE (work mode) === */}
        {(contextMode === 'work') && <div className="section-freelance">
          <div className="section-title">FREELANCE</div>
          <div className="grid">
            <div className="card">
              <div className="section-header">Clients</div>
              <ul className="data-list">
                {(data.clients || []).map((client, i) => (
                  <li key={i} className="data-item">
                    <div>
                      <div style={{fontWeight: 600, textTransform: 'capitalize'}}>{client.name.replace(/-/g, ' ')}</div>
                      {unlocked && client.total && <div style={{color: '#666', fontSize: '0.8rem', marginTop: '0.2rem'}}>{client.total}</div>}
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem'}}>
                      <span className={`status-tag ${client.status === 'active' ? 'status-active' : 'status-inactive'}`}>{client.status}</span>
                      {client.deposit && <span className={`status-tag ${client.deposit === 'paid' ? 'status-active' : 'status-pending'}`}>{client.deposit === 'paid' ? 'deposit ✓' : 'deposit pending'}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>}
      </div>

      <div className="last-updated">
        Last Update: {new Date(data.updated).toLocaleString('en-AU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
      
      <CaptureModal 
        isOpen={captureOpen} 
        onClose={() => setCaptureOpen(false)} 
      />
      
      <ChatPanel />
    </>
  )
}
