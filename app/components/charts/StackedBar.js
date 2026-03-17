'use client'

export default function StackedBar({ segments, height = 32 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  return (
    <div className="stacked-bar" style={{ height }}>
      {segments.map((seg, i) => (
        <div key={i} className="stacked-segment" style={{
          width: `${(seg.value / total) * 100}%`,
          background: seg.color,
        }} title={`${seg.label}: $${seg.value.toLocaleString()}`} />
      ))}
    </div>
  )
}
