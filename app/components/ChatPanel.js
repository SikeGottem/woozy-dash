'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// === CODE BLOCK WITH COPY ===
function CodeBlock({ content }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="chat-code-block-wrapper">
      <button className="chat-code-copy" onClick={handleCopy}>{copied ? 'copied' : 'copy'}</button>
      <pre className="chat-code-block"><code>{content}</code></pre>
    </div>
  )
}

// === IMAGE LIGHTBOX ===
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="chat-lightbox" onClick={onClose}>
      <img src={src} alt={alt || ''} className="chat-lightbox-img" onClick={e => e.stopPropagation()} />
      <button className="chat-lightbox-close" onClick={onClose}>✕</button>
    </div>
  )
}

// === CHAT IMAGE ===
function ChatImage({ src, alt }) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <div className="chat-image-container" onClick={() => setLightbox(true)}>
        <img src={src} alt={alt || ''} className="chat-image" loading="lazy" />
      </div>
      {lightbox && <Lightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
    </>
  )
}

// === AUDIO PLAYER ===
function ChatAudio({ src }) {
  return (
    <div className="chat-audio-container">
      <audio controls src={src} className="chat-audio" preload="metadata" />
    </div>
  )
}

// === FILE CARD ===
function FileCard({ filename, size, url }) {
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="chat-file-card">
      <span className="chat-file-icon">📄</span>
      <span className="chat-file-info">
        <span className="chat-file-name">{filename}</span>
        {size && <span className="chat-file-size">{formatSize(size)}</span>}
      </span>
    </a>
  )
}

// === MEDIA DETECTION HELPERS ===
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?$/i
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac)(\?[^\s]*)?$/i
const MEDIA_LINE_RE = /^MEDIA:\s*(.+)$/gm
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g
const RAW_URL_RE = /(?:^|\s)(https?:\/\/[^\s]+)/g
const UPLOAD_PATH_RE = /\/uploads\/[^\s]+/g

function extractMediaElements(text) {
  const elements = []
  const processedRanges = []

  // Extract MEDIA: lines
  let match
  while ((match = MEDIA_LINE_RE.exec(text)) !== null) {
    const path = match[1].trim()
    if (IMAGE_EXT_RE.test(path) || path.startsWith('data:image/')) {
      elements.push({ type: 'image', src: path, start: match.index, end: match.index + match[0].length })
    } else if (AUDIO_EXT_RE.test(path)) {
      elements.push({ type: 'audio', src: path, start: match.index, end: match.index + match[0].length })
    }
    processedRanges.push([match.index, match.index + match[0].length])
  }

  // Extract markdown images
  MD_IMAGE_RE.lastIndex = 0
  while ((match = MD_IMAGE_RE.exec(text)) !== null) {
    if (!isInRange(match.index, processedRanges)) {
      elements.push({ type: 'image', src: match[2], alt: match[1], start: match.index, end: match.index + match[0].length })
      processedRanges.push([match.index, match.index + match[0].length])
    }
  }

  // Extract raw image/audio URLs
  RAW_URL_RE.lastIndex = 0
  while ((match = RAW_URL_RE.exec(text)) !== null) {
    const url = match[1]
    if (!isInRange(match.index, processedRanges)) {
      if (IMAGE_EXT_RE.test(url)) {
        elements.push({ type: 'image', src: url, start: match.index, end: match.index + match[0].length })
        processedRanges.push([match.index, match.index + match[0].length])
      } else if (AUDIO_EXT_RE.test(url)) {
        elements.push({ type: 'audio', src: url, start: match.index, end: match.index + match[0].length })
        processedRanges.push([match.index, match.index + match[0].length])
      }
    }
  }

  // Extract /uploads/ paths
  UPLOAD_PATH_RE.lastIndex = 0
  while ((match = UPLOAD_PATH_RE.exec(text)) !== null) {
    if (!isInRange(match.index, processedRanges)) {
      const path = match[0]
      if (IMAGE_EXT_RE.test(path)) {
        elements.push({ type: 'image', src: path, start: match.index, end: match.index + match[0].length })
      } else if (AUDIO_EXT_RE.test(path)) {
        elements.push({ type: 'audio', src: path, start: match.index, end: match.index + match[0].length })
      } else {
        elements.push({ type: 'file', url: path, filename: path.split('/').pop(), start: match.index, end: match.index + match[0].length })
      }
      processedRanges.push([match.index, match.index + match[0].length])
    }
  }

  return elements
}

function isInRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end)
}

function stripMediaFromText(text, elements) {
  let result = text
  // Remove media references from text (process in reverse to preserve indices)
  const sorted = [...elements].sort((a, b) => b.start - a.start)
  for (const el of sorted) {
    result = result.slice(0, el.start) + result.slice(el.end)
  }
  return result.trim()
}

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
      case 'code-block': return <CodeBlock key={element.key} content={element.content} />
      case 'list': return <ul key={element.key} className="chat-list">{element.items.map((item, i) => <li key={`item-${i}`} className="chat-list-item">{renderInlineElements(item)}</li>)}</ul>
      case 'paragraph': return <div key={element.key} className="chat-paragraph">{renderInlineElements(element.content)}</div>
      case 'spacing': return <div key={element.key} className="chat-spacing" />
      default: return null
    }
  }

  return <div className="chat-markdown">{parseMarkdown(content).map(renderElement)}</div>
}

// === RICH MESSAGE (with media) ===
function RichContent({ content }) {
  const mediaElements = extractMediaElements(content)
  const cleanText = stripMediaFromText(content, mediaElements)

  return (
    <>
      {cleanText && <MarkdownRenderer content={cleanText} />}
      {mediaElements.map((el, i) => {
        if (el.type === 'image') return <ChatImage key={`media-${i}`} src={el.src} alt={el.alt} />
        if (el.type === 'audio') return <ChatAudio key={`media-${i}`} src={el.src} />
        if (el.type === 'file') return <FileCard key={`media-${i}`} filename={el.filename} url={el.url} />
        return null
      })}
    </>
  )
}

