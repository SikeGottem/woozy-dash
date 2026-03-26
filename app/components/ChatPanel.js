'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, Command, X, Paperclip } from 'lucide-react'
import { 
  formatRelativeTime, 
  truncateText, 
  uploadFile,
  RichContent,
  AttachmentPreview,
  ImageComponent,
  AudioComponent,
  FileCard
} from './chat/shared'

// Shared components are imported from ./chat/shared.js

// Shared utilities and components are imported from ./chat/shared.js

function getMessageSummary(content) {
  if (!content || content.length <= 200) return null
  
  // Try to extract first sentence
  const firstSentence = content.match(/^[^.!?]*[.!?]/)?.[0]
  if (firstSentence && firstSentence.length < 100) {
    return firstSentence.trim()
  }
  
  // Fall back to first 100 chars + ellipsis
  const words = content.split(' ')
  let summary = ''
  for (const word of words) {
    if (summary.length + word.length > 100) break
    summary += (summary ? ' ' : '') + word
  }
  return summary + '...'
}

// === CONVERSATION ITEM ===
function ConversationItem({ conversation, isActive, onClick, onClose }) {
  const { id, name, status, lastMessage, unreadCount, lastActiveTime } = conversation
  
  const statusDot = status === 'running' ? 'chat-conv-status-running' : 'chat-conv-status-complete'
  const timeStr = formatRelativeTime(lastActiveTime || Date.now())
  
  return (
    <div 
      className={`chat-conv-item ${isActive ? 'chat-conv-active' : ''}`}
      onClick={onClick}
    >
      <div className="chat-conv-header">
        <div className="chat-conv-name">
          {id === 'main' && <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4, verticalAlign: 'middle' }}><circle cx="8" cy="8" r="7.5" stroke="white" strokeWidth="1"/><circle cx="8" cy="8" r="3" fill="white"/></svg> </>}
          {name}
        </div>
        {id !== 'main' && (
          <button 
            className="chat-conv-close"
            onClick={(e) => { e.stopPropagation(); onClose(id) }}
          >
            <X size={12} />
          </button>
        )}
      </div>
      
      <div className="chat-conv-meta">
        <div className={`chat-conv-status-dot ${statusDot}`} />
        <div className="chat-conv-preview">
          {lastMessage ? truncateText(lastMessage, 40) : 'No messages'}
        </div>
      </div>
      
      <div className="chat-conv-bottom">
        <div className="chat-conv-time">{timeStr}</div>
        {unreadCount > 0 && (
          <div className="chat-conv-unread">{unreadCount}</div>
        )}
      </div>
    </div>
  )
}

