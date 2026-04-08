import { useState, useEffect } from 'react'

const INTEL_URL = `${import.meta.env.BASE_URL}launch-intel.json`
const CACHE_KEY = 'rocketdb:intel:v1'
const CACHE_TTL = 6 * 60 * 60 * 1000   // 6 h — matches scraper interval

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

export function useLaunchIntel() {
  const [intel, setIntel] = useState(() => loadCache() || [])

  useEffect(() => {
    if (loadCache()) return   // still fresh
    let cancelled = false
    fetch(INTEL_URL)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.launches) return
        saveCache(d.launches)
        setIntel(d.launches)
      })
      .catch(() => { /* silent — intel is supplementary */ })
    return () => { cancelled = true }
  }, [])

  return intel
}

/**
 * Find the best intel entry for an LL2 launch.
 * Scoring:  rocket name match (+3 exact / +2 partial) +  mission match (+2 partial) + provider (+1)
 * Threshold: ≥ 2 to avoid false positives.
 */
export function matchIntel(ll2Launch, intelLaunches) {
  if (!intelLaunches?.length) return null

  const ll2Rocket   = (ll2Launch.rocket?.configuration?.name || '').toLowerCase()
  const ll2MissionRaw = ll2Launch.name || ''
  const ll2Mission  = (ll2MissionRaw.split(' | ')[1] || ll2MissionRaw).toLowerCase()
  const ll2Provider = (ll2Launch.launch_service_provider?.name || '').toLowerCase()

  let best = null, bestScore = 0

  for (const entry of intelLaunches) {
    const iRocket   = (entry.rocket   || '').toLowerCase()
    const iMission  = (entry.mission  || '').toLowerCase()
    const iProvider = (entry.provider || '').toLowerCase()

    let score = 0

    if (ll2Rocket && iRocket) {
      if (iRocket === ll2Rocket)                                      score += 3
      else if (iRocket.includes(ll2Rocket) || ll2Rocket.includes(iRocket)) score += 2
    }
    if (ll2Mission && iMission && iMission.length > 2) {
      if (iMission.includes(ll2Mission) || ll2Mission.includes(iMission)) score += 2
    }
    if (ll2Provider && iProvider) {
      if (iProvider.includes(ll2Provider) || ll2Provider.includes(iProvider)) score += 1
    }

    if (score > bestScore) { bestScore = score; best = entry }
  }

  if (bestScore < 2) return null
  return best
}
