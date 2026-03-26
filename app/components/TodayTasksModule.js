'use client'
import { useState, useEffect } from 'react'
import { Crosshair, Plus, ArrowRight, ExternalLink } from 'lucide-react'

function TaskRow({ task, onComplete, completing, onSetFocus }) {
  const isCompleting = completing === task.id
  
  const handleComplete = () => {
    if (isCompleting) return
    onComplete(task)
  }

  const handleSetFocus = (e) => {
    e.stopPropagation()
    onSetFocus(task.id)
  }

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'critical': return '#ef4444'
      case 'high': return '#f59e0b'
      case 'medium': return '#eab308' 
      case 'low': return '#666'
      default: return '#666'
    }
  }

  const getUrgencyStyle = () => {
    switch (task.urgency) {
      case 'overdue': 
        return { 
          background: 'rgba(239,68,68,0.08)', 
          borderColor: 'rgba(239,68,68,0.2)' 
        }
      case 'today':
        return { 
          background: 'rgba(234,179,8,0.06)', 
          borderColor: 'rgba(234,179,8,0.15)' 
        }
      default:
        return {}
    }
  }

  return (
    <div 
      className="today-task-row" 
      style={getUrgencyStyle()}
      onClick={handleComplete}
    >
      <div className="today-task-check">
        {isCompleting ? '···' : ''}
      </div>
      
      <div className="today-task-priority" style={{ background: getPriorityColor() }}></div>
      
      <div className="today-task-content">
        <span className="today-task-title">{task.title}</span>
        {task.project_name && (
          <span 
            className="today-task-project" 
            style={{ color: task.project_color }}
          >
            {task.project_name}
          </span>
        )}
      </div>
      
      <div className="today-task-actions">
        {!task.is_focus && (
          <button 
            className="today-task-focus-btn"
            onClick={handleSetFocus}
            title="Set as focus"
          >
            <Crosshair size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function FocusCard({ task, onComplete, completing, onSetFocus }) {
  if (!task) return null

  const isCompleting = completing === task.id
  
  const handleComplete = () => {
    if (isCompleting) return
    onComplete(task)
  }

  return (
    <div className="today-focus-card" onClick={handleComplete}>
      <div className="today-focus-header">
        <div className="today-focus-label">
          <Crosshair size={12} style={{ marginRight: 4 }} />
          FOCUS TASK
          {task.is_focus && <span className="today-focus-pinned">PINNED</span>}
        </div>
        <button 
          className="today-focus-change"
          onClick={(e) => { e.stopPropagation(); onSetFocus(null) }}
          title="Change focus task"
        >
          Change
        </button>
      </div>
      
      <div className="today-focus-title">{task.title}</div>
      
      <div className="today-focus-meta">
        {task.project_name && (
          <span 
            className="today-focus-project" 
            style={{ color: task.project_color }}
          >
            {task.project_name}
          </span>
        )}
        <span className="today-focus-hint">
          {isCompleting ? 'completing...' : 'click to complete →'}
        </span>
      </div>
    </div>
  )
}

function QuickAdd({ onAdd }) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
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
    <form className="today-quick-add" onSubmit={handleSubmit}>
      <Plus size={14} className="today-quick-add-icon" />
      <input
        className="today-quick-add-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add task..."
        disabled={adding}
      />
    </form>
  )
}

export default function TodayTasksModule() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)
  const [error, setError] = useState(null)

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/today-tasks')
      if (response.ok) {
        const taskData = await response.json()
        setData(taskData)
        setError(null)
      } else {
        throw new Error('Failed to fetch tasks')
      }
    } catch (err) {
      console.error('Tasks fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    // Refresh every 2 minutes
    const interval = setInterval(fetchTasks, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleComplete = async (task) => {
    if (completing) return
    
    setCompleting(task.id)
    
    // Optimistic update
    setData(prev => ({
      ...prev,
      focusTask: prev.focusTask?.id === task.id ? prev.tasks[0] || null : prev.focusTask,
      tasks: prev.tasks.filter(t => t.id !== task.id)
    }))
    
    try {
      const response = await fetch('/api/today-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'complete', 
          taskId: task.id 
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to complete task')
      }
      
      // Success - the optimistic update stays
      
    } catch (err) {
      console.error('Complete task error:', err)
      setError('Failed to complete task')
      // Rollback optimistic update
      fetchTasks()
    } finally {
      setCompleting(null)
    }
  }

  const handleSetFocus = async (taskId) => {
    if (!taskId) {
      // Clear focus - set first task as focus
      const newFocus = data.tasks[0] || null
      if (newFocus) {
        setData(prev => ({
          ...prev,
          focusTask: newFocus,
          tasks: prev.tasks.filter(t => t.id !== newFocus.id)
        }))
      }
      return
    }

    // Find task and set as focus
    const taskToFocus = data.tasks.find(t => t.id === taskId)
    if (!taskToFocus) return

    const oldFocus = data.focusTask
    
    // Optimistic update
    setData(prev => ({
      ...prev,
      focusTask: taskToFocus,
      tasks: [
        ...(oldFocus ? [oldFocus] : []),
        ...prev.tasks.filter(t => t.id !== taskId)
      ]
    }))

    try {
      const response = await fetch('/api/today-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'set_focus', 
          taskId 
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to set focus')
      }
    } catch (err) {
      console.error('Set focus error:', err)
      setError('Failed to update focus')
      // Rollback
      fetchTasks()
    }
  }

  const handleQuickAdd = async (title) => {
    try {
      const response = await fetch('/api/today-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          title 
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to add task')
      }
      
      const result = await response.json()
      
      // Add to tasks list
      if (result.task) {
        setData(prev => ({
          ...prev,
          tasks: [...prev.tasks, result.task],
          total: prev.total + 1
        }))
      }
      
    } catch (err) {
      console.error('Add task error:', err)
      setError('Failed to add task')
    }
  }

  if (loading) {
    return (
      <div className="today-tasks-card">
        <div className="today-tasks-header">
          <h3 className="today-tasks-title">TODAY'S TASKS</h3>
        </div>
        <div className="today-tasks-loading">
          Loading tasks...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="today-tasks-card">
        <div className="today-tasks-header">
          <h3 className="today-tasks-title">TODAY'S TASKS</h3>
        </div>
        <div className="today-tasks-error">
          <div>{error}</div>
          <button 
            className="today-tasks-retry" 
            onClick={fetchTasks}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { focusTask, tasks, total } = data || {}
  const hasMoreTasks = total > (tasks?.length || 0) + (focusTask ? 1 : 0)

  return (
    <div className="today-tasks-card">
      <div className="today-tasks-header">
        <h3 className="today-tasks-title">TODAY'S TASKS</h3>
        <a href="/tasks" className="today-tasks-view-all">
          View all <ExternalLink size={11} />
        </a>
      </div>

      <div className="today-tasks-content">
        {focusTask && (
          <FocusCard
            task={focusTask}
            onComplete={handleComplete}
            completing={completing}
            onSetFocus={handleSetFocus}
          />
        )}

        {tasks && tasks.length > 0 && (
          <div className="today-tasks-list">
            <div className="today-tasks-section-label">Next Up</div>
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={handleComplete}
                completing={completing}
                onSetFocus={handleSetFocus}
              />
            ))}
          </div>
        )}

        {(!focusTask && (!tasks || tasks.length === 0)) && (
          <div className="today-tasks-empty">
            <div className="today-tasks-empty-icon">✨</div>
            <div className="today-tasks-empty-text">All clear!</div>
            <div className="today-tasks-empty-subtext">No urgent tasks for today</div>
          </div>
        )}

        <QuickAdd onAdd={handleQuickAdd} />

        {hasMoreTasks && (
          <div className="today-tasks-more">
            <a href="/tasks" className="today-tasks-more-link">
              +{total - (tasks?.length || 0) - (focusTask ? 1 : 0)} more tasks →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// Add CSS styles to globals.css:
/*
.today-tasks-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 0;
  padding: 1.25rem;
  min-height: 280px;
  display: flex;
  flex-direction: column;
}

.today-tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #1a1a1a;
}

.today-tasks-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin: 0;
}

.today-tasks-view-all {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: #666;
  text-decoration: none;
  transition: color 0.15s;
}

.today-tasks-view-all:hover {
  color: #fff;
}

.today-tasks-loading,
.today-tasks-error,
.today-tasks-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  flex: 1;
  gap: 0.5rem;
  color: #666;
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
}

.today-tasks-retry {
  background: #222;
  border: 1px solid #333;
  color: #ccc;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;
}

.today-tasks-retry:hover {
  background: #2a2a2a;
  border-color: #444;
}

.today-tasks-empty-icon {
  font-size: 2rem;
  opacity: 0.3;
}

.today-tasks-empty-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: #ccc;
}

.today-tasks-empty-subtext {
  font-size: 0.7rem;
  color: #555;
}

.today-tasks-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.today-focus-card {
  background: rgba(234,179,8,0.06);
  border: 1px solid rgba(234,179,8,0.2);
  border-left: 3px solid #eab308;
  border-radius: 6px;
  padding: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}

.today-focus-card:hover {
  background: rgba(234,179,8,0.08);
}

.today-focus-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.today-focus-label {
  display: flex;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 700;
  color: #eab308;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.today-focus-pinned {
  font-size: 0.55rem;
  background: rgba(99,102,241,0.2);
  color: #818cf8;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  margin-left: 0.5rem;
}

.today-focus-change {
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}

.today-focus-change:hover {
  color: rgba(255,255,255,0.8);
  border-color: rgba(255,255,255,0.3);
}

.today-focus-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  margin-bottom: 0.5rem;
}

.today-focus-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.today-focus-project {
  font-size: 0.7rem;
  font-weight: 500;
}

.today-focus-hint {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  margin-left: auto;
}

.today-tasks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.today-tasks-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.25rem;
}

.today-task-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid #1a1a1a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.today-task-row:hover {
  background: rgba(255,255,255,0.02);
  border-color: #2a2a2a;
}

.today-task-check {
  width: 14px;
  height: 14px;
  border: 1px solid #333;
  border-radius: 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  color: #666;
}

.today-task-priority {
  width: 3px;
  height: 14px;
  border-radius: 1px;
  flex-shrink: 0;
}

.today-task-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.today-task-title {
  font-size: 0.8rem;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.today-task-project {
  font-size: 0.65rem;
  font-weight: 500;
  flex-shrink: 0;
}

.today-task-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.today-task-row:hover .today-task-actions {
  opacity: 1;
}

.today-task-focus-btn {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.today-task-focus-btn:hover {
  color: #818cf8;
}

.today-quick-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px dashed #333;
  border-radius: 4px;
  margin-top: auto;
}

.today-quick-add-icon {
  color: #555;
  flex-shrink: 0;
}

.today-quick-add-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ccc;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  outline: none;
}

.today-quick-add-input::placeholder {
  color: #444;
}

.today-tasks-more {
  text-align: center;
  margin-top: 0.5rem;
}

.today-tasks-more-link {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #666;
  text-decoration: none;
  transition: color 0.15s;
}

.today-tasks-more-link:hover {
  color: #ccc;
}
*/