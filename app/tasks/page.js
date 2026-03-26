'use client'
import { useEffect, useState } from 'react'
import TasksModule from '../components/TasksModule'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { NotificationProvider } from '../context/NotificationContext'

export default function TasksPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const fetchData = () => fetch('/api/data').then(r => r.json()).then(setData).catch(() => {})
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return (
      <div className="page-content">
        <div className="loading">Loading task manager...</div>
      </div>
    )
  }

  return (
    <NotificationProvider>
      <div className="page-content">
        <div className="section-title">Task Manager</div>
        <ErrorBoundary name="Tasks">
          <TasksModule data={data} />
        </ErrorBoundary>
      </div>
    </NotificationProvider>
  )
}