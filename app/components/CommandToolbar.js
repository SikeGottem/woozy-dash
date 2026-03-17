'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import NotificationCenter from './notifications/NotificationCenter'

export default function CommandToolbar({ 
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
  setCurrentTask,
  data,
  onViewTranscript
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isFinancePage = pathname === '/finance'
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stateLoaded, setStateLoaded] = useState(false)
  const [pomodorosToday, setPomodorosToday] = useState(0)
  const [dashData, setDashData] = useState(data || null)
  const taskInputRef = useRef(null)
  const [editingTask, setEditingTask] = useState(false)
  const [taskDraft, setTaskDraft] = useState(currentTask)

  // Fetch data if not passed as prop
  useEffect(() => {
    if (data) { setDashData(data); return }
    const fetchData = () => fetch('/api/data').then(r => r.json()).then(setDashData).catch(() => {})
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [data])

  // Keep dashData in sync with prop
  useEffect(() => { if (data) setDashData(data) }, [data])

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
          if (data.state.pomodorosToday != null) setPomodorosToday(data.state.pomodorosToday)
        }
      } catch (error) {
        console.error('Failed to load state:', error)
      } finally {
        setStateLoaded(true)
      }
    }
    loadState()
  }, [setFocusMode, setEnergy, setContextMode, setCurrentTask])

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

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (timer) {
      const interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 0) {
            setTimer(null)
            // Increment pomodoro count
            const newCount = pomodorosToday + 1
            setPomodorosToday(newCount)
            saveState({ pomodorosToday: newCount })
            
            if (focusMode) {
              setFocusMode(false)
              saveState({ focusMode: false, pomodorosToday: newCount })
              logAction(`Completed focus session: ${currentTask} (25min)`)
            } else {
              logAction('Completed 25min timer session')
            }
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Pomodoro Complete!', {
                body: 'Time for a break!',
                icon: '/favicon.ico'
              })
            }
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
            } catch (e) {}
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [timer, focusMode, currentTask, pomodorosToday])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const toggleFocusMode = async () => {
    const newFocusMode = !focusMode
    setFocusMode(newFocusMode)
    await saveState({ focusMode: newFocusMode })
    
    if (newFocusMode) {
      if (!timer) {
        setTimer(true)
        setTimerSeconds(25 * 60)
      }
      await logAction(`Focus mode started: ${currentTask}`)
    } else {
      await logAction('Focus mode ended')
    }
  }

  const cycleEnergy = async () => {
    const newEnergy = energy >= 5 ? 1 : energy + 1
    setEnergy(newEnergy)
    await saveState({ energy: newEnergy })
    await logAction(`Energy level: ${newEnergy}/5`)
  }

  const cycleContextMode = async () => {
    const modes = ['uni', 'work', 'personal', 'deep']
    const currentIndex = modes.indexOf(contextMode)
    const newMode = modes[(currentIndex + 1) % modes.length]
    setContextMode(newMode)
    await saveState({ contextMode: newMode })
    await logAction(`Context mode: ${newMode.toUpperCase()}`)
  }

  const toggleTimer = async () => {
    if (timer) {
      setTimer(null)
      setTimerSeconds(0)
      await logAction('Timer stopped')
    } else {
      setTimer(true)
      setTimerSeconds(25 * 60)
      await logAction('Started 25min pomodoro timer')
    }
  }

  const startEditTask = () => {
    setTaskDraft(currentTask)
    setEditingTask(true)
    setTimeout(() => taskInputRef.current?.focus(), 50)
  }

  const commitTask = async () => {
    setEditingTask(false)
    const trimmed = taskDraft.trim()
    if (trimmed && trimmed !== currentTask) {
      setCurrentTask(trimmed)
      await saveState({ currentTask: trimmed })
      await logAction(`Focus task: ${trimmed}`)
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key === '$' || (e.shiftKey && e.key === 'F')) {
        e.preventDefault()
        router.push(isFinancePage ? '/' : '/finance')
        return
      } else if (e.key.toLowerCase() === 'f' && !e.shiftKey) {
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
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDate = (date) => {
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
    })
  }

  // Compute deadline urgency
  const getDeadlineUrgency = () => {
    if (!dashData?.deadlines?.length) return null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Find nearest non-submitted deadline
    const upcoming = dashData.deadlines
      .filter(d => d.status !== 'submitted' && d.status !== 'complete')
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    
    if (!upcoming.length) return null
    
    const nearest = new Date(upcoming[0].due_date)
    const nearestDay = new Date(nearest.getFullYear(), nearest.getMonth(), nearest.getDate())
    const diffDays = Math.floor((nearestDay - today) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'red' // overdue
    if (diffDays === 0) return 'red' // due today
    if (diffDays <= 3) return 'amber' // due within 3 days
    return 'green' // nothing urgent
  }

  // Get next upcoming event/deadline
  const getNextEvent = () => {
    if (!dashData?.deadlines?.length) return null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const upcoming = dashData.deadlines
      .filter(d => d.status !== 'submitted' && d.status !== 'complete')
      .filter(d => new Date(d.due_date) >= today)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    
    if (!upcoming.length) return null
    
    const next = upcoming[0]
    const dueDate = new Date(next.due_date)
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
    const diffDays = Math.floor((dueDay - today) / (1000 * 60 * 60 * 24))
    const diffMs = dueDate - now
    const withinTwoHours = diffMs > 0 && diffMs < 2 * 60 * 60 * 1000
    
    let dateLabel
    if (diffDays === 0) dateLabel = 'TODAY'
    else if (diffDays === 1) dateLabel = 'TOMORROW'
    else dateLabel = dueDate.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
    
    return {
      title: next.project_name ? `${next.project_name}: ${next.title}` : next.title,
      dateLabel,
      isToday: diffDays === 0,
      withinTwoHours,
      notes: next.notes
    }
  }

  // Task stats
  const getTaskStats = () => {
    if (!dashData?.tasks?.length) return null
    const tasks = dashData.tasks.filter(t => t.status !== 'complete' && !t.completed_at)
    const todayTasks = tasks.filter(t => t.section === 'today' || t.urgency === 'today')
    const overdue = dashData.deadlines?.filter(d => d.urgency === 'overdue' && d.status !== 'submitted' && d.status !== 'complete')?.length || 0
    const thisWeek = tasks.filter(t => t.section === 'this_week' || t.urgency === 'this_week')
    
    return {
      today: todayTasks.length || thisWeek.length,
      overdue,
      total: tasks.length
    }
  }

  const urgencyDot = getDeadlineUrgency()
  const nextEvent = getNextEvent()
  const taskStats = getTaskStats()
  const energyDots = '●'.repeat(energy) + '○'.repeat(5 - energy)

  return (
    <div className="command-hud">
      {/* LEFT: Context mode + Focus field */}
      <div className="hud-left">
        <button 
          className={`context-mode context-${contextMode}`}
          onClick={cycleContextMode}
          title="Switch context mode (M)"
        >
          <span className="context-dot" />
          <span className="context-label">{contextMode.toUpperCase()}</span>
        </button>
        
        <div className="hud-focus-field" onClick={!editingTask ? startEditTask : undefined}>
          <span className="focus-prompt">{'>'}</span>
          {editingTask ? (
            <input
              ref={taskInputRef}
              className="focus-input"
              value={taskDraft}
              onChange={e => setTaskDraft(e.target.value)}
              onBlur={commitTask}
              onKeyDown={e => { if (e.key === 'Enter') commitTask(); if (e.key === 'Escape') setEditingTask(false) }}
              spellCheck={false}
            />
          ) : (
            <span className="focus-text" title="Click to edit">{currentTask}</span>
          )}
        </div>
      </div>

      {/* CENTER: Status line + Action buttons */}
      <div className="hud-center">
        {/* Status summary */}
        <div className="hud-status-line">
          {taskStats && (
            <span className="status-line-text">
              {taskStats.today} tasks
              {taskStats.overdue > 0 && <span className="status-line-alert"> · {taskStats.overdue} overdue</span>}
              {pomodorosToday > 0 && <span className="status-line-dim"> · {pomodorosToday} sessions</span>}
            </span>
          )}
          {nextEvent && (
            <span className={`status-line-event ${nextEvent.withinTwoHours ? 'event-urgent' : ''}`}>
              NEXT: {nextEvent.title.length > 30 ? nextEvent.title.slice(0, 30) + '…' : nextEvent.title} · {nextEvent.dateLabel}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="hud-actions">
          <button 
            className={`hud-btn ${focusMode ? 'hud-btn-active' : ''}`}
            onClick={toggleFocusMode}
            title="Toggle focus mode [F]"
          >
            <span className="btn-content">F {focusMode ? 'ON' : 'OFF'}</span>
          </button>

          <button 
            className={`hud-btn ${timer ? 'hud-btn-active' : ''}`}
            onClick={toggleTimer}
            title="Start/stop timer [T]"
          >
            <span className="btn-content">
              T{timer ? ` ${formatTimer(timerSeconds)}` : ''}
            </span>
            {pomodorosToday > 0 && (
              <span className="pomo-dots">
                {Array.from({ length: Math.min(pomodorosToday, 8) }, (_, i) => (
                  <span key={i} className="pomo-dot">·</span>
                ))}
              </span>
            )}
          </button>

          <button 
            className="hud-btn"
            onClick={onCapture}
            title="Quick capture [C]"
          >
            <span className="btn-content">C</span>
          </button>

          <button 
            className="hud-btn"
            onClick={cycleEnergy}
            title="Energy level [E]"
          >
            <span className="btn-content">E {energyDots}</span>
          </button>

          <Link 
            href={isFinancePage ? '/' : '/finance'}
            className={`hud-btn ${isFinancePage ? 'hud-btn-active' : ''}`}
            title={isFinancePage ? 'Back to dashboard [$]' : 'Finance [$]'}
            style={{ textDecoration: 'none' }}
          >
            <span className="btn-content">{isFinancePage ? '⌂' : '$'}</span>
          </Link>
        </div>
      </div>

      {/* RIGHT: Time + urgency dot + lock */}
      <div className="hud-right">
        <div className="hud-time-cluster">
          <div className="hud-date">{formatDate(currentTime)}</div>
          <div className="hud-time">
            <span className="time-value">{formatTime(currentTime)}</span>
            {urgencyDot && (
              <span className={`urgency-dot urgency-${urgencyDot}`} title={`Deadline urgency: ${urgencyDot}`} />
            )}
          </div>
          {focusMode && <div className="hud-mode-tag">FOCUS</div>}
        </div>

        <NotificationCenter onViewTranscript={onViewTranscript || (() => {})} />

        <button 
          className="hud-system"
          onClick={onLock}
          title="Lock system"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="0" ry="0"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
