'use client'
import { Check } from 'lucide-react'

export default function FreelanceModule({ data, unlocked }) {
  return (
    <div className="section-freelance">
      <div className="section-title">FREELANCE</div>
      <div className="grid">
        <div className="card">
          <div className="section-header">Clients</div>
          <ul className="data-list">
            {(data.clients || []).map((client, i) => (
              <li key={i} className="data-item">
                <div>
                  <div style={{fontWeight: 600, textTransform: 'capitalize'}}>{client.name.replace(/-/g, ' ')}</div>
                  {unlocked && client.total && <div style={{color: '#666', fontSize: '0.8rem', marginTop: '0.2rem'}}>{client.total}</div>}
                </div>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem'}}>
                  <span className={`status-tag ${client.status === 'active' ? 'status-active' : 'status-inactive'}`}>{client.status}</span>
                  {client.deposit && <span className={`status-tag ${client.deposit === 'paid' ? 'status-active' : 'status-pending'}`}>{client.deposit === 'paid' ? <>deposit <Check size={11} style={{ verticalAlign: 'middle' }} /></> : 'deposit pending'}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
