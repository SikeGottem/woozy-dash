'use client'
import { useEffect, useState } from 'react'
import BootSequence from './components/BootSequence'
import NavBar from './components/NavBar'
import WeatherModule from './components/WeatherModule'
import EventsTimelineModule from './components/EventsTimelineModule'
import TodayTasksModule from './components/TodayTasksModule'
import DailyRhythmModule from './components/DailyRhythmModule'
// ChatPanel is in layout.js
import ErrorBoundary from './components/ui/ErrorBoundary'
import { NotificationProvider } from './context/NotificationContext'
import ToastNotifications from './components/notifications/ToastNotifications'
import AgentDM from './components/notifications/AgentDM'

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
  const [booted, setBooted] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('woozy-booted') === 'true'
    return false
  })
  const [bootLines, setBootLines] = useState([])

  useEffect(() => {
    const fetchData = () => fetch('/api/data').then(r => r.json()).then(setData).catch(() => {})
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (data && !booted) {
      bootSequence.forEach(({ text, delay, done }) => {
        setTimeout(() => {
          if (done) { 
            setBooted(true)
            sessionStorage.setItem('woozy-booted', 'true')
          } else {
            setBootLines(prev => [...prev, text])
          }
        }, delay)
      })
    }
  }, [data, booted])

  if (!data) return <div className="loading">INITIALIZING SYSTEM...</div>

  if (!booted) return <BootSequence bootLines={bootLines} />

  return (
    <NotificationProvider>
      <ToastNotifications />
      <AgentDM />
      <NavBar />
      
      <div className="page-content">
        {/* TODAY COMMAND CENTRE */}
        <div className="today-grid">
          <ErrorBoundary name="Weather">
            <WeatherModule />
          </ErrorBoundary>
          <ErrorBoundary name="EventsTimeline">
            <EventsTimelineModule />
          </ErrorBoundary>
          <ErrorBoundary name="TodayTasks">
            <TodayTasksModule />
          </ErrorBoundary>
        </div>
        
        {/* DAILY RHYTHM FLOW */}
        <ErrorBoundary name="DailyRhythm">
          <DailyRhythmModule data={data} />
        </ErrorBoundary>
      </div>
      
    </NotificationProvider>
  )
}