'use client'
import { useState } from 'react'
import { normalizeTasks } from '../lib/normalize'

// === TASK SPAWN MODAL ===
function TaskSpawnModal({ isOpen, task, projectContext, onClose }) {
  const [context, setContext] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [status, setStatus] = useState('')

  const handleSpawn = async () => {
    if (!task?.text || spawning) return
    setSpawning(true)
    setStatus('SPAWNING...')
    try {
      const cleanTaskText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Use sessions_spawn to: ${cleanTaskText}${context.trim() ? `. Additional context: ${context.trim()}` : ''}` })
      })
      if (response.ok) { setStatus('SENT'); setTimeout(() => onClose(), 1000) }
      else { setStatus('ERROR'); setTimeout(() => setStatus(''), 2000) }
    } catch { setStatus('ERROR'); setTimeout(() => setStatus(''), 2000) }
    finally { setSpawning(false) }
  }

  if (!isOpen) return null

  return (
    <div className="task-spawn-overlay" onClick={onClose}>
      <div className="task-spawn-modal" onClick={e => e.stopPropagation()}>
        <div className="task-spawn-header">SPAWN AGENT</div>
        <div className="task-spawn-task">
          <div className="task-spawn-label">TASK</div>
          <div className="task-spawn-task-text">{task?.text?.replace(/\*\*/g, '').trim()}</div>
        </div>
        <div className="task-spawn-input-group">
          <label className="task-spawn-label">ADDITIONAL CONTEXT</label>
          <input className="task-spawn-input" value={context} onChange={e => setContext(e.target.value)} placeholder="What should the agent focus on?" disabled={spawning}
            onKeyDown={e => { if (e.key === 'Enter' && !spawning) handleSpawn(); if (e.key === 'Escape') onClose() }} />
        </div>
        <div className="task-spawn-actions">
          <button className="task-spawn-btn task-spawn-btn-secondary" onClick={onClose} disabled={spawning}>CANCEL</button>
          <button className="task-spawn-btn task-spawn-btn-primary" onClick={handleSpawn} disabled={spawning}>{status || 'SPAWN'}</button>
        </div>
        <div className="task-spawn-hints"><span>ENTER to spawn</span><span>ESC to cancel</span></div>
      </div>
    </div>
  )
}

// === ENERGY INDICATOR ===
function EnergyDot({ level }) {
  const char = level === 'high' ? '⬤' : level === 'low' ? '○' : '◐'
  const title = `${level} energy`
  return <span className="energy-dot" title={title} style={{ fontSize: '8px', color: '#555', marginRight: '6px' }}>{char}</span>
}

// === TIME DISPLAY ===
function TimeDisplay({ estimated, actual }) {
  if (!estimated && !actual) return null
  return (
    <span className="task-time" style={{ color: '#555', fontSize: '11px' }}>
      {actual ? `${actual}m` : ''}{actual && estimated ? '/' : ''}{estimated ? `${estimated}m` : ''}
    </span>
  )
}

// === TASK HELPERS ===
function findDoNextTask(tasks, energy = 3) {
  const valid = tasks.filter(t => t && t.text && t.status !== 'blocked')
  if (!valid.length) return null

  // Energy-aware: low energy toolbar → prefer low-energy tasks
  const energyFiltered = energy <= 2 
    ? [...valid.filter(t => t.energy_required === 'low'), ...valid.filter(t => t.energy_required === 'medium'), ...valid.filter(t => t.energy_required === 'high')]
    : energy >= 4
    ? [...valid.filter(t => t.energy_required === 'high'), ...valid.filter(t => t.energy_required === 'medium'), ...valid.filter(t => t.energy_required === 'low')]
    : valid

  const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, 'this-week': 3, 'this_week': 3, later: 4, none: 5 }
  
  const sorted = [...energyFiltered].sort((a, b) => {
    // In-progress first
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1
    // Then urgency
    const ua = urgencyOrder[a.urgency] ?? 5, ub = urgencyOrder[b.urgency] ?? 5
    if (ua !== ub) return ua - ub
    // Then priority
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2)
  })

  return sorted[0] || null
}

function groupTasksByCategory(tasks) {
  const valid = tasks.filter(t => t && t.text)
  const groups = {
    uni: valid.filter(t => t.category === 'uni'),
    work: valid.filter(t => t.category === 'work'),
    personal: valid.filter(t => t.category === 'personal'),
    health: valid.filter(t => t.category === 'health'),
    admin: valid.filter(t => t.category === 'admin'),
  }
  return Object.fromEntries(Object.entries(groups).filter(([_, tasks]) => tasks.length > 0))
}

// === SUB COMPONENTS ===
function DoNextCard({ task, onComplete, completing, energy, onSpawn }) {
  const [showSpawn, setShowSpawn] = useState(false)
  if (!task || !task.text) return null

  const cleanText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()
  const urgencyText = { overdue: 'OVERDUE', today: 'DUE TODAY', tomorrow: 'DUE TOMORROW', 'this-week': 'DUE THIS WEEK', 'this_week': 'DUE THIS WEEK' }
  const energyHint = energy <= 2 ? '// low energy pick' : energy >= 4 ? '// deep work pick' : '// priority task'

  return (
    <div className="do-next-hero" onMouseEnter={() => setShowSpawn(true)} onMouseLeave={() => setShowSpawn(false)} onClick={!completing ? onComplete : null}>
      <div className="do-next-header">
        DO NEXT
        <div className="do-next-energy-hint">{energyHint}</div>
        <div className={`do-next-spawn-btn ${showSpawn ? 'spawn-visible' : ''}`} onClick={e => { e.stopPropagation(); onSpawn?.(task) }}>→</div>
      </div>
      <div className="do-next-task">
        <EnergyDot level={task.energy_required} />
        {cleanText}
      </div>
      <div className="do-next-meta">
        <div className={`do-next-urgency task-urgency-${task.urgency}`}>{urgencyText[task.urgency] || 'PRIORITY TASK'}</div>
        <div className="do-next-category">
          {(task.category || 'personal').toUpperCase()}
          <TimeDisplay estimated={task.estimated_minutes} actual={task.actual_minutes} />
          {' • '}{completing ? 'COMPLETING...' : 'CLICK TO COMPLETE'}
        </div>
      </div>
      {task.subtasks?.length > 0 && (
        <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '1px solid #222' }}>
          {task.subtasks.map((st, i) => (
            <div key={i} style={{ color: '#555', fontSize: '11px', padding: '2px 0' }}>○ {st.text || st.title}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubtaskRow({ task, onComplete, completing }) {
  if (!task || !task.text) return null
  const cleanText = task.text.replace(/\*\*/g, '').trim()
  return (
    <div className="subtask-row" onClick={!completing ? () => onComplete(task) : null}
      style={{ display: 'flex', alignItems: 'center', padding: '4px 0 4px 24px', cursor: 'pointer', gap: '6px' }}>
      <div className={`task-checkbox ${completing ? 'completing' : ''}`} style={{ width: '12px', height: '12px', fontSize: '8px' }}>{completing ? '...' : ''}</div>
      <EnergyDot level={task.energy_required} />
      <span style={{ color: '#777', fontSize: '11px' }}>{cleanText}</span>
      <TimeDisplay estimated={task.estimated_minutes} actual={task.actual_minutes} />
    </div>
  )
}

function EnhancedTask({ task, onComplete, completing, onSpawn, showSubtasks = true }) {
  const [showSpawn, setShowSpawn] = useState(false)
  if (!task || !task.text) return null
  const cleanText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()
  const isBlocked = task.status === 'blocked'
  const urgencyLabels = { overdue: 'OVERDUE', today: 'TODAY', tomorrow: 'TOMORROW', 'this-week': 'THIS WEEK', 'this_week': 'THIS WEEK' }

  return (
    <>
      <div className={`enhanced-task ${task.isUrgent ? 'task-urgent' : ''} ${isBlocked ? 'task-blocked' : ''}`}
        onMouseEnter={() => setShowSpawn(true)} onMouseLeave={() => setShowSpawn(false)}
        onClick={!completing && !isBlocked ? onComplete : null}
        style={isBlocked ? { opacity: 0.5 } : undefined}>
        <div className={`task-checkbox ${completing ? 'completing' : ''}`}>{completing ? '...' : ''}</div>
        <div className="enhanced-task-content">
          <div className="enhanced-task-text">
            <EnergyDot level={task.energy_required} />
            {cleanText}
            <TimeDisplay estimated={task.estimated_minutes} actual={task.actual_minutes} />
          </div>
          <div className="enhanced-task-meta">
            {task.urgency && task.urgency !== 'none' && task.urgency !== 'later' && (
              <div className={`enhanced-task-due task-urgency-${task.urgency}`}>{urgencyLabels[task.urgency]}</div>
            )}
            {isBlocked && task.blocked_reason && (
              <span style={{ color: '#b91c1c', fontSize: '10px' }}>BLOCKED: {task.blocked_reason}</span>
            )}
            <div className="enhanced-task-tags">
              {task.isUrgent && <span className="task-tag tag-urgent">urgent</span>}
              {task.text.match(/COMM\d+|CODE\d+|FADA\d+/i) && (
                <span className="task-tag">{task.text.match(/COMM\d+|CODE\d+|FADA\d+/i)[0].toLowerCase()}</span>
              )}
            </div>
          </div>
        </div>
        <div className={`task-spawn-btn ${showSpawn ? 'spawn-visible' : ''}`} onClick={e => { e.stopPropagation(); onSpawn?.(task) }}>→</div>
      </div>
      {showSubtasks && task.subtasks?.length > 0 && task.subtasks.map((st, i) => (
        <SubtaskRow key={`sub-${i}`} task={st} onComplete={onComplete} completing={completing === (st.text || st.title)} />
      ))}
    </>
  )
}

function TaskCategory({ category, tasks, onTaskComplete, completingTask, onSpawn }) {
  const categoryNames = { uni: 'University', work: 'Client Work', personal: 'Personal', health: 'Health', admin: 'Admin' }

  const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, 'this-week': 3, 'this_week': 3, later: 4, none: 5 }
  const sortedTasks = [...tasks].sort((a, b) => {
    // Blocked tasks last
    if (a.status === 'blocked' && b.status !== 'blocked') return 1
    if (b.status === 'blocked' && a.status !== 'blocked') return -1
    const ua = urgencyOrder[a.urgency] ?? 5, ub = urgencyOrder[b.urgency] ?? 5
    if (ua !== ub) return ua - ub
    if (a.isUrgent !== b.isUrgent) return b.isUrgent - a.isUrgent
    return 0
  })

  return (
    <div className={`task-category category-${category}`}>
      <div className="task-category-header">
        <div className="task-category-title"><div className="category-icon" />{categoryNames[category] || category}</div>
        <div className="task-category-count">{tasks.length}</div>
      </div>
      <div className="task-category-tasks">
        {sortedTasks.map((task, i) => (
          <EnhancedTask key={task.id || i} task={task} onComplete={() => onTaskComplete(task)} completing={completingTask === task.text} onSpawn={onSpawn} />
        ))}
      </div>
    </div>
  )
}

function ProjectTask({ task, isActive, onComplete, completing, onSpawn, projectContext }) {
  if (!task || !task.text) return null
  const [showSpawn, setShowSpawn] = useState(false)
  const cleanText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()

  return (
    <>
      <div className={`project-task ${isActive ? 'task-active' : ''}`}
        onMouseEnter={() => setShowSpawn(true)} onMouseLeave={() => setShowSpawn(false)}
        onClick={!completing ? onComplete : null}>
        <div className={`task-checkbox ${completing ? 'completing' : ''}`}>{completing ? '...' : ''}</div>
        <div className="enhanced-task-content">
          <div className="enhanced-task-text">
            <EnergyDot level={task.energy_required} />
            {cleanText}
            <TimeDisplay estimated={task.estimated_minutes} actual={task.actual_minutes} />
          </div>
          {isActive && <div className="task-active-indicator">PRIORITY</div>}
        </div>
        <div className={`task-spawn-btn ${showSpawn ? 'spawn-visible' : ''}`} onClick={e => { e.stopPropagation(); onSpawn?.(task, projectContext) }}>→</div>
      </div>
      {task.subtasks?.length > 0 && task.subtasks.map((st, i) => (
        <SubtaskRow key={`psub-${i}`} task={st} onComplete={() => onComplete()} completing={completing === (st.text || st.title)} />
      ))}
    </>
  )
}

function PinnedProject({ project, allTasks, onTaskComplete, completingTask, onSpawn }) {
  const projectTasks = project.tasks || []
  const doneTasks = allTasks.filter(t => (t.status === "done" || t.done) && t.section === project.section)
  const totalTasks = projectTasks.length + doneTasks.length
  const progress = totalTasks > 0 ? (doneTasks.length / totalTasks) * 100 : 0
  
  const activeTasks = projectTasks.filter(t => !(t.status === "done" || t.done) && (t.status === 'in_progress' || t.isUrgent || t.text?.includes('NOW')))
  const upcomingTasks = projectTasks.filter(t => !(t.status === "done" || t.done) && !activeTasks.includes(t))
  const currentPhase = project.currentPhase || project.phases?.[0] || { name: 'In Progress' }

  return (
    <div className="pinned-project">
      <div className="pinned-project-header">
        <div className="pinned-project-main">
          <div className="pinned-project-label">PINNED PROJECT</div>
          <div className="pinned-project-title">{project.name}</div>
          <div className="pinned-project-subtitle">
            {project.client && `${project.client} • `}{currentPhase.name}{project.total && ` • ${project.total}`}
          </div>
        </div>
        <div className="pinned-project-status">
          <div className={`project-status-badge status-${project.status?.toLowerCase() || 'active'}`}>{project.status?.toUpperCase() || 'ACTIVE'}</div>
        </div>
      </div>
      <div className="pinned-project-progress">
        <div className="progress-header"><span className="progress-label">OVERALL PROGRESS</span><span className="progress-percentage">{Math.round(progress)}%</span></div>
        <div className="pinned-progress-bar"><div className="pinned-progress-fill" style={{ width: `${progress}%` }} /></div>
        <div className="progress-stats"><span>{doneTasks.length} of {totalTasks} tasks complete</span></div>
      </div>
      <div className="pinned-project-tasks">
        <div className="project-tasks-section">
          {activeTasks.length > 0 && (
            <>
              <div className="tasks-section-header">ACTIVE NOW</div>
              {activeTasks.slice(0, 2).map((task, i) => (
                <ProjectTask key={`active-${i}`} task={task} isActive={true} onComplete={() => onTaskComplete(task)} completing={completingTask === task.text} onSpawn={onSpawn} projectContext={project.name} />
              ))}
            </>
          )}
          {upcomingTasks.length > 0 && (
            <>
              <div className="tasks-section-header">UPCOMING</div>
              {upcomingTasks.slice(0, 3).map((task, i) => (
                <ProjectTask key={`upcoming-${i}`} task={task} isActive={false} onComplete={() => onTaskComplete(task)} completing={completingTask === task.text} onSpawn={onSpawn} projectContext={project.name} />
              ))}
            </>
          )}
        </div>
        {projectTasks.length > 5 && <div className="project-tasks-more">+{projectTasks.length - 5} more tasks in this project</div>}
      </div>
    </div>
  )
}

// === MAIN TASKS MODULE ===
export default function TasksModule({ data, energy, contextMode }) {
  const [completingTask, setCompletingTask] = useState(null)
  const [spawnModal, setSpawnModal] = useState({ open: false, task: null, projectContext: null })

  const normalizedTasks = normalizeTasks(data.tasks)
  const incompleteTasks = normalizedTasks.filter(t => t.status !== 'done' && !t.done)
  
  // Use category field directly for filtering — no more regex heuristics
  const contextFilteredTasks = incompleteTasks.filter(t => {
    if (contextMode === 'uni') return t.category === 'uni'
    if (contextMode === 'work') return t.category === 'work'
    if (contextMode === 'personal') return t.category === 'personal' || t.category === 'health' || t.category === 'admin'
    return true // deep or default
  })
  
  const showPinnedProject = contextMode === 'work' || contextMode === 'deep'
  const projectTaskIds = new Set()
  if (data.pinnedProject?.tasks) {
    data.pinnedProject.tasks.forEach(t => projectTaskIds.add(t.id))
  }
  const dayToDayTasks = contextFilteredTasks.filter(t => !projectTaskIds.has(t.id))
  
  const doNextTask = findDoNextTask(dayToDayTasks, energy)
  const tasksByCategory = groupTasksByCategory(dayToDayTasks.filter(t => t !== doNextTask))

  const handleTaskComplete = async (task) => {
    setCompletingTask(task.text)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', task: task.text, taskId: task.id, section: task.section })
      })
      if (response.ok) setTimeout(() => window.location.reload(), 500)
    } catch (error) { console.error('Failed to complete task:', error) }
    finally { setCompletingTask(null) }
  }

  const handleSpawnTask = (task, projectContext = null) => {
    setSpawnModal({ open: true, task, projectContext })
  }

  return (
    <>
      {data.pinnedProject && showPinnedProject && (
        <PinnedProject project={data.pinnedProject} allTasks={data.tasks || []} onTaskComplete={handleTaskComplete} completingTask={completingTask} onSpawn={handleSpawnTask} />
      )}

      {doNextTask && (
        <DoNextCard task={doNextTask} onComplete={() => handleTaskComplete(doNextTask)} completing={completingTask === doNextTask.text} energy={energy} onSpawn={handleSpawnTask} />
      )}

      <div className="task-grid">
        {Object.entries(tasksByCategory).map(([category, tasks]) => (
          <TaskCategory key={category} category={category} tasks={tasks} onTaskComplete={handleTaskComplete} completingTask={completingTask} onSpawn={handleSpawnTask} />
        ))}
      </div>

      <TaskSpawnModal isOpen={spawnModal.open} task={spawnModal.task} projectContext={spawnModal.projectContext} onClose={() => setSpawnModal({ open: false, task: null, projectContext: null })} />
    </>
  )
}
