import React from 'react'
import {
  guessInclination, orbitAltKm, orbitalPeriod, orbitalVelocity,
} from '../utils/orbital'

export default function OrbitalParams({ launch }) {
  const orbitAbbrev = launch?.mission?.orbit?.abbrev
  const orbitName   = launch?.mission?.orbit?.name
  if (!orbitName && !orbitAbbrev) return null

  const padLat  = parseFloat(launch?.pad?.latitude)
  const inc     = guessInclination(orbitAbbrev, isNaN(padLat) ? null : padLat)
  const altKm   = orbitAltKm(orbitAbbrev)
  const Tmin    = Math.round(orbitalPeriod(altKm) / 60)
  const velKms  = orbitalVelocity(altKm).toFixed(2)

  const rows = [
    { label: 'Orbit',       val: orbitAbbrev || orbitName },
    { label: 'Altitude',    val: altKm >= 1000 ? `${(altKm/1000).toFixed(0)}k km` : `${altKm.toLocaleString()} km` },
    { label: 'Inclination', val: `${inc.toFixed(1)}°` },
    { label: 'Period',      val: `~${Tmin} min` },
    { label: 'Velocity',    val: `${velKms} km/s` },
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
