import React, { useMemo, useState, useEffect } from 'react'
import {
  MapContainer, TileLayer, Polygon, Circle,
  Marker, Popup, Polyline, useMap, ZoomControl,
} from 'react-leaflet'
import L from 'leaflet'
import { MARITIME_ZONES, AIRSPACE_ZONES, STATUS_MAP } from '../data/launchZones'
import { useAircraft }  from '../hooks/useAircraft'
import { useISS }       from '../hooks/useISS'
import {
  guessInclination, orbitAltKm, trajectoryArc,
  groundTrack, splitAtAntimeridian,
  orbitalPeriod, orbitalVelocity,
} from '../utils/orbital'

// Fix Leaflet default icon path broken by Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Icon factories ────────────────────────────────────────────────────────────
function makeRocketIcon(color, selected, launching) {
  const glow = selected
    ? `drop-shadow(0 0 8px ${color})`
    : `drop-shadow(0 0 3px ${color})`
  const anim = launching ? 'animation:rocket-pulse 1s infinite;' : ''
  return L.divIcon({
    className: '',
    html: `<div style="font-size:20px;filter:${glow};cursor:pointer;${anim}transition:transform 0.15s">🚀</div>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14],
  })
}

function makePlaneIcon(heading) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:16px;transform:rotate(${heading}deg);line-height:1;cursor:pointer;filter:drop-shadow(0 0 2px rgba(255,220,50,0.8))">✈</div>`,
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -12],
  })
}

function makeISSIcon(visibility) {
  const glow = visibility === 'daylight'
    ? 'drop-shadow(0 0 6px #ffd740)'
    : 'drop-shadow(0 0 6px #bb86fc)'
  return L.divIcon({
    className: '',
    html: `<div style="font-size:20px;filter:${glow};cursor:pointer;line-height:1">🛸</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14],
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPadColor(statusId) { return STATUS_MAP[statusId]?.color || '#7a9ab8' }

function isImminent(netTime) {
  if (!netTime) return false
  return new Date(netTime).getTime() - Date.now() < 3 * 3600 * 1000
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FlyTo({ launch }) {
  const map = useMap()
  useEffect(() => {
    if (!launch?.pad?.latitude || !launch?.pad?.longitude) return
    map.flyTo(
      [parseFloat(launch.pad.latitude), parseFloat(launch.pad.longitude)],
      6, { duration: 1.2 }
    )
  }, [launch, map])
  return null
}

function LaunchPopup({ launch, onSelect, onPlayVideo }) {
  const statusKey = STATUS_MAP[launch.status?.id]?.key || 'tbd'
  const vehicle   = launch.rocket?.configuration?.name || '—'
  const site      = launch.pad?.name || '—'
  const net       = launch.net ? new Date(launch.net).toLocaleString() : 'TBD'

  function extractYtId(urls) {
    if (!urls?.length) return null
    for (const v of urls) {
      const m = (v.url || v).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
      if (m) return m[1]
    }
    return null
  }
  const ytId = extractYtId(launch.vidURLs)

  return (
    <div className="popup-inner">
      <div className="popup-name">{launch.name}</div>
      <div className="popup-vehicle">{vehicle}</div>
      <div className="popup-site">{site}</div>
      <div className="popup-countdown">{net}</div>
      {launch.holdreason && (
        <div style={{ fontSize:10, color:'#ff9940', marginTop:4, lineHeight:1.4 }}>
          ⚠ {launch.holdreason}
        </div>
      )}
      <div style={{ display:'flex', gap:6, marginTop:6 }}>
        <span className={`status-badge ${statusKey}`}>
          {launch.status?.abbrev || 'TBD'}
        </span>
        {ytId && (
          <button
            className="btn-primary"
            style={{ padding:'3px 10px', fontSize:11 }}
            onClick={() => onPlayVideo(`https://www.youtube.com/embed/${ytId}?autoplay=1`)}
          >▶ Stream</button>
        )}
      </div>
    </div>
  )
}

