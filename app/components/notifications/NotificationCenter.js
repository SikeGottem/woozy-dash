'use client'
import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../../context/NotificationContext'

function formatTimeAgo(ts) {
  if (!ts) return '--'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatCost(c) {
  if (!c || c < 0.001) return '$0.00'
  if (c < 0.01) return '$' + c.toFixed(3)
  return '$' + c.toFixed(2)
}

function formatDuration(seconds) {
  if (!seconds) return '--'
  if (seconds < 60) return seconds + 's'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

export default function NotificationCenter({ onViewTranscript }) {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markRead, markAllRead, dismissNotification, clearAll, openDm } = useNotifications()
  const panelRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div className="notif-center" ref={panelRef}>
      <button className="notif-bell" onClick={() => setOpen(!open)} title="Notifications">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-flyout">
          <div className="notif-flyout-header">
            <span className="notif-flyout-title">── NOTIFICATIONS ──</span>
            <div className="notif-flyout-actions">
              {unreadCount > 0 && (
                <button className="notif-flyout-btn" onClick={markAllRead}>MARK ALL READ</button>
              )}
              {notifications.length > 0 && (
                <button className="notif-flyout-btn" onClick={clearAll}>CLEAR ALL</button>
              )}
            </div>
          </div>

          <div className="notif-flyout-list">
            {notifications.length === 0 && (
              <div className="notif-empty">No notifications</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`notif-entry ${n.read ? 'notif-read' : 'notif-unread'}`}
                onClick={() => { markRead(n.id); onViewTranscript(n.agentId); setOpen(false) }}
              >
                <div className="notif-entry-top">
                  <span className={`notif-entry-dot ${n.status === 'complete' ? 'notif-dot-ok' : 'notif-dot-fail'}`} />
                  <span className="notif-entry-name">{n.agentName}</span>
                  <span className="notif-entry-time">{formatTimeAgo(n.ts)}</span>
                </div>
                {n.summary && <div className="notif-entry-summary">{n.summary}</div>}
                <div className="notif-entry-meta">
                  <span>{formatDuration(n.duration)}</span>
                  <span>{formatCost(n.cost)}</span>
                </div>
                <div className="notif-entry-actions" onClick={e => e.stopPropagation()}>
                  {n.sessionKey && (
                    <button className="notif-entry-btn" onClick={() => { openDm({ id: n.agentId, name: n.agentName, sessionKey: n.sessionKey }); setOpen(false) }}>REPLY</button>
                  )}
                  <button className="notif-entry-btn" onClick={() => dismissNotification(n.id)}>DISMISS</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
