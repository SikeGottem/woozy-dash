'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { PinLock, DecryptReveal } from '../components/ui/PinLock'
import Link from 'next/link'

const fmt = (n) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

// === SPARKLINE ===
function Sparkline({ data, width = 120, height = 24 }) {
  if (!data || data.length < 2) return <span style={{color:'#333',fontSize:'0.7rem'}}>—</span>
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const blocks = '▁▂▃▄▅▆▇█'
  return (
    <span style={{fontFamily:'JetBrains Mono',fontSize:'0.7rem',color:'#555',letterSpacing:'-1px'}}>
      {data.slice(-20).map((v, i) => {
        const idx = Math.round(((v - min) / range) * (blocks.length - 1))
        return <span key={i}>{blocks[idx]}</span>
      })}
    </span>
  )
}

// === SVG LINE CHART ===
function LineChart({ data, width: w = 600, height: h = 200, color = '#fff' }) {
  if (!data || data.length < 2) return <div className="fin-chart-empty">Not enough data for chart</div>
  const padL = 55, padR = 20, padT = 15, padB = 25
  const vals = data.map(d => d.value)
  const minV = Math.min(...vals) * 0.995, maxV = Math.max(...vals) * 1.005
  const rangeV = maxV - minV || 1
  const points = vals.map((v, i) => ({
    x: padL + (i / Math.max(vals.length - 1, 1)) * (w - padL - padR),
    y: padT + (1 - (v - minV) / rangeV) * (h - padT - padB)
  }))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:'auto',maxHeight:`${h}px`}}>
      {[0, 0.5, 1].map(pct => {
        const val = minV + pct * rangeV
        const y = padT + (1 - pct) * (h - padT - padB)
        return <text key={pct} x={padL - 5} y={y + 3} fill="#333" fontSize="8" fontFamily="JetBrains Mono" textAnchor="end">${val.toFixed(0)}</text>
      })}
      <text x={padL} y={h - 5} fill="#333" fontSize="7" fontFamily="JetBrains Mono">{data[0].label}</text>
      <text x={w - padR} y={h - 5} fill="#333" fontSize="7" fontFamily="JetBrains Mono" textAnchor="end">{data[data.length-1].label}</text>
      <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
      {points.length <= 30 && points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />)}
    </svg>
  )
}

// === DONUT CHART ===
function DonutChart({ segments, size = 140 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const r = size / 2 - 10, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const pct = seg.value / total
        const dash = pct * circ
        const gap = circ - dash
        const rot = (offset / total) * 360 - 90
        offset += seg.value
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="12"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rot} ${cx} ${cy})`} />
        )
      })}
    </svg>
  )
}

// === PRICE CHART ===
function PriceChart({ history, holdingName, currentPrice, costBasis }) {
  const [period, setPeriod] = useState('ALL')
  const periods = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

  const filtered = useMemo(() => {
    if (!history || history.length === 0) return []
    if (period === 'ALL') return history
    const days = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }[period] || 9999
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    return history.filter(h => h.date >= cutoff)
  }, [history, period])

  if (!history || history.length === 0) {
    return <div className="fin-chart-empty">No price history yet — tracking starts today</div>
  }

  const data = filtered.length >= 2 ? filtered : history
  const firstPrice = data[0].price
  const change = currentPrice - firstPrice
  const changePct = firstPrice > 0 ? ((change / firstPrice) * 100).toFixed(2) : 0
  const isUp = change >= 0

  const w = 800, h = 220, padL = 55, padR = 20, padT = 15, padB = 25
  const prices = data.map(d => d.price)
  const minP = Math.min(...prices) * 0.995, maxP = Math.max(...prices) * 1.005, rangeP = maxP - minP || 1
  const points = prices.map((p, i) => ({
    x: padL + (i / Math.max(prices.length - 1, 1)) * (w - padL - padR),
    y: padT + (1 - (p - minP) / rangeP) * (h - padT - padB)
  }))

  return (
    <div style={{marginTop:'1.5rem',paddingTop:'1rem',borderTop:'1px solid #1a1a1a'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem',marginBottom:'0.75rem'}}>
        <div>
          <span style={{fontFamily:'JetBrains Mono',fontSize:'0.85rem',color:'#fff',fontWeight:600,marginRight:'0.75rem'}}>{holdingName}</span>
          <span style={{fontFamily:'JetBrains Mono',fontSize:'0.9rem',color:'#fff'}}>{fmt(currentPrice)}</span>
          <span style={{color: isUp ? '#22c55e' : '#ef4444', fontSize:'0.75rem', marginLeft:'0.5rem'}}>
            {isUp ? '+' : ''}{fmt(Math.abs(change))} ({isUp ? '+' : ''}{changePct}%)
          </span>
        </div>
        <div className="fin-period-btns">
          {periods.map(p => (
            <button key={p} className={`fin-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:'auto',maxHeight:'220px'}}>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const val = minP + pct * rangeP
          const y = padT + (1 - pct) * (h - padT - padB)
          return <text key={pct} x={padL-5} y={y+3} fill="#333" fontSize="8" fontFamily="JetBrains Mono" textAnchor="end">${val.toFixed(2)}</text>
        })}
        {data.length > 1 && <>
          <text x={padL} y={h-5} fill="#333" fontSize="7" fontFamily="JetBrains Mono">{data[0].date}</text>
          <text x={w-padR} y={h-5} fill="#333" fontSize="7" fontFamily="JetBrains Mono" textAnchor="end">{data[data.length-1].date}</text>
        </>}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
        {points.length <= 30 && points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#fff" />)}
      </svg>
    </div>
  )
}

