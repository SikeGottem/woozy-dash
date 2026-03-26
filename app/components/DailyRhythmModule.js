'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, Circle, Clock, ChevronDown, Activity, Sunrise, Sunset, Moon, Dumbbell } from 'lucide-react'

const DAILY_RHYTHM_TIMES = {
  morning: '6:30am',
  gym: '3:00pm', 
  arvo: '4:30pm',
  evening: '8:30pm'
}

function formatTime(timestamp) {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleTimeString('en-AU', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

function TaskItem({ task, index, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false)
  
  const handleStatusChange = async (newStatus) => {
    if (updating) return
    setUpdating(true)
    
    try {
      await fetch('/api/daily-rhythm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'task-update',
          data: { taskIndex: index, status: newStatus }
        })
      })
      onStatusUpdate()
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setUpdating(false)
    }
  }
  
  const getStatusIcon = () => {
    switch (task.status) {
      case 'done': return '✅'
      case 'partial': return '🔄'
      case 'skipped': return '❌'
      default: return '⭕'
    }
  }
  
  const getStatusColor = () => {
    switch (task.status) {
      case 'done': return '#22c55e'
      case 'partial': return '#eab308'
      case 'skipped': return '#ef4444'
      default: return '#666'
    }
  }
  
  const getPriorityColor = () => {
    switch (task.priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#eab308'
      case 'low': return '#666'
      default: return '#666'
    }
  }
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0',
      borderBottom: '1px solid #1a1a1a'
    }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '0',
        background: getPriorityColor(),
        flexShrink: 0
      }} />
      
      <span style={{
        flex: 1,
        fontSize: '0.8rem',
        color: task.status === 'done' ? '#888' : '#ccc',
        textDecoration: task.status === 'done' ? 'line-through' : 'none'
      }}>
        {task.text}
      </span>
      
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        opacity: updating ? 0.5 : 1
      }}>
        {['done', 'partial', 'skipped'].map(status => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={updating}
            style={{
              background: 'none',
              border: `1px solid ${task.status === status ? getStatusColor() : '#333'}`,
              color: task.status === status ? getStatusColor() : '#555',
              fontSize: '0.6rem',
              padding: '0.2rem 0.4rem',
              borderRadius: '0',
              cursor: updating ? 'default' : 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.15s'
            }}
            onMouseOver={e => {
              if (!updating && task.status !== status) {
                e.target.style.borderColor = '#555'
                e.target.style.color = '#999'
              }
            }}
            onMouseOut={e => {
              if (task.status !== status) {
                e.target.style.borderColor = '#333'
                e.target.style.color = '#555'
              }
            }}
          >
            {status === 'done' ? 'Done' : status === 'partial' ? 'Part' : 'Skip'}
          </button>
        ))}
      </div>
    </div>
  )
}

