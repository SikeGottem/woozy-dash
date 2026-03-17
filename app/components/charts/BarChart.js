'use client'

export default function BarChart({ items, maxVal }) {
  const max = maxVal || Math.max(...items.map(i => i.value), 1)
  return (
    <div className="bar-chart">
      {items.map((item, i) => (
        <div key={i} className="bar-row">
          <div className="bar-label">{item.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{
              width: `${(item.value / max) * 100}%`,
              background: item.color || 'rgba(255,255,255,0.8)',
              transition: 'width 0.8s ease'
            }} />
          </div>
          <div className="bar-value" style={{ color: item.color || '#fff' }}>{item.display}</div>
        </div>
      ))}
    </div>
  )
}