// === ALLOCATION BAR ===
function AllocationBar({ segments, total }) {
  return (
    <div className="fin-alloc-bar">
      {segments.map((s, i) => (
        <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color, height: '100%', minWidth: '2px' }}
          title={`${s.label}: ${fmt(s.value)}`} />
      ))}
    </div>
  )
}

// === INCOME/EXPENSE BARS ===
function IncomeExpenseBars({ transactions }) {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleString('en-AU', { month: 'short' })
    months.push({ key, label, income: 0, expense: 0 })
  }
  for (const tr of transactions) {
    const m = tr.date?.slice(0, 7)
    const month = months.find(mo => mo.key === m)
    if (month) {
      if (tr.type === 'income' && tr.status === 'completed') month.income += tr.amount
      if (tr.type === 'expense' && tr.status === 'completed') month.expense += tr.amount
    }
  }
  const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1)
  return (
    <div className="ie-bars">
      {months.map((m, i) => (
        <div key={i} className="ie-month">
          <div className="ie-col">
            <div className="ie-bar ie-bar-income" style={{height: `${(m.income / maxVal) * 80}px`}} title={fmt(m.income)} />
            <div className="ie-bar ie-bar-expense" style={{height: `${(m.expense / maxVal) * 80}px`}} title={fmt(m.expense)} />
          </div>
          <div className="ie-label">{m.label}</div>
        </div>
      ))}
      <div className="ie-legend">
        <span style={{color:'#22c55e',fontSize:'0.65rem'}}>■ income</span>
        <span style={{color:'#ef4444',fontSize:'0.65rem'}}>■ expense</span>
      </div>
    </div>
  )
}

