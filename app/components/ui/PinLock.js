'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// === GLITCH SCRAMBLE CHARS ===
const SCRAMBLE_CHARS = '█▓▒░╔╗║╚╝●◆▲!@#$%^&*<>{}[]~±§¶∆∇≈≠∞'
function rchar() { return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] }

// ════════════════════════════════════════
// UNLOCK ANIMATION — CRT terminal style
// ════════════════════════════════════════
function UnlockAnimation({ onComplete }) {
  const [phase, setPhase] = useState('success') // success | scramble | crt
  const scrambleRef = useRef(null)
  const completeCalled = useRef(false)

  const finish = useCallback(() => {
    if (!completeCalled.current) {
      completeCalled.current = true
      onComplete()
    }
  }, [onComplete])

  // Phase timing
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('scramble'), 200)
    const t2 = setTimeout(() => setPhase('crt'), 850)
    const t3 = setTimeout(finish, 1450)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [finish])

  // Scramble effect — mutate DOM text nodes directly for performance
  useEffect(() => {
    if (phase !== 'scramble') return
    const el = scrambleRef.current
    if (!el) return

    const textNodes = []
    const walk = (node) => {
      if (node.nodeType === 3 && node.textContent.trim()) {
        textNodes.push({ node, original: node.textContent })
      } else {
        node.childNodes.forEach(walk)
      }
    }
    walk(el)

    let frame = 0
    const totalFrames = 20
    let raf
    const tick = () => {
      frame++
      const t = frame / totalFrames
      textNodes.forEach(({ node, original }) => {
        let out = ''
        for (let i = 0; i < original.length; i++) {
          if (original[i] === ' ' || original[i] === '\n') { out += original[i]; continue }
          out += Math.random() < (0.2 + t * 0.8) ? rchar() : original[i]
        }
        node.textContent = out
      })
      if (frame < totalFrames) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  return (
    <div className={`lock-overlay unlock-phase-${phase}`}>
      <div className="lock-container" ref={scrambleRef}>
        <div className={`lock-dots-main ${phase === 'success' ? 'unlock-dots-flash' : ''}`}>
          {[0,1,2,3].map(i => <div key={i} className={`lock-dot lock-dot-filled ${phase === 'success' ? 'unlock-dot-green' : ''}`} />)}
        </div>

        <div className={`unlock-grant-text ${phase === 'success' ? 'unlock-grant-visible' : ''}`}>
          ACCESS GRANTED
        </div>

        <div className="lock-title">ENCRYPTED</div>
        <div className="lock-subtitle">Financial data requires authorization</div>
      </div>

      {phase === 'crt' && <div className="unlock-crt-collapse" />}
      {phase === 'scramble' && <div className="unlock-scanline-sweep" />}
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
            fetch('/api/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: next })
              }).then(r => {
                if (r.ok) {
                  setTimeout(() => onUnlock(), 200)
                } else {
                  setError(true)
                  setTimeout(() => { setError(false); setPin('') }, 1200)
                }
              }).catch(() => {
                setError(true)
                setTimeout(() => { setError(false); setPin('') }, 1200)
              })
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
  const [mode, setMode] = useState('pin') // pin | animating

  const handlePinSuccess = useCallback(() => {
    setMode('animating')
  }, [])

  if (mode === 'animating') {
    return <UnlockAnimation onComplete={onUnlock} />
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
