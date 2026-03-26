import fs from 'fs'
import path from 'path'

// Sydney coordinates
const SYDNEY_LAT = -33.8688
const SYDNEY_LON = 151.2093

async function fetchWeatherData() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=temperature_2m,precipitation_probability,weathercode&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Australia/Sydney&forecast_days=2`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch weather data')
  }
  
  return await response.json()
}

function getCachedWeather() {
  const cacheFile = path.join(process.cwd(), 'data', 'weather-cache.json')
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      const now = Date.now()
      // Cache for 30 minutes
      if (now - cached.timestamp < 30 * 60 * 1000) {
        return cached.data
      }
    }
  } catch (error) {
    console.error('Error reading weather cache:', error)
  }
  return null
}

function setCachedWeather(data) {
  const cacheFile = path.join(process.cwd(), 'data', 'weather-cache.json')
  const cacheData = {
    timestamp: Date.now(),
    data
  }
  
  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2))
  } catch (error) {
    console.error('Error writing weather cache:', error)
  }
}

function getWeatherCondition(weathercode) {
  // WMO Weather interpretation codes
  const conditions = {
    0: '☀️',  // Clear sky
    1: '🌤️',  // Mainly clear
    2: '⛅',  // Partly cloudy
    3: '☁️',  // Overcast
    45: '🌫️', // Fog
    48: '🌫️', // Depositing rime fog
    51: '🌦️', // Light drizzle
    53: '🌦️', // Moderate drizzle
    55: '🌦️', // Dense drizzle
    61: '🌧️', // Slight rain
    63: '🌧️', // Moderate rain
    65: '🌧️', // Heavy rain
    71: '🌨️', // Slight snow
    73: '🌨️', // Moderate snow
    75: '🌨️', // Heavy snow
    95: '⛈️', // Thunderstorm
    96: '⛈️', // Thunderstorm with slight hail
    99: '⛈️'  // Thunderstorm with heavy hail
  }
  return conditions[weathercode] || '🌤️'
}

function formatTime(timeString) {
  return new Date(timeString).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export async function GET() {
  try {
    // Try cache first
    let weatherData = getCachedWeather()
    
    if (!weatherData) {
      // Fetch fresh data
      weatherData = await fetchWeatherData()
      setCachedWeather(weatherData)
    }
    
    const now = new Date()
    const currentHour = now.getHours()
    
    // Today's data
    const today = weatherData.daily
    const hourly = weatherData.hourly
    
    // Current conditions - find closest hour
    let currentTempIndex = 0
    for (let i = 0; i < hourly.time.length; i++) {
      const hourTime = new Date(hourly.time[i])
      if (hourTime.getHours() === currentHour && hourTime.getDate() === now.getDate()) {
        currentTempIndex = i
        break
      }
    }
    
    const currentTemp = Math.round(hourly.temperature_2m[currentTempIndex])
    const currentCondition = getWeatherCondition(hourly.weathercode[currentTempIndex])
    const highTemp = Math.round(today.temperature_2m_max[0])
    const lowTemp = Math.round(today.temperature_2m_min[0])
    
    // Sunrise/sunset
    const sunrise = formatTime(today.sunrise[0])
    const sunset = formatTime(today.sunset[0])
    
    // Hourly forecast for today (6am - 10pm)
    const hourlyForecast = []
    for (let i = 0; i < hourly.time.length; i++) {
      const hourTime = new Date(hourly.time[i])
      if (hourTime.getDate() === now.getDate()) {
        const hour = hourTime.getHours()
        if (hour >= 6 && hour <= 22) {
          hourlyForecast.push({
            time: hour,
            temperature: Math.round(hourly.temperature_2m[i]),
            precipitation: hourly.precipitation_probability[i],
            isCurrent: hour === currentHour
          })
        }
      }
    }
    
    const result = {
      current: {
        temperature: currentTemp,
        condition: currentCondition,
        high: highTemp,
        low: lowTemp
      },
      sun: {
        sunrise,
        sunset
      },
      hourlyForecast
    }
    
    return Response.json(result)
    
  } catch (error) {
    console.error('Weather API error:', error)
    
    // Return fallback data
    return Response.json({
      current: {
        temperature: 22,
        condition: '🌤️',
        high: 25,
        low: 18
      },
      sun: {
        sunrise: '6:12am',
        sunset: '5:48pm'
      },
      hourlyForecast: []
    })
  }
}