// ── Orbital overlay (ground track + trajectory arc) ───────────────────────────
function OrbitalOverlay({ launch, showTrajectory }) {
  const orbitAbbrev  = launch?.mission?.orbit?.abbrev
  const padLat       = parseFloat(launch?.pad?.latitude)
  const padLng       = parseFloat(launch?.pad?.longitude)

  const { arcSegs, trackSegs } = useMemo(() => {
    if (!launch || !showTrajectory) return { arcSegs: [], trackSegs: [] }
    if (isNaN(padLat) || isNaN(padLng)) return { arcSegs: [], trackSegs: [] }

    const inc    = guessInclination(orbitAbbrev, padLat)
    const altKm  = orbitAltKm(orbitAbbrev)

    const arc    = trajectoryArc(padLat, padLng, inc)
    const track  = groundTrack(inc, altKm, padLng)

    return {
      arcSegs:   splitAtAntimeridian(arc),
      trackSegs: splitAtAntimeridian(track),
    }
  }, [launch, showTrajectory, padLat, padLng, orbitAbbrev])

  if (!showTrajectory || (!arcSegs.length && !trackSegs.length)) return null

  return (
    <>
      {/* Ascent trajectory arc — bright orange */}
      {arcSegs.map((seg, i) => (
        <Polyline key={`arc-${i}`} positions={seg}
          pathOptions={{ color:'#ff6b35', weight:2.5, opacity:0.85, dashArray:'8 5' }} />
      ))}
      {/* Orbital ground track — cyan */}
      {trackSegs.map((seg, i) => (
        <Polyline key={`track-${i}`} positions={seg}
          pathOptions={{ color:'#00c8f0', weight:1.5, opacity:0.55, dashArray:'4 6' }} />
      ))}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorldMap({ launches, selectedLaunch, onSelectLaunch, onPlayVideo }) {
  const [showMaritime,   setShowMaritime]   = useState(true)
  const [showAirspace,   setShowAirspace]   = useState(true)
  const [showSites,      setShowSites]      = useState(true)
  const [showAircraft,   setShowAircraft]   = useState(false)
  const [showISS,        setShowISS]        = useState(false)
  const [showTrajectory, setShowTrajectory] = useState(false)

  // Focus point: selected launch pad, else nearest upcoming launch
  const focusLaunch = selectedLaunch || launches.find(l => l.pad?.latitude)
  const focusLat    = focusLaunch ? parseFloat(focusLaunch.pad?.latitude)  : null
  const focusLng    = focusLaunch ? parseFloat(focusLaunch.pad?.longitude) : null

  const { aircraft, loading: aircraftLoading, error: aircraftError } = useAircraft(
    showAircraft, focusLat, focusLng
  )
  const { position: issPos, error: issError } = useISS(showISS)

  // Deduplicate launches by pad
  const padMarkers = useMemo(() => {
    const seen = new Map()
    for (const l of launches) {
      const lat = parseFloat(l.pad?.latitude)
      const lng = parseFloat(l.pad?.longitude)
      if (isNaN(lat) || isNaN(lng)) continue
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
      if (!seen.has(key) || l.status?.id === 1) seen.set(key, { launch: l, lat, lng })
    }
    return [...seen.values()]
  }, [launches])

  // Orbital info for selected / focus launch (for trajectory toggle label)
  const targetLaunch    = selectedLaunch || focusLaunch
  const targetOrbit     = targetLaunch?.mission?.orbit?.abbrev
  const hasOrbitData    = !!targetOrbit

  return (
    <div className="map-area" style={{ position:'relative', width:'100%', height:'100%' }}>

      {/* ── Layer toggle panel ── */}
      <div className="map-toggle-panel">
        <button className={`toggle-btn${showMaritime ? ' active' : ''}`}
          onClick={() => setShowMaritime(v => !v)} aria-label="Toggle maritime zones">
          <span className="toggle-swatch" style={{ background:'#ff6b35' }} />
          <span className="toggle-label">Maritime</span>
          <span className="toggle-check">{showMaritime ? '✓' : ''}</span>
        </button>

        <button className={`toggle-btn${showAirspace ? ' active' : ''}`}
          onClick={() => setShowAirspace(v => !v)} aria-label="Toggle airspace TFRs">
          <span className="toggle-swatch" style={{ background:'#bb86fc' }} />
          <span className="toggle-label">Airspace</span>
          <span className="toggle-check">{showAirspace ? '✓' : ''}</span>
        </button>

        <button className={`toggle-btn${showSites ? ' active' : ''}`}
          onClick={() => setShowSites(v => !v)} aria-label="Toggle launch sites">
          <span className="toggle-swatch" style={{ background:'#00c8f0' }} />
          <span className="toggle-label">Sites</span>
          <span className="toggle-check">{showSites ? '✓' : ''}</span>
        </button>

        <button className={`toggle-btn${showAircraft ? ' active' : ''}`}
          onClick={() => setShowAircraft(v => !v)}
          title="Live aircraft near active site (OpenSky Network)">
          <span className="toggle-swatch" style={{ background:'#ffd740', fontSize:10 }}>✈</span>
          <span className="toggle-label">
            Aircraft{aircraftLoading ? ' …' : showAircraft ? ` (${aircraft.length})` : ''}
          </span>
          <span className="toggle-check">{showAircraft ? '✓' : ''}</span>
        </button>

        <button className={`toggle-btn${showISS ? ' active' : ''}`}
          onClick={() => setShowISS(v => !v)}
          title="International Space Station live position (wheretheiss.at)">
          <span className="toggle-swatch" style={{ background:'#bb86fc', fontSize:10 }}>🛸</span>
          <span className="toggle-label">
            ISS{issPos ? ` · ${issPos.altKm.toFixed(0)} km` : ''}
          </span>
          <span className="toggle-check">{showISS ? '✓' : ''}</span>
        </button>

        <button
          className={`toggle-btn${showTrajectory ? ' active' : ''}${!hasOrbitData ? ' toggle-disabled' : ''}`}
          onClick={() => hasOrbitData && setShowTrajectory(v => !v)}
          title={hasOrbitData
            ? `Show ascent arc + ${targetOrbit} ground track`
            : 'Select a launch with orbit data to show trajectory'}
        >
          <span className="toggle-swatch" style={{ background:'#ff6b35', fontSize:10 }}>📡</span>
          <span className="toggle-label">
            Trajectory{targetOrbit ? ` · ${targetOrbit}` : ''}
          </span>
          <span className="toggle-check">{showTrajectory ? '✓' : ''}</span>
        </button>
      </div>

      {/* ── Status notes ── */}
      {showAircraft && aircraftError && (
        <div className="map-status-note" style={{ borderColor:'#ff6b35', color:'#ff9940' }}>
          ⚠ Aircraft data unavailable — {aircraftError}
        </div>
      )}
      {showISS && issError && (
        <div className="map-status-note" style={{ borderColor:'#bb86fc', color:'#bb86fc' }}>
          ⚠ ISS data unavailable
        </div>
      )}

      <MapContainer
        center={[20, 10]} zoom={2} minZoom={2}
        maxBounds={[[-85, -180], [85, 180]]} maxBoundsViscosity={1}
        zoomControl={false}
        style={{ width:'100%', height:'100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          subdomains="abcd" maxZoom={19}
        />
        <ZoomControl position="bottomleft" />

        {selectedLaunch && <FlyTo launch={selectedLaunch} />}

        {/* Orbital overlay */}
        <OrbitalOverlay launch={targetLaunch} showTrajectory={showTrajectory} />

        {/* Maritime exclusion zones */}
        {showMaritime && MARITIME_ZONES.map(zone => (
          <Polygon key={zone.id} positions={zone.coords}
            pathOptions={{ color:zone.color, fillColor:zone.color,
              fillOpacity:zone.fillOpacity, weight:1.5, dashArray:'6 4' }}>
            <Popup>
              <div className="popup-zone-inner">
                <div className="popup-zone-title">{zone.name}</div>
                <div className="popup-zone-desc">{zone.description}</div>
                <div style={{ marginTop:6, fontSize:10, color:'#7a9ab8' }}>
                  Source: USCG NOTMAR / national maritime authority
                </div>
              </div>
            </Popup>
          </Polygon>
        ))}

        {/* Airspace TFR circles */}
        {showAirspace && AIRSPACE_ZONES.map(zone => (
          <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radius}
            pathOptions={{ color:zone.color, fillColor:zone.color,
              fillOpacity:0.08, weight:1.5, dashArray:'4 4' }}>
            <Popup>
              <div className="popup-zone-inner">
                <div className="popup-zone-title">{zone.name}</div>
                <div className="popup-zone-desc">{zone.description}</div>
                <div style={{ marginTop:6, fontSize:10, color:'#7a9ab8' }}>
                  Source: FAA NOTAM / national aviation authority
                </div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Launch site markers */}
        {showSites && padMarkers.map(({ launch, lat, lng }) => {
          const color     = getPadColor(launch.status?.id)
          const sel       = selectedLaunch?.id === launch.id
          const launching = isImminent(launch.net) && launch.status?.id === 1
          return (
            <Marker key={launch.id} position={[lat, lng]}
              icon={makeRocketIcon(color, sel, launching)}
              eventHandlers={{ click: () => onSelectLaunch(sel ? null : launch) }}
              zIndexOffset={sel ? 1000 : 0}>
              <Popup>
                <LaunchPopup launch={launch} onSelect={onSelectLaunch} onPlayVideo={onPlayVideo} />
              </Popup>
            </Marker>
          )
        })}

        {/* Live aircraft */}
        {showAircraft && aircraft.map(plane => (
          <Marker key={plane.icao} position={[plane.lat, plane.lng]}
            icon={makePlaneIcon(plane.heading)} zIndexOffset={500}>
            <Popup>
              <div className="popup-inner">
                <div className="popup-name" style={{ color:'#ffd740' }}>✈ {plane.callsign}</div>
                <div className="popup-vehicle" style={{ color:'#aac4d4' }}>{plane.country}</div>
                {plane.altFt != null && (
                  <div className="popup-site">
                    Alt: {plane.altFt.toLocaleString()} ft
                    {plane.speedKts != null ? ` · ${plane.speedKts} kts` : ''}
                    {plane.heading != null ? ` · ${plane.heading}°` : ''}
                  </div>
                )}
                <div style={{ fontSize:10, color:'#7a9ab8', marginTop:4 }}>
                  ICAO: {plane.icao.toUpperCase()} · via OpenSky
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ISS marker */}
        {showISS && issPos && (
          <Marker position={[issPos.lat, issPos.lng]}
            icon={makeISSIcon(issPos.visibility)}
            zIndexOffset={900}>
            <Popup>
              <div className="popup-inner">
                <div className="popup-name" style={{ color:'#bb86fc' }}>🛸 Int'l Space Station</div>
                <div className="popup-vehicle" style={{ color:'#aac4d4' }}>
                  {issPos.visibility === 'daylight' ? '☀️ In sunlight' : '🌑 In eclipse'}
                </div>
                <div className="popup-site">
                  Alt: {issPos.altKm.toFixed(1)} km
                  · {(issPos.speedKmh / 3.6).toFixed(2)} km/s
                </div>
                <div className="popup-site">
                  {issPos.lat.toFixed(2)}° {issPos.lat >= 0 ? 'N' : 'S'},&nbsp;
                  {Math.abs(issPos.lng).toFixed(2)}° {issPos.lng >= 0 ? 'E' : 'W'}
                </div>
                <div style={{ fontSize:10, color:'#7a9ab8', marginTop:4 }}>
                  Updates every 10 s · via wheretheiss.at
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="map-legend">
        <h4>Map Layers</h4>
        <div className="legend-item">
          <div className="legend-line" style={{ background:'#ff6b35' }} /> Maritime Exclusion
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background:'#bb86fc' }} /> FAA TFR / Airspace
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background:'#ff6b35', opacity:0.85 }} /> Ascent Arc
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background:'#00c8f0', opacity:0.6 }} /> Ground Track
        </div>
        <div className="legend-item"><div style={{ fontSize:12 }}>🚀</div> Launch Site</div>
        <div className="legend-item"><div style={{ fontSize:12 }}>✈</div> Live Aircraft</div>
        <div className="legend-item"><div style={{ fontSize:12 }}>🛸</div> ISS</div>
        <div style={{ borderTop:'1px solid var(--border)', margin:'8px 0 6px', paddingTop:6 }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:5, letterSpacing:1, textTransform:'uppercase' }}>Status</div>
        </div>
        <div className="legend-item"><div className="legend-dot" style={{ background:'#00e676' }} />Go for Launch</div>
        <div className="legend-item"><div className="legend-dot" style={{ background:'#ffd740' }} />TBD</div>
        <div className="legend-item"><div className="legend-dot" style={{ background:'#ff6b35' }} />Hold</div>
        <div className="legend-item"><div className="legend-dot" style={{ background:'#00c8f0' }} />Success</div>
        <div className="legend-item"><div className="legend-dot" style={{ background:'#ff4444' }} />Failure</div>
      </div>
    </div>
  )
}
