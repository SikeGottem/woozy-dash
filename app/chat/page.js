'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Calendar, Mail, Bot, FileText, X, ArrowLeft, Paperclip } from 'lucide-react'
import { 
  formatRelativeTime, 
  truncateText, 
  uploadFile,
  RichContent,
  AttachmentPreview
} from '../components/chat/shared'

// === CONVERSATION ITEM ===
function ConversationItem({ conversation, isActive, onClick, onClose }) {
  const { id, name, status, lastMessage, unreadCount, lastActiveTime } = conversation
  
  const statusDot = status === 'running' ? 'wchat-conv-status-running' : 'wchat-conv-status-complete'
  const timeStr = formatRelativeTime(lastActiveTime || Date.now())
  
  return (
    <div 
      className={`wchat-conv-item ${isActive ? 'wchat-conv-active' : ''}`}
      onClick={onClick}
    >
      <div className="wchat-conv-header">
        <div className="wchat-conv-name">
          {id === 'main' && <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4, verticalAlign: 'middle' }}><circle cx="8" cy="8" r="7.5" stroke="white" strokeWidth="1"/><circle cx="8" cy="8" r="3" fill="white"/></svg> </>}
          {name}
        </div>
        {id !== 'main' && (
          <button 
            className="wchat-conv-close"
            onClick={(e) => { e.stopPropagation(); onClose(id) }}
          >
            <X size={12} />
          </button>
        )}
      </div>
      
      <div className="wchat-conv-meta">
        <div className={`wchat-conv-status-dot ${statusDot}`} />
        <div className="wchat-conv-preview">
          {lastMessage ? truncateText(lastMessage, 40) : 'No messages'}
        </div>
      </div>
      
      <div className="wchat-conv-bottom">
        <div className="wchat-conv-time">{timeStr}</div>
        {unreadCount > 0 && (
          <div className="wchat-conv-unread">{unreadCount}</div>
        )}
      </div>
    </div>
  )
}

