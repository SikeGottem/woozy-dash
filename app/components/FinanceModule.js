'use client'
import { useState, useEffect } from 'react'
import { fmt, parseAmt, COLORS } from '../lib/helpers'
import DonutChart from './charts/DonutChart'
import BarChart from './charts/BarChart'
import StackedBar from './charts/StackedBar'
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

export default function FinanceModule({ data, unlocked, onUnlock }) {
  const a = data.assets || {}
  const incomeList = data.income || []
  const expenseList = data.expenses || []
  const totalIncome = incomeList.filter(r => (r.status === 'paid' || r.status === 'completed')).reduce((s, r) => s + parseAmt(r.amount), 0)
  const pendingIncome = incomeList.filter(r => r.status === 'pending').reduce((s, r) => s + parseAmt(r.amount), 0)
  const totalExpenses = expenseList.reduce((s, r) => s + parseAmt(r.amount), 0)
  const totalAssets = a.checking + a.savings + a.cash + a.investments + (a.gold?.value || 0) + a.receivables

  const assetSegments = [
    { label: 'Checking', value: a.checking, color: COLORS.checking },
    { label: 'Savings', value: a.savings, color: COLORS.savings },
    { label: 'Cash', value: a.cash, color: COLORS.cash },
    { label: 'Investments', value: a.investments, color: COLORS.investments },
    { label: 'Gold', value: a.gold?.value || 0, color: COLORS.gold },
    { label: 'Receivables', value: a.receivables, color: COLORS.receivables },
  ].filter(s => s.value > 0)

  const incomeByClient = incomeList.filter(r => (r.status === 'paid' || r.status === 'completed')).reduce((acc, r) => {
    const key = r.client || r.source || 'Other'
    acc[key] = (acc[key] || 0) + parseAmt(r.amount)
    return acc
  }, {})

  const incomeBarItems = Object.entries(incomeByClient).map(([label, value]) => ({
    label, value, display: fmt(value), color: '#fff'
  })).sort((a, b) => b.value - a.value)

  return (
    <div className="section-finances">
      <div className="section-title">FINANCES {!unlocked && <span style={{fontSize:'0.7rem',color:'#666',marginLeft:'0.5rem'}}>// LOCKED</span>}</div>
      {!unlocked && <div className="card full"><PinLock onUnlock={onUnlock} /></div>}
      <div className="grid">
        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="nw-top">
              <div className="nw-left">
                <div className="section-header">Net Worth</div>
                <div className="net-worth-value">{fmt(a.netWorth)}</div>
                <div className="nw-stats-row">
                  <MiniStat label="Liquid" value={fmt(a.checking + a.savings + a.cash)} color={COLORS.checking} />
                  <MiniStat label="Invested" value={fmt(a.investments + (a.gold?.value || 0))} color={COLORS.investments} />
                  <MiniStat label="Owed to you" value={fmt(a.receivables)} color={COLORS.receivables} />
                </div>
              </div>
              <div className="nw-right">
                <DonutChart segments={assetSegments} />
              </div>
            </div>
            <div className="section-header" style={{marginTop: '1.5rem'}}>Allocation</div>
            <StackedBar segments={assetSegments} height={28} />
            <div className="legend">
              {assetSegments.map((s, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{background: s.color}} />
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-value">{fmt(s.value)}</span>
                  <span className="legend-pct">{((s.value / totalAssets) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            {(a.etfStatus || '').includes('Waiting') && (
              <div className="etf-status">▲ ETF DEPLOYMENT: {fmt(a.etfPlanned)} PLANNED • {a.etfStatus.toUpperCase()}</div>
            )}
          </div>
        </DecryptReveal>

        <DecryptReveal unlocked={unlocked}>
          <div className="card">
            <div className="section-header">Income</div>
            <div className="income-hero-row">
              <MiniStat label="Received" value={fmt(totalIncome)} color="#fff" />
              <MiniStat label="Pending" value={fmt(pendingIncome)} color={COLORS.dim} />
            </div>
            <div className="subsection">By Client</div>
            <BarChart items={incomeBarItems} />
            {incomeList.filter(r => r.status !== 'paid').length > 0 && (
              <>
                <div className="subsection" style={{marginTop: '1rem'}}>Awaiting Payment</div>
                <ul className="data-list">
                  {incomeList.filter(r => r.status !== 'paid').map((item, i) => (
                    <li key={i} className="data-item" style={{opacity: 0.5}}>
                      <span>{item.client || item.source}</span>
                      <span>{fmt(parseAmt(item.amount))}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </DecryptReveal>

        <DecryptReveal unlocked={unlocked}>
          <div className="card">
            <div className="section-header">Expenses</div>
            <div className="stat-display">
              <div className="stat-value money-negative">{fmt(totalExpenses)}</div>
              <div className="stat-label">Total Outflow</div>
            </div>
            {expenseList.length > 0 ? (
              <ul className="data-list">
                {expenseList.map((item, i) => (
                  <li key={i} className="data-item">
                    <span>{item.category} — {item.description}</span>
                    <span className="money-negative">{fmt(parseAmt(item.amount))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-visual">
                <div className="empty-icon">—</div>
                <div>No expenses tracked yet</div>
                <div className="empty-sub">Tell Woozy when you spend money</div>
              </div>
            )}
          </div>
        </DecryptReveal>

        <DecryptReveal unlocked={unlocked}>
          <div className="card full">
            <div className="section-header">Income vs Expenses</div>
            <div className="vs-chart">
              <div className="vs-bar-group">
                <div className="vs-label">Income</div>
                <div className="vs-track"><div className="vs-fill vs-income" style={{width: `${totalIncome > 0 ? 100 : 0}%`}} /></div>
                <div className="vs-amount">{fmt(totalIncome)}</div>
              </div>
              <div className="vs-bar-group">
                <div className="vs-label">Expenses</div>
                <div className="vs-track"><div className="vs-fill vs-expense" style={{width: `${totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0}%`}} /></div>
                <div className="vs-amount">{fmt(totalExpenses)}</div>
              </div>
              <div className="vs-bar-group">
                <div className="vs-label">Net</div>
                <div className="vs-track"><div className="vs-fill vs-net" style={{width: `${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0}%`}} /></div>
                <div className="vs-amount" style={{color: '#22c55e'}}>{fmt(totalIncome - totalExpenses)}</div>
              </div>
            </div>
          </div>
        </DecryptReveal>
      </div>
    </div>
  )
}
