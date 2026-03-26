'use client'
import { useState, useEffect } from 'react'
import { Cloud, Sun, CloudRain, CloudSnow, Zap } from 'lucide-react'

function WeatherGraph({ hourlyForecast }) {
  if (!hourlyForecast || hourlyForecast.length === 0) {
    return (
      <div className="weather-graph-empty">
        <div style={{ color: '#555', fontSize: '0.7rem', textAlign: 'center' }}>
          No hourly data available
        </div>
      </div>
    )
  }

  const width = 300
  const height = 80
  const padding = { top: 10, right: 20, bottom: 20, left: 20 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const temperatures = hourlyForecast.map(h => h.temperature)
  const minTemp = Math.min(...temperatures)
  const maxTemp = Math.max(...temperatures)
  const tempRange = maxTemp - minTemp || 1

  // Generate SVG path for temperature line
  const pathData = hourlyForecast.map((hour, i) => {
    const x = padding.left + (i / (hourlyForecast.length - 1)) * chartWidth
    const y = padding.top + ((maxTemp - hour.temperature) / tempRange) * chartHeight
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).join(' ')

  return (
    <div className="weather-graph">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {[0, 0.5, 1].map(ratio => (
          <line
            key={ratio}
            x1={padding.left}
            y1={padding.top + ratio * chartHeight}
            x2={width - padding.right}
            y2={padding.top + ratio * chartHeight}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        ))}

        {/* Rain probability bars (behind the line) */}
        {hourlyForecast.map((hour, i) => {
          const x = padding.left + (i / (hourlyForecast.length - 1)) * chartWidth
          const rainHeight = (hour.precipitation / 100) * chartHeight * 0.3 // Scale down rain bars
          return (
            <rect
              key={`rain-${i}`}
              x={x - 2}
              y={height - padding.bottom - rainHeight}
              width="4"
              height={rainHeight}
              fill="rgba(96,165,250,0.2)"
              rx="1"
            />
          )
        })}

        {/* Temperature line */}
        <path
          d={pathData}
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current time marker */}
        {hourlyForecast.map((hour, i) => {
          if (!hour.isCurrent) return null
          const x = padding.left + (i / (hourlyForecast.length - 1)) * chartWidth
          const y = padding.top + ((maxTemp - hour.temperature) / tempRange) * chartHeight
          return (
            <circle
              key="current"
              cx={x}
              cy={y}
              r="4"
              fill="#eab308"
              stroke="#fff"
              strokeWidth="2"
            />
          )
        })}

        {/* Hour labels */}
        {hourlyForecast.filter((_, i) => i % 3 === 0).map((hour, i) => {
          const originalIndex = i * 3
          const x = padding.left + (originalIndex / (hourlyForecast.length - 1)) * chartWidth
          return (
            <text
              key={`hour-${hour.time}`}
              x={x}
              y={height - 5}
              fill="#888"
              fontSize="10"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {hour.time === 0 ? '12am' : hour.time <= 12 ? `${hour.time}am` : `${hour.time - 12}pm`}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function getBackgroundGradient(condition) {
  const gradients = {
    '☀️': 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.05) 100%)',
    '🌤️': 'linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(156,163,175,0.05) 100%)',
    '⛅': 'linear-gradient(135deg, rgba(156,163,175,0.08) 0%, rgba(107,114,128,0.05) 100%)',
    '☁️': 'linear-gradient(135deg, rgba(107,114,128,0.08) 0%, rgba(75,85,99,0.05) 100%)',
    '🌧️': 'linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(59,130,246,0.05) 100%)',
    '🌦️': 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(156,163,175,0.05) 100%)'
  }
  return gradients[condition] || gradients['🌤️']
}

export default function WeatherModule() {
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('/api/weather')
        if (response.ok) {
          const data = await response.json()
          setWeatherData(data)
          setError(null)
        } else {
          throw new Error('Failed to fetch weather')
        }
      } catch (err) {
        console.error('Weather fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="weather-card">
        <div className="weather-loading">
          Loading weather...
        </div>
      </div>
    )
  }

  if (error || !weatherData) {
    return (
      <div className="weather-card">
        <div className="weather-error">
          <div>Weather unavailable</div>
          <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '0.25rem' }}>
            {error || 'No data available'}
          </div>
        </div>
      </div>
    )
  }

  const { current, sun, hourlyForecast } = weatherData
  const backgroundStyle = {
    background: getBackgroundGradient(current.condition)
  }

  const feelsLikeDiff = Math.abs(current.temperature - current.high) > 3

  return (
    <div className="weather-card" style={backgroundStyle}>
      <div className="weather-header">
        <span className="weather-condition-icon">{current.condition}</span>
        <span className="weather-current-temp">{current.temperature}°</span>
      </div>
      
      <div className="weather-summary">
        <span className="weather-high-low">H:{current.high}° L:{current.low}°</span>
        {feelsLikeDiff && (
          <span className="weather-feels-like">Feels like {current.temperature + 2}°</span>
        )}
      </div>

      <WeatherGraph hourlyForecast={hourlyForecast} />

      <div className="weather-sun-times">
        <div className="weather-sun-time">
          <span className="weather-sun-icon">🌅</span>
          <span className="weather-sun-value">{sun.sunrise}</span>
        </div>
        <div className="weather-sun-time">
          <span className="weather-sun-icon">🌇</span>
          <span className="weather-sun-value">{sun.sunset}</span>
        </div>
      </div>
    </div>
  )
}

// Add CSS styles to globals.css:
/*
.weather-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 0;
  padding: 1.25rem;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.weather-loading,
.weather-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  text-align: center;
  flex-direction: column;
}

.weather-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.weather-condition-icon {
  font-size: 2rem;
}

.weather-current-temp {
  font-size: 2.5rem;
  font-weight: 700;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
}

.weather-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: -0.5rem;
}

.weather-high-low {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: #ccc;
  font-weight: 500;
}

.weather-feels-like {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #888;
}

.weather-graph {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.5rem 0;
}

.weather-graph-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weather-sun-times {
  display: flex;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.weather-sun-time {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.weather-sun-icon {
  font-size: 0.9rem;
}

.weather-sun-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: #ccc;
  font-weight: 500;
}
*/