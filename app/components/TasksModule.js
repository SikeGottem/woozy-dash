'use client'
import { useState } from 'react'
import { normalizeTasks } from '../lib/normalize'

// === TASK SPAWN MODAL ===
function TaskSpawnModal({ isOpen, task, projectContext, onClose }) {
  const [context, setContext] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = { current: null }

  const generateFilename = (taskText) => {
    return taskText
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50) + '.md'
  }

  const determineSavePath = (taskText, projectContext) => {
    if (projectContext === 'Headland Montessori' || taskText.toLowerCase().includes('headland')) {
      return `~/Desktop/WOOZY/PROJECTS/Headland Montessori/`
    }
    if (taskText.match(/COMM\d+|CODE\d+|FADA\d+/i)) {
      return `~/Desktop/WOOZY/UNI/`
    }
    if (taskText.toLowerCase().includes('bristlecone')) {
      return `~/Desktop/WOOZY/LIFE/Clients/`
    }
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
        setTimeout(() => onClose(), 1000)
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
            ref={el => inputRef.current = el}
            className="task-spawn-input"
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="What should the agent focus on?"
            disabled={spawning}
            onKeyDown={e => { if (e.key === 'Enter' && !spawning) handleSpawn(); if (e.key === 'Escape') onClose() }}
          />
        </div>
        
        <div className="task-spawn-actions">
          <button className="task-spawn-btn task-spawn-btn-secondary" onClick={onClose} disabled={spawning}>CANCEL</button>
          <button className="task-spawn-btn task-spawn-btn-primary" onClick={handleSpawn} disabled={spawning}>{status || 'SPAWN'}</button>
        </div>
        
        <div className="task-spawn-hints">
          <span>ENTER to spawn</span>
          <span>ESC to cancel</span>
        </div>
      </div>
    </div>
  )
}

