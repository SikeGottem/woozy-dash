'use client'
import './globals.css'
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import ChatPanel from './components/ChatPanel'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Chat context so toolbar can toggle chat from anywhere
export const ChatContext = createContext({ toggleChat: () => {} })
export function useChatContext() { return useContext(ChatContext) }

export default function RootLayout({ children }) {
  const [chatOpen, setChatOpen] = useState(false)
  const toggleChat = useCallback(() => setChatOpen(prev => !prev), [])

  return (
    <html lang="en">
      <head><title>Woozy</title></head>
      <body>
        <ChatContext.Provider value={{ chatOpen, setChatOpen, toggleChat }}>
          {children}
          <ErrorBoundary name="Chat">
            <ChatPanel externalOpen={chatOpen} onExternalToggle={setChatOpen} />
          </ErrorBoundary>
        </ChatContext.Provider>
      </body>
    </html>
  )
}
