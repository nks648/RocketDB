import { useState, useEffect } from 'react'

// RocketLaunch.Live free public API — no key required, CORS-enabled
const RLL_URL   = 'https://fdo.rocketlaunch.live/json/launches/next/25'
const CACHE_KEY = 'rocketdb:rll:v1'
const CACHE_TTL = 10 * 60 * 1000 // 10 min

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts < CACHE_TTL) return data
  } catch { /* ignore */ }
  return null
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* storage full */ }
}

export function useRLLLaunches() {
  const [launches, setLaunches] = useState(() => loadCache() || [])

  useEffect(() => {
    if (loadCache()) return // fresh cache — skip fetch
    let cancelled = false
    fetch(RLL_URL)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled || !json?.result) return
        saveCache(json.result)
        setLaunches(json.result)
      })
      .catch(() => { /* silent — RLL is supplementary */ })
    return () => { cancelled = true }
  }, [])

  return launches
}

/**
 * Find the best matching RLL launch for an LL2 launch.
 * Matches by vehicle name similarity; ignores launches with a confirmed NET.
 */
export function matchRLL(ll2Launch, rllLaunches) {
  if (!rllLaunches?.length) return null

  const vehicle = (
    ll2Launch.rocket?.configuration?.name ||
    ll2Launch.rocket?.configuration?.full_name || ''
  ).toLowerCase()

  const agency = (ll2Launch.launch_service_provider?.name || '').toLowerCase()

  let best = null
  let bestScore = 0

  for (const rll of rllLaunches) {
    const rllVehicle = (rll.vehicle?.name || '').toLowerCase()
    const rllProvider = (rll.provider?.name || '').toLowerCase()

    let score = 0
    if (vehicle && rllVehicle) {
      if (rllVehicle === vehicle) score += 3
      else if (rllVehicle.includes(vehicle) || vehicle.includes(rllVehicle)) score += 2
    }
    if (agency && rllProvider) {
      if (rllProvider.includes(agency) || agency.includes(rllProvider)) score += 1
    }

    if (score > bestScore) { bestScore = score; best = rll }
  }

  // Only return if we're reasonably confident (score ≥ 2)
  if (bestScore < 2) return null

  // Only useful if RLL has a specific window
  if (!best?.win_open) return null

  return best
}
