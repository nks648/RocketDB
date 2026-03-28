import React, { useState, useCallback } from 'react'
import CountdownTimer from './CountdownTimer'
import WeatherWidget from './WeatherWidget'
import { STATUS_MAP } from '../data/launchZones'
import { useRedditThread } from '../hooks/useRedditThread'
import { useSunriseSunset } from '../hooks/useSunriseSunset'
import {
  guessInclination, orbitAltKm, orbitalPeriod, orbitalVelocity,
} from '../utils/orbital'

function parseStreams(vidURLs) {
  if (!vidURLs?.length) return []
  return vidURLs.map(v => {
    const url = typeof v === 'string' ? v : v?.url
    if (!url || typeof url !== 'string') return null
    // Security: only allow HTTPS URLs — reject javascript:, data:, http:, etc.
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
  const [state, setState] = useState('idle') // idle | granted | denied | set

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

function OrbitalParams({ launch }) {
  const orbitAbbrev = launch?.mission?.orbit?.abbrev
  const orbitName   = launch?.mission?.orbit?.name
  if (!orbitName && !orbitAbbrev) return null

  const padLat  = parseFloat(launch?.pad?.latitude)
  const inc     = guessInclination(orbitAbbrev, isNaN(padLat) ? null : padLat)
  const altKm   = orbitAltKm(orbitAbbrev)
  const Tmin    = Math.round(orbitalPeriod(altKm) / 60)
  const velKms  = orbitalVelocity(altKm).toFixed(2)

  const rows = [
    { label: 'Orbit',        val: orbitAbbrev || orbitName },
    { label: 'Altitude',     val: altKm >= 1000 ? `${(altKm/1000).toFixed(0)}k km` : `${altKm.toLocaleString()} km` },
    { label: 'Inclination',  val: `${inc.toFixed(1)}°` },
    { label: 'Period',       val: `~${Tmin} min` },
    { label: 'Velocity',     val: `${velKms} km/s` },
  ]

  return (
    <div className="orbital-panel">
      <div className="orbital-panel-grid">
        {rows.map(r => (
          <div key={r.label} className="op-cell">
            <div className="op-val">{r.val}</div>
            <div className="op-label">{r.label}</div>
          </div>
        ))}
      </div>
      <div className="op-note">
        ⓘ Altitude &amp; inclination are estimates based on orbit class
      </div>
    </div>
  )
}

function RedditDiscussion({ launch }) {
  const { posts, loading } = useRedditThread(launch)
  if (loading) return <div className="reddit-loading">Loading discussion…</div>
  if (!posts.length) return null
  return (
    <div className="reddit-section">
      <div className="reddit-title">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor" style={{ color:'#ff4500', verticalAlign:'middle', marginRight:4 }}>
          <circle cx="10" cy="10" r="10"/>
          <path fill="white" d="M16.7 10a1.5 1.5 0 0 0-2.6-1 7.4 7.4 0 0 0-3.9-1.2l.7-3.1 2.1.5a1 1 0 1 0 .1-.5l-2.4-.5a.2.2 0 0 0-.3.2l-.7 3.4a7.4 7.4 0 0 0-3.9 1.2 1.5 1.5 0 1 0-1.6 2.4 3 3 0 0 0 0 .5c0 2.5 2.9 4.5 6.5 4.5s6.5-2 6.5-4.5a3 3 0 0 0 0-.5 1.5 1.5 0 0 0 .5-1.4zm-10.2 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm5.6 2.7a3.4 3.4 0 0 1-4.2 0 .3.3 0 0 1 .4-.4 2.8 2.8 0 0 0 3.4 0 .3.3 0 0 1 .4.4zm-.2-1.7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
        </svg>
        Discussion
      </div>
      <div className="reddit-posts">
        {posts.map(p => (
          <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="reddit-post">
            <span className="reddit-post-sub">r/{p.sub}</span>
            <span className="reddit-post-title">{p.title}</span>
            <span className="reddit-post-meta">▲{p.score} · {p.comments} comments</span>
          </a>
        ))}
      </div>
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
  const primaryYt = streams.find(s => s.ytId)

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString([], { dateStyle:'medium', timeStyle:'short' })
    : null
  const windowEnd = launch.window_end
    ? new Date(launch.window_end).toLocaleString([], { timeStyle:'short' })
    : null

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

        {/* Orbital parameters */}
        {!isPast && (launch.mission?.orbit?.abbrev || launch.mission?.orbit?.name) && (
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
