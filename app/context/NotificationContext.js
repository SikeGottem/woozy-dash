'use client'
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const NotificationContext = createContext()

const MAX_NOTIFICATIONS = 50
const STORAGE_KEY = 'woozy-notifications'

function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveNotifications(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)))
  } catch {}
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [dmAgent, setDmAgent] = useState(null) // { id, name, sessionKey }
  const prevAgentStates = useRef({})
  const initialized = useRef(false)

  // Load from localStorage on mount
  useEffect(() => {
    setNotifications(loadNotifications())
    initialized.current = true
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    if (initialized.current) saveNotifications(notifications)
  }, [notifications])

  const addNotification = useCallback((notification) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const notif = {
      id,
      ts: Date.now(),
      read: false,
      ...notification,
    }
    setNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFICATIONS))
    setToasts(prev => [...prev, { ...notif, dismissed: false }])
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  // Detection: check agent state transitions
  const checkAgentTransitions = useCallback((agents) => {
    const newStates = {}
    for (const agent of agents) {
      newStates[agent.id] = agent.status
    }

    // Only fire after first load (skip initial state)
    if (Object.keys(prevAgentStates.current).length > 0) {
      for (const agent of agents) {
        const prevStatus = prevAgentStates.current[agent.id]
        const curStatus = agent.status
        if (prevStatus === 'running' && (curStatus === 'complete' || curStatus === 'completed' || curStatus === 'killed')) {
          const status = curStatus === 'killed' ? 'failed' : 'complete'
          addNotification({
            agentId: agent.id,
            agentName: agent.name,
            sessionKey: agent.sessionKey,
            status,
            summary: agent.summary || '',
            duration: agent.duration,
            cost: agent.cost,
            tokens: agent.totalTokens,
            model: agent.model,
          })
        }
      }
    }

    prevAgentStates.current = newStates
  }, [addNotification])

  const openDm = useCallback((agent) => {
    setDmAgent(agent)
  }, [])

  const closeDm = useCallback(() => {
    setDmAgent(null)
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications,
      toasts,
      unreadCount,
      dmAgent,
      addNotification,
      dismissToast,
      markRead,
      markAllRead,
      dismissNotification,
      clearAll,
      checkAgentTransitions,
      openDm,
      closeDm,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
