'use client'
import './globals.css'
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import ChatPanel from './components/ChatPanel'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Chat context so toolbar can toggle chat from anywhere
export const ChatContext = createContext({ toggleChat: () => {} })
export function useChatContext() { return useContext(ChatContext) }

export default function RootLayout({ children }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const [chatOpen, setChatOpen] = useState(false)
  const toggleChat = useCallback(() => setChatOpen(prev => !prev), [])

  return (
    <html lang="en">
      <head>
        <title>Woozy</title>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
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
