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
  return { icon: '?', cls: 'oc-pending' }
}

function timeSince(netDate) {
  if (!netDate) return null
  const ms = Date.now() - new Date(netDate).getTime()
  if (ms < 0) return null
  const d = Math.floor(ms / 86400000)
  if (d < 1) return 'Today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export default function LaunchCard({ launch, selected, onSelect, onPlayVideo, isFavorite, onToggleFavorite }) {
  const statusKey   = getStatusKey(launch.status?.id)
  const vehicle     = launch.rocket?.configuration?.name || '—'
  const ytId        = extractYouTubeId(launch.vidURLs)
  const isFinal     = FINAL_STATUSES.has(launch.status?.id)
  const isScrubbed  = SCRUB_STATUSES.has(launch.status?.id)
  const isPending   = !isFinal && !isScrubbed && launch.net && new Date(launch.net).getTime() < Date.now()
  const { mission } = splitName(launch.name)

  function rightContent() {
    if (isFinal) {
      const oc = outcomeIcon(launch.status?.id)
      const ago = timeSince(launch.net)
      return <span className={`lc-outcome ${oc.cls}`}>{oc.icon} {ago || '—'}</span>
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
      data-launch-card
      onKeyDown={e => e.key === 'Enter' && onSelect(selected ? null : launch)}
    >
      <span className={`status-badge ${isPending ? 'pending' : statusKey}`}>
        {isPending ? 'PNDG' : (launch.status?.abbrev || 'TBD')}
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

      {onToggleFavorite && (
        <button
          className={`lc-fav${isFavorite ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(launch.id) }}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}
