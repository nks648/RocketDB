import React from 'react'
import CountdownTimer from './CountdownTimer'
import { STATUS_MAP } from '../data/launchZones'

function getStatusClass(statusId) {
  return STATUS_MAP[statusId]?.key || 'tbd'
}

function extractYouTubeId(urls) {
  if (!urls || urls.length === 0) return null
  for (const v of urls) {
    const u = v.url || v
    const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export default function LaunchCard({ launch, selected, onSelect, onPlayVideo }) {
  const statusKey = getStatusClass(launch.status?.id)
  const statusLabel = launch.status?.abbrev || launch.status?.name || 'TBD'
  const vehicle = launch.rocket?.configuration?.name || '—'
  const site = launch.pad?.location?.name || launch.pad?.name || '—'
  const ytId = extractYouTubeId(launch.vidURLs)
  const isPast = launch.status?.id === 3 || launch.status?.id === 4 || launch.status?.id === 6

  return (
    <div
      className={`launch-card status-${statusKey}${selected ? ' selected' : ''}`}
      onClick={() => onSelect(selected ? null : launch)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(selected ? null : launch)}
    >
      {launch.image ? (
        <img
          src={launch.image}
          alt=""
          className="launch-card-img"
          loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <div className="launch-card-img-placeholder">🚀</div>
      )}

      <div className="launch-card-body">
        <div className="launch-card-name" title={launch.name}>{launch.name}</div>
        <div className="launch-card-vehicle">{vehicle}</div>
        <div className="launch-card-site" title={site}>{site}</div>

        <div className="launch-card-footer">
          <span className={`status-badge ${statusKey}`}>{statusLabel}</span>

          <div className="launch-card-actions">
            {!isPast && <CountdownTimer netTime={launch.net} />}
            {ytId && (
              <button
                className="action-btn"
                title="Watch live stream"
                onClick={e => {
                  e.stopPropagation()
                  onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`)
                }}
              >
                ▶
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
