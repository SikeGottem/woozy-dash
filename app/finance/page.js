'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PinLock, DecryptReveal } from '../components/ui/PinLock'
import CommandToolbar from '../components/CommandToolbar'
import { NotificationProvider } from '../context/NotificationContext'

const fmt = (n) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
const fmtFull = (n) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : `$${n.toFixed(0)}`

// === NET WORTH CHART (improved) ===
function NetWorthChart({ data }) {
  const [tooltip, setTooltip] = useState(null)
  if (!data || data.length < 2) return <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'2rem'}}>Snapshots build over time</div>

  const w = 700, h = 240, padL = 60, padR = 30, padT = 30, padB = 40
  const vals = data.map(d => d.total)
  const minV = Math.floor(Math.min(...vals) / 1000) * 1000
  const maxV = Math.ceil(Math.max(...vals) / 1000) * 1000
  const rangeV = maxV - minV || 1

  // Grid lines at round thousands
  const gridStep = rangeV <= 5000 ? 1000 : rangeV <= 15000 ? 2000 : 5000
  const gridLines = []
  for (let v = minV; v <= maxV; v += gridStep) gridLines.push(v)

  const points = vals.map((v, i) => ({
    x: padL + (i / Math.max(vals.length - 1, 1)) * (w - padL - padR),
    y: padT + (1 - (v - minV) / rangeV) * (h - padT - padB)
  }))

  // X axis: month labels
  const xLabels = []
  const seen = new Set()
  data.forEach((d, i) => {
    const dt = new Date(d.date + 'T00:00:00')
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    if (!seen.has(key) || i === data.length - 1) {
      seen.add(key)
      const label = dt.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
      xLabels.push({ x: points[i].x, label })
    }
  })
  // Thin out if too many
  const maxLabels = 8
  const step = xLabels.length > maxLabels ? Math.ceil(xLabels.length / maxLabels) : 1
  const shownLabels = xLabels.filter((_, i) => i % step === 0 || i === xLabels.length - 1)

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:'auto',maxHeight:'240px'}}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const mx = (e.clientX - rect.left) / rect.width * w
          let closest = 0, minDist = Infinity
          points.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < minDist) { minDist = d; closest = i } })
          if (minDist < 30) setTooltip({ i: closest, x: points[closest].x, y: points[closest].y })
          else setTooltip(null)
        }}
        onMouseLeave={() => setTooltip(null)}>
        {/* Grid lines */}
        {gridLines.map(v => {
          const y = padT + (1 - (v - minV) / rangeV) * (h - padT - padB)
          return <g key={v}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#1a1a1a" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} fill="#555" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">{fmtK(v)}</text>
          </g>
        })}
        {/* X labels */}
        {shownLabels.map((l, i) => (
          <text key={i} x={l.x} y={h - 8} fill="#555" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">{l.label}</text>
        ))}
        {/* Line */}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
        {/* Dots */}
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={data.length <= 30 ? 3 : 1.5} fill="#fff" />)}
        {/* Start/end labels */}
        <text x={points[0].x} y={points[0].y - 8} fill="#999" fontSize="9" fontFamily="JetBrains Mono" textAnchor="start">{fmt(vals[0])}</text>
        <text x={points[points.length-1].x} y={points[points.length-1].y - 8} fill="#fff" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">{fmt(vals[vals.length-1])}</text>
        {/* Tooltip highlight */}
        {tooltip && <>
          <circle cx={points[tooltip.i].x} cy={points[tooltip.i].y} r="5" fill="none" stroke="#fff" strokeWidth="1" />
          <line x1={points[tooltip.i].x} y1={padT} x2={points[tooltip.i].x} y2={h - padB} stroke="#333" strokeWidth="0.5" strokeDasharray="3 3" />
        </>}
      </svg>
      {tooltip && (
        <div style={{fontFamily:'JetBrains Mono',fontSize:'11px',color:'#fff',textAlign:'center',marginTop:'0.25rem'}}>
          {new Date(data[tooltip.i].date + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })} — <span style={{fontWeight:700}}>{fmtFull(vals[tooltip.i])}</span>
        </div>
      )}
    </div>
  )
}

