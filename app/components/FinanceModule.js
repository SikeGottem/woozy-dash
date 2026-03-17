'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmt, COLORS } from '../lib/helpers'
import MiniStat from './ui/MiniStat'

// === PIN LOCK ===
function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => { const i = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500); return () => clearInterval(i) }, [])

  useEffect(() => {
    const handler = (e) => {
      if (error) return
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          const next = (prev + e.key).slice(0, 4)
          if (next.length === 4) {
            if (next === '2238') {
              sessionStorage.setItem('woozy-unlocked', 'true')
              setTimeout(() => onUnlock(), 200)
            } else {
              setError(true)
              setTimeout(() => { setError(false); setPin('') }, 1200)
            }
          }
          return next
        })
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [error, onUnlock])

  return (
    <div className="lock-overlay">
      <div className="lock-container">
        <svg className="lock-icon-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div className="lock-title">ENCRYPTED</div>
        <div className="lock-subtitle">Financial data requires authorization{dots}</div>
        <div className={`lock-dots-main ${error ? 'lock-error' : ''}`}>
          {[0,1,2,3].map(i => <div key={i} className={`lock-dot ${pin.length > i ? 'lock-dot-filled' : ''} ${error ? 'lock-dot-error' : ''}`} />)}
        </div>
        {error && <div className="lock-error-msg">ACCESS DENIED</div>}
      </div>
    </div>
  )
}

function DecryptReveal({ children, unlocked }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { 
    if (unlocked) { const t = setTimeout(() => setRevealed(true), 100); return () => clearTimeout(t) } 
    else { setRevealed(false) }
  }, [unlocked])
  if (!unlocked) return null
  return <div className={`decrypt ${revealed ? 'decrypted' : ''}`}>{children}</div>
}

export { PinLock, DecryptReveal }

// === SPARKLINE ===
function Sparkline({ data, width = 120, height = 24 }) {
  if (!data || data.length < 2) return <span style={{color:'#333',fontSize:'0.7rem'}}>no data</span>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
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
function PriceChart({ history, holdingName, currentPrice, costBasis }) {
  const [chartPeriod, setChartPeriod] = useState('ALL')
  
  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return []
    if (chartPeriod === 'ALL') return history
    const now = new Date()
    const cutoffs = {
      '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365
    }
    const days = cutoffs[chartPeriod] || 9999
    const cutoff = new Date(now - days * 86400000).toISOString().split('T')[0]
    return history.filter(h => h.date >= cutoff)
  }, [history, chartPeriod])

  const periods = ['1D', '1W', '1M', '3M', '1Y', 'ALL']
  const hasEnoughData = (period) => {
    if (period === 'ALL') return history.length >= 1
    const days = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }[period]
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    return history.some(h => h.date <= cutoff)
  }

  const trackingSince = history.length > 0 ? history[0].date : null
  const firstPrice = filteredHistory.length > 0 ? filteredHistory[0].price : costBasis
  const change = currentPrice - firstPrice
  const changePct = firstPrice > 0 ? ((change / firstPrice) * 100).toFixed(2) : 0
  const isUp = change >= 0

  if (!history || history.length === 0) {
    return (
      <div className="fin-chart-container">
        <div className="fin-chart-header">
          <span className="fin-chart-title">{holdingName}</span>
        </div>
        <div className="fin-chart-empty">No price history yet — tracking starts today</div>
      </div>
    )
  }

  const data = filteredHistory.length >= 2 ? filteredHistory : history
  const prices = data.map(d => d.price)
  const dates = data.map(d => d.date)
  const w = 600, h = 200, padL = 50, padR = 20, padT = 20, padB = 30
  const minP = Math.min(...prices) * 0.995
  const maxP = Math.max(...prices) * 1.005
  const rangeP = maxP - minP || 1

  const points = prices.map((p, i) => {
    const x = padL + (i / Math.max(prices.length - 1, 1)) * (w - padL - padR)
    const y = padT + (1 - (p - minP) / rangeP) * (h - padT - padB)
    return { x, y }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <div className="fin-chart-container">
      <div className="fin-chart-header">
        <div>
          <span className="fin-chart-title">{holdingName}</span>
          <span className="fin-chart-price">{fmt(currentPrice)}</span>
          <span style={{color: isUp ? '#22c55e' : '#ef4444', fontSize:'0.75rem', marginLeft:'0.5rem'}}>
            {isUp ? '+' : ''}{fmt(Math.abs(change))} ({isUp ? '+' : ''}{changePct}%)
          </span>
        </div>
        <div className="fin-period-btns">
          {periods.map(p => {
            const available = hasEnoughData(p)
            return (
              <button key={p} 
                className={`fin-period-btn ${chartPeriod === p ? 'active' : ''} ${!available ? 'disabled' : ''}`}
                onClick={() => available && setChartPeriod(p)}
              >{p}</button>
            )
          })}
        </div>
      </div>
      {trackingSince && filteredHistory.length < 2 && (
        <div style={{fontSize:'0.65rem',color:'#555',marginBottom:'0.5rem'}}>tracking since {trackingSince}</div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="fin-chart-svg">
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const val = minP + pct * rangeP
          const y = padT + (1 - pct) * (h - padT - padB)
          return <text key={pct} x={padL - 5} y={y + 3} fill="#333" fontSize="8" fontFamily="JetBrains Mono" textAnchor="end">${val.toFixed(2)}</text>
        })}
        {/* X-axis labels */}
        {dates.length > 1 && <>
          <text x={padL} y={h - 5} fill="#333" fontSize="8" fontFamily="JetBrains Mono">{dates[0]}</text>
          <text x={w - padR} y={h - 5} fill="#333" fontSize="8" fontFamily="JetBrains Mono" textAnchor="end">{dates[dates.length - 1]}</text>
        </>}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
        {points.length <= 30 && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#fff" />
        ))}
      </svg>
    </div>
  )
}