// === INCOME BY CLIENT BARS ===
function IncomeByClient({ transactions }) {
  const clientTotals = {}
  for (const tr of transactions) {
    if (tr.type === 'income' && tr.status === 'completed' && tr.project_name) {
      clientTotals[tr.project_name] = (clientTotals[tr.project_name] || 0) + tr.amount
    }
  }
  const clients = Object.entries(clientTotals).sort((a, b) => b[1] - a[1])
  const max = clients.length > 0 ? clients[0][1] : 1
  if (clients.length === 0) return <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'1rem'}}>No client income data</div>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
      {clients.map(([name, amount], i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <span style={{fontFamily:'JetBrains Mono',fontSize:'0.7rem',color:'#999',minWidth:'100px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
          <div style={{flex:1,height:'16px',background:'#111',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${(amount/max)*100}%`,background:'rgba(255,255,255,0.6)',transition:'width 0.6s'}} />
          </div>
          <span style={{fontFamily:'JetBrains Mono',fontSize:'0.75rem',color:'#fff',fontWeight:600,minWidth:'80px',textAlign:'right'}}>{fmt(amount)}</span>
        </div>
      ))}
    </div>
  )
}

// === MAIN FINANCE PAGE ===
export default function FinancePage() {
  const [unlocked, setUnlocked] = useState(false)
  const [data, setData] = useState(null)
  const [liveHoldings, setLiveHoldings] = useState(null)
  const [selectedHolding, setSelectedHolding] = useState(null)
  const [txFilter, setTxFilter] = useState('all')

  useEffect(() => {
    const was = sessionStorage.getItem('woozy-unlocked') === 'true'
    if (was) setUnlocked(true)
  }, [])

  useEffect(() => {
    if (!unlocked) return
    fetch('/api/finance').then(r => r.json()).then(setData).catch(() => {})
    fetch('/api/prices').then(r => r.json()).then(d => setLiveHoldings(d.holdings)).catch(() => {})
  }, [unlocked])

  const handleUnlock = useCallback(() => {
    setUnlocked(true)
    sessionStorage.setItem('woozy-unlocked', 'true')
  }, [])

  if (!unlocked) {
    return (
      <div style={{maxWidth:'1400px',margin:'0 auto',padding:'2rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'2rem'}}>
          <div style={{fontFamily:'JetBrains Mono',fontSize:'0.75rem',color:'#666',letterSpacing:'0.15em'}}>
            ── FINANCE ──
          </div>
          <Link href="/" style={{fontFamily:'JetBrains Mono',fontSize:'0.7rem',color:'#555',textDecoration:'none'}}>← DASHBOARD</Link>
        </div>
        <div className="card full"><PinLock onUnlock={handleUnlock} /></div>
      </div>
    )
  }

  if (!data) return <div className="loading">LOADING FINANCIAL DATA...</div>

  const { accounts, holdings: dbHoldings, transactions, netWorthHistory, priceHistory, goals, freelanceProjects, summary } = data
  const holdings = liveHoldings || dbHoldings

  const liquid = (accounts.find(a => a.name === 'Checking')?.balance || 0) +
                 (accounts.find(a => a.name === 'Savings')?.balance || 0) +
                 (accounts.find(a => a.name === 'Cash')?.balance || 0)
  const hndqVal = holdings.find(h => h.name === 'HNDQ')?.current_value || 0
  const goldVal = holdings.find(h => h.name === 'Gold')?.current_value || 0
  const receivables = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + t.amount, 0)
  const netWorth = liquid + hndqVal + goldVal + receivables

  const totalCost = holdings.reduce((s, h) => s + (h.cost_basis || 0), 0)
  const totalCurrent = holdings.reduce((s, h) => s + (h.current_value || 0), 0)
  const gain = totalCurrent - totalCost
  const gainPct = totalCost > 0 ? ((gain / totalCost) * 100).toFixed(1) : 0
  const isUp = gain >= 0

  const segments = [
    { label: 'Liquid Cash', value: liquid, color: 'rgba(255,255,255,0.85)' },
    { label: 'HNDQ', value: hndqVal, color: 'rgba(255,255,255,0.55)' },
    { label: 'Gold', value: goldVal, color: 'rgba(255,255,255,0.35)' },
    { label: 'Receivables', value: receivables, color: 'rgba(214,163,50,0.6)' },
  ].filter(s => s.value > 0)

  const filteredTx = transactions.filter(t => {
    if (txFilter === 'income') return t.type === 'income'
    if (txFilter === 'expense') return t.type === 'expense'
    if (txFilter === 'pending') return t.status === 'pending'
    return true
  })

  const txTotalIncome = filteredTx.filter(t => t.type === 'income' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const txTotalExpense = filteredTx.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)

  const savingsRate = summary.monthlyIncome > 0 
    ? ((summary.monthlyIncome - summary.monthlyExpenses) / summary.monthlyIncome * 100).toFixed(0) 
    : summary.monthlyIncome === 0 && summary.monthlyExpenses === 0 ? '—' : '0'

  return (
    <div style={{maxWidth:'1400px',margin:'0 auto',padding:'1.5rem',fontFamily:'JetBrains Mono, monospace'}}>
      {/* NAV */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
        <Link href="/" style={{fontFamily:'JetBrains Mono',fontSize:'0.7rem',color:'#555',textDecoration:'none',border:'1px solid #222',padding:'0.3rem 0.6rem'}}>← DASHBOARD</Link>
        <div style={{fontSize:'0.65rem',color:'#333'}}>WOOZY FINANCE</div>
      </div>

      {/* NET WORTH HERO */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <div className="section-header">Net Worth</div>
        <div style={{display:'flex',alignItems:'baseline',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem'}}>
          <span style={{fontSize:'2rem',fontWeight:700,color:'#fff'}}>{fmt(netWorth)}</span>
          <span style={{color: isUp ? '#22c55e' : '#ef4444', fontSize:'0.85rem'}}>
            {isUp ? '+' : ''}{fmt(Math.abs(gain))} ({isUp ? '+' : ''}{gainPct}%)
          </span>
        </div>
        <AllocationBar segments={segments} total={netWorth} />
        <div style={{display:'flex',flexDirection:'column',gap:'0.35rem',marginTop:'0.75rem'}}>
          {segments.map((s, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.75rem'}}>
              <span style={{width:'8px',height:'8px',background:s.color,flexShrink:0}} />
              <span style={{color:'#999',minWidth:'100px'}}>{s.label}</span>
              <span style={{color:'#fff',minWidth:'80px',textAlign:'right'}}>{fmt(s.value)}</span>
              <span style={{color:'#555',fontSize:'0.65rem'}}>({((s.value / netWorth) * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* ACCOUNT CARDS */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:'0.75rem',marginBottom:'1.5rem'}}>
        {accounts.map((a, i) => {
          const holding = holdings.find(h => 
            (a.name === 'Investments' && h.name === 'HNDQ') ||
            (a.name === 'Gold' && h.name === 'Gold')
          )
          const liveVal = holding ? holding.current_value : a.balance
          const isHolding = !!holding
          const hGain = holding?.gain || 0
          const hPct = holding?.gainPct || 0
          const hUp = hGain >= 0
          const displayName = a.name === 'Investments' ? 'HNDQ' : a.name === 'Gold' ? 'GOLD 20g' : a.name.toUpperCase()
          return (
            <div key={i} className="card" style={{padding:'1rem',cursor: isHolding ? 'pointer' : 'default'}}
              onClick={() => isHolding && setSelectedHolding(prev => prev?.id === holding.id ? null : holding)}>
              <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.35rem'}}>{displayName}</div>
              <div style={{fontSize:'1.1rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>{fmt(liveVal)}</div>
              {a.institution && <div style={{fontSize:'0.6rem',color:'#333'}}>{a.institution}</div>}
              {isHolding && (
                <div style={{fontSize:'0.7rem',color: hUp ? '#22c55e' : '#ef4444',marginTop:'0.25rem'}}>
                  {hUp ? '+' : ''}{hPct.toFixed(1)}% {hUp ? '▲' : '▼'}
                </div>
              )}
              {isHolding && <div style={{marginTop:'0.35rem'}}><Sparkline data={priceHistory[holding.id]?.map(h => h.price)} /></div>}
            </div>
          )
        })}
      </div>

      {/* HOLDINGS DETAIL */}
      {selectedHolding && (
        <div className="card full" style={{marginBottom:'1.5rem'}}>
          <PriceChart
            history={priceHistory[selectedHolding.id] || []}
            holdingName={selectedHolding.name}
            currentPrice={selectedHolding.current_price}
            costBasis={selectedHolding.cost_basis / selectedHolding.quantity}
          />
        </div>
      )}

      {/* ROW 2: CHARTS */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginBottom:'1.5rem'}}>
        <div className="card">
          <div className="section-header">Net Worth Trend</div>
          {netWorthHistory.length >= 2 ? (
            <LineChart data={netWorthHistory.map(s => ({ value: s.total, label: s.date }))} />
          ) : (
            <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'2rem'}}>
              Snapshots build over time
            </div>
          )}
        </div>
        <div className="card">
          <div className="section-header">Asset Allocation</div>
          <div style={{display:'flex',alignItems:'center',gap:'1.5rem',justifyContent:'center'}}>
            <DonutChart segments={segments} size={130} />
            <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
              {segments.map((s, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.7rem'}}>
                  <span style={{width:'8px',height:'8px',background:s.color}} />
                  <span style={{color:'#999'}}>{s.label}</span>
                  <span style={{color:'#fff',fontWeight:600}}>{((s.value/netWorth)*100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: INCOME & EXPENSES */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginBottom:'1.5rem'}}>
        <div className="card">
          <div className="section-header">Income vs Expenses</div>
          <IncomeExpenseBars transactions={transactions} />
        </div>
        <div className="card">
          <div className="section-header">Income by Client</div>
          <IncomeByClient transactions={transactions} />
        </div>
      </div>

      {/* ROW 4: TRANSACTIONS */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
          <div className="section-header" style={{marginBottom:0,borderBottom:'none',paddingBottom:0}}>Transactions</div>
          <div style={{display:'flex',gap:'0.25rem'}}>
            {['all','income','expense','pending'].map(f => (
              <button key={f} className={`fin-period-btn ${txFilter === f ? 'active' : ''}`}
                onClick={() => setTxFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="fin-tx-table">
          <div className="fin-tx-header">
            <span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span>Account</span><span>Status</span>
          </div>
          {filteredTx.map((tr, i) => {
            const isIncome = tr.type === 'income'
            const isPending = tr.status === 'pending'
            return (
              <div key={i} className={`fin-tx-row ${isPending ? 'fin-tx-pending' : ''}`}>
                <span className="fin-tx-date">{tr.date}</span>
                <span className="fin-tx-desc">{tr.description}{tr.project_name ? ` — ${tr.project_name}` : ''}</span>
                <span className="fin-tx-cat">{tr.category || '—'}</span>
                <span className={isIncome ? 'money-positive' : 'money-negative'}>
                  {isIncome ? '+' : '-'}{fmt(tr.amount)}
                </span>
                <span className="fin-tx-acct">{tr.account_name || '—'}</span>
                <span className={`status-tag ${tr.status === 'completed' ? 'status-active' : tr.status === 'pending' ? 'status-pending' : 'status-inactive'}`}>{tr.status}</span>
              </div>
            )
          })}
          {filteredTx.length > 0 && (
            <div style={{display:'flex',justifyContent:'flex-end',gap:'1.5rem',paddingTop:'0.75rem',borderTop:'1px solid #222',marginTop:'0.5rem',fontSize:'0.75rem'}}>
              <span style={{color:'#22c55e'}}>Income: {fmt(txTotalIncome)}</span>
              <span style={{color:'#ef4444'}}>Expenses: {fmt(txTotalExpense)}</span>
              <span style={{color:'#fff',fontWeight:600}}>Net: {fmt(txTotalIncome - txTotalExpense)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ROW 5: FREELANCE PIPELINE */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <div className="section-header">Freelance Pipeline</div>
        {freelanceProjects.length > 0 ? (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {freelanceProjects.map((p, i) => {
              const totalVal = p.total_value || 0
              const paid = p.total_paid || 0
              const pending = p.total_pending || 0
              const paidPct = totalVal > 0 ? (paid / totalVal) * 100 : 0
              // Find related transactions for milestones
              const projectTx = transactions.filter(t => t.project_name === p.name && t.type === 'income')
              return (
                <div key={i} style={{padding:'1rem',border:'1px solid #1a1a1a'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <div>
                      <span style={{fontSize:'0.85rem',fontWeight:600,color:'#fff'}}>{p.name}</span>
                      {p.client_name && <span style={{fontSize:'0.7rem',color:'#555',marginLeft:'0.75rem'}}>{p.client_name}</span>}
                    </div>
                    <span className={`status-tag ${p.status === 'active' ? 'status-active' : 'status-inactive'}`}>{p.status}</span>
                  </div>
                  {totalVal > 0 && (
                    <>
                      <div style={{height:'8px',background:'#111',width:'100%',marginBottom:'0.5rem'}}>
                        <div style={{height:'100%',background:'#22c55e',width:`${paidPct}%`,transition:'width 0.8s'}} />
                      </div>
                      <div style={{display:'flex',gap:'1rem',fontSize:'0.7rem'}}>
                        <span style={{color:'#22c55e'}}>{fmt(paid)} paid</span>
                        {pending > 0 && <span style={{color:'#d97706'}}>{fmt(pending)} pending</span>}
                        <span style={{color:'#555'}}>{fmt(totalVal)} total</span>
                      </div>
                    </>
                  )}
                  {/* Milestone timeline */}
                  {projectTx.length > 0 && (
                    <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem',flexWrap:'wrap'}}>
                      {projectTx.map((tx, j) => (
                        <div key={j} style={{
                          fontSize:'0.6rem',padding:'0.25rem 0.5rem',border:'1px solid',
                          borderColor: tx.status === 'completed' ? 'rgba(34,197,94,0.3)' : 'rgba(214,163,50,0.3)',
                          color: tx.status === 'completed' ? '#22c55e' : '#d97706',
                        }}>
                          {tx.date} · {tx.description.slice(0, 25)} · {fmt(tx.amount)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'2rem'}}>No freelance projects</div>
        )}
      </div>

      {/* ROW 6: GOALS */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <div className="section-header">Goals</div>
        {goals && goals.length > 0 ? (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {goals.map((g, i) => {
              const current = g.current_amount || 0
              const pct = Math.min((current / g.target_amount) * 100, 100)
              const reached = pct >= 100
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'0.8rem',color:'#fff',fontWeight:600,minWidth:'140px'}}>{g.name}</span>
                  <span style={{fontSize:'0.7rem',color:'#555',minWidth:'100px'}}>{fmt(g.target_amount)} target</span>
                  <span style={{fontSize:'0.7rem',color:'#999',minWidth:'100px'}}>{fmt(current)} saved</span>
                  <div style={{flex:1,minWidth:'120px',height:'12px',background:'#111',overflow:'hidden'}}>
                    <div style={{height:'100%',background: reached ? '#22c55e' : 'rgba(255,255,255,0.6)',width:`${pct}%`,transition:'width 0.8s'}} />
                  </div>
                  <span style={{fontSize:'0.75rem',color: reached ? '#22c55e' : '#999',fontWeight:600,minWidth:'60px',textAlign:'right'}}>
                    {pct.toFixed(1)}%{reached ? ' ✓' : ''}
                  </span>
                  {g.deadline && <span style={{fontSize:'0.6rem',color:'#333'}}>by {g.deadline}</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{color:'#555',fontSize:'0.75rem',textAlign:'center',padding:'2rem'}}>No goals set</div>
        )}
      </div>

      {/* ROW 7: MONTHLY SUMMARY */}
      <div className="card full" style={{marginBottom:'1.5rem'}}>
        <div className="section-header">{summary.monthName} {summary.year}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:'1rem'}}>
          <div>
            <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.25rem'}}>Income</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:'#22c55e'}}>{fmt(summary.monthlyIncome)}</div>
          </div>
          <div>
            <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.25rem'}}>Expenses</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color: summary.monthlyExpenses > 0 ? '#ef4444' : '#999'}}>{fmt(summary.monthlyExpenses)}</div>
          </div>
          <div>
            <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.25rem'}}>Net</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>+{fmt(summary.monthlyIncome - summary.monthlyExpenses)}</div>
          </div>
          <div>
            <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.25rem'}}>Savings Rate</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>{savingsRate}%</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{fontSize:'0.65rem',color:'#333',textAlign:'center',padding:'2rem 0',letterSpacing:'0.1em'}}>
        WOOZY FINANCE · LAST UPDATE {new Date(data.updated).toLocaleString('en-AU', {hour:'2-digit',minute:'2-digit',hour12:false})}
      </div>
    </div>
  )
}
