'use client'
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'

function formatDuration(seconds) {
  if (!seconds) return '--'
  if (seconds < 60) return seconds + 's'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

function formatCost(c) {
  if (!c || c < 0.001) return '$0.00'
  if (c < 0.01) return '$' + c.toFixed(3)
  return '$' + c.toFixed(2)
}

function Toast({ toast, onDismiss, onViewTranscript, onReply }) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const startTimer = () => {
      timerRef.current = setTimeout(() => {
        setExiting(true)
        setTimeout(() => onDismiss(toast.id), 150)
      }, 30000)
    }
    if (!hovered) startTimer()
    return () => clearTimeout(timerRef.current)
  }, [hovered, toast.id, onDismiss])

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 150)
  }

  const statusDot = toast.status === 'complete' ? 'toast-dot-success' : 'toast-dot-failed'
  const statusLabel = toast.status === 'complete' ? 'COMPLETE' : 'FAILED'

  return (
    <div
      className={`toast-card ${exiting ? 'toast-exit' : 'toast-enter'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="toast-top">
        <div className="toast-agent">
          <span className={`toast-dot ${statusDot}`} />
          <span className="toast-name">{toast.agentName}</span>
          <span className="toast-status">{statusLabel}</span>
        </div>
        <button className="toast-dismiss" onClick={(e) => { e.stopPropagation(); handleDismiss() }}><X size={14} /></button>
      </div>

      {toast.summary && (
        <div className="toast-summary">{toast.summary}</div>
      )}

      <div className="toast-meta">
        <span>{formatDuration(toast.duration)}</span>
        <span>{formatCost(toast.cost)}</span>
      </div>

      {expanded && (
        <div className="toast-actions">
          <button className="toast-action-btn" onClick={(e) => { e.stopPropagation(); onViewTranscript(toast.agentId) }}>VIEW TRANSCRIPT</button>
          {toast.sessionKey && (
            <button className="toast-action-btn" onClick={(e) => { e.stopPropagation(); onReply({ id: toast.agentId, name: toast.agentName, sessionKey: toast.sessionKey }) }}>REPLY</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ToastNotifications({ onViewTranscript }) {
  const { toasts, dismissToast, openDm } = useNotifications()

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onViewTranscript={onViewTranscript}
          onReply={openDm}
        />
      ))}
    </div>
  )
}
