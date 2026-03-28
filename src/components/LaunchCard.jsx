import React from 'react'
import CountdownTimer from './CountdownTimer'
import { STATUS_MAP } from '../data/launchZones'

const FINAL_STATUSES = new Set([3, 4, 7])
const SCRUB_STATUSES  = new Set([2, 5, 8])

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

// "Falcon 9 | Starlink 6-80" → { vehicle: "Falcon 9", mission: "Starlink 6-80" }
function splitName(name = '') {
  const idx = name.indexOf(' | ')
  if (idx === -1) return { vehicle: null, mission: name }
  return { vehicle: name.slice(0, idx), mission: name.slice(idx + 3) }
}

function outcomeIcon(statusId) {
  if (statusId === 3) return { icon: '✓', cls: 'oc-success' }
  if (statusId === 4) return { icon: '✕', cls: 'oc-failure' }
  if (statusId === 7) return { icon: '~', cls: 'oc-partial' }
  return { icon: '?', cls: 'oc-pending' }  // result not yet confirmed
}

export default function LaunchCard({ launch, selected, onSelect, onPlayVideo }) {
  const statusKey   = getStatusKey(launch.status?.id)
  const statusLabel = launch.status?.abbrev || 'TBD'
  const vehicle     = launch.rocket?.configuration?.name || '—'
  const ytId        = extractYouTubeId(launch.vidURLs)
  const isFinal     = FINAL_STATUSES.has(launch.status?.id)
  const isScrubbed  = SCRUB_STATUSES.has(launch.status?.id)
  const isPending   = !isFinal && !isScrubbed && launch.net && new Date(launch.net).getTime() < Date.now()
  const { mission } = splitName(launch.name)

  // For past cards show "✓ Mar 27" or "? pending"
  function rightContent() {
    if (isFinal) {
      const oc = outcomeIcon(launch.status?.id)
      const d  = launch.net
        ? new Date(launch.net).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : '—'
      return <span className={`lc-outcome ${oc.cls}`}>{oc.icon} {d}</span>
    }
    if (isPending) {
      return <span className="lc-pending">Pending result</span>
    }
    return <CountdownTimer netTime={launch.net} status={launch.status} />
  }

  return (
    <div
      className={`launch-card status-${statusKey}${selected ? ' selected' : ''}${isScrubbed ? ' lc-scrubbed' : ''}`}
      onClick={() => onSelect(selected ? null : launch)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(selected ? null : launch)}
    >
      <span className={`status-badge ${isPending ? 'pending' : statusKey}`}>
        {isPending ? 'PNDG' : statusLabel}
      </span>

      <span className="lc-names">
        <span className="lc-mission">{vehicle}</span>
        {mission && <span className="lc-vehicle-sub">{mission}</span>}
      </span>

      <span className="lc-time">{rightContent()}</span>

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
