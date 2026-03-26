'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNotifications } from '../context/NotificationContext'
import { ArrowRight, ArrowLeft, X, Check, XCircle, Circle, ChevronDown, ChevronRight, Send, Zap, Skull, Navigation, Loader, CheckCircle, AlertCircle, Rocket } from 'lucide-react'

// ══════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════

function formatCost(c) {
  if (!c || c < 0.001) return '$0.00'
  if (c < 0.01) return '$' + c.toFixed(3)
  return '$' + c.toFixed(2)
}

function formatDuration(seconds) {
  if (!seconds) return '--'
  if (seconds < 60) return seconds + 's'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
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

function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(n)
}

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function costClass(c) {
  if (!c || c < 0.10) return 'cost-low'
  if (c < 0.50) return 'cost-med'
  return 'cost-high'
}

function successRate(total, successful) {
  if (!total) return '--'
  return Math.round((successful / total) * 100) + '%'
}

function stalenessColor(ts) {
  if (!ts) return 'emp-stale-red'
  const diff = Date.now() - ts
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 1) return 'emp-stale-green'
  if (days < 3) return 'emp-stale-yellow'
  if (days < 7) return 'emp-stale-orange'
  return 'emp-stale-red'
}

function stalenessLabel(ts) {
  if (!ts) return 'Never active'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Active now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function renderFormattedText(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let inList = false
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      elements.push(<h3 key={i} className="emp-mem-h1">{trimmed.slice(2)}</h3>)
      inList = false
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h4 key={i} className="emp-mem-h2">{trimmed.slice(3)}</h4>)
      inList = false
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h5 key={i} className="emp-mem-h3">{trimmed.slice(4)}</h5>)
      inList = false
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2)
      elements.push(
        <div key={i} className="emp-mem-bullet">
          <span className="emp-mem-bullet-dot">—</span>
          <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
        </div>
      )
      inList = true
    } else if (trimmed === '') {
      if (!inList) elements.push(<div key={i} className="emp-mem-spacer" />)
      inList = false
    } else {
      elements.push(<p key={i} className="emp-mem-p" dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />)
      inList = false
    }
  })
  return elements
}

function boldify(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}

// ══════════════════════════════════════════════════════
// WAR ROOM — Unified (employees + sub-agents)
// ══════════════════════════════════════════════════════

function ElapsedTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startTime) return
    const update = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startTime])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return <span className="live-timer">{m}:{s.toString().padStart(2, '0')}</span>
}

// Parse tool calls from transcript into activity entries
function parseActivityFromTranscript(transcript) {
  if (!transcript || !Array.isArray(transcript)) return []
  const activities = []
  for (const msg of transcript) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        let description = tc.name
        let args = {}
        try { args = typeof tc.args === 'string' ? JSON.parse(tc.args) : (tc.args || {}) } catch {}
        
        if (tc.name === 'Read' || tc.name === 'read') {
          description = `Read ${(args.file_path || args.path || '').split('/').pop() || 'file'}`
        } else if (tc.name === 'Edit' || tc.name === 'edit') {
          description = `Edit ${(args.file_path || args.path || '').split('/').pop() || 'file'}`
        } else if (tc.name === 'Write' || tc.name === 'write') {
          description = `Write ${(args.file_path || args.path || '').split('/').pop() || 'file'}`
        } else if (tc.name === 'exec') {
          const cmd = args.command || ''
          description = `Run \`${cmd.slice(0, 35)}${cmd.length > 35 ? '…' : ''}\``
        } else if (tc.name === 'web_search') {
          description = `Search: ${(args.query || '').slice(0, 30)}`
        } else if (tc.name === 'web_fetch') {
          description = `Fetch ${(args.url || '').slice(0, 30)}`
        } else if (tc.name === 'sessions_spawn') {
          description = 'Spawn sub-agent'
        } else if (tc.name === 'browser') {
          description = `Browser: ${args.action || 'action'}`
        }
        
        activities.push({
          ts: msg.ts,
          tool: tc.name,
          description,
          status: 'complete'
        })
      }
    }
  }
  return activities.slice(-5) // Last 5
}