function ChatMessage({ message, isUser }) {
  const [expanded, setExpanded] = useState(false)
  const content = message.content || ''
  const shouldTruncate = !isUser && content.length > 300
  const displayContent = shouldTruncate && !expanded ? content.slice(0, 300) + '...' : content
  
  const completionWords = ['done', 'completed', 'finished', 'created', 'saved', 'deployed', 'uploaded', 'submitted']
  const isCompletion = !isUser && completionWords.some(word => content.toLowerCase().includes(word) && content.length < 200)

  // Check if message has attachments
  const attachments = message.attachments || []

  if (isUser) {
    return (
      <div className="chat-msg-text">
        {displayContent}
        {attachments.map((att, i) => (
          att.isImage
            ? <ChatImage key={`att-${i}`} src={att.url} alt={att.filename} />
            : <FileCard key={`att-${i}`} filename={att.filename} size={att.size} url={att.url} />
        ))}
        {message.channel === 'telegram' && <span className="chat-channel">TG</span>}
      </div>
    )
  }

  if (isCompletion) {
    return (
      <div className="chat-completion-card">
        <div className="chat-completion-icon">✓</div>
        <div className="chat-completion-text">
          <RichContent content={displayContent} />
          {shouldTruncate && <button className="chat-expand-btn" onClick={() => setExpanded(!expanded)}>{expanded ? 'show less' : 'show more'}</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="chat-msg-text">
      <RichContent content={displayContent} />
      {shouldTruncate && <button className="chat-expand-btn" onClick={() => setExpanded(!expanded)}>{expanded ? 'show less' : 'show more'}</button>}
    </div>
  )
}

// === ATTACHMENT PREVIEW ===
function AttachmentPreview({ attachments, onRemove }) {
  if (!attachments.length) return null
  return (
    <div className="chat-attachment-strip">
      {attachments.map((att, i) => (
        <div key={i} className="chat-attachment-preview">
          {att.isImage
            ? <img src={att.dataUrl || att.url} alt={att.filename} className="chat-attachment-thumb" />
            : <div className="chat-attachment-file-thumb">📄</div>
          }
          <span className="chat-attachment-name">{att.filename}</span>
          <button className="chat-attachment-remove" onClick={() => onRemove(i)}>✕</button>
        </div>
      ))}
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

// === UPLOAD HELPER ===
async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Upload failed') }
  return res.json()
}

// === CHAT PANEL ===
export default function ChatPanel({ externalOpen, onExternalToggle }) {
  const [open, setOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (externalOpen !== undefined && externalOpen !== open) {
      if (externalOpen) setOpen(true)
      else handleToggle()
    }
  }, [externalOpen])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [dragging, setDragging] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const dragCounter = useRef(0)
  const fileInputRef = useRef(null)

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

  // === PASTE HANDLER ===
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file') {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          addFileAttachment(file)
        }
      }
    }
    const panel = panelRef.current
    if (panel) panel.addEventListener('paste', handler)
    return () => { if (panel) panel.removeEventListener('paste', handler) }
  }, [open, attachments])

  // === DRAG AND DROP ===
  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer?.types?.includes('Files')) setDragging(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false) }
  }
  const handleDragOver = (e) => { e.preventDefault() }
  const handleDrop = (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const files = e.dataTransfer?.files
    if (files) for (const file of files) addFileAttachment(file)
  }

  const addFileAttachment = (file) => {
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments(prev => [...prev, { file, filename: file.name, size: file.size, isImage: true, dataUrl: reader.result }])
      }
      reader.readAsDataURL(file)
    } else {
      setAttachments(prev => [...prev, { file, filename: file.name, size: file.size, isImage: false }])
    }
  }

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

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
    if (!input.trim() && !attachments.length) return
    const text = input.trim()

    // Upload attachments first
    let uploadedAttachments = []
    for (const att of attachments) {
      try {
        const result = await uploadFile(att.file)
        uploadedAttachments.push(result)
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }

    // Build message text with attachment references
    let messageText = text
    for (const att of uploadedAttachments) {
      if (att.isImage) {
        messageText += (messageText ? '\n' : '') + `![${att.filename}](${att.url})`
      } else {
        messageText += (messageText ? '\n' : '') + `[${att.filename}](${att.url})`
      }
    }

    const userMsg = {
      role: 'user',
      content: text || (uploadedAttachments.length ? `[${uploadedAttachments.length} attachment(s)]` : ''),
      ts: Date.now(),
      attachments: uploadedAttachments
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachments([])
    setTimeout(() => inputRef.current?.focus(), 0)
    pendingRef.current++
    setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: messageText }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Error', ts: Date.now() }])
    } catch (err) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: Date.now() }]) }
    pendingRef.current--
    if (pendingRef.current <= 0) { pendingRef.current = 0; setLoading(false) }
  }

  const clearHistory = () => { setMessages([]); localStorage.removeItem('woozy-chat'); localStorage.removeItem('woozy-chat-backup') }

  if (!open) return <button className="chat-fab" onClick={handleToggle}><span className="chat-fab-icon">⌘</span></button>

  return (
    <div
      className={`chat-panel ${isClosing ? 'closing' : ''}`}
      ref={panelRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
      {dragging && (
        <div className="chat-drop-zone">
          <span className="chat-drop-text">Drop file</span>
        </div>
      )}
      <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />
      <div className="chat-input-row">
        <button className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">⊕</button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          multiple
          onChange={(e) => { for (const f of e.target.files) addFileAttachment(f); e.target.value = '' }}
        />
        <span className="chat-prompt">&gt;</span>
        <input ref={inputRef} className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="message woozy..." />
      </div>
    </div>
  )
}