// === PRICE CHART ===
function PriceChart({ history, holdingName, currentPrice, costBasis, purchaseLots = [] }) {
  const [period, setPeriod] = useState('ALL')
  const [tooltip, setTooltip] = useState(null)
  const periods = ['1W', '1M', '3M', '1Y', 'ALL']

  const filtered = useMemo(() => {
    if (!history || history.length === 0) return []
    if (period === 'ALL') return history
    const days = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }[period] || 9999
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    return history.filter(h => h.date >= cutoff)
  }, [history, period])

  if (!history || history.length === 0) return <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'2rem'}}>No price history</div>

  const data = filtered.length >= 2 ? filtered : history
  const firstPrice = data[0].price
  const change = currentPrice - firstPrice
  const changePct = firstPrice > 0 ? ((change / firstPrice) * 100).toFixed(2) : 0
  const isUp = change >= 0

  const w = 800, h = 220, padL = 55, padR = 50, padT = 15, padB = 25
  const prices = data.map(d => d.price)
  const allVals = [...prices, ...(costBasis > 0 ? [costBasis] : [])]
  const minP = Math.min(...allVals) * 0.995, maxP = Math.max(...allVals) * 1.005, rangeP = maxP - minP || 1
  const priceToY = (price) => padT + (1 - (price - minP) / rangeP) * (h - padT - padB)
  const points = prices.map((p, i) => ({
    x: padL + (i / Math.max(prices.length - 1, 1)) * (w - padL - padR),
    y: priceToY(p)
  }))
  const avgCostY = costBasis > 0 ? priceToY(costBasis) : null

  return (
    <div style={{marginTop:'1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem',marginBottom:'0.75rem'}}>
        <div>
          <span style={{fontFamily:'JetBrains Mono',fontSize:'0.85rem',color:'#fff',fontWeight:600,marginRight:'0.75rem'}}>{holdingName}</span>
          <span style={{fontFamily:'JetBrains Mono',fontSize:'0.9rem',color:'#fff'}}>{fmtFull(currentPrice)}</span>
          <span style={{color: isUp ? '#22c55e' : '#ef4444', fontSize:'0.75rem', marginLeft:'0.5rem'}}>
            {isUp ? '+' : ''}{fmtFull(Math.abs(change))} ({isUp ? '+' : ''}{changePct}%)
          </span>
        </div>
        <div className="fin-period-btns">
          {periods.map(p => <button key={p} className={`fin-period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>)}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:'auto',maxHeight:'220px'}}>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const val = minP + pct * rangeP
          const y = padT + (1 - pct) * (h - padT - padB)
          return <g key={pct}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#1a1a1a" strokeWidth="0.5" />
            <text x={padL-5} y={y+3} fill="#555" fontSize="8" fontFamily="JetBrains Mono" textAnchor="end">${val.toFixed(2)}</text>
          </g>
        })}
        <text x={padL} y={h-5} fill="#555" fontSize="7" fontFamily="JetBrains Mono">{data[0].date}</text>
        <text x={w-padR} y={h-5} fill="#555" fontSize="7" fontFamily="JetBrains Mono" textAnchor="end">{data[data.length-1].date}</text>
        {avgCostY !== null && <>
          <line x1={padL} y1={avgCostY} x2={w - padR} y2={avgCostY} stroke="#444" strokeWidth="1" strokeDasharray="4 3" />
          <text x={w - padR + 4} y={avgCostY + 3} fill="#444" fontSize="7" fontFamily="JetBrains Mono">AVG ${costBasis.toFixed(2)}</text>
        </>}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
        {points.length <= 30 && points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#fff" />)}
      </svg>
    </div>
  )
}

// === BLOCK BAR (█░ style) ===
function BlockBar({ value, max, width = 20 }) {
  const filled = Math.round((value / max) * width)
  return <span style={{fontFamily:'JetBrains Mono',fontSize:'11px',color:'#fff',letterSpacing:'-0.5px'}}>
    {'█'.repeat(filled)}{'░'.repeat(width - filled)}
  </span>
}

// === PROGRESS BAR ===
function ProgressBar({ pct, height = 10 }) {
  return <div style={{height:`${height}px`,background:'#222',width:'100%',overflow:'hidden'}}>
    <div style={{height:'100%',background: pct >= 100 ? '#22c55e' : '#fff',width:`${Math.min(pct, 100)}%`,transition:'width 0.8s'}} />
  </div>
}

// === LIVE INDICATOR ===
function LiveIndicator({ lastUpdated }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(t) }, [])
  const ago = lastUpdated ? Math.floor((now - lastUpdated) / 1000) : null
  const label = ago === null ? '...' : ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.floor(ago/60)}m ago` : `${Math.floor(ago/3600)}h ago`
  return (
    <div style={{display:'flex',alignItems:'center',gap:'0.4rem',fontFamily:'JetBrains Mono',fontSize:'11px',color:'#555'}}>
      <span className="live-dot" /><span style={{color:'#555'}}>LIVE</span><span style={{color:'#333'}}>· updated {label}</span>
    </div>
  )
}

// === FLASH VALUE ===
function FlashValue({ value, children }) {
  const prevRef = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) { setFlash(true); const t = setTimeout(() => setFlash(false), 500); prevRef.current = value; return () => clearTimeout(t) }
    prevRef.current = value
  }, [value])
  return <span className={flash ? 'value-flash' : ''}>{children}</span>
}