// === ALLOCATION BAR ===
function AllocationBar({ segments, total }) {
  return (
    <div className="fin-alloc-bar">
      {segments.map((s, i) => (
        <div key={i} className="fin-alloc-segment" style={{
          width: `${(s.value / total) * 100}%`,
          background: s.color,
        }} title={`${s.label}: ${fmt(s.value)}`} />
      ))}
    </div>
  )
}

// === NET WORTH OVERVIEW ===
function NetWorthOverview({ summary, accounts, liveHoldings, transactions, priceData }) {
  const [period, setPeriod] = useState('ALL')
  
  const liquid = (accounts.find(a => a.name === 'Checking')?.balance || 0) +
                 (accounts.find(a => a.name === 'Savings')?.balance || 0) +
                 (accounts.find(a => a.name === 'Cash')?.balance || 0)
  const hndqVal = liveHoldings.find(h => h.name === 'HNDQ')?.current_value || 0
  const goldVal = liveHoldings.find(h => h.name === 'Gold')?.current_value || 0
  const receivables = transactions
    .filter(t => t.type === 'income' && t.status === 'pending')
    .reduce((s, t) => s + t.amount, 0)
  const invested = hndqVal
  const gold = goldVal
  const netWorth = liquid + invested + gold + receivables
  
  // Cost basis gain
  const totalCost = liveHoldings.reduce((s, h) => s + (h.cost_basis || 0), 0)
  const totalCurrent = liveHoldings.reduce((s, h) => s + (h.current_value || 0), 0)
  const gain = totalCurrent - totalCost
  const gainPct = totalCost > 0 ? ((gain / totalCost) * 100).toFixed(1) : 0
  const isUp = gain >= 0

  const segments = [
    { label: 'Liquid', value: liquid, color: 'rgba(255,255,255,0.85)' },
    { label: 'Invested', value: invested, color: 'rgba(255,255,255,0.55)' },
    { label: 'Gold', value: gold, color: 'rgba(255,255,255,0.35)' },
    { label: 'Receivables', value: receivables, color: 'rgba(214,163,50,0.6)' },
  ].filter(s => s.value > 0)

  const periods = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

  return (
    <div className="card full">
      <div className="section-header">Net Worth</div>
      <div className="fin-nw-overview">
        <div className="fin-nw-top">
          <span className="fin-nw-amount">{fmt(netWorth)}</span>
          <span className="fin-nw-change" style={{color: isUp ? '#22c55e' : '#ef4444'}}>
            {isUp ? '+' : ''}{fmt(Math.abs(gain))} ({isUp ? '+' : ''}{gainPct}%)
          </span>
          <div className="fin-period-btns" style={{marginLeft:'auto'}}>
            {periods.map(p => (
              <button key={p} 
                className={`fin-period-btn ${period === p ? 'active' : ''} ${p !== 'ALL' ? 'disabled' : ''}`}
                onClick={() => p === 'ALL' && setPeriod(p)}
              >{p}</button>
            ))}
          </div>
        </div>
        <AllocationBar segments={segments} total={netWorth} />
        <div className="fin-alloc-legend">
          {segments.map((s, i) => (
            <div key={i} className="fin-alloc-item">
              <span className="fin-alloc-dot" style={{background: s.color}} />
              <span className="fin-alloc-label">{s.label}</span>
              <span className="fin-alloc-val">{fmt(s.value)}</span>
              <span className="fin-alloc-pct">({((s.value / netWorth) * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
      {/* Account breakdown */}
      <div className="fin-accounts-grid">
        {accounts.map((a, i) => (
          <div key={i} className="fin-account-item">
            <span className="fin-account-name">{a.name}</span>
            <span className="fin-account-bal">{fmt(a.balance)}</span>
            <span className="fin-account-type">{a.type}{a.institution ? ` · ${a.institution}` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// === HOLDINGS CARD ===
function HoldingCard({ holding, priceHistory, selected, onClick }) {
  const isUp = holding.gain >= 0
  const sparkData = priceHistory?.map(h => h.price) || []
  
  return (
    <div className={`fin-holding-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="fin-holding-card-top">
        <span className="fin-holding-card-name">
          {holding.name}{holding.notes ? ` · ${holding.notes.split(' - ')[0]}` : ''}
        </span>
      </div>
      <div className="fin-holding-card-mid">
        <span className="fin-holding-card-value">{fmt(holding.current_value)}</span>
        <span style={{color: isUp ? '#22c55e' : '#ef4444', fontSize:'0.75rem'}}>
          {isUp ? '+' : ''}{fmt(Math.abs(holding.gain))} ({isUp ? '+' : ''}{holding.gainPct}%)
        </span>
      </div>
      <div className="fin-holding-card-detail">
        {holding.name === 'Gold' 
          ? `${holding.quantity}g @ ${fmt(holding.current_price)}/g`
          : `${holding.quantity.toFixed(2)} units @ ${fmt(holding.current_price)}`
        }
      </div>
      <div className="fin-holding-card-spark">
        <Sparkline data={sparkData} />
      </div>
    </div>
  )
}

// === INCOME VS EXPENSE BARS ===
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

// === MAIN MODULE ===
export default function FinanceModule({ data, unlocked, onUnlock }) {
  const accounts = data.accounts || []
  const transactions = data.transactions || []
  const netWorthHistory = data.netWorthHistory || []
  const summary = data.summary || {}
  const freelanceProjects = data.freelanceProjects || []
  const holdings = data.holdings || []
  const [priceData, setPriceData] = useState(null)
  const [priceHistory, setPriceHistory] = useState({})
  const [selectedHolding, setSelectedHolding] = useState(null)

  useEffect(() => {
    if (!unlocked) return
    fetch('/api/prices')
      .then(r => r.json())
      .then(d => setPriceData(d))
      .catch(() => {})
    fetch('/api/price-history')
      .then(r => r.json())
      .then(d => {
        const byHolding = {}
        for (const row of d.history || []) {
          if (!byHolding[row.holding_id]) byHolding[row.holding_id] = []
          byHolding[row.holding_id].push(row)
        }
        setPriceHistory(byHolding)
      })
      .catch(() => {})
  }, [unlocked])

  const liveHoldings = priceData?.holdings || holdings

  const liveSummary = { ...summary }
  if (priceData?.totalInvestmentValue) {
    liveSummary.invested = priceData.totalInvestmentValue
    liveSummary.netWorth = liveSummary.liquid + liveSummary.invested + liveSummary.receivables
  }

  const handleHoldingClick = useCallback((holding) => {
    setSelectedHolding(prev => prev?.id === holding.id ? null : holding)
  }, [])

  const timeStr = priceData?.lastUpdated 
    ? new Date(priceData.lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' }) 
    : null

  return (
    <div className="section-finances">
      <div className="section-title">FINANCES {!unlocked && <span style={{fontSize:'0.7rem',color:'#666',marginLeft:'0.5rem'}}>// LOCKED</span>}</div>
      {!unlocked && <div className="card full"><PinLock onUnlock={onUnlock} /></div>}
      <div className="grid">
        {/* NET WORTH OVERVIEW */}
        <DecryptReveal unlocked={unlocked}>
          <NetWorthOverview 
            summary={liveSummary} 
            accounts={accounts} 
            liveHoldings={liveHoldings}
            transactions={transactions}
            priceData={priceData}
          />
        </DecryptReveal>

        {/* LIVE HOLDINGS */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="section-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Holdings</span>
              {timeStr && <span style={{fontSize:'0.65rem',color:'#555',fontWeight:'normal'}}>prices as of {timeStr}</span>}
            </div>
            <div className="fin-holdings-cards">
              {liveHoldings.map((h, i) => (
                <HoldingCard 
                  key={i} 
                  holding={h}
                  priceHistory={priceHistory[h.id]}
                  selected={selectedHolding?.id === h.id}
                  onClick={() => handleHoldingClick(h)}
                />
              ))}
            </div>
            {selectedHolding && (
              <PriceChart 
                history={priceHistory[selectedHolding.id] || []}
                holdingName={selectedHolding.name}
                currentPrice={selectedHolding.current_price}
                costBasis={selectedHolding.cost_basis / selectedHolding.quantity}
              />
            )}
          </div>
        </DecryptReveal>

        {/* STATS ROW */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="fin-stats-row">
              <MiniStat label="Month Income" value={fmt(liveSummary.monthlyIncome || 0)} color="#22c55e" />
              <MiniStat label="Month Spend" value={fmt(liveSummary.monthlyExpenses || 0)} color={liveSummary.monthlyExpenses > 0 ? '#ef4444' : '#999'} />
            </div>
          </div>
        </DecryptReveal>

        {/* CHARTS */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card">
            <div className="section-header">Income vs Expenses</div>
            <IncomeExpenseBars transactions={transactions} />
          </div>
        </DecryptReveal>

        <DecryptReveal unlocked={unlocked}>
          <div className="card">
            <div className="section-header">Net Worth Trend</div>
            <NetWorthLine snapshots={netWorthHistory} />
          </div>
        </DecryptReveal>

        {/* TRANSACTIONS */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="section-header">Recent Transactions</div>
            {transactions.length > 0 ? (
              <div className="fin-tx-table">
                <div className="fin-tx-header">
                  <span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span>Account</span><span>Status</span>
                </div>
                {transactions.slice(0, 15).map((tr, i) => {
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
              </div>
            ) : (
              <div className="empty-visual"><div className="empty-icon">—</div><div>No transactions yet</div></div>
            )}
          </div>
        </DecryptReveal>

        {/* FREELANCE PIPELINE */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="section-header">Freelance Pipeline</div>
            {freelanceProjects.length > 0 ? (
              <div className="fin-pipeline">
                {freelanceProjects.map((p, i) => {
                  const totalVal = p.total_value || 0
                  const paid = p.total_paid || 0
                  const pending = p.total_pending || 0
                  const paidPct = totalVal > 0 ? (paid / totalVal) * 100 : 0
                  return (
                    <div key={i} className="fin-pipeline-item">
                      <div className="fin-pipeline-top">
                        <span className="fin-pipeline-name">{p.name}</span>
                        <span className={`status-tag ${p.status === 'active' ? 'status-active' : p.status === 'done' ? 'status-inactive' : 'status-pending'}`}>{p.status}</span>
                      </div>
                      {totalVal > 0 && (
                        <>
                          <div className="fin-pipeline-bar-track">
                            <div className="fin-pipeline-bar-fill" style={{width: `${paidPct}%`}} />
                          </div>
                          <div className="fin-pipeline-nums">
                            <span style={{color:'#22c55e'}}>{fmt(paid)} paid</span>
                            {pending > 0 && <span style={{color:'#d97706'}}>{fmt(pending)} pending</span>}
                            <span style={{color:'#555'}}>{fmt(totalVal)} total</span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-visual"><div className="empty-icon">—</div><div>No freelance projects</div></div>
            )}
          </div>
        </DecryptReveal>
      </div>
    </div>
  )
}

// === NET WORTH LINE CHART (SVG) ===
function NetWorthLine({ snapshots }) {
  if (!snapshots || snapshots.length < 2) {
    return <div className="empty-visual"><div className="empty-icon">—</div><div>Not enough data for trend</div><div className="empty-sub">Snapshots build over time</div></div>
  }
  const w = 400, h = 120, pad = 30
  const vals = snapshots.map(s => s.total)
  const min = Math.min(...vals) * 0.95
  const max = Math.max(...vals) * 1.05
  const range = max - min || 1
  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="nw-line-chart" style={{width:'100%',height:'auto'}}>
      <polyline points={points.join(' ')} fill="none" stroke="#fff" strokeWidth="1.5" />
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (w - pad * 2)
        const y = h - pad - ((v - min) / range) * (h - pad * 2)
        return <circle key={i} cx={x} cy={y} r="3" fill="#fff" />
      })}
      <text x={pad} y={h - 5} fill="#555" fontSize="9" fontFamily="JetBrains Mono">{snapshots[0].date}</text>
      <text x={w - pad} y={h - 5} fill="#555" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">{snapshots[snapshots.length-1].date}</text>
    </svg>
  )
}