// === MESSAGE COMPONENT ===
function WchatMessage({ message, isUser, agentName }) {
  const content = message.content || ''
  const timeStr = message.ts ? formatRelativeTime(message.ts) : ''
  
  return (
    <div className={`wchat-message ${isUser ? 'wchat-message-user' : 'wchat-message-assistant'}`}>
      <div className="wchat-message-meta">
        <span className="wchat-message-agent">{agentName}</span>
        <span className="wchat-message-time">{timeStr}</span>
      </div>
      
      <div className="wchat-message-bubble">
        <div className="wchat-message-content">
          {isUser ? (
            <div>{content}</div>
          ) : (
            <RichContent content={content} stylePrefix="wchat" />
          )}
          
          {/* Handle attachments */}
          {message.attachments?.map((att, i) => (
            <div key={`att-${i}`} className="wchat-attachment-display">
              {att.isImage ? (
                <img src={att.url} alt={att.filename} className="wchat-attached-image" />
              ) : (
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="wchat-attached-file">
                  <FileText size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {att.filename}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// === AMBIENT AWARENESS COMPONENT ===
function AmbientStatus() {
  const [status, setStatus] = useState({
    email: null,
    calendar: null,
    agents: 0
  })

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [heartbeatRes, eventRes, agentsRes] = await Promise.all([
          fetch('/api/data?key=heartbeat-state').catch(() => null),
          fetch('/api/data?key=next-event').catch(() => null),
          fetch('/api/agents').catch(() => null)
        ])

        const heartbeat = heartbeatRes ? await heartbeatRes.json() : null
        const event = eventRes ? await eventRes.json() : null
        const agents = agentsRes ? await agentsRes.json() : null

        const emailTime = heartbeat?.lastChecks?.email
        const emailStr = emailTime ? formatRelativeTime(emailTime) : 'never'

        setStatus({
          email: emailStr,
          calendar: event?.event || 'No events',
          agents: agents?.agents?.length || 0
        })
      } catch (err) {
        console.error('Failed to fetch ambient status:', err)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Update every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="wchat-status-strip">
      <div className="wchat-status-item">
        <span><Mail size={13} /></span>
        <span>{status.email}</span>
      </div>
      <span className="wchat-status-separator">·</span>
      <div className="wchat-status-item">
        <span><Calendar size={13} /></span>
        <span>{status.calendar}</span>
      </div>
      <span className="wchat-status-separator">·</span>
      <div className="wchat-status-item">
        <span><Bot size={13} /></span>
        <span>{status.agents} agents</span>
      </div>
    </div>
  )
}

// === SMART TYPING INDICATOR ===
function SmartTypingIndicator() {
  const [currentStatus, setCurrentStatus] = useState(0)
  const statuses = ['reading files...', 'thinking...', 'composing...']

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStatus(prev => (prev + 1) % statuses.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="wchat-message wchat-message-assistant">
      <div className="wchat-message-meta">
        <span className="wchat-message-agent">Assistant</span>
      </div>
      <div className="wchat-message-bubble wchat-smart-typing">
        <span className="wchat-status-cycle">{statuses[currentStatus]}</span>
        <span className="blink">_</span>
      </div>
    </div>
  )
}

// === MAIN CHAT PAGE ===
export default function ChatPage() {
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState('main')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [dragging, setDragging] = useState(false)
  
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const pageRef = useRef(null)
  const dragCounter = useRef(0)
  const fileInputRef = useRef(null)
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load conversations (main + sub-agents)
  const loadConversations = useCallback(async () => {
    try {
      const [historyRes, agentsRes] = await Promise.all([
        fetch('/api/history?limit=1'),
        fetch('/api/agents')
      ])
      
      const historyData = await historyRes.json()
      const agentsData = await agentsRes.json()
      
      const mainConv = {
        id: 'main',
        name: 'Woozy',
        status: 'running',
        lastMessage: historyData.messages?.[0]?.content || null,
        unreadCount: 0,
        lastActiveTime: historyData.messages?.[0]?.ts || Date.now(),
        sessionKey: 'main'
      }
      
      const subAgentConvs = (agentsData.agents || [])
        .filter(agent => agent.status === 'running' || (Date.now() - (agent.lastActiveTime || 0)) < 5 * 60 * 1000)
        .map(agent => ({
          id: agent.id,
          name: agent.name || agent.id,
          status: agent.status,
          lastMessage: agent.lastMessage || null,
          unreadCount: 0,
          lastActiveTime: agent.lastActiveTime || Date.now(),
          sessionKey: agent.sessionKey
        }))
      
      setConversations([mainConv, ...subAgentConvs])
    } catch (error) {
      console.error('Failed to load conversations:', error)
      // Fallback to just main conversation
      setConversations([{
        id: 'main',
        name: 'Woozy',
        status: 'running',
        lastMessage: null,
        unreadCount: 0,
        lastActiveTime: Date.now(),
        sessionKey: 'main'
      }])
    }
  }, [])

  // Load messages for active conversation
  const loadMessages = useCallback(async (conversationId) => {
    if (conversationId === 'main') {
      try {
        const res = await fetch('/api/history?limit=100')
        const data = await res.json()
        setMessages(data.messages || [])
      } catch (error) {
        console.error('Failed to load main messages:', error)
        setMessages([])
      }
    } else {
      try {
        const res = await fetch(`/api/agents?detail=${conversationId}`)
        const data = await res.json()
        setMessages(data.transcript || [])
      } catch (error) {
        console.error('Failed to load sub-agent messages:', error)
        setMessages([])
      }
    }
  }, [])

  // Load initial data
  useEffect(() => {
    loadConversations()
    loadMessages(activeConversationId)
  }, [activeConversationId, loadConversations, loadMessages])

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations()
      loadMessages(activeConversationId)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [activeConversationId, loadConversations, loadMessages])

  // Handle conversation selection
  const handleConversationSelect = (conversationId) => {
    setActiveConversationId(conversationId)
  }

  // Handle conversation close
  const handleConversationClose = (conversationId) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId))
    if (activeConversationId === conversationId) {
      setActiveConversationId('main')
    }
  }

  // Drag and drop handlers
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

  // Paste handler
  useEffect(() => {
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
    const page = pageRef.current
    if (page) page.addEventListener('paste', handler)
    return () => { if (page) page.removeEventListener('paste', handler) }
  }, [])

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

  // Send message
  const sendMessage = async () => {
    if (!input.trim() && !attachments.length) return

    const text = input.trim()
    const conversation = conversations.find(c => c.id === activeConversationId)
    
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

    setLoading(true)
    try {
      const payload = { message: messageText }
      if (conversation?.sessionKey && conversation.sessionKey !== 'main') {
        payload.sessionKey = conversation.sessionKey
      }
      
      const res = await fetch('/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      })
      
      const data = await res.json()
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.reply || data.error || 'Error', 
        ts: Date.now() 
      }])
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err.message}`, 
        ts: Date.now() 
      }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const activeConversation = conversations.find(c => c.id === activeConversationId)

  return (
    <div 
      className="wchat-page"
      ref={pageRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="wchat-header">
        <div className="wchat-header-left">
          <Link href="/" className="wchat-back-link">
            <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to Dashboard
          </Link>
        </div>
        <div className="wchat-header-title">
          WOOZY CHAT
        </div>
        <div className="wchat-header-right">
          {/* Empty for balance */}
        </div>
      </div>

      {/* Ambient awareness status strip */}
      <AmbientStatus />

      {/* Main content with sidebar */}
      <div className="wchat-content">
        {/* Sidebar */}
        <div className="wchat-sidebar">
          <div className="wchat-sidebar-header">
            <span className="wchat-sidebar-title">CONVERSATIONS</span>
          </div>
          
          <div className="wchat-conversations">
            {conversations.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onClick={() => handleConversationSelect(conversation.id)}
                onClose={handleConversationClose}
              />
            ))}
          </div>
        </div>

        {/* Main chat area */}
        <div className="wchat-main">
          {/* Messages */}
          <div className="wchat-messages">
            {messages.length === 0 ? (
              <div className="wchat-empty">
                <div className="wchat-empty-title">
                  {activeConversationId === 'main' ? 'WOOZY WEBCHAT' : activeConversation?.name || 'Chat'}
                </div>
                <div className="wchat-empty-subtitle">
                  {activeConversationId === 'main' 
                    ? 'Clean conversation · Interactive artifacts' 
                    : 'Sub-agent conversation'}
                </div>
                <div className="wchat-empty-hint">Start typing to begin...</div>
              </div>
            ) : (
              messages.map((message, i) => (
                <WchatMessage
                  key={i}
                  message={message}
                  isUser={message.role === 'user'}
                  agentName={message.role === 'user' ? 'You' : (activeConversation?.name || 'Assistant')}
                />
              ))
            )}
            
            {loading && <SmartTypingIndicator />}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Drop zone overlay */}
          {dragging && (
            <div className="wchat-drop-zone">
              <span className="wchat-drop-text">Drop files here</span>
            </div>
          )}

          {/* Attachment preview */}
          <AttachmentPreview 
            attachments={attachments} 
            onRemove={removeAttachment} 
            stylePrefix="wchat" 
          />

          {/* Input */}
          <div className="wchat-input-container">
            <button 
              className="wchat-attach-btn" 
              onClick={() => fileInputRef.current?.click()} 
              title="Attach file"
            >
              <Paperclip size={15} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              multiple
              onChange={(e) => { for (const f of e.target.files) addFileAttachment(f); e.target.value = '' }}
            />
            <span className="wchat-prompt">&gt;</span>
            <input
              ref={inputRef}
              className="wchat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`message ${activeConversation?.name?.toLowerCase() || 'woozy'}...`}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}