'use client'

export default function HabitsModule({ habits }) {
  if (!habits || habits.length === 0) return null

  return (
    <div className="card">
      <div className="section-header">Daily Habits</div>
      <ul className="data-list">
        {habits.map((h, i) => (
          <li key={i} className="data-item">
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <span>{h.icon || '●'}</span>
              <span>{h.name}</span>
            </div>
            <span style={{
              color: h.today_completed ? '#22c55e' : '#666',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem'
            }}>
              {h.today_completed ? '✓ DONE' : '○'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