// === TASK HELPERS ===
function findDoNextTask(tasks, energy = 3) {
  const validTasks = tasks.filter(t => t && t.text)
  if (!validTasks.length) return null

  if (energy <= 2) {
    const easyTasks = validTasks.filter(t => {
      const text = t.text.toLowerCase()
      return text.length < 50 && 
             !text.includes('assessment') && !text.includes('project') &&
             !text.includes('research') && !text.includes('analysis') &&
             !text.includes('design') && !text.includes('strategy')
    })
    const overdue = easyTasks.filter(t => t.urgency === 'overdue')
    const today = easyTasks.filter(t => t.urgency === 'today')
    const urgent = easyTasks.filter(t => t.isUrgent)
    if (overdue[0] || today[0] || urgent[0]) return overdue[0] || today[0] || urgent[0]
    return easyTasks[0] || validTasks.filter(t => t.urgency === 'overdue')[0] || validTasks.filter(t => t.urgency === 'today')[0]
  } else if (energy >= 4) {
    const hardTasks = validTasks.filter(t => {
      const text = t.text.toLowerCase()
      return text.includes('assessment') || text.includes('project') ||
             text.includes('research') || text.includes('analysis') ||
             text.includes('design') || text.includes('strategy') ||
             t.category === 'work' || t.isUrgent
    })
    const overdue = hardTasks.filter(t => t.urgency === 'overdue')
    const today = hardTasks.filter(t => t.urgency === 'today')
    const urgent = hardTasks.filter(t => t.isUrgent)
    const tomorrow = hardTasks.filter(t => t.urgency === 'tomorrow')
    if (overdue[0] || today[0] || urgent[0] || tomorrow[0]) return overdue[0] || today[0] || urgent[0] || tomorrow[0]
    return hardTasks[0] || validTasks.filter(t => t.urgency === 'overdue')[0] || validTasks.filter(t => t.urgency === 'today')[0]
  } else {
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
  return Object.fromEntries(Object.entries(groups).filter(([_, tasks]) => tasks.length > 0))
}

// === SUB COMPONENTS ===
function DoNextCard({ task, onComplete, completing, energy, onSpawn }) {
  const [showSpawnButton, setShowSpawnButton] = useState(false)
  const urgencyText = {
    overdue: 'OVERDUE', today: 'DUE TODAY', tomorrow: 'DUE TOMORROW',
    'this-week': 'DUE THIS WEEK', none: 'PRIORITY TASK'
  }

  const getEnergyLabel = (energy) => {
    if (energy <= 2) return '// suggested for low energy'
    if (energy >= 4) return '// deep work recommended'
    return '// standard priority task'
  }

  if (!task || !task.text) return null

  const cleanText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()

  return (
    <div 
      className="do-next-hero" 
      onMouseEnter={() => setShowSpawnButton(true)}
      onMouseLeave={() => setShowSpawnButton(false)}
      onClick={!completing ? onComplete : null}
    >
      <div className="do-next-header">
        DO NEXT
        <div className="do-next-energy-hint">{getEnergyLabel(energy)}</div>
        <div className={`do-next-spawn-btn ${showSpawnButton ? 'spawn-visible' : ''}`} onClick={e => { e.stopPropagation(); onSpawn?.(task) }}>→</div>
      </div>
      <div className="do-next-task">{cleanText}</div>
      <div className="do-next-meta">
        <div className={`do-next-urgency task-urgency-${task.urgency}`}>{urgencyText[task.urgency] || 'PRIORITY TASK'}</div>
        <div className="do-next-category">{(task.category || 'personal').toUpperCase()} • {completing ? 'COMPLETING...' : 'CLICK TO COMPLETE'}</div>
      </div>
    </div>
  )
}

function EnhancedTask({ task, onComplete, completing, onSpawn }) {
  const [showSpawnButton, setShowSpawnButton] = useState(false)
  if (!task || !task.text) return null
  const cleanText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()

  const urgencyLabels = { overdue: 'OVERDUE', today: 'TODAY', tomorrow: 'TOMORROW', 'this-week': 'THIS WEEK' }

  return (
    <div 
      className={`enhanced-task ${task.isUrgent ? 'task-urgent' : ''}`}
      onMouseEnter={() => setShowSpawnButton(true)}
      onMouseLeave={() => setShowSpawnButton(false)}
      onClick={!completing ? onComplete : null}
    >
      <div className={`task-checkbox ${completing ? 'completing' : ''}`}>{completing ? '...' : ''}</div>
      <div className="enhanced-task-content">
        <div className="enhanced-task-text">{cleanText}</div>
        <div className="enhanced-task-meta">
          {task.urgency !== 'none' && (
            <div className={`enhanced-task-due task-urgency-${task.urgency}`}>{urgencyLabels[task.urgency]}</div>
          )}
          <div className="enhanced-task-tags">
            {task.isUrgent && <span className="task-tag tag-urgent">urgent</span>}
            {task.category === 'uni' && task.text.match(/COMM\d+|CODE\d+|FADA\d+/i) && (
              <span className="task-tag">{task.text.match(/COMM\d+|CODE\d+|FADA\d+/i)[0].toLowerCase()}</span>
            )}
          </div>
        </div>
      </div>
      <div className={`task-spawn-btn ${showSpawnButton ? 'spawn-visible' : ''}`} onClick={e => { e.stopPropagation(); onSpawn?.(task) }}>→</div>
    </div>
  )
}

function TaskCategory({ category, tasks, onTaskComplete, completingTask, onSpawn }) {
  const categoryNames = { uni: 'University', work: 'Client Work', personal: 'Personal' }

  const sortedTasks = [...tasks].sort((a, b) => {
    const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, 'this-week': 3, none: 4 }
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (a.isUrgent !== b.isUrgent) return b.isUrgent - a.isUrgent
    return 0
  })

  return (
    <div className={`task-category category-${category}`}>
      <div className="task-category-header">
        <div className="task-category-title"><div className="category-icon" />{categoryNames[category]}</div>
        <div className="task-category-count">{tasks.length}</div>
      </div>
      <div className="task-category-tasks">
        {sortedTasks.map((task, i) => (
          <EnhancedTask key={i} task={task} onComplete={() => onTaskComplete(task)} completing={completingTask === task.text} onSpawn={onSpawn} />
        ))}
      </div>
    </div>
  )
}

