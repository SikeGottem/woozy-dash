'use client'

export default function MiniStat({ label, value, sub, color }) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-value" style={{ color: color || '#fff' }}>{value}</div>
      <div className="mini-stat-label">{label}</div>
      {sub && <div className="mini-stat-sub">{sub}</div>}
    </div>
  )
}
