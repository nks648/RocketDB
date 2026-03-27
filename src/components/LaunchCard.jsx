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
  const ytId = extractYouTubeId(launch.vidURLs)
  const isPast = [3, 4, 6].includes(launch.status?.id)

  return (
    <div
      className={`launch-card status-${statusKey}${selected ? ' selected' : ''}`}
      onClick={() => onSelect(selected ? null : launch)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(selected ? null : launch)}
    >
      <span className={`status-badge ${statusKey}`}>{statusLabel}</span>
      <span className="lc-vehicle">{vehicle}</span>
      <span className="lc-time">
        {isPast
          ? new Date(launch.net).toLocaleDateString([], { month: 'short', day: 'numeric' })
          : <CountdownTimer netTime={launch.net} status={launch.status} />
        }
      </span>
      {ytId && (
        <button
          className="lc-play"
          onClick={e => {
            e.stopPropagation()
            onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`, launch.name)
          }}
          aria-label="Watch live stream"
        >▶</button>
      )}
    </div>
  )
}
