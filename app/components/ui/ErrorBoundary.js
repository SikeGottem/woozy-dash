'use client'
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[${this.props.name || 'MODULE'}] Error:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: 'rgba(14, 14, 14, 0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '2rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.85rem',
          textAlign: 'center',
          letterSpacing: '0.1em',
        }}>
          {(this.props.name || 'MODULE').toUpperCase()} — ERROR
        </div>
      )
    }
    return this.props.children
  }
}
