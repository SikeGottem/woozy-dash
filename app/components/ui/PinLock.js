'use client'
import { useState, useEffect } from 'react'

export function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => { const i = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500); return () => clearInterval(i) }, [])

  useEffect(() => {
    const handler = (e) => {
      if (error) return
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          const next = (prev + e.key).slice(0, 4)
          if (next.length === 4) {
            if (next === '2238') {
              setTimeout(() => onUnlock(), 200)
            } else {
              setError(true)
              setTimeout(() => { setError(false); setPin('') }, 1200)
            }
          }
          return next
        })
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [error, onUnlock])

  return (
    <div className="lock-overlay">
      <div className="lock-container">
        <svg className="lock-icon-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div className="lock-title">ENCRYPTED</div>
        <div className="lock-subtitle">Financial data requires authorization{dots}</div>
        <div className={`lock-dots-main ${error ? 'lock-error' : ''}`}>
          {[0,1,2,3].map(i => <div key={i} className={`lock-dot ${pin.length > i ? 'lock-dot-filled' : ''} ${error ? 'lock-dot-error' : ''}`} />)}
        </div>
        {error && <div className="lock-error-msg">ACCESS DENIED</div>}
      </div>
    </div>
  )
}

export function DecryptReveal({ children, unlocked }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { 
    if (unlocked) { const t = setTimeout(() => setRevealed(true), 100); return () => clearTimeout(t) } 
    else { setRevealed(false) }
  }, [unlocked])
  if (!unlocked) return null
  return <div className={`decrypt ${revealed ? 'decrypted' : ''}`}>{children}</div>
}
