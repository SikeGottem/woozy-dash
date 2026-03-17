'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// === MARKDOWN RENDERER ===
function MarkdownRenderer({ content }) {
  const parseMarkdown = (text) => {
    const lines = text.split('\n')
    const elements = []
    let inCodeBlock = false
    let currentCodeBlock = []
    let currentList = []

    const flushCodeBlock = () => {
      if (currentCodeBlock.length > 0) {
        elements.push({ type: 'code-block', content: currentCodeBlock.join('\n'), key: `code-${elements.length}` })
        currentCodeBlock = []
      }
    }

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push({ type: 'list', items: currentList, key: `list-${elements.length}` })
        currentList = []
      }
    }

    lines.forEach((line) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) { flushCodeBlock(); inCodeBlock = false } else { flushList(); inCodeBlock = true }
        return
      }
      if (inCodeBlock) { currentCodeBlock.push(line); return }
      if (line.startsWith('## ')) { flushList(); elements.push({ type: 'heading', level: 2, content: line.slice(3).trim(), key: `h2-${elements.length}` }); return }
      if (line.startsWith('### ')) { flushList(); elements.push({ type: 'heading', level: 3, content: line.slice(4).trim(), key: `h3-${elements.length}` }); return }
      if (line.match(/^[-*•] /)) { currentList.push(parseBoldAndInlineCode(line.replace(/^[-*•] /, '').trim())); return }
      if (line.trim()) { flushList(); elements.push({ type: 'paragraph', content: parseBoldAndInlineCode(line), key: `p-${elements.length}` }) }
      else if (elements.length > 0) { elements.push({ type: 'spacing', key: `space-${elements.length}` }) }
    })
    flushCodeBlock()
    flushList()
    return elements
  }

  const parseBoldAndInlineCode = (text) => {
    const parts = []
    let remaining = text
    let key = 0
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
      { regex: /`(.*?)`/g, type: 'code' },
      { regex: /https?:\/\/[^\s]+/g, type: 'link' }
    ]

    while (remaining.length > 0) {
      let earliestMatch = null, earliestIndex = Infinity, matchedPattern = null
      patterns.forEach(pattern => {
        pattern.regex.lastIndex = 0
        const match = pattern.regex.exec(remaining)
        if (match && match.index < earliestIndex) { earliestMatch = match; earliestIndex = match.index; matchedPattern = pattern }
      })
      if (!earliestMatch) { if (remaining.trim()) parts.push({ type: 'text', content: remaining, key: `text-${key++}` }); break }
      if (earliestIndex > 0) { const beforeText = remaining.slice(0, earliestIndex); if (beforeText.trim()) parts.push({ type: 'text', content: beforeText, key: `text-${key++}` }) }
      if (matchedPattern.type === 'link') { parts.push({ type: 'link', content: earliestMatch[0], href: earliestMatch[0], key: `link-${key++}` }) }
      else { parts.push({ type: matchedPattern.type, content: earliestMatch[1], key: `${matchedPattern.type}-${key++}` }) }
      remaining = remaining.slice(earliestMatch.index + earliestMatch[0].length)
    }
    return parts
  }

  const renderInlineElements = (elements) => {
    if (typeof elements === 'string') return elements
    return elements.map(element => {
      switch (element.type) {
        case 'bold': return <strong key={element.key}>{element.content}</strong>
        case 'code': return <code key={element.key} className="chat-inline-code">{element.content}</code>
        case 'link': return <a key={element.key} href={element.href} className="chat-link" target="_blank" rel="noopener noreferrer">{element.content}</a>
        default: return element.content
      }
    })
  }

  const renderElement = (element) => {
    switch (element.type) {
      case 'heading': { const Tag = `h${element.level}`; return <Tag key={element.key} className={`chat-heading chat-heading-${element.level}`}>{element.content}</Tag> }
      case 'code-block': return <pre key={element.key} className="chat-code-block"><code>{element.content}</code></pre>
      case 'list': return <ul key={element.key} className="chat-list">{element.items.map((item, i) => <li key={`item-${i}`} className="chat-list-item">{renderInlineElements(item)}</li>)}</ul>
      case 'paragraph': return <div key={element.key} className="chat-paragraph">{renderInlineElements(element.content)}</div>
      case 'spacing': return <div key={element.key} className="chat-spacing" />
      default: return null
    }
  }

  return <div className="chat-markdown">{parseMarkdown(content).map(renderElement)}</div>
}

