'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Circle } from 'lucide-react'

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [empRunning, setEmpRunning] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Listen for employee running count updates
  useEffect(() => {
    const handler = (e) => setEmpRunning(e.detail || 0)
    window.addEventListener('emp-running-update', handler)
    // Check initial value
    if (typeof window.__empRunningCount === 'number') setEmpRunning(window.__empRunningCount)
    return () => window.removeEventListener('emp-running-update', handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Only handle if not typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key === '1') {
        e.preventDefault()
        router.push('/')
      } else if (e.key === '2') {
        e.preventDefault()
        router.push('/tasks')
      } else if (e.key === '3') {
        e.preventDefault()
        router.push('/agents')
      } else if (e.key === '4') {
        e.preventDefault()
        router.push('/chat')
      } else if (e.key === '5') {
        e.preventDefault()
        router.push('/vault')
      } else if (e.key === '6') {
        e.preventDefault()
        router.push('/finance')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  const formatTime = (date) => {
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const isActive = (path) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-logo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6, verticalAlign: 'middle' }}><circle cx="8" cy="8" r="7.5" stroke="white" strokeWidth="1"/><circle cx="8" cy="8" r="3" fill="white"/></svg><span className="navbar-brand">WOOZY</span>
        </div>
      </div>

      <div className="navbar-center">
        <Link 
          href="/"
          className={`navbar-link ${isActive('/') ? 'navbar-link-active' : ''}`}
        >
          HOME
        </Link>
        <Link 
          href="/tasks"
          className={`navbar-link ${isActive('/tasks') ? 'navbar-link-active' : ''}`}
        >
          TASKS
        </Link>
        <Link 
          href="/agents"
          className={`navbar-link ${isActive('/agents') ? 'navbar-link-active' : ''}`}
        >
          AGENTS{empRunning > 0 && <span className="emp-nav-badge">{empRunning}</span>}
        </Link>
        <Link 
          href="/chat"
          className={`navbar-link ${isActive('/chat') ? 'navbar-link-active' : ''}`}
        >
          CHAT
        </Link>
        <Link 
          href="/vault"
          className={`navbar-link ${isActive('/vault') ? 'navbar-link-active' : ''}`}
        >
          VAULT
        </Link>
        <Link 
          href="/finance"
          className={`navbar-link ${isActive('/finance') ? 'navbar-link-active' : ''}`}
        >
          $
        </Link>
      </div>

      <div className="navbar-right">
        <div className="navbar-time">
          {formatTime(currentTime)}
        </div>
        <div className="navbar-status">
          <span className="status-dot status-online" title="System Online"></span>
        </div>
      </div>
    </nav>
  )
}