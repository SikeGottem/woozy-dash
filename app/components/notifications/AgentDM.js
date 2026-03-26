'use client'
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'

export default function AgentDM() {
  const { dmAgent, closeDm } = useNotifications()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const inputRef = useRef(null)
  const endRef = useRef(null)

  // Load agent transcript on open
  useEffect(() => {
    if (!dmAgent) { setMessages([]); setLoadingHistory(true); return }
    setLoadingHistory(true)
    fetch(`/api/agents?detail=${dmAgent.id}`)
      .then(r => r.json())
      .then(data => {
        const transcript = data.agent?.transcript || []
        // Show last 20 messages
        const recent = transcript.slice(-20).map(m => ({
          role: m.role,
          content: m.content || '',
          ts: m.ts || Date.now(),
        }))
        setMessages(recent)
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [dmAgent])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close on Escape
  useEffect(() => {
    if (!dmAgent) return
    const handler = (e) => { if (e.key === 'Escape') closeDm() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dmAgent, closeDm])

  const send = async () => {
    if (!input.trim() || loading || !dmAgent) return
    const text = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: text, ts: Date.now() }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionKey: dmAgent.sessionKey,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || data.error || 'Error',
        ts: Date.now(),
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: Date.now() }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  if (!dmAgent) return null

  return (
    <div className="dm-panel">
      <div className="dm-header">
        <span className="dm-header-title">DM: {dmAgent.name}</span>
        <button className="dm-close" onClick={closeDm}><X size={14} /></button>
      </div>
      <div className="dm-messages">
        {loadingHistory && <div className="dm-loading">Loading transcript...</div>}
        {messages.map((m, i) => (
          <div key={i} className={`dm-msg ${m.role === 'user' ? 'dm-msg-user' : 'dm-msg-bot'}`}>
            <div className="dm-msg-label">{m.role === 'user' ? '>' : ''}</div>
            <div className="dm-msg-text">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="dm-msg dm-msg-bot">
            <div className="dm-msg-label"></div>
            <div className="dm-msg-text dm-typing">thinking<span className="blink">_</span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="dm-input-row">
        <span className="dm-prompt">&gt;</span>
        <input
          ref={inputRef}
          className="dm-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={`message ${dmAgent.name}...`}
        />
      </div>
    </div>
  )
}