function ProjectTask({ task, isActive, onComplete, completing, onSpawn, projectContext }) {
  if (!task || !task.text) return null
  const [showSpawnButton, setShowSpawnButton] = useState(false)
  const cleanText = task.text.replace(/\*\*/g, '').replace(/←.*/, '').replace(/—.*/, '').trim()

  return (
    <div 
      className={`project-task ${isActive ? 'task-active' : ''}`}
      onMouseEnter={() => setShowSpawnButton(true)}
      onMouseLeave={() => setShowSpawnButton(false)}
      onClick={!completing ? onComplete : null}
    >
      <div className={`task-checkbox ${completing ? 'completing' : ''}`}>{completing ? '...' : ''}</div>
      <div className="enhanced-task-content">
        <div className="enhanced-task-text">{cleanText}</div>
        {isActive && <div className="task-active-indicator">PRIORITY</div>}
      </div>
      <div className={`task-spawn-btn ${showSpawnButton ? 'spawn-visible' : ''}`} onClick={e => { e.stopPropagation(); onSpawn?.(task, projectContext) }}>→</div>
    </div>
  )
}

function PinnedProject({ project, allTasks, onTaskComplete, completingTask, onSpawn }) {
  const projectTasks = project.tasks || []
  const doneTasks = allTasks.filter(t => (t.status === "done" || t.done) && t.section === project.section)
  const totalTasks = projectTasks.length + doneTasks.length
  const progress = totalTasks > 0 ? (doneTasks.length / totalTasks) * 100 : 0
  
  const activeTasks = projectTasks.filter(t => !(t.status === "done" || t.done) && (t.isUrgent || t.text.includes('NOW') || t.text.includes('←')))
  const upcomingTasks = projectTasks.filter(t => !(t.status === "done" || t.done) && !activeTasks.includes(t))
  
  const currentPhase = project.currentPhase || project.phases?.[0] || { name: 'In Progress' }

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

      <div className="pinned-project-progress">
        <div className="progress-header">
          <span className="progress-label">OVERALL PROGRESS</span>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
        <div className="pinned-progress-bar">
          <div className="pinned-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-stats">
          <span>{doneTasks.length} of {totalTasks} tasks complete</span>
          {project.timeline && <span>Timeline: {project.timeline}</span>}
        </div>
      </div>

      {project.phases && project.phases.length > 1 && (
        <div className="project-phases">
          <div className="phases-label">PROJECT PHASES</div>
          <div className="phases-timeline">
            {project.phases.slice(0, 4).map((phase, i) => (
              <div key={i} className={`phase-item ${phase.isActive ? 'phase-active' : ''}`}>
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
        {projectTasks.length > 5 && (
          <div className="project-tasks-more">+{projectTasks.length - 5} more tasks in this project</div>
        )}
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
  
  const contextFilteredTasks = incompleteTasks.filter(t => {
    const text = ((t.text || '') + ' ' + (t.section || '') + ' ' + (t.subsection || '') + ' ' + (t.project_name || '')).toLowerCase()
    const isUni = text.match(/comm|code|fada|uni|assignment|quiz|lecture|tutorial|moodle/) || t.category === 'uni'
    const isWork = text.match(/headland|bristlecone|s17|client|invoice|rebrand|montessori/) || t.category === 'freelance' || t.category === 'work' || (t.section || '').includes('Headland')
    if (contextMode === 'uni') return isUni
    if (contextMode === 'work') return isWork
    if (contextMode === 'personal') return !isWork
    if (contextMode === 'deep') return true
    return true
  })
  
  const projectTaskSections = data.pinnedProject ? [data.pinnedProject.section] : []
  const showPinnedProject = contextMode === 'work' || contextMode === 'deep'
  const dayToDayTasks = contextFilteredTasks.filter(t => !projectTaskSections.includes(t.section))
  
  const doNextTask = findDoNextTask(dayToDayTasks, energy)
  const tasksByCategory = groupTasksByCategory(dayToDayTasks.filter(t => t !== doNextTask))

  const handleTaskComplete = async (task) => {
    setCompletingTask(task.text)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', task: task.text, section: task.section })
      })
      if (response.ok) setTimeout(() => window.location.reload(), 500)
    } catch (error) {
      console.error('Failed to complete task:', error)
    } finally {
      setCompletingTask(null)
    }
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
