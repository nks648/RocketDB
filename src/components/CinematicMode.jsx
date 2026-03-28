import React, { useState, useEffect } from 'react'
import CountdownTimer from './CountdownTimer'
import { STATUS_MAP } from '../data/launchZones'

function parseStreams(vidURLs) {
  if (!vidURLs?.length) return []
  return vidURLs.map(v => {
    const url = typeof v === 'string' ? v : v?.url
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) return null
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    return { url, ytId: ytMatch?.[1] || null, label: v.title || (ytMatch ? 'YouTube' : 'Stream') }
  }).filter(Boolean)
}

export default function CinematicMode({ launch, onClose, onPlayVideo }) {
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Esc key to close
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!launch) return null

  const net       = launch.net ? new Date(launch.net).getTime() : null
  const msLeft    = net ? Math.max(0, net - tick) : null
  const isImminent= msLeft !== null && msLeft < 60 * 60 * 1000

  const statusKey   = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const vehicle     = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site        = launch.pad?.name || '—'
  const location    = launch.pad?.location?.name || ''
  const agency      = launch.launch_service_provider?.name || null
  const streams     = parseStreams(launch.vidURLs)
  const primaryYt   = streams.find(s => s.ytId)

  // Mission name split
  const parts       = launch.name.split(' | ')
  const missionName = parts[1] || parts[0]
  const vehicleName = parts.length > 1 ? parts[0] : null

  return (
    <div className={`cinematic${isImminent ? ' cinematic-imminent' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      {/* Background — blurred launch image or star field */}
      {launch.image && (
        <div className="cinematic-bg" style={{ backgroundImage: `url(${launch.image})` }} />
      )}
      <div className="cinematic-vignette" />

      {/* Stars (CSS animation in stylesheet) */}
      <div className="cinematic-stars" />

      {/* Top bar */}
      <div className="cinematic-top">
        <div className="cinematic-agency">{agency || vehicle}</div>
        <button className="cinematic-close" onClick={onClose} title="Exit (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          ESC
        </button>
      </div>

      {/* Center — mission name + countdown */}
      <div className="cinematic-center">
        <div className="cinematic-mission">{missionName}</div>
        {vehicleName && <div className="cinematic-vehicle">{vehicleName}</div>}

        <div className={`cinematic-countdown${isImminent ? ' cinematic-countdown-imminent' : ''}`}>
          <CountdownTimer netTime={launch.net} status={launch.status} large />
        </div>

        <div className="cinematic-net-label">NET Launch</div>
        <div className="cinematic-site">
          📍 {site}{location ? `, ${location}` : ''}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="cinematic-bottom">
        <span className={`status-badge ${statusKey}`} style={{ fontSize: 11, padding: '4px 12px' }}>
          {launch.status?.name || 'TBD'}
        </span>

        {primaryYt && (
          <button
            className="cinematic-stream-btn"
            onClick={() => onPlayVideo(`https://www.youtube.com/embed/${primaryYt.ytId}?autoplay=1`, launch.name)}
          >
            ▶ Watch Live
          </button>
        )}

        {streams.filter(s => !s.ytId).map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="cinematic-stream-btn"
            style={{ textDecoration: 'none' }}>
            ↗ {s.label}
          </a>
        ))}

        <button className="cinematic-exit-hint" onClick={onClose}>
          Exit Cinematic
        </button>
      </div>
    </div>
  )
}
