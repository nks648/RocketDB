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

  const statusKey   = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const statusLabel = launch.status?.name || 'Unknown'
  const vehicle     = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site        = launch.pad?.name || '—'
  const location    = launch.pad?.location?.name || ''
  const missionType = launch.mission?.type || null
  const orbit       = launch.mission?.orbit?.name || null
  const desc        = launch.mission?.description || null
  const ytId        = extractYouTubeId(launch.vidURLs)
  const isPast      = [3, 4, 6].includes(launch.status?.id)

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString([], { dateStyle:'medium', timeStyle:'short' })
    : null
  const windowEnd = launch.window_end
    ? new Date(launch.window_end).toLocaleString([], { timeStyle:'short' })
    : null

  const hasHold    = !!launch.holdreason
  const hasFailure = !!launch.failreason

  return (
    <div className="launch-detail">
      {/* Mission image */}
      {launch.image
        ? <img src={launch.image} alt="" className="launch-detail-img" />
        : <div className="launch-detail-img-placeholder">🚀</div>
      }

      {/* Info */}
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

        {/* ── Hold / Scrub / Failure reasons ── */}
        {hasHold && (
          <div className="scrub-reason hold">
            <div className="scrub-reason-label">⚠ Hold Reason</div>
            <div className="scrub-reason-text">{launch.holdreason}</div>
          </div>
        )}
        {hasFailure && (
          <div className="scrub-reason failure">
            <div className="scrub-reason-label">✕ Failure Reason</div>
            <div className="scrub-reason-text">{launch.failreason}</div>
          </div>
        )}
        {launch.status?.description && !hasHold && !hasFailure && statusKey !== 'go' && (
          <div className="scrub-reason info">
            <div className="scrub-reason-text">{launch.status.description}</div>
          </div>
        )}
      </div>

      {/* Right side: countdown + actions */}
      <div className="launch-detail-side">
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {!isPast && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2 }}>
              <CountdownTimer netTime={launch.net} large />
              <div className="countdown-label">NET Launch</div>
            </div>
          )}
          {isPast && (
            <div className="countdown-large" style={{ fontSize:14 }}>
              {new Date(launch.net).toLocaleDateString()}
            </div>
          )}
          {ytId && (
            <button
              className="btn-primary"
              onClick={() => onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`)}
            >
              ▶ Stream
            </button>
          )}
        </div>
        <button className="btn-close" onClick={onClose} style={{ alignSelf:'flex-start' }}>✕</button>
      </div>
    </div>
  )
}