function LiveAgentCard({ agent, onKill, onSteer, activityData }) {
  const [confirmKill, setConfirmKill] = useState(false)
  const [steerOpen, setSteerOpen] = useState(false)
  const [steerText, setSteerText] = useState('')
  const [steerSending, setSteerSending] = useState(false)
  const [exiting, setExiting] = useState(false)
  const steerRef = useRef(null)

  useEffect(() => {
    if (steerOpen) setTimeout(() => steerRef.current?.focus(), 50)
  }, [steerOpen])

  const handleSteer = async () => {
    if (!steerText.trim() || steerSending) return
    setSteerSending(true)
    try {
      await onSteer(agent, steerText.trim())
      setSteerText('')
      setSteerOpen(false)
    } catch {}
    setSteerSending(false)
  }

  const handleSteerKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSteer() }
    if (e.key === 'Escape') { setSteerOpen(false); setSteerText('') }
  }

  const activities = activityData ? parseActivityFromTranscript(activityData.transcript) : []
  const tokenCount = activityData?.totalTokens || agent.totalTokens || 0
  const cost = activityData?.cost || agent.cost || 0
  // Indeterminate progress if we can't estimate
  const hasTokens = tokenCount > 0

  // Find matching employee info
  const isEmployee = !agent._isSubagent
  const avatarEmoji = agent.avatar_emoji || (agent.type === 'cron' ? null : null)

  return (
    <div className={`live-card ${exiting ? 'live-card-exit' : 'live-card-enter'}`}>
      <div className="live-card-border" />
      <div className="live-card-content">
        {/* Header */}
        <div className="live-card-header">
          <div className="live-card-identity">
            {avatarEmoji ? (
              <span className="live-card-avatar">{avatarEmoji}</span>
            ) : (
              <Zap size={16} className="live-card-icon" />
            )}
            <span className="live-card-name">{agent.name}</span>
          </div>
          <div className="live-card-status">
            <div className="live-pulse-dot" />
            <span className="live-status-text">RUNNING</span>
            <ElapsedTimer startTime={agent.deployedAt || agent.startTime || agent.lastActive || Date.now()} />
          </div>
        </div>

        {/* Task description */}
        {agent.currentTask && (
          <div className="live-card-task">&ldquo;{agent.currentTask}&rdquo;</div>
        )}

        {/* Activity stream */}
        <div className="live-activity">
          <div className="live-activity-label">LIVE ACTIVITY</div>
          <div className="live-activity-stream">
            {activities.length > 0 ? (
              activities.map((act, i) => {
                const isLast = i === activities.length - 1
                const timeStr = act.ts ? new Date(act.ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'
                return (
                  <div key={i} className={`live-activity-line ${isLast ? 'live-activity-current' : ''}`}>
                    <span className="live-activity-time">{timeStr}</span>
                    {isLast ? (
                      <>
                        <span className="live-activity-arrow">→</span>
                        <span className="live-activity-desc">{act.description}<span className="live-typing-dots" /></span>
                      </>
                    ) : (
                      <>
                        <Check size={12} className="live-activity-check" />
                        <span className="live-activity-desc">{act.description}</span>
                      </>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="live-activity-line live-activity-unavailable">
                <Loader size={12} className="live-activity-spinner" />
                <span className="live-activity-desc">Waiting for activity data...</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="live-card-stats">
          <div className="live-progress-wrap">
            {hasTokens ? (
              <div className="live-progress-bar" style={{ width: `${Math.min((tokenCount / 50000) * 100, 100)}%` }} />
            ) : (
              <div className="live-progress-bar live-progress-indeterminate" />
            )}
          </div>
          <div className="live-stats-row">
            <span className="live-stat">{formatTokens(tokenCount)} tokens</span>
            <span className="live-stat">{formatCost(cost)}</span>
            <div className="live-actions">
              {!steerOpen ? (
                <button className="live-action-btn live-steer-btn" onClick={(e) => { e.stopPropagation(); setSteerOpen(true) }}>
                  <Navigation size={12} /> STEER
                </button>
              ) : (
                <div className="live-steer-input-wrap" onClick={e => e.stopPropagation()}>
                  <input
                    ref={steerRef}
                    className="live-steer-input"
                    value={steerText}
                    onChange={e => setSteerText(e.target.value)}
                    onKeyDown={handleSteerKey}
                    placeholder="message to agent..."
                    disabled={steerSending}
                  />
                  <button className="live-steer-send" onClick={handleSteer} disabled={!steerText.trim() || steerSending}>
                    <Send size={12} />
                  </button>
                </div>
              )}
              {!confirmKill ? (
                <button className="live-action-btn live-kill-btn" onClick={(e) => { e.stopPropagation(); setConfirmKill(true) }}>
                  <Skull size={12} /> KILL
                </button>
              ) : (
                <div className="live-kill-confirm" onClick={e => e.stopPropagation()}>
                  <span>Kill?</span>
                  <button className="live-kill-yes" onClick={() => { setConfirmKill(false); onKill(agent) }}>YES</button>
                  <button className="live-kill-no" onClick={() => setConfirmKill(false)}>NO</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompletionToast({ agent, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="live-toast live-toast-enter">
      <CheckCircle size={14} className="live-toast-icon" />
      <span className="live-toast-text">
        {agent.name} completed in {formatDuration(agent.duration)} — {formatTokens(agent.totalTokens)} tokens, {formatCost(agent.cost)}
      </span>
    </div>
  )
}

function LiveAgentsView({ activeEmployees, deployingCards, runningAgents, employees, onDeploy, deployingIds, onKill }) {
  const [activityCache, setActivityCache] = useState({}) // agentId -> detail data
  const [toasts, setToasts] = useState([]) // completion toasts
  const prevRunningRef = useRef(new Set())

  // Merge all running items
  const empItems = [...deployingCards, ...activeEmployees.filter(e => e.status === 'running')].map(e => ({
    ...e,
    deployedAt: e.deployedAt || e.last_run_at || Date.now(),
    currentTask: e.currentTask || e.last_summary || 'Running...',
    _isSubagent: false,
  }))
  const agentItems = (runningAgents || []).map(a => ({
    id: a.id,
    name: a.name,
    avatar_emoji: a.type === 'cron' || a.type === 'cron-run' ? null : null,
    currentTask: a.currentThought || a.summary || 'Running...',
    deployedAt: a.startTime || a.lastActive || Date.now(),
    startTime: a.startTime,
    lastActive: a.lastActive,
    totalTokens: a.totalTokens,
    cost: a.cost,
    type: a.type,
    _isSubagent: true,
  }))
  const allActive = [...empItems, ...agentItems]

  // Detect completions — when an agent disappears from running list
  useEffect(() => {
    const currentIds = new Set(allActive.map(a => a.id))
    const prevIds = prevRunningRef.current
    for (const prevId of prevIds) {
      if (!currentIds.has(prevId)) {
        // Agent completed — check if we have cached data for toast
        const cached = activityCache[prevId]
        if (cached) {
          setToasts(prev => [...prev, { id: prevId, name: cached.name || 'Agent', duration: cached.duration, totalTokens: cached.totalTokens, cost: cached.cost }])
        }
      }
    }
    prevRunningRef.current = currentIds
  }, [allActive.map(a => a.id).join(',')])

  // Poll detail endpoint for running agents every 3 seconds
  useEffect(() => {
    const runningIds = allActive.filter(a => a._isSubagent && a.id).map(a => a.id)
    if (runningIds.length === 0) return

    const pollDetail = async () => {
      for (const id of runningIds) {
        try {
          const res = await fetch(`/api/agents?detail=${id}`)
          const data = await res.json()
          if (data.agent) {
            setActivityCache(prev => ({ ...prev, [id]: data.agent }))
          }
        } catch {}
      }
    }
    pollDetail()
    const interval = setInterval(pollDetail, 3000)
    return () => clearInterval(interval)
  }, [allActive.filter(a => a._isSubagent).map(a => a.id).join(',')])

  // Handle steer
  const handleSteer = async (agent, message) => {
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Send this message to agent session ${agent.id}: ${message}` })
      })
    } catch (err) {
      console.error('Steer error:', err)
    }
  }

  // Handle kill (reuse existing mechanism)
  const handleKill = async (agent) => {
    if (agent._isSubagent) {
      try {
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kill', sessionId: agent.id })
        })
      } catch (err) {
        console.error('Kill error:', err)
      }
    }
    if (onKill) onKill(agent)
  }

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // ─── No active agents: show suggestions ───
  if (allActive.length === 0) {
    const projectEmployees = (employees || []).filter(e => e.type === 'project')
    const staleEmployees = [...projectEmployees].sort((a, b) => (a.last_run_at || 0) - (b.last_run_at || 0))
    const suggestions = staleEmployees.slice(0, 3)
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const allFresh = projectEmployees.length > 0 && projectEmployees.every(e => e.last_run_at && e.last_run_at > todayStart)

    return (
      <div className="live-section">
        {/* Completion toasts */}
        {toasts.map(t => (
          <CompletionToast key={t.id} agent={t} onDismiss={() => dismissToast(t.id)} />
        ))}
        <div className="live-idle">
          <div className="live-idle-header">
            <Circle size={8} className="live-idle-dot" />
            <span className="live-idle-label">NO ACTIVE AGENTS</span>
          </div>
          {allFresh ? (
            <div className="live-idle-fresh">
              <Check size={14} className="live-idle-fresh-icon" />
              <span>All agents standing by — team is fresh</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="live-idle-suggestions">
              <div className="live-idle-suggest-label">Suggested deployments:</div>
              {suggestions.map(emp => (
                <div key={emp.id} className="live-idle-suggest-row">
                  <span className="live-idle-suggest-emoji">{emp.avatar_emoji}</span>
                  <span className="live-idle-suggest-name">{emp.name}</span>
                  <span className="live-idle-suggest-stale">last active {stalenessLabel(emp.last_run_at)}</span>
                  <InlineDeploy employee={emp} onDeploy={onDeploy} isDeploying={deployingIds?.has(emp.id)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="live-idle-fresh">
              <span>All agents standing by</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Active agents: show live cards ───
  return (
    <div className="live-section">
      {/* Completion toasts */}
      {toasts.map(t => (
        <CompletionToast key={t.id} agent={t} onDismiss={() => dismissToast(t.id)} />
      ))}
      <div className="live-header-label">LIVE OPS</div>
      {allActive.map((agent, i) => (
        <LiveAgentCard
          key={agent.id || i}
          agent={agent}
          onKill={handleKill}
          onSteer={handleSteer}
          activityData={activityCache[agent.id]}
        />
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// EMPLOYEE COMPONENTS (from EmployeesModule)
// ══════════════════════════════════════════════════════

function InlineDeploy({ employee, onDeploy, isDeploying }) {
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const handleSubmit = () => {
    if (!task.trim() || isDeploying) return
    onDeploy(employee, task.trim())
    setTask('')
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape') { setOpen(false); setTask('') }
  }

  if (isDeploying) {
    return (
      <div className="emp-inline-deploying">
        <div className="emp-warroom-pulse" />
        <span>Deploying...</span>
      </div>
    )
  }

  return (
    <div className="emp-inline-deploy" onClick={e => e.stopPropagation()}>
      {!open ? (
        <button className="emp-deploy-trigger" onClick={(e) => { e.stopPropagation(); setOpen(true) }}>DEPLOY</button>
      ) : (
        <div className="emp-deploy-input-wrap">
          <input ref={inputRef} className="emp-deploy-input" value={task} onChange={e => setTask(e.target.value)} onKeyDown={handleKeyDown} placeholder="describe the task..." />
          <button className="emp-deploy-send" onClick={handleSubmit} disabled={!task.trim()}><Send size={14} /></button>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ employee, onDeploy, onClick, isDeploying }) {
  const staleClass = stalenessColor(employee.last_run_at)
  const weight = employee.total_runs > 10 ? 'emp-card-heavy' : ''
  return (
    <div className={`emp-project-card ${weight}`} onClick={() => onClick(employee.id)}>
      <div className="emp-pcard-top">
        <div className="emp-pcard-avatar-wrap">
          <span className="emp-pcard-avatar">{employee.avatar_emoji}</span>
        </div>
        <div className="emp-pcard-identity">
          <span className="emp-pcard-name">{employee.name}</span>
          <span className="emp-pcard-specialty">{employee.specialty}</span>
        </div>
        <div className={`emp-pcard-staleness ${staleClass}`}>{stalenessLabel(employee.last_run_at)}</div>
      </div>
      <div className="emp-pcard-stats">
        <span>{employee.total_runs} runs</span>
        <span>{formatCost(employee.total_cost)}</span>
        <span>{successRate(employee.total_runs, employee.successful_runs)}</span>
      </div>
      {employee.last_summary && <div className="emp-pcard-summary">{employee.last_summary}</div>}
      <InlineDeploy employee={employee} onDeploy={onDeploy} isDeploying={isDeploying} />
    </div>
  )
}

function UtilityChip({ employee, onDeploy, onClick, isDeploying }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="emp-util-chip-wrap">
      <div className={`emp-util-chip ${expanded ? 'emp-util-chip-expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
        <span className="emp-util-chip-emoji">{employee.avatar_emoji}</span>
        <span className="emp-util-chip-name">{employee.name}</span>
        <span className="emp-util-chip-runs">{employee.total_runs}</span>
      </div>
      {expanded && (
        <div className="emp-util-expanded" onClick={e => e.stopPropagation()}>
          <div className="emp-util-expanded-info">
            <span className="emp-util-expanded-specialty">{employee.specialty}</span>
            <span className="emp-util-expanded-meta">Last: {formatElapsed(employee.last_run_at)} · {formatCost(employee.total_cost)}</span>
          </div>
          <div className="emp-util-expanded-actions">
            <InlineDeploy employee={employee} onDeploy={onDeploy} isDeploying={isDeploying} />
            <button className="emp-util-detail-btn" onClick={() => onClick(employee.id)}>DETAIL</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PromotionBanner({ candidate, onPromote }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState(candidate.category)
  const [prompt, setPrompt] = useState('')

  const handlePromote = () => {
    if (!name.trim()) return
    onPromote(candidate.category, name.trim(), specialty.trim(), prompt.trim())
    setShowForm(false)
  }

  return (
    <div className="emp-promo-card">
      <div className="emp-promo-card-top">
        <div className="emp-promo-badge">NEW HIRE CANDIDATE</div>
        <div className="emp-promo-info">
          <span className="emp-promo-category">{candidate.category}</span>
          <span className="emp-promo-runs">{candidate.run_count} runs without promotion</span>
        </div>
      </div>
      {!showForm ? (
        <button className="emp-promo-hire-btn" onClick={() => setShowForm(true)}>HIRE <ArrowRight size={12} style={{ verticalAlign: 'middle' }} /></button>
      ) : (
        <div className="emp-promo-form-v2">
          <input className="emp-promo-input-v2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="emp-promo-input-v2" placeholder="Specialty" value={specialty} onChange={e => setSpecialty(e.target.value)} />
          <textarea className="emp-promo-input-v2 emp-promo-textarea-v2" placeholder="System prompt (optional)" value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} />
          <div className="emp-promo-form-actions-v2">
            <button className="emp-btn emp-btn-secondary" onClick={() => setShowForm(false)}>CANCEL</button>
            <button className="emp-btn emp-btn-primary" onClick={handlePromote} disabled={!name.trim()}>CREATE</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// EMPLOYEE DETAIL PANEL (slide-out)
// ══════════════════════════════════════════════════════

function EmployeeDetailPanel({ employeeId, onClose }) {
  const [data, setData] = useState(null)
  const [memory, setMemory] = useState('')
  const [editingMemory, setEditingMemory] = useState(false)
  const [memoryDraft, setMemoryDraft] = useState('')
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    fetch(`/api/employees?id=${employeeId}`).then(r => r.json()).then(d => setData(d)).catch(() => {})
    fetch('/api/employees', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-memory', id: employeeId })
    }).then(r => r.json()).then(d => { setMemory(d.content || ''); setMemoryDraft(d.content || '') }).catch(() => {})
  }, [employeeId])

  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose() }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const saveMemory = async () => {
    setSaving(true)
    await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update-memory', id: employeeId, content: memoryDraft }) })
    setMemory(memoryDraft); setEditingMemory(false); setSaving(false)
  }

  const savePrompt = async () => {
    setSaving(true)
    await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: employeeId, system_prompt: promptDraft }) })
    setData(prev => ({ ...prev, employee: { ...prev.employee, system_prompt: promptDraft } }))
    setEditingPrompt(false); setSaving(false)
  }

  if (!data) {
    return (
      <>
        <div className="emp-panel-overlay" />
        <div className="emp-panel" ref={panelRef}><div className="emp-panel-loading">Loading...</div></div>
      </>
    )
  }

  const emp = data.employee
  const runs = data.runs || []
  const projectFiles = data.projectFiles || { files: [], count: 0 }
  const isProject = emp.type === 'project'
  const totalRuns = runs.length
  const avgCost = totalRuns > 0 ? runs.reduce((s, r) => s + (r.cost || 0), 0) / totalRuns : 0
  const avgDuration = totalRuns > 0 ? Math.round(runs.reduce((s, r) => s + (r.duration || 0), 0) / totalRuns) : 0

  return (
    <>
      <div className="emp-panel-overlay" onClick={onClose} />
      <div className="emp-panel" ref={panelRef}>
        <button className="emp-panel-close" onClick={onClose}><X size={16} /></button>
        <div className="emp-panel-header">
          <span className="emp-panel-avatar">{emp.avatar_emoji}</span>
          <div className="emp-panel-header-info">
            <span className="emp-panel-name">{emp.name}</span>
            <span className={`emp-type-badge emp-type-${emp.type}`}>{emp.type.toUpperCase()}</span>
          </div>
        </div>
        <div className="emp-panel-specialty">{emp.specialty}</div>
        <div className="emp-panel-stats">
          <div className="emp-panel-stat"><span className="emp-panel-stat-num">{emp.total_runs}</span><span className="emp-panel-stat-label">RUNS</span></div>
          <div className="emp-panel-stat"><span className="emp-panel-stat-num">{successRate(emp.total_runs, emp.successful_runs)}</span><span className="emp-panel-stat-label">SUCCESS</span></div>
          <div className="emp-panel-stat"><span className="emp-panel-stat-num">{formatCost(avgCost)}</span><span className="emp-panel-stat-label">AVG COST</span></div>
          <div className="emp-panel-stat"><span className="emp-panel-stat-num">{formatDuration(avgDuration)}</span><span className="emp-panel-stat-label">AVG TIME</span></div>
        </div>

        {/* Memory */}
        <div className="emp-panel-section">
          <div className="emp-panel-section-header">
            <span>MEMORY</span>
            <button className="emp-panel-edit-btn" onClick={() => { if (editingMemory) setEditingMemory(false); else { setMemoryDraft(memory); setEditingMemory(true) } }}>{editingMemory ? 'CANCEL' : 'EDIT'}</button>
          </div>
          <div className="emp-panel-section-body emp-panel-memory-body">
            {editingMemory ? (
              <div className="emp-panel-edit-area">
                <textarea className="emp-panel-textarea" value={memoryDraft} onChange={e => setMemoryDraft(e.target.value)} rows={12} />
                <button className="emp-btn emp-btn-primary" onClick={saveMemory} disabled={saving}>{saving ? 'SAVING...' : 'SAVE'}</button>
              </div>
            ) : (
              <div className="emp-panel-memory-content">{memory ? renderFormattedText(memory) : <span className="emp-muted">Empty memory file</span>}</div>
            )}
          </div>
        </div>

        {/* Run History */}
        <div className="emp-panel-section">
          <div className="emp-panel-section-header"><span>RUN HISTORY ({runs.length})</span></div>
          <div className="emp-panel-section-body">
            {runs.length === 0 ? (
              <div className="emp-muted" style={{ padding: '1rem' }}>No runs yet</div>
            ) : (
              <div className="emp-panel-timeline">
                {runs.map((run, i) => (
                  <div key={run.id} className="emp-timeline-entry">
                    <div className="emp-timeline-line">
                      <div className={`emp-timeline-dot emp-timeline-dot-${run.status}`} />
                      {i < runs.length - 1 && <div className="emp-timeline-connector" />}
                    </div>
                    <div className="emp-timeline-content">
                      <div className="emp-timeline-top">
                        <span className="emp-timeline-task">{run.task?.slice(0, 60) || 'Unknown task'}{run.task?.length > 60 ? '...' : ''}</span>
                        <span className={`emp-timeline-status emp-timeline-status-${run.status}`}>{run.status === 'completed' ? <Check size={12} /> : run.status === 'failed' ? <XCircle size={12} /> : <Circle size={10} fill="currentColor" />}</span>
                      </div>
                      <div className="emp-timeline-meta">
                        <span>{formatElapsed(run.completed_at || run.started_at)}</span>
                        <span>{formatDuration(run.duration)}</span>
                        <span>{formatCost(run.cost)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Prompt */}
        <div className="emp-panel-section">
          <div className="emp-panel-section-header emp-panel-collapsible" onClick={() => setPromptOpen(!promptOpen)}>
            <span>{promptOpen ? <ChevronDown size={12} style={{ verticalAlign: 'middle' }} /> : <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />} SYSTEM PROMPT</span>
            {promptOpen && (
              <button className="emp-panel-edit-btn" onClick={(e) => { e.stopPropagation(); if (editingPrompt) setEditingPrompt(false); else { setPromptDraft(emp.system_prompt || ''); setEditingPrompt(true) } }}>{editingPrompt ? 'CANCEL' : 'EDIT'}</button>
            )}
          </div>
          {promptOpen && (
            <div className="emp-panel-section-body">
              {editingPrompt ? (
                <div className="emp-panel-edit-area">
                  <textarea className="emp-panel-textarea" value={promptDraft} onChange={e => setPromptDraft(e.target.value)} rows={8} />
                  <button className="emp-btn emp-btn-primary" onClick={savePrompt} disabled={saving}>{saving ? 'SAVING...' : 'SAVE'}</button>
                </div>
              ) : (
                <div className="emp-panel-prompt-text">{emp.system_prompt || <span className="emp-muted">No system prompt set</span>}</div>
              )}
            </div>
          )}
        </div>

        {/* Project Files */}
        {isProject && projectFiles.files.length > 0 && (
          <div className="emp-panel-section">
            <div className="emp-panel-section-header"><span>PROJECT FILES ({projectFiles.count})</span></div>
            <div className="emp-panel-section-body emp-panel-files">
              {projectFiles.files.map((f, i) => (
                <div key={i} className="emp-panel-file">
                  <span className="emp-panel-file-name">{f.name}</span>
                  <span className="emp-panel-file-size">{f.ext === 'dir' ? `${f.fileCount} files` : f.size > 1024 ? `${Math.round(f.size / 1024)}KB` : `${f.size}B`}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════
// CREATE EMPLOYEE MODAL
// ══════════════════════════════════════════════════════

function CreateModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [type, setType] = useState('project')
  const [emoji, setEmoji] = useState('🤖')
  const [projectPath, setProjectPath] = useState('')
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || !specialty.trim() || creating) return
    setCreating(true)
    try {
      await onCreate({ name: name.trim(), specialty: specialty.trim(), type, avatar_emoji: emoji, project_path: projectPath.trim() || undefined, system_prompt: prompt.trim() || undefined })
      onClose()
      setName(''); setSpecialty(''); setType('project'); setEmoji('🤖'); setProjectPath(''); setPrompt('')
    } catch (err) { console.error('Create error:', err) }
    setCreating(false)
  }

  if (!isOpen) return null

  return (
    <div className="emp-modal-overlay" onClick={onClose}>
      <div className="emp-modal" onClick={e => e.stopPropagation()}>
        <div className="emp-modal-header"><span>NEW AGENT</span></div>
        <div className="emp-modal-field">
          <label className="emp-modal-label">NAME</label>
          <input className="emp-modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Headland, Analyst" />
        </div>
        <div className="emp-modal-field">
          <label className="emp-modal-label">TYPE</label>
          <select className="emp-modal-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="project">Project Agent</option>
            <option value="utility">Utility Agent</option>
          </select>
        </div>
        <div className="emp-modal-field">
          <label className="emp-modal-label">SPECIALTY</label>
          <input className="emp-modal-input" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="What they're good at" />
        </div>
        <div className="emp-modal-field">
          <label className="emp-modal-label">EMOJI</label>
          <input className="emp-modal-input emp-modal-input-short" value={emoji} onChange={e => setEmoji(e.target.value)} />
        </div>
        {type === 'project' && (
          <div className="emp-modal-field">
            <label className="emp-modal-label">PROJECT PATH</label>
            <input className="emp-modal-input" value={projectPath} onChange={e => setProjectPath(e.target.value)} placeholder="~/Desktop/WOOZY/PROJECTS/..." />
          </div>
        )}
        <div className="emp-modal-field">
          <label className="emp-modal-label">SYSTEM PROMPT</label>
          <textarea className="emp-modal-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="Instructions and context for this agent" />
        </div>
        <div className="emp-modal-actions">
          <button className="emp-btn emp-btn-secondary" onClick={onClose}>CANCEL</button>
          <button className="emp-btn emp-btn-primary" onClick={handleCreate} disabled={!name.trim() || !specialty.trim() || creating}>{creating ? 'CREATING...' : 'CREATE'}</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// AGENT (sub-agent/cron) COMPONENTS (from AgentsModule)
// ══════════════════════════════════════════════════════

function TypeBadge({ type }) {
  const cls = type === 'cron' || type === 'cron-run' ? 'type-badge-cron' : 'type-badge-subagent'
  const label = type === 'cron' || type === 'cron-run' ? 'CRON' : 'SUBAGENT'
  return <span className={`acc-type-badge ${cls}`}>{label}</span>
}

function AgentCard({ agent, onClick, onKill, compact }) {
  const [confirmKill, setConfirmKill] = useState(false)
  const isRunning = agent.status === 'running'

  const handleKill = async () => { setConfirmKill(false); onKill(agent) }

  return (
    <div className={`acc-card ${isRunning ? 'acc-card-running' : ''} ${compact ? 'acc-card-compact' : ''}`} onClick={() => onClick(agent.id)}>
      {isRunning && <div className="acc-pulse" />}
      <div className="acc-card-top">
        <div className="acc-card-name">{agent.name}</div>
        <div className="acc-card-right">
          <TypeBadge type={agent.type} />
          {agent.runCount > 0 && <span className="acc-run-count">ran {agent.runCount}x</span>}
          {isRunning && <button className="acc-kill-btn" onClick={e => { e.stopPropagation(); setConfirmKill(true) }}>KILL</button>}
        </div>
      </div>
      {isRunning && agent.currentThought && <div className="acc-card-thought">{agent.currentThought}</div>}
      {!compact && agent.summary && <div className="acc-card-summary">"{agent.summary.slice(0, 60)}"</div>}
      <div className="acc-card-meta">
        <span>{formatElapsed(agent.lastActive)}</span>
        <span>{formatTokens(agent.totalTokens)}</span>
        <span className={costClass(agent.cost)}>{formatCost(agent.cost)}</span>
        <span>{formatDuration(agent.duration)}</span>
      </div>
      {confirmKill && (
        <div onClick={e => e.stopPropagation()}>
          <div className="acc-kill-confirm">
            <span>Kill {agent.name}?</span>
            <button className="acc-kill-yes" onClick={handleKill}>YES</button>
            <button className="acc-kill-cancel" onClick={() => setConfirmKill(false)}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentDetail({ agentId, onClose }) {
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [showThinking, setShowThinking] = useState({})
  const endRef = useRef(null)

  useEffect(() => { fetch(`/api/agents?detail=${agentId}`).then(r => r.json()).then(d => setData(d.agent)).catch(() => {}) }, [agentId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [data])

  if (!data) return <div className="acc-detail-loading">Loading transcript...</div>

  const toggleExpand = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  const toggleThinking = (i) => setShowThinking(prev => ({ ...prev, [i]: !prev[i] }))

  return (
    <div className="acc-detail">
      <div className="acc-detail-header">
        <button className="acc-back-btn" onClick={onClose}><ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />BACK</button>
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
        <div className="acc-detail-tools">{data.toolsUsed.map((t, i) => <span key={i} className="acc-tool-badge">[{t}]</span>)}</div>
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
                <button className="acc-thinking-toggle" onClick={() => toggleThinking(i)}>{showThinking[i] ? <><ChevronDown size={12} style={{ verticalAlign: 'middle' }} /> THINKING</> : <><ChevronRight size={12} style={{ verticalAlign: 'middle' }} /> THINKING</>}</button>
                {showThinking[i] && <div className="acc-thinking-content">{msg.thinking.join('\n\n')}</div>}
              </div>
            )}
            {msg.toolCalls?.length > 0 && (
              <div className="acc-msg-tools">{msg.toolCalls.map((tc, j) => <span key={j} className="acc-tool-badge">[{tc.name}]</span>)}</div>
            )}
            {msg.content && (
              <div className="acc-msg-body">
                {msg.content.length > 500 && !expanded[i] ? (
                  <>{msg.content.slice(0, 500)}...<button className="acc-show-more" onClick={() => toggleExpand(i)}>SHOW MORE</button></>
                ) : (
                  <>{msg.content}{msg.content.length > 500 && <button className="acc-show-more" onClick={() => toggleExpand(i)}>SHOW LESS</button>}</>
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

function ActivityTimeline({ timeline }) {
  if (!timeline?.length) return null
  return (
    <div className="acc-timeline">
      <div className="acc-section-title">ACTIVITY FEED</div>
      {timeline.map((entry, i) => {
        const icon = entry.status === 'running' ? <Circle size={10} fill="currentColor" /> : entry.status === 'killed' ? <XCircle size={12} /> : <Check size={12} />
        const iconClass = entry.status === 'running' ? 'tl-running' : entry.status === 'killed' ? 'tl-failed' : 'tl-complete'
        return (
          <div key={i} className="acc-tl-entry">
            <span className="acc-tl-time">{formatTime(entry.endTime || entry.startTime)}</span>
            <span className="acc-tl-sep"> — </span>
            <span className="acc-tl-name">{entry.name}</span>
            <span className={`acc-tl-icon ${iconClass}`}> {icon} </span>
            {entry.summary && <span className="acc-tl-summary">"{entry.summary.slice(0, 40)}"</span>}
            <span className="acc-tl-stats">[{formatDuration(entry.duration)}, {formatTokens(entry.tokens)}]</span>
          </div>
        )
      })}
    </div>
  )
}

function AgentSpawnModal({ isOpen, template, onClose, onSpawn }) {
  const [task, setTask] = useState('')
  const [model, setModel] = useState('sonnet')
  const [spawning, setSpawning] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (isOpen) { setTask(''); setTimeout(() => inputRef.current?.focus(), 50) } }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'Enter' && !spawning) handleSpawn() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, spawning])

  const handleSpawn = async () => {
    if (!task.trim() || spawning) return
    setSpawning(true)
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Spawn a ${template?.id} agent with task: ${task.trim()}` }) })
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

const TASK_TEMPLATES = [
  { id: 'research', name: 'RESEARCH', description: 'Spawn a research sub-agent' },
  { id: 'draft', name: 'DRAFT', description: 'Spawn a writing/drafting agent' },
  { id: 'build', name: 'BUILD', description: 'Spawn a coding sub-agent' },
  { id: 'review', name: 'REVIEW', description: 'Spawn a review/audit agent' },
]

// ══════════════════════════════════════════════════════
// UNIFIED AGENTS MODULE
// ══════════════════════════════════════════════════════

export default function UnifiedAgentsModule({ scrollToAgentId, onScrollHandled }) {
  // ── Employee state ──
  const [employees, setEmployees] = useState([])
  const [empStats, setEmpStats] = useState({})
  const [promotions, setPromotions] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [deployingIds, setDeployingIds] = useState(new Set())
  const [deployingCards, setDeployingCards] = useState([])
  const [showCreate, setShowCreate] = useState(false)

  // ── Agent state ──
  const [agents, setAgents] = useState([])
  const [agentStats, setAgentStats] = useState({})
  const [timeline, setTimeline] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [spawnModal, setSpawnModal] = useState({ open: false, template: null })

  const [loading, setLoading] = useState(true)
  const { checkAgentTransitions } = useNotifications()

  // Handle scroll-to-agent from notifications
  useEffect(() => {
    if (scrollToAgentId) {
      setSelectedAgent(scrollToAgentId)
      if (onScrollHandled) onScrollHandled()
    }
  }, [scrollToAgentId, onScrollHandled])

  // ── Fetch employees ──
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      setEmployees(data.employees || [])
      setEmpStats(data.stats || {})
      setPromotions(data.promotionCandidates || [])
    } catch (err) { console.error('Fetch employees error:', err) }
  }, [])

  // ── Fetch agents ──
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      const agentList = data.agents || []
      setAgents(agentList)
      setAgentStats(data.stats || {})
      setTimeline(data.timeline || [])
      checkAgentTransitions(agentList)
    } catch (err) { console.error('Fetch agents error:', err) }
  }, [checkAgentTransitions])

  // ── Initial load + polling ──
  useEffect(() => {
    Promise.all([fetchEmployees(), fetchAgents()]).finally(() => setLoading(false))
    const empInterval = setInterval(fetchEmployees, 10000)
    const agentInterval = setInterval(fetchAgents, 5000)
    return () => { clearInterval(empInterval); clearInterval(agentInterval) }
  }, [fetchEmployees, fetchAgents])

  // ── Expose running count for NavBar ──
  useEffect(() => {
    const runningEmp = employees.filter(e => e.status === 'running').length + deployingCards.length
    const runningAgents = agents.filter(a => a.status === 'running').length
    const total = runningEmp + runningAgents
    window.__empRunningCount = total
    window.dispatchEvent(new CustomEvent('emp-running-update', { detail: total }))
  }, [employees, deployingCards, agents])

  // ── Employee actions ──
  const handleDeploy = async (employee, task) => {
    setDeployingIds(prev => new Set([...prev, employee.id]))
    setDeployingCards(prev => [...prev, { id: `deploying-${employee.id}`, name: employee.name, avatar_emoji: employee.avatar_emoji, currentTask: task, deployedAt: Date.now() }])
    try {
      const ctxRes = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get-project-context', id: employee.id }) })
      const context = await ctxRes.json()
      const parts = [`Deploy employee "${employee.name}" (${employee.specialty}) for this task: ${task}`]
      if (employee.system_prompt) parts.push('', '--- Employee System Prompt ---', employee.system_prompt)
      if (context?.memory) parts.push('', '--- Employee Memory ---', context.memory.slice(0, 2000))
      if (context?.projectContext) parts.push('', '--- Project Context (auto-loaded from project files) ---', context.projectContext.slice(0, 4000))
      await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: parts.join('\n') }) })
      fetchEmployees()
    } catch (err) { console.error('Deploy error:', err) }
    finally {
      setDeployingIds(prev => { const next = new Set(prev); next.delete(employee.id); return next })
      setDeployingCards(prev => prev.filter(c => c.id !== `deploying-${employee.id}`))
    }
  }

  const handlePromote = async (category, name, specialty, system_prompt) => {
    try {
      await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promote', category, name, specialty, system_prompt }) })
      fetchEmployees()
    } catch (err) { console.error('Promote error:', err) }
  }

  const handleCreate = async (data) => {
    await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...data }) })
    fetchEmployees()
  }

  // ── Agent actions ──
  const handleKill = async (agent) => {
    try {
      await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'kill', sessionId: agent.id }) })
      fetchAgents()
    } catch (err) { console.error('Kill error:', err) }
  }

  // ── Loading state ──
  if (loading) {
    return <div className="emp-module"><div className="emp-loading-state">Initializing agent roster...</div></div>
  }

  // ── Transcript viewer (takes over the whole view) ──
  if (selectedAgent) {
    return (
      <div className="card full">
        <AgentDetail agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />
      </div>
    )
  }

  // ── Derived data ──
  const projectAgents = employees.filter(e => e.type === 'project').sort((a, b) => (b.last_run_at || 0) - (a.last_run_at || 0))
  const utilityAgents = employees.filter(e => e.type === 'utility').sort((a, b) => (b.last_run_at || 0) - (a.last_run_at || 0))
  const activeEmployees = employees.filter(e => e.status === 'running')

  const runningAgentsList = agents.filter(a => a.status === 'running')
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
  const recentAgents = agents.filter(a => a.status !== 'running' && a.lastActive > twoHoursAgo)
  const olderAgents = agents.filter(a => a.status !== 'running' && a.lastActive <= twoHoursAgo)
  const recentSubagents = recentAgents.filter(a => a.type === 'subagent')
  const recentCrons = recentAgents.filter(a => a.type === 'cron' || a.type === 'cron-run')

  return (
    <div className="emp-module">
      {/* ═══ 1. LIVE AGENTS VIEW (replaces war room) ═══ */}
      <LiveAgentsView
        activeEmployees={activeEmployees}
        deployingCards={deployingCards}
        runningAgents={runningAgentsList}
        employees={employees}
        onDeploy={handleDeploy}
        deployingIds={deployingIds}
        onKill={handleKill}
      />

      {/* ═══ 2. TEAM SECTION ═══ */}
      <div className="unified-section-divider">
        <span className="section-title">TEAM</span>
        <button className="emp-create-btn-v2 unified-create-btn" onClick={() => setShowCreate(true)}>+ NEW AGENT</button>
      </div>

      {/* Project Agents Grid */}
      {projectAgents.length > 0 && (
        <div className="emp-section-v2">
          <div className="emp-section-label-v2">PROJECT AGENTS</div>
          <div className="emp-project-grid">
            {projectAgents.map(emp => (
              <ProjectCard key={emp.id} employee={emp} onDeploy={handleDeploy} onClick={setSelectedEmployee} isDeploying={deployingIds.has(emp.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Promotion Banners */}
      {promotions.map(p => (
        <PromotionBanner key={p.category} candidate={p} onPromote={handlePromote} />
      ))}

      {/* Utility Agents */}
      {utilityAgents.length > 0 && (
        <div className="emp-section-v2">
          <div className="emp-section-label-v2">UTILITY AGENTS</div>
          <div className="emp-util-row">
            {utilityAgents.map(emp => (
              <UtilityChip key={emp.id} employee={emp} onDeploy={handleDeploy} onClick={setSelectedEmployee} isDeploying={deployingIds.has(emp.id)} />
            ))}
          </div>
        </div>
      )}

      {employees.length === 0 && (
        <div className="emp-empty-v2">No agents hired yet. Create one to get started.</div>
      )}

      {/* ═══ 3. RECENT ACTIVITY ═══ */}
      {(recentSubagents.length > 0 || recentCrons.length > 0 || timeline?.length > 0) && (
        <>
          <div className="unified-section-divider">
            <span className="section-title">RECENT ACTIVITY</span>
            {agentStats.completedToday > 0 && (
              <span className="unified-activity-stat">{agentStats.completedToday} today · {formatCost(agentStats.estimatedCost)}</span>
            )}
          </div>

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

          {/* Show All older */}
          {olderAgents.length > 0 && (
            <div className="acc-section">
              <button className="acc-show-all-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'HIDE' : `SHOW ALL (${olderAgents.length})`}
              </button>
              {showAll && (
                <div className="acc-all-list">
                  {olderAgents.map(a => (
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
        </>
      )}

      {/* ═══ 4. QUICK SPAWN ═══ */}
      <div className="unified-section-divider">
        <span className="section-title">QUICK SPAWN</span>
      </div>
      <div className="acc-spawn" style={{ marginTop: 0, paddingTop: 0 }}>
        <div className="acc-spawn-btns">
          {TASK_TEMPLATES.map(t => (
            <button key={t.id} className="agent-template-btn" onClick={() => setSpawnModal({ open: true, template: t })}>{t.name}</button>
          ))}
        </div>
      </div>

      {/* ═══ MODALS & PANELS ═══ */}
      {selectedEmployee && (
        <EmployeeDetailPanel employeeId={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}

      <CreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      <AgentSpawnModal
        isOpen={spawnModal.open}
        template={spawnModal.template}
        onClose={() => setSpawnModal({ open: false, template: null })}
        onSpawn={fetchAgents}
      />
    </div>
  )
}