function ChatMessage({ message, isUser }) {
  const [expanded, setExpanded] = useState(false)
  const content = message.content || ''
  const shouldTruncate = !isUser && content.length > 300
  const displayContent = shouldTruncate && !expanded ? content.slice(0, 300) + '...' : content
  
  const completionWords = ['done', 'completed', 'finished', 'created', 'saved', 'deployed', 'uploaded', 'submitted']
  const isCompletion = !isUser && completionWords.some(word => content.toLowerCase().includes(word) && content.length < 200)

  if (isUser) {
    return (
      <div className="chat-msg-text">
        {displayContent}
        {message.channel === 'telegram' && <span className="chat-channel">TG</span>}
      </div>
    )
  }

  if (isCompletion) {
    return (
      <div className="chat-completion-card">
        <div className="chat-completion-icon">✓</div>
        <div className="chat-completion-text">
          <MarkdownRenderer content={displayContent} />
          {shouldTruncate && <button className="chat-expand-btn" onClick={() => setExpanded(!expanded)}>{expanded ? 'show less' : 'show more'}</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="chat-msg-text">
      <MarkdownRenderer content={displayContent} />
      {shouldTruncate && <button className="chat-expand-btn" onClick={() => setExpanded(!expanded)}>{expanded ? 'show less' : 'show more'}</button>}
    </div>
  )
}

// === CHAT FILTERING ===
const AGENT_ANNOUNCEMENT_PATTERNS = [
  /sub-?agent.*(?:just completed|finished|done)/i,
  /subagent task/i,
  /Stats:\s*runtime/i,
  /sessionKey\s+agent:main:subagent:/i,
  /\bsub-?agent\b.*\bcomplete[d]?\b/i,
  /spawned.*agent.*completed/i,
  /agent:main:subagent:[a-f0-9-]+/,
  /completed.*(?:runtime|tokens|cost)/i,
]

function isAgentAnnouncement(msg) {
  if (msg.role !== 'assistant') return false
  const content = msg.content || ''
  return AGENT_ANNOUNCEMENT_PATTERNS.some(p => p.test(content))
}

// === CHAT PANEL ===
export default function ChatPanel({ externalOpen, onExternalToggle }) {
  const [open, setOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Sync with external open state from layout
  useEffect(() => {
    if (externalOpen !== undefined && externalOpen !== open) {
      if (externalOpen) setOpen(true)
      else handleToggle()
    }
  }, [externalOpen])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50) }, [open])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  const handleToggle = () => {
    if (open) {
      setIsClosing(true)
      setTimeout(() => {
        setOpen(false)
        setIsClosing(false)
        if (onExternalToggle) onExternalToggle(false)
      }, 300)
    } else {
      setOpen(true)
      if (onExternalToggle) onExternalToggle(true)
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '\\' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const isOurInput = document.activeElement === inputRef.current
        if (!isOurInput && (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')) return
        e.preventDefault()
        e.stopImmediatePropagation()
        handleToggle()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open])
  
  const mergeMessages = useCallback((serverMsgs, localMsgs) => {
    const all = [...serverMsgs, ...localMsgs]
    const seen = new Set()
    return all.filter(m => {
      const tsKey = Math.round((m.ts || 0) / 2000)
      const key = `${m.role}:${tsKey}:${(m.content || '').slice(0, 40)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => (a.ts || 0) - (b.ts || 0))
  }, [])

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('woozy-chat-backup', JSON.stringify(messages.slice(-200)))
  }, [messages])

  useEffect(() => {
    const localBackup = (() => { try { return JSON.parse(localStorage.getItem('woozy-chat-backup') || '[]') } catch { return [] } })()
    fetch('/api/history?limit=100').then(r => r.json()).then(data => {
      const merged = mergeMessages(data.messages || [], localBackup)
      setMessages(merged)
    }).catch(() => { if (localBackup.length) setMessages(localBackup) })
  }, [])

  useEffect(() => {
    if (!open) return
    const poll = setInterval(() => {
      const lastTs = messages.length > 0 ? Math.max(...messages.filter(m => m.ts).map(m => m.ts)) : 0
      fetch(`/api/history?limit=10&after=${lastTs}`).then(r => r.json()).then(data => {
        if (data.messages?.length) {
          setMessages(prev => {
            const existing = new Set(prev.map(m => `${m.role}:${m.ts}`))
            const newMsgs = data.messages.filter(m => !existing.has(`${m.role}:${m.ts}`))
            return newMsgs.length ? [...prev, ...newMsgs] : prev
          })
        }
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(poll)
  }, [open, messages])

  const pendingRef = useRef(0)
  const send = async () => {
    if (!input.trim()) return
    const text = input.trim()
    const userMsg = { role: 'user', content: text, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)
    pendingRef.current++
    setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Error', ts: Date.now() }])
    } catch (err) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: Date.now() }]) }
    pendingRef.current--
    if (pendingRef.current <= 0) { pendingRef.current = 0; setLoading(false) }
  }

  const clearHistory = () => { setMessages([]); localStorage.removeItem('woozy-chat'); localStorage.removeItem('woozy-chat-backup') }

  if (!open) return <button className="chat-fab" onClick={handleToggle}><span className="chat-fab-icon">⌘</span></button>

  return (
    <div className={`chat-panel ${isClosing ? 'closing' : ''}`}>
      <div className="chat-header">
        <span className="chat-header-title">WOOZY TERMINAL</span>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button className="chat-clear" onClick={clearHistory} title="Clear local history">⌫</button>
          <button className="chat-close" onClick={handleToggle}>✕</button>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="chat-empty">Connected to main session<br/>Same memory as Telegram</div>}
        {messages.filter(m => !isAgentAnnouncement(m)).map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`}>
            <div className="chat-msg-label">{m.role === 'user' ? '>' : ''}</div>
            <ChatMessage message={m} isUser={m.role === 'user'} />
          </div>
        ))}
        {loading && <div className="chat-msg chat-msg-bot"><div className="chat-msg-label"></div><div className="chat-msg-text chat-typing">thinking<span className="blink">_</span></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row"><span className="chat-prompt">&gt;</span><input ref={inputRef} className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="message woozy..." /></div>
    </div>
  )
}
