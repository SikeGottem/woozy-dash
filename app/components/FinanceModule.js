'use client'
import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { PinLock, DecryptReveal } from './ui/PinLock'
export { PinLock, DecryptReveal }

const fmt = (n) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

// === COMPACT FINANCE MODULE (for main dashboard) ===
export default function FinanceModule({ data, unlocked, onUnlock }) {
  const accounts = data.accounts || []
  const transactions = data.transactions || []
  const holdings = data.holdings || []
  const [priceData, setPriceData] = useState(null)

  useEffect(() => {
    if (!unlocked) return
    fetch('/api/prices').then(r => r.json()).then(d => setPriceData(d)).catch(() => {})
  }, [unlocked])

  const liveHoldings = priceData?.holdings || holdings

  const liquid = (accounts.find(a => a.name === 'Checking')?.balance || 0) +
                 (accounts.find(a => a.name === 'Savings')?.balance || 0) +
                 (accounts.find(a => a.name === 'Cash')?.balance || 0)
  const hndq = liveHoldings.find(h => h.name === 'HNDQ')
  const gold = liveHoldings.find(h => h.name === 'Gold')
  const hndqVal = hndq?.current_value || 0
  const goldVal = gold?.current_value || 0
  const receivables = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + t.amount, 0)
  const netWorth = liquid + hndqVal + goldVal + receivables

  const hndqUp = (hndq?.gain || 0) >= 0
  const goldUp = (gold?.gain || 0) >= 0

  return (
    <div className="section-finances">
      <div className="section-title">FINANCES {!unlocked && <span style={{fontSize:'0.7rem',color:'#666',marginLeft:'0.5rem'}}>// LOCKED</span>}</div>
      {!unlocked && <div className="card full"><PinLock onUnlock={onUnlock} /></div>}
      <DecryptReveal unlocked={unlocked}>
        <div className="card full">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'1rem'}}>
            <div>
              <div style={{fontSize:'0.65rem',color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.35rem'}}>Net Worth</div>
              <div style={{fontSize:'1.8rem',fontWeight:700,color:'#fff'}}>{fmt(netWorth)}</div>
            </div>
            <div style={{display:'flex',gap:'1.5rem',flexWrap:'wrap'}}>
              {hndq && (
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.65rem',color:'#555'}}>HNDQ</div>
                  <div style={{fontSize:'0.9rem',fontWeight:600,color:'#fff'}}>{fmt(hndqVal)}</div>
                  <div style={{fontSize:'0.7rem',color: hndqUp ? '#22c55e' : '#ef4444'}}>
                    {hndqUp ? '+' : ''}{hndq.gainPct?.toFixed(1)}%
                  </div>
                </div>
              )}
              {gold && (
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.65rem',color:'#555'}}>GOLD</div>
                  <div style={{fontSize:'0.9rem',fontWeight:600,color:'#fff'}}>{fmt(goldVal)}</div>
                  <div style={{fontSize:'0.7rem',color: goldUp ? '#22c55e' : '#ef4444'}}>
                    {goldUp ? '+' : ''}{gold.gainPct?.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Allocation bar */}
          <div className="fin-alloc-bar" style={{marginTop:'1rem',marginBottom:'0.75rem'}}>
            {[
              { value: liquid, color: 'rgba(255,255,255,0.85)' },
              { value: hndqVal, color: 'rgba(255,255,255,0.55)' },
              { value: goldVal, color: 'rgba(255,255,255,0.35)' },
              { value: receivables, color: 'rgba(214,163,50,0.6)' },
            ].filter(s => s.value > 0).map((s, i) => (
              <div key={i} style={{width:`${(s.value/netWorth)*100}%`,background:s.color,height:'100%',minWidth:'2px'}} />
            ))}
          </div>
          <a href="/finance" style={{
            fontFamily:'JetBrains Mono',fontSize:'0.7rem',color:'#999',
            textDecoration:'none',display:'inline-block',
            border:'1px solid #222',padding:'0.3rem 0.6rem',
            transition:'all 0.15s'
          }}
            onMouseOver={e => {e.target.style.color='#fff';e.target.style.borderColor='#444'}}
            onMouseOut={e => {e.target.style.color='#999';e.target.style.borderColor='#222'}}
          >View Finance <ArrowRight size={12} style={{ verticalAlign: 'middle' }} /></a>
        </div>
      </DecryptReveal>
    </div>
  )
}
