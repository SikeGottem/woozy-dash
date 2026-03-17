'use client'
import { useState, useEffect } from 'react'

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
  setCurrentTask
}) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stateLoaded, setStateLoaded] = useState(false)

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
            if (focusMode) {
              setFocusMode(false)
              saveState({ focusMode: false })
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

  const editCurrentTask = async () => {
    const newTask = prompt('What are you focusing on?', currentTask)
    if (newTask && newTask.trim() && newTask.trim() !== currentTask) {
      const taskText = newTask.trim()
      setCurrentTask(taskText)
      await saveState({ currentTask: taskText })
      await logAction(`Focus task: ${taskText}`)
    }
  }

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
