'use client'
import { useState, useEffect } from 'react'
import { fmt, COLORS } from '../lib/helpers'
import DonutChart from './charts/DonutChart'
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

// === INCOME VS EXPENSE BARS (last 6 months) ===
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

// === LIVE HOLDINGS CARD ===
function HoldingsCard({ holdings, priceData }) {
  if (!holdings || holdings.length === 0) return null
  const lastUpdated = priceData?.lastUpdated
  const timeStr = lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' }) : null

  return (
    <div className="card full">
      <div className="section-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>Live Holdings</span>
        {timeStr && <span style={{fontSize:'0.65rem',color:'#555',fontWeight:'normal'}}>prices as of {timeStr}</span>}
      </div>
      <div className="fin-holdings-grid">
        {holdings.map((h, i) => {
          const isUp = h.gain >= 0
          return (
            <div key={i} className="fin-holding-item">
              <div className="fin-holding-top">
                <span className="fin-holding-name">{h.name === 'Gold' ? `Gold ${h.quantity}g` : h.name}</span>
                <span className="fin-holding-value">{fmt(h.current_value)}</span>
              </div>
              <div className="fin-holding-bottom">
                <span style={{fontSize:'0.7rem',color:'#555'}}>
                  {h.name === 'Gold' ? `${fmt(h.current_price)}/g` : `${fmt(h.current_price)}/unit × ${Math.round(h.quantity)}`}
                </span>
                <span style={{fontSize:'0.7rem',color: isUp ? '#22c55e' : '#ef4444'}}>
                  {isUp ? '▲' : '▼'} {fmt(Math.abs(h.gain))} ({isUp ? '+' : ''}{h.gainPct}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FinanceModule({ data, unlocked, onUnlock }) {
  const accounts = data.accounts || []
  const transactions = data.transactions || []
  const netWorthHistory = data.netWorthHistory || []
  const summary = data.summary || {}
  const freelanceProjects = data.freelanceProjects || []
  const holdings = data.holdings || []
  const [priceData, setPriceData] = useState(null)

  // Fetch live prices on mount
  useEffect(() => {
    if (!unlocked) return
    fetch('/api/prices')
      .then(r => r.json())
      .then(d => setPriceData(d))
      .catch(() => {})
  }, [unlocked])

  // Use live holdings data if available
  const liveHoldings = priceData?.holdings || holdings

  // Asset allocation segments - use live values for investments/gold
  const hndqVal = liveHoldings.find(h => h.name === 'HNDQ')?.current_value || 0
  const goldVal = liveHoldings.find(h => h.name === 'Gold')?.current_value || 0
  
  const acctColors = {
    'Checking': 'rgba(255,255,255,0.9)',
    'Savings': 'rgba(255,255,255,0.6)',
    'Cash': 'rgba(255,255,255,0.35)',
    'HNDQ': 'rgba(0,255,65,0.7)',
    'Gold': 'rgba(0,255,65,0.45)',
  }
  
  // Build segments: cash accounts + live holdings
  const cashAccounts = accounts.filter(a => !['Investments', 'Gold'].includes(a.name))
  const assetSegments = [
    ...cashAccounts.map(a => ({ label: a.name, value: a.balance, color: acctColors[a.name] || '#666' })),
    ...(hndqVal > 0 ? [{ label: 'HNDQ', value: hndqVal, color: acctColors['HNDQ'] }] : []),
    ...(goldVal > 0 ? [{ label: 'Gold', value: goldVal, color: acctColors['Gold'] }] : []),
  ].filter(s => s.value > 0)
  const totalAssets = assetSegments.reduce((s, a) => s + a.value, 0)

  // Trend arrow
  // Recalculate net worth with live prices
  const liveSummary = { ...summary }
  if (priceData?.totalInvestmentValue) {
    liveSummary.invested = priceData.totalInvestmentValue
    liveSummary.netWorth = liveSummary.liquid + liveSummary.invested + liveSummary.receivables
  }

  const lastSnapshot = netWorthHistory.length >= 2 ? netWorthHistory[netWorthHistory.length - 2] : null
  const nwTrend = lastSnapshot ? (liveSummary.netWorth || summary.netWorth) - lastSnapshot.total : 0

  return (
    <div className="section-finances">
      <div className="section-title">FINANCES {!unlocked && <span style={{fontSize:'0.7rem',color:'#666',marginLeft:'0.5rem'}}>// LOCKED</span>}</div>
      {!unlocked && <div className="card full"><PinLock onUnlock={onUnlock} /></div>}
      <div className="grid">
        {/* ROW 1: Key Stats */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="fin-stats-row">
              <MiniStat label="Net Worth" value={fmt(liveSummary.netWorth || 0)} sub={nwTrend !== 0 ? `${nwTrend > 0 ? '▲' : '▼'} ${fmt(Math.abs(nwTrend))}` : null} />
              <MiniStat label="Liquid Cash" value={fmt(liveSummary.liquid || 0)} />
              <MiniStat label="Investments" value={fmt(liveSummary.invested || 0)} />
              <MiniStat label="Receivables" value={fmt(liveSummary.receivables || 0)} color="#d97706" />
              <MiniStat label="Month Income" value={fmt(liveSummary.monthlyIncome || 0)} color="#22c55e" />
              <MiniStat label="Month Spend" value={fmt(liveSummary.monthlyExpenses || 0)} color={liveSummary.monthlyExpenses > 0 ? '#ef4444' : '#999'} />
            </div>
          </div>
        </DecryptReveal>

        {/* ROW 1.5: Live Holdings */}
        <DecryptReveal unlocked={unlocked}>
          <HoldingsCard holdings={liveHoldings} priceData={priceData} />
        </DecryptReveal>

        {/* ROW 2: Charts */}
        <DecryptReveal unlocked={unlocked}>
          <div className="card">
            <div className="section-header">Allocation</div>
            <div style={{display:'flex',alignItems:'center',gap:'2rem',flexWrap:'wrap'}}>
              <DonutChart segments={assetSegments} />
              <div className="legend" style={{flexDirection:'column'}}>
                {assetSegments.map((s, i) => (
                  <div key={i} className="legend-item">
                    <span className="legend-dot" style={{background: s.color}} />
                    <span className="legend-label">{s.label}</span>
                    <span className="legend-value">{fmt(s.value)}</span>
                    <span className="legend-pct">{totalAssets ? ((s.value / totalAssets) * 100).toFixed(0) + '%' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DecryptReveal>

        <DecryptReveal unlocked={unlocked}>
          <div className="card">
            <div className="section-header">Income vs Expenses</div>
            <IncomeExpenseBars transactions={transactions} />
            <div style={{marginTop:'1.5rem'}}>
              <div className="section-header">Net Worth Trend</div>
              <NetWorthLine snapshots={netWorthHistory} />
            </div>
          </div>
        </DecryptReveal>

        {/* ROW 3: Recent Transactions */}
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

        {/* ROW 4: Freelance Pipeline */}
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
                      {!totalVal && p.client_name && (
                        <div style={{fontSize:'0.75rem',color:'#555'}}>Client: {p.client_name} — no contract value set</div>
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
