import React from 'react'
import CountdownTimer from './CountdownTimer'
import { STATUS_MAP } from '../data/launchZones'

function extractYouTubeId(urls) {
  if (!urls || !urls.length) return null
  for (const v of urls) {
    const m = (v.url || v).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export default function LaunchDetail({ launch, onClose, onPlayVideo }) {
  if (!launch) return null

  const statusKey = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const statusLabel = launch.status?.name || 'Unknown'
  const vehicle = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site = launch.pad?.name || '—'
  const location = launch.pad?.location?.name || ''
  const missionType = launch.mission?.type || '—'
  const desc = launch.mission?.description || launch.mission?.name || null
  const ytId = extractYouTubeId(launch.vidURLs)
  const isPast = launch.status?.id === 3 || launch.status?.id === 4 || launch.status?.id === 6

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString()
    : null
  const windowEnd = launch.window_end
    ? new Date(launch.window_end).toLocaleString()
    : null

  return (
    <div className="launch-detail">
      {/* Mission image */}
      {launch.image ? (
        <img src={launch.image} alt="" className="launch-detail-img" />
      ) : (
        <div className="launch-detail-img-placeholder">🚀</div>
      )}

      {/* Info */}
      <div className="launch-detail-info">
        <div className="launch-detail-name">{launch.name}</div>

        <div className="launch-detail-meta">
          <span className={`status-badge ${statusKey}`}>{statusLabel}</span>
          <span className="meta-chip">🚀 {vehicle}</span>
          <span className="meta-chip">📍 {site}{location ? `, ${location}` : ''}</span>
          <span className="meta-chip">🛸 {missionType}</span>
        </div>

        {desc && (
          <div className="launch-detail-desc">{desc}</div>
        )}

        {windowStart && (
          <div className="launch-detail-window">
            Window: {windowStart}{windowEnd ? ` → ${windowEnd}` : ''}
          </div>
        )}
      </div>

      {/* Right side: countdown + actions */}
      <div className="launch-detail-side">
        <button className="btn-close" onClick={onClose} title="Close">✕</button>

        {!isPast && (
          <>
            <CountdownTimer netTime={launch.net} large />
            <div className="countdown-label">NET Launch</div>
          </>
        )}

        {isPast && (
          <div className="countdown-large" style={{ fontSize:14 }}>
            {new Date(launch.net).toLocaleDateString()}
          </div>
        )}

        <div className="detail-action-row">
          {ytId && (
            <button
              className="btn-primary"
              onClick={() => onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`)}
            >
              ▶ Watch Stream
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
