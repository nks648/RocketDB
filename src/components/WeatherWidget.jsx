import React, { useState } from 'react'
import { useWeather } from '../hooks/useWeather'

const STATUS_COLORS = { go: '#00e676', marginal: '#ffd740', nogo: '#ff4444' }
const STATUS_LABELS = { go: 'GO', marginal: 'MARGINAL', nogo: 'NO-GO' }

export default function WeatherWidget({ lat, lng, compact = false }) {
  const { weather, loading, error } = useWeather(lat, lng)
  const [showForecast, setShowForecast] = useState(false)

  if (!lat || !lng) return null
  if (loading) return (
    <div className="weather-widget loading">
      <span className="weather-loading-dot" />
      <span style={{ fontSize:11, color:'var(--text-muted)' }}>Fetching pad weather…</span>
    </div>
  )
  if (error || !weather) return null

  const { current: w, forecast, status, issues } = weather
  const statusColor = STATUS_COLORS[status]
  const statusLabel = STATUS_LABELS[status]

  if (compact) {
    // Minimal one-line view for mobile banner
    return (
      <div className="weather-compact">
        <span className="weather-gng-pill" style={{ background: `${statusColor}22`, border:`1px solid ${statusColor}`, color: statusColor }}>
          {statusLabel}
        </span>
        <span className="weather-compact-stat">{w.condition.icon} {Math.round(w.temp)}°F</span>
        <span className="weather-compact-stat">{w.windArrow} {Math.round(w.wind)}kts{w.gusts > w.wind + 5 ? ` G${Math.round(w.gusts)}` : ''}</span>
        <span className="weather-compact-stat">☁ {Math.round(w.cloud)}%</span>
      </div>
    )
  }

  return (
    <div className="weather-widget">
      {/* Status badge only — title is shown by the parent collapsible */}
      <div className="weather-header">
        <div
          className="weather-gng"
          style={{ background:`${statusColor}18`, border:`1px solid ${statusColor}55`, color: statusColor }}
        >
          {statusLabel}
        </div>
      </div>

      {/* Main stats grid */}
      <div className="weather-grid">
        <div className="weather-cell">
          <span className="weather-cell-icon">{w.condition.icon}</span>
          <span className="weather-cell-val">{Math.round(w.temp)}°F</span>
          <span className="weather-cell-lbl">{w.condition.label}</span>
        </div>
        <div className="weather-cell">
          <span className="weather-cell-icon" style={{ fontSize:16 }}>{w.windArrow}</span>
          <span className="weather-cell-val">{Math.round(w.wind)} kts</span>
          <span className="weather-cell-lbl">
            {w.gusts > w.wind + 5 ? `Gusts ${Math.round(w.gusts)}` : `Wind`}
          </span>
        </div>
        <div className="weather-cell">
          <span className="weather-cell-icon">☁️</span>
          <span className="weather-cell-val">{Math.round(w.cloud)}%</span>
          <span className="weather-cell-lbl">Cloud Cover</span>
        </div>
        <div className="weather-cell">
          <span className="weather-cell-icon">👁</span>
          <span className="weather-cell-val">
            {w.visNm != null ? `${w.visNm.toFixed(1)} nm` : '—'}
          </span>
          <span className="weather-cell-lbl">Visibility</span>
        </div>
      </div>

      {/* Violations / warnings */}
      {issues.length > 0 && (
        <div className="weather-issues">
          {issues.map((issue, i) => (
            <div key={i} className="weather-issue">
              ⚠ {issue}
            </div>
          ))}
        </div>
      )}

      {/* 6-hour forecast */}
      {forecast.length > 0 && (
        <>
          <button
            className="weather-forecast-toggle"
            onClick={() => setShowForecast(v => !v)}
          >
            {showForecast ? '▲ Hide' : '▼ 6-hour forecast'}
          </button>
          {showForecast && (
            <div className="weather-forecast">
              {forecast.map((h, i) => (
                <div key={i} className="weather-hour">
                  <span className="wh-time">{h.hour.toString().padStart(2,'0')}:00</span>
                  <span className="wh-icon">{h.icon}</span>
                  <span className="wh-wind">{Math.round(h.wind)}kts</span>
                  <span className="wh-cloud">{Math.round(h.cloud)}%</span>
                  {h.precip > 0 && <span className="wh-precip">{h.precip}% 🌧</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="weather-source">Open-Meteo · Simplified NASA LCC</div>
    </div>
  )
}
