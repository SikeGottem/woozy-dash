'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// === GLITCH TEXT SCRAMBLE ===
const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function useGlitchText(text, active, duration = 400) {
  const [display, setDisplay] = useState(text)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!active) { setDisplay(text); return }
    const start = performance.now()
    const chars = text.split('')
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const result = chars.map((ch, i) => {
        const threshold = i / chars.length
        if (progress > threshold + 0.3) return ' '
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
      }).join('')
      setDisplay(result)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay('')
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [active, text, duration])

  return display
}

// === UNLOCK ANIMATION OVERLAY ===
function UnlockAnimation({ onComplete }) {
  const [phase, setPhase] = useState('success') // success → glitch → dissolve
  const titleText = useGlitchText('ENCRYPTED', phase === 'glitch', 350)
  const subtitleText = useGlitchText('Financial data requires authorization', phase === 'glitch', 350)
  const authText = useGlitchText('AUTHENTICATED', phase === 'glitch', 350)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('glitch'), 550)
    const t2 = setTimeout(() => setPhase('dissolve'), 950)
    const t3 = setTimeout(() => onComplete(), 1350)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  const isSuccess = phase === 'success'
  const isGlitch = phase === 'glitch'
  const isDissolve = phase === 'dissolve'

  return (
    <div className={`lock-overlay unlock-anim ${isDissolve ? 'unlock-dissolve' : ''}`}>
      <div className="lock-container">
        <svg className={`lock-icon-svg ${isSuccess ? 'unlock-icon-pulse' : ''}`}
          width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke={isSuccess ? '#22c55e' : 'currentColor'}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>

        <div className={`lock-title ${isGlitch ? 'unlock-glitch-text' : ''}`}>
          {isGlitch ? titleText : 'ENCRYPTED'}
        </div>

        <div className={`lock-subtitle ${isGlitch ? 'unlock-glitch-text' : ''}`} style={{ marginBottom: '1rem' }}>
          {isGlitch ? subtitleText : 'Financial data requires authorization'}
        </div>

        <div className={`unlock-auth-text ${isSuccess ? 'unlock-auth-visible' : ''} ${isGlitch ? 'unlock-glitch-text' : ''}`}>
          {isGlitch ? authText : 'AUTHENTICATED'}
        </div>

        {isGlitch && <div className="unlock-scanline" />}
      </div>
    </div>
  )
}

// === PIN INPUT SCREEN ===
function PinScreen({ onUnlock }) {
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

// === MAIN PINLOCK COMPONENT ===
export function PinLock({ onUnlock }) {
  const [mode, setMode] = useState('pin') // pin | unlocking

  const handlePinSuccess = useCallback(() => {
    setMode('unlocking')
  }, [])

  const handleAnimationComplete = useCallback(() => {
    onUnlock()
  }, [onUnlock])

  if (mode === 'unlocking') {
    return <UnlockAnimation onComplete={handleAnimationComplete} />
  }

  return <PinScreen onUnlock={handlePinSuccess} />
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
