'use client'
import NavBar from '../components/NavBar'
import UnifiedAgentsModule from '../components/UnifiedAgentsModule'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { NotificationProvider } from '../context/NotificationContext'
import ToastNotifications from '../components/notifications/ToastNotifications'
import AgentDM from '../components/notifications/AgentDM'

export default function AgentsPage() {
  return (
    <NotificationProvider>
      <ToastNotifications />
      <AgentDM />
      <NavBar />
      <div className="page-content emp-page">
        <ErrorBoundary name="Agents">
          <UnifiedAgentsModule />
        </ErrorBoundary>
      </div>
    </NotificationProvider>
  )
}
