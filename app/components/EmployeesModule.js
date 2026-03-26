'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowRight, ArrowLeft, X, Check, XCircle, Circle, ChevronDown, ChevronRight, Send } from 'lucide-react'

// ── Helpers ──

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
  if (!ts) return 'never'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function successRate(total, successful) {
  if (!total) return '--'
  return Math.round((successful / total) * 100) + '%'
}

function shortPath(p) {
  if (!p) return ''
  return p.replace(/^\/Users\/[^/]+\//, '~/')
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

// Simple markdown-like rendering for memory files
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

// ── Elapsed Timer ──
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
  return <span className="emp-war-timer">{m}:{s.toString().padStart(2, '0')}</span>
}

// ── War Room ──
function WarRoom({ activeEmployees, deployingCards }) {
  const allActive = [...deployingCards, ...activeEmployees.filter(e => e.status === 'running')]

  if (allActive.length === 0) {
    return (
      <div className="emp-warroom emp-warroom-idle">
        <div className="emp-warroom-idle-dot" />
        <span className="emp-warroom-idle-text">All agents standing by</span>
      </div>
    )
  }

  return (
    <div className="emp-warroom emp-warroom-active">
      <div className="emp-warroom-label">LIVE OPS</div>
      <div className="emp-warroom-cards">
        {allActive.map((item, i) => (
          <div key={item.id || i} className="emp-warroom-card">
            <div className="emp-warroom-pulse" />
            <span className="emp-warroom-card-emoji">{item.avatar_emoji}</span>
            <div className="emp-warroom-card-info">
              <span className="emp-warroom-card-name">{item.name}</span>
              <span className="emp-warroom-card-task">{item.currentTask || 'Running...'}</span>
            </div>
            <ElapsedTimer startTime={item.deployedAt || item.last_run_at || Date.now()} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline Deploy Input ──
function InlineDeploy({ employee, onDeploy, isDeploying }) {
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSubmit = () => {
    if (!task.trim() || isDeploying) return
    onDeploy(employee, task.trim())
    setTask('')
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setTask('')
    }
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
        <button
          className="emp-deploy-trigger"
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        >
          DEPLOY
        </button>
      ) : (
        <div className="emp-deploy-input-wrap">
          <input
            ref={inputRef}
            className="emp-deploy-input"
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="describe the task..."
          />
          <button
            className="emp-deploy-send"
            onClick={handleSubmit}
            disabled={!task.trim()}
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Project Agent Card ──
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
        <div className={`emp-pcard-staleness ${staleClass}`}>
          {stalenessLabel(employee.last_run_at)}
        </div>
      </div>

      <div className="emp-pcard-stats">
        <span>{employee.total_runs} runs</span>
        <span>{formatCost(employee.total_cost)}</span>
        <span>{successRate(employee.total_runs, employee.successful_runs)}</span>
      </div>

      {employee.last_summary && (
        <div className="emp-pcard-summary">{employee.last_summary}</div>
      )}

      <InlineDeploy employee={employee} onDeploy={onDeploy} isDeploying={isDeploying} />
    </div>
  )
}

// ── Utility Agent Chip ──
function UtilityChip({ employee, onDeploy, onClick, isDeploying }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="emp-util-chip-wrap">
      <div
        className={`emp-util-chip ${expanded ? 'emp-util-chip-expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="emp-util-chip-emoji">{employee.avatar_emoji}</span>
        <span className="emp-util-chip-name">{employee.name}</span>
        <span className="emp-util-chip-runs">{employee.total_runs}</span>
      </div>
      {expanded && (
        <div className="emp-util-expanded" onClick={e => e.stopPropagation()}>
          <div className="emp-util-expanded-info">
            <span className="emp-util-expanded-specialty">{employee.specialty}</span>
            <span className="emp-util-expanded-meta">
              Last: {formatElapsed(employee.last_run_at)} · {formatCost(employee.total_cost)}
            </span>
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

// ── Promotion Banner ──
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

// ── Slide-out Detail Panel ──
function DetailPanel({ employeeId, onClose }) {
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
    fetch(`/api/employees?id=${employeeId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})

    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-memory', id: employeeId })
    })
      .then(r => r.json())
      .then(d => {
        setMemory(d.content || '')
        setMemoryDraft(d.content || '')
      })
      .catch(() => {})
  }, [employeeId])

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const saveMemory = async () => {
    setSaving(true)
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-memory', id: employeeId, content: memoryDraft })
    })
    setMemory(memoryDraft)
    setEditingMemory(false)
    setSaving(false)
  }

  const savePrompt = async () => {
    setSaving(true)
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: employeeId, system_prompt: promptDraft })
    })
    setData(prev => ({ ...prev, employee: { ...prev.employee, system_prompt: promptDraft } }))
    setEditingPrompt(false)
    setSaving(false)
  }

  if (!data) {
    return (
      <>
        <div className="emp-panel-overlay" />
        <div className="emp-panel" ref={panelRef}>
          <div className="emp-panel-loading">Loading...</div>
        </div>
      </>
    )
  }

  const emp = data.employee
  const runs = data.runs || []
  const projectFiles = data.projectFiles || { files: [], count: 0 }
  const isProject = emp.type === 'project'
  const totalRuns = runs.length
  const successfulRuns = runs.filter(r => r.status === 'completed').length
  const avgCost = totalRuns > 0 ? runs.reduce((s, r) => s + (r.cost || 0), 0) / totalRuns : 0
  const avgDuration = totalRuns > 0 ? Math.round(runs.reduce((s, r) => s + (r.duration || 0), 0) / totalRuns) : 0

  return (
    <>
      <div className="emp-panel-overlay" onClick={onClose} />
      <div className="emp-panel" ref={panelRef}>
        {/* Close */}
        <button className="emp-panel-close" onClick={onClose}><X size={16} /></button>

        {/* Header */}
        <div className="emp-panel-header">
          <span className="emp-panel-avatar">{emp.avatar_emoji}</span>
          <div className="emp-panel-header-info">
            <span className="emp-panel-name">{emp.name}</span>
            <span className={`emp-type-badge emp-type-${emp.type}`}>{emp.type.toUpperCase()}</span>
          </div>
        </div>
        <div className="emp-panel-specialty">{emp.specialty}</div>

        {/* Stats bar */}
        <div className="emp-panel-stats">
          <div className="emp-panel-stat">
            <span className="emp-panel-stat-num">{emp.total_runs}</span>
            <span className="emp-panel-stat-label">RUNS</span>
          </div>
          <div className="emp-panel-stat">
            <span className="emp-panel-stat-num">{successRate(emp.total_runs, emp.successful_runs)}</span>
            <span className="emp-panel-stat-label">SUCCESS</span>
          </div>
          <div className="emp-panel-stat">
            <span className="emp-panel-stat-num">{formatCost(avgCost)}</span>
            <span className="emp-panel-stat-label">AVG COST</span>
          </div>
          <div className="emp-panel-stat">
            <span className="emp-panel-stat-num">{formatDuration(avgDuration)}</span>
            <span className="emp-panel-stat-label">AVG TIME</span>
          </div>
        </div>

        {/* Memory */}
        <div className="emp-panel-section">
          <div className="emp-panel-section-header">
            <span>MEMORY</span>
            <button className="emp-panel-edit-btn" onClick={() => {
              if (editingMemory) { setEditingMemory(false) }
              else { setMemoryDraft(memory); setEditingMemory(true) }
            }}>
              {editingMemory ? 'CANCEL' : 'EDIT'}
            </button>
          </div>
          <div className="emp-panel-section-body emp-panel-memory-body">
            {editingMemory ? (
              <div className="emp-panel-edit-area">
                <textarea
                  className="emp-panel-textarea"
                  value={memoryDraft}
                  onChange={e => setMemoryDraft(e.target.value)}
                  rows={12}
                />
                <button className="emp-btn emp-btn-primary" onClick={saveMemory} disabled={saving}>
                  {saving ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
            ) : (
              <div className="emp-panel-memory-content">
                {memory ? renderFormattedText(memory) : <span className="emp-muted">Empty memory file</span>}
              </div>
            )}
          </div>
        </div>

        {/* Run History */}
        <div className="emp-panel-section">
          <div className="emp-panel-section-header">
            <span>RUN HISTORY ({runs.length})</span>
          </div>
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
                        <span className={`emp-timeline-status emp-timeline-status-${run.status}`}>
                          {run.status === 'completed' ? <Check size={12} /> : run.status === 'failed' ? <XCircle size={12} /> : <Circle size={10} fill="currentColor" />}
                        </span>
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
              <button className="emp-panel-edit-btn" onClick={(e) => {
                e.stopPropagation()
                if (editingPrompt) { setEditingPrompt(false) }
                else { setPromptDraft(emp.system_prompt || ''); setEditingPrompt(true) }
              }}>
                {editingPrompt ? 'CANCEL' : 'EDIT'}
              </button>
            )}
          </div>
          {promptOpen && (
            <div className="emp-panel-section-body">
              {editingPrompt ? (
                <div className="emp-panel-edit-area">
                  <textarea
                    className="emp-panel-textarea"
                    value={promptDraft}
                    onChange={e => setPromptDraft(e.target.value)}
                    rows={8}
                  />
                  <button className="emp-btn emp-btn-primary" onClick={savePrompt} disabled={saving}>
                    {saving ? 'SAVING...' : 'SAVE'}
                  </button>
                </div>
              ) : (
                <div className="emp-panel-prompt-text">
                  {emp.system_prompt || <span className="emp-muted">No system prompt set</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Project Files */}
        {isProject && projectFiles.files.length > 0 && (
          <div className="emp-panel-section">
            <div className="emp-panel-section-header">
              <span>PROJECT FILES ({projectFiles.count})</span>
            </div>
            <div className="emp-panel-section-body emp-panel-files">
              {projectFiles.files.map((f, i) => (
                <div key={i} className="emp-panel-file">
                  <span className="emp-panel-file-name">{f.name}</span>
                  <span className="emp-panel-file-size">
                    {f.ext === 'dir' ? `${f.fileCount} files` : f.size > 1024 ? `${Math.round(f.size / 1024)}KB` : `${f.size}B`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Create Employee Modal ──
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
    } catch (err) {
      console.error('Create error:', err)
    }
    setCreating(false)
  }

  if (!isOpen) return null

  return (
    <div className="emp-modal-overlay" onClick={onClose}>
      <div className="emp-modal" onClick={e => e.stopPropagation()}>
        <div className="emp-modal-header">
          <span>NEW EMPLOYEE</span>
        </div>
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
          <button className="emp-btn emp-btn-primary" onClick={handleCreate} disabled={!name.trim() || !specialty.trim() || creating}>
            {creating ? 'CREATING...' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Module ──
export default function EmployeesModule() {
  const [employees, setEmployees] = useState([])
  const [stats, setStats] = useState({})
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [deployingIds, setDeployingIds] = useState(new Set())
  const [deployingCards, setDeployingCards] = useState([])
  const [showCreate, setShowCreate] = useState(false)

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      setEmployees(data.employees || [])
      setStats(data.stats || {})
      setPromotions(data.promotionCandidates || [])
    } catch (err) {
      console.error('Fetch employees error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
    const interval = setInterval(fetchEmployees, 10000)
    return () => clearInterval(interval)
  }, [fetchEmployees])

  // Expose running count for NavBar
  useEffect(() => {
    const running = employees.filter(e => e.status === 'running').length + deployingCards.length
    window.__empRunningCount = running
    window.dispatchEvent(new CustomEvent('emp-running-update', { detail: running }))
  }, [employees, deployingCards])

  const handleDeploy = async (employee, task) => {
    setDeployingIds(prev => new Set([...prev, employee.id]))
    setDeployingCards(prev => [...prev, {
      id: `deploying-${employee.id}`,
      name: employee.name,
      avatar_emoji: employee.avatar_emoji,
      currentTask: task,
      deployedAt: Date.now()
    }])

    try {
      // Get context first
      const ctxRes = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-project-context', id: employee.id })
      })
      const context = await ctxRes.json()

      const parts = [
        `Deploy employee "${employee.name}" (${employee.specialty}) for this task: ${task}`,
      ]
      if (employee.system_prompt) {
        parts.push('', '--- Employee System Prompt ---', employee.system_prompt)
      }
      if (context?.memory) {
        parts.push('', '--- Employee Memory ---', context.memory.slice(0, 2000))
      }
      if (context?.projectContext) {
        parts.push('', '--- Project Context (auto-loaded from project files) ---', context.projectContext.slice(0, 4000))
      }

      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: parts.join('\n') })
      })

      fetchEmployees()
    } catch (err) {
      console.error('Deploy error:', err)
    } finally {
      setDeployingIds(prev => {
        const next = new Set(prev)
        next.delete(employee.id)
        return next
      })
      setDeployingCards(prev => prev.filter(c => c.id !== `deploying-${employee.id}`))
    }
  }

  const handlePromote = async (category, name, specialty, system_prompt) => {
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote', category, name, specialty, system_prompt })
      })
      fetchEmployees()
    } catch (err) {
      console.error('Promote error:', err)
    }
  }

  const handleCreate = async (data) => {
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...data })
    })
    fetchEmployees()
  }

  if (loading) {
    return (
      <div className="emp-module">
        <div className="emp-loading-state">Initializing team roster...</div>
      </div>
    )
  }

  // Sort by most recently active first
  const projectAgents = employees
    .filter(e => e.type === 'project')
    .sort((a, b) => (b.last_run_at || 0) - (a.last_run_at || 0))

  const utilityAgents = employees
    .filter(e => e.type === 'utility')
    .sort((a, b) => (b.last_run_at || 0) - (a.last_run_at || 0))

  const activeEmployees = employees.filter(e => e.status === 'running')

  return (
    <div className="emp-module">
      {/* War Room */}
      <WarRoom activeEmployees={activeEmployees} deployingCards={deployingCards} />

      {/* Project Agents */}
      {projectAgents.length > 0 && (
        <div className="emp-section-v2">
          <div className="emp-section-label-v2">PROJECT AGENTS</div>
          <div className="emp-project-grid">
            {projectAgents.map(emp => (
              <ProjectCard
                key={emp.id}
                employee={emp}
                onDeploy={handleDeploy}
                onClick={setSelectedEmployee}
                isDeploying={deployingIds.has(emp.id)}
              />
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
              <UtilityChip
                key={emp.id}
                employee={emp}
                onDeploy={handleDeploy}
                onClick={setSelectedEmployee}
                isDeploying={deployingIds.has(emp.id)}
              />
            ))}
          </div>
        </div>
      )}

      {employees.length === 0 && (
        <div className="emp-empty-v2">No agents hired yet. Create one to get started.</div>
      )}

      {/* Create Button */}
      <div className="emp-create-row-v2">
        <button className="emp-create-btn-v2" onClick={() => setShowCreate(true)}>+ NEW AGENT</button>
      </div>

      {/* Detail Slide-out Panel */}
      {selectedEmployee && (
        <DetailPanel
          employeeId={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {/* Create Modal */}
      <CreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
