import React, { useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)

  const statusKey  = STATUS_MAP[launch.status?.id]?.key   || 'tbd'
  const statusColor = STATUS_MAP[launch.status?.id]?.color || '#7a9ab8'
  const vehicle    = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site       = launch.pad?.name || '—'
  const location   = launch.pad?.location?.name || ''
  const missionType = launch.mission?.type || null
  const orbit      = launch.mission?.orbit?.name || null
  const desc       = launch.mission?.description || null
  const ytId       = extractYouTubeId(launch.vidURLs)
  const isPast     = [3, 4, 6].includes(launch.status?.id)

  const [, mission] = launch.name.split(' | ')
  const missionName = mission || launch.name

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className={`mobile-launch-banner${expanded ? ' mlb-expanded' : ''}`}>
      <div className="mlb-bar" style={{ background: statusColor }} />

      <div className="mlb-content">
        {/* ── Compact row (always visible) ── */}
        <div className="mlb-compact">
          <div className="mlb-body">
            <div className="mlb-top">
              <span className={`status-badge ${statusKey}`}>{launch.status?.abbrev || 'TBD'}</span>
              <span className="mlb-vehicle">{launch.rocket?.configuration?.name || '—'}</span>
            </div>
            <div className="mlb-name">{missionName}</div>
          </div>

          <div className="mlb-right">
            {!isPast && <CountdownTimer netTime={launch.net} />}
            <div className="mlb-actions">
              <button
                className={`mlb-btn mlb-info${expanded ? ' active' : ''}`}
                onClick={() => setExpanded(v => !v)}
                title="Mission details"
              >ℹ</button>
              {ytId && (
                <button
                  className="mlb-btn mlb-play"
                  onClick={() => onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`, launch.name)}
                  title="Watch stream"
                >▶</button>
              )}
              <button className="mlb-btn mlb-close" onClick={onClose} title="Close">✕</button>
            </div>
          </div>
        </div>

        {/* ── Expanded detail section ── */}
        {expanded && (
          <div className="mlb-detail">
            <div className="mlb-detail-row">
              <span className="mlb-detail-label">Rocket</span>
              <span className="mlb-detail-value">{vehicle}</span>
            </div>
            {missionType && (
              <div className="mlb-detail-row">
                <span className="mlb-detail-label">Type</span>
                <span className="mlb-detail-value">{missionType}{orbit ? ` · ${orbit}` : ''}</span>
              </div>
            )}
            <div className="mlb-detail-row">
              <span className="mlb-detail-label">Site</span>
              <span className="mlb-detail-value">{site}{location ? `, ${location}` : ''}</span>
            </div>
            {windowStart && (
              <div className="mlb-detail-row">
                <span className="mlb-detail-label">Window</span>
                <span className="mlb-detail-value">{windowStart}</span>
              </div>
            )}
            {launch.status?.description && (
              <div className="mlb-detail-row">
                <span className="mlb-detail-label">Status</span>
                <span className="mlb-detail-value">{launch.status.description}</span>
              </div>
            )}
            {launch.holdreason && (
              <div className="mlb-detail-row" style={{ alignItems:'flex-start' }}>
                <span className="mlb-detail-label" style={{ color:'#ff9940' }}>Hold</span>
                <span className="mlb-detail-value" style={{ color:'#ff9940' }}>{launch.holdreason}</span>
              </div>
            )}
            {launch.failreason && (
              <div className="mlb-detail-row" style={{ alignItems:'flex-start' }}>
                <span className="mlb-detail-label" style={{ color:'#ff4444' }}>Failure</span>
                <span className="mlb-detail-value" style={{ color:'#ff6b6b' }}>{launch.failreason}</span>
              </div>
            )}
            {desc && (
              <div className="mlb-detail-desc">{desc}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
