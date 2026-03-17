'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import BootSequence from './components/BootSequence'
import CommandToolbar from './components/CommandToolbar'
import FocusOverlay from './components/FocusOverlay'
import TasksModule from './components/TasksModule'
import AgentsModule from './components/AgentsModule'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { NotificationProvider } from './context/NotificationContext'
import ToastNotifications from './components/notifications/ToastNotifications'
import AgentDM from './components/notifications/AgentDM'

// === CAPTURE MODAL ===
function CaptureModal({ isOpen, onClose }) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) { setTimeout(() => inputRef.current?.focus(), 50) } else { setInput('') }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter' && !saving) handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, saving])

  const handleSave = async () => {
    if (!input.trim() || saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() })
      })
      if (response.ok) onClose()
    } catch (error) {
      console.error('Capture error:', error)
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="capture-modal-overlay" onClick={onClose}>
      <div className="capture-modal" onClick={e => e.stopPropagation()}>
        <div className="capture-header">QUICK CAPTURE</div>
        <div className="capture-input-row">
          <span className="capture-prompt">{'>'}</span>
          <input ref={inputRef} className="capture-input" value={input} onChange={e => setInput(e.target.value)} placeholder="capture_" disabled={saving} />
        </div>
        <div className="capture-hints">
          <span>ENTER to save</span>
          <span>ESC to cancel</span>
        </div>
      </div>
    </div>
  )
}

// === BOOT SEQUENCE CONFIG ===
const bootSequence = [
  { text: '> WOOZY KERNEL v2.0.4 LOADING...', delay: 0 },
  { text: '> Mounting secure filesystem ██████████ OK', delay: 300 },
  { text: '> Connecting to OpenClaw Gateway [127.0.0.1:18789]...', delay: 600 },
  { text: '> Authentication ✓ Token verified', delay: 900 },
  { text: '> Loading agent: MAIN — Woozy Command', delay: 1100 },
  { text: '> Scanning vault: ~/Desktop/WOOZY/', delay: 1400 },
  { text: `> Assets loaded — ${new Date().toLocaleDateString('en-AU')}`, delay: 1600 },
  { text: '> Financial encryption layer: ARMED', delay: 1900 },
  { text: '> All systems nominal. Welcome back, Ethan.', delay: 2100 },
  { text: '', delay: 2500, done: true },
]

// === MAIN ===
export default function Home() {
  const [data, setData] = useState(null)
  const [unlocked] = useState(false)
  const [booted, setBooted] = useState(false)
  const [bootLines, setBootLines] = useState([])
  const [captureOpen, setCaptureOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [contextMode, setContextMode] = useState('personal')
  const [energy, setEnergy] = useState(3)
  const [timer, setTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [currentTask, setCurrentTask] = useState('Dashboard design')
  const [scrollToAgentId, setScrollToAgentId] = useState(null)
  const agentsSectionRef = useRef(null)

  const handleViewTranscript = useCallback((agentId) => {
    setScrollToAgentId(agentId)
    agentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    const modeParam = contextMode && contextMode !== 'deep' ? `?mode=${contextMode}` : ''
    const fetchData = () => fetch(`/api/data${modeParam}`).then(r => r.json()).then(setData).catch(() => {})
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [contextMode])

  useEffect(() => {
    document.body.setAttribute('data-focus-mode', focusMode.toString())
    document.body.setAttribute('data-context-mode', contextMode)
  }, [focusMode, contextMode])

  const handleFocusExit = async () => {
    setFocusMode(false)
    try {
      await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ focusMode: false }) })
      await fetch('/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Focus mode exited' }) })
    } catch (error) { console.error('Failed to save focus exit:', error) }
  }

  const handleFocusDone = async () => {
    const sessionDuration = timer ? Math.ceil((25 * 60 - timerSeconds) / 60) : 25
    setFocusMode(false)
    setTimer(null)
    setTimerSeconds(0)
    try {
      await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ focusMode: false }) })
      await fetch('/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `Completed focus session: ${currentTask} (${sessionDuration}min)` }) })
    } catch (error) { console.error('Failed to save focus completion:', error) }
  }

  useEffect(() => {
    if (data && !booted) {
      bootSequence.forEach(({ text, delay, done }) => {
        setTimeout(() => {
          if (done) setBooted(true)
          else setBootLines(prev => [...prev, text])
        }, delay)
      })
    }
  }, [data])

  if (!data) return <div className="loading">INITIALIZING SYSTEM...</div>

  if (!booted) return <BootSequence bootLines={bootLines} />

  return (
    <NotificationProvider>
      <ToastNotifications onViewTranscript={handleViewTranscript} />
      <AgentDM />
      <div className="system-header">
        <div className="system-status">● SYSTEM ONLINE</div>
        <div className="system-title">WOOZY COMMAND</div>
        <div className="system-subtitle">Personal Command Center v2.0</div>
      </div>

      <CommandToolbar 
        onCapture={() => setCaptureOpen(true)}
        unlocked={unlocked}
        onLock={() => {}}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        contextMode={contextMode}
        setContextMode={setContextMode}
        energy={energy}
        setEnergy={setEnergy}
        timer={timer}
        setTimer={setTimer}
        timerSeconds={timerSeconds}
        setTimerSeconds={setTimerSeconds}
        currentTask={currentTask}
        setCurrentTask={setCurrentTask}
        data={data}
        onViewTranscript={handleViewTranscript}
      />

      <FocusOverlay
        isActive={focusMode}
        currentTask={currentTask}
        onExit={handleFocusExit}
        onDone={handleFocusDone}
      />

      <div className="main-sections">
        {/* === SECTION 1: TODAY === */}
        <div className="section-today">
          <div className="section-title">TODAY</div>
          <ErrorBoundary name="Tasks">
            <TasksModule data={data} energy={energy} contextMode={contextMode} />
          </ErrorBoundary>
        </div>

        {/* === SECTION 2: AGENTS === */}
        <div className="section-agents" ref={agentsSectionRef}>
          <div className="section-title">AGENTS</div>
          <div className="grid">
            <ErrorBoundary name="Agents">
              <AgentsModule scrollToAgentId={scrollToAgentId} onScrollHandled={() => setScrollToAgentId(null)} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Finance accessible via $ toolbar button → /finance */}
      </div>

      <div className="last-updated">
        Last Update: {new Date(data.updated).toLocaleString('en-AU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
      
      <CaptureModal isOpen={captureOpen} onClose={() => setCaptureOpen(false)} />
    </NotificationProvider>
  )
}
