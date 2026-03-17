'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// === FINGERPRINT SVG ===
function FingerprintIcon({ size = 48, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: color || '#fff' }}>
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
  )
}

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
      // Each character "resolves" to nothing at its own threshold
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
function UnlockAnimation({ variant, onComplete }) {
  // variant: 'touchid' | 'pin'
  const [phase, setPhase] = useState('success') // success → glitch → dissolve
  const titleText = useGlitchText(
    variant === 'touchid' ? 'AUTHENTICATE' : 'ENCRYPTED',
    phase === 'glitch',
    350
  )
  const subtitleText = useGlitchText(
    variant === 'touchid' ? 'Touch ID to unlock finance' : 'Financial data requires authorization',
    phase === 'glitch',
    350
  )
  const authText = useGlitchText('AUTHENTICATED', phase === 'glitch', 350)

  useEffect(() => {
    // Phase 1: Show success (green pulse + AUTHENTICATED) for 500ms
    const t1 = setTimeout(() => setPhase('glitch'), 550)
    // Phase 2: Glitch/scramble for 400ms, then dissolve
    const t2 = setTimeout(() => setPhase('dissolve'), 950)
    // Phase 3: Fully dissolved, call onComplete
    const t3 = setTimeout(() => onComplete(), 1350)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  const isSuccess = phase === 'success'
  const isGlitch = phase === 'glitch'
  const isDissolve = phase === 'dissolve'

  return (
    <div className={`lock-overlay unlock-anim ${isDissolve ? 'unlock-dissolve' : ''}`}>
      <div className="lock-container">
        {variant === 'touchid' ? (
          <div className={`touchid-icon ${isSuccess ? 'unlock-icon-pulse' : ''}`}>
            <FingerprintIcon size={48} color={isSuccess ? '#22c55e' : '#fff'} />
          </div>
        ) : (
          <svg className={`lock-icon-svg ${isSuccess ? 'unlock-icon-pulse' : ''}`}
            width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke={isSuccess ? '#22c55e' : 'currentColor'}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        )}

        <div className={`lock-title ${isGlitch ? 'unlock-glitch-text' : ''}`}>
          {isGlitch ? titleText : (variant === 'touchid' ? 'AUTHENTICATE' : 'ENCRYPTED')}
        </div>

        <div className={`lock-subtitle ${isGlitch ? 'unlock-glitch-text' : ''}`} style={{ marginBottom: '1rem' }}>
          {isGlitch ? subtitleText : (variant === 'touchid' ? 'Touch ID to unlock finance' : 'Financial data requires authorization')}
        </div>

        {/* AUTHENTICATED text */}
        <div className={`unlock-auth-text ${isSuccess ? 'unlock-auth-visible' : ''} ${isGlitch ? 'unlock-glitch-text' : ''}`}>
          {isGlitch ? authText : 'AUTHENTICATED'}
        </div>

        {/* Scanline effect during glitch */}
        {isGlitch && <div className="unlock-scanline" />}
      </div>
    </div>
  )
}

// === WEBAUTHN HELPERS ===
const CREDENTIAL_KEY = 'woozy_webauthn_cred'

function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function base64ToBuffer(b64) {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

function randomChallenge() {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return buf
}

async function checkBiometricAvailable() {
  try {
    if (!window.PublicKeyCredential) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

async function registerCredential() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Woozy Dashboard', id: location.hostname },
      user: {
        id: new Uint8Array([1]),
        name: 'woozy-user',
        displayName: 'Woozy User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  })
  const credId = bufferToBase64(credential.rawId)
  localStorage.setItem(CREDENTIAL_KEY, credId)
  return credId
}

async function authenticateCredential(credId) {
  await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{
        id: base64ToBuffer(credId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  return true
}

// === TOUCH ID SCREEN ===
function TouchIdScreen({ onSuccess, onFallback }) {
  const [status, setStatus] = useState('ready') // ready | prompting | error
  const failCount = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const attemptAuth = useCallback(async () => {
    if (!mounted.current) return
    setStatus('prompting')
    try {
      const storedCred = localStorage.getItem(CREDENTIAL_KEY)
      if (storedCred) {
        await authenticateCredential(storedCred)
      } else {
        await registerCredential()
      }
      if (mounted.current) onSuccess()
    } catch (e) {
      if (!mounted.current) return
      failCount.current++
      if (failCount.current >= 3) {
        onFallback()
      } else {
        setStatus('error')
      }
    }
  }, [onSuccess, onFallback])

  // Auto-trigger on mount
  useEffect(() => {
    const t = setTimeout(attemptAuth, 300)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lock-overlay touchid-screen">
      <div className="lock-container">
        <div className="touchid-icon">
          <FingerprintIcon size={48} />
        </div>
        <div className="lock-title">AUTHENTICATE</div>
        <div className="lock-subtitle" style={{ marginBottom: '2rem' }}>
          {status === 'prompting' ? 'Waiting for Touch ID...' :
           status === 'error' ? 'Authentication failed — try again' :
           'Touch ID to unlock finance'}
        </div>
        <button className="touchid-btn" onClick={attemptAuth} disabled={status === 'prompting'}>
          {status === 'prompting' ? 'Waiting...' : 'Use Touch ID'}
        </button>
        <div className="touchid-fallback" onClick={onFallback}>
          or use passcode
        </div>
      </div>
    </div>
  )
}

// === PIN INPUT SCREEN ===
function PinScreen({ onUnlock, fadeIn }) {
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
    <div className={`lock-overlay ${fadeIn ? 'touchid-fade-in' : ''}`}>
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
  const [mode, setMode] = useState('checking') // checking | touchid | pin | unlocking
  const [unlockVariant, setUnlockVariant] = useState('pin') // which screen triggered unlock
  const [fadeToPinFromTouchId, setFadeToPinFromTouchId] = useState(false)

  useEffect(() => {
    checkBiometricAvailable().then(available => {
      setMode(available ? 'touchid' : 'pin')
    })
  }, [])

  const handleAuthSuccess = useCallback((variant) => {
    setUnlockVariant(variant)
    setMode('unlocking')
  }, [])

  const handleTouchIdSuccess = useCallback(() => {
    handleAuthSuccess('touchid')
  }, [handleAuthSuccess])

  const handlePinSuccess = useCallback(() => {
    handleAuthSuccess('pin')
  }, [handleAuthSuccess])

  const handleAnimationComplete = useCallback(() => {
    onUnlock()
  }, [onUnlock])

  const handleFallbackToPin = useCallback(() => {
    setFadeToPinFromTouchId(true)
    setMode('pin')
  }, [])

  if (mode === 'checking') {
    return (
      <div className="lock-overlay">
        <div className="lock-container">
          <div className="lock-subtitle">Initializing...</div>
        </div>
      </div>
    )
  }

  if (mode === 'unlocking') {
    return <UnlockAnimation variant={unlockVariant} onComplete={handleAnimationComplete} />
  }

  if (mode === 'touchid') {
    return <TouchIdScreen onSuccess={handleTouchIdSuccess} onFallback={handleFallbackToPin} />
  }

  return <PinScreen onUnlock={handlePinSuccess} fadeIn={fadeToPinFromTouchId} />
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
