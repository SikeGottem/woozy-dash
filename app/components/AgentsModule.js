'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNotifications } from '../context/NotificationContext'

const TASK_TEMPLATES = [
  { id: 'research', name: 'RESEARCH', description: 'Spawn a research sub-agent' },
  { id: 'draft', name: 'DRAFT', description: 'Spawn a writing/drafting agent' },
  { id: 'build', name: 'BUILD', description: 'Spawn a coding sub-agent' },
  { id: 'review', name: 'REVIEW', description: 'Spawn a review/audit agent' },
]

function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(n)
}

function formatCost(c) {
  if (!c || c < 0.001) return '$0.00'
  if (c < 0.01) return '$' + c.toFixed(3)
  return '$' + c.toFixed(2)
}

function costClass(c) {
  if (!c || c < 0.10) return 'cost-low'
  if (c < 0.50) return 'cost-med'
  return 'cost-high'
}

function formatDuration(seconds) {
  if (!seconds) return '--'
  if (seconds < 60) return seconds + 's'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatElapsed(ts) {
  if (!ts) return '--'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function TypeBadge({ type }) {
  const cls = type === 'cron' || type === 'cron-run' ? 'type-badge-cron' : 'type-badge-subagent'
  const label = type === 'cron' || type === 'cron-run' ? 'CRON' : 'SUBAGENT'
  return <span className={`acc-type-badge ${cls}`}>{label}</span>
}

// === SPAWN MODAL (kept as-is) ===
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Spawn a ${template?.id} agent with task: ${task.trim()}` })
      })
      if (response.ok) setTimeout(() => { onSpawn(); onClose() }, 1000)
    } catch (error) { console.error('Spawn error:', error) }
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

// === DETAIL PANEL ===
function AgentDetail({ agentId, onClose }) {
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [showThinking, setShowThinking] = useState({})
  const endRef = useRef(null)

  useEffect(() => {
    fetch(`/api/agents?detail=${agentId}`).then(r => r.json()).then(d => setData(d.agent)).catch(() => {})
  }, [agentId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [data])

  if (!data) return <div className="acc-detail-loading">Loading transcript...</div>

  const toggleExpand = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  const toggleThinking = (i) => setShowThinking(prev => ({ ...prev, [i]: !prev[i] }))

  return (
    <div className="acc-detail">
      <div className="acc-detail-header">
        <button className="acc-back-btn" onClick={onClose}>← BACK</button>
        <div className="acc-detail-title">{data.name}</div>
        <TypeBadge type={data.type} />
      </div>
      <div className="acc-detail-meta">
        <span>{formatDuration(data.duration)}</span>
        <span>{formatTokens(data.totalTokens)} tokens</span>
        <span className={costClass(data.cost)}>{formatCost(data.cost)}</span>
        <span>{data.model}</span>
      </div>
      {data.toolsUsed?.length > 0 && (
        <div className="acc-detail-tools">
          {data.toolsUsed.map((t, i) => <span key={i} className="acc-tool-badge">[{t}]</span>)}
        </div>
      )}
      <div className="acc-transcript">
        {data.transcript?.map((msg, i) => (
          <div key={i} className={`acc-msg acc-msg-${msg.role}`}>
            <div className="acc-msg-header">
              <span className={`acc-role-badge role-${msg.role}`}>{msg.role.toUpperCase()}</span>
              <span className="acc-msg-time">{formatTime(msg.ts)}</span>
            </div>
            {msg.thinking?.length > 0 && (
              <div className="acc-thinking-block">
                <button className="acc-thinking-toggle" onClick={() => toggleThinking(i)}>
                  {showThinking[i] ? '▾ THINKING' : '▸ THINKING'}
                </button>
                {showThinking[i] && <div className="acc-thinking-content">{msg.thinking.join('\n\n')}</div>}
              </div>
            )}
            {msg.toolCalls?.length > 0 && (
              <div className="acc-msg-tools">
                {msg.toolCalls.map((tc, j) => <span key={j} className="acc-tool-badge">[{tc.name}]</span>)}
              </div>
            )}
            {msg.content && (
              <div className="acc-msg-body">
                {msg.content.length > 500 && !expanded[i] ? (
                  <>
                    {msg.content.slice(0, 500)}...
                    <button className="acc-show-more" onClick={() => toggleExpand(i)}>SHOW MORE</button>
                  </>
                ) : (
                  <>
                    {msg.content}
                    {msg.content.length > 500 && <button className="acc-show-more" onClick={() => toggleExpand(i)}>SHOW LESS</button>}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// === KILL CONFIRM ===
function KillConfirm({ agent, onConfirm, onCancel }) {
  return (
    <div className="acc-kill-confirm">
      <span>Kill {agent.name}?</span>
      <button className="acc-kill-yes" onClick={onConfirm}>YES</button>
      <button className="acc-kill-cancel" onClick={onCancel}>CANCEL</button>
    </div>
  )
}

// === AGENT CARD ===
function AgentCard({ agent, onClick, onKill, compact }) {
  const [confirmKill, setConfirmKill] = useState(false)
  const isRunning = agent.status === 'running'

  const handleKill = async () => {
    setConfirmKill(false)
    onKill(agent)
  }

  return (
    <div className={`acc-card ${isRunning ? 'acc-card-running' : ''} ${compact ? 'acc-card-compact' : ''}`} onClick={() => onClick(agent.id)}>
      {isRunning && <div className="acc-pulse" />}
      <div className="acc-card-top">
        <div className="acc-card-name">{agent.name}</div>
        <div className="acc-card-right">
          <TypeBadge type={agent.type} />
          {agent.runCount > 0 && <span className="acc-run-count">ran {agent.runCount}x</span>}
          {isRunning && (
            <button className="acc-kill-btn" onClick={e => { e.stopPropagation(); setConfirmKill(true) }}>KILL</button>
          )}
        </div>
      </div>
      {isRunning && agent.currentThought && (
        <div className="acc-card-thought">{agent.currentThought}</div>
      )}
      {!compact && agent.summary && (
        <div className="acc-card-summary">"{agent.summary.slice(0, 60)}"</div>
      )}
      <div className="acc-card-meta">
        <span>{formatElapsed(agent.lastActive)}</span>
        <span>{formatTokens(agent.totalTokens)}</span>
        <span className={costClass(agent.cost)}>{formatCost(agent.cost)}</span>
        <span>{formatDuration(agent.duration)}</span>
      </div>
      {confirmKill && (
        <div onClick={e => e.stopPropagation()}>
          <KillConfirm agent={agent} onConfirm={handleKill} onCancel={() => setConfirmKill(false)} />
        </div>
      )}
    </div>
  )
}

// === TIMELINE ===
function ActivityTimeline({ timeline }) {
  if (!timeline?.length) return null
  return (
    <div className="acc-timeline">
      <div className="acc-section-title">ACTIVITY FEED</div>
      {timeline.map((entry, i) => {
        const icon = entry.status === 'running' ? '●' : entry.status === 'killed' ? '✗' : '✓'
        const iconClass = entry.status === 'running' ? 'tl-running' : entry.status === 'killed' ? 'tl-failed' : 'tl-complete'
        return (
          <div key={i} className="acc-tl-entry">
            <span className="acc-tl-time">{formatTime(entry.endTime || entry.startTime)}</span>
            <span className="acc-tl-sep"> — </span>
            <span className="acc-tl-name">{entry.name}</span>
            <span className={`acc-tl-icon ${iconClass}`}> {icon} </span>
            {entry.summary && <span className="acc-tl-summary">"{entry.summary.slice(0, 40)}"</span>}
            <span className="acc-tl-stats">
              [{formatDuration(entry.duration)}, {formatTokens(entry.tokens)}]
            </span>
          </div>
        )
      })}
    </div>
  )
}

// === MAIN MODULE ===
export default function AgentsModule({ scrollToAgentId, onScrollHandled }) {
  const [agents, setAgents] = useState([])
  const [stats, setStats] = useState({})
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [spawnModal, setSpawnModal] = useState({ open: false, template: null })
  const { checkAgentTransitions } = useNotifications()

  // Handle scroll-to-agent from notifications
  useEffect(() => {
    if (scrollToAgentId) {
      setSelectedAgent(scrollToAgentId)
      if (onScrollHandled) onScrollHandled()
    }
  }, [scrollToAgentId, onScrollHandled])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      const agentList = data.agents || []
      setAgents(agentList)
      setStats(data.stats || {})
      setTimeline(data.timeline || [])
      checkAgentTransitions(agentList)
    } catch (err) { console.error('Fetch agents error:', err) }
    finally { setLoading(false) }
  }, [checkAgentTransitions])

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 5000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  const handleKill = async (agent) => {
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill', sessionId: agent.id })
      })
      fetchAgents()
    } catch (err) { console.error('Kill error:', err) }
  }

  if (loading) {
    return <div className="card full"><div className="section-header">Agent Command Center</div><div className="empty-state">Initializing...</div></div>
  }

  if (selectedAgent) {
    return <div className="card full"><AgentDetail agentId={selectedAgent} onClose={() => setSelectedAgent(null)} /></div>
  }

  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000
  const twoHoursAgo = now - 2 * 60 * 60 * 1000

  const running = agents.filter(a => a.status === 'running')
  const recent = agents.filter(a => a.status !== 'running' && a.lastActive > twoHoursAgo)
  const older = agents.filter(a => a.status !== 'running' && a.lastActive <= twoHoursAgo)

  // Separate cron and subagent in recent
  const recentSubagents = recent.filter(a => a.type === 'subagent')
  const recentCrons = recent.filter(a => a.type === 'cron' || a.type === 'cron-run')

  return (
    <div className="card full">
      {/* Header */}
      <div className="acc-header">
        <div className="acc-title">AGENT COMMAND CENTER</div>
        <div className="acc-stats">
          <div className="acc-stat">
            <span className={`acc-stat-num ${stats.running > 0 ? 'acc-stat-active' : ''}`}>{stats.running || 0}</span>
            <span className="acc-stat-label">RUNNING</span>
          </div>
          <div className="acc-stat">
            <span className="acc-stat-num">{stats.completedToday || 0}</span>
            <span className="acc-stat-label">TODAY</span>
          </div>
          <div className="acc-stat">
            <span className={`acc-stat-num ${costClass(stats.estimatedCost)}`}>{formatCost(stats.estimatedCost)}</span>
            <span className="acc-stat-label">COST</span>
          </div>
        </div>
      </div>

      {/* Quick Spawn */}
      <div className="acc-spawn">
        <div className="acc-spawn-label">QUICK SPAWN</div>
        <div className="acc-spawn-btns">
          {TASK_TEMPLATES.map(t => (
            <button key={t.id} className="agent-template-btn" onClick={() => setSpawnModal({ open: true, template: t })}>{t.name}</button>
          ))}
        </div>
      </div>

      {/* Running Agents */}
      {running.length > 0 && (
        <div className="acc-section">
          <div className="acc-section-title">RUNNING ({running.length})</div>
          {running.map(a => (
            <AgentCard key={a.id} agent={a} onClick={setSelectedAgent} onKill={handleKill} />
          ))}
        </div>
      )}

      {/* Recent Sub-agents */}
      {recentSubagents.length > 0 && (
        <div className="acc-section">
          <div className="acc-section-title">RECENT SUBAGENTS</div>
          {recentSubagents.map(a => (
            <AgentCard key={a.id} agent={a} onClick={setSelectedAgent} onKill={handleKill} compact />
          ))}
        </div>
      )}

      {/* Recent Crons */}
      {recentCrons.length > 0 && (
        <div className="acc-section">
          <div className="acc-section-title">RECENT CRONS</div>
          {recentCrons.map(a => (
            <AgentCard key={a.id} agent={a} onClick={setSelectedAgent} onKill={handleKill} compact />
          ))}
        </div>
      )}

      {/* Activity Timeline */}
      <ActivityTimeline timeline={timeline} />

      {/* Show All */}
      {older.length > 0 && (
        <div className="acc-section">
          <button className="acc-show-all-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'HIDE' : `SHOW ALL (${older.length})`}
          </button>
          {showAll && (
            <div className="acc-all-list">
              {older.map(a => (
                <div key={a.id} className="acc-all-item" onClick={() => setSelectedAgent(a.id)}>
                  <TypeBadge type={a.type} />
                  <span className="acc-all-name">{a.name}</span>
                  {a.runCount > 0 && <span className="acc-run-count">ran {a.runCount}x</span>}
                  <span className="acc-all-time">{formatElapsed(a.lastActive)}</span>
                  <span className={costClass(a.cost)}>{formatCost(a.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="acc-empty">No agents found. Use Quick Spawn or chat to create one.</div>
      )}

      <AgentSpawnModal
        isOpen={spawnModal.open}
        template={spawnModal.template}
        onClose={() => setSpawnModal({ open: false, template: null })}
        onSpawn={fetchAgents}
      />
    </div>
  )
}