function GymCard({ gymData, onGymUpdate }) {
  const [updating, setUpdating] = useState(false)
  
  const handleGymResponse = async (result) => {
    if (updating) return
    setUpdating(true)
    
    try {
      await fetch('/api/daily-rhythm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'gym-nudge',
          data: { action: 'completed', result }
        })
      })
      onGymUpdate()
    } catch (error) {
      console.error('Failed to update gym:', error)
    } finally {
      setUpdating(false)
    }
  }
  
  const isUpcoming = !gymData.nudgeSent
  const isCompleted = gymData.completed !== null
  
  return (
    <div style={{
      background: isCompleted ? 'rgba(34,197,94,0.05)' : isUpcoming ? 'rgba(255,255,255,0.02)' : '#111',
      border: '1px solid #222',
      borderRadius: '0',
      padding: '1rem',
      opacity: isUpcoming ? 0.6 : 1
    }}>
      {isUpcoming ? (
        <>
          <div style={{
            fontSize: '0.85rem',
            color: '#888',
            marginBottom: '0.5rem'
          }}>
            ⏳ Fires at 3:00pm
          </div>
          <div style={{ color: '#666' }}>
            Gym nudge scheduled
          </div>
        </>
      ) : isCompleted ? (
        <>
          <div style={{
            fontSize: '0.85rem',
            color: '#22c55e',
            marginBottom: '0.5rem'
          }}>
            💪 Completed: {gymData.completed}
          </div>
        </>
      ) : (
        <>
          <div style={{
            fontSize: '0.85rem',
            color: '#fff',
            marginBottom: '0.75rem'
          }}>
            Time to train 💪
          </div>
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            opacity: updating ? 0.5 : 1
          }}>
            {[
              { label: 'Did it ✅', value: 'completed' },
              { label: 'Skipped ❌', value: 'skipped' },
              { label: 'Rest 😴', value: 'rest' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => handleGymResponse(option.value)}
                disabled={updating}
                style={{
                  background: '#0f0f0f',
                  border: '1px solid #222',
                  color: '#ccc',
                  fontSize: '0.7rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0',
                  cursor: updating ? 'default' : 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  transition: 'all 0.15s'
                }}
                onMouseOver={e => {
                  if (!updating) {
                    e.target.style.borderColor = '#444'
                    e.target.style.color = '#fff'
                  }
                }}
                onMouseOut={e => {
                  if (!updating) {
                    e.target.style.borderColor = '#222'
                    e.target.style.color = '#ccc'
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FlowCard({ icon, time, title, children, isActive = false, isPast = false, isUpcoming = false }) {
  return (
    <div style={{
      background: isActive ? 'rgba(34,197,94,0.08)' : isPast ? '#0f0f0f' : '#111',
      border: '1px solid #222',
      borderRadius: '0',
      padding: '1rem',
      marginBottom: '1rem',
      opacity: isUpcoming ? 0.6 : 1
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: isActive ? '#22c55e' : '#888',
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.05em'
      }}>
        {icon}
        {time} — {title}
      </div>
      {children}
    </div>
  )
}

export default function DailyRhythmModule({ data }) {
  const [rhythmData, setRhythmData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const fetchRhythmData = async () => {
    try {
      const response = await fetch('/api/daily-rhythm')
      if (response.ok) {
        const data = await response.json()
        setRhythmData(data)
      }
    } catch (error) {
      console.error('Failed to fetch rhythm data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchRhythmData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchRhythmData, 30000)
    return () => clearInterval(interval)
  }, [])
  
  if (loading) {
    return (
      <div className="card full">
        <div className="section-header">━━ TODAY'S FLOW ━━━━━━━━━━━━━━━━━━━</div>
        <div style={{
          color: '#666',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.8rem',
          textAlign: 'center',
          padding: '2rem'
        }}>
          Loading rhythm data...
        </div>
      </div>
    )
  }
  
  if (!rhythmData) {
    return (
      <div className="card full">
        <div className="section-header">━━ TODAY'S FLOW ━━━━━━━━━━━━━━━━━━━</div>
        <div style={{
          color: '#666',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.8rem',
          textAlign: 'center',
          padding: '2rem'
        }}>
          No rhythm data available
        </div>
      </div>
    )
  }
  
  const now = new Date()
  const currentTime = now.getHours() * 100 + now.getMinutes() // 24hr format for comparison
  
  // Time thresholds (in 24hr format for easy comparison)
  const morningTime = 630  // 6:30am
  const gymTime = 1500     // 3:00pm  
  const arvoTime = 1630    // 4:30pm
  const eveningTime = 2030 // 8:30pm
  
  return (
    <div className="card full">
      <div className="section-header">━━ TODAY'S FLOW ━━━━━━━━━━━━━━━━━━━</div>
      
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        
        {/* Morning Report */}
        <FlowCard
          icon="🌅"
          time={DAILY_RHYTHM_TIMES.morning}
          title="Morning Report"
          isActive={rhythmData.morningReport.postedAt && currentTime < gymTime}
          isPast={rhythmData.morningReport.postedAt && currentTime >= gymTime}
          isUpcoming={!rhythmData.morningReport.postedAt && currentTime < morningTime}
        >
          {rhythmData.morningReport.postedAt ? (
            <>
              {rhythmData.morningReport.weather && (
                <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '0.75rem' }}>
                  ☀️ {rhythmData.morningReport.weather}
                </div>
              )}
              
              {rhythmData.morningReport.events && rhythmData.morningReport.events.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem' }}>Be here:</div>
                  {rhythmData.morningReport.events.map((event, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: '#ccc' }}>
                      • {event.time} {event.title}
                    </div>
                  ))}
                </div>
              )}
              
              {rhythmData.morningReport.tasks && rhythmData.morningReport.tasks.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem' }}>Do today:</div>
                  {rhythmData.morningReport.tasks.map((task, i) => (
                    <TaskItem 
                      key={i} 
                      task={task} 
                      index={i} 
                      onStatusUpdate={fetchRhythmData} 
                    />
                  ))}
                </div>
              )}
              
              {rhythmData.morningReport.overdue && rhythmData.morningReport.overdue.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '0.5rem' }}>Overdue:</div>
                  {rhythmData.morningReport.overdue.map((item, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                      • {item}
                    </div>
                  ))}
                </div>
              )}
              
              {rhythmData.morningReport.research && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  borderTop: '1px solid #1a1a1a',
                  paddingTop: '0.5rem'
                }}>
                  🔬 Pre-research: {rhythmData.morningReport.research.topic}
                  <br />
                  └ {rhythmData.morningReport.research.summary}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#666', fontSize: '0.8rem' }}>
              {currentTime < morningTime ? 'Fires at 6:30am' : 'Waiting for morning report...'}
            </div>
          )}
        </FlowCard>
        
        {/* Timeline connector */}
        <div style={{
          width: '2px',
          height: '1rem',
          background: '#333',
          marginLeft: '1rem',
          marginBottom: '1rem'
        }} />
        
        {/* Gym Nudge */}
        <FlowCard
          icon="💪"
          time={DAILY_RHYTHM_TIMES.gym}
          title="Gym Nudge"
          isActive={rhythmData.gym.nudgeSent && rhythmData.gym.completed === null && currentTime >= gymTime && currentTime < arvoTime}
          isPast={rhythmData.gym.completed !== null}
          isUpcoming={!rhythmData.gym.nudgeSent && currentTime < gymTime}
        >
          <GymCard gymData={rhythmData.gym} onGymUpdate={fetchRhythmData} />
        </FlowCard>
        
        {/* Timeline connector */}
        <div style={{
          width: '2px',
          height: '1rem',
          background: '#333',
          marginLeft: '1rem',
          marginBottom: '1rem'
        }} />
        
        {/* Arvo Review */}
        <FlowCard
          icon="🌇"
          time={DAILY_RHYTHM_TIMES.arvo}
          title="Arvo Review"
          isActive={rhythmData.arvoReview.postedAt && currentTime >= arvoTime && currentTime < eveningTime}
          isPast={rhythmData.arvoReview.postedAt && currentTime >= eveningTime}
          isUpcoming={!rhythmData.arvoReview.postedAt && currentTime < arvoTime}
        >
          {rhythmData.arvoReview.postedAt ? (
            <div style={{ color: '#ccc', fontSize: '0.8rem' }}>
              ✅ Completed at {formatTime(rhythmData.arvoReview.postedAt)}
              {rhythmData.arvoReview.taskResults && (
                <div style={{ marginTop: '0.5rem', color: '#888' }}>
                  Task completion review sent
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '0.8rem' }}>
              {currentTime < arvoTime ? 'Fires at 4:30pm' : 'Waiting for arvo review...'}
              <br />
              Will check: task completion
            </div>
          )}
        </FlowCard>
        
        {/* Timeline connector */}
        <div style={{
          width: '2px',
          height: '1rem',
          background: '#333',
          marginLeft: '1rem',
          marginBottom: '1rem'
        }} />
        
        {/* Evening Check-in */}
        <FlowCard
          icon="🌙"
          time={DAILY_RHYTHM_TIMES.evening}
          title="Evening Check-in"
          isActive={rhythmData.eveningCheckin.postedAt && currentTime >= eveningTime}
          isPast={false} // Evening is never "past"
          isUpcoming={!rhythmData.eveningCheckin.postedAt && currentTime < eveningTime}
        >
          {rhythmData.eveningCheckin.postedAt ? (
            <div style={{ color: '#ccc', fontSize: '0.8rem' }}>
              ✅ Completed at {formatTime(rhythmData.eveningCheckin.postedAt)}
              {rhythmData.eveningCheckin.responses && (
                <div style={{ marginTop: '0.5rem', color: '#888' }}>
                  Daily tracker responses saved
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '0.8rem' }}>
              {currentTime < eveningTime ? 'Fires at 8:30pm' : 'Waiting for evening check-in...'}
              <br />
              Daily tracker questions
            </div>
          )}
        </FlowCard>
        
      </div>
      
      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #1a1a1a',
        fontSize: '0.65rem',
        color: '#555',
        fontFamily: 'JetBrains Mono, monospace',
        textAlign: 'center'
      }}>
        Last updated: {formatTime(new Date().toISOString())} • Auto-refresh: 30s
      </div>
    </div>
  )
}