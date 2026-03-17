'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const GLITCH_CHARS = '█▓▒░╔╗║╚╝●◆▲!@#$%^&*<>{}[]~±§¶∆∇≈≠∞'

function randomChar() {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
}

export default function UnlockAnimation({ onComplete, mode = 'pin' }) {
  const containerRef = useRef(null)
  const [phase, setPhase] = useState('success') // success | scramble | collapse
  const completeCalled = useRef(false)

  const finish = useCallback(() => {
    if (!completeCalled.current) {
      completeCalled.current = true
      onComplete()
    }
  }, [onComplete])

  // Phase 1: Success flash (0-200ms)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('scramble'), 200)
    const t2 = setTimeout(() => setPhase('collapse'), 800)
    const t3 = setTimeout(finish, 1400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [finish])

  // Phase 2: Scramble effect (200-800ms)
  useEffect(() => {
    if (phase !== 'scramble') return
    const el = containerRef.current
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
    const maxFrames = 18
    let raf
    const animate = () => {
      frame++
      // Accelerating scramble: more chars replaced each frame
      const intensity = Math.min(frame / maxFrames, 1)
      textNodes.forEach(({ node, original }) => {
        let result = ''
        for (let i = 0; i < original.length; i++) {
          if (original[i] === ' ' || original[i] === '\n') {
            result += original[i]
          } else if (Math.random() < 0.3 + intensity * 0.7) {
            result += randomChar()
          } else {
            result += original[i]
          }
        }
        node.textContent = result
      })
      if (frame < maxFrames) {
        raf = requestAnimationFrame(animate)
      }
    }
    raf = requestAnimationFrame(animate)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [phase])

  return (
    <div className={`unlock-anim unlock-anim--${phase}`}>
      <div className="unlock-anim-content" ref={containerRef}>
        {/* Success flash text */}
        <div className={`unlock-anim-status ${phase === 'success' ? 'unlock-anim-status--visible' : ''}`}>
          {mode === 'touchid' ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="unlock-anim-icon">
              <path d="M18.9 7a8 8 0 0 0-5.3-3.8A8 8 0 0 0 4 8.4" />
              <path d="M12 2.5A8 8 0 0 1 20 9" />
              <path d="M2 11.5a6.5 6.5 0 0 1 4-5.3" />
              <path d="M6.7 7.5a5.5 5.5 0 0 1 10.6 2" />
              <path d="M12 6a4 4 0 0 0-4 4c0 2.2.6 4.3 1.7 6.2" />
              <path d="M12 6a4 4 0 0 1 4 4c0 3.5-1.2 6.8-3.3 9.3" />
              <path d="M12 10c0 4-1.5 7.8-4 10.5" />
              <path d="M16.3 13a12 12 0 0 1-1 5.2" />
              <path d="M20 16a17 17 0 0 1-.8 2.5" />
            </svg>
          ) : (
            <div className="unlock-anim-dots">
              <div className="unlock-anim-dot unlock-anim-dot--filled" />
              <div className="unlock-anim-dot unlock-anim-dot--filled" />
              <div className="unlock-anim-dot unlock-anim-dot--filled" />
              <div className="unlock-anim-dot unlock-anim-dot--filled" />
            </div>
          )}
          <div className="unlock-anim-grant">ACCESS GRANTED</div>
          <div className="unlock-anim-subtext">Decrypting financial data...</div>
        </div>
      </div>

      {/* CRT scanline overlay during collapse */}
      {phase === 'collapse' && <div className="unlock-anim-scanline" />}
    </div>
  )
}
