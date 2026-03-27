import React, { useState, useCallback } from 'react'
import CountdownTimer from './CountdownTimer'
import WeatherWidget from './WeatherWidget'
import { STATUS_MAP } from '../data/launchZones'

function parseStreams(vidURLs) {
  if (!vidURLs?.length) return []
  return vidURLs.map(v => {
    const url = v.url || v
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    return {
      url,
      ytId: ytMatch?.[1] || null,
      label: v.title || (ytMatch ? 'YouTube' : new URL(url).hostname.replace('www.', '')),
    }
  }).filter(s => s.url)
}

function NotifyButton({ launch }) {
  const [state, setState] = useState('idle') // idle | granted | denied | set

  const schedule = useCallback(async () => {
    if (!('Notification' in window)) { setState('denied'); return }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') { setState('denied'); return }

    const net = new Date(launch.net).getTime()
    const now = Date.now()
    let count = 0
    const milestones = [
      { ms: 60 * 60 * 1000, label: 'T-1 Hour' },
      { ms: 30 * 60 * 1000, label: 'T-30 Minutes' },
      { ms:  5 * 60 * 1000, label: 'T-5 Minutes' },
      { ms:  0,             label: 'Launch NOW' },
    ]
    for (const { ms, label } of milestones) {
      const delay = net - ms - now
      if (delay > 0) {
        setTimeout(() => {
          new Notification(`🚀 ${label}: ${launch.rocket?.configuration?.name || 'Launch'}`, {
            body: launch.name,
            tag:  `rocketdb-${launch.id}-${ms}`,
          })
        }, delay)
        count++
      }
    }
    setState(count > 0 ? 'set' : 'idle')
  }, [launch])

  if (state === 'set')    return <button className="btn-notify set"    disabled>🔔 Alerts Set</button>
  if (state === 'denied') return <button className="btn-notify denied" disabled>🔕 Blocked</button>
  return <button className="btn-notify" onClick={schedule}>🔔 Notify Me</button>
}

export default function LaunchDetail({ launch, onClose, onPlayVideo }) {
  if (!launch) return null

  const statusKey   = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const statusLabel = launch.status?.name || 'Unknown'
  const vehicle     = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site        = launch.pad?.name || '—'
  const location    = launch.pad?.location?.name || ''
  const missionType = launch.mission?.type || null
  const orbit       = launch.mission?.orbit?.name || null
  const desc        = launch.mission?.description || null
  const isPast      = [3, 4, 6].includes(launch.status?.id)

  const padLat = parseFloat(launch.pad?.latitude)
  const padLng = parseFloat(launch.pad?.longitude)

  const streams = parseStreams(launch.vidURLs)
  const primaryYt = streams.find(s => s.ytId)

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString([], { dateStyle:'medium', timeStyle:'short' })
    : null
  const windowEnd = launch.window_end
    ? new Date(launch.window_end).toLocaleString([], { timeStyle:'short' })
    : null

  return (
    <div className="launch-detail">
      {/* Image */}
      {launch.image
        ? <img src={launch.image} alt="" className="launch-detail-img" />
        : <div className="launch-detail-img-placeholder">🚀</div>
      }

      {/* Info column */}
      <div className="launch-detail-info">
        <div className="launch-detail-name">{launch.name}</div>

        <div className="launch-detail-meta">
          <span className={`status-badge ${statusKey}`}>{statusLabel}</span>
          <span className="meta-chip">🚀 {vehicle}</span>
          <span className="meta-chip">📍 {site}{location ? `, ${location}` : ''}</span>
          {missionType && <span className="meta-chip">🛸 {missionType}{orbit ? ` · ${orbit}` : ''}</span>}
        </div>

        {desc && <div className="launch-detail-desc">{desc}</div>}

        {windowStart && (
          <div className="launch-detail-window">
            Window: {windowStart}{windowEnd ? ` → ${windowEnd}` : ''}
          </div>
        )}

        {/* Hold / failure reasons */}
        {launch.holdreason && (
          <div className="scrub-reason hold">
            <div className="scrub-reason-label">⚠ Hold Reason</div>
            <div className="scrub-reason-text">{launch.holdreason}</div>
          </div>
        )}
        {launch.failreason && (
          <div className="scrub-reason failure">
            <div className="scrub-reason-label">✕ Failure Reason</div>
            <div className="scrub-reason-text">{launch.failreason}</div>
          </div>
        )}

        {/* Weather */}
        {!isPast && !isNaN(padLat) && !isNaN(padLng) && (
          <WeatherWidget lat={padLat} lng={padLng} />
        )}
      </div>

      {/* Right side */}
      <div className="launch-detail-side">
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
          {!isPast && (
            <>
              <CountdownTimer netTime={launch.net} status={launch.status} large />
              <div className="countdown-label">NET Launch</div>
            </>
          )}
          {isPast && (
            <div className="countdown-large" style={{ fontSize:14 }}>
              {new Date(launch.net).toLocaleDateString()}
            </div>
          )}

          {/* Stream buttons */}
          {streams.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
              {streams.map((s, i) => (
                s.ytId ? (
                  <button
                    key={i}
                    className="btn-primary"
                    onClick={() => onPlayVideo(`https://www.youtube.com/embed/${s.ytId}?autoplay=1`, s.label)}
                  >
                    ▶ {s.label}
                  </button>
                ) : (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textDecoration:'none' }}>
                    ↗ {s.label}
                  </a>
                )
              ))}
            </div>
          )}

          {/* Notify */}
          {!isPast && <NotifyButton launch={launch} />}
        </div>

        <button className="btn-close" onClick={onClose} style={{ alignSelf:'flex-start' }}>✕</button>
      </div>
    </div>
  )
}
