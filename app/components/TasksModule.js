'use client'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Crosshair, Calendar, CalendarRange, Rocket, Inbox, CheckCircle, Zap, ArrowRight, ChevronUp, ChevronDown, Plus, Lock, Circle, ArrowUpRight, ArrowDownRight, ScanSearch, Link2, ChevronRight, Check, X, ArrowLeftRight, MoreHorizontal } from 'lucide-react'
import AuditSuggestions from './AuditPanel'

// ── Helpers ──

function computeUrgency(dueDate) {
  if (!dueDate) return 'later'
  const now = new Date()
  const due = new Date(dueDate)
  const diffMs = due - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 7) return 'this_week'
  return 'later'
}

function deadlineBadge(dueDate) {
  if (!dueDate) return null
  const now = new Date()
  const due = new Date(dueDate)
  const diffMs = due - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, cls: 'badge-overdue', dotColor: '#ef4444' }
  if (diffDays === 0) return { label: 'today', cls: 'badge-today', dotColor: '#eab308' }
  if (diffDays === 1) return { label: 'tomorrow', cls: 'badge-today', dotColor: '#eab308' }
  if (diffDays <= 7) return { label: `${diffDays}d left`, cls: 'badge-week', dotColor: '#22c55e' }
  return { label: `${diffDays}d`, cls: 'badge-later', dotColor: '#6b7280' }
}

function formatDueDate(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return due.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 6) return due.toLocaleDateString('en-AU', { weekday: 'short' })
  return due.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

function urgencyColor(urgency) {
  switch (urgency) {
    case 'overdue': return 'rgba(239,68,68,0.08)'
    case 'today': return 'rgba(234,179,8,0.06)'
    case 'tomorrow': return 'rgba(234,179,8,0.04)'
    default: return 'transparent'
  }
}

function groupTasks(tasks) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const blockedTasks = tasks.filter(t => t.status !== 'done' && t.is_blocked)
  const incomplete = tasks.filter(t => t.status !== 'done' && !t.is_blocked)
  const doneToday = tasks.filter(t => t.status === 'done' && t.completed_at && t.completed_at.startsWith(todayStr))

  const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, this_week: 3, later: 4 }
  const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sort = (a, b) => {
    const ua = urgencyOrder[a.urgency] ?? 4, ub = urgencyOrder[b.urgency] ?? 4
    if (ua !== ub) return ua - ub
    // Within same urgency, sort by due_date
    if (a.due_date && b.due_date) {
      const cmp = a.due_date.localeCompare(b.due_date)
      if (cmp !== 0) return cmp
    } else if (a.due_date && !b.due_date) return -1
    else if (!a.due_date && b.due_date) return 1
    const pa = prioOrder[a.priority] ?? 2, pb = prioOrder[b.priority] ?? 2
    return pa - pb
  }

  const todayTasks = incomplete
    .filter(t => ['overdue', 'today', 'tomorrow'].includes(t.urgency) || (t.urgency === 'this_week' && (t.priority === 'high' || t.priority === 'critical')))
    .sort(sort)
    .slice(0, 5)
  const todayIds = new Set(todayTasks.map(t => t.id))

  const weekTasks = incomplete
    .filter(t => t.urgency === 'this_week' && !todayIds.has(t.id) && t.section === 'this_week')
    .sort(sort)
  const weekIds = new Set(weekTasks.map(t => t.id))

  const laterTasks = incomplete
    .filter(t => !todayIds.has(t.id) && !weekIds.has(t.id))
    .sort(sort)

  // Manual focus takes priority
  const allIncomplete = [...todayTasks, ...weekTasks, ...laterTasks]
  const manualFocus = allIncomplete.find(t => t.is_focus)
  const focusTask = manualFocus || todayTasks[0] || null
  
  // Remove focus task from its section
  const filterFocus = arr => focusTask ? arr.filter(t => t.id !== focusTask.id) : arr
  const remainingToday = filterFocus(todayTasks)
  const filteredWeek = filterFocus(weekTasks)
  const filteredLater = filterFocus(laterTasks)

  return { focusTask, todayTasks: remainingToday, weekTasks: filteredWeek, laterTasks: filteredLater, doneToday, blockedTasks }
}

// ── Inline Date Picker ──

function InlineDatePicker({ value, onChange, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el) { el.showPicker?.(); el.focus() }
  }, [])
  return (
    <input
      ref={ref}
      type="date"
      className="inline-date-picker"
      value={value || ''}
      onChange={e => { onChange(e.target.value || null); onClose() }}
      onBlur={onClose}
      onClick={e => e.stopPropagation()}
    />
  )
}

// ── Due Date Display ──

