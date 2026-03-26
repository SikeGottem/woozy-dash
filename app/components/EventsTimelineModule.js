'use client'
import { useState, useEffect } from 'react'

function formatTime(timeString) {
  if (!timeString) return ''
  
  // Handle both "15:00" and "3:00pm" formats
  if (timeString.includes('pm') || timeString.includes('am')) {
    return timeString
  }
  
  const [hours, minutes] = timeString.split(':').map(Number)
  const period = hours >= 12 ? 'pm' : 'am'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`
}

function getEventColor(event) {
  if (event.recurring) return '#666'
  
  const typeColors = {
    'uni': '#3b82f6',
    'work': '#f59e0b', 
    'personal': '#10b981',
    'family': '#8b5cf6'
  }
  
  return typeColors[event.type] || '#666'
}

function getEventIcon(event) {
  if (event.title.includes('💪')) return '💪'
  if (event.type === 'uni') return '🎓'
  if (event.type === 'work') return '💼'
  if (event.type === 'family') return '👨‍👩‍👧‍👦'
  if (event.recurring) return '🔄'
  return '📅'
}

function EventBlock({ event, startHour, endHour, currentHour, isPast, onClick }) {
  const eventStart = parseInt(event.time.split(':')[0])
  const eventDuration = event.duration || 1 // Default 1 hour
  const eventEnd = eventStart + eventDuration
  
  // Calculate position and height
  const totalHours = endHour - startHour
  const hourHeight = 40 // Height per hour in pixels
  
  const topOffset = ((eventStart - startHour) / totalHours) * (totalHours * hourHeight)
  const blockHeight = (eventDuration / totalHours) * (totalHours * hourHeight)
  
  const eventColor = getEventColor(event)
  const isNow = currentHour >= eventStart && currentHour < eventEnd
  
  return (
    <div
      className="timeline-event-block"
      style={{
        position: 'absolute',
        top: `${topOffset}px`,
        left: '60px',
        right: '10px',
        height: `${Math.max(blockHeight, 30)}px`, // Minimum height
        background: isNow ? eventColor : `${eventColor}20`,
        border: `1px solid ${eventColor}${isPast ? '40' : '60'}`,
        borderRadius: '4px',
        padding: '6px 10px',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isPast ? 0.6 : 1,
        zIndex: isNow ? 10 : 5
      }}
      onClick={onClick}
    >
      <div className="timeline-event-header">
        <span className="timeline-event-icon">{getEventIcon(event)}</span>
        <span className="timeline-event-title">{event.title}</span>
      </div>
      <div className="timeline-event-meta">
        <span className="timeline-event-time">
          {formatTime(event.time)}
          {event.duration && event.duration !== 1 && (
            <span> - {formatTime(`${eventStart + eventDuration}:00`)}</span>
          )}
        </span>
        {event.location && (
          <span className="timeline-event-location">{event.location}</span>
        )}
      </div>
    </div>
  )
}

function CurrentTimeLine({ currentHour, startHour, endHour }) {
  const now = new Date()
  const currentMinutes = now.getMinutes()
  const exactTime = currentHour + (currentMinutes / 60)
  
  const totalHours = endHour - startHour
  const hourHeight = 40
  const topOffset = ((exactTime - startHour) / totalHours) * (totalHours * hourHeight)
  
  return (
    <div
      className="timeline-current-time"
      style={{
        position: 'absolute',
        top: `${topOffset}px`,
        left: '0',
        right: '0',
        zIndex: 20
      }}
    >
      <div className="timeline-now-label">NOW</div>
      <div className="timeline-now-line"></div>
    </div>
  )
}

export default function EventsTimelineModule() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events')
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
        }
      } catch (error) {
        console.error('Events fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
    // Refresh every 10 minutes
    const interval = setInterval(fetchEvents, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="timeline-card">
        <div className="timeline-header">
          <h3 className="timeline-title">TODAY'S SCHEDULE</h3>
        </div>
        <div className="timeline-loading">
          Loading events...
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="timeline-card">
        <div className="timeline-header">
          <h3 className="timeline-title">TODAY'S SCHEDULE</h3>
        </div>
        <div className="timeline-empty">
          <div className="timeline-empty-icon">📅</div>
          <div className="timeline-empty-text">No events today</div>
          <div className="timeline-empty-subtext">Perfect for deep work</div>
        </div>
      </div>
    )
  }

  const now = new Date()
  const currentHour = now.getHours()
  
  // Determine time range based on events
  const eventHours = events.map(e => parseInt(e.time.split(':')[0]))
  const earliestEvent = Math.min(...eventHours)
  const latestEvent = Math.max(...eventHours)
  
  const startHour = Math.max(6, earliestEvent - 1)
  const endHour = Math.min(22, latestEvent + 2)
  
  const hours = []
  for (let hour = startHour; hour <= endHour; hour++) {
    hours.push(hour)
  }

  return (
    <div className="timeline-card">
      <div className="timeline-header">
        <h3 className="timeline-title">TODAY'S SCHEDULE</h3>
        <span className="timeline-count">{events.length} events</span>
      </div>

      <div className="timeline-container">
        <div className="timeline-hours">
          {hours.map(hour => (
            <div key={hour} className="timeline-hour-row">
              <div className="timeline-hour-label">
                {hour === 0 ? '12am' : hour <= 12 ? `${hour}am` : `${hour - 12}pm`}
              </div>
              <div className="timeline-hour-line"></div>
            </div>
          ))}
        </div>

        <div className="timeline-events" style={{ position: 'relative', height: `${hours.length * 40}px` }}>
          {events.map((event, index) => {
            const eventHour = parseInt(event.time.split(':')[0])
            const isPast = currentHour > eventHour + (event.duration || 1)
            
            return (
              <EventBlock
                key={index}
                event={event}
                startHour={startHour}
                endHour={endHour}
                currentHour={currentHour}
                isPast={isPast}
                onClick={() => setSelectedEvent(selectedEvent === index ? null : index)}
              />
            )
          })}

          {currentHour >= startHour && currentHour <= endHour && (
            <CurrentTimeLine
              currentHour={currentHour}
              startHour={startHour}
              endHour={endHour}
            />
          )}
        </div>

        {selectedEvent !== null && (
          <div className="timeline-event-detail">
            <div className="timeline-detail-header">
              <span>{getEventIcon(events[selectedEvent])}</span>
              <span>{events[selectedEvent].title}</span>
              <button 
                className="timeline-detail-close"
                onClick={() => setSelectedEvent(null)}
              >×</button>
            </div>
            {events[selectedEvent].location && (
              <div className="timeline-detail-location">
                📍 {events[selectedEvent].location}
              </div>
            )}
            {events[selectedEvent].recurring && (
              <div className="timeline-detail-recurring">
                🔄 Recurring event
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Add CSS styles to globals.css:
/*
.timeline-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 0;
  padding: 1.25rem;
  min-height: 280px;
  display: flex;
  flex-direction: column;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #1a1a1a;
}

.timeline-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin: 0;
}

.timeline-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: #555;
  background: #1a1a1a;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
}

.timeline-loading,
.timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  flex: 1;
  gap: 0.5rem;
  color: #666;
  font-family: 'JetBrains Mono', monospace;
}

.timeline-empty-icon {
  font-size: 2rem;
  opacity: 0.3;
}

.timeline-empty-text {
  font-size: 0.85rem;
  font-weight: 500;
}

.timeline-empty-subtext {
  font-size: 0.7rem;
  color: #555;
}

.timeline-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.timeline-hours {
  position: relative;
}

.timeline-hour-row {
  display: flex;
  align-items: center;
  height: 40px;
  position: relative;
}

.timeline-hour-label {
  width: 50px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #666;
  text-align: right;
  padding-right: 8px;
  flex-shrink: 0;
}

.timeline-hour-line {
  flex: 1;
  height: 1px;
  background: #1a1a1a;
}

.timeline-events {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.timeline-event-block {
  transition: all 0.15s ease;
  overflow: hidden;
}

.timeline-event-block:hover {
  transform: translateX(2px);
}

.timeline-event-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.timeline-event-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.timeline-event-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-event-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.timeline-event-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #ccc;
}

.timeline-event-location {
  font-size: 0.65rem;
  color: #888;
  font-style: italic;
}

.timeline-current-time {
  pointer-events: none;
}

.timeline-now-label {
  position: absolute;
  left: 0;
  top: -8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 700;
  color: #ef4444;
  background: #111;
  padding: 0 4px;
  letter-spacing: 0.05em;
}

.timeline-now-line {
  width: 100%;
  height: 2px;
  background: #ef4444;
  position: relative;
}

.timeline-now-line::before {
  content: '';
  position: absolute;
  left: 0;
  top: -3px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
}

.timeline-event-detail {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.75rem;
  z-index: 30;
}

.timeline-detail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 0.5rem;
}

.timeline-detail-close {
  background: none;
  border: none;
  color: #666;
  font-size: 1rem;
  cursor: pointer;
  margin-left: auto;
  padding: 0;
}

.timeline-detail-close:hover {
  color: #fff;
}

.timeline-detail-location,
.timeline-detail-recurring {
  font-size: 0.7rem;
  color: #888;
  margin-bottom: 0.25rem;
}
*/