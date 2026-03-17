'use client'
import { useState, useEffect } from 'react'

export default function FocusOverlay({ isActive, currentTask, onExit, onDone }) {
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [mode, setMode] = useState('timer')
  const [timerDuration, setTimerDuration] = useState(25 * 60)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [stopwatchTime, setStopwatchTime] = useState(0)
  const [running, setRunning] = useState(false)
  const [showSetup, setShowSetup] = useState(true)
  
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

  useEffect(() => {
    if (!running || !isActive) return
    const interval = setInterval(() => {
      if (mode === 'timer') {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRunning(false)
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