// === SECTION DIVIDER ===
function SectionHeader({ title }) {
  return <div style={{fontFamily:'JetBrains Mono',fontSize:'0.75rem',color:'#555',letterSpacing:'0.1em',textTransform:'uppercase',padding:'0.5rem 0',marginBottom:'0.75rem',borderBottom:'1px solid #222'}}>
    ── {title} ──
  </div>
}

// === MAIN PAGE ===
export default function FinancePage() {
  const [unlocked, setUnlocked] = useState(false)
  const [data, setData] = useState(null)
  const [liveHoldings, setLiveHoldings] = useState(null)
  const [selectedHolding, setSelectedHolding] = useState(null)
  const [txFilter, setTxFilter] = useState('all')
  const [lastUpdated, setLastUpdated] = useState(null)

  // Toolbar state
  const [focusMode, setFocusMode] = useState(false)
  const [contextMode, setContextMode] = useState('personal')
  const [energy, setEnergy] = useState(3)
  const [timer, setTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [currentTask, setCurrentTask] = useState('Finance review')
  const [captureOpen, setCaptureOpen] = useState(false)

  const fetchAll = useCallback(() => {
    fetch('/api/finance').then(r => r.json()).then(d => { setData(d); setLastUpdated(Date.now()) }).catch(() => {})
    fetch('/api/prices').then(r => r.json()).then(d => setLiveHoldings(d.holdings)).catch(() => {})
  }, [])

  const isMarketHours = useCallback(() => {
    const now = new Date()
    const aest = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
    const h = aest.getHours(), d = aest.getDay()
    return d >= 1 && d <= 5 && h >= 10 && h < 16
  }, [])

  useEffect(() => {
    if (!unlocked) return
    fetchAll()
    const lastSync = localStorage.getItem('woozy_last_stripe_sync')
    if (!lastSync || Date.now() - Number(lastSync) > 3600000) {
      fetch('/api/stripe-sync', { method: 'POST' }).then(() => localStorage.setItem('woozy_last_stripe_sync', String(Date.now()))).catch(() => {})
    }
    const dataInterval = setInterval(fetchAll, 30000)
    let priceInterval = null
    const setupPriceInterval = () => {
      if (priceInterval) clearInterval(priceInterval)
      const ms = isMarketHours() ? 15 * 60 * 1000 : 60 * 60 * 1000
      priceInterval = setInterval(() => {
        fetch('/api/prices', { method: 'POST' }).then(r => r.json()).then(d => setLiveHoldings(d.holdings)).catch(() => {})
      }, ms)
    }
    setupPriceInterval()
    const marketCheck = setInterval(setupPriceInterval, 15 * 60 * 1000)
    return () => { clearInterval(dataInterval); if (priceInterval) clearInterval(priceInterval); clearInterval(marketCheck) }
  }, [unlocked, fetchAll, isMarketHours])

  const toolbarProps = {
    onCapture: () => setCaptureOpen(true), unlocked, onLock: () => setUnlocked(false),
    focusMode, setFocusMode, contextMode, setContextMode, energy, setEnergy,
    timer, setTimer, timerSeconds, setTimerSeconds, currentTask, setCurrentTask,
  }

  if (!unlocked) return (
    <NotificationProvider>
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
        <PinLock onUnlock={() => setUnlocked(true)} />
      </div>
    </NotificationProvider>
  )

  if (!data) return (
    <NotificationProvider>
      <div style={{maxWidth:'1400px',margin:'0 auto',padding:'1.5rem'}}>
        <CommandToolbar {...toolbarProps} />
        <div className="loading" style={{height:'50vh'}}>LOADING FINANCIAL DATA...</div>
      </div>
    </NotificationProvider>
  )

  const { accounts, holdings: dbHoldings, transactions, netWorthHistory, priceHistory, purchaseLots = [], goals, freelanceProjects, summary } = data
  const holdings = liveHoldings || dbHoldings

  // === COMPUTED VALUES ===
  const checking = accounts.find(a => a.name === 'Checking')?.balance || 0
  const savings = accounts.find(a => a.name === 'Savings')?.balance || 0
  const cash = accounts.find(a => a.name === 'Cash')?.balance || 0
  const liquid = checking + savings + cash
  const invested = holdings.reduce((s, h) => s + (h.current_value || 0), 0)
  const pendingTx = transactions.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'paid'))
  const receivables = pendingTx.reduce((s, t) => s + t.amount, 0)
  const netWorth = liquid + invested + receivables

  // Income stats
  const completedIncome = transactions.filter(t => t.type === 'income' && ['completed','cleared','paid'].includes(t.status))
  const totalIncome = completedIncome.reduce((s, t) => s + t.amount, 0)
  const completedExpenses = transactions.filter(t => t.type === 'expense' && ['completed','cleared','paid'].includes(t.status))
  const totalExpenses = completedExpenses.reduce((s, t) => s + t.amount, 0)

  // YTD
  const ytdIncome = completedIncome.filter(t => t.date?.startsWith('2026')).reduce((s, t) => s + t.amount, 0)
  const ytdExpenses = completedExpenses.filter(t => t.date?.startsWith('2026')).reduce((s, t) => s + t.amount, 0)
  const ytdTxCount = completedIncome.filter(t => t.date?.startsWith('2026')).length
  const ytdSavingsRate = ytdIncome > 0 ? Math.round(((ytdIncome - ytdExpenses) / ytdIncome) * 100) : 100

  // Best month YTD
  const monthlyTotals2026 = {}
  completedIncome.filter(t => t.date?.startsWith('2026')).forEach(t => {
    const m = t.date?.slice(0, 7)
    monthlyTotals2026[m] = (monthlyTotals2026[m] || 0) + t.amount
  })
  const bestMonth2026 = Object.entries(monthlyTotals2026).sort((a, b) => b[1] - a[1])[0]

  // Runway
  const monthsTracked = new Set(completedIncome.map(t => t.date?.slice(0, 7))).size || 1
  const avgMonthlyIncome = totalIncome / monthsTracked
  const avgMonthlyExpenses = totalExpenses / monthsTracked

  // Portfolio totals (used in invested card breakdown)
  const portfolioCost = holdings.reduce((s, h) => s + (h.cost_basis || 0), 0)
  const portfolioReturn = invested - portfolioCost

  // Days until birthday
  const birthday = new Date('2026-03-22T00:00:00+11:00')
  const now = new Date()
  const daysUntilBday = Math.ceil((birthday - now) / 86400000)

  // Goal
  const goal = goals?.[0]
  const goalPct = goal ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0

  // Filtered transactions
  const filteredTx = transactions.filter(t => {
    if (txFilter === 'income') return t.type === 'income'
    if (txFilter === 'expense') return t.type === 'expense'
    if (txFilter === 'pending') return t.status === 'pending' || t.status === 'paid'
    return true
  })

  return (
    <NotificationProvider>
    <DecryptReveal unlocked={unlocked}>
    <div style={{maxWidth:'1100px',margin:'0 auto',padding:'1.5rem',fontFamily:'JetBrains Mono, monospace'}}>
      <CommandToolbar {...toolbarProps} />

      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.5rem'}}>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      {/* ═══ NET WORTH HERO ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <SectionHeader title="NET WORTH" />
        <FlashValue value={netWorth}>
          <span style={{fontSize:'2.2rem',fontWeight:700,color:'#fff',display:'block',marginBottom:'1rem'}}>{fmt(netWorth)}</span>
        </FlashValue>

        {/* Category breakdown */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'1rem',marginBottom:'1rem'}}>
          <div style={{padding:'0.75rem',border:'1px solid #222'}}>
            <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'0.35rem'}}>LIQUID (spendable)</div>
            <div style={{fontSize:'1.3rem',fontWeight:700,color:'#fff'}}>{fmt(liquid)}</div>
            <div style={{fontSize:'0.6rem',color:'#333',marginTop:'0.25rem'}}>Checking {fmt(checking)} · Savings {fmt(savings)}</div>
          </div>
          <div style={{padding:'0.75rem',border:'1px solid #222'}}>
            <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'0.35rem'}}>INVESTED (market)</div>
            <div style={{fontSize:'1.3rem',fontWeight:700,color:'#fff'}}>{fmt(invested)}</div>
            <div style={{fontSize:'0.6rem',color:'#333',marginTop:'0.25rem'}}>{holdings.map(h => `${h.name} ${fmt(h.current_value)}`).join(' · ')}</div>
          </div>
          <div style={{padding:'0.75rem',border:'1px solid #222'}}>
            <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'0.35rem'}}>OWED (incoming)</div>
            <div style={{fontSize:'1.3rem',fontWeight:700,color: receivables > 0 ? '#d97706' : '#fff'}}>{fmt(receivables)}</div>
            <div style={{fontSize:'0.6rem',color:'#333',marginTop:'0.25rem'}}>
              {pendingTx.length > 0 ? `${pendingTx.length} pending payment${pendingTx.length > 1 ? 's' : ''}` : 'Nothing owed'}
            </div>
          </div>
        </div>

        {/* Allocation bar */}
        <div style={{display:'flex',height:'8px',width:'100%',marginBottom:'0.5rem'}}>
          <div style={{width:`${(liquid/netWorth)*100}%`,background:'rgba(255,255,255,0.85)',height:'100%'}} title={`Liquid: ${fmt(liquid)}`} />
          <div style={{width:`${(invested/netWorth)*100}%`,background:'rgba(255,255,255,0.45)',height:'100%'}} title={`Invested: ${fmt(invested)}`} />
          <div style={{width:`${(receivables/netWorth)*100}%`,background:'rgba(214,163,50,0.6)',height:'100%'}} title={`Owed: ${fmt(receivables)}`} />
        </div>
        <div style={{display:'flex',gap:'1.5rem',fontSize:'0.65rem'}}>
          <span style={{color:'#ccc'}}>█ Liquid {((liquid/netWorth)*100).toFixed(0)}%</span>
          <span style={{color:'#777'}}>█ Invested {((invested/netWorth)*100).toFixed(0)}%</span>
          <span style={{color:'#d97706'}}>█ Owed {((receivables/netWorth)*100).toFixed(0)}%</span>
        </div>
      </div>

      {/* ═══ GOAL + RUNWAY ROW ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1.5rem'}}>
        {/* ETF Goal */}
        {goal && (
          <div className="card">
            <SectionHeader title="ETF LUMP SUM GOAL" />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'0.5rem'}}>
              <span style={{fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>{fmt(goal.current_amount)}</span>
              <span style={{fontSize:'0.75rem',color:'#555'}}>/ {fmt(goal.target_amount)}</span>
            </div>
            <ProgressBar pct={goalPct} />
            <div style={{display:'flex',justifyContent:'space-between',marginTop:'0.5rem',fontSize:'0.7rem'}}>
              <span style={{color: goalPct >= 100 ? '#22c55e' : '#999'}}>{goalPct.toFixed(1)}%</span>
              <span style={{color: daysUntilBday <= 7 ? '#d97706' : '#555'}}>
                {daysUntilBday > 0 ? `${daysUntilBday} days to go` : daysUntilBday === 0 ? '🎂 TODAY' : 'Past deadline'}
              </span>
            </div>
            <div style={{fontSize:'0.6rem',color:'#333',marginTop:'0.5rem'}}>{goal.notes}</div>
            <div style={{fontSize:'0.7rem',color:'#999',marginTop:'0.5rem'}}>
              Need <span style={{color:'#fff',fontWeight:600}}>{fmt(goal.target_amount - goal.current_amount)}</span> more
            </div>
          </div>
        )}

        {/* Runway */}
        <div className="card">
          <SectionHeader title="INCOME & RUNWAY" />
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            <div>
              <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.2rem'}}>Avg monthly income</div>
              <div style={{fontSize:'1.1rem',fontWeight:700,color:'#22c55e'}}>{fmt(avgMonthlyIncome)}</div>
              <div style={{fontSize:'0.6rem',color:'#333'}}>from {monthsTracked} month{monthsTracked > 1 ? 's' : ''} tracked</div>
            </div>
            <div>
              <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.2rem'}}>Runway</div>
              {totalExpenses === 0 ? (
                <div style={{fontSize:'0.9rem',color:'#999'}}>No expenses logged — runway: <span style={{color:'#fff',fontWeight:700}}>∞</span></div>
              ) : (
                <div style={{fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>{Math.floor(liquid / avgMonthlyExpenses)} months</div>
              )}
              <div style={{fontSize:'0.6rem',color:'#333'}}>based on liquid cash of {fmt(liquid)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ NET WORTH CHART ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <SectionHeader title="NET WORTH OVER TIME" />
        <NetWorthChart data={netWorthHistory} />
      </div>

      {/* ═══ UPCOMING MONEY + YTD ROW ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1.5rem'}}>
        {/* Upcoming */}
        <div className="card">
          <SectionHeader title="UPCOMING" />
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',fontSize:'0.75rem'}}>
            {pendingTx.map((t, i) => (
              <div key={i} style={{display:'flex',gap:'0.75rem',alignItems:'baseline'}}>
                <span style={{color:'#22c55e',fontWeight:600,minWidth:'25px'}}>IN</span>
                <span style={{color:'#fff',fontWeight:600,minWidth:'70px'}}>{fmt(t.amount)}</span>
                <span style={{color:'#999',flex:1}}>{t.description}</span>
                <span style={{color: t.status === 'paid' ? '#d97706' : '#555',fontSize:'0.65rem'}}>
                  {t.status === 'paid' ? 'awaiting transfer' : t.date ? `due ${t.date}` : 'pending'}
                </span>
              </div>
            ))}
            {goal && daysUntilBday > 0 && daysUntilBday <= 30 && (
              <div style={{display:'flex',gap:'0.75rem',alignItems:'baseline'}}>
                <span style={{color:'#ef4444',fontWeight:600,minWidth:'25px'}}>OUT</span>
                <span style={{color:'#fff',fontWeight:600,minWidth:'70px'}}>{fmt(goal.target_amount)}</span>
                <span style={{color:'#999',flex:1}}>ETF deployment (Mar 22)</span>
                <span style={{color:'#d97706',fontSize:'0.65rem'}}>← goal</span>
              </div>
            )}
            {pendingTx.length === 0 && <div style={{color:'#555',textAlign:'center',padding:'1rem'}}>Nothing upcoming</div>}
          </div>
        </div>

        {/* YTD */}
        <div className="card">
          <SectionHeader title="2026 YTD" />
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.8rem'}}>
              <span style={{color:'#999'}}>Earned</span>
              <span style={{color:'#22c55e',fontWeight:600}}>{fmt(ytdIncome)} <span style={{color:'#555',fontSize:'0.65rem'}}>({ytdTxCount} payment{ytdTxCount !== 1 ? 's' : ''})</span></span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.8rem'}}>
              <span style={{color:'#999'}}>Spent</span>
              <span style={{color: ytdExpenses > 0 ? '#ef4444' : '#555',fontWeight:600}}>{fmt(ytdExpenses)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.8rem'}}>
              <span style={{color:'#999'}}>Saved</span>
              <span style={{color:'#fff',fontWeight:600}}>{ytdSavingsRate}%</span>
            </div>
            {bestMonth2026 && (
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.8rem'}}>
                <span style={{color:'#999'}}>Best month</span>
                <span style={{color:'#fff',fontWeight:600}}>
                  {new Date(bestMonth2026[0] + '-01T00:00:00').toLocaleDateString('en-AU', { month: 'long' })} ({fmt(bestMonth2026[1])})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PORTFOLIO PERFORMANCE ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <SectionHeader title="PORTFOLIO" />
        {(() => {
          const totalCost = holdings.reduce((s, h) => s + (h.cost_basis || 0), 0)
          const totalVal = holdings.reduce((s, h) => s + (h.current_value || 0), 0)
          const totalReturn = totalVal - totalCost
          const totalReturnPct = totalCost > 0 ? ((totalReturn / totalCost) * 100).toFixed(1) : 0
          const isPortUp = totalReturn >= 0

          return (
            <div>
              <FlashValue value={totalVal}>
                <span style={{fontSize:'1.8rem',fontWeight:700,color:'#fff',display:'block'}}>{fmtFull(totalVal)}</span>
              </FlashValue>
              <div style={{display:'flex',gap:'1.5rem',marginTop:'0.35rem',marginBottom:'1rem',fontSize:'0.75rem'}}>
                <span style={{color:'#555'}}>Invested {fmtFull(totalCost)}</span>
                <span style={{color: isPortUp ? '#22c55e' : '#ef4444',fontWeight:600}}>
                  {isPortUp ? '+' : ''}{fmtFull(totalReturn)} ({isPortUp ? '+' : ''}{totalReturnPct}%)
                </span>
              </div>

              {/* Portfolio chart */}
              {(() => {
                // Build portfolio total value per date with carry-forward for missing dates
                const allEntries = []
                for (const h of holdings) {
                  const history = priceHistory[h.id] || []
                  for (const entry of history) {
                    allEntries.push({ holdingId: h.id, date: entry.date, value: entry.value })
                  }
                }
                allEntries.sort((a, b) => a.date.localeCompare(b.date))
                const uniqueDates = [...new Set(allEntries.map(e => e.date))].sort()
                const lastKnown = {}
                const portfolioHistory = []
                for (const date of uniqueDates) {
                  const entries = allEntries.filter(e => e.date === date)
                  for (const e of entries) lastKnown[e.holdingId] = e.value
                  const total = Object.values(lastKnown).reduce((s, v) => s + v, 0)
                  portfolioHistory.push({ date, price: total })
                }
                return portfolioHistory.length >= 2 ? (
                  <PriceChart
                    history={portfolioHistory}
                    holdingName=""
                    currentPrice={totalVal}
                    costBasis={totalCost}
                  />
                ) : null
              })()}

              {/* Allocation */}
              <div style={{marginTop:'1.25rem'}}>
                <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Allocation</div>
                {holdings.map((h, i) => {
                  const weight = totalVal > 0 ? (h.current_value / totalVal) : 0
                  const pct = (weight * 100).toFixed(1)
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.35rem',fontSize:'0.75rem'}}>
                      <span style={{color:'#999',minWidth:'50px'}}>{h.name}</span>
                      <span style={{color:'#fff',minWidth:'70px',fontWeight:600}}>{fmtFull(h.current_value)}</span>
                      <BlockBar value={weight} max={1} width={20} />
                      <span style={{color:'#555',minWidth:'40px'}}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ═══ INDIVIDUAL HOLDINGS ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <SectionHeader title="HOLDINGS" />
        {holdings.map((h, i) => {
          const gain = (h.current_value || 0) - (h.cost_basis || 0)
          const gainPct = h.cost_basis > 0 ? ((gain / h.cost_basis) * 100).toFixed(1) : 0
          const isUp = gain >= 0
          const isExpanded = selectedHolding?.id === h.id
          const unitLabel = h.type === 'commodity' ? `${h.quantity}g` : `${h.quantity} shares`
          const avgCost = h.quantity > 0 ? h.cost_basis / h.quantity : 0

          return (
            <div key={i}>
              <div
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.6rem 0',borderBottom:'1px solid #1a1a1a',cursor:'pointer',fontSize:'0.75rem'}}
                onClick={() => setSelectedHolding(prev => prev?.id === h.id ? null : h)}
              >
                <div style={{display:'flex',gap:'1rem',alignItems:'baseline'}}>
                  <span style={{color:'#fff',fontWeight:600,minWidth:'50px'}}>{h.name}</span>
                  <span style={{color:'#555'}}>{unitLabel}</span>
                  <span style={{color:'#fff',fontWeight:600}}>{fmtFull(h.current_value)}</span>
                </div>
                <div style={{display:'flex',gap:'0.75rem',alignItems:'baseline'}}>
                  <span style={{color: isUp ? '#22c55e' : '#ef4444',fontWeight:600}}>
                    {isUp ? '+' : ''}{fmtFull(gain)} ({isUp ? '+' : ''}{gainPct}%)
                  </span>
                  <span style={{color:'#555',fontSize:'0.85rem'}}>{isExpanded ? '▾' : '▸'}</span>
                </div>
              </div>
              {isExpanded && (
                <div style={{padding:'0.75rem 0',borderBottom:'1px solid #1a1a1a'}}>
                  <PriceChart
                    history={priceHistory[h.id] || []}
                    holdingName={h.name}
                    currentPrice={h.current_price}
                    costBasis={avgCost}
                    purchaseLots={purchaseLots.filter(l => l.holding_id === h.id)}
                  />
                  <div style={{display:'flex',flexWrap:'wrap',gap:'1.5rem',marginTop:'0.75rem',fontSize:'0.7rem'}}>
                    {[
                      ['Cost basis', fmtFull(h.cost_basis)],
                      ['Avg cost/' + (h.type === 'commodity' ? 'g' : 'share'), fmtFull(avgCost)],
                      ['Current price', fmtFull(h.current_price)],
                      ['Quantity', h.type === 'commodity' ? `${h.quantity}g` : `${h.quantity}`],
                    ].map(([label, val], j) => (
                      <div key={j}>
                        <div style={{color:'#555',fontSize:'0.6rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
                        <div style={{color:'#fff',fontWeight:600}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {purchaseLots.filter(l => l.holding_id === h.id).length > 0 && (
                    <div style={{marginTop:'0.75rem'}}>
                      <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.35rem'}}>Purchase Lots</div>
                      {purchaseLots.filter(l => l.holding_id === h.id).map((lot, k) => (
                        <div key={k} style={{display:'flex',gap:'1rem',fontSize:'0.65rem',color:'#999',marginBottom:'0.2rem'}}>
                          <span>{lot.purchase_date}</span>
                          <span>{lot.quantity} × {fmtFull(lot.price_per_unit)}</span>
                          <span style={{color:'#555'}}>{fmtFull(lot.total_cost)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══ ACCOUNT CARDS ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:'0.75rem',marginBottom:'1.5rem'}}>
        {accounts.map((a, i) => {
          const holding = holdings.find(h => (a.name === 'Investments' && h.name === 'HNDQ') || (a.name === 'Gold' && h.name === 'Gold'))
          const liveVal = holding ? holding.current_value : a.balance
          const hGain = holding?.gainPct || 0
          const hUp = hGain >= 0
          const displayName = a.name === 'Investments' ? 'HNDQ' : a.name === 'Gold' ? 'GOLD 20g' : a.name.toUpperCase()
          return (
            <div key={i} className="card" style={{padding:'0.75rem',cursor: holding ? 'pointer' : 'default'}}
              onClick={() => holding && setSelectedHolding(prev => prev?.id === holding.id ? null : holding)}>
              <div style={{fontSize:'0.6rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.25rem'}}>{displayName}</div>
              <div style={{fontSize:'1rem',fontWeight:700,color:'#fff'}}>{fmt(liveVal)}</div>
              {a.institution && <div style={{fontSize:'0.55rem',color:'#333'}}>{a.institution}</div>}
              {holding && <div style={{fontSize:'0.65rem',color: hUp ? '#22c55e' : '#ef4444',marginTop:'0.2rem'}}>{hUp ? '+' : ''}{hGain.toFixed(1)}% {hUp ? '▲' : '▼'}</div>}
            </div>
          )
        })}
      </div>

      {/* Holdings detail moved to inline expand in HOLDINGS section */}

      {/* ═══ FREELANCE PIPELINE ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <SectionHeader title="FREELANCE PIPELINE" />
        {freelanceProjects.length > 0 ? (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {freelanceProjects.map((p, i) => {
              const paid = p.total_paid || 0
              const pending = p.total_pending || 0
              const totalVal = p.total_value || (paid + pending)
              const paidPct = totalVal > 0 ? (paid / totalVal) * 100 : 0
              return (
                <div key={i} style={{padding:'0.75rem',border:'1px solid #1a1a1a'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
                    <div>
                      <span style={{fontSize:'0.8rem',fontWeight:600,color:'#fff'}}>{p.name}</span>
                      {p.client_name && <span style={{fontSize:'0.65rem',color:'#555',marginLeft:'0.5rem'}}>{p.client_name}</span>}
                    </div>
                    <span className={`status-tag ${p.status === 'active' ? 'status-active' : 'status-inactive'}`}>{p.status}</span>
                  </div>
                  {totalVal > 0 && <>
                    <ProgressBar pct={paidPct} height={6} />
                    <div style={{display:'flex',gap:'1rem',fontSize:'0.65rem',marginTop:'0.35rem'}}>
                      <span style={{color:'#22c55e'}}>{fmt(paid)} paid</span>
                      {pending > 0 && <span style={{color:'#d97706'}}>{fmt(pending)} pending</span>}
                      <span style={{color:'#555'}}>{fmt(totalVal)} total</span>
                    </div>
                  </>}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'2rem'}}>No freelance projects</div>
        )}
      </div>

      {/* ═══ TRANSACTIONS ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
          <SectionHeader title="TRANSACTIONS" />
          <div style={{display:'flex',gap:'0.25rem'}}>
            {['all','income','expense','pending'].map(f => (
              <button key={f} className={`fin-period-btn ${txFilter === f ? 'active' : ''}`} onClick={() => setTxFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="fin-tx-table">
          <div className="fin-tx-header">
            <span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span>Account</span><span>Status</span>
          </div>
          {filteredTx.map((tr, i) => {
            const isIncome = tr.type === 'income'
            const isPending = tr.status === 'pending' || tr.status === 'paid'
            return (
              <div key={i} className={`fin-tx-row ${isPending ? 'fin-tx-pending' : ''}`}>
                <span className="fin-tx-date">{tr.date}</span>
                <span className="fin-tx-desc">{tr.description}{tr.project_name ? ` — ${tr.project_name}` : ''}</span>
                <span className="fin-tx-cat">{tr.category || '—'}</span>
                <span className={isIncome ? 'money-positive' : 'money-negative'}>{isIncome ? '+' : '-'}{fmt(tr.amount)}</span>
                <span className="fin-tx-acct">{tr.account_name || '—'}</span>
                <span style={{fontFamily:'JetBrains Mono',fontSize:'0.65rem',color: tr.status === 'paid' ? '#d97706' : ['completed','cleared'].includes(tr.status) ? '#ccc' : tr.status === 'pending' ? '#d97706' : '#555'}}>
                  {tr.status === 'paid' ? 'PAID · awaiting' : ['completed','cleared'].includes(tr.status) ? 'CLEARED ✓' : tr.status.toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ QUICK ACTIONS ═══ */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <SectionHeader title="QUICK ACTIONS" />
        <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
          {[
            ...(daysUntilBday > 0 && daysUntilBday <= 14 ? [`🎂 Birthday in ${daysUntilBday} days — Bupa setup needed`] : []),
            '📝 Log an expense',
            '💰 Update account balance',
            '📊 Record net worth snapshot',
          ].map((action, i) => (
            <div key={i} style={{
              padding:'0.5rem 0.75rem',border:'1px solid #222',fontSize:'0.7rem',color:'#999',cursor:'pointer',
              transition:'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}>
              {action}
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.5rem 0',fontSize:'0.6rem',color:'#333',letterSpacing:'0.1em'}}>
        <span>WOOZY FINANCE</span>
        <span>LAST UPDATE {new Date(data.updated).toLocaleString('en-AU', {hour:'2-digit',minute:'2-digit',hour12:false})}</span>
      </div>
    </div>
    </DecryptReveal>
    </NotificationProvider>
  )
}
