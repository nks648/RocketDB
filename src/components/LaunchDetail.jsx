import React, { useState, useCallback } from 'react'
import CountdownTimer from './CountdownTimer'
import WeatherWidget from './WeatherWidget'
import OrbitalParams from './OrbitalParams'
import RedditDiscussion from './RedditDiscussion'
import { STATUS_MAP } from '../data/launchZones'
import { useSunriseSunset } from '../hooks/useSunriseSunset'

function parseStreams(vidURLs) {
  if (!vidURLs?.length) return []
  return vidURLs.map(v => {
    const url = typeof v === 'string' ? v : v?.url
    if (!url || typeof url !== 'string') return null
    if (!url.startsWith('https://')) return null
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    let hostname = 'Stream'
    if (!ytMatch) {
      try { hostname = new URL(url).hostname.replace('www.', '') } catch { return null }
    }
    return { url, ytId: ytMatch?.[1] || null, label: v.title || (ytMatch ? 'YouTube' : hostname) }
  }).filter(Boolean)
}

function NotifyButton({ launch }) {
  const [state, setState] = useState('idle')

  const schedule = useCallback(async () => {
    if (!('Notification' in window)) { setState('denied'); return }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') { setState('denied'); return }

    const net = new Date(launch.net).getTime()
    const now = Date.now()
    let count = 0
    const milestones = [
      { ms: 60 * 60 * 1000, label: 'T-1 Hour' },
      { ms: 30 * 60 * 1000, label: 'T-30 Minutes' },
      { ms:  5 * 60 * 1000, label: 'T-5 Minutes' },
      { ms:  0,             label: 'Launch NOW' },
    ]
    for (const { ms, label } of milestones) {
      const delay = net - ms - now
      if (delay > 0) {
        setTimeout(() => {
          new Notification(`🚀 ${label}: ${launch.rocket?.configuration?.name || 'Launch'}`, {
            body: launch.name,
            tag:  `rocketdb-${launch.id}-${ms}`,
          })
        }, delay)
        count++
      }
    }
    setState(count > 0 ? 'set' : 'idle')
  }, [launch])

  if (state === 'set')    return <button className="btn-notify set"    disabled>🔔 Alerts Set</button>
  if (state === 'denied') return <button className="btn-notify denied" disabled>🔕 Blocked</button>
  return <button className="btn-notify" onClick={schedule}>🔔 Notify Me</button>
}

