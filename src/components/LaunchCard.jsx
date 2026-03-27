import React from 'react'
import CountdownTimer from './CountdownTimer'
import { STATUS_MAP } from '../data/launchZones'

function getStatusKey(statusId) {
  return STATUS_MAP[statusId]?.key || 'tbd'
}

function extractYouTubeId(urls) {
  if (!urls?.length) return null
  for (const v of urls) {
    const m = (v.url || v).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export default function LaunchCard({ launch, selected, onSelect, onPlayVideo }) {
  const statusKey = getStatusKey(launch.status?.id)
  const statusLabel = launch.status?.abbrev || 'TBD'
  const vehicle = launch.rocket?.configuration?.name || '—'
  const location = launch.pad?.location?.name || launch.pad?.name || '—'
  const ytId = extractYouTubeId(launch.vidURLs)
  const isPast = [3, 4, 6].includes(launch.status?.id)

  // Split "Falcon 9 Block 5 | Starlink Group 6-67" → vehicle + mission
  const parts = launch.name.split(' | ')
  const missionName = parts.length > 1 ? parts.slice(1).join(' | ') : parts[0]

  return (
    <div
      className={`launch-card status-${statusKey}${selected ? ' selected' : ''}`}
      onClick={() => onSelect(selected ? null : launch)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(selected ? null : launch)}
    >
      {/* Row 1: status badge + vehicle + countdown */}
      <div className="lc-row lc-top">
        <span className={`status-badge ${statusKey}`}>{statusLabel}</span>
        <span className="lc-vehicle">{vehicle}</span>
        {!isPast && (
          <span className="lc-countdown">
            <CountdownTimer netTime={launch.net} />
          </span>
        )}
        {isPast && (
          <span className="lc-date">
            {new Date(launch.net).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Row 2: mission name (most prominent) */}
      <div className="lc-name">{missionName}</div>

      {/* Row 3: location + optional stream button */}
      <div className="lc-row lc-bottom">
        <span className="lc-location">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{flexShrink:0}}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {location}
        </span>
        {ytId && (
          <button
            className="lc-stream-btn"
            onClick={e => {
              e.stopPropagation()
              onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`, launch.name)
            }}
            title="Watch live stream"
          >
            <span className="lc-stream-dot" />
            LIVE
          </button>
        )}
      </div>
    </div>
  )
}