function DueDateChip({ task, onSetDate }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <InlineDatePicker
        value={task.due_date}
        onChange={date => onSetDate(task.id, date)}
        onClose={() => setEditing(false)}
      />
    )
  }

  if (task.due_date) {
    const badge = deadlineBadge(task.due_date)
    const label = formatDueDate(task.due_date)
    return (
      <span
        className={`tr-due ${badge?.cls || ''}`}
        onClick={e => { e.stopPropagation(); setEditing(true) }}
        title={task.due_date}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className="tr-due tr-due-empty"
      onClick={e => { e.stopPropagation(); setEditing(true) }}
    >
      + date
    </span>
  )
}

// ── Dependency Picker ──

function DependencyPicker({ task, allTasks, onAdd, onRemove, onClose }) {
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const available = allTasks.filter(t =>
    t.id !== task.id &&
    t.status !== 'done' &&
    !task.dependencies?.some(d => d.id === t.id) &&
    t.title.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  return (
    <div className="dep-picker" ref={ref} onClick={e => e.stopPropagation()}>
      <div className="dep-picker-header">Dependencies</div>
      {task.dependencies?.length > 0 && (
        <div className="dep-current">
          {task.dependencies.map(d => (
            <div key={d.id} className="dep-item">
              <span className={`dep-status ${d.status === 'done' ? 'dep-done' : ''}`}>
                {d.status === 'done' ? <Check size={12} /> : <Circle size={10} />}
              </span>
              <span className="dep-title">{d.title}</span>
              <button className="dep-remove" onClick={() => onRemove(task.id, d.id)}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      <input
        className="dep-search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search tasks..."
        autoFocus
      />
      <div className="dep-results">
        {available.map(t => (
          <div key={t.id} className="dep-result" onClick={() => onAdd(task.id, t.id)}>
            {t.title}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Subtask Progress ──

function SubtaskProgress({ done, total }) {
  if (!total) return null
  const pct = Math.round((done / total) * 100)
  return (
    <span className="subtask-progress" title={`${done}/${total} sub-tasks done`}>
      <span className="subtask-bar">
        <span className="subtask-bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="subtask-count">{done}/{total}</span>
    </span>
  )
}

// ── Unlocks Indicator ──

function UnlocksIndicator({ unlocks }) {
  const [expanded, setExpanded] = useState(false)
  if (!unlocks || unlocks.length === 0) return null

  return (
    <span className="unlocks-indicator" onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}>
      <span className="unlocks-badge">
        <Link2 size={11} />
        <span className="unlocks-count">Unlocks {unlocks.length}</span>
        <ChevronRight size={10} className={`unlocks-chevron ${expanded ? 'unlocks-chevron-open' : ''}`} />
      </span>
      {expanded && (
        <span className="unlocks-dropdown" onClick={e => e.stopPropagation()}>
          {unlocks.map(u => (
            <span key={u.id} className="unlocks-item"><ArrowRight size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} /> {u.title}</span>
          ))}
        </span>
      )}
    </span>
  )
}

// ── Spawn Agent Modal ──

function SpawnModal({ task, onClose, onSpawned }) {
  const [instructions, setInstructions] = useState(task?._prefillInstructions || '')
  const [spawning, setSpawning] = useState(false)

  if (!task) return null

  const handleSpawn = async () => {
    if (spawning) return
    setSpawning(true)
    const taskContext = `Task: ${task.title}${task.project_name ? ` (Project: ${task.project_name})` : ''}${task.due_date ? ` (Due: ${task.due_date})` : ''}`
    const fullTask = instructions.trim()
      ? `${taskContext}\n\nAdditional instructions: ${instructions.trim()}`
      : taskContext
    onClose()
    onSpawned(task.id)
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'research', task: fullTask })
      })
    } catch (e) { console.error('Spawn failed:', e) }
  }

  return (
    <div className="spawn-overlay" onClick={onClose}>
      <div className="spawn-modal" onClick={e => e.stopPropagation()}>
        <div className="spawn-header">SPAWN AGENT</div>
        <div className="spawn-task-display">{task.title}{task.project_name && <span style={{ color: task.project_color, marginLeft: 8, fontSize: '0.75rem' }}>{task.project_name}</span>}</div>
        <textarea
          className="spawn-instructions"
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="What should the agent focus on?"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSpawn() }}
          rows={3}
        />
        <div className="spawn-actions">
          <button className="spawn-btn-cancel" onClick={onClose}>CANCEL</button>
          <button className="spawn-btn-go" onClick={handleSpawn} disabled={spawning}>{spawning ? '...' : 'SPAWN'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ──

function Toast({ message, onDone }) {
  const [visible, setVisible] = useState(true)
  useMemo(() => {
    const t = setTimeout(() => { setVisible(false); onDone() }, 2500)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return <div className="spawn-toast">{message}</div>
}

// ── Task Row ──

function TaskRow({ task, onComplete, completing, compact, onSpawn, onSetDate, allTasks, onAddDep, onRemoveDep, onAddSubtask, onToggleSubtasks, expandedParents, onMoveSection, currentSection, onSetFocus }) {
  const [showDepPicker, setShowDepPicker] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const isCompleting = completing === task.id
  const isBlocked = task.is_blocked
  const hasSubtasks = task.subtask_total > 0
  const isExpanded = expandedParents?.has(task.id)
  const overflowRef = useRef(null)

  useEffect(() => {
    if (!showOverflow) return
    const handler = e => { if (overflowRef.current && !overflowRef.current.contains(e.target)) setShowOverflow(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showOverflow])

  return (
    <>
      <div
        className={`tr-row ${compact ? 'tr-compact' : ''} ${isBlocked ? 'tr-blocked' : ''}`}
        style={{ background: isBlocked ? 'rgba(100,100,100,0.05)' : urgencyColor(task.urgency) }}
        onClick={() => {
          if (isBlocked || isCompleting) return
          onComplete(task)
        }}
      >
        <div className={`tr-check ${isCompleting ? 'tr-completing' : ''} ${isBlocked ? 'tr-check-blocked' : ''}`}>
          {isCompleting ? '···' : isBlocked ? <Lock size={12} /> : ''}
        </div>
        <div className="tr-content">
          {hasSubtasks && (
            <button
              className="tr-expand-btn"
              onClick={e => { e.stopPropagation(); onToggleSubtasks?.(task.id) }}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
          <span className={`tr-title ${isBlocked ? 'tr-title-blocked' : ''}`}>{task.title}</span>
          {task.project_name && <span className="tr-project" style={{ color: task.project_color }}>{task.project_name}</span>}
          {hasSubtasks && <SubtaskProgress done={task.subtask_done} total={task.subtask_total} />}
          <UnlocksIndicator unlocks={task.unlocks} />
        </div>
        <div className="tr-actions">
          {/* Info group */}
          <div className="tr-action-group tr-info-group">
            {isBlocked && task.dependencies?.filter(d => d.status !== 'done').length > 0 && (
              <span className="tr-blocked-label" title={task.dependencies.filter(d => d.status !== 'done').map(d => d.title).join(', ')}>
                <Lock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {task.dependencies.filter(d => d.status !== 'done')[0].title}
              </span>
            )}
            <DueDateChip task={task} onSetDate={onSetDate} />
            {task._agentActive && <span className="tr-agent-indicator" title="Agent working on this task"><Zap size={12} /></span>}
          </div>

          {/* Task actions group */}
          <div className="tr-action-group tr-task-actions">
            {onSetFocus && !task.is_focus && (
              <button
                className="tr-icon-btn tr-focus-btn"
                title="Set as Focus"
                onClick={e => { e.stopPropagation(); onSetFocus(task.id) }}
              ><Crosshair size={13} /></button>
            )}
            {onAddSubtask && (
              <button
                className="tr-icon-btn"
                title="Add sub-task"
                onClick={e => { e.stopPropagation(); onAddSubtask(task) }}
              ><Plus size={13} /></button>
            )}
            {/* Overflow menu for less common actions */}
            <div className="tr-overflow-wrap" ref={overflowRef}>
              <button
                className="tr-icon-btn tr-overflow-btn"
                title="More actions"
                onClick={e => { e.stopPropagation(); setShowOverflow(!showOverflow) }}
              ><MoreHorizontal size={14} /></button>
              {showOverflow && (
                <div className="tr-overflow-menu" onClick={e => e.stopPropagation()}>
                  <button className="tr-overflow-item" onClick={() => { setShowDepPicker(!showDepPicker); setShowOverflow(false) }}>
                    <Link2 size={12} /> Dependencies
                  </button>
                  <button className="tr-overflow-item" onClick={() => { onSpawn(task); setShowOverflow(false) }}>
                    <ArrowRight size={12} /> Spawn agent
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Move actions group */}
          {onMoveSection && (
            <div className="tr-action-group tr-move-actions">
              {currentSection !== 'today' && (
                <button className="tr-move-btn" title="Move to Today" onClick={e => { e.stopPropagation(); onMoveSection(task.id, 'today') }}>
                  <ArrowUpRight size={13} /><span className="tr-move-label">Today</span>
                </button>
              )}
              {(currentSection === 'today' || currentSection === 'this_week') && (
                <button className="tr-move-btn" title="Move to Later" onClick={e => { e.stopPropagation(); onMoveSection(task.id, 'later') }}>
                  <ArrowDownRight size={13} /><span className="tr-move-label">Later</span>
                </button>
              )}
            </div>
          )}
        </div>
        {showDepPicker && (
          <DependencyPicker
            task={task}
            allTasks={allTasks || []}
            onAdd={(tid, did) => { onAddDep?.(tid, did); setShowDepPicker(false) }}
            onRemove={(tid, did) => { onRemoveDep?.(tid, did) }}
            onClose={() => setShowDepPicker(false)}
          />
        )}
      </div>
      {isExpanded && task.subtasks?.map(st => (
        <div key={st.id} className="tr-subtask-row">
          <TaskRow
            task={st}
            onComplete={onComplete}
            completing={completing}
            compact
            onSpawn={onSpawn}
            onSetDate={onSetDate}
            onSetFocus={onSetFocus}
          />
        </div>
      ))}
    </>
  )
}

// ── Focus Card ──

function FocusPicker({ tasks, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = tasks.filter(t =>
    t.status !== 'done' && t.title.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12)

  return (
    <div className="focus-picker-overlay" onClick={onClose}>
      <div className="focus-picker" ref={ref} onClick={e => e.stopPropagation()}>
        <div className="focus-picker-header">Pick Focus Task</div>
        <input
          className="focus-picker-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          autoFocus
        />
        <div className="focus-picker-list">
          {filtered.map(t => (
            <div key={t.id} className="focus-picker-item" onClick={() => { onSelect(t.id); onClose() }}>
              <span className="focus-picker-title">{t.title}</span>
              {t.project_name && <span className="focus-picker-project" style={{ color: t.project_color }}>{t.project_name}</span>}
            </div>
          ))}
          {filtered.length === 0 && <div className="focus-picker-empty">No tasks found</div>}
        </div>
      </div>
    </div>
  )
}

function FocusCard({ task, onComplete, completing, onSpawn, onSetDate, onSetFocus, allTasks }) {
  const [showPicker, setShowPicker] = useState(false)
  if (!task) return null
  const badge = deadlineBadge(task.due_date)
  const isCompleting = completing === task.id
  const isBlocked = task.is_blocked

  return (
    <>
      <div className={`focus-card ${isBlocked ? 'focus-blocked' : ''}`} onClick={() => !isCompleting && !isBlocked && onComplete(task)}>
        <div className="focus-label">
          {isBlocked ? <><Lock size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> BLOCKED</> : <><Crosshair size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> FOCUS</>}
          {task.is_focus && <span className="focus-manual-badge">PINNED</span>}
          {task._agentActive && <span className="tr-agent-indicator" style={{ marginLeft: 8 }}><Zap size={12} /></span>}
          <button className="focus-change-btn" title="Change focus task" onClick={e => { e.stopPropagation(); setShowPicker(true) }}>
            <ArrowLeftRight size={14} />
          </button>
        </div>
        <div className="focus-title">{task.title}</div>
        <div className="focus-meta">
          {task.project_name && <span className="focus-project" style={{ color: task.project_color }}>{task.project_name}</span>}
          <DueDateChip task={task} onSetDate={onSetDate} />
          {task.subtask_total > 0 && <SubtaskProgress done={task.subtask_done} total={task.subtask_total} />}
          <span className="focus-hint">{isBlocked ? 'blocked by dependency' : isCompleting ? 'completing...' : <>click to complete <ArrowRight size={11} style={{ verticalAlign: 'middle' }} /></>}</span>
          <button className="tr-spawn-btn focus-spawn-btn" title="Spawn agent" onClick={e => { e.stopPropagation(); onSpawn(task) }}><ArrowRight size={13} /></button>
        </div>
        {isBlocked && task.dependencies?.filter(d => d.status !== 'done').length > 0 && (
          <div className="focus-blocked-info">
            Blocked by: {task.dependencies.filter(d => d.status !== 'done').map(d => d.title).join(', ')}
          </div>
        )}
      </div>
      {showPicker && <FocusPicker tasks={allTasks || []} onSelect={onSetFocus} onClose={() => setShowPicker(false)} />}
    </>
  )
}

// ── Collapsible Section ──

function Section({ icon, title, count, tasks, onComplete, completing, defaultOpen = true, onSpawn, onSetDate, allTasks, onAddDep, onRemoveDep, onAddSubtask, onToggleSubtasks, expandedParents, onMoveSection, currentSection, onSetFocus }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!tasks.length) return null

  return (
    <div className="ts-section">
      <div className="ts-header" onClick={() => setOpen(!open)}>
        <span className="ts-toggle">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="ts-title">{icon}{' '}{title}</span>
        <span className="ts-count">{count ?? tasks.length}</span>
      </div>
      {open && (
        <div className="ts-list">
          {tasks.map(t => (
            <TaskRow key={t.id} task={t} onComplete={onComplete} completing={completing} onSpawn={onSpawn} onSetDate={onSetDate} allTasks={allTasks} onAddDep={onAddDep} onRemoveDep={onRemoveDep} onAddSubtask={onAddSubtask} onToggleSubtasks={onToggleSubtasks} expandedParents={expandedParents} onMoveSection={onMoveSection} currentSection={currentSection} onSetFocus={onSetFocus} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Today Section (with reorder arrows) ──

function TodaySection({ tasks: initialTasks, onComplete, completing, onSpawn, onSetDate, allTasks, onAddDep, onRemoveDep, onAddSubtask, onToggleSubtasks, expandedParents, onMoveSection, currentSection, onSetFocus }) {
  const [tasks, setTasks] = useState(initialTasks)
  useMemo(() => { setTasks(initialTasks) }, [initialTasks])

  const move = (idx, dir) => {
    const newTasks = [...tasks]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= newTasks.length) return
    ;[newTasks[idx], newTasks[swapIdx]] = [newTasks[swapIdx], newTasks[idx]]
    setTasks(newTasks)
  }

  if (!tasks.length) return null

  return (
    <div className="ts-section">
      <div className="ts-header">
        <span className="ts-title"><Calendar size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> TODAY</span>
        <span className="ts-count">{tasks.length}</span>
      </div>
      <div className="ts-list">
        {tasks.map((t, i) => (
          <div key={t.id} className="today-row">
            <TaskRow task={t} onComplete={onComplete} completing={completing} onSpawn={onSpawn} onSetDate={onSetDate} allTasks={allTasks} onAddDep={onAddDep} onRemoveDep={onRemoveDep} onAddSubtask={onAddSubtask} onToggleSubtasks={onToggleSubtasks} expandedParents={expandedParents} onMoveSection={onMoveSection} currentSection={currentSection} onSetFocus={onSetFocus} />
            <div className="today-arrows">
              <button className="arrow-btn" onClick={e => { e.stopPropagation(); move(i, -1) }} disabled={i === 0}><ChevronUp size={13} /></button>
              <button className="arrow-btn" onClick={e => { e.stopPropagation(); move(i, 1) }} disabled={i === tasks.length - 1}><ChevronDown size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Project Card ──

function ProjectCard({ project, onComplete, completing, onSpawn, onSetDate }) {
  const [expanded, setExpanded] = useState(false)
  const done = project.done_count || 0
  const total = project.total_count || 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const nextTask = project.tasks?.[0]

  return (
    <div className={`proj-card ${expanded ? 'proj-expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="proj-icon">{project.icon}</div>
      <div className="proj-name">{project.name}</div>
      <div className="proj-phase">{project.notes?.split('.')[0] || project.status}</div>
      <div className="proj-bar-wrap">
        <div className="proj-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="proj-stats">{done}/{total} tasks · {pct}%</div>
      {nextTask && !expanded && <div className="proj-next"><ArrowRight size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {nextTask.title}</div>}
      {expanded && project.tasks?.length > 0 && (
        <div className="proj-tasks" onClick={e => e.stopPropagation()}>
          {project.tasks.map(t => (
            <TaskRow key={t.id} task={t} onComplete={onComplete} completing={completing} compact onSpawn={onSpawn} onSetDate={onSetDate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quick Add ──

function QuickAdd({ onAdd, onAudit, auditing }) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!value.trim() || adding) return
    setAdding(true)
    try {
      await onAdd(value.trim())
      setValue('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="quick-add">
      <span className="quick-add-icon"><Plus size={14} /></span>
      <input
        className="quick-add-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="add task..."
        disabled={adding}
      />
      <button
        className={`audit-trigger-btn ${auditing ? 'audit-scanning' : ''}`}
        onClick={onAudit}
        disabled={auditing}
        title="AI Task Audit"
      >
        <ScanSearch size={14} className={auditing ? 'audit-spin' : ''} />
        <span>{auditing ? 'Scanning...' : 'Audit'}</span>
      </button>
    </div>
  )
}

// ── Subtask Quick Add (inline) ──

function SubtaskQuickAdd({ parentTask, onAdd, onCancel }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const handleAdd = async () => {
    if (!value.trim()) { onCancel(); return }
    await onAdd(parentTask.id, value.trim())
    setValue('')
    onCancel()
  }

  return (
    <div className="subtask-add" onClick={e => e.stopPropagation()}>
      <span className="subtask-add-indent">└</span>
      <input
        ref={ref}
        className="subtask-add-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onCancel() }}
        onBlur={() => { if (!value.trim()) onCancel() }}
        placeholder={`Sub-task for "${parentTask.title}"...`}
      />
    </div>
  )
}

// ── Done Today ──

function DoneToday({ tasks }) {
  const [open, setOpen] = useState(false)
  if (!tasks.length) return null

  return (
    <div className="ts-section done-section">
      <div className="ts-header" onClick={() => setOpen(!open)}>
        <span className="ts-toggle">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="ts-title"><CheckCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> DONE TODAY</span>
        <span className="ts-count">{tasks.length}</span>
      </div>
      {open && (
        <div className="ts-list">
          {tasks.map(t => (
            <div key={t.id} className="tr-row tr-done">
              <div className="tr-check tr-checked"><Check size={12} /></div>
              <div className="tr-content">
                <span className="tr-title tr-title-done">{t.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Module ──

export default function TasksModule({ data }) {
  const [completing, setCompleting] = useState(null)
  const [liveTasks, setLiveTasks] = useState(data.tasks || [])
  const [liveDoneToday, setLiveDoneToday] = useState(data.doneToday || [])
  const [error, setError] = useState(null)
  const [spawnTask, setSpawnTask] = useState(null)
  const [agentActive, setAgentActive] = useState({})
  const [toast, setToast] = useState(null)
  const [subtaskAddParent, setSubtaskAddParent] = useState(null)
  const [expandedParents, setExpandedParents] = useState(() => {
    // Default all parents to expanded
    const parents = new Set()
    ;(data?.tasks || []).forEach(t => { if (t.subtask_total > 0) parents.add(t.id) })
    return parents
  })
  const [auditing, setAuditing] = useState(false)
  const [auditResults, setAuditResults] = useState(null)
  const allTasksForPicker = data.allTasksForPicker || []

  const allTasks = useMemo(() => {
    return liveTasks.map(t => ({ ...t, text: t.text || t.title || '' }))
  }, [liveTasks])

  const { focusTask, todayTasks, weekTasks, laterTasks, blockedTasks } = useMemo(
    () => groupTasks(allTasks), [allTasks]
  )

  const doneToday = liveDoneToday

  const activeProjects = useMemo(() => {
    const projectIds = [1, 2, 3]
    return (data.projects || [])
      .filter(p => projectIds.includes(p.id) && p.status === 'active')
      .map(p => {
        const projectTasks = allTasks.filter(t => t.project_id === p.id)
        const allProjectTasks = (data.allProjectTasks || []).filter(t => t.project_id === p.id)
        const doneCount = allProjectTasks.filter(t => t.status === 'done').length
        const totalCount = allProjectTasks.length || projectTasks.length
        return { ...p, tasks: projectTasks, done_count: doneCount, total_count: totalCount > 0 ? totalCount : projectTasks.length }
      })
  }, [data.projects, allTasks, data.allProjectTasks])

  const handleComplete = useCallback(async (task) => {
    if (task.is_blocked) return
    setCompleting(task.id)
    setLiveTasks(prev => prev.filter(t => t.id !== task.id))
    const completedTask = { ...task, status: 'done', completed_at: new Date().toISOString() }
    setLiveDoneToday(prev => [completedTask, ...prev])

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', task: task.title, taskId: task.id })
      })
      if (!res.ok) throw new Error('Failed to complete task')
      // Unblock dependent tasks
      setLiveTasks(prev => prev.map(t => {
        if (t.dependencies?.some(d => d.id === task.id)) {
          const newDeps = t.dependencies.map(d => d.id === task.id ? { ...d, status: 'done' } : d)
          return { ...t, dependencies: newDeps, is_blocked: newDeps.some(d => d.status !== 'done') }
        }
        return t
      }))
    } catch (e) {
      console.error('Failed:', e)
      setLiveTasks(prev => [...prev, task].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))
      setLiveDoneToday(prev => prev.filter(t => t.id !== task.id))
      setError('Failed to complete task')
      setTimeout(() => setError(null), 3000)
    } finally {
      setCompleting(null)
    }
  }, [])

  const handleSetDate = useCallback(async (taskId, dueDate) => {
    setLiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: dueDate, urgency: computeUrgency(dueDate) } : t))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_due_date', taskId, due_date: dueDate })
      })
    } catch (e) { console.error('Failed to set date:', e) }
  }, [])

  const handleAddDep = useCallback(async (taskId, depId) => {
    const depTask = allTasksForPicker.find(t => t.id === depId)
    if (!depTask) return
    setLiveTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newDeps = [...(t.dependencies || []), { id: depId, title: depTask.title, status: depTask.status }]
        return { ...t, dependencies: newDeps, is_blocked: newDeps.some(d => d.status !== 'done') }
      }
      return t
    }))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_dependency', taskId, dependencyTaskId: depId })
      })
    } catch (e) { console.error('Failed to add dep:', e) }
  }, [allTasksForPicker])

  const handleRemoveDep = useCallback(async (taskId, depId) => {
    setLiveTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newDeps = (t.dependencies || []).filter(d => d.id !== depId)
        return { ...t, dependencies: newDeps, is_blocked: newDeps.some(d => d.status !== 'done') }
      }
      return t
    }))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_dependency', taskId, dependencyTaskId: depId })
      })
    } catch (e) { console.error('Failed to remove dep:', e) }
  }, [])

  const handleAddSubtask = useCallback((parentTask) => {
    setSubtaskAddParent(parentTask)
    setExpandedParents(prev => new Set([...prev, parentTask.id]))
  }, [])

  const handleSubtaskSubmit = useCallback(async (parentId, title) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', title, parent_id: parentId })
      })
      if (!res.ok) throw new Error('Failed')
      const result = await res.json()
      // Update parent subtask count and add subtask to subtasks array
      setLiveTasks(prev => prev.map(t => {
        if (t.id === parentId) {
          const newSubtasks = [...(t.subtasks || []), { ...result.task, urgency: computeUrgency(result.task?.due_date) }]
          return { ...t, subtask_total: (t.subtask_total || 0) + 1, subtasks: newSubtasks }
        }
        return t
      }))
    } catch (e) {
      console.error('Failed to add subtask:', e)
      setError('Failed to add sub-task')
      setTimeout(() => setError(null), 3000)
    }
  }, [])

  const handleToggleSubtasks = useCallback((taskId) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const handleSetFocus = useCallback(async (taskId) => {
    // Optimistic update
    setLiveTasks(prev => prev.map(t => ({ ...t, is_focus: t.id === taskId })))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_focus', taskId })
      })
    } catch (e) { console.error('Failed to set focus:', e) }
  }, [])

  const handleMoveSection = useCallback(async (taskId, targetSection) => {
    // Optimistic: update section and due_date locally
    const now = new Date()
    let newDueDate = null
    if (targetSection === 'today') newDueDate = now.toISOString().split('T')[0]
    else if (targetSection === 'this_week') {
      const d = new Date(); d.setDate(d.getDate() + 3)
      newDueDate = d.toISOString().split('T')[0]
    }
    setLiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, section: targetSection, due_date: newDueDate, urgency: computeUrgency(newDueDate) } : t))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move_section', taskId, targetSection })
      })
    } catch (e) { console.error('Failed to move task:', e) }
  }, [])

  const handleQuickAdd = useCallback(async (input) => {
    setError(null)
    try {
      const parseRes = await fetch('/api/tasks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      })
      const parsed = parseRes.ok ? await parseRes.json() : { title: input }

      const tempId = -Date.now()
      const optimisticTask = {
        id: tempId,
        title: parsed.title || input,
        status: 'todo',
        priority: parsed.priority || 'medium',
        section: parsed.section || 'this_week',
        category: parsed.category || 'personal',
        project_id: parsed.project_id || null,
        project_name: parsed.project_name || null,
        project_color: parsed.project_color || null,
        due_date: parsed.due_date || null,
        due_time: parsed.due_time || null,
        urgency: computeUrgency(parsed.due_date),
        created_at: new Date().toISOString(),
        dependencies: [],
        is_blocked: false,
        subtask_done: 0,
        subtask_total: 0,
        subtasks: [],
      }
      setLiveTasks(prev => [optimisticTask, ...prev])

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          title: parsed.title || input,
          project_id: parsed.project_id,
          due_date: parsed.due_date,
          due_time: parsed.due_time,
          priority: parsed.priority,
          category: parsed.category,
          section: parsed.section,
        })
      })

      if (!res.ok) throw new Error('Failed to add task')
      const result = await res.json()

      if (result.task) {
        setLiveTasks(prev => prev.map(t => t.id === tempId ? { ...result.task, urgency: computeUrgency(result.task.due_date), dependencies: [], is_blocked: false, subtask_done: 0, subtask_total: 0, subtasks: [] } : t))
      } else {
        setLiveTasks(prev => prev.map(t => t.id === tempId ? { ...optimisticTask, id: result.id } : t))
      }
    } catch (e) {
      console.error('Failed to add:', e)
      setError('Failed to add task')
      setTimeout(() => setError(null), 3000)
    }
  }, [])

  const handleAudit = useCallback(async () => {
    if (auditing) return
    setAuditing(true)
    try {
      const res = await fetch('/api/tasks/audit', { method: 'POST' })
      if (!res.ok) throw new Error('Audit failed')
      const data = await res.json()
      setAuditResults(data)
    } catch (e) {
      console.error('Audit failed:', e)
      setError('Audit failed — try again')
      setTimeout(() => setError(null), 3000)
    } finally {
      setAuditing(false)
    }
  }, [auditing])

  const handleAuditRemoveTask = useCallback(async (taskId) => {
    setLiveTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', taskId })
      })
    } catch (e) { console.error('Failed to remove:', e) }
  }, [])

  const handleAuditAddTask = useCallback(async (suggestion) => {
    // Build the task payload from the AI suggestion with all fields
    const payload = {
      action: 'add',
      title: suggestion.title,
      priority: suggestion.priority || 'medium',
      section: suggestion.section || 'this_week',
      due_date: suggestion.due_date || null,
      project_id: suggestion.project_id || null,
      category: suggestion.category || 'personal',
    }

    // Optimistic UI update
    const tempId = -Date.now()
    const optimisticTask = {
      id: tempId,
      title: payload.title,
      status: 'todo',
      priority: payload.priority,
      section: payload.section,
      category: payload.category,
      project_id: payload.project_id,
      project_name: null,
      project_color: null,
      due_date: payload.due_date,
      due_time: null,
      urgency: computeUrgency(payload.due_date),
      created_at: new Date().toISOString(),
      dependencies: [],
      is_blocked: false,
      subtask_done: 0,
      subtask_total: 0,
      subtasks: [],
    }

    setLiveTasks(prev => [optimisticTask, ...prev])

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        // Replace optimistic task with real one
        if (data.task) {
          setLiveTasks(prev => prev.map(t => t.id === tempId ? { ...data.task, urgency: computeUrgency(data.task.due_date), dependencies: [], is_blocked: false, subtask_done: 0, subtask_total: 0, subtasks: [] } : t))
        }
      } else {
        // Rollback on failure
        setLiveTasks(prev => prev.filter(t => t.id !== tempId))
        console.error('Failed to add audit task:', await res.text())
      }
    } catch (e) {
      setLiveTasks(prev => prev.filter(t => t.id !== tempId))
      console.error('Failed to add audit task:', e)
    }
  }, [])

  const handleAuditSpawnAgent = useCallback(async (suggestion) => {
    setSpawnTask({
      id: suggestion.taskId,
      title: suggestion.taskTitle,
      _prefillInstructions: suggestion.agentInstructions,
      _template: suggestion.template || 'research',
    })
  }, [])

  const handleAuditApplyPriority = useCallback(async (taskId, priority) => {
    setLiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t))
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_priority', taskId, priority })
      })
    } catch (e) { console.error('Failed to update priority:', e) }
  }, [])

  const sharedProps = {
    onComplete: handleComplete,
    completing,
    onSpawn: setSpawnTask,
    onSetDate: handleSetDate,
    allTasks: allTasksForPicker,
    onAddDep: handleAddDep,
    onRemoveDep: handleRemoveDep,
    onAddSubtask: handleAddSubtask,
    onToggleSubtasks: handleToggleSubtasks,
    expandedParents,
    onMoveSection: handleMoveSection,
    onSetFocus: handleSetFocus,
  }

  return (
    <div className="tasks-v2">
      {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '8px 12px', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>{error}</div>}
      <QuickAdd onAdd={handleQuickAdd} onAudit={handleAudit} auditing={auditing} />
      <AuditSuggestions
        results={auditResults}
        onRemoveTask={handleAuditRemoveTask}
        onAddTask={handleAuditAddTask}
        onSpawnAgent={handleAuditSpawnAgent}
        onApplyPriority={handleAuditApplyPriority}
        onClear={() => setAuditResults(null)}
      />
      <FocusCard task={focusTask} onComplete={handleComplete} completing={completing} onSpawn={setSpawnTask} onSetDate={handleSetDate} onSetFocus={handleSetFocus} allTasks={allTasks} />
      <TodaySection tasks={todayTasks} {...sharedProps} currentSection="today" />
      <Section icon={<CalendarRange size={14} />} title="THIS WEEK" tasks={weekTasks} {...sharedProps} defaultOpen={false} currentSection="this_week" />

      {activeProjects.length > 0 && (
        <div className="ts-section">
          <div className="ts-header">
            <span className="ts-title"><Rocket size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> PROJECTS</span>
          </div>
          <div className="proj-grid">
            {activeProjects.map(p => (
              <ProjectCard key={p.id} project={p} onComplete={handleComplete} completing={completing} onSpawn={setSpawnTask} onSetDate={handleSetDate} />
            ))}
          </div>
        </div>
      )}

      <Section icon={<Inbox size={14} />} title="LATER" tasks={laterTasks} {...sharedProps} defaultOpen={false} currentSection="later" />
      {blockedTasks.length > 0 && (
        <Section icon={<Lock size={14} />} title="BLOCKED" tasks={blockedTasks} {...sharedProps} defaultOpen={false} currentSection="blocked" />
      )}
      <DoneToday tasks={doneToday} />

      {subtaskAddParent && (
        <SubtaskQuickAdd
          parentTask={subtaskAddParent}
          onAdd={handleSubtaskSubmit}
          onCancel={() => setSubtaskAddParent(null)}
        />
      )}

      {spawnTask && (
        <SpawnModal
          task={spawnTask}
          onClose={() => setSpawnTask(null)}
          onSpawned={(id) => { setAgentActive(prev => ({ ...prev, [id]: true })); setToast('Agent spawned') }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
{/* audit suggestions rendered inline above */}
    </div>
  )
}