// === MESSAGE COMPONENT ===
function ChatMessage({ message, isUser, agentName }) {
  const [expanded, setExpanded] = useState(false)
  const content = message.content || ''
  
  // Only collapse very long assistant messages (>800 chars)
  const isLong = !isUser && content.length > 800
  const summary = isLong ? getMessageSummary(content) : null
  
  // Completion detection
  const completionWords = ['done', 'completed', 'finished', 'created', 'saved', 'deployed', 'uploaded', 'submitted']
  const isCompletion = !isUser && completionWords.some(word => content.toLowerCase().includes(word) && content.length < 200)
  
  const timeStr = message.ts ? formatRelativeTime(message.ts) : ''
  
  if (isCompletion) {
    return (
      <div className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-assistant'}`}>
        <div className="chat-message-meta">
          <span className="chat-message-agent">{agentName}</span>
          <span className="chat-message-time">{timeStr}</span>
        </div>
        <div className="chat-completion-card">
          <div className="chat-completion-icon"><CheckCircle size={16} color="#22c55e" /></div>
          <div className="chat-completion-text">
            <RichContent content={content} stylePrefix="chat" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-assistant'}`}>
      <div className="chat-message-meta">
        <span className="chat-message-agent">{agentName}</span>
        <span className="chat-message-time">{timeStr}</span>
      </div>
      
      <div className="chat-message-bubble">
        <div className="chat-message-content">
          {isLong && !expanded ? (
            <>
              {isUser ? (
                <div>{summary}</div>
              ) : (
                <RichContent content={summary} stylePrefix="chat" />
              )}
              <button 
                className="chat-expand-btn" 
                onClick={() => setExpanded(true)}
              >
                show more ({Math.round(content.length / 1000)}k chars)
              </button>
            </>
          ) : (
            <>
              {isUser ? (
                <div>{content}</div>
              ) : (
                <RichContent content={content} stylePrefix="chat" />
              )}
              
              {isLong && expanded && (
                <button 
                  className="chat-expand-btn" 
                  onClick={() => setExpanded(false)}
                >
                  show less
                </button>
              )}
            </>
          )}
          
          {/* Handle attachments */}
          {message.attachments?.map((att, i) => (
            att.isImage
              ? <ImageComponent key={`att-${i}`} src={att.url} alt={att.filename} stylePrefix="chat" />
              : <FileCard key={`att-${i}`} filename={att.filename} size={att.size} url={att.url} stylePrefix="chat" />
          ))}
        </div>
      </div>
    </div>
  )
}

// AttachmentPreview is imported from shared components

// === MAIN CHAT PANEL ===
export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState('main')
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
  
  // Scroll to bottom when messages change, but only if user is near the bottom
  const messagesContainerRef = useRef(null)
  const prevMessageCount = useRef(0)
  useEffect(() => {
    if (!messages.length) return
    const isNewMessage = messages.length !== prevMessageCount.current
    prevMessageCount.current = messages.length
    // Only auto-scroll if this is a genuinely new message (user just sent or received)
    // and not a poll refresh of existing messages
    if (!isNewMessage) return
    // Don't force scroll — user might be reading. Only scroll if they just opened the panel.
    if (justOpened.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages])

  // Scroll to bottom and focus input when panel opens
  const justOpened = useRef(false)
  useEffect(() => {
    if (isOpen) {
      justOpened.current = true
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        inputRef.current?.focus()
        // Allow poll-driven scrolls to be ignored after a brief moment
        setTimeout(() => { justOpened.current = false }, 500)
      }, 50)
    }
  }, [isOpen])

  // Keyboard shortcut for toggle
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '\\' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const isOurInput = document.activeElement === inputRef.current
        if (!isOurInput && (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')) return
        e.preventDefault()
        e.stopImmediatePropagation()
        setIsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
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
    if (isOpen) {
      loadConversations()
      loadMessages(activeConversationId)
    }
  }, [isOpen, activeConversationId, loadConversations, loadMessages])

  // Poll for updates when panel is open
  useEffect(() => {
    if (!isOpen) return
    
    const interval = setInterval(() => {
      loadConversations()
      loadMessages(activeConversationId)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isOpen, activeConversationId, loadConversations, loadMessages])

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
    if (!isOpen) return
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
  }, [isOpen])

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
    setTimeout(() => {
      inputRef.current?.focus()
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)

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
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
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

  if (!isOpen) {
    return (
      <button className="chat-fab" onClick={() => setIsOpen(true)}>
        <span className="chat-fab-icon"><Command size={20} /></span>
      </button>
    )
  }

  return (
    <div
      className="chat-panel-container"
      ref={panelRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <span className="chat-sidebar-title">CONVERSATIONS</span>
          <button className="chat-sidebar-close" onClick={() => setIsOpen(false)}><X size={14} /></button>
        </div>
        
        <div className="chat-conversations">
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
      <div className="chat-main">
        <div className="chat-main-header">
          <span className="chat-main-title">
            {activeConversation?.id === 'main' && <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4, verticalAlign: 'middle' }}><circle cx="8" cy="8" r="7.5" stroke="white" strokeWidth="1"/><circle cx="8" cy="8" r="3" fill="white"/></svg> </>}
            {activeConversation?.name || 'Chat'}
          </span>
          <div className="chat-main-status">
            <div className={`chat-status-dot ${
              activeConversation?.status === 'running' 
                ? 'chat-status-running' 
                : 'chat-status-complete'
            }`} />
            <span>{activeConversation?.status || 'unknown'}</span>
          </div>
        </div>

        <div className="chat-main-messages" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="chat-empty">
              {activeConversationId === 'main' 
                ? 'Connected to main session\nSame memory as Telegram' 
                : 'No messages yet'}
            </div>
          ) : (
            messages.map((message, i) => (
              <ChatMessage
                key={i}
                message={message}
                isUser={message.role === 'user'}
                agentName={message.role === 'user' ? 'You' : (activeConversation?.name || 'Assistant')}
              />
            ))
          )}
          
          {loading && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-message-meta">
                <span className="chat-message-agent">{activeConversation?.name || 'Assistant'}</span>
              </div>
              <div className="chat-message-bubble chat-typing">
                thinking<span className="blink">_</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {dragging && (
          <div className="chat-drop-zone">
            <span className="chat-drop-text">Drop files here</span>
          </div>
        )}

        <AttachmentPreview attachments={attachments} onRemove={removeAttachment} stylePrefix="chat" />

        <div className="chat-input-container">
          <button 
            className="chat-attach-btn" 
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
          <span className="chat-prompt">&gt;</span>
          <input
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`message ${activeConversation?.name?.toLowerCase() || 'chat'}...`}
          />
        </div>
      </div>
    </div>
  )
}