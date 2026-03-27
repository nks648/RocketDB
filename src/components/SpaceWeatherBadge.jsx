import React, { useState } from 'react'
import { useSpaceWeather } from '../hooks/useSpaceWeather'

export default function SpaceWeatherBadge() {
  const { data, loading, error } = useSpaceWeather()
  const [expanded, setExpanded] = useState(false)

  if (loading && !data) return null
  if (error && !data) return null
  if (!data) return null

  const { kp, level, hourly, alerts } = data
  const hasStorm = kp != null && kp >= 5
  const hasAlerts = alerts.length > 0

  return (
    <div className="sw-badge-wrap">
      <button
        className={`sw-badge${hasStorm ? ' sw-storm' : ''}`}
        onClick={() => setExpanded(v => !v)}
        title="Space Weather (NOAA SWPC)"
      >
        <span className="sw-icon">☀</span>
        <span className="sw-label">
          Kp <span style={{ color: level?.color || 'var(--green)', fontWeight: 700 }}>
            {kp != null ? kp.toFixed(0) : '—'}
          </span>
        </span>
        {hasAlerts && <span className="sw-alert-dot" />}
      </button>

      {expanded && (
        <div className="sw-panel">
          <div className="sw-panel-header">
            <span>Space Weather</span>
            <button className="sw-close" onClick={() => setExpanded(false)}>✕</button>
          </div>

          <div className="sw-kp-row">
            <div className="sw-kp-value" style={{ color: level?.color }}>
              Kp {kp != null ? kp.toFixed(1) : '—'}
            </div>
            <div className="sw-kp-label" style={{ color: level?.color }}>
              {level?.label || '—'}
            </div>
          </div>

          {/* Kp sparkline */}
          {hourly.length > 0 && (
            <div className="sw-sparkline">
              {hourly.map((v, i) => {
                const h = Math.min(100, (v / 9) * 100)
                const c = kpLevel(v).color
                return (
                  <div key={i} className="sw-bar-wrap" title={`Kp ${v}`}>
                    <div className="sw-bar" style={{ height: `${h}%`, background: c }} />
                  </div>
                )
              })}
            </div>
          )}
          <div className="sw-sparkline-label">Kp — past 24h</div>

          <div className="sw-desc">
            {kp >= 5
              ? '⚠ Geomagnetic storm — may affect satellite ops & radio comms'
              : kp >= 4
              ? 'Elevated geomagnetic activity — minor effects possible'
              : 'Quiet geomagnetic conditions — nominal launch environment'
            }
          </div>

          {alerts.length > 0 && (
            <div className="sw-alerts">
              <div className="sw-alerts-title">NOAA Alerts</div>
              {alerts.map((a, i) => (
                <div key={i} className="sw-alert-item">
                  <span className="sw-alert-icon">⚡</span>
                  <span>{(a.message || a.product_id || 'Alert').split('\n')[0].slice(0, 80)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="sw-source">Source: NOAA Space Weather Prediction Center</div>
        </div>
      )}
    </div>
  )
}

// Helper needed inside the component render
function kpLevel(kp) {
  if (kp >= 8) return { color: '#ff1744' }
  if (kp >= 6) return { color: '#ff6d00' }
  if (kp >= 5) return { color: '#ffd740' }
  if (kp >= 4) return { color: '#ffe082' }
  if (kp >= 2) return { color: '#00e676' }
  return { color: '#00c8f0' }
}