function BoosterReuse({ launch }) {
  const stages = launch.rocket?.launcher_stage
  if (!stages?.length) return null

  return (
    <div className="booster-grid">
      {stages.map((stage, i) => {
        const serial = stage.launcher?.serial_number
        const flightNum = stage.launcher_flight_number
        const reused = stage.reused
        const landSuccess = stage.landing?.success
        const landType = stage.landing?.type?.abbrev

        return (
          <div key={i} className="booster-item">
            <div className="booster-serial">{serial || `Core ${i + 1}`}</div>
            <div className="booster-meta">
              {flightNum && <span className="booster-chip">Flight #{flightNum}</span>}
              {reused && <span className="booster-chip reused">♻ Reused</span>}
              {landSuccess === true  && <span className="booster-chip landed">✓ {landType || 'Landed'}</span>}
              {landSuccess === false && <span className="booster-chip expended">✕ Expended</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setOpen(v => !v)}>
        <span>{title}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s', flexShrink:0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}

export default function LaunchDetail({ launch, onClose, onPlayVideo }) {
  const [descExpanded, setDescExpanded] = useState(false)
  if (!launch) return null

  const statusKey   = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const statusLabel = launch.status?.name || 'Unknown'
  const vehicle     = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site        = launch.pad?.name || '—'
  const location    = launch.pad?.location?.name || ''
  const missionType = launch.mission?.type || null
  const orbit       = launch.mission?.orbit?.name || null
  const desc        = launch.mission?.description || null
  const isPast      = [3, 4, 6].includes(launch.status?.id)
  const agency      = launch.launch_service_provider?.name || null
  const agencyAbbr  = launch.launch_service_provider?.abbrev || null
  const probability = launch.probability != null ? launch.probability : null

  const padLat   = parseFloat(launch.pad?.latitude)
  const padLng   = parseFloat(launch.pad?.longitude)
  const sunData  = useSunriseSunset(
    isNaN(padLat) ? null : padLat,
    isNaN(padLng) ? null : padLng,
    launch.net
  )

  const streams = parseStreams(launch.vidURLs)

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString([], { dateStyle:'medium', timeStyle:'short' })
    : null
  const windowEnd = launch.window_end
    ? new Date(launch.window_end).toLocaleString([], { timeStyle:'short' })
    : null

  const hasBooster = launch.rocket?.launcher_stage?.length > 0
  const hasOrbit   = !!(launch.mission?.orbit?.abbrev || launch.mission?.orbit?.name)

  return (
    <div className="launch-detail">
      {/* Image */}
      {launch.image
        ? <img src={launch.image} alt="" className="launch-detail-img" />
        : <div className="launch-detail-img-placeholder">🚀</div>
      }

      {/* Info column */}
      <div className="launch-detail-info">
        <div className="launch-detail-name">{launch.name}</div>

        <div className="launch-detail-meta">
          <span className={`status-badge ${statusKey}`}>{statusLabel}</span>
          <span className="meta-chip">🚀 {vehicle}</span>
          <span className="meta-chip">📍 {site}{location ? `, ${location}` : ''}</span>
          {missionType && <span className="meta-chip">🛸 {missionType}{orbit ? ` · ${orbit}` : ''}</span>}
          {agency && <span className="meta-chip">🏢 {agencyAbbr || agency}</span>}
          {probability != null && (
            <span className={`meta-chip probability-chip${probability >= 80 ? ' prob-go' : probability >= 50 ? ' prob-marginal' : ' prob-low'}`}>
              🎯 {probability}% launch prob.
            </span>
          )}
          {!isPast && sunData?.icon && (
            <span className="meta-chip" style={{ color: sunData.color }}>
              {sunData.icon} {sunData.label}
            </span>
          )}
        </div>

        {desc && (
          <div>
            <div className={`launch-detail-desc${descExpanded ? ' expanded' : ''}`}>{desc}</div>
            {desc.length > 160 && (
              <button className="desc-expand-btn" onClick={() => setDescExpanded(v => !v)}>
                {descExpanded ? '▲ Less' : '▼ More'}
              </button>
            )}
          </div>
        )}

        {windowStart && (
          <div className="launch-detail-window">
            Window: {windowStart}{windowEnd ? ` → ${windowEnd}` : ''}
          </div>
        )}

        {/* Hold / failure reasons */}
        {launch.holdreason && (
          <div className="scrub-reason hold">
            <div className="scrub-reason-label">⚠ Hold Reason</div>
            <div className="scrub-reason-text">{launch.holdreason}</div>
          </div>
        )}
        {launch.failreason && (
          <div className="scrub-reason failure">
            <div className="scrub-reason-label">✕ Failure Reason</div>
            <div className="scrub-reason-text">{launch.failreason}</div>
          </div>
        )}

        {/* Booster reuse */}
        {hasBooster && (
          <CollapsibleSection title="🔁 Booster / Reuse">
            <BoosterReuse launch={launch} />
          </CollapsibleSection>
        )}

        {/* Orbital parameters */}
        {hasOrbit && (
          <CollapsibleSection title="📡 Orbital Parameters">
            <OrbitalParams launch={launch} />
          </CollapsibleSection>
        )}

        {/* Pad weather */}
        {!isPast && !isNaN(padLat) && !isNaN(padLng) && (
          <CollapsibleSection title="🌤 Pad Weather">
            <WeatherWidget lat={padLat} lng={padLng} />
          </CollapsibleSection>
        )}

        {/* Reddit discussion */}
        <RedditDiscussion launch={launch} />
      </div>

      {/* Right side */}
      <div className="launch-detail-side">
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
          {!isPast && (
            <>
              <CountdownTimer netTime={launch.net} status={launch.status} large />
              <div className="countdown-label">NET Launch</div>
            </>
          )}
          {isPast && (
            <div className="countdown-large" style={{ fontSize:14 }}>
              {new Date(launch.net).toLocaleDateString()}
            </div>
          )}

          {/* Stream buttons */}
          {streams.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
              {streams.map((s, i) => (
                s.ytId ? (
                  <button
                    key={i}
                    className="btn-primary"
                    onClick={() => onPlayVideo(`https://www.youtube.com/embed/${s.ytId}?autoplay=1`, s.label)}
                  >
                    ▶ {s.label}
                  </button>
                ) : (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textDecoration:'none' }}>
                    ↗ {s.label}
                  </a>
                )
              ))}
            </div>
          )}

          {/* Notify */}
          {!isPast && <NotifyButton launch={launch} />}
        </div>

        <button className="btn-close" onClick={onClose} style={{ alignSelf:'flex-start' }}>✕</button>
      </div>
    </div>
  )
}
