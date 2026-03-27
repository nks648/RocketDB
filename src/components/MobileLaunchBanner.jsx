import React, { useState, useCallback } from 'react'
import CountdownTimer from './CountdownTimer'
import WeatherWidget from './WeatherWidget'
import { STATUS_MAP } from '../data/launchZones'

function extractYouTubeId(urls) {
  if (!urls?.length) return null
  for (const v of urls) {
    const m = (v.url || v).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

function parseStreams(vidURLs) {
  if (!vidURLs?.length) return []
  return vidURLs.map(v => {
    const url = v.url || v
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    return { url, ytId: ytMatch?.[1] || null, label: v.title || (ytMatch ? 'YouTube' : 'Stream') }
  })
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
    for (const { ms, label } of [
      { ms: 60*60*1000, label:'T-1 Hour' },
      { ms: 30*60*1000, label:'T-30 Min' },
      { ms:  5*60*1000, label:'T-5 Min' },
      { ms: 0,          label:'🚀 Launch NOW' },
    ]) {
      const delay = net - ms - now
      if (delay > 0) {
        setTimeout(() => new Notification(`${label}: ${launch.rocket?.configuration?.name || 'Launch'}`, {
          body: launch.name, tag: `rocketdb-${launch.id}-${ms}`,
        }), delay)
        count++
      }
    }
    setState(count > 0 ? 'set' : 'idle')
  }, [launch])

  if (state === 'set')    return <button className="mlb-btn mlb-notify set"    disabled title="Alerts scheduled">🔔</button>
  if (state === 'denied') return <button className="mlb-btn mlb-notify denied" disabled title="Notifications blocked">🔕</button>
  return <button className="mlb-btn mlb-notify" onClick={schedule} title="Set launch alerts">🔔</button>
}

export default function MobileLaunchBanner({ launch, onClose, onPlayVideo }) {
  const [expanded, setExpanded] = useState(false)

  const statusKey   = STATUS_MAP[launch.status?.id]?.key   || 'tbd'
  const statusColor = STATUS_MAP[launch.status?.id]?.color || '#7a9ab8'
  const vehicle     = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—'
  const site        = launch.pad?.name || '—'
  const location    = launch.pad?.location?.name || ''
  const missionType = launch.mission?.type || null
  const orbit       = launch.mission?.orbit?.name || null
  const desc        = launch.mission?.description || null
  const isPast      = [3, 4, 6].includes(launch.status?.id)
  const streams     = parseStreams(launch.vidURLs)
  const primaryYt   = streams.find(s => s.ytId)

  const padLat = parseFloat(launch.pad?.latitude)
  const padLng = parseFloat(launch.pad?.longitude)

  const [, mission] = launch.name.split(' | ')
  const missionName = mission || launch.name

  const windowStart = launch.window_start
    ? new Date(launch.window_start).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : null

  return (
    <div className={`mobile-launch-banner${expanded ? ' mlb-expanded' : ''}`}>
      <div className="mlb-bar" style={{ background: statusColor }} />

      <div className="mlb-content">
        {/* ── Always-visible compact row ── */}
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
                title="Mission details + weather"
              >ℹ</button>
              {primaryYt && (
                <button
                  className="mlb-btn mlb-play"
                  onClick={() => onPlayVideo(`https://www.youtube.com/embed/${primaryYt.ytId}?autoplay=1`, launch.name)}
                  title="Watch stream"
                >▶</button>
              )}
              {!isPast && <NotifyButton launch={launch} />}
              <button className="mlb-btn mlb-close" onClick={onClose} title="Close">✕</button>
            </div>
          </div>
        </div>

        {/* ── Expanded detail ── */}
        {expanded && (
          <div className="mlb-detail">
            {/* Weather — most important for enthusiasts */}
            {!isPast && !isNaN(padLat) && !isNaN(padLng) && (
              <div style={{ marginBottom: 8 }}>
                <WeatherWidget lat={padLat} lng={padLng} compact />
              </div>
            )}

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
              <div className="mlb-detail-row">
                <span className="mlb-detail-label" style={{ color:'#ff9940' }}>Hold</span>
                <span className="mlb-detail-value" style={{ color:'#ff9940' }}>{launch.holdreason}</span>
              </div>
            )}
            {launch.failreason && (
              <div className="mlb-detail-row">
                <span className="mlb-detail-label" style={{ color:'#ff4444' }}>Failure</span>
                <span className="mlb-detail-value" style={{ color:'#ff6b6b' }}>{launch.failreason}</span>
              </div>
            )}

            {/* Extra streams */}
            {streams.length > 1 && (
              <div className="mlb-detail-row" style={{ alignItems:'flex-start', flexWrap:'wrap', gap:4 }}>
                <span className="mlb-detail-label">Streams</span>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {streams.map((s, i) => (
                    s.ytId ? (
                      <button key={i} className="lc-stream-btn"
                        onClick={() => onPlayVideo(`https://www.youtube.com/embed/${s.ytId}?autoplay=1`, s.label)}>
                        ▶ {s.label}
                      </button>
                    ) : (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="lc-stream-btn"
                        style={{ textDecoration:'none' }}>
                        ↗ {s.label}
                      </a>
                    )
                  ))}
                </div>
              </div>
            )}

            {desc && <div className="mlb-detail-desc">{desc}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
