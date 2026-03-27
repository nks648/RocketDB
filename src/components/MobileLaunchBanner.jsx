import React from 'react'
import CountdownTimer from './CountdownTimer'
import { STATUS_MAP } from '../data/launchZones'

function extractYouTubeId(urls) {
  if (!urls?.length) return null
  for (const v of urls) {
    const m = (v.url || v).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export default function MobileLaunchBanner({ launch, onClose, onPlayVideo }) {
  const statusKey = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const statusColor = STATUS_MAP[launch.status?.id]?.color || '#7a9ab8'
  const vehicle = launch.rocket?.configuration?.name || '—'
  const ytId = extractYouTubeId(launch.vidURLs)
  const isPast = [3, 4, 6].includes(launch.status?.id)
  const [, mission] = launch.name.split(' | ')

  return (
    <div className="mobile-launch-banner">
      <div className="mlb-bar" style={{ background: statusColor }} />

      <div className="mlb-body">
        <div className="mlb-top">
          <span className={`status-badge ${statusKey}`}>
            {launch.status?.abbrev || 'TBD'}
          </span>
          <span className="mlb-vehicle">{vehicle}</span>
        </div>
        <div className="mlb-name">{mission || launch.name}</div>
      </div>

      <div className="mlb-right">
        {!isPast && <CountdownTimer netTime={launch.net} />}
        <div className="mlb-actions">
          {ytId && (
            <button
              className="mlb-btn mlb-play"
              onClick={() => onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`)}
              title="Watch stream"
            >▶</button>
          )}
          <button className="mlb-btn mlb-close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
    </div>
  )
}
