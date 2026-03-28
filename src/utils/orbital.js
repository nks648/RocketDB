// Orbital mechanics utilities — pure math, no external dependencies

const DEG = Math.PI / 180
const RAD = 180 / Math.PI
export const R_EARTH = 6371   // km
export const GM      = 3.986e14 // m³/s²
const EARTH_ROT_S    = 86164.1 // sidereal day, seconds

// ── Inclination lookup by orbit type ─────────────────────────────────────────
// Fixed inclinations for well-known orbit families; null = use pad latitude
const ORBIT_INC = {
  SSO: 97.5, ISS: 51.6, GEO: 0, MEO: 55,
  HEO: 63.4, PO: 90, SO: 90,
  LEO: null, GTO: null, HCO: null,
}

export function guessInclination(orbitAbbrev, padLatDeg) {
  const key = (orbitAbbrev || '').toUpperCase()
  const fixed = ORBIT_INC[key]
  if (fixed !== undefined && fixed !== null) return fixed
  if (padLatDeg != null && !isNaN(padLatDeg)) return Math.abs(padLatDeg)
  return 28.5 // KSC default
}

// ── Typical orbit altitude by abbrev (km) ────────────────────────────────────
export function orbitAltKm(orbitAbbrev) {
  const map = {
    LEO: 400, SSO: 520, ISS: 408, MEO: 8000,
    GEO: 35786, GTO: 35786, HEO: 40000, TLI: 380000, PO: 500, SO: 500,
  }
  return map[(orbitAbbrev || '').toUpperCase()] || 400
}

// ── Orbital period (seconds) for circular orbit at altKm ─────────────────────
export function orbitalPeriod(altKm) {
  const a = (R_EARTH + altKm) * 1000 // metres
  return 2 * Math.PI * Math.sqrt(a ** 3 / GM)
}

// ── Circular orbital velocity (km/s) ─────────────────────────────────────────
export function orbitalVelocity(altKm) {
  const r = (R_EARTH + altKm) * 1000
  return Math.sqrt(GM / r) / 1000
}

// ── Launch azimuth (°, clockwise from north) for target inclination ───────────
// Returns null if inclination < |pad latitude| (orbit impossible from site)
export function launchAzimuth(padLatDeg, inclinationDeg) {
  const lat = padLatDeg * DEG
  const inc = inclinationDeg * DEG
  const cosLat = Math.cos(lat)
  if (cosLat < 1e-10) return 90
  const sinAz = Math.cos(inc) / cosLat
  if (Math.abs(sinAz) > 1) return null
  return Math.asin(sinAz) * RAD   // eastward azimuth, NE quadrant
}

// ── Great-circle waypoint ─────────────────────────────────────────────────────
export function gcPoint(lat1Deg, lon1Deg, distKm, azimuthDeg) {
  const d   = distKm / R_EARTH
  const lat1 = lat1Deg * DEG
  const lon1 = lon1Deg * DEG
  const az   = azimuthDeg * DEG
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(az)
  )
  const lon2 = lon1 + Math.atan2(
    Math.sin(az) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  )
  return [lat2 * RAD, wrapLon(lon2 * RAD)]
}

function wrapLon(deg) { return ((deg + 540) % 360) - 180 }

// ── Ascent trajectory arc (pad → approximate orbit insertion) ─────────────────
export function trajectoryArc(padLat, padLng, inclinationDeg, steps = 40) {
  const az = launchAzimuth(padLat, inclinationDeg)
  if (az === null) return []
  const pts = []
  for (let i = 0; i <= steps; i++) {
    pts.push(gcPoint(padLat, padLng, (i / steps) * 2300, az))
  }
  return pts
}

// ── One-orbit ground track ────────────────────────────────────────────────────
// ascNodeLngDeg: longitude of ascending node — approximate as pad longitude
export function groundTrack(inclinationDeg, altKm, ascNodeLngDeg, numOrbits = 1.05) {
  const T    = orbitalPeriod(altKm)
  const rotRate = 360 / EARTH_ROT_S   // °/s
  const inc  = inclinationDeg * DEG
  const omega = ascNodeLngDeg * DEG
  const steps = Math.ceil(numOrbits * 200)
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps
    const u = frac * numOrbits * 2 * Math.PI
    const t = frac * numOrbits * T
    const lat = Math.asin(Math.sin(inc) * Math.sin(u))
    const lonOrb = Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u))
    const lon = omega + lonOrb - rotRate * t * DEG
    pts.push([lat * RAD, wrapLon(lon * RAD)])
  }
  return pts
}

// ── Split polyline at anti-meridian jumps (>180° lon gap) ────────────────────
export function splitAtAntimeridian(points) {
  if (points.length < 2) return [points]
  const segs = []
  let cur = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = cur[cur.length - 1]
    if (Math.abs(points[i][1] - prev[1]) > 180) {
      if (cur.length > 1) segs.push(cur)
      cur = [points[i]]
    } else {
      cur.push(points[i])
    }
  }
  if (cur.length > 1) segs.push(cur)
  return segs.length ? segs : [[]]
}
