'use client'

export default function BootSequence({ bootLines }) {
  return (
    <div className="boot-screen">
      <div className="boot-logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
      </div>
      <div className="boot-title">WOOZY COMMAND</div>
      <div className="boot-lines">
        {bootLines.map((line, i) => (
          <div key={i} className={`boot-line ${i === bootLines.length - 1 ? 'boot-line-latest' : ''}`}>
            {line}
          </div>
        ))}
        <span className="boot-cursor">█</span>
      </div>
    </div>
  )
}
