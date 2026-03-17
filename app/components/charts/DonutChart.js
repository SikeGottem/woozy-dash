'use client'

export default function DonutChart({ segments, size = 180, stroke = 24 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const pct = seg.value / total
        const dashLen = pct * circ
        const dashOffset = -offset * circ
        offset += pct
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${circ - dashLen}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        )
      })}
    </svg>
  )
}
