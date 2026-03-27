import { useState, useEffect } from 'react'

const BASE = 'https://api.open-meteo.com/v1/forecast'
const CACHE = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 min

function worstStatus(a, b) {
  const rank = { go: 0, marginal: 1, nogo: 2 }
  return rank[a] >= rank[b] ? a : b
}

// WMO weather code → readable condition + severity
function parseCode(code) {
  if (code === 0) return { label: 'Clear', icon: '☀️', severe: false }
  if (code <= 2)  return { label: 'Partly Cloudy', icon: '🌤', severe: false }
  if (code === 3)  return { label: 'Overcast', icon: '☁️', severe: false }
  if (code <= 48) return { label: 'Fog', icon: '🌫', severe: true }
  if (code <= 55) return { label: 'Drizzle', icon: '🌦', severe: false }
  if (code <= 65) return { label: 'Rain', icon: '🌧', severe: code >= 63 }
  if (code <= 77) return { label: 'Snow', icon: '🌨', severe: code >= 73 }
  if (code <= 82) return { label: 'Showers', icon: code === 82 ? '⛈' : '🌦', severe: code >= 82 }
  if (code <= 86) return { label: 'Snow Showers', icon: '🌨', severe: true }
  return { label: 'Thunderstorm', icon: '⛈', severe: true } // 95-99
}

function windArrow(deg) {
  if (deg == null) return '·'
  return ['↑','↗','→','↘','↓','↙','←','↖'][Math.round(deg / 45) % 8]
}

function evaluate(current) {
  const { wind, gusts, precip, cloud, visNm, code } = current
  let status = 'go'
  const issues = []

  if (wind > 30)      { status = worstStatus(status, 'nogo');     issues.push(`Wind ${Math.round(wind)} kts (limit 30)`) }
  else if (wind > 20) { status = worstStatus(status, 'marginal'); issues.push(`Wind ${Math.round(wind)} kts elevated`) }

  if (gusts > 40)      { status = worstStatus(status, 'nogo');     issues.push(`Gusts ${Math.round(gusts)} kts (limit 40)`) }
  else if (gusts > 30) { status = worstStatus(status, 'marginal'); issues.push(`Gusts ${Math.round(gusts)} kts`) }

  if (precip > 0.5)  { status = worstStatus(status, 'nogo');     issues.push('Active precipitation') }
  else if (precip > 0) { status = worstStatus(status, 'marginal'); issues.push('Trace precipitation') }

  if (cloud > 87.5)  { status = worstStatus(status, 'marginal'); issues.push(`High cloud cover ${Math.round(cloud)}%`) }

  if (visNm != null && visNm < 3)   { status = worstStatus(status, 'nogo');     issues.push(`Visibility ${visNm.toFixed(1)} nm (min 3)`) }
  else if (visNm != null && visNm < 5) { status = worstStatus(status, 'marginal'); issues.push(`Low visibility ${visNm.toFixed(1)} nm`) }

  // Severe weather codes: fog, heavy showers, thunderstorm
  if (code >= 95) { status = 'nogo'; issues.push('Thunderstorm activity') }
  else if (code === 82 || code === 48 || code === 45) {
    status = worstStatus(status, 'nogo'); issues.push(parseCode(code).label)
  }

  return { status, issues }
}

export function useWeather(lat, lng) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      setWeather(null)
      return
    }

    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
    if (CACHE[key] && Date.now() - CACHE[key].ts < CACHE_TTL) {
      setWeather(CACHE[key].data)
      return
    }

    const params = new URLSearchParams({
      latitude:  lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: [
        'temperature_2m', 'wind_speed_10m', 'wind_direction_10m',
        'wind_gusts_10m', 'cloud_cover', 'precipitation',
        'weather_code', 'visibility',
      ].join(','),
      hourly: [
        'temperature_2m', 'wind_speed_10m', 'wind_gusts_10m',
        'cloud_cover', 'precipitation_probability', 'weather_code',
      ].join(','),
      wind_speed_unit:    'kn',
      temperature_unit:   'fahrenheit',
      precipitation_unit: 'inch',
      forecast_days:      '1',
      timezone:           'auto',
    })

    setLoading(true)
    fetch(`${BASE}?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(raw => {
        const c = raw.current
        const visNm = c.visibility != null ? c.visibility / 1852 : null
        const current = {
          temp:   c.temperature_2m,
          wind:   c.wind_speed_10m,
          gusts:  c.wind_gusts_10m,
          windDir: c.wind_direction_10m,
          windArrow: windArrow(c.wind_direction_10m),
          cloud:  c.cloud_cover,
          precip: c.precipitation,
          visM:   c.visibility,
          visNm,
          code:   c.weather_code,
          condition: parseCode(c.weather_code),
        }

        // Next 6 hours of forecast
        const now = new Date()
        const forecast = []
        for (let i = 0; i < (raw.hourly?.time?.length || 0) && forecast.length < 6; i++) {
          const t = new Date(raw.hourly.time[i])
          if (t > now) {
            forecast.push({
              hour:  t.getHours(),
              wind:  raw.hourly.wind_speed_10m[i],
              gusts: raw.hourly.wind_gusts_10m[i],
              cloud: raw.hourly.cloud_cover[i],
              precip: raw.hourly.precipitation_probability[i],
              code:  raw.hourly.weather_code[i],
              icon:  parseCode(raw.hourly.weather_code[i]).icon,
            })
          }
        }

        const assessment = evaluate(current)
        const result = { current, forecast, ...assessment, fetchedAt: Date.now() }

        CACHE[key] = { data: result, ts: Date.now() }
        setWeather(result)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [lat, lng])

  return { weather, loading, error }
}
