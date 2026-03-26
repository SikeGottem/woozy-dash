'use client'
import { Circle, Check } from 'lucide-react'

export default function HabitsModule({ habits }) {
  if (!habits || habits.length === 0) return null

  return (
    <div className="card">
      <div className="section-header">Daily Habits</div>
      <ul className="data-list">
        {habits.map((h, i) => (
          <li key={i} className="data-item">
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <span>{h.icon || <Circle size={10} fill="currentColor" />}</span>
              <span>{h.name}</span>
            </div>
            <span style={{
              color: h.today_completed ? '#22c55e' : '#666',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem'
            }}>
              {h.today_completed ? <><Check size={12} style={{ verticalAlign: 'middle' }} /> DONE</> : <Circle size={10} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
