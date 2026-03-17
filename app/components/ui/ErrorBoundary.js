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
          background: '#111',
          border: '1px solid #222',
          borderLeft: '3px solid #ef4444',
          borderRadius: '0',
          padding: '16px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#999',
          fontSize: '0.8rem',
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
