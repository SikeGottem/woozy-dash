'use client'

export default function DeadlinesModule({ deadlines }) {
  if (!deadlines || deadlines.length === 0) return null

  return (
    <div className="card">
      <div className="section-header">Upcoming Deadlines</div>
      <ul className="data-list">
        {deadlines.map((d, i) => (
          <li key={i} className="data-item">
            <div>
              <div style={{fontWeight: 600}}>{d.title}</div>
              {d.project_name && <div style={{color: '#666', fontSize: '0.8rem'}}>{d.project_name}</div>}
            </div>
            <div className={`task-urgency-${d.urgency}`} style={{fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace"}}>
              {d.due_date ? new Date(d.due_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }) : '--'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
